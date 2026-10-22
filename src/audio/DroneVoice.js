// Multi-oscillator Drone Engine inspired by Solar 42F Drone Ambient Machine

export class DroneVoice {
  constructor(ctx, id, baseFreq = 110, defaultWave = 'sawtooth') {
    this.ctx = ctx;
    this.id = id;
    this.baseFreq = baseFreq;
    this.detuneCents = 0;
    this.active = false;
    this.volume = 0.5;

    // Main voice gain node
    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.setValueAtTime(0, this.ctx.currentTime);

    // Oscillator 1
    this.osc1 = this.ctx.createOscillator();
    this.osc1.type = defaultWave;
    this.osc1.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);

    // Sub-oscillator (-1 octave square/sine)
    this.subOsc = this.ctx.createOscillator();
    this.subOsc.type = 'triangle';
    this.subOsc.frequency.setValueAtTime(baseFreq * 0.5, this.ctx.currentTime);
    this.subGain = this.ctx.createGain();
    this.subGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    this.subOsc.connect(this.subGain);

    // FM Operator
    this.fmOsc = this.ctx.createOscillator();
    this.fmOsc.type = 'sine';
    this.fmOsc.frequency.setValueAtTime(baseFreq * 0.25, this.ctx.currentTime);
    this.fmGain = this.ctx.createGain();
    this.fmGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.fmOsc.connect(this.fmGain);
    this.fmGain.connect(this.osc1.frequency);

    // Mix to voice output
    this.osc1.connect(this.gainNode);
    this.subGain.connect(this.gainNode);

    // Start oscillators
    this.osc1.start();
    this.subOsc.start();
    this.fmOsc.start();
  }

  setFrequency(freq) {
    this.baseFreq = freq;
    const target = freq * Math.pow(2, this.detuneCents / 1200);
    this.osc1.frequency.setTargetAtTime(target, this.ctx.currentTime, 0.05);
    this.subOsc.frequency.setTargetAtTime(target * 0.5, this.ctx.currentTime, 0.05);
    this.fmOsc.frequency.setTargetAtTime(target * 0.25, this.ctx.currentTime, 0.05);
  }

  setDetune(cents) {
    this.detuneCents = cents;
    this.setFrequency(this.baseFreq);
  }

  setWaveform(type) {
    this.osc1.type = type;
  }

  setFmAmount(amount) {
    // 0 to 1 -> 0 to 200 Hz FM depth
    this.fmGain.gain.setTargetAtTime(amount * 180, this.ctx.currentTime, 0.03);
  }

  setSubAmount(amount) {
    this.subGain.gain.setTargetAtTime(amount, this.ctx.currentTime, 0.03);
  }

  setVolume(vol) {
    this.volume = vol;
    if (this.active) {
      this.gainNode.gain.setTargetAtTime(vol * 0.35, this.ctx.currentTime, 0.04);
    }
  }

  toggle(activeState) {
    if (activeState !== undefined) {
      this.active = activeState;
    } else {
      this.active = !this.active;
    }
    const targetGain = this.active ? this.volume * 0.35 : 0;
    this.gainNode.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.12);
    return this.active;
  }
}

export class DroneEngine {
  constructor(ctx) {
    this.ctx = ctx;
    this.output = this.ctx.createGain();
    this.output.gain.setValueAtTime(0.85, this.ctx.currentTime);

    // Noise Generator (Analog pink/warm noise)
    this.noiseGain = this.ctx.createGain();
    this.noiseGain.gain.setValueAtTime(0.04, this.ctx.currentTime);
    this.noiseFilter = this.ctx.createBiquadFilter();
    this.noiseFilter.type = 'lowpass';
    this.noiseFilter.frequency.setValueAtTime(1400, this.ctx.currentTime);
    this.initNoiseGenerator();
    this.noiseFilter.connect(this.noiseGain);
    this.noiseGain.connect(this.output);

    // 6 Drone voices tuned to deep, rich ambient chords (Root, 5th, Octave, 9th, 11th, Sub)
    const basePitches = [55, 82.4, 110, 164.8, 220, 329.6]; // A1, E2, A2, E3, A3, E4
    const defaultWaves = ['sawtooth', 'triangle', 'sawtooth', 'triangle', 'sine', 'sawtooth'];

    this.voices = [];
    for (let i = 0; i < 6; i++) {
      const voice = new DroneVoice(this.ctx, i + 1, basePitches[i], defaultWaves[i]);
      voice.gainNode.connect(this.output);
      this.voices.push(voice);
    }
  }

  initNoiseGenerator() {
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = noiseBuffer;
    noiseNode.loop = true;
    noiseNode.connect(this.noiseFilter);
    noiseNode.start();
  }

  setNoiseLevel(val) {
    this.noiseGain.gain.setTargetAtTime(val * 0.2, this.ctx.currentTime, 0.05);
  }

  setNoiseTone(freq) {
    this.noiseFilter.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.05);
  }

  setDroneSpread(cents) {
    // Detunes voices symmetrically for huge wide stereo/beating ambient chords
    this.voices.forEach((v, idx) => {
      const multiplier = (idx - 2.5);
      v.setDetune(multiplier * cents);
    });
  }

  allNotesOff() {
    this.voices.forEach(v => v.toggle(false));
  }
}
