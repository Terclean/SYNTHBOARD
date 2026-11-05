// SYNTHBOARD – Chord Glide Modul
// Harmonischer Akkord-Sequencer mit polyphonem Smooth Voice Leading,
// gleitenden Tonhöhenkurven (Portamento) und integriertem warmen Ambient-Pad.

import { SourceBase, midiToFreq, midiToName, NOTE_NAMES, uid } from './base.js';

// ── Harmonielehre: Akkordtypen & Intervalle ──
export const CHORD_TYPES = {
  maj:   { name: 'Dur', label: 'Dur (maj)', intervals: [0, 4, 7] },
  min:   { name: 'Moll', label: 'Moll (min)', intervals: [0, 3, 7] },
  sus2:  { name: 'sus2', label: 'sus2', intervals: [0, 2, 7] },
  sus4:  { name: 'sus4', label: 'sus4', intervals: [0, 5, 7] },
  dim:   { name: 'dim', label: 'Vermindert (dim)', intervals: [0, 3, 6] },
  aug:   { name: 'aug', label: 'Übermäßig (aug)', intervals: [0, 4, 8] },
  maj7:  { name: 'maj7', label: 'Dur 7 (maj7)', intervals: [0, 4, 7, 11] },
  m7:    { name: 'm7', label: 'Moll 7 (m7)', intervals: [0, 3, 7, 10] },
  dom7:  { name: 'dom7', label: 'Dominant 7', intervals: [0, 4, 7, 10] },
  maj9:  { name: 'maj9', label: 'Dur 9 (maj9)', intervals: [0, 4, 7, 11, 14] },
  m9:    { name: 'm9', label: 'Moll 9 (m9)', intervals: [0, 3, 7, 10, 14] },
  add9:  { name: 'add9', label: 'add9', intervals: [0, 4, 7, 14] },
  dom9:  { name: 'dom9', label: 'Dominant 9', intervals: [0, 4, 7, 10, 14] },
};

// ── Voreingestellte Ambient-Harmoniefolgen ──
export const CHORD_PRESETS = {
  warm: {
    name: 'Warm Ambient',
    description: 'Cmaj7 → Am7 → Fmaj7 → Gsus4',
    steps: [
      { root: 0, type: 'maj7', bars: 1 }, // Cmaj7
      { root: 9, type: 'm7',   bars: 1 }, // Am7
      { root: 5, type: 'maj7', bars: 1 }, // Fmaj7
      { root: 7, type: 'sus4', bars: 1 }, // Gsus4
    ],
  },
  night: {
    name: 'Night Drift',
    description: 'Dm9 → G9 → Cmaj9 → Am7',
    steps: [
      { root: 2, type: 'm9',   bars: 1 }, // Dm9
      { root: 7, type: 'dom9', bars: 1 }, // G9
      { root: 0, type: 'maj9', bars: 1 }, // Cmaj9
      { root: 9, type: 'm7',   bars: 1 }, // Am7
    ],
  },
  cinematic: {
    name: 'Cinematic',
    description: 'Dm → B♭maj7 → F → Csus4',
    steps: [
      { root: 2,  type: 'min',  bars: 1 }, // Dm
      { root: 10, type: 'maj7', bars: 1 }, // B♭maj7
      { root: 5,  type: 'maj',  bars: 1 }, // F
      { root: 0,  type: 'sus4', bars: 1 }, // Csus4
    ],
  },
  floating: {
    name: 'Floating',
    description: 'Cmaj9 → Em7 → Am9 → Fmaj7',
    steps: [
      { root: 0, type: 'maj9', bars: 1 }, // Cmaj9
      { root: 4, type: 'm7',   bars: 1 }, // Em7
      { root: 9, type: 'm9',   bars: 1 }, // Am9
      { root: 5, type: 'maj7', bars: 1 }, // Fmaj7
    ],
  },
};

// Farbpalette für bis zu 6 unabhängige Stimmlinien
export const VOICE_COLORS = [
  '#f43f5e', // Bass (Rose)
  '#fbbf24', // Tenor (Amber)
  '#34d399', // Alt 1 (Emerald)
  '#38bdf8', // Alt 2 (Cyan)
  '#a855f7', // Sopran 1 (Violett)
  '#ec4899', // Sopran 2 (Pink)
];

/**
 * Berechnet für einen Akkord und eine vorherige Stimmführung die optimale
 * Verteilung auf N Stimmen mit minimaler Gesamtbewegung und Haltung gemeinsamer Töne.
 */
