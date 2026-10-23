// Basisklassen für alle Rack-Module
// Jedes Modul beschreibt seine Regler deklarativ (static params / static options),
// damit das UI generisch gebaut und der Zustand gespeichert werden kann.

export const uid = () => Math.random().toString(36).slice(2, 10);

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const midiToName = (m) => `${NOTE_NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;

export const SCALES = {
  minorPenta: { name: 'Moll Penta', steps: [0, 3, 5, 7, 10] },
  majorPenta: { name: 'Dur Penta', steps: [0, 2, 4, 7, 9] },
  dorian: { name: 'Dorisch', steps: [0, 2, 3, 5, 7, 9, 10] },
  minor: { name: 'Moll', steps: [0, 2, 3, 5, 7, 8, 10] },
  major: { name: 'Dur', steps: [0, 2, 4, 5, 7, 9, 11] },
  hirajoshi: { name: 'Hirajoshi', steps: [0, 2, 3, 7, 8] },
};

/** Ton n-ter Stufe einer Skala (ab Grundton-MIDI) */
export function scaleNote(rootMidi, scaleKey, degree) {
  const steps = (SCALES[scaleKey] || SCALES.minorPenta).steps;
  const oct = Math.floor(degree / steps.length);
  const idx = ((degree % steps.length) + steps.length) % steps.length;
  return rootMidi + oct * 12 + steps[idx];
}

/** Weiche Sättigungskurve (tanh), normiert auf ±1 */
export function makeSaturationCurve(amount = 1, samples = 2048) {
  const curve = new Float32Array(samples);
  const k = Math.max(0.01, amount);
  const norm = Math.tanh(k);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / (samples - 1) - 1;
    curve[i] = Math.tanh(k * x) / norm;
  }
  return curve;
}

const noiseCache = new WeakMap();
/** Geteilter 2s Rauschbuffer (white + pink) pro AudioContext */
export function getNoiseBuffers(ctx) {
  if (noiseCache.has(ctx)) return noiseCache.get(ctx);
  const len = 2 * ctx.sampleRate;
  const white = ctx.createBuffer(1, len, ctx.sampleRate);
  const pink = ctx.createBuffer(1, len, ctx.sampleRate);
  const w = white.getChannelData(0);
  const p = pink.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < len; i++) {
    const r = Math.random() * 2 - 1;
    w[i] = r * 0.5;
    b0 = 0.99886 * b0 + r * 0.0555179;
    b1 = 0.99332 * b1 + r * 0.0750759;
    b2 = 0.969 * b2 + r * 0.153852;
    b3 = 0.8665 * b3 + r * 0.3104856;
    b4 = 0.55 * b4 + r * 0.5329522;
    b5 = -0.7616 * b5 - r * 0.016898;
    p[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + r * 0.5362) * 0.11;
    b6 = r * 0.115926;
  }
  const res = { white, pink };
  noiseCache.set(ctx, res);
  return res;
}

/** Deterministischer Zufallszahlengenerator (Mulberry32) */
export function createRng(seed = 12345) {
  let s = Math.floor(Math.abs(seed)) || 1;
  return function() {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/** Björklunds Euklidischer Rhythmus-Algorithmus */
export function getEuclideanPattern(steps, pulses, rotation = 0) {
  steps = Math.max(1, Math.min(32, Math.floor(steps)));
  pulses = Math.max(0, Math.min(steps, Math.floor(pulses)));
  if (pulses === 0) return new Array(steps).fill(false);
  if (pulses >= steps) return new Array(steps).fill(true);

  let pattern = [];
  let counts = [];
  let remainders = [];
  let divisor = steps - pulses;
  remainders.push(pulses);
  let level = 0;

  while (true) {
    counts.push(Math.floor(divisor / remainders[level]));
    remainders.push(divisor % remainders[level]);
    divisor = remainders[level];
    level++;
    if (remainders[level] <= 1) break;
  }
  counts.push(divisor);

  function build(lvl) {
    if (lvl === -1) pattern.push(false);
    else if (lvl === -2) pattern.push(true);
    else {
      for (let i = 0; i < counts[lvl]; i++) build(lvl - 1);
      if (remainders[lvl] !== 0) build(lvl - 2);
    }
  }
  build(level);

  const idx = pattern.indexOf(true);
  pattern = pattern.slice(idx).concat(pattern.slice(0, idx));

  const rot = ((rotation % steps) + steps) % steps;
  if (rot > 0) {
    pattern = pattern.slice(steps - rot).concat(pattern.slice(0, steps - rot));
  }
  return pattern;
}

export class ModuleBase {
  static type = 'base';
  static title = 'Modul';
  static category = 'source'; // 'control' | 'source' | 'effect'
  static color = '#888';
  static icon = '◆';
  static description = '';
  static params = [];  // [{ id, label, min, max, value, log?, fmt? }]
  static options = []; // [{ id, label, choices: [[value, label]], value }]
  static jacks = [];   // [{ id, type: 'in'|'out', signal: 'gate'|'pitch'|'mod'|'clock', label }]

  constructor(ctx, state = {}) {
    this.ctx = ctx;
    this.id = state.id || uid();
    this.values = {};
    this.enabled = state.enabled ?? true;
    this.stoppables = [];
    this.patchSystem = null; // wird von der Engine injiziert
    // "output" ist bei allen Audio-Modulen der Ausgang
    this.output = ctx.createGain();
  }

  get meta() { return this.constructor; }

  /** Nach dem Aufbau der Audio-Nodes von der Subklasse aufrufen */
  initValues(state = {}) {
    const saved = state.values || {};
    for (const p of this.meta.params) this.setParam(p.id, saved[p.id] ?? p.value);
    for (const o of this.meta.options) this.setParam(o.id, saved[o.id] ?? o.value);
    this.setEnabled(this.enabled);
  }

  setParam(id, value) {
    this.values[id] = value;
    this.applyParam(id, value);
  }

  applyParam(_id, _value) {}

  setEnabled(on) {
    this.enabled = on;
    this.ramp(this.output.gain, on ? 1 : 0, 0.04);
  }

  ramp(audioParam, value, tc = 0.03) {
    if (!Number.isFinite(value)) return;
    audioParam.setTargetAtTime(value, this.ctx.currentTime, tc);
  }

  start(node) {
    node.start();
    this.stoppables.push(node);
    return node;
  }

  // ── Modulare Patch-Event Weiterleitung ──
  emitTrigger(portId, time, velocity = 1, duration = 0.1) {
    this.patchSystem?.routeTrigger(this.id, portId, time, velocity, duration);
  }

  emitPitch(portId, time, midiNote, velocity = 1, duration = 0.1) {
    this.patchSystem?.routePitch(this.id, portId, time, midiNote, velocity, duration);
  }

  emitMod(portId, value, time) {
    this.patchSystem?.routeMod(this.id, portId, value, time);
  }

  emitClock(portId, time, tick = 0) {
    this.patchSystem?.routeClock(this.id, portId, time, tick);
  }

  receiveTrigger(portId, time, velocity = 1, duration = 0.1) {
    this.onTrigger(portId, time, velocity, duration);
  }

  receivePitch(portId, time, midiNote, velocity = 1, duration = 0.1) {
    this.onPitch(portId, time, midiNote, velocity, duration);
  }

  receiveMod(portId, value, time) {
    this.onModulation(portId, value, time);
  }

  receiveClock(portId, time, tick = 0) {
    this.onClock(portId, time, tick);
  }

  onTrigger(_portId, _time, _velocity, _duration) {}
  onPitch(_portId, _time, _midiNote, _velocity, _duration) {}
  onModulation(_portId, _value, _time) {}
  onClock(_portId, _time, _tick) {}

  getState() {
    return { type: this.meta.type, id: this.id, enabled: this.enabled, values: { ...this.values }, extra: this.getExtra() };
  }

  getExtra() { return {}; }

  /** Optionales Zusatz-UI (Pads, Steps …). helpers.changed() meldet Änderungen fürs Autosave */
  renderExtra(_container, _helpers) {}

  destroy() {
    this.stoppables.forEach((n) => { try { n.stop(); } catch { /* schon gestoppt */ } });
    try { this.output.disconnect(); } catch { /* ignore */ }
    if (this.input) try { this.input.disconnect(); } catch { /* ignore */ }
  }
}

/**
 * Effekt-Basis: input → [fxIn … Subklasse … → this.wet] → output
 * Bypass blendet zwischen wet und dry um (dry = unbearbeitet).
 */
export class EffectBase extends ModuleBase {
  static category = 'effect';

  constructor(ctx, state) {
    super(ctx, state);
    this.input = ctx.createGain();
    this.wet = ctx.createGain();
    this.dry = ctx.createGain();
    this.dry.gain.value = 0;
    this.input.connect(this.dry);
    this.dry.connect(this.output);
    this.wet.connect(this.output);
  }

  setEnabled(on) {
    this.enabled = on;
    this.ramp(this.wet.gain, on ? 1 : 0, 0.02);
    this.ramp(this.dry.gain, on ? 0 : 1, 0.02);
  }
}
