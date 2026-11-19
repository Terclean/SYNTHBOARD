// Effekt-Module: Filter, Delay, Reverb, Chorus, Tremolo, Lo-Fi
// Alle Rückkopplungen sind so begrenzt, dass die Schleifenverstärkung < 1 bleibt
// (der alte Reverb hatte ~3.5 → Signal explodierte zu NaN → dauerhafte Stille).
import { EffectBase, makeSaturationCurve } from './base.js';

/** Equal-Power Dry/Wet-Mix innerhalb eines Effekts */
function mixGains(mix) {
  return { dry: Math.cos(mix * Math.PI / 2), wet: Math.sin(mix * Math.PI / 2) };
}

// ───────────────────────────────────────────── FILTER ──
export class FilterModule extends EffectBase {
  static type = 'filter';
  static title = 'Analog Filter';
  static color = '#ff5d73';
  static icon = '⌇';
  static description = '24dB Filter mit Drive & LFO-Sweep';
  static params = [
    { id: 'cutoff', label: 'Cutoff', min: 40, max: 16000, value: 2200, log: true, fmt: 'hz' },
    { id: 'reso', label: 'Reso', min: 0.5, max: 15, value: 2.5, fmt: 'num' },
    { id: 'drive', label: 'Drive', min: 0, max: 1, value: 0.2, fmt: 'pct' },
    { id: 'lfoRate', label: 'LFO Rate', min: 0.02, max: 10, value: 0.15, log: true, fmt: 'hz' },
    { id: 'lfoDepth', label: 'LFO Tiefe', min: 0, max: 1, value: 0.35, fmt: 'pct' },
  ];
  static options = [
    { id: 'ftype', label: 'Typ', choices: [['lowpass', 'Lowpass'], ['highpass', 'Highpass'], ['bandpass', 'Bandpass']], value: 'lowpass' },
  ];
  static jacks = [
    { id: 'cvCutoff', type: 'in', signal: 'mod', label: 'CUTOFF CV' },
  ];

  constructor(ctx, state = {}) {
    super(ctx, state);
    this.pre = ctx.createGain();
    this.shaper = ctx.createWaveShaper();
    this.shaper.curve = makeSaturationCurve(1.2);
    this.shaper.oversample = '4x';
    this.deHarsh = ctx.createBiquadFilter();
    this.deHarsh.type = 'lowpass';
    this.deHarsh.frequency.value = 9000;
    this.deHarsh.Q.value = 0.5;
    this.post = ctx.createGain();
    this.f1 = ctx.createBiquadFilter();
    this.f2 = ctx.createBiquadFilter();
    this.input.connect(this.pre);
    this.pre.connect(this.shaper);
    this.shaper.connect(this.deHarsh);
    this.deHarsh.connect(this.f1);
    this.f1.connect(this.f2);
    this.f2.connect(this.post);
    this.post.connect(this.wet);

    // LFO moduliert "detune" (Cent) → musikalischer, multiplikativer Sweep
    this.lfo = ctx.createOscillator();
    this.lfoGain = ctx.createGain();
    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.f1.detune);
    this.lfoGain.connect(this.f2.detune);
    this.start(this.lfo);
    this.initValues(state);
  }

  onModulation(portId, val, time) {
    if (portId === 'cvCutoff') {
      const base = this.values.cutoff || 2200;
      const target = Math.max(40, Math.min(16000, base * Math.pow(2, (val - 0.5) * 4)));
      const t = time || this.ctx.currentTime;
      this.f1.frequency.setTargetAtTime(target, t, 0.04);
      this.f2.frequency.setTargetAtTime(target, t, 0.04);
    }
  }

  applyParam(id, val) {
    switch (id) {
      case 'cutoff': this.ramp(this.f1.frequency, val); this.ramp(this.f2.frequency, val); break;
      case 'reso': this.ramp(this.f1.Q, val); this.ramp(this.f2.Q, Math.max(0.5, val * 0.4)); break;
      case 'drive':
        this.shaper.curve = makeSaturationCurve(0.8 + val * 2.2);
        this.ramp(this.pre.gain, 0.85 + val * 1.6);
        this.ramp(this.post.gain, 1.05 / (1 + val * 0.7));
        break;
      case 'lfoRate': this.ramp(this.lfo.frequency, val); break;
      case 'lfoDepth': this.ramp(this.lfoGain.gain, val * 2400); break;
      case 'ftype': this.f1.type = val; this.f2.type = val; break;
    }
  }
}