export function calculateVoicing(rootPc, chordTypeKey, numVoices = 5, prevVoicing = null, smooth = true, baseOctave = 3) {
  const chordDef = CHORD_TYPES[chordTypeKey] || CHORD_TYPES.maj;
  const pcs = chordDef.intervals.map((iv) => (rootPc + iv) % 12);
  const uniquePcs = [...new Set(pcs)];

  // Bass-Stimme: Grundton im Register Oktave 2 (MIDI 36..47)
  const bassMidi = rootPc + 36; // z.B. C2 = 36

  const numUpper = numVoices - 1;

  // Ohne Smooth Voice Leading: Standard-Aufbau in Terz-/Quartschichtung
  if (!smooth || !prevVoicing || prevVoicing.length !== numVoices) {
    const upper = [];
    let oct = baseOctave;
    let idx = 0;
    while (upper.length < numUpper) {
      const pc = uniquePcs[idx % uniquePcs.length];
      let m = pc + (oct + 1) * 12;
      while (upper.length > 0 && m <= upper[upper.length - 1]) m += 12;
      upper.push(m);
      idx++;
      if (idx % uniquePcs.length === 0) oct++;
    }
    return [bassMidi, ...upper];
  }

  // Smooth Voice Leading:
  // prevVoicing = [bass, upper1, upper2, ...]
  const prevUpper = prevVoicing.slice(1);

  // Kandidaten-Pitches für alle Akkordtöne im Register Oktave 3 bis 5 (MIDI 48..79)
  const candidates = [];
  for (const pc of uniquePcs) {
    for (let oct = 3; oct <= 5; oct++) {
      const m = pc + (oct + 1) * 12;
      if (m >= 48 && m <= 81) candidates.push(m);
    }
  }

  // Jeder vorherigen Stimme die am nächsten liegende Note zuordnen
  // Hoher Bonus für Haltung exakter gemeinsamer Töne!
  const assigned = [];
  const usedPcs = new Set();

  for (let i = 0; i < numUpper; i++) {
    const prev = prevUpper[i];
    let best = null;
    let bestScore = Infinity;

    for (const cand of candidates) {
      const candPc = cand % 12;
      let cost = Math.abs(cand - prev);

      // Bevorzuge Akkordtöne, die noch in keiner anderen Stimme liegen
      if (!usedPcs.has(candPc)) cost -= 1.8;
      // Großer Bonus für exakt gehaltene Note (Common Tone Retention)
      if (cand === prev) cost -= 4.5;

      if (cost < bestScore) {
        bestScore = cost;
        best = cand;
      }
    }

    assigned.push(best);
    usedPcs.add(best % 12);
  }

  // Stimmen aufsteigend sortieren, um überkreuzte Stimmen zu vermeiden
  assigned.sort((a, b) => a - b);

  // Spreizung sicherstellen, falls zwei Stimmen auf denselben Ton gefallen sind
  for (let i = 1; i < assigned.length; i++) {
    if (assigned[i] <= assigned[i - 1]) {
      const higher = candidates.filter((c) => c > assigned[i - 1]).sort((a, b) => a - b)[0];
      if (higher) assigned[i] = higher;
    }
  }

  return [bassMidi, ...assigned];
}

export class ChordGlideModule extends SourceBase {
  static type = 'chord_glide';
  static title = 'Chord Glide';
  static icon = '≋';
  static color = '#8b5cf6';
  static description = 'Harmonischer Akkord-Sequencer mit polyphonem Smooth Voice Leading, gleitenden Tonhöhen und integriertem Ambient-Pad';

  static params = [
    { id: 'level', label: 'Level', min: 0, max: 1, value: 0.75, fmt: 'pct' },
    { id: 'glide', label: 'Glide', min: 0, max: 5.0, value: 1.2, log: true, fmt: 's' },
    { id: 'cutoff', label: 'Klangfarbe', min: 150, max: 12000, value: 2400, log: true, fmt: 'hz' },
    { id: 'attack', label: 'Attack', min: 0.02, max: 4.0, value: 0.45, log: true, fmt: 's' },
    { id: 'release', label: 'Release', min: 0.1, max: 8.0, value: 2.2, log: true, fmt: 's' },
    { id: 'detune', label: 'Schwebung', min: 0, max: 30, value: 10, fmt: 'num' },
  ];

  static options = [
    { id: 'voiceLeading', label: 'Stimmführung', choices: [[1, 'Smooth (Minimal)'], [0, 'Grundstellung']], value: 1 },
    { id: 'voiceCount', label: 'Stimmen', choices: [[4, '4 Stimmen'], [5, '5 Stimmen'], [6, '6 Stimmen']], value: 5 },
    { id: 'clockDiv', label: 'Raster', choices: [[16, '1/16 Clock'], [4, '1/4 Clock'], [1, '1 Bar Clock']], value: 16 },
  ];

  static jacks = [
    { id: 'clockIn', type: 'in', signal: 'clock', label: 'CLOCK' },
    { id: 'resetIn', type: 'in', signal: 'gate', label: 'RESET' },
    { id: 'nextTrig', type: 'in', signal: 'gate', label: 'NEXT' },
    { id: 'transposeCv', type: 'in', signal: 'pitch', label: 'TRANSP' },
    { id: 'glideCv', type: 'in', signal: 'mod', label: 'GLIDE CV' },
    { id: 'vcaCv', type: 'in', signal: 'mod', label: 'VCA CV' },
    { id: 'panCv', type: 'in', signal: 'mod', label: 'PAN CV' },
    { id: 'pitchOut', type: 'out', signal: 'pitch', label: 'POLY PITCH' },
    { id: 'rootOut', type: 'out', signal: 'pitch', label: 'ROOT PITCH' },
    { id: 'gateOut', type: 'out', signal: 'gate', label: 'CHORD TRIG' },
  ];

