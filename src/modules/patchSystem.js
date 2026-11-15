// SYNTHBOARD – Modular Cable Patch & Signal Routing System

export const SIGNAL_COLORS = {
  gate: '#fbbf24',    // Gold / Amber (Trigger & Gate)
  pitch: '#a855f7',   // Neon Violet (Noten & Tonhöhe)
  mod: '#10b981',     // Emerald Mint (Modulation & LFO)
  clock: '#06b6d4',   // Electric Cyan (Clock & Sync)
  audio: '#60a5fa',   // Sky Blue (Audio)
};

/**
 * Löst Buchsen-IDs tolerant auf: Unterstützt interne IDs, visuelle Labels
 * (z. B. '1/16' -> 'clockOut', '/4 (1/4)' -> 'div4Out') sowie gängige Aliase.
 */
export function resolveJackId(mod, portId, expectedType = null) {
  if (!mod?.meta?.jacks || !portId) return portId;
  const jacks = mod.meta.jacks;
  const raw = String(portId).trim();

  // 1. Exakte ID-Übereinstimmung
  let found = jacks.find((j) => j.id === raw && (!expectedType || j.type === expectedType));
  if (found) return found.id;

  // 2. Case-Insensitive ID-Übereinstimmung
  const lower = raw.toLowerCase();
  found = jacks.find((j) => j.id.toLowerCase() === lower && (!expectedType || j.type === expectedType));
  if (found) return found.id;

  // 3. Label-Übereinstimmung (exakt oder case-insensitive)
  found = jacks.find((j) => j.label && j.label.toLowerCase() === lower && (!expectedType || j.type === expectedType));
  if (found) return found.id;

  // 4. Normalisierte Zeichenkette (Klammern, Schrägstriche, Leerzeichen entfernen)
  const norm = lower.replace(/[\s\(\)\/\-_]/g, '');
  found = jacks.find((j) => {
    if (expectedType && j.type !== expectedType) return false;
    const jNorm = j.id.toLowerCase().replace(/[\s\(\)\/\-_]/g, '');
    const lNorm = (j.label || '').toLowerCase().replace(/[\s\(\)\/\-_]/g, '');
    return jNorm === norm || lNorm === norm;
  });
  if (found) return found.id;

  // 5. Modulspezifische Aliase
  const mType = mod.meta.type;
  if (mType === 'master_clock') {
    if (norm === '116' || norm === 'clock' || norm === 'clockout') return 'clockOut';
    if (norm === '18' || norm === 'div2' || norm === 'div2out') return 'div2Out';
    if (norm === '14' || norm === 'div4' || norm === 'div4out') return 'div4Out';
    if (norm === '1bar' || norm === 'bar' || norm === 'barout') return 'barOut';
    if (norm === 'reset' || norm === 'resetout') return 'resetOut';
  } else if (mType === 'clock_divider') {
    if (norm === 'clock' || norm === 'clockin') return 'clockIn';
    if (norm === 'reset' || norm === 'resetin') return 'resetIn';
    if (norm === '1' || norm === 'div1' || norm === 'div1out' || norm === 'outa') return 'div1Out';
    if (norm === '2' || norm === 'div2' || norm === 'div2out') return 'div2Out';
    if (norm === '3' || norm === 'div3' || norm === 'div3out') return 'div3Out';
    if (norm === '4' || norm === 'div4' || norm === 'div4out' || norm === 'outb') return 'div4Out';
    if (norm === '8' || norm === 'div8' || norm === 'div8out' || norm === 'outc') return 'div8Out';
    if (norm === '16' || norm === 'div16' || norm === 'div16out' || norm === 'outd') return 'div16Out';
  } else if (mType === 'random_walk') {
    if (norm === 'clock' || norm === 'clockin' || norm === 'step') return 'clockIn';
    if (norm === 'reset' || norm === 'resetin') return 'resetIn';
    if (norm === 'pitch' || norm === 'pitchout' || norm === 'cv') return 'pitchOut';
    if (norm === 'gate' || norm === 'gateout') return 'gateOut';
  } else if (mType === 'slow_random') {
    if (norm === 'trig' || norm === 'trigin' || norm === 'clock' || norm === 'clockin' || norm === 'shclk' || norm === 'shclock') return 'trigIn';
    if (norm === 'cv' || norm === 'cvout' || norm === 'mod' || norm === 'modout' || norm === 'smooth' || norm === 'smoothcv' || norm === 'sh' || norm === 'shout' || norm === 'shcv') return 'cvOut';
    if (norm === 'inv' || norm === 'invout' || norm === 'invcv') return 'invOut';
  } else if (mType === 'euclidean') {
    if (norm === 'clock' || norm === 'clockin') return 'clockIn';
    if (norm === 'reset' || norm === 'resetin') return 'resetIn';
    if (norm === 'trig' || norm === 'trigout' || norm === 'gate' || norm === 'gateout') return 'trigOut';
    if (norm === 'inv' || norm === 'invout' || norm === 'offbeat' || norm === 'accent' || norm === 'accentout') return 'invOut';
  } else if (mType === 'prob_gate') {
    if (norm === 'trig' || norm === 'trigin' || norm === 'gate' || norm === 'gatein') return 'trigIn';
    if (norm === 'passed' || norm === 'passedout' || norm === 'trigout' || norm === 'gatea' || norm === 'gateout' || norm === 'outa' || norm === 'pass' || norm === 'passout') return 'trigOut';
    if (norm === 'dropped' || norm === 'droppedout' || norm === 'alt' || norm === 'altout' || norm === 'gateb' || norm === 'outb') return 'altOut';
  } else if (mType === 'pluck') {
    if (norm === 'gate' || norm === 'gatein' || norm === 'trig' || norm === 'trigin') return 'gateIn';
    if (norm === 'pitch' || norm === 'pitchin') return 'pitchIn';
    if (norm === 'vca' || norm === 'vcacv') return 'vcaCv';
    if (norm === 'pan' || norm === 'pancv') return 'panCv';
    if (norm === 'tone' || norm === 'tonecv' || norm === 'filter' || norm === 'filtercv' || norm === 'damp' || norm === 'dampcv' || norm === 'cutoff' || norm === 'cutoffcv' || norm === 'modcutoff') return 'modCutoff';
  } else if (mType === 'chord_glide') {
    if (norm === 'clock' || norm === 'clockin') return 'clockIn';
    if (norm === 'reset' || norm === 'resetin') return 'resetIn';
    if (norm === 'next' || norm === 'nexttrig') return 'nextTrig';
    if (norm === 'transp' || norm === 'transpose' || norm === 'transposecv') return 'transposeCv';
    if (norm === 'glide' || norm === 'glidecv') return 'glideCv';
    if (norm === 'cutoff' || norm === 'cutoffcv' || norm === 'filter' || norm === 'filtercv') return 'cutoffCv';
    if (norm === 'vca' || norm === 'vcacv') return 'vcaCv';
    if (norm === 'pan' || norm === 'pancv') return 'panCv';
    if (norm === 'pitch' || norm === 'pitchout' || norm === 'polypitch') return 'pitchOut';
    if (norm === 'root' || norm === 'rootout' || norm === 'rootpitch') return 'rootOut';
    if (norm === 'gate' || norm === 'gateout' || norm === 'chordtrig') return 'gateOut';
  } else if (mType === 'violin') {
    if (norm === 'gate' || norm === 'gatein' || norm === 'bow' || norm === 'bowgate') return 'gateIn';
    if (norm === 'pitch' || norm === 'pitchin') return 'pitchIn';
    if (norm === 'bowcv') return 'bowCv';
    if (norm === 'vib' || norm === 'vibcv' || norm === 'vibrato' || norm === 'vibratocv') return 'vibratoCv';
    if (norm === 'glide' || norm === 'glidecv') return 'glideCv';
    if (norm === 'vca' || norm === 'vcacv') return 'vcaCv';
    if (norm === 'pan' || norm === 'pancv') return 'panCv';
  } else if (mType === 'felt_piano') {
    if (norm === 'gate' || norm === 'gatein') return 'gateIn';
    if (norm === 'pitch' || norm === 'pitchin') return 'pitchIn';
    if (norm === 'vca' || norm === 'vcacv') return 'vcaCv';
    if (norm === 'felt' || norm === 'feltcv') return 'feltCv';
    if (norm === 'pan' || norm === 'pancv') return 'panCv';
  } else if (mType === 'slope_generator') {
    if (norm === 'trig' || norm === 'trigin') return 'trigIn';
    if (norm === 'gate' || norm === 'gatein') return 'gateIn';
    if (norm === 'rise' || norm === 'risecv' || norm === 'modrise') return 'modRise';
    if (norm === 'fall' || norm === 'fallcv' || norm === 'modfall') return 'modFall';
    if (norm === 'env' || norm === 'envout') return 'envOut';
    if (norm === 'inv' || norm === 'invout') return 'invOut';
    if (norm === 'eor' || norm === 'eorout') return 'eorOut';
    if (norm === 'eof' || norm === 'eofout' || norm === 'eoc' || norm === 'eocout') return 'eofOut';
  } else if (mType === 'logic_switch') {
    if (norm === 'gate' || norm === 'gatein') return 'gateIn';
    if (norm === 'ctrl' || norm === 'ctrlcv' || norm === 'mod') return 'ctrlCv';
    if (norm === 'pass' || norm === 'passout' || norm === 'passa') return 'passOut';
    if (norm === 'inv' || norm === 'invpass' || norm === 'invpassout' || norm === 'invb') return 'invPassOut';
    if (norm === 'toggle' || norm === 'togglein') return 'toggleIn';
    if (norm === 'reset' || norm === 'resetin') return 'resetIn';
    if (norm === 'state' || norm === 'stateout' || norm === 'latch' || norm === 'latchcv') return 'stateOut';
    if (norm === 'in1') return 'in1';
    if (norm === 'in2') return 'in2';
    if (norm === 'and' || norm === 'andout') return 'andOut';
    if (norm === 'or' || norm === 'orout') return 'orOut';
  } else if (mType === 'snapshot_ctrl') {
    if (norm === 'slot1' || norm === 'slot1in' || norm === '1') return 'slot1In';
    if (norm === 'slot2' || norm === 'slot2in' || norm === '2') return 'slot2In';
    if (norm === 'slot3' || norm === 'slot3in' || norm === '3') return 'slot3In';
    if (norm === 'slot4' || norm === 'slot4in' || norm === '4') return 'slot4In';
    if (norm === 'slot5' || norm === 'slot5in' || norm === '5') return 'slot5In';
    if (norm === 'next' || norm === 'nextin') return 'nextIn';
    if (norm === 'reset' || norm === 'resetin') return 'resetIn';
  } else if (mType === 'chord_arp') {
    if (norm === 'clock' || norm === 'clockin') return 'clockIn';
    if (norm === 'reset' || norm === 'resetin') return 'resetIn';
    if (norm === 'pitch' || norm === 'pitchin' || norm === 'polypitch') return 'pitchIn';
    if (norm === 'gate' || norm === 'gateout') return 'gateOut';
    if (norm === 'pitchout') return 'pitchOut';
    if (norm === 'accent' || norm === 'accentout') return 'accentOut';
  } else if (mType === 'granular_cloud') {
    if (norm === 'freeze' || norm === 'freezein') return 'freezeIn';
    if (norm === 'mix' || norm === 'mixcv' || norm === 'cvmix') return 'cvMix';
    if (norm === 'texture' || norm === 'texturecv' || norm === 'cvtexture') return 'cvTexture';
  }

  // 6. Generische Fallbacks für Ports mit Typenangabe
  if (expectedType === 'in' || !expectedType) {
    if (norm === 'clock' || norm === 'clockin') {
      const j = jacks.find((x) => x.type === 'in' && x.signal === 'clock');
      if (j) return j.id;
    }
    if (norm === 'gate' || norm === 'gatein' || norm === 'trig' || norm === 'trigin') {
      const j = jacks.find((x) => x.type === 'in' && x.signal === 'gate');
      if (j) return j.id;
    }
    if (norm === 'pitch' || norm === 'pitchin') {
      const j = jacks.find((x) => x.type === 'in' && x.signal === 'pitch');
      if (j) return j.id;
    }
    if (norm === 'vca' || norm === 'vcacv') {
      const j = jacks.find((x) => x.type === 'in' && x.id === 'vcaCv');
      if (j) return j.id;
    }
    if (norm === 'pan' || norm === 'pancv') {
      const j = jacks.find((x) => x.type === 'in' && x.id === 'panCv');
      if (j) return j.id;
    }
  }
  if (expectedType === 'out') {
    if (norm === 'gate' || norm === 'gateout' || norm === 'trig' || norm === 'trigout') {
      const j = jacks.find((x) => x.type === 'out' && x.signal === 'gate');
      if (j) return j.id;
    }
  }

  return raw;
}

