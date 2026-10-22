// Klangquellen-Module: Drone, Keys, Sequencer, Noise
import { ModuleBase, midiToFreq, midiToName, scaleNote, SCALES, getNoiseBuffers } from './base.js';

const WAVES = [['sawtooth', 'Saw'], ['triangle', 'Tri'], ['square', 'Square'], ['sine', 'Sine']];
const KEYS = [[0, 'C'], [2, 'D'], [4, 'E'], [5, 'F'], [7, 'G'], [9, 'A'], [10, 'B♭']];
const SCALE_CHOICES = Object.entries(SCALES).map(([k, s]) => [k, s.name]);
const OCTAVES = [[36, 'Okt 2'], [48, 'Okt 3'], [60, 'Okt 4']];

/** Kurz-Helfer: nach Ende eines Oszillators Nodes trennen */
function cleanupOnEnd(osc, nodes) {
  osc.onended = () => nodes.forEach((n) => { try { n.disconnect(); } catch { /* ignore */ } });
}

// ───────────────────────────────────────────── DRONE ──
const CHORDS = {
  fifths: { name: 'Quinten', iv: [0, 7, 12, 19, 24, 31] },
  minor9: { name: 'Moll 9', iv: [0, 7, 12, 15, 19, 26] },
  major: { name: 'Dur maj7', iv: [0, 7, 12, 16, 19, 23] },
  sus: { name: 'Sus', iv: [0, 5, 7, 12, 17, 19] },
  cluster: { name: 'Cluster', iv: [0, 2, 7, 12, 14, 19] },
};

export class DroneModule extends ModuleBase {
  static type = 'drone';
  static title = 'Drone Maschine';
  static color = '#ff8a3d';
  static icon = '☀';
  static description = '6 endlose Drone-Stimmen (Solar-42-Stil)';
  static params = [
    { id: 'level', label: 'Level', min: 0, max: 1, value: 0.7, fmt: 'pct' },
    { id: 'tone', label: 'Tone', min: 150, max: 8000, value: 1800, log: true, fmt: 'hz' },
    { id: 'detune', label: 'Detune', min: 0, max: 30, value: 8, fmt: 'cents' },
    { id: 'sub', label: 'Sub', min: 0, max: 1, value: 0.35, fmt: 'pct' },
    { id: 'fm', label: 'FM', min: 0, max: 1, value: 0.06, fmt: 'pct' },
    { id: 'drift', label: 'Drift', min: 0, max: 1, value: 0.5, fmt: 'pct' },
  ];
  static options = [
    { id: 'root', label: 'Grundton', choices: [[28, 'E1'], [33, 'A1'], [36, 'C2'], [38, 'D2'], [40, 'E2'], [43, 'G2'], [45, 'A2']], value: 33 },
    { id: 'chord', label: 'Akkord', choices: Object.entries(CHORDS).map(([k, c]) => [k, c.name]), value: 'fifths' },
    { id: 'wave', label: 'Welle', choices: WAVES, value: 'sawtooth' },
  ];

