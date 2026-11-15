// SYNTHBOARD – Neue vielseitige Instrumente
// Morph Voice · Hybrid Percussion · Resonator Garden · Spectral Swarm
import { midiToFreq, midiToName, getNoiseBuffers, createRng } from './base.js';
import { VoiceBase, COMMON_PARAMS, MUTATE_JACK, clamp, lerp, smoothstep, getShaperCurve, cleanupOnEnd } from './shared.js';

const noteUi = (el, mod, label, testLabel, onTest) => {
  el.innerHTML = `
    <div class="voice-preview">
      <div class="v-note">${label(mod)}</div>
      <button class="mini-btn btn-trig">${testLabel}</button>
    </div>`;
  const noteEl = el.querySelector('.v-note');
  mod.updateNoteUi = () => { noteEl.textContent = label(mod); };
  mod.flashUi = () => {
    noteEl.classList.add('flash');
    setTimeout(() => noteEl.classList.remove('flash'), 120);
  };
  el.querySelector('.btn-trig').addEventListener('click', () => { onTest(); mod.flashUi(); });
};

// ═════════════════════════════════════════════ 1. MORPH VOICE ══
const TABLE_NAMES = ['Warm', 'Soft', 'Saw', 'Square', 'Pulse', 'Vokal', 'Metall', 'Digital'];
const tableCache = new WeakMap();

/** Acht Wellenformen, zwischen denen die Morph-Position fließend überblendet */
function getTables(ctx) {
  if (tableCache.has(ctx)) return tableCache.get(ctx);
  const N = 48;
  const rng = createRng(77);
  const defs = [
    (h) => 1 / Math.pow(h, 2.2),
    (h) => (h % 2 ? 1 / (h * h) : 0),
    (h) => 1 / h,
    (h) => (h % 2 ? 1 / h : 0),
    (h) => Math.abs(Math.sin(Math.PI * h * 0.12)) / h,
    (h) => (1 / Math.pow(h, 0.8)) * (Math.exp(-(((h - 4.5) / 1.6) ** 2)) + 0.7 * Math.exp(-(((h - 10) / 2) ** 2)) + 0.06),
    (h) => ([3, 5, 8, 13, 21, 34].includes(h) ? 0.8 / Math.pow(h, 0.4) : 0.45 / h),
  ];
  const tables = defs.map((fn) => {
    const real = new Float32Array(N + 1);
    const imag = new Float32Array(N + 1);
    for (let h = 1; h <= N; h++) imag[h] = fn(h);
    return ctx.createPeriodicWave(real, imag);
  });
  // Digital: zufällige, aber feste Obertonstruktur
  const real = new Float32Array(N + 1);
  const imag = new Float32Array(N + 1);
  for (let h = 1; h <= N; h++) {
    const a = Math.pow(rng(), 2) / Math.pow(h, 0.4);
    const ph = rng() * Math.PI * 2;
    real[h] = a * Math.cos(ph);
    imag[h] = a * Math.sin(ph);
  }
  tables.push(ctx.createPeriodicWave(real, imag));
  tableCache.set(ctx, tables);
  return tables;
}

const VOWELS = [[800, 1150], [400, 1600], [350, 2700], [450, 800], [325, 700]];
function vowelAt(x) {
  const p = clamp(x) * (VOWELS.length - 1);
  const i = Math.min(VOWELS.length - 2, Math.floor(p));
  const f = p - i;
  return [lerp(VOWELS[i][0], VOWELS[i + 1][0], f), lerp(VOWELS[i][1], VOWELS[i + 1][1], f)];
}

export class MorphVoiceModule extends VoiceBase {
  static type = 'morph_voice';
  static title = 'Morph Voice';
  static category = 'source';
  static color = '#c084fc';
  static icon = '🌀';
  static description = 'Vielseitige Stimme: Analog, Wavetable, FM & Rauschen – von dunklen Flächen bis zu Zupfklängen';
  static params = [
    { id: 'level', label: 'Level', min: 0, max: 1, value: 0.7, fmt: 'pct' },
    { id: 'morph', label: 'Morph', min: 0, max: 1, value: 0.3, fmt: 'pct' },
    { id: 'bright', label: 'Helligkeit', min: 120, max: 16000, value: 2400, log: true, fmt: 'hz' },
    { id: 'formant', label: 'Formant', min: 0, max: 1, value: 0, fmt: 'pct' },
    { id: 'rough', label: 'Rauheit', min: 0, max: 1, value: 0.12, fmt: 'pct' },
    { id: 'detune', label: 'Verstimmung', min: 0, max: 60, value: 12, fmt: 'cents' },
    { id: 'attack', label: 'Attack', min: 0.004, max: 6, value: 0.35, log: true, fmt: 's' },
    { id: 'release', label: 'Release', min: 0.05, max: 10, value: 1.6, log: true, fmt: 's' },
    { id: 'voices', label: 'Stimmen', min: 1, max: 6, value: 3, fmt: 'int' },
    { id: 'jump', label: 'Sprung', min: 0, max: 1, value: 0.15, fmt: 'pct' },
    ...COMMON_PARAMS,
  ];
  static options = [
    { id: 'source', label: 'Quelle', choices: [['hybrid', 'Hybrid'], ['va', 'Analog'], ['wave', 'Wavetable'], ['fm', 'FM'], ['noise', 'Rauschen']], value: 'hybrid' },
    { id: 'hold', label: 'Notenlänge', choices: [['gate', 'Gate'], ['0.5', '0.5 s'], ['1', '1 s'], ['2', '2 s'], ['4', '4 s'], ['8', '8 s']], value: '1' },
  ];
  static jacks = [
    { id: 'gateIn', type: 'in', signal: 'gate', label: 'GATE' },
    { id: 'pitchIn', type: 'in', signal: 'pitch', label: 'PITCH' },
    { id: 'jumpIn', type: 'in', signal: 'gate', label: 'JUMP' },
    { id: 'morphCv', type: 'in', signal: 'mod', label: 'MORPH CV' },
    { id: 'timbreCv', type: 'in', signal: 'mod', label: 'TIMBRE CV' },
    { id: 'envCv', type: 'in', signal: 'mod', label: 'ENV CV' },
    { id: 'vcaCv', type: 'in', signal: 'mod', label: 'VCA CV' },
    { id: 'panCv', type: 'in', signal: 'mod', label: 'PAN CV' },
    MUTATE_JACK,
  ];
  static defaultLocks = ['detune'];

  constructor(ctx, state = {}) {
    super(ctx, state);
    this.currentMidi = 48; // C3
    this.cv = { morph: 0.5, timbre: 0.5, env: 0.5 };
    this.jumpOffset = 0;
    this.notes = [];
    this.tables = getTables(ctx);
    this.levelGain = ctx.createGain();
    this.levelGain.connect(this.output);
    this.initValues(state);
  }

