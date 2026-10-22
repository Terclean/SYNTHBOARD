// Resonant Analog Filter with Saturation Drive & LFO modulation

export class AnalogFilter {
  constructor(ctx) {
    this.ctx = ctx;

    this.input = this.ctx.createGain();
    this.output = this.ctx.createGain();

    // Saturation / Drive Waveshaper
    this.driveGain = this.ctx.createGain();
    this.driveGain.gain.setValueAtTime(1.2, this.ctx.currentTime);

    this.shaper = this.ctx.createWaveShaper();
    this.shaper.curve = this.makeDistortionCurve(10);
    this.shaper.oversample = '2x';

    // Biquad Filter 1 (12dB)
    this.filterNode = this.ctx.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.setValueAtTime(1200, this.ctx.currentTime);
    this.filterNode.Q.setValueAtTime(4.0, this.ctx.currentTime);

    // Biquad Filter 2 (series 12dB -> 24dB steep analog slope)
    this.filterNode2 = this.ctx.createBiquadFilter();
    this.filterNode2.type = 'lowpass';
    this.filterNode2.frequency.setValueAtTime(1200, this.ctx.currentTime);
    this.filterNode2.Q.setValueAtTime(2.0, this.ctx.currentTime);

    // Filter LFO (Sweeper)
    this.lfo = this.ctx.createOscillator();
    this.lfo.type = 'sine';
    this.lfo.frequency.setValueAtTime(0.2, this.ctx.currentTime);

    this.lfoGain = this.ctx.createGain();
    this.lfoGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.filterNode.frequency);
    this.lfoGain.connect(this.filterNode2.frequency);
    this.lfo.start();

    // Wiring: input -> drive -> shaper -> filter1 -> filter2 -> output
    this.input.connect(this.driveGain);
    this.driveGain.connect(this.shaper);
    this.shaper.connect(this.filterNode);
    this.filterNode.connect(this.filterNode2);
    this.filterNode2.connect(this.output);

    this.cutoffValue = 1200;
  }

  makeDistortionCurve(amount) {
    const k = typeof amount === 'number' ? amount : 10;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      // Soft saturation curve modeling analog transformer/JFET warm clipping
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  setCutoff(val) {
    this.cutoffValue = Math.max(30, Math.min(18000, val));
    this.filterNode.frequency.setTargetAtTime(this.cutoffValue, this.ctx.currentTime, 0.03);
    this.filterNode2.frequency.setTargetAtTime(this.cutoffValue, this.ctx.currentTime, 0.03);
  }

  setResonance(q) {
    // 0 to 18
    this.filterNode.Q.setTargetAtTime(q, this.ctx.currentTime, 0.03);
    this.filterNode2.Q.setTargetAtTime(Math.max(1, q * 0.5), this.ctx.currentTime, 0.03);
  }

  setDrive(amt) {
    // 1 to 5
    const drive = 1 + amt * 4;
    this.driveGain.gain.setTargetAtTime(drive, this.ctx.currentTime, 0.04);
  }

  setFilterType(type) {
    this.filterNode.type = type;
    this.filterNode2.type = type;
  }

  setLfoRate(hz) {
    this.lfo.frequency.setTargetAtTime(hz, this.ctx.currentTime, 0.05);
  }

  setLfoDepth(depth) {
    // 0 to 1 -> 0 to 2500 Hz
    this.lfoGain.gain.setTargetAtTime(depth * 1800, this.ctx.currentTime, 0.05);
  }
}
