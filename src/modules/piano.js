// SYNTHBOARD – Felt Piano / Ambient Klavier Modul
// Realistischer, intimer Klavierklang mit Filz-Hammer-Anschlag,
// Inharmonizität echter Stahlsaiten, Resonanzkasten und interaktiver Klaviatur.

import { SourceBase, midiToFreq, midiToName, scaleNote, SCALES, getNoiseBuffers } from './base.js';

const CHORDS = [
  ['single', 'Solo (1 Note)'],
  ['octave', 'Oktave (+12)'],
  ['fifth', 'Quinte (+7)'],
  ['minor9', 'Moll 9 (Ambient)'],
  ['major7', 'Dur maj7'],
  ['sus2', 'Sus 2 (Sphärisch)'],
];

const OCTAVES = [
  [36, 'Okt 2 (Tief)'],
  [48, 'Okt 3 (Warm)'],
  [60, 'Okt 4 (Hell)'],
];

const SCALE_CHOICES = Object.entries(SCALES).map(([k, s]) => [k, s.name]);

// 17-Tasten Mini-Klaviatur Layout (1.5 Oktaven von C bis E)
const PIANO_KEYS = [
  { midiRel: 0, isBlack: false, name: 'C' },
  { midiRel: 1, isBlack: true,  name: 'C#' },
  { midiRel: 2, isBlack: false, name: 'D' },
  { midiRel: 3, isBlack: true,  name: 'D#' },
  { midiRel: 4, isBlack: false, name: 'E' },
  { midiRel: 5, isBlack: false, name: 'F' },
  { midiRel: 6, isBlack: true,  name: 'F#' },
  { midiRel: 7, isBlack: false, name: 'G' },
  { midiRel: 8, isBlack: true,  name: 'G#' },
  { midiRel: 9, isBlack: false, name: 'A' },
  { midiRel: 10, isBlack: true, name: 'A#' },
  { midiRel: 11, isBlack: false, name: 'B' },
  { midiRel: 12, isBlack: false, name: 'C' },
  { midiRel: 13, isBlack: true,  name: 'C#' },
  { midiRel: 14, isBlack: false, name: 'D' },
  { midiRel: 15, isBlack: true,  name: 'D#' },
  { midiRel: 16, isBlack: false, name: 'E' },
];

export class FeltPianoModule extends SourceBase {
  static type = 'felt_piano';
  static title = 'Felt Piano';
  static category = 'source';
  static color = '#f59e0b'; // Edles Klavier-Bernstein / Holzgold
  static icon = '🎹';
  static description = 'Warmes Filz-Klavier: intimer Saitenanschlag, Melodien & interaktive Klaviatur';

  static params = [
    { id: 'level', label: 'Level', min: 0, max: 1, value: 0.75, fmt: 'pct' },
    { id: 'felt', label: 'Filz-Dämpfung', min: 0, max: 1, value: 0.65, fmt: 'pct' },
    { id: 'decay', label: 'Sustain', min: 0.4, max: 8.0, value: 2.8, log: true, fmt: 's' },
    { id: 'color', label: 'Brillanz', min: 600, max: 9000, value: 2800, log: true, fmt: 'hz' },
    { id: 'body', label: 'Resonanz', min: 0, max: 1, value: 0.55, fmt: 'pct' },
    { id: 'hammer', label: 'Hammer-Klick', min: 0, max: 1, value: 0.4, fmt: 'pct' },
  ];

  static options = [
    { id: 'octave', label: 'Oktave', choices: OCTAVES, value: 48 },
    { id: 'chord', label: 'Voicing', choices: CHORDS, value: 'single' },
    { id: 'scale', label: 'Skala', choices: SCALE_CHOICES, value: 'minorPenta' },
  ];

  static jacks = [
    { id: 'gateIn', type: 'in', signal: 'gate', label: 'GATE' },
    { id: 'pitchIn', type: 'in', signal: 'pitch', label: 'PITCH' },
    { id: 'vcaCv', type: 'in', signal: 'mod', label: 'VCA CV' },
    { id: 'feltCv', type: 'in', signal: 'mod', label: 'FELT CV' },
    { id: 'panCv', type: 'in', signal: 'mod', label: 'PAN CV' },
  ];

  constructor(ctx, state = {}) {
    super(ctx, state);
    this.currentMidi = 60; // C4
    this.feltCv = 0;
    this.activeVoices = new Set();

    // Summierender Resonanz- und Ausgangsfilter
    this.soundboard = ctx.createBiquadFilter();
    this.soundboard.type = 'peaking';
    this.soundboard.frequency.value = 180; // Klavier-Klangboden-Resonanz
    this.soundboard.Q.value = 1.2;
    this.soundboard.gain.value = 3.5;

    this.mainFilter = ctx.createBiquadFilter();
    this.mainFilter.type = 'lowpass';
    this.mainFilter.frequency.value = 3200;
    this.mainFilter.Q.value = 0.7;

    this.levelGain = ctx.createGain();
    this.soundboard.connect(this.mainFilter);
    this.mainFilter.connect(this.levelGain);
    this.levelGain.connect(this.output);

    this.initValues(state);
  }