  isPatched(id) { return !!this.patchSystem?.hasIncoming(this.id, id); }

  morphPos() {
    const cv = this.isPatched('morphCv') ? this.cv.morph - 0.5 : 0;
    return clamp((this.values.morph ?? 0.3) + cv + this.jumpOffset);
  }

  cutoff() {
    const k = this.isPatched('timbreCv') ? Math.pow(2, (this.cv.timbre - 0.5) * 5) : 1;
    return clamp((this.values.bright ?? 2400) * k, 60, 18000);
  }

  envScale() {
    return this.isPatched('envCv') ? Math.pow(2, (this.cv.env - 0.5) * 4) : 1;
  }

  formantParams() {
    const fm = this.values.formant ?? 0;
    const [f1, f2] = vowelAt(fm);
    return { f1, f2, mix: smoothstep(0, 0.1, fm) * 0.85 };
  }

  applyParam(id, val) {
    if (id === 'level') this.ramp(this.levelGain.gain, val);
    else if (id === 'jump' && !(val > 0)) this.jumpOffset = 0;
    if (['morph', 'bright', 'formant', 'jump'].includes(id) && this.notes) this.updateLive();
  }

  onPitch(portId, _time, midiNote) {
    if (portId !== 'pitchIn') return;
    this.currentMidi = Array.isArray(midiNote) ? midiNote[0] : midiNote;
    this.updateNoteUi?.();
  }

  onModulation(portId, value) {
    if (this.handleSourceModulation(portId, value)) return;
    if (portId === 'morphCv') this.cv.morph = value;
    else if (portId === 'timbreCv') this.cv.timbre = value;
    else if (portId === 'envCv') { this.cv.env = value; return; }
    else return;
    this.updateLive();
  }

  rollJump() {
    const j = this.values.jump ?? 0;
    this.jumpOffset = j > 0 ? (Math.random() * 2 - 1) * j * 0.8 : 0;
  }

  onTrigger(portId, time, velocity = 1, duration = 0.1) {
    if (!this.enabled) return;
    if (this.handleMutateTrigger(portId)) return;
    if (portId === 'jumpIn') { this.rollJump(); this.updateLive(); return; }
    if (portId !== 'gateIn') return;
    this.rollJump();
    this.playNote(this.currentMidi, time, velocity, duration);
    this.flashUi?.();
  }

  sourceMix(src, rough, metal) {
    switch (src) {
      case 'va': return { table: 0, va: 1, fm: 0, noise: rough * 0.1 };
      case 'wave': return { table: 1, va: 0, fm: 0, noise: 0 };
      case 'fm': return { table: 0, va: 0, fm: 1, noise: rough * 0.1 };
      case 'noise': return { table: 0, va: 0, fm: 0, noise: 2.5 };
      default: return { table: 1, va: 0.3 * (1 - metal), fm: clamp(rough * 0.55 + metal * 0.5, 0, 0.9), noise: rough * 0.22 };
    }
  }

  pruneNotes(now) {
    this.notes = this.notes.filter((n) => n.end > now);
  }

  stealOldest(now) {
    const n = this.notes.shift();
    if (!n) return;
    try {
      n.vca.gain.cancelScheduledValues(now);
      n.vca.gain.setTargetAtTime(0, now, 0.025);
      n.stopAll(now + 0.2);
    } catch { /* ignore */ }
  }

  /** Verteilt die Morph-Position auf zwei Oszillatoren (gerade/ungerade Tabelle), damit nur der stille umgeschaltet wird */
  assignTables(note, tp, initial = false) {
    const T = this.tables.length;
    const lo = Math.min(Math.floor(tp), T - 2);
    const frac = clamp(tp - lo);
    const hi = lo + 1;
    const loEven = lo % 2 === 0;
    const evenIdx = loEven ? lo : hi;
    const oddIdx = loEven ? hi : lo;
    const wLo = Math.cos(frac * Math.PI / 2);
    const wHi = Math.sin(frac * Math.PI / 2);
    if (note.tabA !== evenIdx) { note.oscA.forEach((o) => o.setPeriodicWave(this.tables[evenIdx])); note.tabA = evenIdx; }
    if (note.tabB !== oddIdx) { note.oscB.forEach((o) => o.setPeriodicWave(this.tables[oddIdx])); note.tabB = oddIdx; }
    const now = this.ctx.currentTime;
    const wA = (loEven ? wLo : wHi) * note.mixTable;
    const wB = (loEven ? wHi : wLo) * note.mixTable;
    note.gA.forEach((g) => (initial ? (g.gain.value = wA) : g.gain.setTargetAtTime(wA, now, 0.03)));
    note.gB.forEach((g) => (initial ? (g.gain.value = wB) : g.gain.setTargetAtTime(wB, now, 0.03)));
  }

  /** CV-/Regleränderungen wirken auch auf klingende Noten (langsame Verläufe!) */
  updateLive() {
    const now = this.ctx.currentTime;
    this.pruneNotes(now);
    const mp = this.morphPos();
    const tp = mp * (this.tables.length - 1);
    const cutoff = this.cutoff();
    const fm = this.formantParams();
    for (const n of this.notes) {
      this.assignTables(n, tp);
      n.lp.frequency.setTargetAtTime(cutoff, now, 0.08);
      n.fb1.frequency.setTargetAtTime(fm.f1, now, 0.08);
      n.fb2.frequency.setTargetAtTime(fm.f2, now, 0.08);
      n.dry.gain.setTargetAtTime(1 - fm.mix * 0.55, now, 0.08);
      n.g1.gain.setTargetAtTime(fm.mix * 2.0, now, 0.08);
      n.g2.gain.setTargetAtTime(fm.mix * 1.6, now, 0.08);
    }
    this.morphUi?.(mp);
  }