// ───────────────────────────────────────────── DELAY ──
export class DelayModule extends EffectBase {
  static type = 'delay';
  static title = 'Stereo Delay';
  static color = '#ffcc4d';
  static icon = '◎';
  static description = 'Analoges Echo mit Ping-Pong & Tape-Wobble';
  static params = [
    { id: 'time', label: 'Time', min: 0.05, max: 1.5, value: 0.42, log: true, fmt: 's' },
    { id: 'feedback', label: 'Feedback', min: 0, max: 1, value: 0.5, fmt: 'pct' },
    { id: 'tone', label: 'Tone', min: 400, max: 9000, value: 2600, log: true, fmt: 'hz' },
    { id: 'mod', label: 'Wobble', min: 0, max: 1, value: 0.25, fmt: 'pct' },
    { id: 'mix', label: 'Mix', min: 0, max: 1, value: 0.4, fmt: 'pct' },
  ];
  static jacks = [
    { id: 'cvTime', type: 'in', signal: 'mod', label: 'TIME CV' },
  ];
  static options = [
    { id: 'mode', label: 'Modus', choices: [['stereo', 'Stereo'], ['pingpong', 'Ping-Pong']], value: 'stereo' },
  ];

  constructor(ctx, state = {}) {
    super(ctx, state);
    const mk = () => ctx.createGain();
    this.dryMix = mk(); this.wetMix = mk();
    this.inL = mk(); this.inR = mk();
    this.dL = ctx.createDelay(2); this.dR = ctx.createDelay(2);
    this.toneL = ctx.createBiquadFilter(); this.toneR = ctx.createBiquadFilter();
    this.hpL = ctx.createBiquadFilter(); this.hpR = ctx.createBiquadFilter();
    [this.hpL, this.hpR].forEach((h) => { h.type = 'highpass'; h.frequency.value = 120; });
    this.fbL = mk(); this.fbR = mk(); this.xLR = mk(); this.xRL = mk();
    this.merger = ctx.createChannelMerger(2);

    this.input.connect(this.dryMix); this.dryMix.connect(this.wet);
    this.input.connect(this.inL); this.input.connect(this.inR);
    this.inL.connect(this.dL); this.inR.connect(this.dR);

    // L-Kanal: delay → tone → hp → (fb → delay | cross → R | out)
    this.dL.connect(this.toneL); this.toneL.connect(this.hpL);
    this.hpL.connect(this.fbL); this.fbL.connect(this.dL);
    this.hpL.connect(this.xLR); this.xLR.connect(this.dR);
    this.hpL.connect(this.merger, 0, 0);
    // R-Kanal
    this.dR.connect(this.toneR); this.toneR.connect(this.hpR);
    this.hpR.connect(this.fbR); this.fbR.connect(this.dR);
    this.hpR.connect(this.xRL); this.xRL.connect(this.dL);
    this.hpR.connect(this.merger, 0, 1);

    this.merger.connect(this.wetMix); this.wetMix.connect(this.wet);

    this.lfo = ctx.createOscillator();
    this.lfo.frequency.value = 0.7;
    this.modL = mk(); this.modR = mk();
    this.lfo.connect(this.modL); this.lfo.connect(this.modR);
    this.modL.connect(this.dL.delayTime); this.modR.connect(this.dR.delayTime);
    this.start(this.lfo);
    this.initValues(state);
  }

  updateRouting() {
    const pp = this.values.mode === 'pingpong';
    const fb = Math.min(0.88, (this.values.feedback ?? 0.5) * 0.88);
    const t = this.values.time ?? 0.42;
    this.ramp(this.fbL.gain, pp ? 0 : fb);
    this.ramp(this.fbR.gain, pp ? 0 : fb);
    this.ramp(this.xLR.gain, pp ? fb : 0);
    this.ramp(this.xRL.gain, pp ? fb : 0);
    this.ramp(this.inR.gain, pp ? 0 : 1);
    this.ramp(this.dL.delayTime, t, 0.06);
    this.ramp(this.dR.delayTime, pp ? t : Math.min(1.95, t * 1.25), 0.06);
  }

