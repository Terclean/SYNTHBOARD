// SYNTHBOARD – Solo Violin / Bowed Strings Modul
// Realistische, intime Solo-Violine mit physikalischer Bogen-Modellierung (Bow Friction & Kolophonium),
// hölzernen Resonanzkörper-Formanten (Fichte & F-Löcher), verzögertem Vibrato,
// Bundlosem Portamento (Finger-Glide) und umschaltbaren Artikulationen (Arco, Pizzicato, Sul Tasto, Tremolo).

import { SourceBase, midiToFreq, midiToName, getNoiseBuffers } from './base.js';

const ARTICULATIONS = [
  ['arco', '🎻 Arco (Gestrichen)'],
  ['pizz', '🤌 Pizzicato (Gezupft)'],
  ['sultasto', '🕊️ Sul Tasto (Sanft & Flötig)'],
  ['tremolo', '〰 Tremolo (Zitternd)'],
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
    { id: 'tone', label: 'Holzkorpus', min: 800, max: 12000, value: 4800, log: true, fmt: 'hz' },
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
    this.bridgeHill.gain.value = 4.8; // Silbriges Singen

    // Dämpfungsfilter (Kolophonium / Helligkeit)
    this.bodyTone = ctx.createBiquadFilter();
    this.bodyTone.type = 'lowpass';
    this.bodyTone.frequency.value = this.values.tone ?? 4800;
    this.bodyTone.Q.value = 0.7;

    // Master-Voice-Mixer & Ausgänge
    this.voiceBus = ctx.createGain();
    this.voiceBus.connect(this.airRes);
    this.airRes.connect(this.woodRes);
    this.woodRes.connect(this.bridgeHill);
    this.bridgeHill.connect(this.bodyTone);
    this.bodyTone.connect(this.output);

    this.initValues(state);
  }

  // ── Modulations- & CV-Handling ──
  onPitch(portId, time, midiNote) {
    if (portId !== 'pitchIn') return;
    const note = Array.isArray(midiNote) ? midiNote[0] : midiNote;
    this.currentMidi = typeof note === 'number' ? Math.round(note) : 69;
    this.targetFreq = midiToFreq(this.currentMidi + (Number(this.values.octave) || 0) * 12);
    this.updateStringFingerboardUi?.();

    // Wenn Gate aktiv ist, portamento gliden
    if (this.activeVoices.size > 0) {
      const now = time || this.ctx.currentTime;
      const glideTime = Math.max(0.005, (this.values.glide ?? 0.14) + this.glideCv * 0.4);
      for (const [, voice] of this.activeVoices) {
        voice.setPitch(this.targetFreq, now, glideTime);
      }
    }
  }

  onTrigger(portId, time, velocity = 1) {
    if (portId === 'gateIn') {
      const oct = Number(this.values.octave) || 0;
      this.noteOn(this.currentMidi + oct * 12, time, velocity);
    }
  }

  onGate(portId, open, time) {
    if (portId === 'gateIn') {
      const oct = Number(this.values.octave) || 0;
      if (open) {
        this.noteOn(this.currentMidi + oct * 12, time, 1);
      } else {
        this.noteOff(this.currentMidi + oct * 12, time);
      }
    }
  }

  onModulation(portId, val) {
    if (this.handleSourceModulation(portId, val)) return;
    if (portId === 'bowCv') this.bowCv = (val - 0.5) * 0.8;
    else if (portId === 'vibratoCv') this.vibratoCv = (val - 0.5) * 0.8;
    else if (portId === 'glideCv') this.glideCv = val;
  }

  applyParam(id, val) {
    if (id === 'tone' && this.bodyTone) {
      this.ramp(this.bodyTone.frequency, val);
    }
  }

  // ── Noten-Logik ──
  noteOn(midi, time = null, velocity = 1) {
    if (!this.enabled) return;
    const t = Math.max(time || this.ctx.currentTime, this.ctx.currentTime);
    const mode = this.values.articulation || 'arco';

    // Bestehende Stimme beenden, falls vorhanden
    if (this.activeVoices.has(midi)) {
      this.activeVoices.get(midi).stop(t);
      this.activeVoices.delete(midi);
    }

    // Monophones Solo-Verhalten mit Legato-Glide wenn schon Töne gehalten werden
    const glideTime = (this.activeVoices.size > 0) ? Math.max(0.01, (this.values.glide ?? 0.14) + this.glideCv * 0.4) : 0.004;

    const voice = new ViolinVoice(this.ctx, this.voiceBus, {
      midi,
      velocity,
      startTime: t,
      mode,
      bow: Math.max(0.05, Math.min(1.0, (this.values.bow ?? 0.55) + this.bowCv)),
      vibrato: Math.max(0, Math.min(1.0, (this.values.vibrato ?? 0.55) + this.vibratoCv)),
      attack: this.values.attack ?? 0.18,
      release: this.values.release ?? 1.2,
      glide: glideTime,
      fromFreq: this.lastFreq || midiToFreq(midi),
    });

    this.activeVoices.set(midi, voice);
    this.lastFreq = midiToFreq(midi);
    this.currentMidi = midi;
    this.updateStringFingerboardUi?.();

    if (mode === 'pizz') {
      // Pizzicato klingt automatisch nach Decay aus
      const dur = Math.max(0.2, (this.values.release ?? 1.2) * 0.6);
      setTimeout(() => {
        if (this.activeVoices.get(midi) === voice) {
          voice.stop(this.ctx.currentTime);
          this.activeVoices.delete(midi);
          this.updateStringFingerboardUi?.();
        }
      }, dur * 1000);
    }
  }

  noteOff(midi, time = null) {
    const t = Math.max(time || this.ctx.currentTime, this.ctx.currentTime);
    const voice = this.activeVoices.get(midi);
    if (voice) {
      const mode = this.values.articulation || 'arco';
      voice.releaseNote(t, mode === 'pizz' ? 0.3 : (this.values.release ?? 1.2));
      this.activeVoices.delete(midi);
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
      this.noteOn(this.currentMidi, this.ctx.currentTime, 0.95);
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
      this.noteOn(this.currentMidi, this.ctx.currentTime, 1.0);
      setTimeout(() => { this.values.articulation = oldMode; }, 200);
    });

    this.updateStringFingerboardUi();
  }

  destroy() {
    for (const [, voice] of this.activeVoices) {
      voice.destroy();
    }
    this.activeVoices.clear();

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

    const t = params.startTime;
    const targetFreq = midiToFreq(this.midi);
    const startFreq = params.fromFreq || targetFreq;

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

    // 3. Kolophonium Bogen-Kratzgeräusch (Pink Noise durch Bogen-Bandpass)
    this.noiseSource = ctx.createBufferSource();
    this.noiseSource.buffer = getNoiseBuffers(ctx).pink;
    this.noiseSource.loop = true;

    this.noiseFilter = ctx.createBiquadFilter();
    this.noiseFilter.type = 'bandpass';
    this.noiseFilter.frequency.setValueAtTime(3200 + this.bow * 1400, t);
    this.noiseFilter.Q.setValueAtTime(3.0, t);

    this.noiseGain = ctx.createGain();
    const bowFriction = (this.mode === 'sultasto') ? 0.03 : (0.08 + this.bow * 0.12) * this.velocity;
    this.noiseGain.gain.setValueAtTime(0.0001, t);
    this.noiseGain.gain.linearRampToValueAtTime(bowFriction, t + Math.min(0.06, this.attack * 0.4));
    // Reibungsgeräusch lässt nach dem ersten Anstrich minimal nach
    this.noiseGain.gain.setTargetAtTime(bowFriction * 0.45, t + Math.min(0.12, this.attack), 0.1);

    this.noiseSource.connect(this.noiseFilter);
    this.noiseFilter.connect(this.noiseGain);

    // 4. Saiten-Filter (Dynamische Helligkeit abhängig von Bogendruck & Anschlag)
    this.stringFilter = ctx.createBiquadFilter();
    this.stringFilter.type = 'lowpass';
    const cutoffBase = (this.mode === 'sultasto') ? 2200 : (2800 + this.bow * 4500) * Math.pow(this.velocity, 0.4);
    this.stringFilter.frequency.setValueAtTime(Math.max(400, cutoffBase * 0.6), t);
    this.stringFilter.frequency.linearRampToValueAtTime(cutoffBase, t + this.attack);
    this.stringFilter.Q.setValueAtTime(1.8, t);

    // 5. Verzögertes natürliches Geigen-Vibrato (setzt erst nach Bogenaufnahme ein)
    this.vibratoOsc = ctx.createOscillator();
    this.vibratoOsc.frequency.setValueAtTime(5.3, t); // Natürliche 5.3 Hz Vibratofrequenz

    this.vibratoGain = ctx.createGain();
    const vibDepthHz = (targetFreq * 0.018) * this.vibrato; // ca. 20-30 Cents
    this.vibratoGain.gain.setValueAtTime(0, t);
    // Sanftes Einblenden des Vibratos nach 180ms
    const vibDelay = (this.mode === 'tremolo') ? 0.02 : 0.22;
    this.vibratoGain.gain.setValueAtTime(0, t + vibDelay);
    this.vibratoGain.gain.linearRampToValueAtTime(vibDepthHz, t + vibDelay + 0.35);

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
      const peakGain = (this.mode === 'sultasto' ? 0.22 : 0.32) * this.velocity;
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
    this.oscSaw.frequency.cancelScheduledValues(time);
    this.oscSub.frequency.cancelScheduledValues(time);
    this.oscSaw.frequency.setTargetAtTime(newFreq, time, Math.max(0.02, glideSec * 0.6));
    this.oscSub.frequency.setTargetAtTime(newFreq, time, Math.max(0.02, glideSec * 0.6));
  }

  releaseNote(time, relSec = 1.2) {
    const t = Math.max(time, this.ctx.currentTime);
    this.voiceVca.gain.cancelScheduledValues(t);
    this.voiceVca.gain.setValueAtTime(this.voiceVca.gain.value, t);
    this.voiceVca.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.08, relSec));

    const stopTime = t + Math.max(0.1, relSec) + 0.05;
    setTimeout(() => {
      this.destroy();
    }, (stopTime - this.ctx.currentTime) * 1000 + 50);
  }

  stop(time) {
    const t = Math.max(time, this.ctx.currentTime);
    this.voiceVca.gain.cancelScheduledValues(t);
    this.voiceVca.gain.setTargetAtTime(0, t, 0.04);
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
      this.noiseGain.disconnect();
      this.stringFilter.disconnect();
      this.vibratoGain.disconnect();
      if (this.tremoloGain) this.tremoloGain.disconnect();
      this.voiceVca.disconnect();
    } catch { /* ignore */ }
  }
}