  applyParam(id, val) {
    if (id === 'level') {
      this.ramp(this.levelGain.gain, val);
    } else if (id === 'color') {
      this.ramp(this.mainFilter.frequency, val);
    } else if (id === 'body') {
      this.soundboard.gain.setTargetAtTime(val * 7, this.ctx.currentTime, 0.04);
    }
  }

  onPitch(portId, _time, midiNote) {
    if (portId === 'pitchIn') {
      this.currentMidi = midiNote;
      this.highlightKey?.(Array.isArray(midiNote) ? midiNote[0] : midiNote);
    }
  }

  onModulation(portId, value) {
    if (this.handleSourceModulation(portId, value)) return;
    if (portId === 'feltCv') this.feltCv = (value - 0.5) * 2;
  }

  onTrigger(portId, time, velocity = 1, duration = 0.35) {
    if (portId !== 'gateIn' || !this.enabled) return;
    this.playChord(this.currentMidi, time, velocity, duration);
  }

  /** Spielt eine einzelne Note oder Akkord mit authentischer Klavier-Synthese */
  playChord(rootMidi, time = this.ctx.currentTime, velocity = 0.85, duration = 0.4) {
    if (Array.isArray(rootMidi)) {
      rootMidi.forEach((m, idx) => {
        const noteTime = time + (idx > 0 ? idx * 0.014 : 0);
        const noteVel = velocity * (idx === 0 ? 1 : 0.85);
        this.playPianoNote(m, noteTime, noteVel, duration);
      });
      return;
    }

    const voicing = this.values.chord || 'single';
    let intervals = [0];

    if (voicing === 'octave') intervals = [0, 12];
    else if (voicing === 'fifth') intervals = [0, 7];
    else if (voicing === 'minor9') intervals = [0, 3, 7, 10, 14];
    else if (voicing === 'major7') intervals = [0, 4, 7, 11];
    else if (voicing === 'sus2') intervals = [0, 2, 7, 12];

    intervals.forEach((iv, idx) => {
      // Leichte Verzögerung / Anschlagsdynamik für Akkorde (natürliches Arpeggiieren der Hand)
      const noteTime = time + (idx > 0 ? idx * 0.014 : 0);
      const noteVel = velocity * (idx === 0 ? 1 : 0.82);
      this.playPianoNote(rootMidi + iv, noteTime, noteVel, duration);
    });

    this.highlightKey?.(rootMidi);
  }

  playPianoNote(midi, time, velocity = 1, duration = 0.4) {
    const ctx = this.ctx;
    const f = midiToFreq(midi);
    const { felt, decay, color, body, hammer } = this.values;

    // Dynamischer Filz-Faktor (weicher Anschlag = stärkere Dämpfung der Obertöne)
    const effectiveFelt = Math.max(0, Math.min(1, felt + this.feltCv * 0.3));
    const cutoff = Math.max(250, color * (1 - effectiveFelt * 0.6) * Math.pow(velocity, 0.45));

    // Saiten-Inharmonizität echter Klaviere (B-Faktor)
    const B = 0.0003;
    const f1 = f * Math.sqrt(1 + B);
    const f2 = 2 * f * Math.sqrt(1 + B * 4);
    const f3 = 3 * f * Math.sqrt(1 + B * 9);

    // 1. Grundton + Obertöne (3 Stahlsaiten mit leichter Mikro-Verstimmung)
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const osc3 = ctx.createOscillator();

    osc1.type = 'triangle'; // Warmer, glockiger Grundton
    osc2.type = 'sine';     // Zweite Teilton-Oktave
    osc3.type = 'triangle'; // Dritter Teilton

    osc1.frequency.setValueAtTime(f1, time);
    osc2.frequency.setValueAtTime(f2, time);
    osc3.frequency.setValueAtTime(f3, time);

    // Saiten-Chor (Detuning)
    const det = (this.values.body ?? 0.5) * 5;
    osc1.detune.setValueAtTime(-det, time);
    osc2.detune.setValueAtTime(det * 0.7, time);
    osc3.detune.setValueAtTime(det * 1.5, time);

    // Individuelle Filterung für Saiten-Decay
    const stringFilter = ctx.createBiquadFilter();
    stringFilter.type = 'lowpass';
    stringFilter.frequency.setValueAtTime(cutoff, time);
    // Helligkeit sinkt während des Ausklingens schneller ab als die Lautstärke
    stringFilter.frequency.exponentialRampToValueAtTime(Math.max(120, cutoff * 0.2), time + decay * 0.8);

    // 2. Saiten-VCA (Hüllkurve mit schnellem weichem Attack und langem Decay)
    const stringVca = ctx.createGain();
    const attackTime = 0.004 + effectiveFelt * 0.022; // Gefilzter Hammer braucht 15-25ms
    stringVca.gain.setValueAtTime(0.0001, time);
    stringVca.gain.linearRampToValueAtTime(0.24 * velocity, time + attackTime);
    stringVca.gain.exponentialRampToValueAtTime(0.0001, time + decay);

    osc1.connect(stringFilter);
    osc2.connect(stringFilter);
    osc3.connect(stringFilter);
    stringFilter.connect(stringVca);
    stringVca.connect(this.soundboard);

    // 3. Filz-Hammer-Anschlag (Akustischer Hammer-Transient / Thump)
    if (hammer > 0.05) {
      const noise = ctx.createBufferSource();
      noise.buffer = getNoiseBuffers(ctx).pink;
      const noiseFlt = ctx.createBiquadFilter();
      noiseFlt.type = 'bandpass';
      noiseFlt.frequency.setValueAtTime(140 + (1 - effectiveFelt) * 500, time);
      noiseFlt.Q.setValueAtTime(2.5, time);

      const noiseVca = ctx.createGain();
      noiseVca.gain.setValueAtTime(0.18 * hammer * velocity, time);
      noiseVca.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);

      noise.connect(noiseFlt);
      noiseFlt.connect(noiseVca);
      noiseVca.connect(this.soundboard);

      noise.start(time);
      noise.stop(time + 0.04);
      noise.onended = () => {
        try { noise.disconnect(); noiseFlt.disconnect(); noiseVca.disconnect(); } catch { /* ignore */ }
      };
    }