export class PatchSystem {
  constructor(engine) {
    this.engine = engine;
    this.connections = new Map(); // id -> connection object
    this.onActivity = null; // Callback für optische LED-Pulse auf Jacks
    this.onConnectionsChanged = null;
  }

  static makeId(fromModuleId, fromPortId, toModuleId, toPortId) {
    return `${fromModuleId}:${fromPortId}->${toModuleId}:${toPortId}`;
  }

  connect(fromModuleId, fromPortId, toModuleId, toPortId, customColor = null, depth = 1) {
    if (fromModuleId === toModuleId && fromPortId === toPortId) return null;

    let fromMod = this.engine.find(fromModuleId) || this.engine.findByType?.(fromModuleId);
    let toMod = this.engine.find(toModuleId) || this.engine.findByType?.(toModuleId);
    if (!fromMod || !toMod) return null;

    const actualFromId = fromMod.id;
    const actualToId = toMod.id;

    const actualFromPortId = resolveJackId(fromMod, fromPortId, 'out');
    const actualToPortId = resolveJackId(toMod, toPortId, 'in');

    // Ein Input-Jack kann typischerweise nur von einem Kabel gespeist werden (Eurorack-Standard)
    this.disconnectPort(actualToId, actualToPortId);

    const fromJack = fromMod.meta.jacks?.find((j) => j.id === actualFromPortId);
    const toJack = toMod.meta.jacks?.find((j) => j.id === actualToPortId);

    const signal = fromJack?.signal || toJack?.signal || 'gate';
    const color = customColor || SIGNAL_COLORS[signal] || '#a0aab2';

    const id = PatchSystem.makeId(actualFromId, actualFromPortId, actualToId, actualToPortId);
    const conn = {
      id,
      fromModuleId: actualFromId,
      fromPortId: actualFromPortId,
      toModuleId: actualToId,
      toPortId: actualToPortId,
      signal,
      color,
      depth: Number.isFinite(depth) ? Math.max(0, Math.min(2, depth)) : 1, // Modulationsstärke pro Kabel
    };

    this.connections.set(id, conn);
    this.onConnectionsChanged?.();
    return conn;
  }

