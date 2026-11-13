// SYNTHBOARD · Eurorack – DSP-Module mit echten Audio-/CV-Anschlüssen
//
// Signaltypen und Wertebereiche
//   audio : AudioNode → AudioNode (Stereo, nominal ±1)
//   cv    : AudioNode → (AudioParam | Skalierknoten); Einheit "1.0 = Skalenwert" der Zielbuchse.
//           Jedes CV-Kabel besitzt einen eigenen Abschwächer (Tiefe 0…2).
//   pitch : Ereignis {notes:[MIDI…], time}  (polyphon: Index = Stimme, Stimme 0 = tiefste)
//   gate  : Ereignis {open:boolean, time}
// Unverbundene Eingänge: cv = 0, pitch = zuletzt gesetzte Tonhöhe, gate = geschlossen,
// audio = Stille. Alle Parameter werden mit setTargetAtTime geglättet.

import { getNoiseBuffers, midiToFreq, createRng } from '../modules/base.js';

export const SIGNAL_COLORS = { audio: '#6f9bd1', cv: '#58a98f', pitch: '#9a82c8', gate: '#c9a444' };

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const dbToGain = (db) => (db <= -59.5 ? 0 : Math.pow(10, db / 20));

/** Parameter setzen: sofort (Initialisierung) oder geglättet */
function put(param, value, t, immediate, tc = 0.08) {
  if (!Number.isFinite(value)) return;
  if (immediate) {
    param.cancelScheduledValues(0);
    param.value = value;
  } else {
    param.setTargetAtTime(value, t, tc);
  }
}

export class RackModule {
  static type = 'base';
  static title = '';
  static subtitle = '';
  static params = [];
  static jacks = [];

  constructor(ctx, id) {
    this.ctx = ctx;
    this.id = id;
    this.values = {};
    this.host = null;
    this.audioOut = {};   // portId → AudioNode
    this.audioIn = {};    // portId → AudioNode
    this.cvIn = {};       // portId → { target: AudioNode|AudioParam, scale }
    this.nodes = [];      // alle Quellen, die beim Zerstören gestoppt werden
  }

  get meta() { return this.constructor; }

  /** Gespeicherte Werte übernehmen; liefert Liste unbekannter Parameter */
  boot(state = {}) {
    const saved = state.values || {};
    const unknown = Object.keys(saved).filter((k) => !this.meta.params.some((p) => p.id === k));
    for (const p of this.meta.params) {
      this.values[p.id] = Number.isFinite(saved[p.id]) ? clamp(saved[p.id], p.min, p.max) : p.value;
    }
    if (state.extra) this.setExtra(state.extra);
    this.applyAll();
    return unknown;
  }

  applyAll() {
    for (const p of this.meta.params) this.apply(p.id, this.values[p.id], this.ctx.currentTime, true);
  }

  set(id, value, t = null, tc = null) {
    const def = this.meta.params.find((p) => p.id === id);
    if (!def) return false;
    const v = clamp(value, def.min, def.max);
    this.values[id] = v;
    this.apply(id, v, t ?? this.ctx.currentTime, false, tc);
    return true;
  }

  apply() {}
  emit(port, ev) { this.host?.emit(this.id, port, ev); }
  onEvent() {}
  getExtra() { return {}; }
  setExtra() {}
  src(node) { this.nodes.push(node); node.start(); return node; }

  getState() {
    return { id: this.id, type: this.meta.type, values: { ...this.values }, extra: this.getExtra() };
  }

  destroy() {
    for (const n of this.nodes) { try { n.stop(); } catch { /* bereits gestoppt */ } }
    this.nodes = [];
  }
}

// ═════════════════════════════════════════ A · HARMONIE / VOICING ══
// Akkorde als frei editierbare Einzeltöne (MIDI). Gate bleibt über Akkordwechsel offen.
export const DEFAULT_CHORDS = [
  { name: 'Hm', notes: [59, 62, 66, 71], bass: 35, bars: 4 }, // H3 D4 Fis4 H4 · Bass H1
  { name: 'G', notes: [59, 62, 67, 71], bass: 31, bars: 4 },  // H3 D4 G4 H4  · Bass G1
  { name: 'D', notes: [57, 62, 66, 69], bass: 38, bars: 4 },  // A3 D4 Fis4 A4 · Bass D2
  { name: 'A', notes: [57, 61, 64, 69], bass: 33, bars: 4 },  // A3 Cis4 E4 A4 · Bass A1
];

export class HarmonyModule extends RackModule {
  static type = 'harmony';
  static title = 'HARMONIE';
  static subtitle = 'Voicing · Akkordfolge';
  static params = [
    { id: 'lage', label: 'Lage', min: -24, max: 12, value: 0, step: 12, fmt: 'st', choices: [[-24, '−2 Okt'], [-12, '−1 Okt'], [0, 'Original'], [12, '+1 Okt']] },
  ];
  static jacks = [
    { id: 'pitchOut', dir: 'out', sig: 'pitch', label: 'POLY PITCH' },
    { id: 'rootOut', dir: 'out', sig: 'pitch', label: 'ROOT' },
    { id: 'gateOut', dir: 'out', sig: 'gate', label: 'GATE' },
  ];