  applyParam(id, val) {
    switch (id) {
      case 'tone': this.ramp(this.toneL.frequency, val); this.ramp(this.toneR.frequency, val); break;
      case 'mod': this.ramp(this.modL.gain, val * 0.004); this.ramp(this.modR.gain, -val * 0.004); break;
      case 'mix': { const m = mixGains(val); this.ramp(this.dryMix.gain, m.dry); this.ramp(this.wetMix.gain, m.wet); break; }
      default: this.updateRouting();
    }
  }

  onModulation(portId, val, time) {
    if (portId === 'cvTime') {
      const base = this.values.time ?? 0.42;
      const target = Math.max(0.04, Math.min(1.8, base * (0.3 + val * 1.4)));
      const t = time || this.ctx.currentTime;
      this.dL.delayTime.setTargetAtTime(target, t, 0.06);
      this.dR.delayTime.setTargetAtTime(this.values.mode === 'pingpong' ? target : target * 1.25, t, 0.06);
    }
  }
}

// ───────────────────────────────────────────── REVERB ──
export class ReverbModule extends EffectBase {
  static type = 'reverb';
  static title = 'Ambient Reverb';
  static color = '#6ee7a8';
  static icon = '❂';
  static description = 'Großer, stabiler Hall (Convolution) bis 15 s';
  static params = [
    { id: 'decay', label: 'Decay', min: 0.4, max: 15, value: 5, log: true, fmt: 's' },
    { id: 'damp', label: 'Dämpfung', min: 0, max: 1, value: 0.6, fmt: 'pct' },
    { id: 'predelay', label: 'Pre-Delay', min: 0, max: 0.25, value: 0.03, fmt: 's' },
    { id: 'tone', label: 'Tone', min: 500, max: 14000, value: 3200, log: true, fmt: 'hz' },
    { id: 'mix', label: 'Mix', min: 0, max: 1, value: 0.45, fmt: 'pct' },
  ];
  static jacks = [
    { id: 'cvMix', type: 'in', signal: 'mod', label: 'MIX CV' },
  ];

  constructor(ctx, state = {}) {
    super(ctx, state);
    this.dryMix = ctx.createGain();
    this.wetMix = ctx.createGain();
    this.hpF = ctx.createBiquadFilter();
    this.hpF.type = 'highpass';
    this.hpF.frequency.value = 95; // Hält Subbass aus dem Hall für klare tiefe Mitte
    this.pre = ctx.createDelay(0.5);
    this.toneF = ctx.createBiquadFilter();
    this.toneF.type = 'lowpass';
    this.input.connect(this.dryMix);
    this.dryMix.connect(this.wet);
    this.input.connect(this.hpF);
    this.hpF.connect(this.pre);
    this.toneF.connect(this.wetMix);
    this.wetMix.connect(this.wet);
    this.conv = null;
    this.convGain = null;
    this.irTimer = null;
    this.initValues(state);
    this.buildIR(true);
  }

