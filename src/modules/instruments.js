// SYNTHBOARD – Dedizierte Instrumenten- & Drum-Module
import { ModuleBase, SourceBase, midiToFreq, midiToName, makeSaturationCurve, getNoiseBuffers } from './base.js';

function cleanupOnEnd(node, nodes) {
  node.onended = () => nodes.forEach((n) => { try { n.disconnect(); } catch { /* ignore */ } });
}

export class PluckModule extends SourceBase {
  static type = 'pluck';
  static title = 'Pluck Synth';
  static category = 'source';
  static color = '#14b8a6';
  static icon = '🪕';
  static description = 'Akkustisch-organischer Zupfklang (Harfe / Kalimba / Bell)';
  static params = [
    { id: 'level', label: 'Level', min: 0, max: 1, value: 0.7, fmt: 'pct' },
    { id: 'tone', label: 'Dämpfung', min: 400, max: 9000, value: 3200, log: true, fmt: 'hz' },
    { id: 'damp', label: 'Decay', min: 0.1, max: 3.5, value: 1.1, log: true, fmt: 's' },
    { id: 'bright', label: 'Oberton', min: 0, max: 1, value: 0.65, fmt: 'pct' },
    { id: 'body', label: 'Body', min: 0, max: 1, value: 0.45, fmt: 'pct' },
  ];
  static options = [];
  static jacks = [
    { id: 'gateIn', type: 'in', signal: 'gate', label: 'GATE' },
    { id: 'pitchIn', type: 'in', signal: 'pitch', label: 'PITCH' },
    { id: 'vcaCv', type: 'in', signal: 'mod', label: 'VCA CV' },
    { id: 'panCv', type: 'in', signal: 'mod', label: 'PAN CV' },
    { id: 'modCutoff', type: 'in', signal: 'mod', label: 'FILTER CV' },
  ];

  constructor(ctx, state = {}) {
    super(ctx, state);
    this.currentMidi = 57; // A3
    this.modCv = 0.5;

    this.levelGain = ctx.createGain();
    this.levelGain.connect(this.output);
    this.initValues(state);
  }

  applyParam(id, val) {
    if (id === 'level') this.ramp(this.levelGain.gain, val);
  }

  onPitch(portId, _time, midiNote) {
    if (portId === 'pitchIn') {
      const m = Array.isArray(midiNote) ? midiNote[0] : midiNote;
      this.currentMidi = m;
      this.updateNoteUi?.(m);
    }
  }

  onModulation(portId, value) {
    if (this.handleSourceModulation(portId, value)) return;
    if (portId === 'modCutoff') this.modCv = value;
  }

  onTrigger(portId, time, velocity = 1, duration = 0.2) {
    if (portId !== 'gateIn' || !this.enabled) return;
    this.playPluck(this.currentMidi, time, velocity);
    this.flashUi?.();
  }

  playPluck(midi, time, velocity = 1) {
    const ctx = this.ctx;
    const f = midiToFreq(midi);
    const { tone, damp, bright, body } = this.values;

    // Dual Detuned Oszillatoren
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = 'triangle';
    osc2.type = 'sawtooth';
    osc1.frequency.setValueAtTime(f, time);
    osc2.frequency.setValueAtTime(f * 1.003, time);

    // Initialer Noise-Klick (Pluck-Anschlag)
    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffers(ctx).pink;
    const noiseFlt = ctx.createBiquadFilter();
    noiseFlt.type = 'bandpass';
    noiseFlt.frequency.value = f * 3;
    noiseFlt.Q.value = 2.5;

    const noiseEnv = ctx.createGain();
    noiseEnv.gain.setValueAtTime(bright * 0.45 * velocity, time);
    noiseEnv.gain.exponentialRampToValueAtTime(0.0001, time + 0.025);
    noise.connect(noiseFlt);
    noiseFlt.connect(noiseEnv);

    // Resonanter Dämpfungsfilter
    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass';
    const effectiveTone = Math.min(16000, tone * (0.6 + this.modCv * 1.4));
    flt.frequency.setValueAtTime(effectiveTone * (1 + bright * 2), time);
    flt.frequency.exponentialRampToValueAtTime(effectiveTone * 0.4, time + damp * 0.6);
    flt.Q.value = 1.0 + body * 4.0;

    // Amplitude VCA
    const vca = ctx.createGain();
    vca.gain.setValueAtTime(0, time);
    vca.gain.linearRampToValueAtTime(0.35 * velocity, time + 0.003);
    vca.gain.exponentialRampToValueAtTime(0.0001, time + damp * 2.2);

    osc1.connect(flt);
    osc2.connect(flt);
    noiseEnv.connect(flt);
    flt.connect(vca);
    vca.connect(this.levelGain);

    const end = time + damp * 2.3 + 0.05;
    osc1.start(time); osc2.start(time); noise.start(time);
    osc1.stop(end); osc2.stop(end); noise.stop(end);

    cleanupOnEnd(osc1, [osc1, osc2, noise, noiseFlt, noiseEnv, flt, vca]);
  }