  constructor(ctx, id) {
    super(ctx, id);
    this.chords = DEFAULT_CHORDS.map((c) => ({ ...c, notes: [...c.notes] }));
    this.cur = 0;
    this.gate = false;
    this.hold = false;
    this.holdIdx = 0;
    this.sounding = false;
  }

  getExtra() { return { chords: this.chords.map((c) => ({ ...c, notes: [...c.notes] })), hold: this.hold, holdIdx: this.holdIdx }; }
  setExtra(x) {
    if (Array.isArray(x.chords) && x.chords.length) {
      this.chords = x.chords.map((c) => ({
        name: String(c.name ?? '?'),
        notes: [0, 1, 2, 3].map((i) => clamp(Math.round(c.notes?.[i] ?? 60), 24, 96)),
        bass: clamp(Math.round(c.bass ?? 36), 24, 60),
        bars: clamp(Number(c.bars) || 4, 1, 16),
      }));
    }
    this.hold = !!x.hold;
    this.holdIdx = clamp(Math.round(x.holdIdx ?? 0), 0, this.chords.length - 1);
  }

  notesOf(idx) { const c = this.chords[idx] ?? this.chords[0]; return c.notes.map((n) => n + this.values.lage); }
  rootOf(idx) { return (this.chords[idx] ?? this.chords[0]).bass; }

  playChord(idx, t) {
    this.cur = clamp(idx, 0, this.chords.length - 1);
    this.sounding = true;
    this.emit('pitchOut', { kind: 'pitch', notes: this.notesOf(this.cur), time: t });
    this.emit('rootOut', { kind: 'pitch', notes: [this.rootOf(this.cur)], time: t });
  }

  setGate(open, t) {
    if (this.gate === open) return;
    this.gate = open;
    this.emit('gateOut', { kind: 'gate', open, time: t });
  }

  /** Neue Verbindungen erhalten den aktuellen Zustand nachgereicht */
  replay(t) {
    if (this.sounding) this.playChord(this.cur, t);
    if (this.gate) this.emit('gateOut', { kind: 'gate', open: true, time: t });
  }

  apply(id, v, t) { if (id === 'lage' && this.sounding) this.playChord(this.cur, t); }
}

// ═════════════════════════════════════════ B · ENSEMBLE-OSZILLATOR ══
const WAVES = [[0, 'Sägezahn'], [1, 'Weich'], [2, 'Dreieck'], [3, 'Sinus']];
const OSC_FACTORS = [-1, 1, 0];     // Verstimmungsfaktor pro Oszillator
const OSC_PAN = [-1, 1, 0];

function softWave(ctx) {
  const N = 48;
  const real = new Float32Array(N + 1);
  const imag = new Float32Array(N + 1);
  for (let n = 1; n <= N; n++) imag[n] = 1 / Math.pow(n, 1.75);
  return ctx.createPeriodicWave(real, imag);
}

export class EnsembleOscModule extends RackModule {
  static type = 'ensemble_osc';
  static title = 'ENSEMBLE OSC';
  static subtitle = '4 Stimmen × 2–3 Oszillatoren';
  static params = [
    { id: 'wave', label: 'Welle', min: 0, max: 3, value: 0, step: 1, choices: WAVES },
    { id: 'detune', label: 'Verstimmung', min: 0, max: 15, value: 6, fmt: 'cents' },
    { id: 'drift', label: 'Drift', min: 0, max: 8, value: 2.5, fmt: 'cents' },
    { id: 'spread', label: 'Breite', min: 0, max: 1, value: 0.8, fmt: 'pct' },
    { id: 'osc3', label: '3. Oszillator', min: 0, max: 1, value: 0.6, fmt: 'pct' },
    { id: 'voices', label: 'Stimmen', min: 1, max: 4, value: 4, step: 1, fmt: 'int' },
    { id: 'glide', label: 'Glide', min: 0, max: 6, value: 1.6, fmt: 's' },
    { id: 'register', label: 'Register', min: -12, max: 12, value: 0, step: 12, fmt: 'st', choices: [[-12, '−1 Okt'], [0, 'Original'], [12, '+1 Okt']] },
    { id: 'level', label: 'Pegel', min: 0, max: 1.2, value: 1, fmt: 'pct' },
  ];
  static jacks = [
    { id: 'pitchIn', dir: 'in', sig: 'pitch', label: 'POLY PITCH' },
    { id: 'detuneCv', dir: 'in', sig: 'cv', label: 'DETUNE CV' },
    { id: 'out', dir: 'out', sig: 'audio', label: 'AUDIO' },
  ];
  static K = 0.55; // nominaler Gesamt-RMS-Faktor vor dem Filter

