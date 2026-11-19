// SYNTHBOARD – Solo Violin / Bowed Strings Modul
// Realistische, intime Solo-Violine mit physikalischer Bogen-Modellierung (Bow Friction & Kolophonium),
// hölzernen Resonanzkörper-Formanten (Fichte & F-Löcher), verzögertem Vibrato,
// Bundlosem Portamento (Finger-Glide) und umschaltbaren Artikulationen (Arco, Pizzicato, Sul Tasto, Tremolo).

import { SourceBase, midiToFreq, midiToName, getNoiseBuffers } from './base.js';

const ARTICULATIONS = [
  ['arco', 'Arco (Gestrichen)'],
  ['pizz', 'Pizzicato (Gezupft)'],
  ['sultasto', 'Sul Tasto (Sanft)'],
  ['tremolo', 'Tremolo (Zitternd)'],
];

const OCTAVE_CHOICES = [
  [-1, 'Bratsche / Cello (-1 Okt)'],
  [0, 'Violine Original (C3–A6)'],
  [1, 'Flageolett / Hoch (+1 Okt)'],
];

// Die 4 Saiten einer Violine in Standardstimmung: G3 (55), D4 (62), A4 (69), E5 (76)
const VIOLIN_STRINGS = [
  { name: 'G3', openMidi: 55, color: '#f59e0b' },
  { name: 'D4', openMidi: 62, color: '#fbbf24' },
  { name: 'A4', openMidi: 69, color: '#38bdf8' },
  { name: 'E5', openMidi: 76, color: '#a855f7' },
];

// Tastatur-Belegung: Halbtöne von C4 (60) bis C5 (72)
const KEY_MAP = {
  a: 60, w: 61, s: 62, e: 63, d: 64, f: 65, t: 66, g: 67, z: 68, y: 68, h: 69, u: 70, j: 71, k: 72,
};

export class ViolinModule extends SourceBase {
  static type = 'violin';
  static title = 'Solo Violin';
  static category = 'source';
  static color = '#ea580c'; // Warmes Bernstein-Fichtenholz
  static icon = '🎻';
  static description = 'Akustische Solo-Violine: Physical Modeling mit Bogenreibung, Holzformanten, Vibrato & Artikulationen';

  static params = [
    { id: 'level', label: 'Level', min: 0, max: 1, value: 0.75, fmt: 'pct' },
    { id: 'bow', label: 'Bogendruck', min: 0.1, max: 1.0, value: 0.55, fmt: 'pct' },
    { id: 'vibrato', label: 'Vibrato', min: 0, max: 1.0, value: 0.55, fmt: 'pct' },
    { id: 'glide', label: 'Finger-Glide', min: 0, max: 1.2, value: 0.14, log: true, fmt: 's' },
    { id: 'tone', label: 'Holzkorpus', min: 800, max: 12000, value: 3800, log: true, fmt: 'hz' },
    { id: 'attack', label: 'Bogenstrich', min: 0.02, max: 2.0, value: 0.18, log: true, fmt: 's' },
    { id: 'release', label: 'Ausklang', min: 0.1, max: 6.0, value: 1.2, log: true, fmt: 's' },
  ];

  static options = [
    { id: 'articulation', label: 'Spielweise', choices: ARTICULATIONS, value: 'arco' },
    { id: 'octave', label: 'Stimmung', choices: OCTAVE_CHOICES, value: 0 },
  ];

  static jacks = [
    { id: 'gateIn', type: 'in', signal: 'gate', label: 'BOW GATE' },
    { id: 'pitchIn', type: 'in', signal: 'pitch', label: 'PITCH' },
    { id: 'bowCv', type: 'in', signal: 'mod', label: 'BOW CV' },
    { id: 'vibratoCv', type: 'in', signal: 'mod', label: 'VIB CV' },
    { id: 'glideCv', type: 'in', signal: 'mod', label: 'GLIDE CV' },
    { id: 'vcaCv', type: 'in', signal: 'mod', label: 'VCA CV' },
    { id: 'panCv', type: 'in', signal: 'mod', label: 'PAN CV' },
  ];