  constructor(ctx, state = {}) {
    super(ctx, state);

    // Gespeicherte Akkordfolge oder Standardpreset „Warm Ambient“
    const savedExtra = state.extra || {};
    this.presetKey = savedExtra.presetKey || 'warm';
    this.steps = Array.isArray(savedExtra.steps) && savedExtra.steps.length
      ? savedExtra.steps.map((s) => ({ ...s }))
      : CHORD_PRESETS.warm.steps.map((s) => ({ ...s }));

    this.currentStep = 0;
    this.running = savedExtra.running ?? true;
    this.voiceLeading = savedExtra.voiceLeading ?? 1;
    this.voiceCount = savedExtra.voiceCount ?? 5;
    this.strum = savedExtra.strum ?? 0; // 0..150 ms
    this.retrigger = savedExtra.retrigger ?? false;
    this.baseOctave = savedExtra.baseOctave ?? 3;
    this.liveMode = savedExtra.liveMode ?? false;
    this.drawerOpen = savedExtra.drawerOpen ?? false;

    // Modulations-Offsets
    this.transposeOffset = 0; // aus transposeCv
    this.glideModScale = 1.0; // aus glideCv

    // Interner Master-Filter & VCA für den Pad-Klang
    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.Q.value = 1.2;
    this.padLevel = ctx.createGain();
    this.padFilter.connect(this.padLevel);
    this.padLevel.connect(this.output);

    // 6 polyphone Stimmen aufbauen (jeweils 2 Oszillatoren + Sub + Filter)
    this.voices = [];
    this.maxVoices = 6;
    for (let i = 0; i < this.maxVoices; i++) {
      const v = {
        osc1: ctx.createOscillator(),
        osc2: ctx.createOscillator(),
        sub: ctx.createOscillator(),
        subGain: ctx.createGain(),
        gain: ctx.createGain(),
        currentFreq: 440,
        active: false,
      };

      v.osc1.type = 'sawtooth';
      v.osc2.type = 'triangle';
      v.sub.type = 'sine';
      v.subGain.gain.value = i === 0 ? 0.35 : 0.0; // Bass-Stimme bekommt warmen Sub-Oszillator

      v.gain.gain.value = 0;

      v.osc1.connect(v.gain);
      v.osc2.connect(v.gain);
      v.sub.connect(v.subGain);
      v.subGain.connect(v.gain);
      v.gain.connect(this.padFilter);

      [v.osc1, v.osc2, v.sub].forEach((node) => this.start(node));
      this.voices.push(v);
    }

    this.initValues(state);

    // Berechne alle Voicings für die gesamte Folge vorab
    this.computedVoicings = [];
    this.recalculateAllVoicings();

    // Clock-Zähler
    this.clockTicks = 0;
    this.stepStartTime = ctx.currentTime;
    this.stepDurationSec = 2.0;

    // Interner Ticker für Standalone-Wiedergabe (ohne externes Clock-Kabel)
    this.nextInternalStepTime = ctx.currentTime + 0.1;
    this.internalTimer = setInterval(() => this.tickInternal(), 30);

    // Initialen Akkord triggern
    setTimeout(() => {
      if (this.enabled) this.triggerCurrentStep(this.ctx.currentTime);
    }, 40);
  }

  applyParam(id, val) {
    if (id === 'cutoff') {
      this.ramp(this.padFilter.frequency, val, 0.04);
    } else if (id === 'level') {
      this.ramp(this.padLevel.gain, val, 0.03);
    } else if (id === 'detune') {
      this.voices.forEach((v) => {
        this.ramp(v.osc1.detune, -val * 0.5, 0.05);
        this.ramp(v.osc2.detune, val * 0.8, 0.05);
      });
    } else if (id === 'voiceLeading') {
      this.voiceLeading = Number(val);
      this.recalculateAllVoicings();
      this.triggerCurrentStep(this.ctx.currentTime);
      this.refreshVisualizer?.();
    } else if (id === 'voiceCount') {
      this.voiceCount = Number(val);
      this.recalculateAllVoicings();
      this.triggerCurrentStep(this.ctx.currentTime);
      this.refreshVisualizer?.();
    }
  }

  /** Berechnet die Voicings aller Akkordschritte in der Reihe */
  recalculateAllVoicings() {
    this.computedVoicings = [];
    let prev = null;
    const numV = Math.min(this.maxVoices, Math.max(4, this.voiceCount || 5));
    const smooth = !!this.voiceLeading;

    for (let i = 0; i < this.steps.length; i++) {
      const s = this.steps[i];
      const v = calculateVoicing(s.root, s.type, numV, prev, smooth, this.baseOctave);
      this.computedVoicings.push(v);
      prev = v;
    }
  }