  constructor(ctx, id) {
    super(ctx, id);
    const rng = createRng(4242);
    this.soft = softWave(ctx);
    this.out = ctx.createGain();
    this.audioOut.out = this.out;
    this.detuneCv = ctx.createGain();   // 1.0 CV = 20 Cent
    this.detuneCv.gain.value = 20;
    this.cvIn.detuneCv = { target: this.detuneCv, scale: 1 };
    this.voiceNotes = [60, 60, 60, 60];
    this.primed = false;
    this.voices = [];
    for (let v = 0; v < 4; v++) {
      const vg = ctx.createGain();
      vg.gain.value = 0;
      vg.connect(this.out);
      const voice = { vg, oscs: [] };
      for (let o = 0; o < 3; o++) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        const g = ctx.createGain();
        g.gain.value = 0;
        const pan = ctx.createStereoPanner();
        const drift = ctx.createOscillator();
        drift.frequency.value = 0.035 + rng() * 0.09;
        const driftG = ctx.createGain();
        driftG.gain.value = 0;
        drift.connect(driftG);
        driftG.connect(osc.detune);
        this.detuneCv.connect(osc.detune);
        osc.connect(g); g.connect(pan); pan.connect(vg);
        this.src(osc); this.src(drift);
        voice.oscs.push({ osc, g, pan, drift, driftG, jitter: (rng() - 0.5) * 0.3 });
      }
      this.voices.push(voice);
    }
  }

  setWaveform(type) {
    for (const v of this.voices) for (const o of v.oscs) {
      if (type === 1) o.osc.setPeriodicWave(this.soft);
      else o.osc.type = ['sawtooth', 'sawtooth', 'triangle', 'sine'][type];
    }
  }

  nOsc() { return 2 + this.values.osc3 * this.values.osc3; }

  /** Pegelkompensation: konstanter Gesamtpegel unabhängig von Stimmen-/Oszillatorzahl */
  gains(t, immediate = false) {
    const nv = Math.round(this.values.voices);
    const g = (EnsembleOscModule.K * this.values.level) / Math.sqrt(nv * this.nOsc());
    this.voices.forEach((voice, vi) => {
      put(voice.vg.gain, vi < nv ? 1 : 0, t, immediate, 0.15);
      voice.oscs.forEach((o, oi) => put(o.g.gain, oi < 2 ? g : g * this.values.osc3, t, immediate, 0.15));
    });
  }

  apply(id, v, t, immediate, tc) {
    const V = this.values;
    switch (id) {
      case 'wave':
        if (immediate) this.setWaveform(Math.round(v));
        else {
          // kurzer Pegel-Dip, damit der Wellenformwechsel nicht klickt
          this.out.gain.cancelScheduledValues(t);
          this.out.gain.setTargetAtTime(0, t, 0.012);
          setTimeout(() => { this.setWaveform(Math.round(v)); this.out.gain.setTargetAtTime(1, this.ctx.currentTime, 0.04); }, 70);
        }
        break;
      case 'detune':
        this.voices.forEach((vo, vi) => vo.oscs.forEach((o, oi) => {
          const cents = OSC_FACTORS[oi] * v + o.jitter * v * 0.3 + (vi - 1.5) * 0.04 * v;
          put(o.osc.detune, cents, t, immediate, tc ?? 0.15);
        }));
        break;
      case 'drift':
        this.voices.forEach((vo) => vo.oscs.forEach((o) => put(o.driftG.gain, v, t, immediate, tc ?? 0.3)));
        break;
      case 'spread': {
        const base = [-0.7, 0.35, -0.35, 0.7];
        this.voices.forEach((vo, vi) => vo.oscs.forEach((o, oi) => {
          put(o.pan.pan, clamp((base[vi] * 0.7 + OSC_PAN[oi] * 0.5) * v * 1.2, -1, 1), t, immediate, tc ?? 0.2);
        }));
        break;
      }
      case 'osc3': case 'voices': case 'level': this.gains(t, immediate); break;
      case 'register': if (this.primed && !immediate) this.retune(t); break;
      default: break;
    }
    void V;
  }

  retune(t) {
    this.voices.forEach((voice, i) => {
      const f = midiToFreq(this.voiceNotes[i] + this.values.register);
      const tc = Math.max(0.01, this.values.glide / 3);
      voice.oscs.forEach((o) => o.osc.frequency.setTargetAtTime(f, t, tc));
    });
  }

  onEvent(port, ev) {
    if (port !== 'pitchIn' || ev.kind !== 'pitch') return;
    ev.notes.slice(0, 4).forEach((n, i) => { this.voiceNotes[i] = n; });
    const t = Math.max(ev.time, this.ctx.currentTime);
    if (!this.primed) {
      this.voices.forEach((voice, i) => {
        const f = midiToFreq(this.voiceNotes[i] + this.values.register);
        voice.oscs.forEach((o) => o.osc.frequency.setValueAtTime(f, t));
      });
      this.primed = true;
    } else this.retune(t);
  }

  actualNotes() { return this.voiceNotes.slice(0, Math.round(this.values.voices)).map((n) => n + this.values.register); }
}

// ═════════════════════════════════════════ C · STEREOFILTER ══
export class FilterModule extends RackModule {
  static type = 'filter';
  static title = 'STEREOFILTER';
  static subtitle = 'Tiefpass 24 dB';
  static params = [
    { id: 'cutoff', label: 'Cutoff', min: 150, max: 8000, value: 1400, log: true, fmt: 'hz' },
    { id: 'res', label: 'Resonanz', min: 0, max: 8, value: 2, fmt: 'db' },
    { id: 'mod', label: 'Mod-Tiefe', min: 0, max: 3, value: 0.7, fmt: 'oct' },
  ];
  static jacks = [
    { id: 'in', dir: 'in', sig: 'audio', label: 'AUDIO' },
    { id: 'cutoffCv', dir: 'in', sig: 'cv', label: 'CUTOFF CV' },
    { id: 'out', dir: 'out', sig: 'audio', label: 'AUDIO' },
  ];