  playNote(midi, time, velocity = 1, duration = 0.1) {
    const ctx = this.ctx;
    const V = this.values;
    const now = ctx.currentTime;
    const t = Math.max(time, now);
    this.pruneNotes(now);
    if (this.notes.length >= 10) this.stealOldest(now);

    const N = clamp(Math.round(V.voices || 1), 1, 6);
    const rough = V.rough ?? 0;
    const mp = this.morphPos();
    const metal = smoothstep(0.55, 1, mp);
    const mix = this.sourceMix(V.source || 'hybrid', rough, metal);
    const f = midiToFreq(midi);
    const v = this.vel(velocity);

    const note = { oscA: [], oscB: [], gA: [], gB: [], tabA: -1, tabB: -1, mixTable: mix.table, end: 0 };
    const nodes = [];
    const sources = []; // alles, was gestartet/gestoppt wird
    const add = (n) => { nodes.push(n); return n; };

    const sum = add(ctx.createGain());
    sum.gain.value = 1 / Math.sqrt(N);
    const pre = add(ctx.createGain()); // FM & Rauschen umgehen die Stimmen-Normierung
    sum.connect(pre);

    for (let i = 0; i < N; i++) {
      const x = N > 1 ? (i / (N - 1)) * 2 - 1 : 0;
      const cents = x * (V.detune || 0);
      const uMix = add(ctx.createGain());
      if (mix.table > 0) {
        for (const set of [note.oscA, note.oscB]) {
          const o = add(ctx.createOscillator());
          o.frequency.value = f;
          o.detune.value = cents;
          const g = add(ctx.createGain());
          g.gain.value = 0;
          o.connect(g); g.connect(uMix);
          set.push(o); sources.push(o);
          (set === note.oscA ? note.gA : note.gB).push(g);
        }
      }
      if (mix.va > 0) {
        const o = add(ctx.createOscillator());
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.detune.value = cents * 1.3;
        const g = add(ctx.createGain());
        g.gain.value = mix.va * 0.5;
        o.connect(g); g.connect(uMix);
        sources.push(o);
      }
      if (N > 1 && ctx.createStereoPanner) {
        const pn = add(ctx.createStereoPanner());
        pn.pan.value = x * 0.75;
        uMix.connect(pn); pn.connect(sum);
      } else {
        uMix.connect(sum);
      }
    }
    if (mix.table > 0) this.assignTables(note, mp * (this.tables.length - 1), true);

    if (mix.fm > 0) {
      const ratio = lerp(1, 3.5, mp);
      const index = 0.4 + rough * 2.5 + metal * 2;
      const car = add(ctx.createOscillator());
      const mod = add(ctx.createOscillator());
      car.frequency.value = f;
      mod.frequency.value = f * ratio;
      const modG = add(ctx.createGain());
      modG.gain.setValueAtTime(f * index, t);
      modG.gain.setTargetAtTime(f * index * 0.5, t, 0.4);
      const gf = add(ctx.createGain());
      gf.gain.value = mix.fm * 0.8;
      mod.connect(modG); modG.connect(car.frequency);
      car.connect(gf); gf.connect(pre);
      sources.push(car, mod);
    }

    if (mix.noise > 0) {
      const nz = add(ctx.createBufferSource());
      nz.buffer = getNoiseBuffers(ctx).white;
      nz.loop = true;
      const bp = add(ctx.createBiquadFilter());
      bp.type = 'bandpass';
      bp.frequency.value = V.source === 'noise' ? f : Math.min(12000, f * 2);
      bp.Q.value = V.source === 'noise' ? 14 : 0.7;
      const gn = add(ctx.createGain());
      gn.gain.value = mix.noise * (V.source === 'noise' ? 1.4 : 0.5);
      nz.connect(bp); bp.connect(gn); gn.connect(pre);
      sources.push(nz);
    }

    // Rauheit: Sättigung
    let node = pre;
    if (rough > 0.08) {
      const sh = add(ctx.createWaveShaper());
      sh.curve = getShaperCurve(rough);
      node.connect(sh);
      node = sh;
    }
    const lp = add(ctx.createBiquadFilter());
    lp.type = 'lowpass';
    lp.frequency.value = this.cutoff();
    lp.Q.value = 0.7 + rough * 3;
    node.connect(lp);

    const vca = add(ctx.createGain());
    vca.gain.value = 0;
    const fm = this.formantParams();
    const dry = add(ctx.createGain());
    dry.gain.value = 1 - fm.mix * 0.55;
    lp.connect(dry); dry.connect(vca);
    const fb1 = add(ctx.createBiquadFilter());
    const fb2 = add(ctx.createBiquadFilter());
    fb1.type = fb2.type = 'bandpass';
    fb1.frequency.value = fm.f1; fb1.Q.value = 6;
    fb2.frequency.value = fm.f2; fb2.Q.value = 8;
    const g1 = add(ctx.createGain());
    const g2 = add(ctx.createGain());
    g1.gain.value = fm.mix * 2.0;
    g2.gain.value = fm.mix * 1.6;
    lp.connect(fb1); fb1.connect(g1); g1.connect(vca);
    lp.connect(fb2); fb2.connect(g2); g2.connect(vca);
    vca.connect(this.levelGain);

    // Hüllkurve
    const scale = this.envScale();
    const atk = Math.max(0.004, (V.attack ?? 0.35) * scale);
    const rel = Math.max(0.05, (V.release ?? 1.6) * scale);
    const len = V.hold === 'gate' ? Math.max(0.05, duration) : Number(V.hold || 1);
    const tOff = t + Math.max(len, atk);
    const peak = 0.3 * v;
    vca.gain.setValueAtTime(0, t);
    vca.gain.linearRampToValueAtTime(peak, t + atk);
    vca.gain.setValueAtTime(peak, tOff);
    vca.gain.setTargetAtTime(0, tOff, rel / 4);
    const stopT = tOff + rel * 1.5 + 0.1;

    note.stopAll = (when) => sources.forEach((s) => { try { s.stop(when); } catch { /* ignore */ } });
    sources.forEach((s) => s.start(t));
    note.stopAll(stopT);
    cleanupOnEnd(sources[0], nodes);
    Object.assign(note, { vca, lp, fb1, fb2, g1, g2, dry, end: stopT });
    this.notes.push(note);
    this.morphUi?.(mp);
  }

  voiceExtra() { return {}; }

  renderBody(el) {
    noteUi(el, this, (m) => midiToName(m.currentMidi), '▶ Fläche', () => this.playNote(this.currentMidi, this.ctx.currentTime, 1, 2.5));
    const wrap = document.createElement('div');
    wrap.className = 'morph-strip';
    wrap.innerHTML = `
      <div class="morph-track"><div class="morph-marker"></div></div>
      <div class="morph-names">${TABLE_NAMES.map((n) => `<span>${n}</span>`).join('')}</div>`;
    el.appendChild(wrap);
    const marker = wrap.querySelector('.morph-marker');
    this.morphUi = (mp) => { marker.style.left = `${mp * 100}%`; };
    this.morphUi(this.morphPos());
  }
}