  constructor(ctx, state = {}) {
    super(ctx, state);
    this.voicesOn = state.extra?.voices ?? [true, true, true, false, false, false];

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.Q.value = 0.8;
    this.levelGain = ctx.createGain();
    this.filter.connect(this.levelGain);
    this.levelGain.connect(this.output);

    this.voices = [];
    for (let i = 0; i < 6; i++) {
      const v = {};
      v.osc1 = ctx.createOscillator();
      v.osc2 = ctx.createOscillator();
      v.sub = ctx.createOscillator();
      v.sub.type = 'triangle';
      v.subGain = ctx.createGain();
      v.fm = ctx.createOscillator();
      v.fmGain = ctx.createGain();
      v.fmGain.gain.value = 0;
      v.fm.connect(v.fmGain);
      v.fmGain.connect(v.osc1.frequency);
      v.fmGain.connect(v.osc2.frequency);

      v.mix = ctx.createGain();
      v.mix.gain.value = 0.5;
      v.osc1.connect(v.mix);
      v.osc2.connect(v.mix);
      v.sub.connect(v.subGain);
      v.subGain.connect(v.mix);

      // Langsame Amplituden-Drift pro Stimme → lebendiger, atmender Klang
      v.drift = ctx.createGain();
      v.drift.gain.value = 0.75;
      v.lfo = ctx.createOscillator();
      v.lfo.frequency.value = 0.03 + Math.random() * 0.12;
      v.lfoGain = ctx.createGain();
      v.lfo.connect(v.lfoGain);
      v.lfoGain.connect(v.drift.gain);
      v.mix.connect(v.drift);

      v.amp = ctx.createGain();
      v.amp.gain.value = 0;
      v.drift.connect(v.amp);
      v.amp.connect(this.filter);

      [v.osc1, v.osc2, v.sub, v.fm, v.lfo].forEach((o) => this.start(o));
      this.voices.push(v);
    }
    this.initValues(state);
    this.updateVoices();
  }

  retune() {
    const root = Number(this.values.root ?? 33);
    const iv = (CHORDS[this.values.chord] || CHORDS.fifths).iv;
    const det = this.values.detune ?? 8;
    const fm = this.values.fm ?? 0;
    this.voices.forEach((v, i) => {
      const f = midiToFreq(root + iv[i]);
      this.ramp(v.osc1.frequency, f, 0.08);
      this.ramp(v.osc2.frequency, f, 0.08);
      this.ramp(v.osc1.detune, -det * 0.5, 0.08);
      this.ramp(v.osc2.detune, det, 0.08);
      this.ramp(v.sub.frequency, f / 2, 0.08);
      this.ramp(v.fm.frequency, f * 0.5, 0.08);
      this.ramp(v.fmGain.gain, fm * f * 1.2, 0.05);
    });
  }

  noteName(i) {
    const root = Number(this.values.root ?? 33);
    const iv = (CHORDS[this.values.chord] || CHORDS.fifths).iv;
    return midiToName(root + iv[i]);
  }

  updateVoices() {
    this.voices.forEach((v, i) => this.ramp(v.amp.gain, this.voicesOn[i] ? 0.11 : 0, 0.35));
  }

  applyParam(id, val) {
    switch (id) {
      case 'level': this.ramp(this.levelGain.gain, val); break;
      case 'tone': this.ramp(this.filter.frequency, val); break;
      case 'sub': this.voices.forEach((v) => this.ramp(v.subGain.gain, val * 0.8)); break;
      case 'drift': this.voices.forEach((v) => this.ramp(v.lfoGain.gain, val * 0.3)); break;
      case 'wave': this.voices.forEach((v) => { v.osc1.type = val; v.osc2.type = val; }); break;
      default: this.retune();
    }
    if ((id === 'root' || id === 'chord') && this.refreshPads) this.refreshPads();
  }

  getExtra() { return { voices: [...this.voicesOn] }; }

  renderExtra(el, { changed }) {
    el.innerHTML = `<div class="pad-row pad-row-6">${this.voices.map((_, i) => `
      <button class="pad drone-pad" data-i="${i}" title="Stimme ${i + 1} an/aus"><span class="pad-led"></span><span class="pad-note"></span></button>`).join('')}</div>`;
    const pads = [...el.querySelectorAll('.drone-pad')];
    this.refreshPads = () => pads.forEach((p, i) => {
      p.classList.toggle('active', this.voicesOn[i]);
      p.querySelector('.pad-note').textContent = this.noteName(i);
    });
    pads.forEach((p, i) => p.addEventListener('click', () => {
      this.voicesOn[i] = !this.voicesOn[i];
      this.updateVoices();
      this.refreshPads();
      changed();
    }));
    this.refreshPads();
  }
}

// ───────────────────────────────────────────── KEYS ──
const KEYBOARD = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ö', 'ä', '#'];