  /** Erzeugt eine Stereo-Impulsantwort: abklingendes Rauschen, das mit der Zeit dunkler wird */
  buildIR(immediate = false) {
    clearTimeout(this.irTimer);
    const run = () => {
      const ctx = this.ctx;
      const decay = this.values.decay ?? 5;
      const damp = this.values.damp ?? 0.6;
      const sr = ctx.sampleRate;
      const len = Math.floor(sr * Math.min(16, decay * 1.1 + 0.2));
      const buf = ctx.createBuffer(2, len, sr);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        let lp = 0;
        for (let i = 0; i < len; i++) {
          const t = i / sr;
          const env = Math.exp((-6.9 * t) / decay) * Math.min(1, t / 0.005);
          // Tiefpass-Koeffizient sinkt über die Zeit → Höhen klingen schneller ab
          const a = Math.max(0.02, 1 - damp * Math.min(1, t / (decay * 0.6)) * 0.97);
          lp += a * ((Math.random() * 2 - 1) - lp);
          d[i] = lp * env;
        }
      }
      const conv = ctx.createConvolver();
      conv.normalize = true;
      conv.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = 0;
      this.pre.connect(conv);
      conv.connect(g);
      g.connect(this.toneF);
      g.gain.setTargetAtTime(0.9, ctx.currentTime, 0.08);
      // altes Faltungsnetz weich ausblenden
      if (this.conv) {
        const oldC = this.conv, oldG = this.convGain;
        oldG.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
        setTimeout(() => { try { this.pre.disconnect(oldC); oldC.disconnect(); oldG.disconnect(); } catch { /* ignore */ } }, 600);
      }
      this.conv = conv;
      this.convGain = g;
    };
    if (immediate) run(); else this.irTimer = setTimeout(run, 180);
  }

  applyParam(id, val) {
    switch (id) {
      case 'predelay': this.ramp(this.pre.delayTime, val); break;
      case 'tone': this.ramp(this.toneF.frequency, val); break;
      case 'mix': { const m = mixGains(val); this.ramp(this.dryMix.gain, m.dry); this.ramp(this.wetMix.gain, m.wet * 1.1); break; }
      case 'decay': case 'damp': if (this.conv && !this.patchSystem?.engine?.isMorphing) this.buildIR(); break;
    }
  }

  onModulation(portId, val, time) {
    if (portId === 'cvMix') {
      const base = this.values.mix ?? 0.45;
      const eff = Math.max(0, Math.min(1, base + (val - 0.5) * 0.5));
      const m = mixGains(eff);
      const t = time || this.ctx.currentTime;
      this.dryMix.gain.setTargetAtTime(m.dry, t, 0.05);
      this.wetMix.gain.setTargetAtTime(m.wet * 1.1, t, 0.05);
    }
  }

  destroy() {
    clearTimeout(this.irTimer);
    try {
      if (this.conv) { this.pre.disconnect(this.conv); this.conv.disconnect(); }
      if (this.convGain) this.convGain.disconnect();
      if (this.dryMix) this.dryMix.disconnect();
      if (this.wetMix) this.wetMix.disconnect();
      if (this.toneF) this.toneF.disconnect();
      if (this.pre) this.pre.disconnect();
      if (this.hpF) this.hpF.disconnect();
    } catch { /* ignore */ }
    this.conv = null;
    this.convGain = null;
    super.destroy();
  }
}

// ───────────────────────────────────────────── CHORUS ──
export class ChorusModule extends EffectBase {
  static type = 'chorus';
  static title = 'Chorus';
  static color = '#5ec8ff';
  static icon = '∿';
  static description = 'Breiter Stereo-Chorus / Ensemble';
  static params = [
    { id: 'rate', label: 'Rate', min: 0.05, max: 6, value: 0.6, log: true, fmt: 'hz' },
    { id: 'depth', label: 'Tiefe', min: 0, max: 1, value: 0.5, fmt: 'pct' },
    { id: 'delay', label: 'Delay', min: 0.005, max: 0.04, value: 0.016, fmt: 's' },
    { id: 'mix', label: 'Mix', min: 0, max: 1, value: 0.5, fmt: 'pct' },
  ];

  constructor(ctx, state = {}) {
    super(ctx, state);
    this.dryMix = ctx.createGain();
    this.wetMix = ctx.createGain();
    this.dL = ctx.createDelay(0.1);
    this.dR = ctx.createDelay(0.1);
    this.merger = ctx.createChannelMerger(2);
    this.lfo = ctx.createOscillator();
    this.modL = ctx.createGain();
    this.modR = ctx.createGain();
    this.lfo.connect(this.modL); this.lfo.connect(this.modR);
    this.modL.connect(this.dL.delayTime); this.modR.connect(this.dR.delayTime);
    this.input.connect(this.dryMix); this.dryMix.connect(this.wet);
    this.input.connect(this.dL); this.input.connect(this.dR);
    this.dL.connect(this.merger, 0, 0); this.dR.connect(this.merger, 0, 1);
    this.merger.connect(this.wetMix); this.wetMix.connect(this.wet);
    this.start(this.lfo);
    this.initValues(state);
  }

  applyParam(id, val) {
    switch (id) {
      case 'rate': this.ramp(this.lfo.frequency, val); break;
      case 'depth': case 'delay': {
        const base = this.values.delay ?? 0.016;
        const amt = Math.min(base * 0.9, (this.values.depth ?? 0.5) * 0.006);
        this.ramp(this.dL.delayTime, base); this.ramp(this.dR.delayTime, base * 1.13);
        this.ramp(this.modL.gain, amt); this.ramp(this.modR.gain, -amt);
        break;
      }
      case 'mix': { const m = mixGains(val); this.ramp(this.dryMix.gain, m.dry); this.ramp(this.wetMix.gain, m.wet); break; }
    }
  }
}