    // 4. Saiten-Resonanzkasten (Subtiles Dröhnen der Nachbarsaiten)
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.06 * body * velocity, time);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, time + Math.min(1.8, decay * 0.5));
    osc1.connect(bodyGain);
    bodyGain.connect(this.soundboard);

    osc1.start(time);
    osc2.start(time);
    osc3.start(time);

    const stopTime = time + decay + 0.05;
    osc1.stop(stopTime);
    osc2.stop(stopTime);
    osc3.stop(stopTime);

    osc1.onended = () => {
      try {
        osc1.disconnect(); osc2.disconnect(); osc3.disconnect();
        stringFilter.disconnect(); stringVca.disconnect(); bodyGain.disconnect();
      } catch { /* ignore */ }
    };
  }

  handleKey(key, down) {
    const keys = ['a', 'w', 's', 'e', 'd', 'f', 't', 'g', 'z', 'h', 'u', 'j', 'k', 'o', 'l', 'p', 'ö'];
    const idx = keys.indexOf(key.toLowerCase());
    if (idx < 0 || !this.enabled) return false;
    if (down) {
      const base = Number(this.values.octave) || 48;
      this.playChord(base + idx, this.ctx.currentTime, 0.9, 0.45);
    }
    return true;
  }

  /** Render interaktive Klaviatur mit optischer Rückmeldung */
  renderExtra(container, helpers) {
    const baseOctave = Number(this.values.octave) || 48;
    container.innerHTML = `
      <div class="piano-interface">
        <div class="piano-topline">
          <span class="piano-title-lbl">KLAVIATUR · TASTEN &amp; MELODIE</span>
          <span class="piano-note-display">--</span>
        </div>
        <div class="piano-keyboard">
          ${PIANO_KEYS.map((k) => `
            <div class="piano-key ${k.isBlack ? 'black-key' : 'white-key'}" data-rel="${k.midiRel}" data-name="${k.name}" title="${k.name}">
              ${!k.isBlack ? `<span class="piano-key-label">${k.name}</span>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;

    const noteDisplay = container.querySelector('.piano-note-display');
    const keyEls = container.querySelectorAll('.piano-key');

    this.highlightKey = (midi) => {
      const rel = (midi - (Number(this.values.octave) || 48)) % 24;
      noteDisplay.textContent = midiToName(midi);
      keyEls.forEach((el) => {
        if (Number(el.dataset.rel) === rel) {
          el.classList.add('active');
          setTimeout(() => el.classList.remove('active'), 220);
        }
      });
    };

    // Interaktives Spielen per Klick & Touch
    keyEls.forEach((el) => {
      const rel = Number(el.dataset.rel);
      const playThisKey = (e) => {
        e?.preventDefault();
        const base = Number(this.values.octave) || 48;
        const midi = base + rel;
        this.playChord(midi, this.ctx.currentTime, 0.9, 0.5);
        helpers?.changed?.();
      };

      el.addEventListener('pointerdown', playThisKey);
    });
  }
}