export class KeysModule extends ModuleBase {
  static type = 'keys';
  static title = 'Touch Keys';
  static color = '#4dd4c6';
  static icon = '✋';
  static description = 'Spielbarer Poly-Synth (Maus, Touch oder Tastatur A–#)';
  static params = [
    { id: 'level', label: 'Level', min: 0, max: 1, value: 0.7, fmt: 'pct' },
    { id: 'cutoff', label: 'Cutoff', min: 200, max: 12000, value: 2800, log: true, fmt: 'hz' },
    { id: 'reso', label: 'Reso', min: 0.3, max: 14, value: 1.5, fmt: 'num' },
    { id: 'attack', label: 'Attack', min: 0.003, max: 2, value: 0.015, log: true, fmt: 's' },
    { id: 'release', label: 'Release', min: 0.05, max: 5, value: 1.2, log: true, fmt: 's' },
    { id: 'detune', label: 'Detune', min: 0, max: 30, value: 7, fmt: 'cents' },
  ];
  static options = [
    { id: 'wave', label: 'Welle', choices: WAVES, value: 'sawtooth' },
    { id: 'key', label: 'Tonart', choices: KEYS, value: 9 },
    { id: 'scale', label: 'Skala', choices: SCALE_CHOICES, value: 'minorPenta' },
    { id: 'octave', label: 'Oktave', choices: OCTAVES, value: 48 },
  ];

  constructor(ctx, state = {}) {
    super(ctx, state);
    this.active = new Map();
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.levelGain = ctx.createGain();
    this.filter.connect(this.levelGain);
    this.levelGain.connect(this.output);
    this.initValues(state);
  }

  applyParam(id, val) {
    if (id === 'level') this.ramp(this.levelGain.gain, val);
    else if (id === 'cutoff') this.ramp(this.filter.frequency, val);
    else if (id === 'reso') this.ramp(this.filter.Q, val);
    if (['key', 'scale', 'octave'].includes(id) && this.refreshPads) this.refreshPads();
  }

  midiFor(degree) {
    return scaleNote(Number(this.values.octave) + Number(this.values.key), this.values.scale, degree);
  }

  noteOn(degree) {
    if (this.active.has(degree)) this.noteOff(degree);
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const f = midiToFreq(this.midiFor(degree));
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.type = o2.type = this.values.wave;
    o1.frequency.value = o2.frequency.value = f;
    o1.detune.value = -this.values.detune / 2;
    o2.detune.value = this.values.detune;
    const vca = ctx.createGain();
    vca.gain.setValueAtTime(0, t);
    vca.gain.linearRampToValueAtTime(0.2, t + this.values.attack);
    vca.gain.setTargetAtTime(0.14, t + this.values.attack, 0.4);
    o1.connect(vca);
    o2.connect(vca);
    vca.connect(this.filter);
    o1.start(t);
    o2.start(t);
    cleanupOnEnd(o1, [o1, o2, vca]);
    this.active.set(degree, { o1, o2, vca });
    this.padEls?.[degree]?.classList.add('active');
  }