// ───────────────────────────────────────────── TREMOLO ──
export class TremoloModule extends EffectBase {
  static type = 'tremolo';
  static title = 'Tremolo / Pan';
  static color = '#ff7ad9';
  static icon = '≈';
  static description = 'Lautstärke-Pulsieren & Auto-Panning';
  static params = [
    { id: 'rate', label: 'Rate', min: 0.1, max: 14, value: 3.5, log: true, fmt: 'hz' },
    { id: 'depth', label: 'Tiefe', min: 0, max: 1, value: 0.5, fmt: 'pct' },
    { id: 'pan', label: 'Auto-Pan', min: 0, max: 1, value: 0.3, fmt: 'pct' },
  ];
  static options = [
    { id: 'wave', label: 'Form', choices: [['sine', 'Sine'], ['triangle', 'Tri'], ['square', 'Square']], value: 'sine' },
  ];

  constructor(ctx, state = {}) {
    super(ctx, state);
    this.vca = ctx.createGain();
    this.panner = ctx.createStereoPanner();
    this.lfo = ctx.createOscillator();
    this.lfoAmp = ctx.createGain();
    this.lfoPan = ctx.createGain();
    this.lfo.connect(this.lfoAmp); this.lfoAmp.connect(this.vca.gain);
    this.lfo.connect(this.lfoPan); this.lfoPan.connect(this.panner.pan);
    this.input.connect(this.vca); this.vca.connect(this.panner); this.panner.connect(this.wet);
    this.start(this.lfo);
    this.initValues(state);
  }

  applyParam(id, val) {
    switch (id) {
      case 'rate': this.ramp(this.lfo.frequency, val); break;
      case 'depth': this.ramp(this.vca.gain, 1 - val / 2); this.ramp(this.lfoAmp.gain, val / 2); break;
      case 'pan': this.ramp(this.lfoPan.gain, val * 0.9); break;
      case 'wave': this.lfo.type = val; break;
    }
  }
}

// ───────────────────────────────────────────── LO-FI ──
function makeCrushCurve(bits, drive) {
  const n = 4096;
  const c = new Float32Array(n);
  const steps = Math.pow(2, bits) / 2;
  const k = 0.35 + drive * 2.8;
  const norm = Math.tanh(k);
  const noCrush = bits >= 16;
  const noDrive = drive <= 0.001;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1;
    const y = noDrive ? x : (Math.tanh(k * x) / norm);
    c[i] = noCrush ? y : (Math.round(y * steps) / steps);
  }
  return c;
}

export class LoFiModule extends EffectBase {
  static type = 'lofi';
  static title = 'Lo-Fi Tape';
  static color = '#d6a77a';
  static icon = '▣';
  static description = 'Sättigung, Bitcrush & Tape-Leiern';
  static params = [
    { id: 'drive', label: 'Drive', min: 0, max: 1, value: 0.3, fmt: 'pct' },
    { id: 'bits', label: 'Bits', min: 3, max: 16, value: 12, fmt: 'int' },
    { id: 'tone', label: 'Tone', min: 500, max: 14000, value: 4500, log: true, fmt: 'hz' },
    { id: 'wobble', label: 'Wobble', min: 0, max: 1, value: 0.35, fmt: 'pct' },
    { id: 'level', label: 'Output', min: 0, max: 1.5, value: 0.9, fmt: 'pct' },
  ];