// ═════════════════════════════════════════════ 2. HYBRID PERCUSSION ══
const transientCache = new WeakMap();
function getTransients(ctx) {
  if (transientCache.has(ctx)) return transientCache.get(ctx);
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * 0.05);
  const rng = createRng(31);
  const mk = (fn) => {
    const b = ctx.createBuffer(1, n, sr);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = fn(i / sr);
    return b;
  };
  const bufs = [
    mk((t) => (Math.sin(2 * Math.PI * 190 * t) * 0.9 + (rng() * 2 - 1) * 0.3) * Math.exp(-t * 220)),
    mk((t) => (Math.sin(2 * Math.PI * 950 * t) * 0.7 + (rng() * 2 - 1) * 0.5) * Math.exp(-t * 380)),
    mk((t) => (rng() * 2 - 1) * Math.exp(-t * 900)),
    mk((t) => (Math.sin(2 * Math.PI * 5200 * t) * 0.5 + (rng() * 2 - 1) * 0.6) * Math.exp(-t * 500)),
  ];
  transientCache.set(ctx, bufs);
  return bufs;
}

const METAL_RATIOS = [1, 1.483, 1.8, 2.546, 2.63, 3.897];

export class HybridPercModule extends VoiceBase {
  static type = 'hybrid_perc';
  static title = 'Hybrid Percussion';
  static category = 'source';
  static color = '#fb7185';
  static icon = '🪘';
  static description = 'Frei formbare Drum-Stimme: Kick, Tom, Snare, Hat & Glocke aus Körper, Rauschen, Metall und Transient';
  static params = [
    { id: 'level', label: 'Level', min: 0, max: 1, value: 0.8, fmt: 'pct' },
    { id: 'tune', label: 'Tonhöhe', min: 30, max: 800, value: 62, log: true, fmt: 'hz' },
    { id: 'body', label: 'Körper', min: 0, max: 1, value: 0.75, fmt: 'pct' },
    { id: 'material', label: 'Material', min: 0, max: 1, value: 0.2, fmt: 'pct' },
    { id: 'drop', label: 'Tonabfall', min: 0, max: 1, value: 0.55, fmt: 'pct' },
    { id: 'noise', label: 'Rauschen', min: 0, max: 1, value: 0.2, fmt: 'pct' },
    { id: 'snap', label: 'Anschlag', min: 0, max: 1, value: 0.4, fmt: 'pct' },
    { id: 'length', label: 'Länge', min: 0.04, max: 2.5, value: 0.35, log: true, fmt: 's' },
    { id: 'drive', label: 'Verzerrung', min: 0, max: 1, value: 0.15, fmt: 'pct' },
    ...COMMON_PARAMS,
  ];
  static options = [];
  static jacks = [
    { id: 'gateIn', type: 'in', signal: 'gate', label: 'GATE' },
    { id: 'pitchIn', type: 'in', signal: 'pitch', label: 'PITCH' },
    { id: 'timbreCv', type: 'in', signal: 'mod', label: 'MATERIAL CV' },
    { id: 'lengthCv', type: 'in', signal: 'mod', label: 'LENGTH CV' },
    { id: 'vcaCv', type: 'in', signal: 'mod', label: 'VCA CV' },
    { id: 'panCv', type: 'in', signal: 'mod', label: 'PAN CV' },
    MUTATE_JACK,
  ];
  static defaultLocks = ['tune'];

  constructor(ctx, state = {}) {
    super(ctx, state);
    this.currentMidi = 36;
    this.timbreCv = 0.5;
    this.lengthCv = 0.5;
    this.levelGain = ctx.createGain();
    this.levelGain.connect(this.output);
    this.initValues(state);
  }

  isPatched(id) { return !!this.patchSystem?.hasIncoming(this.id, id); }

  applyParam(id, val) {
    if (id === 'level') this.ramp(this.levelGain.gain, val);
  }

  onPitch(portId, _time, midiNote) {
    if (portId !== 'pitchIn') return;
    this.currentMidi = Array.isArray(midiNote) ? midiNote[0] : midiNote;
    this.updateNoteUi?.();
  }

  onModulation(portId, value) {
    if (this.handleSourceModulation(portId, value)) return;
    if (portId === 'timbreCv') this.timbreCv = value;
    else if (portId === 'lengthCv') this.lengthCv = value;
  }

  onTrigger(portId, time, velocity = 1) {
    if (!this.enabled) return;
    if (this.handleMutateTrigger(portId)) return;
    if (portId !== 'gateIn') return;
    this.hit(time, velocity);
    this.flashUi?.();
  }

  currentFreq() {
    return this.isPatched('pitchIn') ? midiToFreq(this.currentMidi) : this.values.tune;
  }

