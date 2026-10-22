// Expressive Touch Synth Voice (Solar 42F Capacitive Touch Controller)

export class TouchSynth {
  constructor(ctx) {
    this.ctx = ctx;
    this.output = this.ctx.createGain();
    this.output.gain.setValueAtTime(0.7, this.ctx.currentTime);

    // Filter dedicated to touch synth
    this.touchFilter = this.ctx.createBiquadFilter();
    this.touchFilter.type = 'lowpass';
    this.touchFilter.frequency.setValueAtTime(2500, this.ctx.currentTime);
    this.touchFilter.Q.setValueAtTime(3.5, this.ctx.currentTime);

    // Amp Envelope Gain
    this.envGain = this.ctx.createGain();
    this.envGain.gain.setValueAtTime(0, this.ctx.currentTime);

    // Oscillator 1 (Main voice)
    this.osc1 = this.ctx.createOscillator();
    this.osc1.type = 'sawtooth';
    this.osc1.frequency.setValueAtTime(220, this.ctx.currentTime);

    // Oscillator 2 (Sub / Detuned voice)
    this.osc2 = this.ctx.createOscillator();
    this.osc2.type = 'triangle';
    this.osc2.frequency.setValueAtTime(220, this.ctx.currentTime);
    this.osc2Detune = this.ctx.createGain();

    // Expression Vibrato LFO
    this.vibratoLFO = this.ctx.createOscillator();
    this.vibratoLFO.frequency.setValueAtTime(5.5, this.ctx.currentTime);
    this.vibratoGain = this.ctx.createGain();
    this.vibratoGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.vibratoLFO.connect(this.vibratoGain);
    this.vibratoGain.connect(this.osc1.frequency);
    this.vibratoGain.connect(this.osc2.frequency);
    this.vibratoLFO.start();

    // Wiring
    this.osc1.connect(this.envGain);
    this.osc2.connect(this.envGain);
    this.envGain.connect(this.touchFilter);
    this.touchFilter.connect(this.output);

    this.osc1.start();
    this.osc2.start();

    // Envelope Parameters
    this.attack = 0.04;
    this.decay = 0.4;
    this.sustain = 0.6;
    this.release = 0.8;
    this.glideTime = 0.05;

    // Active touch tracking
    this.activeTouches = new Set();
    this.currentFreq = 220;
    this.baseFilterCutoff = 2500;
  }

  noteOn(freq, pressure = 0.5) {
    const t = this.ctx.currentTime;
    this.currentFreq = freq;

    // Portamento / Glide
    this.osc1.frequency.setTargetAtTime(freq, t, this.glideTime);
    this.osc2.frequency.setTargetAtTime(freq * 1.004, t, this.glideTime); // subtle analog detune

    // Pressure modulates filter cutoff & vibrato
    const touchCutoff = Math.min(18000, this.baseFilterCutoff * (0.4 + pressure * 2.2));
    this.touchFilter.frequency.setTargetAtTime(touchCutoff, t, 0.05);
    this.vibratoGain.gain.setTargetAtTime(pressure * 6, t, 0.08);

    // ADSR Attack -> Sustain
    this.envGain.gain.cancelScheduledValues(t);
    this.envGain.gain.setValueAtTime(this.envGain.gain.value, t);
    this.envGain.gain.linearRampToValueAtTime(0.7, t + this.attack);
    this.envGain.gain.setTargetAtTime(0.7 * this.sustain, t + this.attack, this.decay);
  }

  updatePressure(pressure) {
    const t = this.ctx.currentTime;
    const touchCutoff = Math.min(18000, this.baseFilterCutoff * (0.4 + pressure * 2.5));
    this.touchFilter.frequency.setTargetAtTime(touchCutoff, t, 0.04);
    this.vibratoGain.gain.setTargetAtTime(pressure * 8, t, 0.05);
  }

  noteOff() {
    const t = this.ctx.currentTime;
    this.envGain.gain.cancelScheduledValues(t);
    this.envGain.gain.setValueAtTime(this.envGain.gain.value, t);
    this.envGain.gain.linearRampToValueAtTime(0, t + this.release);
    this.vibratoGain.gain.setTargetAtTime(0, t, 0.1);
  }

  setEnvelope(a, d, s, r) {
    this.attack = Math.max(0.005, a);
    this.decay = Math.max(0.01, d);
    this.sustain = Math.max(0.01, Math.min(1, s));
    this.release = Math.max(0.05, r);
  }

  setWaveform(wave) {
    this.osc1.type = wave;
  }
}