  constructor(ctx, state = {}) {
    super(ctx, state);

    this.currentMidi = 69; // A4 (440 Hz)
    this.targetFreq = midiToFreq(69);
    this.lastMidi = 69;
    this.isLegato = false;
    this.activeNoteCount = 0;
    this.activeVoices = new Map(); // midi -> Voice
    this.currentVoice = null;
    this.scheduledTimers = new Set();
    this.pendingPitchMeta = null;
    this.bowCv = 0;
    this.vibratoCv = 0;
    this.glideCv = 0;

    // ── Akustischer Fichtenholz-Resonanzkörper (Formant Filter Netzwerk) ──
    // Modelliert die drei charakteristischen Resonanzen einer echten Stradivari/Geige:
    // 1. F-Loch Luftresonanz (Helmholtz): ~280 Hz
    this.airRes = ctx.createBiquadFilter();
    this.airRes.type = 'peaking';
    this.airRes.frequency.value = 285;
    this.airRes.Q.value = 3.2;
    this.airRes.gain.value = 5.5; // Warme Fülle

    // 2. Fichten-Deckenresonanz (Holz-Eigenmode): ~470 Hz
    this.woodRes = ctx.createBiquadFilter();
    this.woodRes.type = 'peaking';
    this.woodRes.frequency.value = 475;
    this.woodRes.Q.value = 3.8;
    this.woodRes.gain.value = 6.0; // Bauchige Wärme

    // 3. Steg-Resonanz („Bridge Hill“ für seidiges Streichen & Durchsetzungsfähigkeit): ~3100 Hz
    this.bridgeHill = ctx.createBiquadFilter();
    this.bridgeHill.type = 'peaking';
    this.bridgeHill.frequency.value = 3100;
    this.bridgeHill.Q.value = 2.4;
    this.bridgeHill.gain.value = 2.6; // Wärmere, weniger kratzige Präsenz

    // Dämpfungsfilter (Kolophonium / Helligkeit)
    this.bodyTone = ctx.createBiquadFilter();
    this.bodyTone.type = 'lowpass';
    this.bodyTone.frequency.value = this.values.tone ?? 3800;
    this.bodyTone.Q.value = 0.7;

    // Master-Voice-Mixer & Ausgänge
    this.voiceBus = ctx.createGain();
    this.voiceBus.gain.value = 0.75;
    this.voiceBus.connect(this.airRes);
    this.airRes.connect(this.woodRes);
    this.woodRes.connect(this.bridgeHill);
    this.bridgeHill.connect(this.bodyTone);
    this.bodyTone.connect(this.output);

    this.initValues(state);
  }

  effectiveBow(extraExpr = null) {
    const base = extraExpr !== null && Number.isFinite(extraExpr)
      ? (this.values.bow ?? 0.55) * (0.55 + extraExpr * 0.65)
      : (this.values.bow ?? 0.55);
    return Math.max(0.05, Math.min(1.0, base + this.bowCv));
  }

  effectiveVibrato() {
    return Math.max(0, Math.min(1.0, (this.values.vibrato ?? 0.55) + this.vibratoCv));
  }

  syncActiveVoicesExpression(time = null) {
    const t = time || this.ctx.currentTime;
    const bow = this.effectiveBow();
    const vib = this.effectiveVibrato();
    for (const [, voice] of this.activeVoices) {
      voice.updateExpression({ bow, vibrato: vib, time: t });
    }
  }

