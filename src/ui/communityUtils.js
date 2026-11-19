// SYNTHBOARD – Open-Source Community Utilities: Auto-Tagging & URL Share-Link (#p=...)

const MODULE_TAG_MAP = {
  drone: ['ambient', 'drone'],
  felt_piano: ['piano', 'acoustic'],
  keys: ['keys', 'melodic'],
  violin: ['strings', 'cinematic'],
  chord_glide: ['chords', 'harmonic'],
  chord_arp: ['arp', 'melodic'],
  sequencer: ['sequenced'],
  euclidean: ['polyrhythm', 'euclidean'],
  morph_voice: ['synth', 'lead'],
  reverb: ['atmospheric'],
  shimmer: ['shimmer', 'ambient'],
  delay: ['spatial'],
  chorus: ['warm'],
  random_walk: ['generative'],
  slow_random: ['generative', 'evolving'],
  noise: ['texture'],
  tape_warble: ['lofi', 'tape'],
};

function cleanTag(raw) {
  return String(raw ?? '')
    .toLowerCase()
    .replace(/^#+/, '')
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 24);
}

export function normalizeTags(raw) {
  const arr = Array.isArray(raw) ? raw : String(raw ?? '').split(',');
  const out = [];
  const seen = new Set();
  for (const item of arr) {
    const tag = cleanTag(item);
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      out.push(tag);
      if (out.length >= 6) break;
    }
  }
  return out;
}

/**
 * Analysiert ein SYNTHBOARD-Rack-State und generiert automatisch passende Genre-/Sound-Tags.
 */
export function autoTagRack(state) {
  const tags = [];
  const seen = new Set();
  const add = (t) => {
    const tag = cleanTag(t);
    if (tag && !seen.has(tag) && tags.length < 6) {
      seen.add(tag);
      tags.push(tag);
    }
  };

  const modules = Array.isArray(state?.modules) ? state.modules : [];
  for (const mod of modules) {
    const mapped = MODULE_TAG_MAP[mod?.type];
    if (mapped) mapped.forEach(add);
  }

  const clock = modules.find((m) => m?.type === 'master_clock');
  const bpm = Number(clock?.values?.tempo);
  if (Number.isFinite(bpm) && bpm > 0) {
    if (bpm < 90) add('downtempo');
    else if (bpm >= 125) add('uptempo');
    else add('electronic');
  }

  const cables = Array.isArray(state?.cables) ? state.cables : [];
  if (cables.length >= 10) add('modular');
  if (tags.length === 0) add('synthboard');
  return tags;
}

function bytesToBase64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(b64) {
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const std = b64.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(std);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Komprimiert ein Rack inkl. Metadaten in einen teilbaren URL-Hash (#p=...).
 */
export async function encodePatchToHash(payload) {
  const json = JSON.stringify(payload);
  const rawBytes = new TextEncoder().encode(json);
  if (typeof CompressionStream !== 'undefined') {
    const cs = new CompressionStream('gzip');
    const writer = cs.writable.getWriter();
    writer.write(rawBytes);
    writer.close();
    const compressed = new Uint8Array(await new Response(cs.readable).arrayBuffer());
    return `#p=gz.${bytesToBase64Url(compressed)}`;
  }
  return `#p=raw.${bytesToBase64Url(rawBytes)}`;
}

/**
 * Dekodiert ein geteiltes Rack aus window.location.hash (#p=...).
 */
export async function decodePatchFromHash(hash = '') {
  const str = String(hash || '');
  if (!str.startsWith('#p=')) return null;
  const body = str.slice(3);
  let bytes;
  if (body.startsWith('gz.') && typeof DecompressionStream !== 'undefined') {
    const compressed = base64UrlToBytes(body.slice(3));
    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    writer.write(compressed);
    writer.close();
    bytes = new Uint8Array(await new Response(ds.readable).arrayBuffer());
  } else if (body.startsWith('raw.')) {
    bytes = base64UrlToBytes(body.slice(4));
  } else {
    return null;
  }
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text);
}