  /** Triggert den aktuellen Schritt und leitet Poly-Pitch, Bass-Pitch & Gate weiter */
  triggerCurrentStep(time = this.ctx.currentTime, isManualPreview = false) {
    if (!this.enabled || !this.steps.length) return;

    const idx = ((this.currentStep % this.steps.length) + this.steps.length) % this.steps.length;
    const step = this.steps[idx];
    const voicing = this.computedVoicings[idx] || calculateVoicing(step.root, step.type, this.voiceCount, null, false, this.baseOctave);

    const baseGlide = this.values.glide ?? 1.2;
    const effectiveGlide = Math.max(0.005, baseGlide * this.glideModScale);
    const attack = this.values.attack ?? 0.45;
    const level = this.values.level ?? 0.75;
    const strumSec = Math.max(0, (this.strum || 0) / 1000);

    // Audio-Glide auf alle Stimmen anwenden
    this.voices.forEach((v, i) => {
      const voiceTime = time + i * strumSec;

      if (i < voicing.length) {
        const rawMidi = voicing[i] + this.transposeOffset;
        const targetFreq = midiToFreq(rawMidi);
        const voiceGainVal = (i === 0 ? 0.35 : 0.22) * level;

        v.osc1.frequency.cancelScheduledValues(voiceTime);
        v.osc2.frequency.cancelScheduledValues(voiceTime);
        v.sub.frequency.cancelScheduledValues(voiceTime);

        if (!v.active) {
          // Stimme neu anwerfen
          v.osc1.frequency.setValueAtTime(targetFreq, voiceTime);
          v.osc2.frequency.setValueAtTime(targetFreq, voiceTime);
          v.sub.frequency.setValueAtTime(targetFreq / 2, voiceTime);
          v.gain.gain.cancelScheduledValues(voiceTime);
          v.gain.gain.setValueAtTime(0, voiceTime);
          v.gain.gain.linearRampToValueAtTime(voiceGainVal, voiceTime + attack);
        } else {
          // Gleiten zur neuen Frequenz
          const startF = v.currentFreq || targetFreq;
          v.osc1.frequency.setValueAtTime(startF, voiceTime);
          v.osc2.frequency.setValueAtTime(startF, voiceTime);
          v.sub.frequency.setValueAtTime(startF / 2, voiceTime);

          if (effectiveGlide > 0.008 && Math.abs(startF - targetFreq) > 0.5) {
            v.osc1.frequency.exponentialRampToValueAtTime(Math.max(20, targetFreq), voiceTime + effectiveGlide);
            v.osc2.frequency.exponentialRampToValueAtTime(Math.max(20, targetFreq), voiceTime + effectiveGlide);
            v.sub.frequency.exponentialRampToValueAtTime(Math.max(10, targetFreq / 2), voiceTime + effectiveGlide);
          } else {
            v.osc1.frequency.setValueAtTime(targetFreq, voiceTime);
            v.osc2.frequency.setValueAtTime(targetFreq, voiceTime);
            v.sub.frequency.setValueAtTime(targetFreq / 2, voiceTime);
          }

          if (this.retrigger) {
            v.gain.gain.cancelScheduledValues(voiceTime);
            v.gain.gain.setValueAtTime(voiceGainVal * 0.15, voiceTime);
            v.gain.gain.linearRampToValueAtTime(voiceGainVal, voiceTime + Math.max(0.04, attack));
          } else {
            v.gain.gain.setTargetAtTime(voiceGainVal, voiceTime, 0.04);
          }
        }

        v.currentFreq = targetFreq;
        v.active = true;
      } else {
        // Nicht genutzte Stimmen ausblenden
        v.gain.gain.setTargetAtTime(0, voiceTime, 0.08);
        v.active = false;
      }
    });

    this.stepStartTime = time;
    const tempo = this.getBpm();
    this.stepDurationSec = (60 / tempo) * 4 * (step.bars || 1);

    // Weiterleitung über das modulare Patchkabel-System
    const transVoicing = voicing.map((m) => m + this.transposeOffset);
    const rootMidi = step.root + 36 + this.transposeOffset;

    this.emitPitch('pitchOut', time, transVoicing, 0.9, this.stepDurationSec);
    this.emitPitch('rootOut', time, rootMidi, 0.9, this.stepDurationSec);
    this.emitTrigger('gateOut', time, 0.9, 0.15);

    // UI-Aktualisierung (Karten-Highlight & Visualizer)
    const delayMs = Math.max(0, (time - this.ctx.currentTime) * 1000);
    setTimeout(() => {
      this.updateActiveCardUi?.(idx);
    }, delayMs);
  }

  getBpm() {
    const clock = this.engine?.controls?.find((m) => m.meta.type === 'master_clock');
    return clock?.values?.tempo || 100;
  }

  // ── Modulare Patch-Eingänge ──
  onClock(portId, time, _tick) {
    if (portId !== 'clockIn' || !this.enabled || !this.running) return;

    this.clockTicks++;
    const step = this.steps[this.currentStep] || this.steps[0];
    const div = Number(this.values.clockDiv || 16);
    // Ticks für diesen Schritt: Bei 16 Ticks pro Takt (1/16 Clock) entspricht 1 Bar = 16 Ticks
    const targetTicks = Math.max(1, Math.round((step.bars || 1) * div));

    if (this.clockTicks >= targetTicks) {
      this.clockTicks = 0;
      this.currentStep = (this.currentStep + 1) % this.steps.length;
      this.triggerCurrentStep(time);
    }
  }