  renderExtra(el) {
    el.innerHTML = `
      <div class="voice-preview">
        <div class="v-note">${midiToName(this.currentMidi)}</div>
        <button class="mini-btn btn-trig">▶ Pluck Test</button>
      </div>`;
    const noteEl = el.querySelector('.v-note');
    this.updateNoteUi = (m) => { if (noteEl) noteEl.textContent = midiToName(m); };
    this.flashUi = () => {
      noteEl.classList.add('flash');
      setTimeout(() => noteEl.classList.remove('flash'), 120);
    };
    el.querySelector('.btn-trig').addEventListener('click', () => {
      this.playPluck(this.currentMidi, this.ctx.currentTime, 1);
      this.flashUi();
    });
  }
}

// ───────────────────────────────────────────── 2. FM METALLIC SYNTH ──
export class FmVoiceModule extends SourceBase {
  static type = 'fm_voice';
  static title = 'FM Bell & Metal';
  static category = 'source';
  static color = '#0ea5e9';
  static icon = '🔔';
  static description = '2-Operator FM-Klangsynthese für metallische Bells & Gongs';
  static params = [
    { id: 'level', label: 'Level', min: 0, max: 1, value: 0.65, fmt: 'pct' },
    { id: 'ratio', label: 'Ratio', min: 0.5, max: 7.0, value: 2.76, fmt: 'num' },
    { id: 'index', label: 'FM Index', min: 0, max: 8.0, value: 2.4, fmt: 'num' },
    { id: 'decay', label: 'Decay', min: 0.1, max: 4.0, value: 1.4, log: true, fmt: 's' },
    { id: 'tone', label: 'Tone', min: 600, max: 14000, value: 5500, log: true, fmt: 'hz' },
  ];
  static options = [];
  static jacks = [
    { id: 'gateIn', type: 'in', signal: 'gate', label: 'GATE' },
    { id: 'pitchIn', type: 'in', signal: 'pitch', label: 'PITCH' },
    { id: 'vcaCv', type: 'in', signal: 'mod', label: 'VCA CV' },
    { id: 'panCv', type: 'in', signal: 'mod', label: 'PAN CV' },
    { id: 'modIndex', type: 'in', signal: 'mod', label: 'FM MOD' },
  ];

  constructor(ctx, state = {}) {
    super(ctx, state);
    this.currentMidi = 69; // A4
    this.modCv = 0.5;

    this.levelGain = ctx.createGain();
    this.levelGain.connect(this.output);
    this.initValues(state);
  }

  applyParam(id, val) {
    if (id === 'level') this.ramp(this.levelGain.gain, val);
  }

  onPitch(portId, _time, midiNote) {
    if (portId === 'pitchIn') {
      const m = Array.isArray(midiNote) ? midiNote[0] : midiNote;
      this.currentMidi = m;
      this.updateNoteUi?.(m);
    }
  }

