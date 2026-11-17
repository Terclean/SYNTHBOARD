// SYNTHBOARD – Strenge Validierung & Sanitisierung importierter JSON-Patches
import { MODULES } from './index.js';
import { resolveJackId } from './patchSystem.js';

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024; // 2 MiB
export const MAX_MODULES = 64;
export const MAX_CABLES = 256;
export const MAX_SNAPSHOT_SLOTS = 5;
export const MAX_NAME_LEN = 120;
export const SUPPORTED_VERSIONS = new Set([1, 2]);

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function sanitizeText(raw, fallback = 'Importiertes Board') {
  const cleaned = String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, MAX_NAME_LEN);
  return cleaned || fallback;
}

function parseEndpoint(ep) {
  if (typeof ep === 'string') {
    const idx = ep.indexOf(':');
    if (idx <= 0 || idx >= ep.length - 1) return null;
    return {
      moduleId: ep.slice(0, idx).trim(),
      jackId: ep.slice(idx + 1).trim(),
    };
  }
  if (isPlainObject(ep) && typeof ep.moduleId === 'string' && typeof ep.jackId === 'string') {
    const moduleId = ep.moduleId.trim();
    const jackId = ep.jackId.trim();
    if (!moduleId || !jackId) return null;
    return { moduleId, jackId };
  }
  return null;
}

function sanitizeExtra(modType, rawExtra) {
  if (!isPlainObject(rawExtra)) return undefined;
  const out = {};
  if (modType === 'chord_glide') {
    if (Array.isArray(rawExtra.steps)) {
      out.steps = rawExtra.steps.slice(0, 16).map((s) => ({
        root: Number.isFinite(Number(s?.root)) ? Math.max(0, Math.min(11, Math.round(Number(s.root)))) : 0,
        type: typeof s?.type === 'string' ? s.type.slice(0, 16) : 'maj7',
        bars: Number.isFinite(Number(s?.bars)) ? Math.max(1, Math.min(16, Math.round(Number(s.bars)))) : 1,
      }));
    }
    if (Number.isFinite(Number(rawExtra.voiceLeading))) {
      out.voiceLeading = Number(rawExtra.voiceLeading) ? 1 : 0;
    }
  } else {
    if (Array.isArray(rawExtra.voices)) {
      out.voices = rawExtra.voices.slice(0, 16).map((v) => Boolean(v));
    }
    if (typeof rawExtra.presetKey === 'string') {
      out.presetKey = rawExtra.presetKey.slice(0, 40);
    }
    if (Number.isFinite(Number(rawExtra.seed))) {
      out.seed = Math.round(Number(rawExtra.seed));
    }
  }
  return Object.keys(out).length ? out : undefined;
}

function validateModuleValues(modType, def, rawValues, ctxLabel) {
  const paramMap = new Map((def.params || []).map((p) => [p.id, p]));
  const optionMap = new Map((def.options || []).map((o) => [o.id, o]));
  const sanitized = {};

  if (rawValues === undefined) return { ok: true, values: sanitized };
  if (!isPlainObject(rawValues)) {
    return { ok: false, error: `${ctxLabel}: „values“ muss ein Objekt sein.` };
  }

  for (const [k, rawVal] of Object.entries(rawValues)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;

    // Legacy-Alias für chord_glide: filter -> cutoff
    const key = (modType === 'chord_glide' && k === 'filter') ? 'cutoff' : k;

    const pDef = paramMap.get(key);
    if (pDef) {
      if (typeof rawVal !== 'number' || !Number.isFinite(rawVal)) {
        return { ok: false, error: `${ctxLabel}: Parameter „${key}“ muss eine endliche Zahl sein.` };
      }
      if (rawVal < pDef.min || rawVal > pDef.max) {
        const clamped = Math.max(pDef.min, Math.min(pDef.max, rawVal));
        console.warn(`[SYNTHBOARD Import] ${ctxLabel}: Parameter „${key}“ (${rawVal}) wurde auf [${pDef.min}, ${pDef.max}] -> ${clamped} geclampt.`);
        sanitized[key] = clamped;
      } else {
        sanitized[key] = rawVal;
      }
      continue;
    }

    const oDef = optionMap.get(key);
    if (oDef) {
      const validChoices = new Set((oDef.choices || []).map((c) => String(c[0])));
      if (!validChoices.has(String(rawVal))) {
        return {
          ok: false,
          error: `${ctxLabel}: Ungültiger Auswahlwert „${String(rawVal)}“ für Option „${key}“.`,
        };
      }
      sanitized[key] = typeof oDef.value === 'number' ? Number(rawVal) : String(rawVal);
    }
    // Unbekannte Parameter-Keys werden ignoriert, nicht blind übernommen
  }

  return { ok: true, values: sanitized };
}