  hit(time, velocity = 1, over = {}) {
    const ctx = this.ctx;
    const V = this.values;
    const t = Math.max(time, ctx.currentTime);
    const v = this.vel(velocity);
    const f = clamp(over.f ?? this.currentFreq(), 25, 2000);
    const material = clamp(over.material ?? (V.material + (this.isPatched('timbreCv') ? this.timbreCv - 0.5 : 0)));
    const lenMod = this.isPatched('lengthCv') ? Math.pow(2, (this.lengthCv - 0.5) * 2) : 1;
    const len = clamp((over.length ?? V.length) * lenMod, 0.03, 4);
    const drop = over.drop ?? V.drop;
    const bodyW = (over.body ?? V.body) * (1 - 0.55 * material);
    const metalW = Math.pow(material, 1.4);
    const nodes = [];
    const add = (n) => { nodes.push(n); return n; };
    const end = t + len + 0.12;

    const bus = add(ctx.createGain());
    // Verzerrung
    if (V.drive > 0.03) {
      const pre = add(ctx.createGain());
      pre.gain.value = 1 + V.drive * 2.5;
      const sh = add(ctx.createWaveShaper());
      sh.curve = getShaperCurve(V.drive);
      const post = add(ctx.createGain());
      post.gain.value = 1 / (1 + V.drive);
      bus.connect(pre); pre.connect(sh); sh.connect(post); post.connect(this.levelGain);
    } else {
      bus.connect(this.levelGain);
    }

    // 1. Tonkörper (mit Tonhöhenabfall)
    const osc = add(ctx.createOscillator());
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f * (1 + drop * 5), t);
    osc.frequency.exponentialRampToValueAtTime(f, t + 0.012 + drop * 0.08);
    const bg = add(ctx.createGain());
    bg.gain.setValueAtTime(0, t);
    bg.gain.linearRampToValueAtTime(bodyW * 0.9 * v, t + 0.002);
    bg.gain.exponentialRampToValueAtTime(0.0001, t + len);
    osc.connect(bg); bg.connect(bus);
    const sources = [osc];
    if (bodyW > 0.02 && material > 0.15) {
      const o2 = add(ctx.createOscillator());
      o2.frequency.setValueAtTime(f * lerp(1.59, 2.14, material) * (1 + drop * 2), t);
      o2.frequency.exponentialRampToValueAtTime(f * lerp(1.59, 2.14, material), t + 0.02 + drop * 0.05);
      const g2 = add(ctx.createGain());
      g2.gain.setValueAtTime(bodyW * material * 0.35 * v, t);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + len * 0.55);
      o2.connect(g2); g2.connect(bus);
      sources.push(o2);
    }

    // 2. Rauschen (Snare / raue Anschläge)
    if (V.noise > 0.02) {
      const nz = add(ctx.createBufferSource());
      nz.buffer = getNoiseBuffers(ctx).white;
      const bp = add(ctx.createBiquadFilter());
      bp.type = 'bandpass';
      bp.frequency.value = lerp(1200, 7500, material);
      bp.Q.value = 0.9 + material * 1.5;
      const ng = add(ctx.createGain());
      ng.gain.setValueAtTime(V.noise * 0.55 * v, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + len * (0.35 + 0.4 * (1 - material)));
      nz.connect(bp); bp.connect(ng); ng.connect(bus);
      nz.start(t, Math.random() * 1.5, len + 0.1);
    }

    // 3. Metall (Hats, Glocken)
    if (metalW > 0.03) {
      const mb = lerp(150, 380, material) * clamp(Math.pow(f / 62, 0.35), 0.7, 2.5);
      const mg = add(ctx.createGain());
      mg.gain.setValueAtTime(0.12 * metalW * v, t);
      mg.gain.exponentialRampToValueAtTime(0.0001, t + len * 0.55);
      const hp = add(ctx.createBiquadFilter());
      hp.type = 'highpass';
      hp.frequency.value = lerp(3500, 6500, material);
      const bp = add(ctx.createBiquadFilter());
      bp.type = 'bandpass';
      bp.frequency.value = 8500;
      bp.Q.value = 0.7;
      hp.connect(bp); bp.connect(mg); mg.connect(bus);
      METAL_RATIOS.forEach((r) => {
        const o = add(ctx.createOscillator());
        o.type = 'square';
        o.frequency.value = mb * r;
        o.connect(hp);
        sources.push(o);
      });
    }

    // 4. Kurzer Sample-Transient
    if (V.snap > 0.02) {
      const bs = add(ctx.createBufferSource());
      bs.buffer = getTransients(ctx)[Math.min(3, Math.round(material * 3))];
      bs.playbackRate.value = clamp(Math.pow(f / 100, 0.3), 0.7, 2);
      const sg = add(ctx.createGain());
      sg.gain.value = V.snap * 0.9 * v;
      bs.connect(sg); sg.connect(bus);
      bs.start(t);
    }

    sources.forEach((s) => { s.start(t); s.stop(end); });
    cleanupOnEnd(osc, nodes);
  }

  renderBody(el) {
    noteUi(el, this, (m) => `${Math.round(m.currentFreq())} Hz`, '▶ Hit', () => this.hit(this.ctx.currentTime, 1));
    const row = document.createElement('div');
    row.className = 'perc-pads';
    const presets = [
      ['TIEF', { f: 48, material: 0.05, length: 0.55, drop: 0.7, body: 0.95 }],
      ['TOM', { f: 125, material: 0.25, length: 0.4, drop: 0.35 }],
      ['SNARE', { f: 190, material: 0.45, length: 0.22, drop: 0.2, body: 0.5 }],
      ['METALL', { f: 420, material: 1, length: 0.2, drop: 0 }],
    ];
    row.innerHTML = presets.map(([n]) => `<button class="d-pad perc-pad">${n}</button>`).join('');
    el.appendChild(row);
    row.querySelectorAll('.perc-pad').forEach((b, i) => {
      b.addEventListener('click', () => {
        this.hit(this.ctx.currentTime, 1, presets[i][1]);
        b.classList.add('flash');
        setTimeout(() => b.classList.remove('flash'), 120);
      });
    });
  }
}

// ═════════════════════════════════════════════ 3. RESONATOR GARDEN ══
const BAR_RATIOS = [1, 2.756, 5.404, 8.933, 13.344, 18.64, 24.81, 31.95];

export class ResonatorGardenModule extends VoiceBase {
  static type = 'resonator_garden';
  static title = 'Resonator Garden';
  static category = 'source';
  static color = '#34d399';
  static icon = '🔔';
  static description = 'Gestimmte Resonanzen: aus Impulsen und Rauschen werden Saiten, Glocken, Holz und schwebende Drones';
  static params = [
    { id: 'level', label: 'Level', min: 0, max: 1, value: 0.75, fmt: 'pct' },
    { id: 'material', label: 'Material', min: 0, max: 1, value: 0.25, fmt: 'pct' },
    { id: 'size', label: 'Größe', min: 0, max: 1, value: 0.5, fmt: 'pct' },
    { id: 'damp', label: 'Dämpfung', min: 0, max: 1, value: 0.35, fmt: 'pct' },
    { id: 'pos', label: 'Anschlagpos.', min: 0, max: 1, value: 0.3, fmt: 'pct' },
    { id: 'spread', label: 'Verteilung', min: 0, max: 1, value: 0.35, fmt: 'pct' },
    { id: 'decay', label: 'Ausklang', min: 0.15, max: 15, value: 3, log: true, fmt: 's' },
    { id: 'modes', label: 'Resonanzen', min: 2, max: 8, value: 8, fmt: 'int' },
    ...COMMON_PARAMS,
  ];
  static options = [
    { id: 'excite', label: 'Anregung', choices: [['impulse', 'Impuls'], ['noise', 'Rauschen'], ['drone', 'Dauer']], value: 'impulse' },
  ];
  static jacks = [
    { id: 'gateIn', type: 'in', signal: 'gate', label: 'GATE' },
    { id: 'pitchIn', type: 'in', signal: 'pitch', label: 'PITCH' },
    { id: 'materialCv', type: 'in', signal: 'mod', label: 'MATERIAL CV' },
    { id: 'dampCv', type: 'in', signal: 'mod', label: 'DAMP CV' },
    { id: 'vcaCv', type: 'in', signal: 'mod', label: 'VCA CV' },
    { id: 'panCv', type: 'in', signal: 'mod', label: 'PAN CV' },
    MUTATE_JACK,
  ];
  static defaultLocks = ['size'];

  constructor(ctx, state = {}) {
    super(ctx, state);
    this.currentMidi = 48;
    this.cv = { material: 0.5, damp: 0.5 };
    this.levelGain = ctx.createGain();
    this.levelGain.connect(this.output);

    // Dauerhafte Filterbank (für Rausch- und Dauer-Anregung)
    this.exciteGain = ctx.createGain();
    this.exciteGain.gain.value = 0;
    this.noiseSrc = ctx.createBufferSource();
    this.noiseSrc.buffer = getNoiseBuffers(ctx).white;
    this.noiseSrc.loop = true;
    this.noiseSrc.connect(this.exciteGain);
    this.start(this.noiseSrc);
    this.bank = [];
    for (let i = 0; i < 8; i++) {
      const flt = ctx.createBiquadFilter();
      flt.type = 'bandpass';
      flt.frequency.value = 200;
      const g = ctx.createGain();
      g.gain.value = 0;
      this.exciteGain.connect(flt);
      flt.connect(g);
      g.connect(this.levelGain);
      this.bank.push({ flt, g });
    }
    this.ready = false; // erst nach initValues sind alle Parameter gesetzt
    this.initValues(state);
    this.ready = true;
    this.setExciteBase();
    this.retuneBank();
  }

