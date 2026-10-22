// Walrus Audio Slöer - Stereo Ambient Reverb Simulation

export class SloerReverb {
  constructor(ctx) {
    this.ctx = ctx;

    this.input = this.ctx.createGain();
    this.output = this.ctx.createGain();

    this.dryGain = this.ctx.createGain();
    this.wetGain = this.ctx.createGain();
    this.bypassed = false;
    this.sustainFrozen = false;

    // Filter control on reverb tank
    this.reverbFilter = this.ctx.createBiquadFilter();
    this.reverbFilter.type = 'lowpass';
    this.reverbFilter.frequency.setValueAtTime(4500, this.ctx.currentTime);

    // Multi-tap all-pass / comb delay network for rich stereo diffusion
    this.splitter = this.ctx.createChannelSplitter(2);
    this.merger = this.ctx.createChannelMerger(2);

    this.decayTime = 0.88;
    this.mode = 'dream'; // 'dark' | 'dream' | 'light' | 'rain'

    // Build algorithmic reverb tank with 8 parallel delays and cross-diffusion
    const delayTimesL = [0.031, 0.047, 0.067, 0.093];
    const delayTimesR = [0.037, 0.053, 0.079, 0.103];

    this.nodesL = [];
    this.nodesR = [];

    // Left network
    this.tankInL = this.ctx.createGain();
    this.tankOutL = this.ctx.createGain();
    this.fbGainL = this.ctx.createGain();
    this.fbGainL.gain.setValueAtTime(this.decayTime, this.ctx.currentTime);

    delayTimesL.forEach(t => {
      const d = this.ctx.createDelay(1.0);
      d.delayTime.setValueAtTime(t, this.ctx.currentTime);
      this.tankInL.connect(d);
      d.connect(this.tankOutL);
      this.nodesL.push(d);
    });
    this.tankOutL.connect(this.fbGainL);
    this.fbGainL.connect(this.tankInL);

    // Right network
    this.tankInR = this.ctx.createGain();
    this.tankOutR = this.ctx.createGain();
    this.fbGainR = this.ctx.createGain();
    this.fbGainR.gain.setValueAtTime(this.decayTime, this.ctx.currentTime);

    delayTimesR.forEach(t => {
      const d = this.ctx.createDelay(1.0);
      d.delayTime.setValueAtTime(t, this.ctx.currentTime);
      this.tankInR.connect(d);
      d.connect(this.tankOutR);
      this.nodesR.push(d);
    });
    this.tankOutR.connect(this.fbGainR);
    this.fbGainR.connect(this.tankInR);

    // Shimmer / Pitch-shift emulation (for 'Light' mode: high frequency harmonics; 'Dark' mode: sub harmonics)
    this.shimmerOsc = this.ctx.createOscillator();
    this.shimmerOsc.type = 'triangle';
    this.shimmerOsc.frequency.setValueAtTime(440, this.ctx.currentTime);
    this.shimmerGain = this.ctx.createGain();
    this.shimmerGain.gain.setValueAtTime(0, this.ctx.currentTime);

    // Modulation on tank (Slöer depth)
    this.modLfo = this.ctx.createOscillator();
    this.modLfo.frequency.setValueAtTime(1.2, this.ctx.currentTime);
    this.modGain = this.ctx.createGain();
    this.modGain.gain.setValueAtTime(0.002, this.ctx.currentTime);
    this.modLfo.connect(this.modGain);

    this.nodesL.forEach(d => this.modGain.connect(d.delayTime));
    this.nodesR.forEach(d => this.modGain.connect(d.delayTime));
    this.modLfo.start();

    // Wiring Dry Path
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);

    // Wiring Wet Path
    this.input.connect(this.reverbFilter);
    this.reverbFilter.connect(this.tankInL);
    this.reverbFilter.connect(this.tankInR);