  constructor(ctx, state = {}) {
    super(ctx, state);
    this.shaper = ctx.createWaveShaper();
    this.shaper.oversample = '4x';
    this.postDriveLp = ctx.createBiquadFilter();
    this.postDriveLp.type = 'lowpass';
    this.postDriveLp.frequency.value = 8800;
    this.postDriveLp.Q.value = 0.5;
    this.toneF = ctx.createBiquadFilter();
    this.toneF.type = 'lowpass';
    this.hp = ctx.createBiquadFilter();
    this.hp.type = 'highpass';
    this.hp.frequency.value = 60;
    this.wow = ctx.createDelay(0.1);
    this.wow.delayTime.value = 0.012;
    this.lfo = ctx.createOscillator();
    this.lfo.frequency.value = 0.55;
    this.flutter = ctx.createOscillator();
    this.flutter.frequency.value = 6.3;
    this.lfoG = ctx.createGain();
    this.flutG = ctx.createGain();
    this.lfo.connect(this.lfoG); this.lfoG.connect(this.wow.delayTime);
    this.flutter.connect(this.flutG); this.flutG.connect(this.wow.delayTime);
    this.levelG = ctx.createGain();
    this.input.connect(this.shaper);
    this.shaper.connect(this.postDriveLp);
    this.postDriveLp.connect(this.hp); this.hp.connect(this.toneF);
    this.toneF.connect(this.wow); this.wow.connect(this.levelG); this.levelG.connect(this.wet);
    this.start(this.lfo); this.start(this.flutter);
    this.initValues(state);
  }

  applyParam(id, val) {
    switch (id) {
      case 'drive': case 'bits':
        this.shaper.curve = makeCrushCurve(Math.round(this.values.bits ?? 12), this.values.drive ?? 0.3);
        break;
      case 'tone': this.ramp(this.toneF.frequency, val); break;
      case 'wobble': this.ramp(this.lfoG.gain, val * 0.0035); this.ramp(this.flutG.gain, val * 0.0004); break;
      case 'level': this.ramp(this.levelG.gain, val); break;
    }
  }
}

// ───────────────────────────────────────────── GRANULAR CLOUD ──
export class GranularCloudModule extends EffectBase {
  static type = 'granular_cloud';
  static title = 'Granular Cloud';
  static color = '#c084fc';
  static icon = '☁';
  static description = 'Echtzeit-Granular-Synthese & Shimmer';
  static params = [
    { id: 'size', label: 'Grain-Size', min: 0.03, max: 0.35, value: 0.12, fmt: 's' },
    { id: 'texture', label: 'Textur', min: 0, max: 1, value: 0.65, fmt: 'pct' },
    { id: 'feedback', label: 'Feedback', min: 0, max: 0.85, value: 0.45, fmt: 'pct' },
    { id: 'mix', label: 'Mix', min: 0, max: 1, value: 0.35, fmt: 'pct' },
  ];
  static options = [
    {
      id: 'pitchMode',
      label: 'Pitch / Shimmer',
      choices: [
        ['octUp', '+1 Oktave (Oct Up)'],
        ['fifthUp', '+Quinte (Fifth Up)'],
        ['dualShimmer', 'Dual Shimmer (+1 Okt & +Quinte)'],
        ['octDown', '-1 Oktave (Oct Down)'],
      ],
      value: 'octUp',
    },
    {
      id: 'freeze',
      label: 'Buffer',
      choices: [
        [0, 'Live Audio'],
        [1, '❄ Freeze (Eingefroren)'],
      ],
      value: 0,
    },
  ];
  static jacks = [
    { id: 'freezeIn', type: 'in', signal: 'gate', label: 'FREEZE' },
    { id: 'cvMix', type: 'in', signal: 'mod', label: 'MIX CV' },
    { id: 'cvTexture', type: 'in', signal: 'mod', label: 'TEXTURE CV' },
  ];

  constructor(ctx, state = {}) {
    super(ctx, state);
    this.dryMix = ctx.createGain();
    this.wetMix = ctx.createGain();
    this.input.connect(this.dryMix);
    this.dryMix.connect(this.wet);

    const sr = ctx.sampleRate || 44100;
    this.sr = sr;
    this.bufferLength = Math.floor(sr * 2.0);
    this.bufferL = new Float32Array(this.bufferLength);
    this.bufferR = new Float32Array(this.bufferLength);
    this.writeIndex = 0;

    this.fbL = 0;
    this.fbR = 0;
    this.lastWetL = 0;
    this.lastWetR = 0;
    this.cvMixVal = 0;
    this.cvTextureVal = 0;
    this.updateDisplay = null;

    const grainLen = Math.max(128, Math.floor(0.12 * sr));
    this.grains = [];
    for (let g = 0; g < 6; g++) {
      this.grains.push({
        active: true,
        pos: Math.floor((g / 6) * this.bufferLength),
        length: grainLen,
        currentSample: Math.floor((g / 6) * grainLen),
        rate: 2.0,
        pan: (g % 2 === 0 ? -0.45 : 0.45),
      });
    }

    if (ctx.createScriptProcessor) {
      this.scriptNode = ctx.createScriptProcessor(2048, 2, 2);
      this.scriptNode.onaudioprocess = (e) => this.processAudio(e);
      this.input.connect(this.scriptNode);
      this.scriptNode.connect(this.wetMix);
    } else {
      this.scriptNode = ctx.createGain();
      this.input.connect(this.scriptNode);
      this.scriptNode.connect(this.wetMix);
    }
    this.wetMix.connect(this.wet);

    this.initValues(state);
    this.updateMix();
  }