  // ── Modulations- & CV-Handling ──
  onPitch(portId, time, midiNote, _velocity = 1, _duration = 0.5, meta = null) {
    if (portId !== 'pitchIn') return;
    const note = Array.isArray(midiNote) ? midiNote[0] : midiNote;
    this.currentMidi = typeof note === 'number' ? Math.round(note) : 69;
    const actualMidi = this.currentMidi + (Number(this.values.octave) || 0) * 12;
    this.targetFreq = midiToFreq(actualMidi);
    this.pendingPitchMeta = meta || null;
    this.updateStringFingerboardUi?.();

    // Wenn kein separates Gate-Kabel gesteckt ist und bereits ein Ton klingt, sanft portamento gliden
    const hasGateCable = this.patchSystem?.hasIncoming?.(this.id, 'gateIn');
    if (this.activeVoices.size > 0 && (!hasGateCable || meta?.legato)) {
      const now = time || this.ctx.currentTime;
      const glideTime = Math.max(0.008, (this.values.glide ?? 0.14) + this.glideCv * 0.4);
      for (const [, voice] of this.activeVoices) {
        voice.setPitch(this.targetFreq, now, glideTime);
      }
      this.lastFreq = this.targetFreq;
    }
  }

  onTrigger(portId, time, velocity = 1, duration = 0.6, meta = null) {
    if (portId === 'gateIn') {
      const oct = Number(this.values.octave) || 0;
      const mergedMeta = meta || this.pendingPitchMeta || null;
      this.pendingPitchMeta = null;
      this.noteOn(this.currentMidi + oct * 12, time, velocity, duration, mergedMeta);
    }
  }

  onGate(portId, open, time) {
    if (portId === 'gateIn') {
      const oct = Number(this.values.octave) || 0;
      if (open) {
        this.noteOn(this.currentMidi + oct * 12, time, 1, null);
      } else {
        this.noteOff(this.currentMidi + oct * 12, time);
      }
    }
  }

  onModulation(portId, val, time) {
    if (this.handleSourceModulation(portId, val)) return;
    if (portId === 'bowCv') {
      this.bowCv = (val - 0.5) * 0.8;
      this.syncActiveVoicesExpression(time);
    } else if (portId === 'vibratoCv') {
      this.vibratoCv = (val - 0.5) * 0.8;
      this.syncActiveVoicesExpression(time);
    } else if (portId === 'glideCv') {
      this.glideCv = val;
    }
  }

  applyParam(id, val) {
    if (id === 'level' && this.voiceBus) {
      this.ramp(this.voiceBus.gain, val, 0.03);
    } else if (id === 'tone' && this.bodyTone) {
      this.ramp(this.bodyTone.frequency, val, 0.04);
    } else if (id === 'bow' || id === 'vibrato') {
      this.syncActiveVoicesExpression();
    }
  }

  clearScheduledTimers() {
    for (const timerId of this.scheduledTimers) {
      clearTimeout(timerId);
    }
    this.scheduledTimers.clear();
  }

  allNotesOff(time = null) {
    this.clearScheduledTimers();
    const t = Math.max(time || this.ctx.currentTime, this.ctx.currentTime);
    for (const [, voice] of this.activeVoices) {
      voice.releaseNote(t, Math.min(0.25, this.values.release ?? 0.5));
    }
    this.activeVoices.clear();
    this.currentVoice = null;
    this.updateStringFingerboardUi?.();
  }