  onModulation(portId, value) {
    if (this.handleSourceModulation(portId, value)) return;
    if (portId === 'modIndex') this.modCv = value;
  }

  onTrigger(portId, time, velocity = 1) {
    if (portId !== 'gateIn' || !this.enabled) return;
    this.playFm(this.currentMidi, time, velocity);
    this.flashUi?.();
  }

  playFm(midi, time, velocity = 1) {
    const ctx = this.ctx;
    const carrierFreq = midiToFreq(midi);
    const { ratio, index, decay, tone } = this.values;
    const modFreq = carrierFreq * ratio;
    const modDepth = index * (0.5 + this.modCv) * carrierFreq;

    // Träger- und Modulator-Oszillatoren
    const carrier = ctx.createOscillator();
    const modulator = ctx.createOscillator();
    carrier.type = 'sine';
    modulator.type = 'sine';
    carrier.frequency.setValueAtTime(carrierFreq, time);
    modulator.frequency.setValueAtTime(modFreq, time);

    // FM Modulator Hüllkurve
    const modGain = ctx.createGain();
    modGain.gain.setValueAtTime(modDepth * velocity, time);
    modGain.gain.exponentialRampToValueAtTime(Math.max(1, modDepth * 0.05), time + decay * 0.8);
    modGain.gain.linearRampToValueAtTime(0, time + decay * 1.5);
    modulator.connect(modGain);
    modGain.connect(carrier.frequency);

    // Filter
    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(tone, time);

    // VCA
    const vca = ctx.createGain();
    vca.gain.setValueAtTime(0, time);
    vca.gain.linearRampToValueAtTime(0.32 * velocity, time + 0.003);
    vca.gain.exponentialRampToValueAtTime(0.0001, time + decay * 2.0);

    carrier.connect(flt);
    flt.connect(vca);
    vca.connect(this.levelGain);

    const end = time + decay * 2.1 + 0.05;
    carrier.start(time); modulator.start(time);
    carrier.stop(end); modulator.stop(end);

    cleanupOnEnd(carrier, [carrier, modulator, modGain, flt, vca]);
  }

  renderExtra(el) {
    el.innerHTML = `
      <div class="voice-preview">
        <div class="v-note">${midiToName(this.currentMidi)}</div>
        <button class="mini-btn btn-trig">▶ Bell Test</button>
      </div>`;
    const noteEl = el.querySelector('.v-note');
    this.updateNoteUi = (m) => { if (noteEl) noteEl.textContent = midiToName(m); };
    this.flashUi = () => {
      noteEl.classList.add('flash');
      setTimeout(() => noteEl.classList.remove('flash'), 120);
    };
    el.querySelector('.btn-trig').addEventListener('click', () => {
      this.playFm(this.currentMidi, this.ctx.currentTime, 1);
      this.flashUi();
    });
  }
}

// ───────────────────────────────────────────── 3. ANALOG BASS ──
export class BassModule extends SourceBase {
  static type = 'bass';
  static title = 'Analog Bass';
  static category = 'source';
  static color = '#ef4444';
  static icon = '⚡';
  static description = 'Warmer analoger Sub-Bass mit Filter-Hüllkurve & Sättigung';
  static params = [
    { id: 'level', label: 'Level', min: 0, max: 1, value: 0.75, fmt: 'pct' },
    { id: 'cutoff', label: 'Cutoff', min: 60, max: 3500, value: 550, log: true, fmt: 'hz' },
    { id: 'reso', label: 'Reso', min: 0.5, max: 16, value: 4.8, fmt: 'num' },
    { id: 'env', label: 'Env Amt', min: 0, max: 1, value: 0.6, fmt: 'pct' },
    { id: 'decay', label: 'Decay', min: 0.08, max: 2.2, value: 0.55, log: true, fmt: 's' },
    { id: 'sub', label: 'Sub Bass', min: 0, max: 1, value: 0.45, fmt: 'pct' },
  ];
  static options = [];
  static jacks = [
    { id: 'gateIn', type: 'in', signal: 'gate', label: 'GATE' },
    { id: 'pitchIn', type: 'in', signal: 'pitch', label: 'PITCH' },
    { id: 'vcaCv', type: 'in', signal: 'mod', label: 'VCA CV' },
    { id: 'panCv', type: 'in', signal: 'mod', label: 'PAN CV' },
    { id: 'modCutoff', type: 'in', signal: 'mod', label: 'CUTOFF CV' },
  ];

