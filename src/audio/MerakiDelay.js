// Walrus Audio Meraki - Stereo Analog Delay Simulation

export class MerakiDelay {
  constructor(ctx) {
    this.ctx = ctx;

    this.input = this.ctx.createGain();
    this.output = this.ctx.createGain();

    this.dryGain = this.ctx.createGain();
    this.wetGain = this.ctx.createGain();
    this.bypassed = false;

    // Stereo Splitter & Merger
    this.splitter = this.ctx.createChannelSplitter(2);
    this.merger = this.ctx.createChannelMerger(2);

    // Left Delay Line
    this.delayL = this.ctx.createDelay(2.5);
    this.delayL.delayTime.setValueAtTime(0.42, this.ctx.currentTime);
    this.feedbackL = this.ctx.createGain();
    this.feedbackL.gain.setValueAtTime(0.55, this.ctx.currentTime);
    this.toneL = this.ctx.createBiquadFilter();
    this.toneL.type = 'lowpass';
    this.toneL.frequency.setValueAtTime(2400, this.ctx.currentTime);

    // Right Delay Line
    this.delayR = this.ctx.createDelay(2.5);
    this.delayR.delayTime.setValueAtTime(0.56, this.ctx.currentTime);
    this.feedbackR = this.ctx.createGain();
    this.feedbackR.gain.setValueAtTime(0.55, this.ctx.currentTime);
    this.toneR = this.ctx.createBiquadFilter();
    this.toneR.type = 'lowpass';
    this.toneR.frequency.setValueAtTime(2400, this.ctx.currentTime);

    // Ping-pong cross feedback gains
    this.crossLtoR = this.ctx.createGain();
    this.crossRtoL = this.ctx.createGain();
    this.crossLtoR.gain.setValueAtTime(0, this.ctx.currentTime);
    this.crossRtoL.gain.setValueAtTime(0, this.ctx.currentTime);

    // Modulation (Tape / BBD Wow & Flutter LFO)
    this.modLfo = this.ctx.createOscillator();
    this.modLfo.frequency.setValueAtTime(0.8, this.ctx.currentTime);
    this.modGainL = this.ctx.createGain();
    this.modGainR = this.ctx.createGain();
    this.modGainL.gain.setValueAtTime(0.0018, this.ctx.currentTime);
    this.modGainR.gain.setValueAtTime(-0.0018, this.ctx.currentTime); // stereo phase inverted

    this.modLfo.connect(this.modGainL);
    this.modLfo.connect(this.modGainR);
    this.modGainL.connect(this.delayL.delayTime);
    this.modGainR.connect(this.delayR.delayTime);
    this.modLfo.start();

    // Wiring Dry Path
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);

    // Wiring Wet Path
    this.input.connect(this.splitter);

    // Channel 0 (Left)
    this.splitter.connect(this.delayL, 0);
    this.delayL.connect(this.toneL);
    this.toneL.connect(this.feedbackL);
    this.feedbackL.connect(this.delayL);
    this.toneL.connect(this.crossLtoR);
    this.crossLtoR.connect(this.delayR);
    this.toneL.connect(this.merger, 0, 0);

    // Channel 1 (Right)
    this.splitter.connect(this.delayR, 1);
    this.delayR.connect(this.toneR);
    this.toneR.connect(this.feedbackR);
    this.feedbackR.connect(this.delayR);
    this.toneR.connect(this.crossRtoL);
    this.crossRtoL.connect(this.delayL);
    this.toneR.connect(this.merger, 0, 1);

    this.merger.connect(this.wetGain);
    this.wetGain.connect(this.output);

    this.setMix(0.45);
    this.pingPong = false;
  }

  setTimeL(sec) {
    this.delayL.delayTime.setTargetAtTime(Math.max(0.05, Math.min(2.0, sec)), this.ctx.currentTime, 0.05);
  }

  setTimeR(sec) {
    this.delayR.delayTime.setTargetAtTime(Math.max(0.05, Math.min(2.0, sec)), this.ctx.currentTime, 0.05);
  }

  setFeedback(amt) {
    // 0 to 1 -> 0 to 0.95 (soft self-oscillation)
    const fb = Math.min(0.96, amt * 0.95);
    if (!this.pingPong) {
      this.feedbackL.gain.setTargetAtTime(fb, this.ctx.currentTime, 0.04);
      this.feedbackR.gain.setTargetAtTime(fb, this.ctx.currentTime, 0.04);
    } else {
      this.crossLtoR.gain.setTargetAtTime(fb, this.ctx.currentTime, 0.04);
      this.crossRtoL.gain.setTargetAtTime(fb, this.ctx.currentTime, 0.04);
      this.feedbackL.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04);
      this.feedbackR.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04);
    }
  }

  setTone(val) {
    // 0 to 1 -> 500 Hz to 6500 Hz (warm analog dark tone to open)
    const freq = 500 * Math.pow(13, val);
    this.toneL.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.04);
    this.toneR.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.04);
  }

  setMod(amt) {
    // 0 to 1 -> modulation depth
    const depth = amt * 0.005;
    this.modGainL.gain.setTargetAtTime(depth, this.ctx.currentTime, 0.05);
    this.modGainR.gain.setTargetAtTime(-depth, this.ctx.currentTime, 0.05);
  }

  setMix(val) {
    if (this.bypassed) return;
    this.dryGain.gain.setTargetAtTime(1 - val * 0.4, this.ctx.currentTime, 0.04);
    this.wetGain.gain.setTargetAtTime(val * 1.1, this.ctx.currentTime, 0.04);
  }

  setPingPong(active) {
    this.pingPong = active;
    const currentFb = this.feedbackL.gain.value || 0.55;
    this.setFeedback(currentFb);
  }

  toggleBypass() {
    this.bypassed = !this.bypassed;
    const t = this.ctx.currentTime;
    if (this.bypassed) {
      this.dryGain.gain.setTargetAtTime(1, t, 0.02);
      this.wetGain.gain.setTargetAtTime(0, t, 0.02);
    } else {
      this.dryGain.gain.setTargetAtTime(0.8, t, 0.02);
      this.wetGain.gain.setTargetAtTime(0.5, t, 0.02);
    }
    return !this.bypassed;
  }
}