  onTrigger(portId, time) {
    if (!this.enabled) return;
    if (portId === 'resetIn') {
      this.currentStep = 0;
      this.clockTicks = 0;
      this.triggerCurrentStep(time);
    } else if (portId === 'nextTrig') {
      this.currentStep = (this.currentStep + 1) % this.steps.length;
      this.clockTicks = 0;
      this.triggerCurrentStep(time);
    }
  }

  onPitch(portId, _time, midiNote) {
    if (portId === 'transposeCv') {
      const val = Array.isArray(midiNote) ? midiNote[0] : midiNote;
      // Normalisiere um C3 (48) als 0-Offset
      this.transposeOffset = Math.round(val - 48);
      this.triggerCurrentStep(this.ctx.currentTime);
    }
  }

  onModulation(portId, val) {
    if (this.handleSourceModulation(portId, val)) return;
    if (portId === 'glideCv') {
      this.glideModScale = Math.max(0.05, val * 2.0);
    }
  }

  tickInternal() {
    // Wenn ein externes Clock-Kabel angeschlossen ist, überstimmt dieses den internen Ticker
    if (this.patchSystem?.hasIncoming(this.id, 'clockIn')) return;
    if (!this.running || !this.enabled || !this.steps.length) return;

    const now = this.ctx.currentTime;
    if (this.nextInternalStepTime < now - 0.5) this.nextInternalStepTime = now + 0.05;

    while (this.nextInternalStepTime < now + 0.12) {
      this.triggerCurrentStep(this.nextInternalStepTime);
      const step = this.steps[this.currentStep] || this.steps[0];
      const tempo = this.getBpm();
      const dur = (60 / tempo) * 4 * (step.bars || 1);
      this.nextInternalStepTime += dur;
      this.currentStep = (this.currentStep + 1) % this.steps.length;
    }
  }

  stopVoices() {
    const t = this.ctx.currentTime;
    this.voices.forEach((v) => {
      v.gain.gain.cancelScheduledValues(t);
      v.gain.gain.setTargetAtTime(0, t, 0.08);
      v.active = false;
    });
  }

  destroy() {
    clearInterval(this.internalTimer);
    this.stopVoices();
    super.destroy();
  }

  // ── JSON-Speicherzustand ──
  getExtra() {
    return {
      presetKey: this.presetKey,
      steps: this.steps.map((s) => ({ ...s })),
      running: this.running,
      voiceLeading: this.voiceLeading,
      voiceCount: this.voiceCount,
      strum: this.strum,
      retrigger: this.retrigger,
      baseOctave: this.baseOctave,
      liveMode: this.liveMode,
      drawerOpen: this.drawerOpen,
    };
  }