    this.tankOutL.connect(this.merger, 0, 0);
    this.tankOutR.connect(this.merger, 0, 1);
    this.merger.connect(this.wetGain);
    this.wetGain.connect(this.output);

    this.setMix(0.5);
  }

  setDecay(val) {
    // 0 to 1 -> 0.4 to 0.985
    this.decayTime = Math.min(0.985, 0.4 + val * 0.58);
    if (!this.sustainFrozen) {
      this.fbGainL.gain.setTargetAtTime(this.decayTime, this.ctx.currentTime, 0.05);
      this.fbGainR.gain.setTargetAtTime(this.decayTime, this.ctx.currentTime, 0.05);
    }
  }

  setFilter(val) {
    // 0 to 1 -> 400 Hz to 12000 Hz
    const freq = 400 * Math.pow(30, val);
    this.reverbFilter.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.05);
  }

  setDepth(val) {
    // 0 to 1 -> modulation depth
    this.modGain.gain.setTargetAtTime(val * 0.004, this.ctx.currentTime, 0.05);
  }

  setStretch(val) {
    // Slöer Stretch slider: alters diffusion spacing & clock rate
    const mult = 0.5 + val * 1.5;
    const baseL = [0.031, 0.047, 0.067, 0.093];
    const baseR = [0.037, 0.053, 0.079, 0.103];
    this.nodesL.forEach((d, i) => d.delayTime.setTargetAtTime(baseL[i] * mult, this.ctx.currentTime, 0.08));
    this.nodesR.forEach((d, i) => d.delayTime.setTargetAtTime(baseR[i] * mult, this.ctx.currentTime, 0.08));
  }

  setMode(mode) {
    this.mode = mode;
    const t = this.ctx.currentTime;
    if (mode === 'dark') {
      this.reverbFilter.frequency.setTargetAtTime(1800, t, 0.1);
      this.modLfo.frequency.setTargetAtTime(0.6, t, 0.1);
    } else if (mode === 'light') {
      // Shimmer sparkle
      this.reverbFilter.frequency.setTargetAtTime(9000, t, 0.1);
      this.modLfo.frequency.setTargetAtTime(2.2, t, 0.1);
    } else if (mode === 'rain') {
      this.reverbFilter.frequency.setTargetAtTime(5000, t, 0.1);
      this.modLfo.frequency.setTargetAtTime(4.0, t, 0.1);
    } else {
      // dream
      this.reverbFilter.frequency.setTargetAtTime(4500, t, 0.1);
      this.modLfo.frequency.setTargetAtTime(1.1, t, 0.1);
    }
  }

  setMix(val) {
    if (this.bypassed) return;
    this.dryGain.gain.setTargetAtTime(1 - val * 0.35, this.ctx.currentTime, 0.04);
    this.wetGain.gain.setTargetAtTime(val * 1.25, this.ctx.currentTime, 0.04);
  }

  toggleSustain() {
    this.sustainFrozen = !this.sustainFrozen;
    const t = this.ctx.currentTime;
    if (this.sustainFrozen) {
      // Infinite freeze pad!
      this.fbGainL.gain.setTargetAtTime(0.996, t, 0.05);
      this.fbGainR.gain.setTargetAtTime(0.996, t, 0.05);
    } else {
      this.fbGainL.gain.setTargetAtTime(this.decayTime, t, 0.15);
      this.fbGainR.gain.setTargetAtTime(this.decayTime, t, 0.15);
    }
    return this.sustainFrozen;
  }

  toggleBypass() {
    this.bypassed = !this.bypassed;
    const t = this.ctx.currentTime;
    if (this.bypassed) {
      this.dryGain.gain.setTargetAtTime(1, t, 0.02);
      this.wetGain.gain.setTargetAtTime(0, t, 0.02);
    } else {
      this.dryGain.gain.setTargetAtTime(0.8, t, 0.02);
      this.wetGain.gain.setTargetAtTime(0.6, t, 0.02);
    }
    return !this.bypassed;
  }
}