  isPatched(id) { return !!this.patchSystem?.hasIncoming(this.id, id); }
  effMaterial() { return clamp(this.values.material + (this.isPatched('materialCv') ? this.cv.material - 0.5 : 0)); }
  effDamp() { return clamp(this.values.damp + (this.isPatched('dampCv') ? this.cv.damp - 0.5 : 0)); }

  computeModes() {
    const V = this.values;
    const m = this.effMaterial();
    const damp = this.effDamp();
    const n = clamp(Math.round(V.modes ?? 8), 2, 8);
    const f0 = midiToFreq(this.currentMidi) * Math.pow(2, (0.5 - V.size) * 2);
    const posN = lerp(0.04, 0.5, V.pos);
    const modes = [];
    let norm = 0;
    for (let i = 0; i < 8; i++) {
      const k = i + 1;
      if (i >= n) { modes.push({ f: 0, a: 0, t: 0.05 }); continue; }
      let ratio = lerp(k, BAR_RATIOS[i], m);
      ratio = Math.pow(ratio, 1 + V.spread * 0.14);
      const f = f0 * ratio;
      const posW = Math.max(0.15, Math.abs(Math.sin(Math.PI * k * posN)));
      let a = (1 / Math.pow(k, 1.15 - V.spread * 0.85)) * posW;
      if (f > 15000 || f < 20) a = 0;
      const t60 = Math.max(0.05, V.decay / (1 + damp * 4 * Math.pow(i, 0.85)));
      modes.push({ f, a, t: t60 });
      norm += a * a;
    }
    norm = Math.sqrt(norm) || 1;
    modes.forEach((md) => { md.a /= norm; });
    return modes;
  }

  retuneBank() {
    if (!this.bank || !this.ready) return;
    const now = this.ctx.currentTime;
    const sr = this.ctx.sampleRate;
    const modes = this.computeModes();
    modes.forEach((md, i) => {
      const { flt, g } = this.bank[i];
      if (md.a <= 0) { g.gain.setTargetAtTime(0, now, 0.03); return; }
      const Q = clamp((Math.PI * md.f * md.t) / 6.9, 4, 300);
      flt.frequency.setTargetAtTime(md.f, now, 0.02);
      flt.Q.setTargetAtTime(Q, now, 0.02);
      // Makeup: schmale Bänder lassen aus Rauschen wenig Energie durch
      g.gain.setTargetAtTime(0.4 * Math.sqrt((Q * sr) / (Math.PI * md.f)) * md.a, now, 0.03);
    });
    this.drawModes?.(modes);
  }

  setExciteBase() {
    const drone = this.values.excite === 'drone';
    this.exciteGain.gain.setTargetAtTime(drone ? 0.6 : 0, this.ctx.currentTime, drone ? 0.3 : 0.05);
  }

  applyParam(id, val) {
    if (!this.bank) return;
    if (id === 'level') this.ramp(this.levelGain.gain, val);
    else if (id === 'excite') this.setExciteBase();
    else this.retuneBank();
  }

  onPitch(portId, _time, midiNote) {
    if (portId !== 'pitchIn') return;
    this.currentMidi = midiNote;
    this.updateNoteUi?.();
    this.retuneBank();
  }

  onModulation(portId, value) {
    if (this.handleSourceModulation(portId, value)) return;
    if (portId === 'materialCv') this.cv.material = value;
    else if (portId === 'dampCv') this.cv.damp = value;
    else return;
    this.retuneBank();
  }

  onTrigger(portId, time, velocity = 1) {
    if (!this.enabled) return;
    if (this.handleMutateTrigger(portId)) return;
    if (portId !== 'gateIn') return;
    this.excite(time, velocity);
    this.flashUi?.();
  }

  excite(time, velocity = 1) {
    const t = Math.max(time, this.ctx.currentTime);
    const v = this.vel(velocity);
    const mode = this.values.excite;
    if (mode === 'impulse') { this.strike(t, v); return; }
    const g = this.exciteGain.gain;
    g.cancelScheduledValues(t);
    if (mode === 'noise') {
      g.setValueAtTime(0, t);
      g.linearRampToValueAtTime(3 * v, t + 0.004);
      g.setValueAtTime(3 * v, t + 0.05);
      g.linearRampToValueAtTime(0, t + 0.06);
    } else {
      g.setValueAtTime(0.6, t);
      g.linearRampToValueAtTime(1.6 * v, t + 0.15);
      g.setTargetAtTime(0.6, t + 0.15, 0.5);
    }
  }

  /** Impuls-Anregung: jede Resonanz klingt als abklingender Sinus */
  strike(t, v) {
    const ctx = this.ctx;
    const modes = this.computeModes();
    const nodes = [];
    let last = null;
    for (const md of modes) {
      if (md.a <= 0) continue;
      const o = ctx.createOscillator();
      o.frequency.value = md.f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.42 * md.a * v, t + 0.0015);
      g.gain.setTargetAtTime(0, t + 0.0015, md.t / 6.9);
      o.connect(g); g.connect(this.levelGain);
      o.start(t); o.stop(t + md.t * 1.1 + 0.05);
      nodes.push(o, g);
      if (!last || md.t > last.t) last = { o, t: md.t };
    }
    if (last) cleanupOnEnd(last.o, nodes);