  constructor(ctx, state = {}) {
    super(ctx, state);
    this.currentMidi = 33; // A1
    this.modCv = 0.5;

    this.levelGain = ctx.createGain();
    this.levelGain.connect(this.output);
    this.satCurve = makeSaturationCurve(1.5, 1024);
    this.initValues(state);
  }

  applyParam(id, val) {
    if (id === 'level') this.ramp(this.levelGain.gain, val);
  }

  onPitch(portId, _time, midiNote) {
    if (portId === 'pitchIn') {
      const m = Array.isArray(midiNote) ? midiNote[0] : midiNote;
      this.currentMidi = m;
      this.updateNoteUi?.(m);
    }
  }

  onModulation(portId, value) {
    if (this.handleSourceModulation(portId, value)) return;
    if (portId === 'modCutoff') this.modCv = value;
  }

  onTrigger(portId, time, velocity = 1) {
    if (portId !== 'gateIn' || !this.enabled) return;
    this.playBass(this.currentMidi, time, velocity);
    this.flashUi?.();
  }

  playBass(midi, time, velocity = 1) {
    const ctx = this.ctx;
    const f = midiToFreq(midi);
    const { cutoff, reso, env, decay, sub } = this.values;

    // Oszillatoren: Hauptoszillator (Saw) + Sub-Oszillator (Square, eine Oktave tiefer)
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.type = 'sawtooth';
    o2.type = 'square';
    o1.frequency.setValueAtTime(f, time);
    o2.frequency.setValueAtTime(f * 0.5, time); // -1 Oktave

    const mix = ctx.createGain();
    const subGain = ctx.createGain();
    subGain.gain.value = sub * 0.8;
    o1.connect(mix);
    o2.connect(subGain);
    subGain.connect(mix);

    // Kaskadierter 24dB Tiefpassfilter
    const flt1 = ctx.createBiquadFilter();
    const flt2 = ctx.createBiquadFilter();
    flt1.type = flt2.type = 'lowpass';
    flt1.Q.value = flt2.Q.value = reso * 0.7;

    const effCutoff = Math.max(50, Math.min(14000, cutoff * (0.5 + this.modCv * 1.5)));
    const peakCutoff = Math.min(14000, effCutoff * (1 + env * 12 * velocity));
    [flt1, flt2].forEach((flt) => {
      flt.frequency.setValueAtTime(peakCutoff, time);
      flt.frequency.setTargetAtTime(effCutoff, time + 0.005, decay * 0.35);
    });

    // Weiche Sättigung / Overdrive
    const waveShaper = ctx.createWaveShaper();
    waveShaper.curve = this.satCurve;

    // Amplitude VCA
    const vca = ctx.createGain();
    vca.gain.setValueAtTime(0, time);
    vca.gain.linearRampToValueAtTime(0.38 * velocity, time + 0.004);
    vca.gain.exponentialRampToValueAtTime(0.0001, time + decay * 2.2);

    mix.connect(flt1);
    flt1.connect(flt2);
    flt2.connect(waveShaper);
    waveShaper.connect(vca);
    vca.connect(this.levelGain);

    const end = time + decay * 2.3 + 0.05;
    o1.start(time); o2.start(time);
    o1.stop(end); o2.stop(end);

    cleanupOnEnd(o1, [o1, o2, mix, subGain, flt1, flt2, waveShaper, vca]);
  }