  updateMix(time) {
    const base = Number(this.values.mix ?? 0.35);
    const effective = Math.max(0, Math.min(1, base + this.cvMixVal));
    const { dry, wet } = mixGains(effective);
    const t = time || this.ctx.currentTime;
    this.dryMix.gain.setTargetAtTime(dry, t, 0.02);
    this.wetMix.gain.setTargetAtTime(wet, t, 0.02);
  }

  setMix(m) {
    this.setParam('mix', m);
  }

  applyParam(id, _val) {
    switch (id) {
      case 'mix':
        this.updateMix();
        break;
      case 'freeze':
      case 'texture':
      case 'size':
      case 'pitchMode':
      case 'feedback':
        this.updateDisplay?.();
        break;
    }
  }

  onModulation(portId, val, time) {
    if (portId === 'cvMix') {
      this.cvMixVal = (val - 0.5) * 1.5;
      this.updateMix(time);
    } else if (portId === 'cvTexture') {
      this.cvTextureVal = (val - 0.5) * 0.9;
    }
  }

  onTrigger(portId, _time) {
    if (portId === 'freezeIn') {
      const cur = Number(this.values.freeze) || 0;
      this.setParam('freeze', cur === 1 ? 0 : 1);
      this.updateDisplay?.();
    }
  }

  resetGrain(grain) {
    const sr = this.sr;
    const effectiveTexture = Math.max(0, Math.min(1, (this.values.texture ?? 0.65) + this.cvTextureVal));
    const effectiveSize = Math.max(0.03, Math.min(0.35, this.values.size ?? 0.12));
    const dur = effectiveSize * (1 + (Math.random() - 0.5) * 0.4 * effectiveTexture);
    grain.length = Math.max(64, Math.floor(dur * sr));
    grain.currentSample = 0;

    const FIFTH = 1.4983070768766815; // 2^(7/12)
    const mode = this.values.pitchMode || 'octUp';
    switch (mode) {
      case 'fifthUp': grain.rate = FIFTH; break;
      case 'octDown': grain.rate = 0.5; break;
      case 'dualShimmer': grain.rate = Math.random() < 0.5 ? 2.0 : FIFTH; break;
      case 'octUp':
      default: grain.rate = 2.0; break;
    }

    if (effectiveTexture > 0) {
      grain.rate *= 1 + (Math.random() - 0.5) * 0.012 * effectiveTexture;
    }

    grain.pan = (Math.random() * 2 - 1) * Math.min(1.0, 0.2 + effectiveTexture * 0.8);

    const baseDelay = sr * 0.08;
    const jitter = (Math.random() * 2 - 1) * 0.5 * effectiveTexture * (sr * 0.8);
    const offset = Math.floor(baseDelay + Math.random() * sr * 0.35 + jitter);
    grain.pos = (this.writeIndex - offset + this.bufferLength * 4) % this.bufferLength;
  }