    // Schlägel-Klick
    const nz = ctx.createBufferSource();
    nz.buffer = getNoiseBuffers(ctx).white;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2500 + this.effMaterial() * 4000;
    bp.Q.value = 1.2;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.14 * v, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.012);
    nz.connect(bp); bp.connect(ng); ng.connect(this.levelGain);
    nz.start(t, Math.random(), 0.02);
    cleanupOnEnd(nz, [nz, bp, ng]);
  }

  renderBody(el) {
    noteUi(el, this, (m) => midiToName(m.currentMidi), '▶ Anschlag', () => this.excite(this.ctx.currentTime, 1));
    const cv = document.createElement('canvas');
    cv.className = 'garden-canvas';
    cv.width = 240; cv.height = 44;
    el.appendChild(cv);
    const c = cv.getContext('2d');
    let lastDraw = 0;
    this.drawModes = (modes) => {
      if (document.hidden || this._isOffscreen || this.engine?.renderLod === 'low') return;
      const now = performance.now();
      if (this.engine?.renderLod === 'medium' && now - lastDraw < 66) return;
      lastDraw = now;
      c.clearRect(0, 0, cv.width, cv.height);
      const lo = Math.log(40), hi = Math.log(16000);
      modes.forEach((m, i) => {
        if (m.a <= 0) return;
        const x = ((Math.log(m.f) - lo) / (hi - lo)) * (cv.width - 8) + 4;
        const h = 6 + m.a * 36;
        c.strokeStyle = `hsl(${150 + i * 16}, 70%, ${55 + m.a * 20}%)`;
        c.lineWidth = 2.5;
        c.lineCap = 'round';
        c.beginPath(); c.moveTo(x, cv.height - 3); c.lineTo(x, cv.height - 3 - h); c.stroke();
        // Ausklang als Punkt
        c.fillStyle = 'rgba(255,255,255,0.55)';
        c.beginPath(); c.arc(x, cv.height - 3 - h - 3, 1 + Math.min(2.5, m.t * 0.5), 0, Math.PI * 2); c.fill();
      });
    };
    this.retuneBank();
  }
}

// ═════════════════════════════════════════════ 4. SPECTRAL SWARM ══
const MAXP = 32;

export class SpectralSwarmModule extends VoiceBase {
  static type = 'spectral_swarm';
  static title = 'Spectral Swarm';
  static category = 'source';
  static color = '#38bdf8';
  static icon = '✺';
  static description = 'Drone aus bis zu 32 beweglichen Teiltönen – Scatter streut, Gather sammelt sie zum harmonischen Klang';
  static params = [
    { id: 'level', label: 'Level', min: 0, max: 1, value: 0.7, fmt: 'pct' },
    { id: 'count', label: 'Teiltöne', min: 2, max: 32, value: 14, fmt: 'int' },
    { id: 'inharm', label: 'Unharmonik', min: 0, max: 1, value: 0.2, fmt: 'pct' },
    { id: 'scatter', label: 'Streuung', min: 0, max: 1, value: 0.35, fmt: 'pct' },
    { id: 'motion', label: 'Bewegung', min: 0.02, max: 3, value: 0.25, log: true, fmt: 'hz' },
    { id: 'depth', label: 'Tiefe', min: 0, max: 1, value: 0.5, fmt: 'pct' },
    { id: 'bright', label: 'Helligkeit', min: 0, max: 1, value: 0.5, fmt: 'pct' },
    { id: 'cohesion', label: 'Zusammenhalt', min: 0, max: 1, value: 0.4, fmt: 'pct' },
    { id: 'decay', label: 'Hüllkurve', min: 0.1, max: 8, value: 1.2, log: true, fmt: 's' },
    ...COMMON_PARAMS,
  ];
  static options = [
    { id: 'mode', label: 'Modus', choices: [['drone', 'Drone'], ['particles', 'Partikel']], value: 'drone' },
  ];
  static jacks = [
    { id: 'gateIn', type: 'in', signal: 'gate', label: 'GATE' },
    { id: 'pitchIn', type: 'in', signal: 'pitch', label: 'PITCH' },
    { id: 'scatterIn', type: 'in', signal: 'gate', label: 'SCATTER' },
    { id: 'gatherIn', type: 'in', signal: 'gate', label: 'GATHER' },
    { id: 'cohesionCv', type: 'in', signal: 'mod', label: 'COHESION CV' },
    { id: 'vcaCv', type: 'in', signal: 'mod', label: 'VCA CV' },
    { id: 'panCv', type: 'in', signal: 'mod', label: 'PAN CV' },
    MUTATE_JACK,
  ];
  static defaultLocks = ['count'];

  constructor(ctx, state = {}) {
    super(ctx, state);
    this.currentMidi = state.extra?.midi ?? 40;
    this.cohesionCv = 0.5;
    this.gatherUntil = 0;
    this.glide = 0.12;
    this.accent = ctx.createGain();
    this.levelGain = ctx.createGain();
    this.accent.connect(this.levelGain);
    this.levelGain.connect(this.output);

    const rng = createRng(2024);
    this.parts = [];
    for (let i = 0; i < MAXP; i++) {
      const osc = ctx.createOscillator();
      osc.frequency.value = 55 * (i + 1);
      const amp = ctx.createGain(); amp.gain.value = 0;
      const env = ctx.createGain(); env.gain.value = 0;
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      osc.connect(amp); amp.connect(env);
      if (pan) { env.connect(pan); pan.connect(this.accent); } else env.connect(this.accent);
      this.start(osc);
      this.parts.push({
        osc, amp, env, pan,
        u: rng() * 2 - 1, w: 0, wt: 0,
        ph: rng() * Math.PI * 2, rate: 0.3 + rng() * 1.4, pan0: rng() * 2 - 1,
        shape: { f: 0, a: 0 },
      });
    }
    this.initValues(state);
    this.applyMode();
    this.timer = setInterval(() => this.step(0.1), 100);
  }

  isPatched(id) { return !!this.patchSystem?.hasIncoming(this.id, id); }
  effCohesion() { return clamp(this.values.cohesion + (this.isPatched('cohesionCv') ? this.cohesionCv - 0.5 : 0)); }

  applyMode() {
    if (!this.parts) return;
    const drone = (this.values.mode || 'drone') === 'drone';
    const t = this.ctx.currentTime;
    this.parts.forEach((p) => {
      p.env.gain.cancelScheduledValues(t);
      p.env.gain.setTargetAtTime(drone ? 1 : 0, t, drone ? 0.6 : 0.05);
    });
  }

  applyParam(id, val) {
    if (!this.parts) return;
    if (id === 'level') this.ramp(this.levelGain.gain, val * 0.9);
    else if (id === 'mode') this.applyMode();
  }

  onPitch(portId, _time, midiNote) {
    if (portId !== 'pitchIn') return;
    this.currentMidi = Array.isArray(midiNote) ? midiNote[0] : midiNote;
    this.updateNoteUi?.();
  }

  onModulation(portId, value) {
    if (this.handleSourceModulation(portId, value)) return;
    if (portId === 'cohesionCv') this.cohesionCv = value;
  }

  onTrigger(portId, time, velocity = 1) {
    if (!this.enabled) return;
    if (this.handleMutateTrigger(portId)) return;
    if (portId === 'scatterIn') { this.scatter(); return; }
    if (portId === 'gatherIn') { this.gather(); return; }
    if (portId !== 'gateIn') return;
    this.burst(time, velocity);
    this.flashUi?.();
  }