  disconnect(id) {
    if (this.connections.delete(id)) {
      this.onConnectionsChanged?.();
      return true;
    }
    return false;
  }

  disconnectPort(moduleId, portId) {
    let changed = false;
    for (const [id, c] of this.connections.entries()) {
      if ((c.toModuleId === moduleId && c.toPortId === portId) ||
          (c.fromModuleId === moduleId && c.fromPortId === portId)) {
        this.connections.delete(id);
        changed = true;
      }
    }
    if (changed) this.onConnectionsChanged?.();
  }

  disconnectModule(moduleId) {
    let changed = false;
    for (const [id, c] of this.connections.entries()) {
      if (c.fromModuleId === moduleId || c.toModuleId === moduleId) {
        this.connections.delete(id);
        changed = true;
      }
    }
    if (changed) this.onConnectionsChanged?.();
  }

  hasIncoming(toModuleId, toPortId) {
    for (const c of this.connections.values()) {
      if (c.toModuleId === toModuleId && c.toPortId === toPortId) return true;
    }
    return false;
  }

  getIncoming(toModuleId, toPortId) {
    for (const c of this.connections.values()) {
      if (c.toModuleId === toModuleId && c.toPortId === toPortId) return c;
    }
    return null;
  }

  getConnections() {
    return Array.from(this.connections.values());
  }