  constructor(ctx, id) {
    super(ctx, id);
    this.inN = ctx.createGain();
    this.bq1 = ctx.createBiquadFilter();
    this.bq2 = ctx.createBiquadFilter();
    this.bq1.type = this.bq2.type = 'lowpass';
    this.bq2.Q.value = 0;
    this.outN = ctx.createGain();
    this.inN.connect(this.bq1); this.bq1.connect(this.bq2); this.bq2.connect(this.outN);
    this.cvN = ctx.createGain();           // 1.0 CV = Mod-Tiefe Oktaven
    this.cvN.connect(this.bq1.detune); this.cvN.connect(this.bq2.detune);
    this.audioIn.in = this.inN;
    this.audioOut.out = this.outN;
    this.cvIn.cutoffCv = { target: this.cvN, scale: 1 };
  }

  apply(id, v, t, imm, tc) {
    if (id === 'cutoff') { put(this.bq1.frequency, v, t, imm, tc ?? 0.12); put(this.bq2.frequency, v, t, imm, tc ?? 0.12); }
    else if (id === 'res') put(this.bq1.Q, v, t, imm, tc ?? 0.1);   // Lowpass-Q in dB
    else if (id === 'mod') put(this.cvN.gain, v * 1200, t, imm, tc ?? 0.1);
  }
}

// ═════════════════════════════════════════ G · SÄTTIGUNG ══
export class SaturationModule extends RackModule {
  static type = 'saturation';
  static title = 'SÄTTIGUNG';
  static subtitle = 'Tanh · pegelkompensiert';
  static params = [
    { id: 'drive', label: 'Drive', min: 0, max: 1, value: 0.3, fmt: 'pct' },
    { id: 'on', label: 'Aktiv', min: 0, max: 1, value: 1, step: 1, toggle: true },
  ];
  static jacks = [
    { id: 'in', dir: 'in', sig: 'audio', label: 'AUDIO' },
    { id: 'out', dir: 'out', sig: 'audio', label: 'AUDIO' },
  ];

  constructor(ctx, id) {
    super(ctx, id);
    this.inN = ctx.createGain();
    this.dry = ctx.createGain();
    this.pre = ctx.createGain();
    this.shaper = ctx.createWaveShaper();
    this.shaper.oversample = '2x';
    const n = 4096, b = 0.15, c = new Float32Array(n);
    const norm = 1 / (1 - Math.pow(Math.tanh(b), 2));        // Kleinsignal-Verstärkung ≙ 1
    for (let i = 0; i < n; i++) { const x = (i * 2) / (n - 1) - 1; c[i] = (Math.tanh(x + b) - Math.tanh(b)) * norm; }
    this.shaper.curve = c;
    this.post = ctx.createGain();
    this.wet = ctx.createGain();
    this.outN = ctx.createGain();
    this.inN.connect(this.dry); this.dry.connect(this.outN);
    this.inN.connect(this.pre); this.pre.connect(this.shaper); this.shaper.connect(this.post); this.post.connect(this.wet); this.wet.connect(this.outN);
    this.audioIn.in = this.inN;
    this.audioOut.out = this.outN;
  }

  apply(id, v, t, imm) {
    const V = this.values;
    if (id === 'drive') {
      const pre = 1 + 7 * V.drive;
      put(this.pre.gain, pre, t, imm, 0.1);
      put(this.post.gain, 1 / pre, t, imm, 0.1);    // Pegelausgleich
    } else if (id === 'on') {
      put(this.wet.gain, v ? 1 : 0, t, imm, 0.03);
      put(this.dry.gain, v ? 0 : 1, t, imm, 0.03);
    }
  }
}

// ═════════════════════════════════════════ D · HÜLLKURVE + VCA ══
export class EnvelopeModule extends RackModule {
  static type = 'envelope';
  static title = 'HÜLLKURVE';
  static subtitle = 'Artikulation · Gate-gesteuert';
  static params = [
    { id: 'attack', label: 'Attack', min: 0.3, max: 10, value: 2.8, fmt: 's' },
    { id: 'sustain', label: 'Sustain', min: 0, max: 1, value: 1, fmt: 'pct' },
    { id: 'release', label: 'Release', min: 0.5, max: 14, value: 6, fmt: 's' },
  ];
  static jacks = [
    { id: 'gateIn', dir: 'in', sig: 'gate', label: 'GATE' },
    { id: 'out', dir: 'out', sig: 'cv', label: 'ENV' },
  ];

  constructor(ctx, id) {
    super(ctx, id);
    this.cs = ctx.createConstantSource();
    this.cs.offset.value = 0;
    this.src(this.cs);
    this.audioOut.out = this.cs;
    this.open = false;
  }

  onEvent(port, ev) {
    if (port !== 'gateIn' || ev.kind !== 'gate') return;
    const p = this.cs.offset;
    const t = Math.max(ev.time, this.ctx.currentTime);
    if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t); else p.cancelScheduledValues(t);
    this.open = ev.open;
    if (ev.open) p.setTargetAtTime(this.values.sustain, t, this.values.attack / 3);
    else p.setTargetAtTime(0, t, this.values.release / 3);
  }

  apply(id, v, t) {
    if (id === 'sustain' && this.open) this.cs.offset.setTargetAtTime(v, t, this.values.attack / 3);
  }
}