  // ── Noten-Logik (Monophones Solo-Instrument mit Legato vs. Neuansatz) ──
  noteOn(midi, time = null, velocity = 1, duration = 0.7, meta = null) {
    if (!this.enabled) return;
    const now = this.ctx.currentTime;
    const t = Math.max(time || now, now);
    const mode = meta?.articulation || this.values.articulation || 'arco';
    const isLegato = !!(meta?.legato) && mode !== 'pizz';
    const expr = meta?.expression !== undefined ? meta.expression : null;
    const bowVal = this.effectiveBow(expr);
    const vibVal = this.effectiveVibrato();
    const targetFreq = midiToFreq(midi);

    // 1. FALL: Gebundenes Legato auf bereits klingender Saite (kein Bogen-Neuansatz!)
    if (isLegato && this.currentVoice && !this.currentVoice.released && this.activeVoices.size > 0) {
      this.clearScheduledTimers();
      const glideTime = Math.max(0.025, (this.values.glide ?? 0.14) + this.glideCv * 0.4);
      this.currentVoice.midi = midi;
      this.currentVoice.setPitch(targetFreq, t, glideTime);
      this.currentVoice.updateExpression({
        bow: bowVal,
        vibrato: vibVal,
        velocity,
        time: t,
      });
      this.lastFreq = targetFreq;
      this.currentMidi = midi;

      const delayStartMs = Math.max(0, (t - now) * 1000);
      setTimeout(() => this.updateStringFingerboardUi?.(), delayStartMs);

      if (Number.isFinite(duration) && duration > 0) {
        const activeVoice = this.currentVoice;
        const offTime = t + duration;
        const offDelayMs = Math.max(20, (offTime - now) * 1000);
        const timerId = setTimeout(() => {
          this.scheduledTimers.delete(timerId);
          if (this.currentVoice === activeVoice && !activeVoice.released) {
            activeVoice.releaseNote(this.ctx.currentTime, this.values.release ?? 1.2);
            this.activeVoices.delete(activeVoice.midi);
            if (this.currentVoice === activeVoice) this.currentVoice = null;
            this.updateStringFingerboardUi?.();
          }
        }, offDelayMs);
        this.scheduledTimers.add(timerId);
      }
      return;
    }

    // 2. FALL: Bogen-Neuansatz (beendet vorherige Solo-Stimme sanft, verhindert hängende Noten)
    this.clearScheduledTimers();
    const hadActiveVoice = this.activeVoices.size > 0;
    for (const [oldMidi, oldVoice] of this.activeVoices) {
      oldVoice.releaseNote(t, Math.min(0.16, this.values.release ?? 0.8));
      this.activeVoices.delete(oldMidi);
    }

    const glideTime = hadActiveVoice
      ? Math.max(0.008, (this.values.glide ?? 0.14) * 0.65 + this.glideCv * 0.3)
      : 0.004;

    const voice = new ViolinVoice(this.ctx, this.voiceBus, {
      midi,
      velocity,
      startTime: t,
      mode,
      bow: bowVal,
      vibrato: vibVal,
      attack: meta?.attack ?? this.values.attack ?? 0.18,
      release: this.values.release ?? 1.2,
      glide: glideTime,
      fromFreq: this.lastFreq || targetFreq,
    });

    this.activeVoices.set(midi, voice);
    this.currentVoice = voice;
    this.lastFreq = targetFreq;
    this.currentMidi = midi;

    const delayStartMs = Math.max(0, (t - now) * 1000);
    setTimeout(() => this.updateStringFingerboardUi?.(), delayStartMs);

    if (mode === 'pizz') {
      const dur = Math.max(0.2, (this.values.release ?? 1.2) * 0.6);
      const timerId = setTimeout(() => {
        this.scheduledTimers.delete(timerId);
        if (this.activeVoices.get(midi) === voice) {
          voice.stop(this.ctx.currentTime);
          this.activeVoices.delete(midi);
          if (this.currentVoice === voice) this.currentVoice = null;
          this.updateStringFingerboardUi?.();
        }
      }, (t - now + dur) * 1000);
      this.scheduledTimers.add(timerId);
    } else if (Number.isFinite(duration) && duration > 0) {
      // Geplantes Notenende (Note-Off nach Notendauer)
      const offTime = t + duration;
      const offDelayMs = Math.max(25, (offTime - now) * 1000);
      const timerId = setTimeout(() => {
        this.scheduledTimers.delete(timerId);
        if (this.activeVoices.get(midi) === voice && !voice.released) {
          voice.releaseNote(this.ctx.currentTime, this.values.release ?? 1.2);
          this.activeVoices.delete(midi);
          if (this.currentVoice === voice) this.currentVoice = null;
          this.updateStringFingerboardUi?.();
        }
      }, offDelayMs);
      this.scheduledTimers.add(timerId);
    }
  }