  renderExtra(el) {
    el.innerHTML = `
      <div class="voice-preview">
        <div class="v-note">${midiToName(this.currentMidi)}</div>
        <button class="mini-btn btn-trig">▶ Bass Test</button>
      </div>`;
    const noteEl = el.querySelector('.v-note');
    this.updateNoteUi = (m) => { if (noteEl) noteEl.textContent = midiToName(m); };
    this.flashUi = () => {
      noteEl.classList.add('flash');
      setTimeout(() => noteEl.classList.remove('flash'), 120);
    };
    el.querySelector('.btn-trig').addEventListener('click', () => {
      this.playBass(this.currentMidi, this.ctx.currentTime, 1);
      this.flashUi();
    });
  }
}

// ───────────────────────────────────────────── 4. DRUM RACK ──
export class DrumRackModule extends SourceBase {
  static type = 'drum_rack';
  static title = 'Drum Rack';
  static category = 'source';
  static color = '#e11d48';
  static icon = '🥁';
  static description = '4 analoge Drum-Stimmen (Kick, Snare, Hi-Hat, Percussion) mit Trigger-Inputs';
  static params = [
    { id: 'level', label: 'Master', min: 0, max: 1, value: 0.8, fmt: 'pct' },
    { id: 'kDecay', label: 'Kick Dec', min: 0.1, max: 1.2, value: 0.45, fmt: 's' },
    { id: 'sSnap', label: 'Snare Snappy', min: 0.1, max: 1, value: 0.65, fmt: 'pct' },
    { id: 'hDecay', label: 'Hat Dec', min: 0.03, max: 0.6, value: 0.12, fmt: 's' },
    { id: 'pTune', label: 'Perc Tune', min: 120, max: 900, value: 380, log: true, fmt: 'hz' },
  ];
  static options = [];
  static jacks = [
    { id: 'trigKick', type: 'in', signal: 'gate', label: 'KICK IN' },
    { id: 'trigSnare', type: 'in', signal: 'gate', label: 'SNARE IN' },
    { id: 'trigHat', type: 'in', signal: 'gate', label: 'HI-HAT IN' },
    { id: 'trigPerc', type: 'in', signal: 'gate', label: 'PERC IN' },
    { id: 'vcaCv', type: 'in', signal: 'mod', label: 'VCA CV' },
    { id: 'panCv', type: 'in', signal: 'mod', label: 'PAN CV' },
  ];

  constructor(ctx, state = {}) {
    super(ctx, state);
    this.levelGain = ctx.createGain();
    this.levelGain.connect(this.output);
    this.initValues(state);
  }

  applyParam(id, val) {
    if (id === 'level') this.ramp(this.levelGain.gain, val);
  }

  onModulation(portId, value) {
    if (this.handleSourceModulation(portId, value)) return;
  }

  onTrigger(portId, time, velocity = 1) {
    if (!this.enabled) return;
    if (portId === 'trigKick') { this.hitKick(time, velocity); this.flashPad?.('k'); }
    else if (portId === 'trigSnare') { this.hitSnare(time, velocity); this.flashPad?.('s'); }
    else if (portId === 'trigHat') { this.hitHat(time, velocity); this.flashPad?.('h'); }
    else if (portId === 'trigPerc') { this.hitPerc(time, velocity); this.flashPad?.('p'); }
  }

