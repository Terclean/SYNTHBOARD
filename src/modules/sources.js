import { ModuleBase, SourceBase, midiToFreq, midiToName, scaleNote, SCALES, getNoiseBuffers } from './base.js';

const WAVES = [['sawtooth', 'Saw'], ['triangle', 'Tri'], ['square', 'Square'], ['sine', 'Sine']];
const KEYS = [[0, 'C'], [1, 'C#'], [2, 'D'], [3, 'D#'], [4, 'E'], [5, 'F'], [6, 'F#'], [7, 'G'], [8, 'G#'], [9, 'A'], [10, 'B♭'], [11, 'B']];
const SCALE_CHOICES = Object.entries(SCALES).map(([k, s]) => [k, s.name]);
const OCTAVES = [[36, 'Okt 2'], [48, 'Okt 3'], [60, 'Okt 4']];

/** Kurz-Helfer: nach Ende eines Oszillators Nodes trennen */
function cleanupOnEnd(osc, nodes) {
  osc.onended = () => nodes.forEach((n) => { try { n.disconnect(); } catch { /* ignore */ } });
}

// ───────────────────────────────────────────── DRONE ──
const CHORDS = {
  fifths: { name: 'Quinten', iv: [0, 7, 12, 19, 24, 31] },
  octaves: { name: 'Oktaven', iv: [0, 12, 24, 36, 12, 24] },
  minor9: { name: 'Moll 9', iv: [0, 7, 12, 15, 19, 26] },
  major: { name: 'Dur maj7', iv: [0, 7, 12, 16, 19, 23] },
  sus: { name: 'Sus', iv: [0, 5, 7, 12, 17, 19] },
  cluster: { name: 'Cluster', iv: [0, 2, 7, 12, 14, 19] },
};

export class DroneModule extends SourceBase {
  static type = 'drone';
  static title = 'Drone Maschine';
  static color = '#ff8a3d';
  static icon = '☀';
  static description = '6 endlose Drone-Stimmen (Solar-42-Stil)';
  static params = [
    { id: 'level', label: 'Level', min: 0, max: 1, value: 0.7, fmt: 'pct' },
    { id: 'tone', label: 'Tone', min: 150, max: 8000, value: 1500, log: true, fmt: 'hz' },
    { id: 'detune', label: 'Detune', min: 0, max: 30, value: 8, fmt: 'cents' },
    { id: 'sub', label: 'Sub', min: 0, max: 1, value: 0.35, fmt: 'pct' },
    { id: 'fm', label: 'FM', min: 0, max: 1, value: 0.06, fmt: 'pct' },
    { id: 'drift', label: 'Drift', min: 0, max: 1, value: 0.5, fmt: 'pct' },
    { id: 'root', label: 'Grundton', min: 24, max: 48, value: 33, fmt: 'int' },
  ];
  static options = [
    { id: 'chord', label: 'Akkord', choices: Object.entries(CHORDS).map(([k, c]) => [k, c.name]), value: 'fifths' },
    { id: 'wave', label: 'Welle', choices: WAVES, value: 'sawtooth' },
    { id: 'scaleLock', label: 'Tonart-Sync', choices: [[1, 'Adaptiv (bei Pitch-In)'], [0, 'Fest']], value: 1 },
    { id: 'key', label: 'Tonart', choices: KEYS, value: 5 },
    { id: 'scale', label: 'Skala', choices: SCALE_CHOICES, value: 'major' },
  ];
  static jacks = [
    { id: 'pitchIn', type: 'in', signal: 'pitch', label: 'ROOT PITCH' },
    { id: 'vcaCv', type: 'in', signal: 'mod', label: 'VCA CV' },
    { id: 'panCv', type: 'in', signal: 'mod', label: 'PAN CV' },
    { id: 'cvFm', type: 'in', signal: 'mod', label: 'FM CV' },
    { id: 'cvTone', type: 'in', signal: 'mod', label: 'TONE CV' },
  ];