  // ── Signalweiterleitung in Audio-Echtzeit ──
  routeTrigger(fromModuleId, fromPortId, time, velocity = 1, duration = 0.1, meta = null) {
    for (const c of this.connections.values()) {
      if (c.fromModuleId === fromModuleId && c.fromPortId === fromPortId) {
        const target = this.engine.find(c.toModuleId);
        if (target && target.enabled) {
          const toJack = target.meta.jacks?.find((j) => j.id === c.toPortId);
          if (toJack?.signal === 'clock') {
            target.receiveClock(c.toPortId, time, 0);
          } else {
            target.receiveTrigger(c.toPortId, time, velocity, duration, meta);
          }
        }
        this.notifyActivity(c.fromModuleId, c.fromPortId, c.toModuleId, c.toPortId, time, 'gate');
      }
    }
  }

  routePitch(fromModuleId, fromPortId, time, midiNote, velocity = 1, duration = 0.1, meta = null) {
    for (const c of this.connections.values()) {
      if (c.fromModuleId === fromModuleId && c.fromPortId === fromPortId) {
        const target = this.engine.find(c.toModuleId);
        if (target && target.enabled) {
          target.receivePitch(c.toPortId, time, midiNote, velocity, duration, meta);
        }
        this.notifyActivity(c.fromModuleId, c.fromPortId, c.toModuleId, c.toPortId, time, 'pitch');
      }
    }
  }