  noteOff(degree) {
    const v = this.active.get(degree);
    if (!v) return;
    this.active.delete(degree);
    const t = this.ctx.currentTime;
    const rel = this.values.release;
    const g = v.vca.gain;
    if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t);
    else { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); }
    g.setTargetAtTime(0, t, rel / 4);
    v.o1.stop(t + rel * 1.6 + 0.05);
    v.o2.stop(t + rel * 1.6 + 0.05);
    this.padEls?.[degree]?.classList.remove('active');
  }

  handleKey(key, down) {
    const i = KEYBOARD.indexOf(key.toLowerCase());
    if (i < 0 || !this.enabled) return false;
    if (down) { if (!this.active.has(i)) this.noteOn(i); } else this.noteOff(i);
    return true;
  }

  renderExtra(el) {
    el.innerHTML = `<div class="pad-row pad-row-12">${KEYBOARD.map((k, i) => `
      <button class="pad key-pad" data-i="${i}"><span class="pad-note"></span><span class="pad-key">${k.toUpperCase()}</span></button>`).join('')}</div>`;
    this.padEls = [...el.querySelectorAll('.key-pad')];
    this.refreshPads = () => this.padEls.forEach((p, i) => { p.querySelector('.pad-note').textContent = midiToName(this.midiFor(i)); });
    this.padEls.forEach((p, i) => {
      p.addEventListener('pointerdown', (e) => { e.preventDefault(); p.releasePointerCapture?.(e.pointerId); this.noteOn(i); });
      p.addEventListener('pointerenter', (e) => { if (e.buttons & 1) this.noteOn(i); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => p.addEventListener(ev, () => this.noteOff(i)));
    });
    this.refreshPads();
  }

  setEnabled(on) {
    super.setEnabled(on);
    if (!on) [...this.active.keys()].forEach((d) => this.noteOff(d));
  }

  destroy() {
    [...this.active.keys()].forEach((d) => this.noteOff(d));
    super.destroy();
  }
}

// ───────────────────────────────────────────── SEQUENCER ──
export class SequencerModule extends ModuleBase {
  static type = 'sequencer';
  static title = 'Step Sequencer';
  static color = '#b98cff';
  static icon = '▦';
  static description = '8-Step Melodie-Sequencer mit eigener Stimme';
  static params = [
    { id: 'tempo', label: 'Tempo', min: 40, max: 200, value: 92, fmt: 'bpm' },
    { id: 'level', label: 'Level', min: 0, max: 1, value: 0.6, fmt: 'pct' },
    { id: 'decay', label: 'Decay', min: 0.05, max: 2.5, value: 0.45, log: true, fmt: 's' },
    { id: 'cutoff', label: 'Cutoff', min: 150, max: 10000, value: 1400, log: true, fmt: 'hz' },
    { id: 'reso', label: 'Reso', min: 0.5, max: 15, value: 5, fmt: 'num' },
    { id: 'env', label: 'Env', min: 0, max: 1, value: 0.55, fmt: 'pct' },
    { id: 'chance', label: 'Chance', min: 0, max: 1, value: 1, fmt: 'pct' },
  ];
  static options = [
    { id: 'wave', label: 'Welle', choices: WAVES, value: 'sawtooth' },
    { id: 'division', label: 'Raster', choices: [[1, '1/4'], [2, '1/8'], [4, '1/16']], value: 2 },
    { id: 'key', label: 'Tonart', choices: KEYS, value: 9 },
    { id: 'scale', label: 'Skala', choices: SCALE_CHOICES, value: 'minorPenta' },
    { id: 'octave', label: 'Oktave', choices: OCTAVES, value: 48 },
  ];