export class VcaModule extends RackModule {
  static type = 'vca';
  static title = 'VCA';
  static subtitle = 'Aufbau-Pegel';
  static params = [
    { id: 'level', label: 'Aufbau', min: -60, max: 6, value: -12, fmt: 'dbl' },
  ];
  static jacks = [
    { id: 'in', dir: 'in', sig: 'audio', label: 'AUDIO' },
    { id: 'cv', dir: 'in', sig: 'cv', label: 'CV' },
    { id: 'out', dir: 'out', sig: 'audio', label: 'AUDIO' },
  ];

  constructor(ctx, id) {
    super(ctx, id);
    this.inN = ctx.createGain();
    this.amp = ctx.createGain();
    this.amp.gain.value = 0;               // ohne CV-Kabel: geschlossen
    this.lvl = ctx.createGain();
    this.inN.connect(this.amp); this.amp.connect(this.lvl);
    this.audioIn.in = this.inN;
    this.audioOut.out = this.lvl;
    this.cvIn.cv = { target: this.amp.gain, scale: 1 };
  }

  apply(id, v, t, imm, tc) { if (id === 'level') put(this.lvl.gain, dbToGain(v), t, imm, tc ?? 0.25); }
}

// ═════════════════════════════════════════ E · LANGSAME MODULATION ══
export class LfoModule extends RackModule {
  static type = 'lfo';
  static title = 'LFO';
  static subtitle = 'Langsame Modulation';
  static params = [
    { id: 'rate', label: 'Rate', min: 0.01, max: 1, value: 0.06, log: true, fmt: 'hz' },
    { id: 'depth', label: 'Tiefe', min: 0, max: 1, value: 0.3, fmt: 'pct' },
    { id: 'offset', label: 'Offset', min: -1, max: 1, value: 0, fmt: 'sgn' },
    { id: 'shape', label: 'Form', min: 0, max: 2, value: 0, step: 1, choices: [[0, 'Sinus'], [1, 'Dreieck'], [2, 'Zufall (weich)']] },
  ];
  static jacks = [{ id: 'out', dir: 'out', sig: 'cv', label: 'CV' }];

  constructor(ctx, id, seed = 1) {
    super(ctx, id);
    this.sine = ctx.createOscillator(); this.sine.type = 'sine';
    this.tri = ctx.createOscillator(); this.tri.type = 'triangle';
    // Weicher Zufall: 64 Stützpunkte, kosinusinterpoliert, als Loop mit Wiedergaberate ∝ Rate
    const rng = createRng(seed * 7919);
    const pts = Array.from({ length: 64 }, () => rng() * 2 - 1);
    const seg = 512, len = seg * pts.length;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const k = Math.floor(i / seg), f = (i % seg) / seg, a = pts[k], b = pts[(k + 1) % pts.length];
      d[i] = a + (b - a) * (0.5 - 0.5 * Math.cos(Math.PI * f));
    }
    this.rnd = ctx.createBufferSource(); this.rnd.buffer = buf; this.rnd.loop = true;
    this.shapeG = [ctx.createGain(), ctx.createGain(), ctx.createGain()];
    this.depthG = ctx.createGain();
    this.offset = ctx.createConstantSource();
    this.outN = ctx.createGain();
    [this.sine, this.tri, this.rnd].forEach((s, i) => { s.connect(this.shapeG[i]); this.shapeG[i].connect(this.depthG); });
    this.depthG.connect(this.outN); this.offset.connect(this.outN);
    this.src(this.sine); this.src(this.tri); this.src(this.rnd); this.src(this.offset);
    this.audioOut.out = this.outN;
  }

  apply(id, v, t, imm, tc) {
    if (id === 'rate') {
      put(this.sine.frequency, v, t, imm); put(this.tri.frequency, v, t, imm);
      put(this.rnd.playbackRate, (2 * v) / (this.ctx.sampleRate / 512), t, imm);
    } else if (id === 'depth') put(this.depthG.gain, v, t, imm, tc ?? 0.3);
    else if (id === 'offset') put(this.offset.offset, v, t, imm, 0.3);
    else if (id === 'shape') this.shapeG.forEach((g, i) => put(g.gain, i === Math.round(v) ? 1 : 0, t, imm, 0.2));
  }
}

// ═════════════════════════════════════════ F · ENSEMBLE / CHORUS ══
export class ChorusModule extends RackModule {
  static type = 'chorus';
  static title = 'ENSEMBLE';
  static subtitle = 'Breites, langsames Chorus';
  static params = [
    { id: 'rate', label: 'Rate', min: 0.03, max: 0.6, value: 0.13, log: true, fmt: 'hz' },
    { id: 'depth', label: 'Tiefe', min: 0.2, max: 4, value: 1.4, fmt: 'ms' },
    { id: 'mix', label: 'Anteil', min: 0, max: 0.6, value: 0.3, fmt: 'pct' },
  ];
  static jacks = [
    { id: 'in', dir: 'in', sig: 'audio', label: 'AUDIO' },
    { id: 'moveCv', dir: 'in', sig: 'cv', label: 'MOVE CV' },
    { id: 'out', dir: 'out', sig: 'audio', label: 'AUDIO' },
  ];