  constructor(ctx, state = {}) {
    super(ctx, state);
    this.extRootMidi = null;
    this.voicesOn = state.extra?.voices ?? [true, true, true, false, false, false];

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.Q.value = 0.8;
    this.levelGain = ctx.createGain();
    this.transportGate = ctx.createGain();
    this.transportGate.gain.value = 1.0;
    this.filter.connect(this.levelGain);
    this.levelGain.connect(this.transportGate);
    this.transportGate.connect(this.output);

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

      v.warmLp = ctx.createBiquadFilter();
      v.warmLp.type = 'lowpass';
      v.warmLp.frequency.value = 6500;
      v.warmLp.Q.value = 0.5;

      // Langsame Amplituden-Drift pro Stimme → lebendiger, atmender Klang
      v.drift = ctx.createGain();
      v.drift.gain.value = 0.75;
      v.lfo = ctx.createOscillator();
      v.lfo.frequency.value = 0.03 + Math.random() * 0.12;
      v.lfoGain = ctx.createGain();
      v.lfo.connect(v.lfoGain);
      v.lfoGain.connect(v.drift.gain);
      v.mix.connect(v.warmLp);
      v.warmLp.connect(v.drift);

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

  activeRoot() {
    if (Number.isFinite(this.extRootMidi) && this.patchSystem?.hasIncoming(this.id, 'pitchIn')) {
      return Math.max(12, Math.min(72, this.extRootMidi));
    }
    return Number(this.values.root ?? 33);
  }

  onPitch(portId, _time, midiNote) {
    if (portId !== 'pitchIn') return;
    const note = Array.isArray(midiNote) ? midiNote[0] : midiNote;
    if (Number.isFinite(note)) {
      this.extRootMidi = note;
      this.retune();
      this.refreshPads?.();
    }
  }

  activeIntervals(root) {
    const baseIv = (CHORDS[this.values.chord] || CHORDS.fifths).iv;
    if (!this.patchSystem?.hasIncoming(this.id, 'pitchIn') || Number(this.values.scaleLock ?? 1) === 0) {
      return baseIv;
    }
    const scaleSteps = (SCALES[this.values.scale || 'major'] || SCALES.major).steps;
    const key = Number(this.values.key ?? 5);
    const inScale = (midi) => scaleSteps.includes((((midi - key) % 12) + 12) % 12);
    if (this.values.chord === 'major' && !inScale(root + 4) && inScale(root + 3)) {
      return [0, 7, 12, 15, 19, 22]; // Moll 7 passend zur Tonart
    }
    if (this.values.chord === 'minor9' && !inScale(root + 3) && inScale(root + 4)) {
      return [0, 7, 12, 16, 19, 26]; // Dur 9 passend zur Tonart
    }
    return baseIv;
  }

  retune() {
    const root = this.activeRoot();
    const iv = this.activeIntervals(root);
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
    const root = this.activeRoot();
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

  onModulation(portId, val, time) {
    if (this.handleSourceModulation(portId, val)) return;
    const t = time || this.ctx.currentTime;
    if (portId === 'cvFm') {
      const root = Number(this.values.root ?? 33);
      const iv = (CHORDS[this.values.chord] || CHORDS.fifths).iv;
      this.voices.forEach((v, i) => {
        const f = midiToFreq(root + iv[i]);
        v.fmGain.gain.setTargetAtTime(val * f * 1.5, t, 0.05);
      });
    } else if (portId === 'cvTone') {
      const targetTone = Math.max(100, Math.min(12000, (this.values.tone || 1800) * (0.3 + val * 2)));
      this.filter.frequency.setTargetAtTime(targetTone, t, 0.04);
    }
  }

  allNotesOff(time = null) {
    const t = Math.max(time || this.ctx.currentTime, this.ctx.currentTime);
    this.transportGate.gain.setTargetAtTime(0, t, 0.18);
  }

  onTransportPlay(time = null) {
    const t = Math.max(time || this.ctx.currentTime, this.ctx.currentTime);
    this.transportGate.gain.setTargetAtTime(1.0, t, 0.25);
  }

  getExtra() { return { voices: [...this.voicesOn] }; }
  setExtra(extra) {
    if (Array.isArray(extra?.voices)) {
      this.voicesOn = [...extra.voices];
      this.updateVoices();
      if (this.refreshPads) this.refreshPads();
    }
  }

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

  destroy() {
    this.voices.forEach((v) => {
      try {
        [v.osc1, v.osc2, v.sub, v.fm, v.lfo].forEach((o) => { o.stop(); o.disconnect(); });
        [v.subGain, v.fmGain, v.mix, v.drift, v.lfoGain, v.amp].forEach((g) => g.disconnect());
      } catch { /* ignore */ }
    });
    this.voices = [];
    try { this.filter.disconnect(); this.levelGain.disconnect(); this.transportGate.disconnect(); } catch { /* ignore */ }
    super.destroy();
  }
}

// ───────────────────────────────────────────── KEYS ──
const KEYBOARD = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ö', 'ä', '#'];

export class KeysModule extends SourceBase {
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
    { id: 'glide', label: 'Glide', min: 0, max: 5, value: 0, log: true, fmt: 's' },
  ];
  static options = [
    { id: 'polyphony', label: 'Polyphonie', choices: [['poly', 'Poly'], ['mono', 'Mono'], ['legato', 'Legato']], value: 'poly' },
    { id: 'wave', label: 'Welle', choices: WAVES, value: 'sawtooth' },
    { id: 'key', label: 'Tonart', choices: KEYS, value: 9 },
    { id: 'scale', label: 'Skala', choices: SCALE_CHOICES, value: 'minorPenta' },
    { id: 'octave', label: 'Oktave', choices: OCTAVES, value: 48 },
  ];
  static jacks = [
    { id: 'gateIn', type: 'in', signal: 'gate', label: 'GATE IN' },
    { id: 'pitchIn', type: 'in', signal: 'pitch', label: 'PITCH IN' },
    { id: 'glideCv', type: 'in', signal: 'mod', label: 'GLIDE CV' },
    { id: 'vcaCv', type: 'in', signal: 'mod', label: 'VCA CV' },
    { id: 'panCv', type: 'in', signal: 'mod', label: 'PAN CV' },
    { id: 'gateOut', type: 'out', signal: 'gate', label: 'GATE OUT' },
    { id: 'pitchOut', type: 'out', signal: 'pitch', label: 'PITCH OUT' },
  ];

  constructor(ctx, state = {}) {
    super(ctx, state);
    this.active = new Map();
    this.monoVoice = null;
    this.glideModScale = 1.0;
    this.extMidi = 57;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.levelGain = ctx.createGain();
    this.filter.connect(this.levelGain);
    this.levelGain.connect(this.output);
    this.initValues(state);
  }

  onPitch(portId, time, midiNote) {
    if (portId !== 'pitchIn') return;
    const note = Array.isArray(midiNote) ? midiNote[0] : midiNote;
    this.extMidi = note;
    if (this.monoVoice && !this.monoVoice.released && (this.values.polyphony === 'mono' || this.values.polyphony === 'legato')) {
      const t = Math.max(time || this.ctx.currentTime, this.ctx.currentTime);
      const glideSec = Math.max(0, (this.values.glide || 0) * this.glideModScale);
      const tau = Math.max(0.003, glideSec / 3);
      const f = midiToFreq(note);
      this.monoVoice.o1.frequency.setTargetAtTime(f, t, tau);
      this.monoVoice.o2.frequency.setTargetAtTime(f, t, tau);
    }
  }

  onModulation(portId, val) {
    if (portId === 'vcaCv') {
      this.vcaMod = Math.max(0, Math.min(1.5, val));
      if ((this.values.level ?? 0.7) <= 0.01 && this.patchSystem?.hasIncoming(this.id, 'vcaCv')) {
        this.ramp(this.levelGain.gain, Math.min(1, this.vcaMod), 0.02);
      } else {
        this.updateChannelStrip();
      }
      return;
    }
    if (this.handleSourceModulation(portId, val)) return;
    if (portId === 'glideCv') this.glideModScale = Math.max(0.05, val * 2);
  }

  onTrigger(portId, time, velocity = 1, duration = 0.3) {
    if (portId === 'gateIn' && this.enabled) {
      this.playExtNote(this.extMidi, time, velocity, duration);
    }
  }

  playExtNote(midi, time, velocity = 1, duration = 0.3) {
    if (Array.isArray(midi)) {
      if (this.values.polyphony === 'mono' || this.values.polyphony === 'legato') {
        this.playMonoExtNote(midi[0], time, velocity, duration);
        return;
      }
      midi.slice(0, 6).forEach((m, idx) => {
        this.playExtSingleNote(m, time + (idx * 0.008), velocity, duration);
      });
      return;
    }
    if (this.values.polyphony === 'mono' || this.values.polyphony === 'legato') {
      this.playMonoExtNote(midi, time, velocity, duration);
      return;
    }
    this.playExtSingleNote(midi, time, velocity, duration);
  }

  playMonoExtNote(midi, time, velocity = 1, duration = 0.3) {
    const ctx = this.ctx;
    const t = Math.max(time, ctx.currentTime);
    const f = midiToFreq(midi);
    const glideSec = Math.max(0, (this.values.glide || 0) * this.glideModScale);
    const tau = Math.max(0.003, glideSec / 3);
    const isLegato = this.values.polyphony === 'legato';

    if (this.monoVoice && !this.monoVoice.released) {
      clearTimeout(this.monoVoice.relTimer);
      this.monoVoice.o1.frequency.setTargetAtTime(f, t, tau);
      this.monoVoice.o2.frequency.setTargetAtTime(f, t, tau);
      if (!isLegato) {
        this.monoVoice.vca.gain.cancelScheduledValues(t);
        this.monoVoice.vca.gain.setTargetAtTime(0.22 * velocity, t, Math.max(0.004, (this.values.attack || 0.015) / 2));
      }
    } else {
      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      o1.type = o2.type = this.values.wave;
      o1.frequency.setValueAtTime(f, t);
      o2.frequency.setValueAtTime(f, t);
      o1.detune.value = -this.values.detune / 2;
      o2.detune.value = this.values.detune;
      const vca = ctx.createGain();
      vca.gain.setValueAtTime(0, t);
      vca.gain.linearRampToValueAtTime(0.22 * velocity, t + Math.max(0.003, this.values.attack));
      o1.connect(vca); o2.connect(vca);
      vca.connect(this.filter);
      o1.start(t); o2.start(t);
      cleanupOnEnd(o1, [o1, o2, vca]);
      this.monoVoice = { o1, o2, vca, released: false, relTimer: null };
    }

    const mv = this.monoVoice;
    const relDelayMs = Math.max(10, (t + duration - ctx.currentTime) * 1000);
    mv.relTimer = setTimeout(() => {
      if (this.monoVoice !== mv) return;
      mv.released = true;
      const now = ctx.currentTime;
      const rel = Math.max(0.05, this.values.release || 1.2);
      try {
        mv.vca.gain.cancelScheduledValues(now);
        mv.vca.gain.setTargetAtTime(0, now, rel / 4);
        mv.o1.stop(now + rel * 1.5 + 0.05);
        mv.o2.stop(now + rel * 1.5 + 0.05);
      } catch { /* ignore */ }
      this.monoVoice = null;
    }, relDelayMs);
  }

  playExtSingleNote(midi, time, velocity = 1, duration = 0.3) {
    const ctx = this.ctx;
    const f = midiToFreq(midi);
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.type = o2.type = this.values.wave;
    o1.frequency.setValueAtTime(f, time);
    o2.frequency.setValueAtTime(f, time);
    o1.detune.value = -this.values.detune / 2;
    o2.detune.value = this.values.detune;
    const vca = ctx.createGain();
    vca.gain.setValueAtTime(0, time);
    vca.gain.linearRampToValueAtTime(0.22 * velocity, time + this.values.attack);
    vca.gain.exponentialRampToValueAtTime(0.0001, time + duration + this.values.release);
    o1.connect(vca); o2.connect(vca);
    vca.connect(this.filter);
    const end = time + duration + this.values.release + 0.05;
    o1.start(time); o2.start(time);
    o1.stop(end); o2.stop(end);
    cleanupOnEnd(o1, [o1, o2, vca]);
  }

  applyParam(id, val) {
    if (id === 'level') {
      if (val <= 0.01 && this.patchSystem?.hasIncoming(this.id, 'vcaCv')) {
        this.ramp(this.levelGain.gain, Math.min(1, this.vcaMod ?? 0), 0.02);
      } else {
        this.ramp(this.levelGain.gain, val);
      }
    }
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
    const midi = this.midiFor(degree);
    this.emitPitch('pitchOut', t, midi, 0.9, this.values.release);
    this.emitTrigger('gateOut', t, 0.9, this.values.release);
    const f = midiToFreq(midi);
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
    if (!on) {
      [...this.active.keys()].forEach((d) => this.noteOff(d));
      this.stopMonoVoice();
    }
  }

  stopMonoVoice() {
    const mv = this.monoVoice;
    if (!mv) return;
    clearTimeout(mv.relTimer);
    this.monoVoice = null;
    const now = this.ctx.currentTime;
    try {
      mv.vca.gain.cancelScheduledValues(now);
      mv.vca.gain.setTargetAtTime(0, now, 0.02);
      mv.o1.stop(now + 0.1);
      mv.o2.stop(now + 0.1);
    } catch { /* ignore */ }
  }

  destroy() {
    [...this.active.keys()].forEach((d) => this.noteOff(d));
    this.stopMonoVoice();
    super.destroy();
  }
}

// ───────────────────────────────────────────── SEQUENCER ──
export class SequencerModule extends SourceBase {
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
    { id: 'glide', label: 'Glide', min: 0, max: 2.5, value: 0, log: true, fmt: 's' },
    ...[0, 2, 4, 7, 9, 7, 4, 2].map((def, i) => ({ id: `s${i + 1}`, label: `Step ${i + 1}`, min: -12, max: 24, value: def, fmt: 'int', hiddenUi: true })),
    ...Array.from({ length: 8 }, (_, i) => ({ id: `g${i + 1}`, label: `Gate ${i + 1}`, min: 0, max: 2, value: 1, fmt: 'int', hiddenUi: true })),
  ];
  static options = [
    { id: 'wave', label: 'Welle', choices: WAVES, value: 'sawtooth' },
    { id: 'division', label: 'Raster', choices: [[1, '1/4'], [2, '1/8'], [4, '1/16']], value: 2 },
    { id: 'key', label: 'Tonart', choices: KEYS, value: 9 },
    { id: 'scale', label: 'Skala', choices: SCALE_CHOICES, value: 'minorPenta' },
    { id: 'octave', label: 'Oktave', choices: OCTAVES, value: 48 },
  ];
  static jacks = [
    { id: 'clockIn', type: 'in', signal: 'clock', label: 'CLOCK IN' },
    { id: 'vcaCv', type: 'in', signal: 'mod', label: 'VCA CV' },
    { id: 'panCv', type: 'in', signal: 'mod', label: 'PAN CV' },
    { id: 'gateOut', type: 'out', signal: 'gate', label: 'GATE OUT' },
    { id: 'pitchOut', type: 'out', signal: 'pitch', label: 'PITCH OUT' },
  ];