export function validateFileSize(byteSize, maxBytes = MAX_IMPORT_BYTES) {
  if (!Number.isFinite(byteSize) || byteSize < 0) {
    return { ok: false, error: 'Ungültige Dateigröße.' };
  }
  if (byteSize > maxBytes) {
    const mb = (maxBytes / (1024 * 1024)).toFixed(1).replace('.0', '');
    return { ok: false, error: `Datei ist zu groß (maximal ${mb} MiB erlaubt).` };
  }
  return { ok: true };
}

/**
 * Validiert und sanitisiert einen externen SYNTHBOARD-JSON-Patch vollständig,
 * bevor Module oder Audio-Nodes erstellt werden.
 */
export function validateAndSanitizePatchState(rawData, { fallbackName = 'Importiertes Board' } = {}) {
  if (!isPlainObject(rawData)) {
    return { ok: false, error: 'Die JSON-Datei muss ein Objekt enthalten.' };
  }

  const rawState = isPlainObject(rawData.state) ? rawData.state : rawData;

  if (rawState.version !== undefined) {
    if (typeof rawState.version !== 'number' || !Number.isInteger(rawState.version) || !SUPPORTED_VERSIONS.has(rawState.version)) {
      return { ok: false, error: `Nicht unterstützte Format-Version: ${String(rawState.version)}.` };
    }
  }

  let master = 0.8;
  if (rawState.master !== undefined) {
    if (typeof rawState.master !== 'number' || !Number.isFinite(rawState.master)) {
      return { ok: false, error: 'Ungültiger Master-Pegel (muss eine endliche Zahl sein).' };
    }
    if (rawState.master < 0 || rawState.master > 1.5) {
      master = Math.max(0, Math.min(1.5, rawState.master));
      console.warn(`[SYNTHBOARD Import] Master-Pegel (${rawState.master}) wurde auf [0, 1.5] -> ${master} geclampt.`);
    } else {
      master = rawState.master;
    }
  }

  if (!Array.isArray(rawState.modules)) {
    return { ok: false, error: 'Kein gültiges Board: „modules“-Array fehlt.' };
  }
  if (rawState.modules.length > MAX_MODULES) {
    return { ok: false, error: `Zu viele Module (${rawState.modules.length}, maximal ${MAX_MODULES} erlaubt).` };
  }

  const seenIds = new Set();
  const modules = [];
  const modById = new Map();
  const modByType = new Map();

  for (let i = 0; i < rawState.modules.length; i++) {
    const rawMod = rawState.modules[i];
    if (!isPlainObject(rawMod)) {
      return { ok: false, error: `Modul #${i + 1} ist kein gültiges Objekt.` };
    }
    if (typeof rawMod.type !== 'string' || !MODULES[rawMod.type]) {
      return { ok: false, error: `Unbekannter Modultyp: „${String(rawMod.type)}“.` };
    }

    const def = MODULES[rawMod.type];
    let modId;
    if (rawMod.id !== undefined) {
      if (typeof rawMod.id !== 'string' || !rawMod.id.trim() || rawMod.id.length > 80) {
        return { ok: false, error: `Modul #${i + 1} (${rawMod.type}) hat eine ungültige ID.` };
      }
      modId = rawMod.id.trim();
      if (seenIds.has(modId)) {
        return { ok: false, error: `Doppelte Modul-ID gefunden: „${modId}“.` };
      }
    } else {
      let counter = i + 1;
      while (seenIds.has(`m${counter}`)) counter++;
      modId = `m${counter}`;
    }
    seenIds.add(modId);

    const mergedRawValues = (isPlainObject(rawMod.options) || isPlainObject(rawMod.values))
      ? { ...(isPlainObject(rawMod.options) ? rawMod.options : {}), ...(isPlainObject(rawMod.values) ? rawMod.values : {}) }
      : rawMod.values;
    const valCheck = validateModuleValues(rawMod.type, def, mergedRawValues, `Modul „${modId}“`);
    if (!valCheck.ok) return valCheck;

    const cleanMod = {
      id: modId,
      type: rawMod.type,
      enabled: rawMod.enabled === undefined ? true : Boolean(rawMod.enabled),
      collapsed: rawMod.collapsed === undefined ? false : Boolean(rawMod.collapsed),
      values: valCheck.values,
    };

    if (rawMod.pos !== undefined) {
      if (!isPlainObject(rawMod.pos) || typeof rawMod.pos.x !== 'number' || typeof rawMod.pos.y !== 'number'
        || !Number.isFinite(rawMod.pos.x) || !Number.isFinite(rawMod.pos.y)
        || Math.abs(rawMod.pos.x) > 50000 || Math.abs(rawMod.pos.y) > 50000) {
        return { ok: false, error: `Modul „${modId}“ hat ungültige Positionskoordinaten.` };
      }
      cleanMod.pos = { x: rawMod.pos.x, y: rawMod.pos.y };
    }

    const stripBounds = [
      ['chPan', -1, 1],
      ['chDelay', 0, 1],
      ['chReverb', 0, 1],
      ['chLevel', 0, 1.5],
    ];
    for (const [k, min, max] of stripBounds) {
      if (rawMod[k] !== undefined) {
        if (typeof rawMod[k] !== 'number' || !Number.isFinite(rawMod[k])) {
          return { ok: false, error: `Modul „${modId}“: Ungültiger Kanalzugwert „${k}“.` };
        }
        if (rawMod[k] < min || rawMod[k] > max) {
          const clamped = Math.max(min, Math.min(max, rawMod[k]));
          console.warn(`[SYNTHBOARD Import] Modul „${modId}“: Kanalzugwert „${k}“ (${rawMod[k]}) wurde auf [${min}, ${max}] -> ${clamped} geclampt.`);
          cleanMod[k] = clamped;
        } else {
          cleanMod[k] = rawMod[k];
        }
      }
    }

    const cleanExtra = sanitizeExtra(rawMod.type, rawMod.extra);
    if (cleanExtra) cleanMod.extra = cleanExtra;

    modules.push(cleanMod);
    modById.set(modId, cleanMod);
    if (!modByType.has(rawMod.type)) modByType.set(rawMod.type, cleanMod);
  }

  // Kabel validieren
  const cables = [];
  if (rawState.cables !== undefined) {
    if (!Array.isArray(rawState.cables)) {
      return { ok: false, error: '„cables“ muss ein Array sein.' };
    }
    if (rawState.cables.length > MAX_CABLES) {
      return { ok: false, error: `Zu viele Kabel (${rawState.cables.length}, maximal ${MAX_CABLES} erlaubt).` };
    }

    const occupiedInputs = new Set();
    for (let i = 0; i < rawState.cables.length; i++) {
      const c = rawState.cables[i];
      if (!isPlainObject(c)) {
        return { ok: false, error: `Kabel #${i + 1} ist kein gültiges Objekt.` };
      }
      const fromEp = parseEndpoint(c.from);
      const toEp = parseEndpoint(c.to);
      if (!fromEp || !toEp) {
        return { ok: false, error: `Kabel #${i + 1} hat ungültige Anschlüsse (erwartet „modulId:buchse“).` };
      }

      const fromMod = modById.get(fromEp.moduleId) || modByType.get(fromEp.moduleId);
      const toMod = modById.get(toEp.moduleId) || modByType.get(toEp.moduleId);
      if (!fromMod || !toMod) {
        return { ok: false, error: `Kabel #${i + 1}: Unbekanntes Modul („${fromEp.moduleId}“ -> „${toEp.moduleId}“).` };
      }

      const fromMeta = MODULES[fromMod.type];
      const toMeta = MODULES[toMod.type];
      const fromPort = resolveJackId({ meta: fromMeta }, fromEp.jackId, 'out');
      const toPort = resolveJackId({ meta: toMeta }, toEp.jackId, 'in');

      const fromJack = fromMeta.jacks?.find((j) => j.id === fromPort && j.type === 'out');
      const toJack = toMeta.jacks?.find((j) => j.id === toPort && j.type === 'in');
      if (!fromJack) {
        return { ok: false, error: `Kabel #${i + 1}: Ungültiger Ausgang „${fromEp.jackId}“ an Modul „${fromMod.id}“.` };
      }
      if (!toJack) {
        return { ok: false, error: `Kabel #${i + 1}: Ungültiger Eingang „${toEp.jackId}“ an Modul „${toMod.id}“.` };
      }
      if (fromMod.id === toMod.id && fromPort === toPort) {
        return { ok: false, error: `Kabel #${i + 1}: Ungültige Selbstverbindung auf „${fromMod.id}:${fromPort}“.` };
      }

      let depth = 1;
      if (c.depth !== undefined) {
        if (typeof c.depth !== 'number' || !Number.isFinite(c.depth)) {
          return { ok: false, error: `Kabel #${i + 1}: „depth“ muss eine endliche Zahl sein.` };
        }
        if (c.depth < 0 || c.depth > 2) {
          depth = Math.max(0, Math.min(2, c.depth));
          console.warn(`[SYNTHBOARD Import] Kabel #${i + 1}: „depth“ (${c.depth}) wurde auf [0, 2] -> ${depth} geclampt.`);
        } else {
          depth = c.depth;
        }
      }

      const toKey = `${toMod.id}:${toPort}`.toLowerCase();
      if (occupiedInputs.has(toKey)) continue;
      occupiedInputs.add(toKey);

      cables.push({
        from: `${fromMod.id}:${fromPort}`,
        to: `${toMod.id}:${toPort}`,
        depth,
      });
    }
  }

  // Snapshots validieren (Root data.snapshots oder data.state.snapshots)
  let snapshots = null;
  const rawSnaps = isPlainObject(rawState.snapshots)
    ? rawState.snapshots
    : (isPlainObject(rawData.snapshots) ? rawData.snapshots : null);

  if (rawSnaps && (isPlainObject(rawSnaps.slots) || rawSnaps['1'] || rawSnaps[1])) {
    const rawSlots = isPlainObject(rawSnaps.slots) ? rawSnaps.slots : rawSnaps;
    const slotKeys = Object.keys(rawSlots);
    if (slotKeys.length > MAX_SNAPSHOT_SLOTS) {
      return { ok: false, error: `Zu viele Snapshot-Slots (maximal ${MAX_SNAPSHOT_SLOTS} erlaubt).` };
    }

    const cleanSlots = { 1: null, 2: null, 3: null, 4: null, 5: null };
    for (const sk of ['1', '2', '3', '4', '5']) {
      const rawSlot = rawSlots[sk];
      if (rawSlot === null || rawSlot === undefined) continue;
      if (!isPlainObject(rawSlot)) {
        return { ok: false, error: `Snapshot-Slot ${sk} ist ungültig.` };
      }
      const rawMap = isPlainObject(rawSlot.snapshot)
        ? rawSlot.snapshot
        : (isPlainObject(rawSlot.values) ? rawSlot.values : (isPlainObject(rawSlot.modules) ? rawSlot.modules : null));

      if (rawMap) {
        const cleanMap = {};
        for (const [mKey, override] of Object.entries(rawMap)) {
          if (!isPlainObject(override)) continue;
          const targetMod = modById.get(mKey) || modByType.get(mKey);
          if (!targetMod) continue;
          const def = MODULES[targetMod.type];
          const valSrc = isPlainObject(override.values) ? override.values : override;
          const stripped = {};
          const metaKeys = new Set(['type', 'title', 'enabled', 'channelStrip', 'extra', 'values', 'chPan', 'chDelay', 'chReverb', 'chLevel', 'pan', 'delay', 'reverb']);
          for (const [pk, pv] of Object.entries(valSrc)) {
            if (!metaKeys.has(pk)) stripped[pk] = pv;
          }
          const valCheck = validateModuleValues(targetMod.type, def, stripped, `Snapshot ${sk} (${targetMod.id})`);
          if (!valCheck.ok) return valCheck;

          cleanMap[targetMod.id] = {
            type: targetMod.type,
            values: valCheck.values,
            ...(typeof override.enabled === 'boolean' ? { enabled: override.enabled } : {}),
            ...(isPlainObject(override.channelStrip) ? { channelStrip: { ...override.channelStrip } } : {}),
          };
        }
        cleanSlots[sk] = {
          ...(typeof rawSlot.name === 'string' ? { name: sanitizeText(rawSlot.name, `Slot ${sk}`) } : {}),
          values: cleanMap,
        };
      }
    }

    const parsedActive = Number(rawSnaps.activeSlot);
    const parsedSpeed = Number(rawSnaps.currentSpeed);
    snapshots = {
      slots: cleanSlots,
      activeSlot: (Number.isInteger(parsedActive) && parsedActive >= 1 && parsedActive <= 5) ? parsedActive : null,
      currentSpeed: (parsedSpeed === 6 || parsedSpeed === 7 || parsedSpeed === 8) ? parsedSpeed : 7,
    };
  }

  const cleanName = sanitizeText(rawData.name, fallbackName);
  const state = {
    version: rawState.version ?? 2,
    master,
    modules,
    cables,
    snapshots,
  };

  return { ok: true, name: cleanName, state };
}
