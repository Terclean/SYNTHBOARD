// Audio Engine for Virtual Synthboard (Solar 42F + Walrus Meraki & Slöer)
import { MerakiDelay } from './MerakiDelay.js';
import { SloerReverb } from './SloerReverb.js';
import { AnalogFilter } from './AnalogFilter.js';
import { DroneEngine } from './DroneVoice.js';
import { TouchSynth } from './TouchSynth.js';
import { StepSequencer } from './Sequencer.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.isStarted = false;
    this.isMuted = false;
    
    // Master Nodes
    this.masterGain = null;
    this.limiter = null;
    this.analyser = null;

    // Modules
    this.droneEngine = null;
    this.touchSynth = null;
    this.filter = null;
    this.delay = null;
    this.reverb = null;
    this.sequencer = null;

    // Patch bay routes
    this.patchConnections = new Map(); // id -> { from, to, cableNode }

    // Recording
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
    this.onRecordStateChange = null;
  }

  async init() {
    if (this.isStarted) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContext();

    // Master limiter & analyser
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.75, this.ctx.currentTime);

    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.setValueAtTime(-1.5, this.ctx.currentTime);
    this.limiter.knee.setValueAtTime(6, this.ctx.currentTime);
    this.limiter.ratio.setValueAtTime(12, this.ctx.currentTime);
    this.limiter.attack.setValueAtTime(0.003, this.ctx.currentTime);
    this.limiter.release.setValueAtTime(0.15, this.ctx.currentTime);

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.85;

    // Connect Master chain -> destination
    this.masterGain.connect(this.limiter);
    this.limiter.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    // Initialize modules
    // Reverb is last before master
    this.reverb = new SloerReverb(this.ctx);
    this.reverb.output.connect(this.masterGain);

    // Delay feeds into reverb
    this.delay = new MerakiDelay(this.ctx);
    this.delay.output.connect(this.reverb.input);

    // Filter feeds into delay
    this.filter = new AnalogFilter(this.ctx);
    this.filter.output.connect(this.delay.input);

    // Drones feed into filter
    this.droneEngine = new DroneEngine(this.ctx);
    this.droneEngine.output.connect(this.filter.input);

    // Touch Synth feeds into filter and has a dry/wet direct feed
    this.touchSynth = new TouchSynth(this.ctx);
    this.touchSynth.output.connect(this.filter.input);

    // Step Sequencer runs on clock
    this.sequencer = new StepSequencer(this.ctx, (step, val) => {
      // Step callback for visual LEDs & default filter/pitch mod
      if (this.onSequencerStep) this.onSequencerStep(step, val);
      // If sequencer is default patched to filter cutoff:
      if (this.sequencerModTarget === 'filter') {
        const baseCutoff = this.filter.cutoffValue;
        const targetCutoff = Math.max(80, Math.min(16000, baseCutoff * Math.pow(2, (val - 0.5) * 3)));
        this.filter.filterNode.frequency.setTargetAtTime(targetCutoff, this.ctx.currentTime, 0.04);
      }
    });
    this.sequencerModTarget = 'filter';

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    this.isStarted = true;
  }

  setMasterVolume(val) {
    if (!this.masterGain) return;
    this.masterGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.03);
  }

  // Recording
  startRecording() {
    if (!this.ctx || this.isRecording) return;
    const dest = this.ctx.createMediaStreamDestination();
    this.masterGain.connect(dest);
    this.mediaRecorder = new MediaRecorder(dest.stream);
    this.recordedChunks = [];
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.recordedChunks.push(e.data);
    };
    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `synthboard-jam-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.webm`;
      a.click();
      URL.revokeObjectURL(url);
      if (this.onRecordStateChange) this.onRecordStateChange(false);
    };
    this.mediaRecorder.start();
    this.isRecording = true;
    if (this.onRecordStateChange) this.onRecordStateChange(true);
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
    }
  }
}