  hitKick(time, velocity = 1) {
    const ctx = this.ctx;
    const decay = this.values.kDecay || 0.45;

    // Pitch Drop Sweep (140 Hz -> 42 Hz)
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(145, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.07);

    // Click Transient
    const click = ctx.createOscillator();
    click.type = 'triangle';
    click.frequency.setValueAtTime(320, time);
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.6 * velocity, time);
    clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.015);
    click.connect(clickGain);

    const vca = ctx.createGain();
    vca.gain.setValueAtTime(0, time);
    vca.gain.linearRampToValueAtTime(0.6 * velocity, time + 0.003);
    vca.gain.exponentialRampToValueAtTime(0.0001, time + decay);

    osc.connect(vca);
    clickGain.connect(vca);
    vca.connect(this.levelGain);

    osc.start(time); click.start(time);
    osc.stop(time + decay + 0.02); click.stop(time + 0.03);
    cleanupOnEnd(osc, [osc, click, clickGain, vca]);
  }

  hitSnare(time, velocity = 1) {
    const ctx = this.ctx;
    const snap = this.values.sSnap || 0.65;

    // Tonaler Körper (Dual-Tone)
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.type = 'triangle';
    o2.type = 'sine';
    o1.frequency.setValueAtTime(185, time);
    o2.frequency.setValueAtTime(330, time);
    o1.frequency.exponentialRampToValueAtTime(130, time + 0.08);

    const toneGain = ctx.createGain();
    toneGain.gain.setValueAtTime(0.35 * velocity, time);
    toneGain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
    o1.connect(toneGain); o2.connect(toneGain);

    // Rausch-Teppich (Snappy)
    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffers(ctx).white;
    const nFlt = ctx.createBiquadFilter();
    nFlt.type = 'highpass';
    nFlt.frequency.value = 1600;

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(snap * 0.4 * velocity, time);
    nGain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
    noise.connect(nFlt);
    nFlt.connect(nGain);

    toneGain.connect(this.levelGain);
    nGain.connect(this.levelGain);

    o1.start(time); o2.start(time); noise.start(time);
    o1.stop(time + 0.15); o2.stop(time + 0.15); noise.stop(time + 0.25);
    cleanupOnEnd(noise, [o1, o2, toneGain, noise, nFlt, nGain]);
  }

  hitHat(time, velocity = 1) {
    const ctx = this.ctx;
    const decay = this.values.hDecay || 0.12;

    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffers(ctx).white;

    const flt = ctx.createBiquadFilter();
    flt.type = 'highpass';
    flt.frequency.value = 7500;
    flt.Q.value = 3.5;

    const vca = ctx.createGain();
    vca.gain.setValueAtTime(0.35 * velocity, time);
    vca.gain.exponentialRampToValueAtTime(0.0001, time + decay);

    noise.connect(flt);
    flt.connect(vca);
    vca.connect(this.levelGain);

    noise.start(time);
    noise.stop(time + decay + 0.02);
    cleanupOnEnd(noise, [noise, flt, vca]);
  }

  hitPerc(time, velocity = 1) {
    const ctx = this.ctx;
    const tune = this.values.pTune || 380;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(tune * 1.5, time);
    osc.frequency.exponentialRampToValueAtTime(tune, time + 0.03);

    const vca = ctx.createGain();
    vca.gain.setValueAtTime(0.4 * velocity, time);
    vca.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);

    osc.connect(vca);
    vca.connect(this.levelGain);

    osc.start(time);
    osc.stop(time + 0.2);
    cleanupOnEnd(osc, [osc, vca]);
  }

  renderExtra(el) {
    el.innerHTML = `
      <div class="drum-pads">
        <button class="d-pad pad-k" data-v="k">KICK</button>
        <button class="d-pad pad-s" data-v="s">SNARE</button>
        <button class="d-pad pad-h" data-v="h">HAT</button>
        <button class="d-pad pad-p" data-v="p">PERC</button>
      </div>`;
    const pk = el.querySelector('.pad-k');
    const ps = el.querySelector('.pad-s');
    const ph = el.querySelector('.pad-h');
    const pp = el.querySelector('.pad-p');

    this.flashPad = (v) => {
      const map = { k: pk, s: ps, h: ph, p: pp };
      const n = map[v];
      if (n) {
        n.classList.add('flash');
        setTimeout(() => n.classList.remove('flash'), 120);
      }
    };

    pk.addEventListener('click', () => { this.hitKick(this.ctx.currentTime, 1); this.flashPad('k'); });
    ps.addEventListener('click', () => { this.hitSnare(this.ctx.currentTime, 1); this.flashPad('s'); });
    ph.addEventListener('click', () => { this.hitHat(this.ctx.currentTime, 1); this.flashPad('h'); });
    pp.addEventListener('click', () => { this.hitPerc(this.ctx.currentTime, 1); this.flashPad('p'); });
  }
}