  constructor(ctx, id) {
    super(ctx, id);
    this.inN = ctx.createGain();
    this.dry = ctx.createGain();
    this.wet = ctx.createGain();
    this.outN = ctx.createGain();
    // Wet-Pfad aus Mono-Summe → bessere Monokompatibilität des Dry-Signals
    const mono = ctx.createGain();
    mono.channelCount = 1; mono.channelCountMode = 'explicit';
    this.inN.connect(this.dry); this.dry.connect(this.outN);
    this.inN.connect(mono);
    this.moveN = ctx.createGain(); this.moveN.gain.value = 0.003;   // 1.0 CV = 3 ms
    const base = [0.017, 0.023, 0.029], pans = [-0.85, 0, 0.85], rateF = [1, 0.81, 1.23], depF = [1, 0.85, 1.1];
    this.taps = base.map((b, k) => {
      const d = ctx.createDelay(0.1); d.delayTime.value = b;
      const lfo = ctx.createOscillator(); lfo.type = 'sine';
      const mg = ctx.createGain();
      const pn = ctx.createStereoPanner(); pn.pan.value = pans[k];
      lfo.connect(mg); mg.connect(d.delayTime);
      this.moveN.connect(mg.gain);
      mono.connect(d); d.connect(pn); pn.connect(this.wet);
      this.src(lfo);
      return { lfo, mg, rateF: rateF[k], depF: depF[k] };
    });
    this.wet.connect(this.outN);
    this.audioIn.in = this.inN;
    this.audioOut.out = this.outN;
    this.cvIn.moveCv = { target: this.moveN, scale: 1 };
  }

  apply(id, v, t, imm, tc) {
    if (id === 'rate') this.taps.forEach((x) => put(x.lfo.frequency, v * x.rateF, t, imm, 0.3));
    else if (id === 'depth') this.taps.forEach((x) => put(x.mg.gain, (v / 1000) * x.depF, t, imm, tc ?? 0.3));
    else if (id === 'mix') {
      put(this.dry.gain, Math.cos(v * Math.PI / 2), t, imm, tc ?? 0.2);
      put(this.wet.gain, Math.sin(v * Math.PI / 2) * 0.8, t, imm, tc ?? 0.2);
    }
  }
}

// ═════════════════════════════════════════ H · DUNKLER STEREOHALL ══
export class ReverbModule extends RackModule {
  static type = 'reverb';
  static title = 'DUNKLER HALL';
  static subtitle = 'Faltungshall · Send';
  static params = [
    { id: 'decay', label: 'Nachhall', min: 1, max: 10, value: 5.5, fmt: 's' },
    { id: 'damp', label: 'Dämpfung', min: 0, max: 1, value: 0.6, fmt: 'pct' },
    { id: 'predelay', label: 'Predelay', min: 0, max: 0.25, value: 0.045, fmt: 's' },
    { id: 'tone', label: 'Höhen', min: 800, max: 9000, value: 2600, log: true, fmt: 'hz' },
    { id: 'send', label: 'Anteil', min: 0, max: 1, value: 0.28, fmt: 'pct' },
  ];
  static jacks = [
    { id: 'in', dir: 'in', sig: 'audio', label: 'SEND' },
    { id: 'sendCv', dir: 'in', sig: 'cv', label: 'SEND CV' },
    { id: 'out', dir: 'out', sig: 'audio', label: 'RETURN' },
  ];

  constructor(ctx, id) {
    super(ctx, id);
    this.inN = ctx.createGain();
    this.hp = ctx.createBiquadFilter(); this.hp.type = 'highpass'; this.hp.frequency.value = 150;   // kontrollierter Bass im Hall
    this.sendG = ctx.createGain();
    this.pre = ctx.createDelay(0.5);
    this.toneF = ctx.createBiquadFilter(); this.toneF.type = 'lowpass'; this.toneF.Q.value = 0;
    this.outN = ctx.createGain();
    this.inN.connect(this.hp); this.hp.connect(this.sendG); this.sendG.connect(this.pre);
    this.toneF.connect(this.outN);
    this.conv = null; this.convG = null; this.irTimer = null; this.irSeed = 1;
    this.audioIn.in = this.inN;
    this.audioOut.out = this.outN;
    this.cvIn.sendCv = { target: this.sendG.gain, scale: 1 };
  }

  boot(state) {
    const u = super.boot(state);
    this.buildIR(true);
    return u;
  }

  buildIR(immediate = false) {
    clearTimeout(this.irTimer);
    const run = () => {
      const ctx = this.ctx, decay = this.values.decay, damp = this.values.damp, sr = ctx.sampleRate;
      const len = Math.floor(sr * Math.min(12, decay * 1.15 + 0.2));
      const buf = ctx.createBuffer(2, len, sr);
      const rng = createRng(1000 + this.irSeed);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        let lp = 0;
        for (let i = 0; i < len; i++) {
          const t = i / sr;
          const env = Math.exp((-6.9 * t) / decay) * Math.min(1, t / 0.02);
          const a = Math.max(0.03, 1 - damp * Math.min(1, t / (decay * 0.5)) * 0.97);   // Höhen sterben zuerst
          lp += a * ((rng() * 2 - 1) - lp);
          d[i] = lp * env;
        }
      }
      const conv = ctx.createConvolver(); conv.normalize = true; conv.buffer = buf;
      const g = ctx.createGain(); g.gain.value = 0;
      this.pre.connect(conv); conv.connect(g); g.connect(this.toneF);
      g.gain.setTargetAtTime(1, ctx.currentTime, 0.15);
      if (this.conv) {
        const oc = this.conv, og = this.convG;
        og.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
        setTimeout(() => { try { this.pre.disconnect(oc); oc.disconnect(); og.disconnect(); } catch { /* ignore */ } }, 1500);
      }
      this.conv = conv; this.convG = g;
    };
    if (immediate) run(); else this.irTimer = setTimeout(run, 250);
  }

  apply(id, v, t, imm, tc) {
    if (id === 'predelay') put(this.pre.delayTime, v, t, imm, 0.1);
    else if (id === 'tone') put(this.toneF.frequency, v, t, imm, tc ?? 0.3);
    else if (id === 'send') put(this.sendG.gain, v * 0.8, t, imm, tc ?? 0.25);
    else if ((id === 'decay' || id === 'damp') && this.conv && !imm) this.buildIR();
  }

  destroy() {
    clearTimeout(this.irTimer);
    super.destroy();
  }
}