  constructor(ctx, state = {}) {
    super(ctx, state);
    const defaultDegs = [0, 2, 4, 7, 9, 7, 4, 2];
    const v = state.values || {};
    if (Array.isArray(state.extra?.steps) && state.extra.steps.length === 8) {
      this.steps = state.extra.steps.map((s) => ({ on: s.on !== false, deg: Number(s.deg ?? 0), gate: s.gate ?? (s.on === false ? 0 : 1) }));
    } else {
      this.steps = defaultDegs.map((def, i) => {
        const deg = Array.isArray(v.steps) && v.steps[i] !== undefined ? Number(v.steps[i]) : Number(v[`s${i + 1}`] ?? def);
        const gate = Array.isArray(v.gates) && v.gates[i] !== undefined ? Number(v.gates[i]) : Number(v[`g${i + 1}`] ?? 1);
        return { on: gate > 0, deg, gate };
      });
    }
    this.running = state.extra?.running ?? true;
    this.lastPitchMidi = null;
    this.slewTimer = null;
    this.levelGain = ctx.createGain();
    this.levelGain.connect(this.output);
    this.initValues({
      ...state,
      values: {
        ...v,
        ...Object.fromEntries(this.steps.map((s, i) => [`s${i + 1}`, s.deg])),
        ...Object.fromEntries(this.steps.map((s, i) => [`g${i + 1}`, s.gate ?? (s.on ? 1 : 0)])),
      },
    });

    this.step = 0;
    this.nextTime = ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.tick(), 25);
  }

  applyParam(id, val) {
    if (id === 'level') this.ramp(this.levelGain.gain, val);
    else if (/^s([1-8])$/.test(id)) {
      const idx = Number(id.slice(1)) - 1;
      if (this.steps?.[idx]) this.steps[idx].deg = Math.round(Number(val));
      this.refreshSteps?.();
    } else if (/^g([1-8])$/.test(id)) {
      const idx = Number(id.slice(1)) - 1;
      const g = Math.max(0, Math.min(2, Math.round(Number(val))));
      if (this.steps?.[idx]) {
        this.steps[idx].gate = g;
        this.steps[idx].on = g > 0;
      }
      this.refreshSteps?.();
    }
    if (['key', 'scale', 'octave'].includes(id) && this.refreshSteps) this.refreshSteps();
  }

  onClock(portId, time) {
    if (portId === 'clockIn' && this.enabled && this.running) {
      this.triggerStep(time);
    }
  }

  onModulation(portId, val) {
    if (this.handleSourceModulation(portId, val)) return;
  }

  emitSlewedPitch(time, targetMidi, velocity, duration) {
    const glide = Math.max(0, Number(this.values.glide || 0));
    if (glide <= 0.005 || this.lastPitchMidi === null || Math.abs(targetMidi - this.lastPitchMidi) < 0.01) {
      this.lastPitchMidi = targetMidi;
      this.emitPitch('pitchOut', time, targetMidi, velocity, duration);
      return;
    }
    const startMidi = this.lastPitchMidi;
    const startAt = Math.max(time, this.ctx.currentTime);
    const stepsCount = Math.max(2, Math.min(40, Math.round(glide / 0.025)));
    clearInterval(this.slewTimer);
    let stepIdx = 0;
    this.slewTimer = setInterval(() => {
      stepIdx++;
      const p = Math.min(1, stepIdx / stepsCount);
      const cur = startMidi + (targetMidi - startMidi) * p;
      this.lastPitchMidi = cur;
      this.emitPitch('pitchOut', this.ctx.currentTime, cur, velocity, duration);
      if (p >= 1) clearInterval(this.slewTimer);
    }, Math.max(15, (glide * 1000) / stepsCount));
    this.emitPitch('pitchOut', startAt, startMidi, velocity, duration);
  }

  triggerStep(time) {
    const s = this.steps[this.step];
    const gateMode = s ? (s.gate !== undefined ? s.gate : (s.on ? 1 : 0)) : 0;
    if (s && gateMode > 0 && Math.random() <= this.values.chance) {
      const midi = this.midiFor(s.deg);
      const stepDur = 60 / (this.values.tempo || 92) / Number(this.values.division || 2);
      const dur = gateMode === 2 ? Math.max(this.values.decay, stepDur * 1.25) : this.values.decay;
      if (this.values.level > 0.01) this.playNote(midi, time);
      this.emitSlewedPitch(time, midi, 0.9, dur);
      this.emitTrigger('gateOut', time, 0.9, dur);
    }
    const idx = this.step;
    const delayMs = Math.max(0, (time - this.ctx.currentTime) * 1000);
    setTimeout(() => this.showStep?.(idx), delayMs);
    this.step = (this.step + 1) % this.steps.length;
  }

  tick() {
    // Wenn eine externe Master Clock eingesteckt ist, steuert diese den Sequencer
    if (this.patchSystem?.hasIncoming(this.id, 'clockIn')) return;

    const now = this.ctx.currentTime;
    if (this.nextTime < now - 0.2) this.nextTime = now + 0.02; // nach Pause wieder einsteigen
    const stepDur = 60 / this.values.tempo / Number(this.values.division);
    while (this.nextTime < now + 0.12) {
      if (this.running) {
        this.triggerStep(this.nextTime);
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
          <input type="range" class="seq-slider" min="-12" max="24" step="1" aria-label="Step ${i + 1} Tonhöhe">
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
      c.querySelector('.seq-slider').addEventListener('input', (e) => {
        const deg = Number(e.target.value);
        this.steps[i].deg = deg;
        this.values[`s${i + 1}`] = deg;
        this.refreshSteps();
        changed();
      });
      c.querySelector('.seq-toggle').addEventListener('click', () => {
        this.steps[i].on = !this.steps[i].on;
        this.steps[i].gate = this.steps[i].on ? 1 : 0;
        this.values[`g${i + 1}`] = this.steps[i].gate;
        this.refreshSteps();
        changed();
      });
    });
    runBtn.addEventListener('click', () => { this.running = !this.running; refreshRun(); changed(); });
    el.querySelector('.seq-dice').addEventListener('click', () => {
      this.steps = this.steps.map((_, i) => {
        const on = Math.random() > 0.25;
        const deg = Math.floor(Math.random() * 10);
        this.values[`s${i + 1}`] = deg;
        this.values[`g${i + 1}`] = on ? 1 : 0;
        return { on, deg, gate: on ? 1 : 0 };
      });
      this.refreshSteps();
      changed();
    });
    refreshRun();
    this.refreshSteps();
  }

  destroy() {
    clearInterval(this.timer);
    clearInterval(this.slewTimer);
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

export class NoiseModule extends SourceBase {
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
    { id: 'color', label: 'Farbe', choices: [['pink', 'Pink'], ['white', 'Weiß'], ['red', 'Rot (Brown)'], ['tape', 'Tonband (Tape)']], value: 'pink' },
    { id: 'ftype', label: 'Filter', choices: [['lowpass', 'Lowpass'], ['bandpass', 'Bandpass'], ['highpass', 'Highpass']], value: 'bandpass' },
  ];
  static jacks = [
    { id: 'vcaCv', type: 'in', signal: 'mod', label: 'VCA CV' },
    { id: 'panCv', type: 'in', signal: 'mod', label: 'PAN CV' },
    { id: 'cvTone', type: 'in', signal: 'mod', label: 'TONE CV' },
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

  initValues(state = {}) {
    const saved = { ...(state.values || {}) };
    if (saved.mode !== undefined && saved.ftype === undefined) {
      saved.ftype = saved.mode;
    }
    if (saved.type !== undefined && saved.color === undefined) {
      saved.color = saved.type;
    }
    if (typeof saved.color === 'string') saved.color = saved.color.trim().toLowerCase();
    if (typeof saved.ftype === 'string') saved.ftype = saved.ftype.trim().toLowerCase();
    super.initValues({ ...state, values: saved });
  }

  setParam(id, value) {
    if (id === 'mode') id = 'ftype';
    else if (id === 'type') id = 'color';
    if ((id === 'color' || id === 'ftype') && typeof value === 'string') {
      value = value.trim().toLowerCase();
    }
    super.setParam(id, value);
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

  onModulation(portId, val, time) {
    if (this.handleSourceModulation(portId, val)) return;
    if (portId === 'cvTone') {
      const base = this.values.tone || 1600;
      this.filter.frequency.setTargetAtTime(Math.max(40, Math.min(14000, base * (0.2 + val * 2))), time || this.ctx.currentTime, 0.04);
    }
  }

  destroy() {
    try { this.src?.stop(); } catch { /* ignore */ }
    super.destroy();
  }
}