  processAudio(e) {
    const inpL = e.inputBuffer.getChannelData(0);
    const inpR = e.inputBuffer.numberOfChannels > 1 ? e.inputBuffer.getChannelData(1) : inpL;
    const outL = e.outputBuffer.getChannelData(0);
    const outR = e.outputBuffer.numberOfChannels > 1 ? e.outputBuffer.getChannelData(1) : outL;
    const len = inpL.length;
    const bufLen = this.bufferLength;
    const isFrozen = Number(this.values.freeze) === 1;
    const fbGain = Math.min(0.85, (this.values.feedback ?? 0.45));
    const lpAlpha = 1 - Math.exp((-2 * Math.PI * 6000) / this.sr);
    const norm = 0.42;

    for (let i = 0; i < len; i++) {
      if (!isFrozen) {
        this.fbL += lpAlpha * (this.lastWetL - this.fbL);
        this.fbR += lpAlpha * (this.lastWetR - this.fbR);
        const recL = inpL[i] + Math.tanh(this.fbL * 0.95) * fbGain;
        const recR = inpR[i] + Math.tanh(this.fbR * 0.95) * fbGain;
        this.bufferL[this.writeIndex] = recL;
        this.bufferR[this.writeIndex] = recR;
        this.writeIndex = (this.writeIndex + 1) % bufLen;
      }

      let wetL = 0;
      let wetR = 0;

      for (let g = 0; g < this.grains.length; g++) {
        const grain = this.grains[g];
        if (grain.currentSample >= grain.length) {
          this.resetGrain(grain);
        }

        const p0 = Math.floor(grain.pos);
        const p1 = (p0 + 1) % bufLen;
        const frac = grain.pos - p0;
        const sL = this.bufferL[p0] * (1 - frac) + this.bufferL[p1] * frac;
        const sR = this.bufferR[p0] * (1 - frac) + this.bufferR[p1] * frac;

        // Hann-Hüllkurve
        const win = 0.5 * (1 - Math.cos((2 * Math.PI * grain.currentSample) / grain.length));
        const panAngle = (grain.pan + 1) * (Math.PI / 4);
        const gL = Math.cos(panAngle) * win;
        const gR = Math.sin(panAngle) * win;

        wetL += sL * gL;
        wetR += sR * gR;

        grain.pos = (grain.pos + grain.rate) % bufLen;
        grain.currentSample++;
      }

      wetL *= norm;
      wetR *= norm;
      this.lastWetL = wetL;
      this.lastWetR = wetR;

      outL[i] = wetL;
      outR[i] = wetR;
    }
  }

  destroy() {
    if (this.scriptNode) {
      this.scriptNode.onaudioprocess = null;
      try { this.scriptNode.disconnect(); } catch { /* ignore */ }
    }
    super.destroy();
  }

  renderExtra(el, helpers) {
    el.innerHTML = `
      <div class="granular-cloud-display">
        <div class="gc-header-row">
          <span class="gc-lbl">GRANULAR BUFFER & SHIMMER</span>
          <button class="gc-freeze-btn ${Number(this.values.freeze) === 1 ? 'frozen' : ''}">
            ${Number(this.values.freeze) === 1 ? '❄ FROZEN' : 'LIVE'}
          </button>
        </div>
        <div class="gc-cloud-canvas-wrap">
          <div class="gc-grain-dots">
            ${[0, 1, 2, 3, 4, 5].map((idx) => `<span class="gc-grain-dot" data-grain="${idx}"></span>`).join('')}
          </div>
        </div>
        <div class="gc-footer-row">
          <span class="gc-mode-tag">${(this.values.pitchMode || 'octUp').toUpperCase()}</span>
          <span class="gc-feedback-tag">FB: ${Math.round((this.values.feedback ?? 0.45) * 100)}%</span>
        </div>
      </div>
    `;

    const freezeBtn = el.querySelector('.gc-freeze-btn');
    const modeTag = el.querySelector('.gc-mode-tag');
    const fbTag = el.querySelector('.gc-feedback-tag');

    freezeBtn?.addEventListener('click', () => {
      const cur = Number(this.values.freeze) || 0;
      this.setParam('freeze', cur === 1 ? 0 : 1);
      helpers?.changed?.();
      this.updateDisplay?.();
    });

    this.updateDisplay = () => {
      const isFrz = Number(this.values.freeze) === 1;
      if (freezeBtn) {
        freezeBtn.textContent = isFrz ? '❄ FROZEN' : 'LIVE';
        freezeBtn.classList.toggle('frozen', isFrz);
      }
      if (modeTag) modeTag.textContent = (this.values.pitchMode || 'octUp').toUpperCase();
      if (fbTag) fbTag.textContent = `FB: ${Math.round((this.values.feedback ?? 0.45) * 100)}%`;
    };
  }
}