  noteOff(midi, time = null) {
    const t = Math.max(time || this.ctx.currentTime, this.ctx.currentTime);
    const voice = this.activeVoices.get(midi) || this.currentVoice;
    if (voice) {
      const mode = this.values.articulation || 'arco';
      voice.releaseNote(t, mode === 'pizz' ? 0.3 : (this.values.release ?? 1.2));
      this.activeVoices.delete(voice.midi);
      if (this.currentVoice === voice) this.currentVoice = null;
      this.updateStringFingerboardUi?.();
    }
  }

  // Tastatursteuerung (A–#)
  handleKey(key, down) {
    const midi = KEY_MAP[key.toLowerCase()];
    if (midi === undefined) return false;
    const oct = Number(this.values.octave) || 0;
    const actualMidi = midi + oct * 12;

    if (down) {
      this.noteOn(actualMidi, this.ctx.currentTime, 0.95);
    } else {
      this.noteOff(actualMidi, this.ctx.currentTime);
    }
    return true;
  }

  // ── UI Extra Rendering ──
  renderExtra(el, helpers) {
    el.innerHTML = `
      <div class="violin-ui">
        <div class="violin-head">
          <div class="v-note-badge">
            <span class="v-lbl">NOTE</span>
            <span class="v-pitch-val">${midiToName(this.currentMidi)}</span>
            <span class="v-freq-val">${Math.round(midiToFreq(this.currentMidi))} Hz</span>
          </div>
          <div class="v-actions">
            <button class="v-trigger-btn btn-arco" title="Gestrichen anspielen">▶ Bogen</button>
            <button class="v-trigger-btn btn-pizz" title="Pizzicato zupfen">▶ Pizz</button>
          </div>
        </div>

        <!-- 4-Saiten Griffbrett Visualizer -->
        <div class="violin-fingerboard">
          <div class="fb-nut"></div>
          ${VIOLIN_STRINGS.map((s, idx) => `
            <div class="fb-string string-${idx}" data-str-idx="${idx}" style="--str-col:${s.color}">
              <span class="str-name">${s.name}</span>
              <div class="str-line"></div>
              <div class="str-finger-pos" id="finger-${idx}"></div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    const pitchEl = el.querySelector('.v-pitch-val');
    const freqEl = el.querySelector('.v-freq-val');
    const fingerPositions = [
      el.querySelector('#finger-0'),
      el.querySelector('#finger-1'),
      el.querySelector('#finger-2'),
      el.querySelector('#finger-3'),
    ];

    this.updateStringFingerboardUi = () => {
      const midi = this.currentMidi;
      if (pitchEl) pitchEl.textContent = midiToName(midi);
      if (freqEl) freqEl.textContent = `${Math.round(midiToFreq(midi))} Hz`;

      // Berechne, auf welcher der 4 Saiten (G, D, A, E) der Ton am natürlichsten liegt
      let targetStr = 0;
      if (midi >= 76) targetStr = 3;      // E-Saite
      else if (midi >= 69) targetStr = 2; // A-Saite
      else if (midi >= 62) targetStr = 1; // D-Saite
      else targetStr = 0;                 // G-Saite

      const baseMidi = VIOLIN_STRINGS[targetStr].openMidi;
      const semiDiff = Math.max(0, midi - baseMidi);
      // Prozentuale Griffbrett-Position (Mensur 0 bis 16 Halbtöne)
      const pct = Math.min(94, 8 + semiDiff * 5.5);

      fingerPositions.forEach((fp, idx) => {
        if (!fp) return;
        const isActiveStr = (idx === targetStr) && (this.activeVoices.size > 0);
        fp.style.left = `${pct}%`;
        fp.classList.toggle('active', isActiveStr);
      });
    };

    // Trigger Buttons
    const btnArco = el.querySelector('.btn-arco');
    const btnPizz = el.querySelector('.btn-pizz');

    btnArco?.addEventListener('mousedown', () => {
      this.noteOn(this.currentMidi, this.ctx.currentTime, 0.95, null);
    });
    btnArco?.addEventListener('mouseup', () => {
      this.noteOff(this.currentMidi, this.ctx.currentTime);
    });
    btnArco?.addEventListener('mouseleave', () => {
      this.noteOff(this.currentMidi, this.ctx.currentTime);
    });

    btnPizz?.addEventListener('click', () => {
      const oldMode = this.values.articulation;
      this.values.articulation = 'pizz';
      this.noteOn(this.currentMidi, this.ctx.currentTime, 1.0, 0.4);
      setTimeout(() => { this.values.articulation = oldMode; }, 200);
    });

    this.updateStringFingerboardUi();
  }