  constructor(ctx, state = {}) {
    super(ctx, state);
    this.steps = state.extra?.steps?.map((s) => ({ ...s })) ?? [
      { on: true, deg: 0 }, { on: true, deg: 2 }, { on: false, deg: 4 }, { on: true, deg: 4 },
      { on: true, deg: 7 }, { on: false, deg: 5 }, { on: true, deg: 3 }, { on: true, deg: 6 },
    ];
    this.running = state.extra?.running ?? true;
    this.levelGain = ctx.createGain();
    this.levelGain.connect(this.output);
    this.initValues(state);

    this.step = 0;
    this.nextTime = ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.tick(), 25);
  }

  applyParam(id, val) {
    if (id === 'level') this.ramp(this.levelGain.gain, val);
    if (['key', 'scale', 'octave'].includes(id) && this.refreshSteps) this.refreshSteps();
  }

  tick() {
    const now = this.ctx.currentTime;
    if (this.nextTime < now - 0.2) this.nextTime = now + 0.02; // nach Pause wieder einsteigen
    const stepDur = 60 / this.values.tempo / Number(this.values.division);
    while (this.nextTime < now + 0.12) {
      if (this.running) {
        const s = this.steps[this.step];
        if (this.enabled && s.on && Math.random() <= this.values.chance) this.playNote(this.midiFor(s.deg), this.nextTime);
        const idx = this.step;
        setTimeout(() => this.showStep?.(idx), Math.max(0, (this.nextTime - now) * 1000));
        this.step = (this.step + 1) % this.steps.length;
      }
      this.nextTime += stepDur;
    }
  }

  midiFor(deg) {
    return scaleNote(Number(this.values.octave) + Number(this.values.key), this.values.scale, deg);
  }

  playNote(midi, time) {
    const ctx = this.ctx;
    const { decay, cutoff, reso, env, wave } = this.values;
    const f = midiToFreq(midi);
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.type = o2.type = wave;
    o1.frequency.value = o2.frequency.value = f;
    o2.detune.value = 9;
    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.Q.value = reso;
    flt.frequency.setValueAtTime(Math.min(16000, cutoff * (1 + env * 8)), time);
    flt.frequency.setTargetAtTime(cutoff, time, decay * 0.3);
    const vca = ctx.createGain();
    vca.gain.setValueAtTime(0, time);
    vca.gain.linearRampToValueAtTime(0.28, time + 0.004);
    vca.gain.setTargetAtTime(0, time + 0.01, decay / 3);
    o1.connect(flt);
    o2.connect(flt);
    flt.connect(vca);
    vca.connect(this.levelGain);
    const end = time + decay * 2.5 + 0.1;
    o1.start(time); o2.start(time);
    o1.stop(end); o2.stop(end);
    cleanupOnEnd(o1, [o1, o2, flt, vca]);
  }

  getExtra() { return { steps: this.steps.map((s) => ({ ...s })), running: this.running }; }

  renderExtra(el, { changed }) {
    el.innerHTML = `
      <div class="seq-transport">
        <button class="mini-btn seq-run"></button>
        <button class="mini-btn seq-dice" title="Zufällige Melodie">🎲 Würfeln</button>
      </div>
      <div class="seq-grid">${this.steps.map((_, i) => `
        <div class="seq-col" data-i="${i}">
          <span class="seq-led"></span>
          <input type="range" class="seq-slider" min="0" max="9" step="1" aria-label="Step ${i + 1} Tonhöhe">
          <span class="seq-note"></span>
          <button class="seq-toggle" aria-label="Step ${i + 1} an/aus"></button>
        </div>`).join('')}</div>`;
    const cols = [...el.querySelectorAll('.seq-col')];
    const runBtn = el.querySelector('.seq-run');
    const refreshRun = () => { runBtn.textContent = this.running ? '■ Stop' : '▶ Play'; runBtn.classList.toggle('active', this.running); };
    this.refreshSteps = () => cols.forEach((c, i) => {
      const s = this.steps[i];
      c.querySelector('.seq-slider').value = s.deg;
      c.querySelector('.seq-note').textContent = midiToName(this.midiFor(s.deg));
      c.classList.toggle('off', !s.on);
    });
    this.showStep = (idx) => cols.forEach((c, i) => c.classList.toggle('playing', i === idx));
    cols.forEach((c, i) => {
      c.querySelector('.seq-slider').addEventListener('input', (e) => { this.steps[i].deg = Number(e.target.value); this.refreshSteps(); changed(); });
      c.querySelector('.seq-toggle').addEventListener('click', () => { this.steps[i].on = !this.steps[i].on; this.refreshSteps(); changed(); });
    });
    runBtn.addEventListener('click', () => { this.running = !this.running; refreshRun(); changed(); });
    el.querySelector('.seq-dice').addEventListener('click', () => {
      this.steps = this.steps.map(() => ({ on: Math.random() > 0.25, deg: Math.floor(Math.random() * 10) }));
      this.refreshSteps();
      changed();
    });
    refreshRun();
    this.refreshSteps();
  }

  destroy() {
    clearInterval(this.timer);
    this.showStep = null;
    super.destroy();
  }
}