// ═════════════════════════════════════════ I · OPTIONALER BASS ══
export class BassModule extends RackModule {
  static type = 'bass';
  static title = 'BASS';
  static subtitle = 'Sinus / Dreieck · optional';
  static params = [
    { id: 'wave', label: 'Welle', min: 0, max: 1, value: 0, step: 1, choices: [[0, 'Sinus'], [1, 'Dreieck']] },
    { id: 'glide', label: 'Glide', min: 0, max: 3, value: 1.2, fmt: 's' },
    { id: 'attack', label: 'Attack', min: 0.2, max: 8, value: 3, fmt: 's' },
    { id: 'release', label: 'Release', min: 0.5, max: 10, value: 5, fmt: 's' },
    { id: 'register', label: 'Register', min: -12, max: 12, value: 0, step: 12, fmt: 'st', choices: [[-12, '−1 Okt'], [0, 'Original'], [12, '+1 Okt']] },
    { id: 'level', label: 'Pegel', min: 0, max: 1, value: 0.8, fmt: 'pct' },
  ];
  static jacks = [
    { id: 'pitchIn', dir: 'in', sig: 'pitch', label: 'ROOT' },
    { id: 'gateIn', dir: 'in', sig: 'gate', label: 'GATE' },
    { id: 'out', dir: 'out', sig: 'audio', label: 'AUDIO' },
  ];

  constructor(ctx, id) {
    super(ctx, id);
    this.osc = ctx.createOscillator();
    this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 260; this.lp.Q.value = 0;
    this.env = ctx.createGain(); this.env.gain.value = 0;
    this.lvl = ctx.createGain();
    this.osc.connect(this.lp); this.lp.connect(this.env); this.env.connect(this.lvl);
    this.src(this.osc);
    this.audioOut.out = this.lvl;
    this.note = 35; this.primed = false;
  }

  /** Grundton in die tiefe Bass-Lage falten (E1…Dis3) */
  fold(n) { let m = n; while (m >= 40) m -= 12; while (m < 28) m += 12; return m; }

  retune(t, first = false) {
    const f = midiToFreq(this.fold(this.note) + this.values.register);
    if (first) this.osc.frequency.setValueAtTime(f, t);
    else this.osc.frequency.setTargetAtTime(f, t, Math.max(0.01, this.values.glide / 3));
  }

  onEvent(port, ev) {
    const t = Math.max(ev.time, this.ctx.currentTime);
    if (port === 'pitchIn' && ev.kind === 'pitch') {
      this.note = ev.notes[0];
      this.retune(t, !this.primed);
      this.primed = true;
    } else if (port === 'gateIn' && ev.kind === 'gate') {
      const p = this.env.gain;
      if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t); else p.cancelScheduledValues(t);
      p.setTargetAtTime(ev.open ? 1 : 0, t, (ev.open ? this.values.attack : this.values.release) / 3);
    }
  }

  apply(id, v, t, imm, tc) {
    if (id === 'wave') this.osc.type = v >= 0.5 ? 'triangle' : 'sine';
    else if (id === 'level') put(this.lvl.gain, v * 0.9, t, imm, tc ?? 0.2);
    else if (id === 'register' && this.primed && !imm) this.retune(t);
  }
}

// ═════════════════════════════════════════ OPTIONALE TEXTUR ══
export class TextureModule extends RackModule {
  static type = 'texture';
  static title = 'TEXTUR';
  static subtitle = 'Rauschfläche · optional';
  static params = [
    { id: 'tone', label: 'Klang', min: 200, max: 4000, value: 900, log: true, fmt: 'hz' },
    { id: 'level', label: 'Pegel', min: 0, max: 1, value: 0.6, fmt: 'pct' },
  ];
  static jacks = [{ id: 'out', dir: 'out', sig: 'audio', label: 'AUDIO' }];

  constructor(ctx, id) {
    super(ctx, id);
    const pink = getNoiseBuffers(ctx).pink;
    const merger = ctx.createChannelMerger(2);
    [0, 1].forEach((ch) => {
      const s = ctx.createBufferSource(); s.buffer = pink; s.loop = true; s.loopStart = ch * 0.77;
      const g = ctx.createGain(); g.gain.value = 1;
      s.connect(g); g.connect(merger, 0, ch);
      this.nodes.push(s); s.start(0, ch * 0.77);
    });
    this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.Q.value = 0;
    this.hp = ctx.createBiquadFilter(); this.hp.type = 'highpass'; this.hp.frequency.value = 140;
    this.lvl = ctx.createGain();
    merger.connect(this.lp); this.lp.connect(this.hp); this.hp.connect(this.lvl);
    this.audioOut.out = this.lvl;
  }