  destroy() {
    this.clearScheduledTimers();
    for (const [, voice] of this.activeVoices) {
      voice.destroy();
    }
    this.activeVoices.clear();
    this.currentVoice = null;

    try {
      this.airRes.disconnect();
      this.woodRes.disconnect();
      this.bridgeHill.disconnect();
      this.bodyTone.disconnect();
      this.voiceBus.disconnect();
    } catch { /* ignore */ }

    super.destroy();
  }
}

// ───────────────────────────────────────────── PHYSICAL VIOLIN VOICE ──
class ViolinVoice {
  constructor(ctx, destination, params) {
    this.ctx = ctx;
    this.destination = destination;
    this.midi = params.midi;
    this.velocity = params.velocity || 1;
    this.mode = params.mode || 'arco';
    this.bow = params.bow || 0.55;
    this.vibrato = params.vibrato || 0.55;
    this.attack = params.attack || 0.18;
    this.release = params.release || 1.2;
    this.released = false;

    const t = params.startTime;
    const targetFreq = midiToFreq(this.midi);
    const startFreq = params.fromFreq || targetFreq;
    this.currentFreq = targetFreq;

    // 1. Saiten-Oszillator (Asymmetrischer Helmholtz-Bogen-Sägezahn)
    this.oscSaw = ctx.createOscillator();
    this.oscSaw.type = 'sawtooth';
    this.oscSaw.frequency.setValueAtTime(startFreq, t);

    // 2. Saiten-Körper Unterton (Warmer Sinus/Dreieck-Bauch)
    this.oscSub = ctx.createOscillator();
    this.oscSub.type = 'triangle';
    this.oscSub.frequency.setValueAtTime(startFreq, t);

    // Glide / Glissando
    if (params.glide > 0 && Math.abs(startFreq - targetFreq) > 0.5) {
      this.oscSaw.frequency.exponentialRampToValueAtTime(targetFreq, t + params.glide);
      this.oscSub.frequency.exponentialRampToValueAtTime(targetFreq, t + params.glide);
    } else {
      this.oscSaw.frequency.setValueAtTime(targetFreq, t);
      this.oscSub.frequency.setValueAtTime(targetFreq, t);
    }

    // 3. Kolophonium Bogen-Kratzgeräusch (Pink Noise durch Bogen-Bandpass + Höhen-Dämpfung)
    this.noiseSource = ctx.createBufferSource();
    this.noiseSource.buffer = getNoiseBuffers(ctx).pink;
    this.noiseSource.loop = true;

    this.noiseFilter = ctx.createBiquadFilter();
    this.noiseFilter.type = 'bandpass';
    this.noiseFilter.frequency.setValueAtTime(1800 + this.bow * 900, t);
    this.noiseFilter.Q.setValueAtTime(2.2, t);

    this.noiseLp = ctx.createBiquadFilter();
    this.noiseLp.type = 'lowpass';
    this.noiseLp.frequency.value = 3400;
    this.noiseLp.Q.value = 0.6;

    this.noiseGain = ctx.createGain();
    const bowFriction = (this.mode === 'sultasto') ? 0.014 : (0.028 + this.bow * 0.045) * this.velocity;
    this.noiseGain.gain.setValueAtTime(0.0001, t);
    this.noiseGain.gain.linearRampToValueAtTime(bowFriction, t + Math.min(0.06, this.attack * 0.4));
    // Reibungsgeräusch lässt nach dem ersten Anstrich minimal nach
    this.noiseGain.gain.setTargetAtTime(bowFriction * 0.42, t + Math.min(0.12, this.attack), 0.1);

    this.noiseSource.connect(this.noiseFilter);
    this.noiseFilter.connect(this.noiseLp);
    this.noiseLp.connect(this.noiseGain);

    // 4. Saiten-Filter (Dynamische Helligkeit abhängig von Bogendruck & Anschlag)
    this.stringFilter = ctx.createBiquadFilter();
    this.stringFilter.type = 'lowpass';
    const cutoffBase = (this.mode === 'sultasto') ? (1600 + this.bow * 1400) : (2400 + this.bow * 4400) * Math.pow(this.velocity, 0.4);
    this.stringFilter.frequency.setValueAtTime(Math.max(400, cutoffBase * 0.6), t);
    this.stringFilter.frequency.linearRampToValueAtTime(cutoffBase, t + this.attack);
    this.stringFilter.Q.setValueAtTime(1.6, t);

    // 5. Verzögertes natürliches Geigen-Vibrato (setzt erst nach Bogenaufnahme ein)
    this.vibratoOsc = ctx.createOscillator();
    this.vibratoOsc.frequency.setValueAtTime(5.3, t); // Natürliche 5.3 Hz Vibratofrequenz

    this.vibratoGain = ctx.createGain();
    const vibDepthHz = (targetFreq * 0.016) * this.vibrato; // ca. 20-28 Cents
    this.vibratoGain.gain.setValueAtTime(0, t);
    // Sanftes Einblenden des Vibratos nach 240ms
    const vibDelay = (this.mode === 'tremolo') ? 0.02 : 0.25;
    this.vibratoGain.gain.setValueAtTime(0, t + vibDelay);
    this.vibratoGain.gain.linearRampToValueAtTime(vibDepthHz, t + vibDelay + 0.42);

    this.vibratoOsc.connect(this.vibratoGain);
    this.vibratoGain.connect(this.oscSaw.frequency);
    this.vibratoGain.connect(this.oscSub.frequency);

    // 6. Tremolo-LFO (wenn Spielweise = Tremolo)
    if (this.mode === 'tremolo') {
      this.tremoloOsc = ctx.createOscillator();
      this.tremoloOsc.frequency.setValueAtTime(7.8, t); // Schneller Bogenwechsel
      this.tremoloGain = ctx.createGain();
      this.tremoloGain.gain.value = 0.35;
      this.tremoloOsc.connect(this.tremoloGain);
    }

    // 7. Voice VCA & Hüllkurve
    this.voiceVca = ctx.createGain();
    this.voiceVca.gain.setValueAtTime(0.0001, t);

    if (this.mode === 'pizz') {
      // Pizzicato: Rasanter Anschlag, gefolgt von warmem Holz-Ausklingen
      this.voiceVca.gain.linearRampToValueAtTime(0.38 * this.velocity, t + 0.005);
      this.voiceVca.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.25, this.release * 0.8));
    } else {
      // Arco / Sul Tasto / Tremolo: Ausdrucksstarker Bogen-Swell
      const peakGain = (this.mode === 'sultasto' ? 0.24 : 0.32) * this.velocity * (0.65 + this.bow * 0.45);
      this.voiceVca.gain.linearRampToValueAtTime(peakGain, t + Math.max(0.02, this.attack));
    }

    // Mische Oszillatoren
    this.oscSaw.connect(this.stringFilter);
    this.oscSub.connect(this.stringFilter);
    this.stringFilter.connect(this.voiceVca);
    this.noiseGain.connect(this.voiceVca);

    if (this.tremoloGain) {
      this.tremoloGain.connect(this.voiceVca.gain);
      this.tremoloOsc.start(t);
    }

    this.voiceVca.connect(this.destination);

    // Oszillatoren starten
    this.oscSaw.start(t);
    this.oscSub.start(t);
    this.noiseSource.start(t);
    this.vibratoOsc.start(t);
  }

  setPitch(newFreq, time, glideSec = 0.12) {
    if (this.released) return;
    const t = Math.max(time, this.ctx.currentTime);
    this.currentFreq = newFreq;
    this.oscSaw.frequency.cancelScheduledValues(t);
    this.oscSub.frequency.cancelScheduledValues(t);
    this.oscSaw.frequency.setTargetAtTime(newFreq, t, Math.max(0.02, glideSec * 0.55));
    this.oscSub.frequency.setTargetAtTime(newFreq, t, Math.max(0.02, glideSec * 0.55));
  }

  /** Dynamischer Ausdruck während einer gehaltenen Note (Bogendruck, Vibrato, Legato-Dynamik) */
  updateExpression({ bow, vibrato, velocity, time } = {}) {
    if (this.released || this.mode === 'pizz') return;
    const t = Math.max(time || this.ctx.currentTime, this.ctx.currentTime);
    if (bow !== undefined) this.bow = bow;
    if (vibrato !== undefined) this.vibrato = vibrato;
    if (velocity !== undefined) this.velocity = velocity;

    const cutoffTarget = (this.mode === 'sultasto')
      ? (1500 + this.bow * 1500)
      : (2300 + this.bow * 4500) * Math.pow(this.velocity, 0.4);
    this.stringFilter.frequency.setTargetAtTime(Math.max(400, cutoffTarget), t, 0.06);

    const bowFriction = (this.mode === 'sultasto') ? 0.01 : (0.018 + this.bow * 0.032) * this.velocity;
    this.noiseGain.gain.setTargetAtTime(bowFriction, t, 0.08);

    const vibDepthHz = ((this.currentFreq || 440) * 0.016) * this.vibrato;
    this.vibratoGain.gain.setTargetAtTime(vibDepthHz, t, 0.08);

    const peakGain = (this.mode === 'sultasto' ? 0.24 : 0.32) * this.velocity * (0.65 + this.bow * 0.45);
    this.voiceVca.gain.setTargetAtTime(peakGain, t, 0.08);
  }

  releaseNote(time, relSec = 1.2) {
    if (this.released) return;
    this.released = true;
    const t = Math.max(time, this.ctx.currentTime);
    const g = this.voiceVca.gain;
    if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t);
    else {
      g.cancelScheduledValues(t);
      g.setValueAtTime(Math.max(0.0001, g.value), t);
    }
    g.setTargetAtTime(0.0001, t, Math.max(0.04, relSec * 0.28));

    const stopTime = t + Math.max(0.15, relSec * 1.35) + 0.05;
    setTimeout(() => {
      this.destroy();
    }, Math.max(50, (stopTime - this.ctx.currentTime) * 1000 + 50));
  }

  stop(time) {
    if (this.released) return;
    this.released = true;
    const t = Math.max(time, this.ctx.currentTime);
    this.voiceVca.gain.cancelScheduledValues(t);
    this.voiceVca.gain.setTargetAtTime(0, t, 0.03);
    setTimeout(() => this.destroy(), 80);
  }

  destroy() {
    try {
      this.oscSaw.stop(); this.oscSaw.disconnect();
      this.oscSub.stop(); this.oscSub.disconnect();
      this.noiseSource.stop(); this.noiseSource.disconnect();
      this.vibratoOsc.stop(); this.vibratoOsc.disconnect();
      if (this.tremoloOsc) { this.tremoloOsc.stop(); this.tremoloOsc.disconnect(); }
      this.noiseFilter.disconnect();
      this.noiseLp.disconnect();
      this.noiseGain.disconnect();
      this.stringFilter.disconnect();
      this.vibratoGain.disconnect();
      if (this.tremoloGain) this.tremoloGain.disconnect();
      this.voiceVca.disconnect();
    } catch { /* ignore */ }
  }
}