// ───────────────────────────────────────────── NOISE ──
function makeCrackleBuffer(ctx) {
  const len = 4 * ctx.sampleRate;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    if (Math.random() < 0.00035) {
      const amp = (Math.random() * 0.8 + 0.2) * (Math.random() > 0.5 ? 1 : -1);
      const n = 20 + Math.floor(Math.random() * 60);
      for (let j = 0; j < n && i + j < len; j++) d[i + j] += amp * Math.exp(-j / (n / 5)) * (Math.random() * 0.6 + 0.4);
    }
  }
  return buf;
}

export class NoiseModule extends ModuleBase {
  static type = 'noise';
  static title = 'Noise Textur';
  static color = '#8fb8ff';
  static icon = '≋';
  static description = 'Rauschen, Wind & Vinyl-Knistern';
  static params = [
    { id: 'level', label: 'Level', min: 0, max: 1, value: 0.3, fmt: 'pct' },
    { id: 'tone', label: 'Tone', min: 100, max: 14000, value: 1600, log: true, fmt: 'hz' },
    { id: 'reso', label: 'Reso', min: 0.5, max: 12, value: 1.5, fmt: 'num' },
    { id: 'motion', label: 'Wind', min: 0, max: 1, value: 0.5, fmt: 'pct' },
    { id: 'rate', label: 'Speed', min: 0.02, max: 3, value: 0.12, log: true, fmt: 'hz' },
    { id: 'crackle', label: 'Vinyl', min: 0, max: 1, value: 0.25, fmt: 'pct' },
  ];
  static options = [
    { id: 'color', label: 'Farbe', choices: [['pink', 'Pink'], ['white', 'Weiß']], value: 'pink' },
    { id: 'ftype', label: 'Filter', choices: [['lowpass', 'Lowpass'], ['bandpass', 'Bandpass'], ['highpass', 'Highpass']], value: 'bandpass' },
  ];

  constructor(ctx, state = {}) {
    super(ctx, state);
    this.filter = ctx.createBiquadFilter();
    this.levelGain = ctx.createGain();
    this.noiseAmp = ctx.createGain();
    this.noiseAmp.gain.value = 0.7;
    this.filter.connect(this.noiseAmp);
    this.noiseAmp.connect(this.levelGain);
    this.levelGain.connect(this.output);

    this.lfo = ctx.createOscillator();
    this.lfoGain = ctx.createGain();
    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.filter.detune);
    this.start(this.lfo);

    const crackle = ctx.createBufferSource();
    crackle.buffer = makeCrackleBuffer(ctx);
    crackle.loop = true;
    this.crackleGain = ctx.createGain();
    crackle.connect(this.crackleGain);
    this.crackleGain.connect(this.levelGain);
    this.start(crackle);

    this.src = null;
    this.initValues(state);
  }

  setColor(color) {
    const old = this.src;
    const src = this.ctx.createBufferSource();
    src.buffer = getNoiseBuffers(this.ctx)[color] || getNoiseBuffers(this.ctx).pink;
    src.loop = true;
    src.loopStart = Math.random();
    src.connect(this.filter);
    src.start();
    this.src = src;
    this.stoppables.push(src);
    if (old) { try { old.stop(); old.disconnect(); } catch { /* ignore */ } this.stoppables = this.stoppables.filter((s) => s !== old); }
  }

  applyParam(id, val) {
    switch (id) {
      case 'level': this.ramp(this.levelGain.gain, val); break;
      case 'tone': this.ramp(this.filter.frequency, val); break;
      case 'reso': this.ramp(this.filter.Q, val); break;
      case 'motion': this.ramp(this.lfoGain.gain, val * 2400); break;
      case 'rate': this.ramp(this.lfo.frequency, val); break;
      case 'crackle': this.ramp(this.crackleGain.gain, val * 0.6); break;
      case 'color': this.setColor(val); break;
      case 'ftype': this.filter.type = val; break;
    }
  }
}