  /** Teiltöne wild verteilen: neue Frequenzabweichungen, Positionen und Bewegungstempi */
  scatter() {
    const amt = Math.max(0.4, this.values.scatter) * 1000;
    this.gatherUntil = 0;
    this.glide = 0.05;
    for (const p of this.parts) {
      p.w = (Math.random() * 2 - 1) * amt;
      p.wt = p.w;
      p.pan0 = Math.random() * 2 - 1;
      p.rate = 0.3 + Math.random() * 1.4;
      p.u = Math.random() * 2 - 1;
    }
    this.flashUi?.();
  }

  /** Teiltöne zu einem harmonischen Klang zusammenziehen */
  gather() {
    this.gatherUntil = this.ctx.currentTime + 3;
    this.glide = 0.12;
    for (const p of this.parts) p.wt = 0;
    this.flashUi?.();
  }

  /** Gate: im Partikel-Modus ein Schwarm kleiner klingender Teilchen, im Drone-Modus ein Akzent */
  burst(time, velocity = 1) {
    const t = Math.max(time, this.ctx.currentTime);
    const v = this.vel(velocity);
    if ((this.values.mode || 'drone') === 'drone') {
      this.accent.gain.cancelScheduledValues(t);
      this.accent.gain.setValueAtTime(1, t);
      this.accent.gain.linearRampToValueAtTime(1.5 * v + 0.2, t + 0.05);
      this.accent.gain.setTargetAtTime(1, t + 0.05, 0.4);
      return;
    }
    const count = Math.round(this.values.count);
    const spread = this.values.scatter * 0.15;
    const dec = this.values.decay;
    this.parts.forEach((p, i) => {
      if (i >= count) return;
      const d = Math.random() * spread + i * 0.002;
      const peak = v * (0.5 + 0.5 * Math.random());
      p.env.gain.cancelScheduledValues(t + d);
      p.env.gain.setValueAtTime(0, t + d);
      p.env.gain.linearRampToValueAtTime(peak, t + d + 0.004);
      p.env.gain.setTargetAtTime(0, t + d + 0.004, dec * (0.25 + 0.4 * Math.random()));
    });
  }

  step(dt) {
    if (!this.enabled || this.ctx.state !== 'running') return;
    const V = this.values;
    const t = this.ctx.currentTime;
    const count = clamp(Math.round(V.count), 2, MAXP);
    const f0 = midiToFreq(this.currentMidi);
    const cohesion = this.effCohesion();
    const gathering = t < this.gatherUntil;
    const wanderAmp = gathering ? 0 : V.scatter * (1 - 0.85 * cohesion) * 600;
    const follow = gathering ? 6 : 3;
    if (!gathering && this.glide < 0.12) this.glide = Math.min(0.12, this.glide + dt * 0.1);
    const tilt = 2.2 - 1.9 * V.bright;
    const motion = V.motion;

    let norm = 0;
    for (let i = 0; i < MAXP; i++) {
      const p = this.parts[i];
      const k = i + 1;
      if (i >= count) { p.shape = { f: p.shape.f || f0 * k, a: 0 }; continue; }
      if (Math.random() < dt * motion * 0.8) p.wt = (Math.random() * 2 - 1) * wanderAmp;
      p.w += (p.wt - p.w) * Math.min(1, dt * motion * follow);
      const bell = k * (1 + 0.37 * p.u) * Math.pow(k, 0.06);
      const ratio = lerp(k, bell, V.inharm);
      const f = f0 * ratio * Math.pow(2, p.w / 1200);
      p.ph += dt * motion * p.rate * Math.PI * 2;
      const m = 0.5 + 0.5 * Math.sin(p.ph);
      let a = (1 / Math.pow(k, tilt)) * (1 - V.depth + V.depth * m);
      if (f > 14000 || f < 20) a = 0;
      p.shape = { f, a };
      norm += a * a;
    }
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < MAXP; i++) {
      const p = this.parts[i];
      const { f, a } = p.shape;
      if (f > 0) p.osc.frequency.setTargetAtTime(f, t, this.glide);
      p.amp.gain.setTargetAtTime((a / norm) * 0.55, t, 0.15);
      if (p.pan) p.pan.pan.setTargetAtTime(clamp(p.pan0 * (0.15 + 0.85 * V.depth), -1, 1), t, 0.2);
    }
    this.drawUi?.(count, norm);
  }

  voiceExtra() { return { midi: this.currentMidi }; }

  renderBody(el) {
    noteUi(el, this, (m) => midiToName(m.currentMidi), '✦ Burst', () => this.burst(this.ctx.currentTime, 1));
    const cv = document.createElement('canvas');
    cv.className = 'garden-canvas swarm-canvas';
    cv.width = 240; cv.height = 52;
    el.appendChild(cv);
    const row = document.createElement('div');
    row.className = 'swarm-actions';
    row.innerHTML = `<button class="mini-btn sw-scatter">⤢ SCATTER</button><button class="mini-btn sw-gather">⤡ GATHER</button>`;
    el.appendChild(row);
    row.querySelector('.sw-scatter').addEventListener('click', () => this.scatter());
    row.querySelector('.sw-gather').addEventListener('click', () => this.gather());

    const c = cv.getContext('2d');
    const lo = Math.log(25), hi = Math.log(14000);
    let lastDraw = 0;
    this.drawUi = (count, norm) => {
      if (document.hidden || this._isOffscreen || this.engine?.renderLod === 'low') return;
      const now = performance.now();
      if (this.engine?.renderLod === 'medium' && now - lastDraw < 66) return;
      lastDraw = now;
      c.clearRect(0, 0, cv.width, cv.height);
      for (let i = 0; i < count; i++) {
        const { f, a } = this.parts[i].shape;
        if (!(f > 0) || !(a > 0)) continue;
        const x = ((Math.log(f) - lo) / (hi - lo)) * (cv.width - 8) + 4;
        const h = Math.min(cv.height - 6, 3 + (a / norm) * 90);
        c.fillStyle = `hsla(${190 + (i / count) * 80}, 85%, 65%, ${0.35 + Math.min(0.6, (a / norm) * 2)})`;
        c.beginPath();
        c.arc(x, cv.height - 4 - h, 2.2, 0, Math.PI * 2);
        c.fill();
        c.fillRect(x - 0.6, cv.height - 4 - h, 1.2, h);
      }
    };
  }

  destroy() {
    clearInterval(this.timer);
    this.parts.forEach((p) => {
      try {
        p.osc.stop();
        p.osc.disconnect();
        p.amp.disconnect();
        p.env.disconnect();
        if (p.pan) p.pan.disconnect();
      } catch { /* ignore */ }
    });
    this.parts = [];
    try { this.accent.disconnect(); this.levelGain.disconnect(); } catch { /* ignore */ }
    super.destroy();
  }
}