  // ── UI-Rendering & Interaktiver Voice-Leading Visualizer ──
  renderExtra(el, helpers = {}) {
    const changed = helpers.changed || (() => {});

    el.innerHTML = `
      <div class="chord-glide-wrap">
        <!-- Obere Steuerleiste: Preset, Play/Stop & Toggles -->
        <div class="cg-bar">
          <div class="cg-bar-left">
            <select class="select select-sm cg-preset-sel" title="Ambient-Harmoniefolge wählen">
              <optgroup label="Ambient-Vorlagen">
                ${Object.entries(CHORD_PRESETS).map(([k, p]) => `<option value="${k}" ${this.presetKey === k ? 'selected' : ''}>${p.name}</option>`).join('')}
              </optgroup>
              <option value="custom" ${this.presetKey === 'custom' ? 'selected' : ''}>✎ Eigene Folge</option>
            </select>
            <button class="mini-btn cg-run-btn ${this.running ? 'active' : ''}">${this.running ? '■ Pause' : '▶ Play'}</button>
          </div>
          <div class="cg-bar-right">
            <button class="cg-toggle-chip cg-lead-toggle ${this.voiceLeading ? 'active' : ''}" title="Smooth Voice Leading (minimale Stimmbewegung)">✦ Stimmführung</button>
            <button class="cg-toggle-chip cg-live-toggle ${this.liveMode ? 'active' : ''}" title="Tastatur-Live-Modus [Tasten 1–8]">⌨ Live</button>
            <button class="cg-toggle-chip cg-more-toggle ${this.drawerOpen ? 'active' : ''}" title="Erweiterte Einstellungen">⚙ Mehr</button>
          </div>
        </div>

        <!-- Akkord-Karten (Akkordfolge) -->
        <div class="cg-cards-scroll">
          <div class="cg-cards-row"></div>
          <button class="cg-add-step-btn" title="Akkordschritt hinzufügen">＋ Akkord</button>
        </div>

        <!-- Interaktiver Voice Leading & Glide Canvas -->
        <div class="cg-canvas-box">
          <canvas class="cg-canvas" width="340" height="110"></canvas>
          <div class="cg-playhead"></div>
        </div>

        <!-- Aufklappbarer Einstellungsbereich -->
        <div class="cg-drawer ${this.drawerOpen ? 'open' : ''}">
          <div class="cg-drawer-grid">
            <label class="cg-field">
              <span>Stimmen:</span>
              <select class="select select-sm cg-voices-sel">
                <option value="4" ${this.voiceCount === 4 ? 'selected' : ''}>4 Stimmen</option>
                <option value="5" ${this.voiceCount === 5 ? 'selected' : ''}>5 Stimmen</option>
                <option value="6" ${this.voiceCount === 6 ? 'selected' : ''}>6 Stimmen</option>
              </select>
            </label>
            <label class="cg-field">
              <span>Strum:</span>
              <select class="select select-sm cg-strum-sel">
                <option value="0" ${this.strum === 0 ? 'selected' : ''}>0 ms (Exakt)</option>
                <option value="20" ${this.strum === 20 ? 'selected' : ''}>20 ms (Sanft)</option>
                <option value="50" ${this.strum === 50 ? 'selected' : ''}>50 ms (Harfe)</option>
                <option value="90" ${this.strum === 90 ? 'selected' : ''}>90 ms (Zupfen)</option>
              </select>
            </label>
            <label class="cg-field">
              <span>Retrigger:</span>
              <select class="select select-sm cg-retrigger-sel">
                <option value="0" ${!this.retrigger ? 'selected' : ''}>Aus (Gleitend)</option>
                <option value="1" ${this.retrigger ? 'selected' : ''}>An (Anschlag)</option>
              </select>
            </label>
            <label class="cg-field">
              <span>Oktave:</span>
              <select class="select select-sm cg-octave-sel">
                <option value="2" ${this.baseOctave === 2 ? 'selected' : ''}>Tief (C2)</option>
                <option value="3" ${this.baseOctave === 3 ? 'selected' : ''}>Mitte (C3)</option>
                <option value="4" ${this.baseOctave === 4 ? 'selected' : ''}>Hoch (C4)</option>
              </select>
            </label>
          </div>
        </div>
      </div>
    `;

    const cardsRow = el.querySelector('.cg-cards-row');
    const canvas = el.querySelector('.cg-canvas');
    const playhead = el.querySelector('.cg-playhead');
    const ctx2d = canvas.getContext('2d');

    // Rendert alle Akkord-Karten neu
    const renderCards = () => {
      cardsRow.innerHTML = this.steps.map((s, idx) => {
        const chordName = `${NOTE_NAMES[s.root]}${CHORD_TYPES[s.type]?.name || ''}`;
        return `
          <div class="cg-card ${idx === this.currentStep ? 'is-active' : ''}" data-idx="${idx}">
            <div class="cg-card-head">
              <span class="cg-card-num">#${idx + 1}</span>
              <div class="cg-card-acts">
                <button class="cg-mini-icon cg-dup-btn" title="Akkord duplizieren">⧉</button>
                ${this.steps.length > 2 ? '<button class="cg-mini-icon cg-del-btn" title="Akkord löschen">✕</button>' : ''}
              </div>
            </div>
            <div class="cg-card-title">${chordName}</div>
            <div class="cg-card-fields">
              <select class="select select-xs cg-root-sel" aria-label="Grundton">
                ${NOTE_NAMES.map((n, r) => `<option value="${r}" ${s.root === r ? 'selected' : ''}>${n}</option>`).join('')}
              </select>
              <select class="select select-xs cg-type-sel" aria-label="Akkordtyp">
                ${Object.entries(CHORD_TYPES).map(([k, t]) => `<option value="${k}" ${s.type === k ? 'selected' : ''}>${t.name}</option>`).join('')}
              </select>
              <select class="select select-xs cg-bars-sel" aria-label="Dauer in Takten">
                <option value="0.25" ${s.bars === 0.25 ? 'selected' : ''}>¼ Takt</option>
                <option value="0.5" ${s.bars === 0.5 ? 'selected' : ''}>½ Takt</option>
                <option value="1" ${s.bars === 1 || !s.bars ? 'selected' : ''}>1 Takt</option>
                <option value="2" ${s.bars === 2 ? 'selected' : ''}>2 Takte</option>
              </select>
            </div>
          </div>
        `;
      }).join('');

      // Event-Listener auf den Karten
      cardsRow.querySelectorAll('.cg-card').forEach((cardEl) => {
        const idx = Number(cardEl.dataset.idx);

        // Klick auf Karte: Vorhören & Sofort-Sprung
        cardEl.addEventListener('click', (e) => {
          if (e.target.closest('select') || e.target.closest('button')) return;
          this.currentStep = idx;
          this.clockTicks = 0;
          this.triggerCurrentStep(this.ctx.currentTime, true);
          drawVisualizer();
        });

        // Grundton ändern
        cardEl.querySelector('.cg-root-sel')?.addEventListener('change', (e) => {
          this.steps[idx].root = Number(e.target.value);
          this.presetKey = 'custom';
          el.querySelector('.cg-preset-sel').value = 'custom';
          this.recalculateAllVoicings();
          this.triggerCurrentStep(this.ctx.currentTime, true);
          renderCards();
          drawVisualizer();
          changed();
        });

        // Akkordtyp ändern
        cardEl.querySelector('.cg-type-sel')?.addEventListener('change', (e) => {
          this.steps[idx].type = e.target.value;
          this.presetKey = 'custom';
          el.querySelector('.cg-preset-sel').value = 'custom';
          this.recalculateAllVoicings();
          this.triggerCurrentStep(this.ctx.currentTime, true);
          renderCards();
          drawVisualizer();
          changed();
        });

        // Taktlänge ändern
        cardEl.querySelector('.cg-bars-sel')?.addEventListener('change', (e) => {
          this.steps[idx].bars = Number(e.target.value);
          this.presetKey = 'custom';
          el.querySelector('.cg-preset-sel').value = 'custom';
          drawVisualizer();
          changed();
        });

        // Duplizieren
        cardEl.querySelector('.cg-dup-btn')?.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.steps.length >= 16) return;
          this.steps.splice(idx + 1, 0, { ...this.steps[idx] });
          this.presetKey = 'custom';
          el.querySelector('.cg-preset-sel').value = 'custom';
          this.recalculateAllVoicings();
          renderCards();
          drawVisualizer();
          changed();
        });

        // Löschen
        cardEl.querySelector('.cg-del-btn')?.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.steps.length <= 2) return;
          this.steps.splice(idx, 1);
          if (this.currentStep >= this.steps.length) this.currentStep = 0;
          this.presetKey = 'custom';
          el.querySelector('.cg-preset-sel').value = 'custom';
          this.recalculateAllVoicings();
          renderCards();
          drawVisualizer();
          changed();
        });
      });
    };

    // Zeichnet die berechneten Stimmenlinien und gleitenden Kurven auf den Canvas
    const drawVisualizer = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx2d.clearRect(0, 0, w, h);

      const numSteps = this.steps.length;
      if (!numSteps) return;

      const colW = w / numSteps;
      const minMidi = 34; // ca. B♭1
      const maxMidi = 82; // ca. B5
      const midiToY = (m) => h - 14 - ((m - minMidi) / (maxMidi - minMidi)) * (h - 26);

      // Hintergrund: Oktavlinien
      ctx2d.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx2d.lineWidth = 1;
      [36, 48, 60, 72].forEach((octMidi) => {
        const y = midiToY(octMidi);
        ctx2d.beginPath();
        ctx2d.moveTo(0, y);
        ctx2d.lineTo(w, y);
        ctx2d.stroke();

        ctx2d.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx2d.font = '8px monospace';
        ctx2d.fillText(midiToName(octMidi), 4, y - 2);
      });

      // Spaltengitter & aktiver Schritt
      for (let s = 0; s < numSteps; s++) {
        const x = s * colW;
        if (s === this.currentStep) {
          ctx2d.fillStyle = 'rgba(139, 92, 246, 0.12)';
          ctx2d.fillRect(x, 0, colW, h);
        }
        ctx2d.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx2d.beginPath();
        ctx2d.moveTo(x, 0);
        ctx2d.lineTo(x, h);
        ctx2d.stroke();
      }

      const numVoices = Math.min(this.maxVoices, this.voiceCount || 5);

      // Jede Stimme als fortlaufende, gleitende Kurve zeichnen
      for (let v = 0; v < numVoices; v++) {
        const color = VOICE_COLORS[v % VOICE_COLORS.length];
        ctx2d.strokeStyle = color;
        ctx2d.lineWidth = v === 0 ? 2.5 : 2.0; // Bass etwas dicker
        ctx2d.beginPath();

        for (let s = 0; s < numSteps; s++) {
          const voicing = this.computedVoicings[s];
          if (!voicing || v >= voicing.length) continue;

          const midi = voicing[v];
          const xCenter = s * colW + colW * 0.5;
          const y = midiToY(midi);

          if (s === 0) {
            ctx2d.moveTo(xCenter, y);
          } else {
            const prevVoicing = this.computedVoicings[s - 1];
            const prevMidi = prevVoicing ? prevVoicing[v] : midi;
            const prevX = (s - 1) * colW + colW * 0.5;
            const prevY = midiToY(prevMidi);

            // S-Kurve (Cubic Bezier) zeigt den weichen Glide zwischen den Akkorden
            const cp1x = prevX + (xCenter - prevX) * 0.55;
            const cp2x = prevX + (xCenter - prevX) * 0.45;
            ctx2d.bezierCurveTo(cp1x, prevY, cp2x, y, xCenter, y);
          }
        }
        ctx2d.stroke();

        // Notenpunkte & Notennamen
        for (let s = 0; s < numSteps; s++) {
          const voicing = this.computedVoicings[s];
          if (!voicing || v >= voicing.length) continue;

          const midi = voicing[v];
          const xCenter = s * colW + colW * 0.5;
          const y = midiToY(midi);

          ctx2d.fillStyle = color;
          ctx2d.beginPath();
          ctx2d.arc(xCenter, y, s === this.currentStep ? 3.5 : 2.5, 0, Math.PI * 2);
          ctx2d.fill();

          // Notenbeschriftung auf aktiver Stufe
          if (s === this.currentStep && numSteps <= 8) {
            ctx2d.fillStyle = '#ffffff';
            ctx2d.font = 'bold 8px monospace';
            ctx2d.fillText(midiToName(midi), xCenter + 5, y + 3);
          }
        }
      }
    };

    // Playhead-Animation (animierte Abspielpositions-Nadel)
    let animId = null;
    const updatePlayhead = () => {
      if (this.running && this.steps.length) {
        const now = this.ctx.currentTime;
        const progress = Math.max(0, Math.min(1, (now - this.stepStartTime) / Math.max(0.1, this.stepDurationSec)));
        const colW = 100 / this.steps.length;
        const leftPct = this.currentStep * colW + progress * colW;
        playhead.style.left = `${leftPct}%`;
        playhead.style.opacity = '1';
      } else {
        playhead.style.opacity = '0';
      }
      animId = requestAnimationFrame(updatePlayhead);
    };

    // Callback zur Markierung der aktiven Karte bei Taktwechsel
    this.updateActiveCardUi = (activeIdx) => {
      cardsRow.querySelectorAll('.cg-card').forEach((c, idx) => {
        c.classList.toggle('is-active', idx === activeIdx);
      });
      drawVisualizer();
    };

    this.refreshVisualizer = () => {
      drawVisualizer();
    };

    // ── Button & Control Event Listener ──

    // Preset Auswahl
    el.querySelector('.cg-preset-sel')?.addEventListener('change', (e) => {
      const key = e.target.value;
      if (CHORD_PRESETS[key]) {
        this.presetKey = key;
        this.steps = CHORD_PRESETS[key].steps.map((s) => ({ ...s }));
        this.recalculateAllVoicings();
        this.currentStep = 0;
        this.clockTicks = 0;
        this.triggerCurrentStep(this.ctx.currentTime);
        renderCards();
        drawVisualizer();
        changed();
      }
    });

    // Play / Pause
    const runBtn = el.querySelector('.cg-run-btn');
    runBtn?.addEventListener('click', () => {
      this.running = !this.running;
      runBtn.textContent = this.running ? '■ Pause' : '▶ Play';
      runBtn.classList.toggle('active', this.running);
      if (!this.running) this.stopVoices();
      else this.triggerCurrentStep(this.ctx.currentTime);
      changed();
    });

    // Stimmführung Toggle
    const leadBtn = el.querySelector('.cg-lead-toggle');
    leadBtn?.addEventListener('click', () => {
      this.voiceLeading = this.voiceLeading ? 0 : 1;
      leadBtn.classList.toggle('active', !!this.voiceLeading);
      this.recalculateAllVoicings();
      this.triggerCurrentStep(this.ctx.currentTime);
      drawVisualizer();
      changed();
    });

    // Live-Modus Toggle
    const liveBtn = el.querySelector('.cg-live-toggle');
    liveBtn?.addEventListener('click', () => {
      this.liveMode = !this.liveMode;
      liveBtn.classList.toggle('active', this.liveMode);
      changed();
    });

    // Mehr / Erweitert Drawer
    const moreBtn = el.querySelector('.cg-more-toggle');
    const drawer = el.querySelector('.cg-drawer');
    moreBtn?.addEventListener('click', () => {
      this.drawerOpen = !this.drawerOpen;
      moreBtn.classList.toggle('active', this.drawerOpen);
      drawer.classList.toggle('open', this.drawerOpen);
      changed();
    });

    // Schritt hinzufügen
    el.querySelector('.cg-add-step-btn')?.addEventListener('click', () => {
      if (this.steps.length >= 16) return;
      const last = this.steps[this.steps.length - 1] || { root: 0, type: 'maj7', bars: 1 };
      this.steps.push({ ...last });
      this.presetKey = 'custom';
      el.querySelector('.cg-preset-sel').value = 'custom';
      this.recalculateAllVoicings();
      renderCards();
      drawVisualizer();
      changed();
    });

    // Drawer-Felder
    el.querySelector('.cg-voices-sel')?.addEventListener('change', (e) => {
      this.voiceCount = Number(e.target.value);
      this.recalculateAllVoicings();
      this.triggerCurrentStep(this.ctx.currentTime);
      drawVisualizer();
      changed();
    });

    el.querySelector('.cg-strum-sel')?.addEventListener('change', (e) => {
      this.strum = Number(e.target.value);
      changed();
    });

    el.querySelector('.cg-retrigger-sel')?.addEventListener('change', (e) => {
      this.retrigger = e.target.value === '1';
      changed();
    });

    el.querySelector('.cg-octave-sel')?.addEventListener('change', (e) => {
      this.baseOctave = Number(e.target.value);
      this.recalculateAllVoicings();
      this.triggerCurrentStep(this.ctx.currentTime);
      drawVisualizer();
      changed();
    });

    // Computertastatur Live-Modus (Tasten 1..8)
    const handleKeydown = (e) => {
      if (!this.liveMode || !this.enabled) return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= this.steps.length) {
        e.preventDefault();
        this.currentStep = num - 1;
        this.clockTicks = 0;
        this.triggerCurrentStep(this.ctx.currentTime, true);
        drawVisualizer();
      }
    };
    window.addEventListener('keydown', handleKeydown);

    // Initialer Aufbau
    renderCards();
    drawVisualizer();
    updatePlayhead();

    // Aufräumen bei Entfernung / Re-Render
    return () => {
      if (animId) cancelAnimationFrame(animId);
      window.removeEventListener('keydown', handleKeydown);
    };
  }
}