  routeMod(fromModuleId, fromPortId, value, time) {
    for (const c of this.connections.values()) {
      if (c.fromModuleId === fromModuleId && c.fromPortId === fromPortId) {
        const target = this.engine.find(c.toModuleId);
        if (target && target.enabled) {
          let v = value;
          const d = c.depth ?? 1;
          if (d !== 1) {
            // Pan wird um die Mitte skaliert, alle anderen CVs wie ein Abschwächer
            v = c.toPortId === 'panCv' ? 0.5 + (value - 0.5) * d : value * d;
          }
          target.receiveMod(c.toPortId, v, time);
        }
      }
    }
  }

  routeClock(fromModuleId, fromPortId, time, tick = 0) {
    for (const c of this.connections.values()) {
      if (c.fromModuleId === fromModuleId && c.fromPortId === fromPortId) {
        const target = this.engine.find(c.toModuleId);
        if (target && target.enabled) {
          const toJack = target.meta.jacks?.find((j) => j.id === c.toPortId);
          if (toJack?.signal === 'gate') {
            target.receiveTrigger(c.toPortId, time, 0.9, 0.15);
          } else {
            target.receiveClock(c.toPortId, time, tick);
          }
        }
        this.notifyActivity(c.fromModuleId, c.fromPortId, c.toModuleId, c.toPortId, time, 'clock');
      }
    }
  }

  notifyActivity(fromModuleId, fromPortId, toModuleId, toPortId, time, type) {
    if (!this.onActivity) return;
    const now = this.engine.ctx?.currentTime || 0;
    const delayMs = Math.max(0, (time - now) * 1000);
    setTimeout(() => {
      this.onActivity({ fromModuleId, fromPortId, toModuleId, toPortId, type });
    }, delayMs);
  }

  getState() {
    return Array.from(this.connections.values()).map(c => ({
      from: `${c.fromModuleId}:${c.fromPortId}`,
      to: `${c.toModuleId}:${c.toPortId}`,
      color: c.color,
      ...((c.depth ?? 1) !== 1 ? { depth: c.depth } : {}),
    }));
  }

  loadState(cables = []) {
    this.connections.clear();
    if (!Array.isArray(cables)) return;
    const connectedInputs = new Set();
    for (const c of cables) {
      if (!c.from || !c.to) continue;
      const [fromMod, fromPort] = String(c.from).split(':');
      const [toMod, toPort] = String(c.to).split(':');
      if (!fromMod || !fromPort || !toMod || !toPort) continue;

      const targetMod = this.engine.find(toMod) || this.engine.findByType?.(toMod);
      const actualToId = targetMod?.id || toMod;
      const resolvedToPort = targetMod ? resolveJackId(targetMod, toPort, 'in') : toPort;
      const inputKey = `${actualToId}:${resolvedToPort}`;

      // Wenn ein Eingang (`to`) im JSON bereits belegt ist, darf er nicht durch Folgeroutings überschrieben werden
      if (connectedInputs.has(inputKey)) {
        continue;
      }

      const conn = this.connect(fromMod, fromPort, toMod, toPort, c.color, c.depth ?? 1);
      if (conn) {
        connectedInputs.add(inputKey);
      }
    }
    this.onConnectionsChanged?.();
  }

  clear() {
    this.connections.clear();
    this.onConnectionsChanged?.();
  }
}