  apply(id, v, t, imm, tc) {
    if (id === 'tone') put(this.lp.frequency, v, t, imm, tc ?? 0.3);
    else if (id === 'level') put(this.lvl.gain, v * 0.5, t, imm, tc ?? 0.2);
  }
}

// ═════════════════════════════════════════ J · MIXER / AUSGANG ══
export class MixerModule extends RackModule {
  static type = 'mixer';
  static title = 'MIXER';
  static subtitle = 'Ausgang · Schutzbegrenzer';
  static params = [
    { id: 'core', label: 'Kernklang', min: 0, max: 1.2, value: 0.85, fmt: 'pct' },
    { id: 'tex', label: 'Textur', min: 0, max: 1.2, value: 0, fmt: 'pct' },
    { id: 'rev', label: 'Hall', min: 0, max: 1.2, value: 0.9, fmt: 'pct' },
    { id: 'bass', label: 'Bass', min: -60, max: 0, value: -14, fmt: 'dbl' },
    { id: 'bassMute', label: 'Bass stumm', min: 0, max: 1, value: 1, step: 1, toggle: true },
    { id: 'master', label: 'Master', min: 0, max: 1, value: 0.8, fmt: 'pct' },
    { id: 'protect', label: 'Schutz', min: 0, max: 1, value: 1, step: 1, toggle: true },
  ];
  static jacks = [
    { id: 'coreIn', dir: 'in', sig: 'audio', label: 'KERN' },
    { id: 'texIn', dir: 'in', sig: 'audio', label: 'TEXTUR' },
    { id: 'revIn', dir: 'in', sig: 'audio', label: 'HALL' },
    { id: 'bassIn', dir: 'in', sig: 'audio', label: 'BASS' },
    { id: 'out', dir: 'out', sig: 'audio', label: 'MASTER → SYSTEM', fixed: true },
  ];

  constructor(ctx, id) {
    super(ctx, id);
    const ch = () => { const g = ctx.createGain(); g.channelCount = 2; g.channelCountMode = 'explicit'; g.channelInterpretation = 'speakers'; return g; };
    this.chan = { core: ch(), tex: ch(), rev: ch(), bass: ch() };
    this.sum = ctx.createGain();
    this.masterG = ctx.createGain();
    this.limiter = ctx.createDynamicsCompressor();
    this.outN = ctx.createGain();
    Object.values(this.chan).forEach((c) => c.connect(this.sum));
    this.sum.connect(this.masterG); this.masterG.connect(this.limiter); this.limiter.connect(this.outN);
    // Pegelabgriff vor dem Begrenzer
    const split = ctx.createChannelSplitter(2);
    this.anL = ctx.createAnalyser(); this.anR = ctx.createAnalyser();
    this.anL.fftSize = this.anR.fftSize = 2048;
    this.masterG.connect(split); split.connect(this.anL, 0); split.connect(this.anR, 1);
    this.bufL = new Float32Array(2048); this.bufR = new Float32Array(2048);
    this.audioIn.coreIn = this.chan.core; this.audioIn.texIn = this.chan.tex;
    this.audioIn.revIn = this.chan.rev; this.audioIn.bassIn = this.chan.bass;
    this.audioOut.out = this.outN;
    this.clipHold = 0;
  }

  apply(id, v, t, imm, tc) {
    const V = this.values;
    if (id === 'core' || id === 'tex' || id === 'rev') put(this.chan[id].gain, v, t, imm, 0.1);
    else if (id === 'bass' || id === 'bassMute') put(this.chan.bass.gain, V.bassMute ? 0 : dbToGain(V.bass), t, imm, tc ?? 0.25);
    else if (id === 'master') put(this.masterG.gain, v, t, imm, 0.05);
    else if (id === 'protect') {
      const L = this.limiter, on = v >= 0.5;
      put(L.threshold, on ? -3 : 0, t, imm, 0.02); put(L.ratio, on ? 12 : 1, t, imm, 0.02);
      put(L.knee, on ? 6 : 0, t, imm, 0.02); L.attack.value = 0.006; L.release.value = 0.35;
    }
  }

  /** Spitzenpegel (linear) vor dem Begrenzer */
  meter() {
    this.anL.getFloatTimeDomainData(this.bufL); this.anR.getFloatTimeDomainData(this.bufR);
    let pl = 0, pr = 0;
    for (let i = 0; i < 2048; i++) { pl = Math.max(pl, Math.abs(this.bufL[i])); pr = Math.max(pr, Math.abs(this.bufR[i])); }
    const now = performance.now();
    if (Math.max(pl, pr) >= 0.95) this.clipHold = now + 1500;
    return { l: pl, r: pr, clip: now < this.clipHold, reduction: this.limiter.reduction };
  }
}

export const MODULE_TYPES = Object.fromEntries([
  HarmonyModule, EnsembleOscModule, FilterModule, SaturationModule, EnvelopeModule, VcaModule,
  LfoModule, ChorusModule, ReverbModule, BassModule, TextureModule, MixerModule,
].map((M) => [M.type, M]));

