// Modul-Registry, Rack-Engine & Board-Vorlagen
import { DroneModule, KeysModule, SequencerModule, NoiseModule } from './sources.js';
import { PluckModule, FmVoiceModule, BassModule, DrumRackModule } from './instruments.js';
import { FeltPianoModule } from './piano.js';
import { MorphVoiceModule, HybridPercModule, ResonatorGardenModule, SpectralSwarmModule } from './voices.js';
import {
  MasterClockModule, ClockDividerModule, EuclideanModule,
  ProbabilityGateModule, RandomWalkModule, ScaleQuantizerModule,
  SlowRandomModule, MacroControllerModule, SlopeGeneratorModule, AttenuverterModule
} from './controls.js';
import { FilterModule, DelayModule, ReverbModule, ChorusModule, TremoloModule, LoFiModule } from './effects.js';
import { PatchSystem } from './patchSystem.js';

export const MODULES = Object.fromEntries(
  [
    // Steuerung / Generatoren
    MasterClockModule, ClockDividerModule, EuclideanModule,
    ProbabilityGateModule, RandomWalkModule, ScaleQuantizerModule,
    SlowRandomModule, MacroControllerModule, SlopeGeneratorModule, AttenuverterModule,

    // Instrumente & Klangquellen
    FeltPianoModule, DroneModule, PluckModule, FmVoiceModule, BassModule,
    DrumRackModule, KeysModule, SequencerModule, NoiseModule,
    MorphVoiceModule, HybridPercModule, ResonatorGardenModule, SpectralSwarmModule,

    // Effekte
    FilterModule, ChorusModule, TremoloModule, LoFiModule, DelayModule, ReverbModule
  ].map((M) => [M.type, M])
);

export class RackEngine {
  constructor() {
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC({ latencyHint: 'interactive' });
    this.controls = [];
    this.sources = [];
    this.effects = [];
    this.masterValue = 0.8;
    this.onRecover = null;

    this.patchSystem = new PatchSystem(this);

    this.sourceBus = this.ctx.createGain(); // Dry / Insert Bus
    this.delaySendBus = this.ctx.createGain(); // Aux Send Delay
    this.reverbSendBus = this.ctx.createGain(); // Aux Send Reverb
    this.delayToReverb = this.ctx.createGain(); // Delay Wash in Reverb
    this.delayToReverb.gain.value = 0.25;

    this.chainGate = this.ctx.createGain();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.masterValue;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;
    this.chainGate.connect(this.masterGain);
    this.buildLimiter();
    this.rewire(true);

    // Watchdog
    this.probe = new Float32Array(this.analyser.fftSize);
    this.watchdog = setInterval(() => this.checkHealth(), 1000);
  }

  buildLimiter() {
    if (this.limiter) { try { this.masterGain.disconnect(); this.limiter.disconnect(); this.analyser.disconnect(); } catch { /* ignore */ } }
    this.limiter = this.ctx.createDynamicsCompressor();
    const t = this.ctx.currentTime;
    this.limiter.threshold.setValueAtTime(-8, t);
    this.limiter.knee.setValueAtTime(4, t);
    this.limiter.ratio.setValueAtTime(16, t);
    this.limiter.attack.setValueAtTime(0.003, t);
    this.limiter.release.setValueAtTime(0.25, t);
    this.masterGain.connect(this.limiter);
    this.limiter.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  async resume() {
    if (this.ctx.state !== 'running') await this.ctx.resume();
  }

  setMaster(v) {
    this.masterValue = v;
    this.masterGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.03);
  }

  add(type, state = {}, index = -1, skipRewire = false) {
    const M = MODULES[type];
    if (!M) return null;
    const mod = new M(this.ctx, state);
    mod.patchSystem = this.patchSystem;

    if (M.category === 'control') {
      this.controls.push(mod);
    } else if (M.category === 'source') {
      if (mod.dryGain) {
        mod.dryGain.connect(this.sourceBus);
        mod.delaySendGain.connect(this.delaySendBus);
        mod.reverbSendGain.connect(this.reverbSendBus);
      } else {
        mod.output.connect(this.sourceBus);
      }
      this.sources.push(mod);
    } else {
      if (index < 0 || index > this.effects.length) this.effects.push(mod);
      else this.effects.splice(index, 0, mod);
      if (!skipRewire) this.rewire();
    }
    return mod;
  }

  remove(id) {
    const mod = this.find(id);
    if (!mod) return;
    this.patchSystem.disconnectModule(id);

    if (mod.meta.category === 'control') {
      this.controls = this.controls.filter((m) => m !== mod);
      mod.destroy();
    } else if (mod.meta.category === 'source') {
      this.sources = this.sources.filter((m) => m !== mod);
      if (mod.vca) mod.vca.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
      mod.output.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
      setTimeout(() => mod.destroy(), 150);
    } else {
      this.effects = this.effects.filter((m) => m !== mod);
      this.rewire(false, () => mod.destroy());
    }
  }

  moveEffect(id, newIndex) {
    const i = this.effects.findIndex((m) => m.id === id);
    if (i < 0) return;
    const [mod] = this.effects.splice(i, 1);
    this.effects.splice(Math.max(0, Math.min(this.effects.length, newIndex)), 0, mod);
    this.rewire();
  }

  find(id) {
    return this.controls.find((m) => m.id === id) ||
           this.sources.find((m) => m.id === id) ||
           this.effects.find((m) => m.id === id);
  }

  findByType(type) {
    return this.controls.find((m) => m.meta.type === type) ||
           this.sources.find((m) => m.meta.type === type) ||
           this.effects.find((m) => m.meta.type === type);
  }

  /** Effektkette & Aux-Sends sauber verdrahten */
  rewire(immediate = false, after = null) {
    const connect = () => {
      try { this.sourceBus.disconnect(); } catch { /* ignore */ }
      try { this.delaySendBus.disconnect(); } catch { /* ignore */ }
      try { this.reverbSendBus.disconnect(); } catch { /* ignore */ }
      try { this.delayToReverb.disconnect(); } catch { /* ignore */ }
      this.effects.forEach((m) => { try { m.output.disconnect(); } catch { /* ignore */ } });

      const delayMod = this.effects.find((m) => m.meta.type === 'delay');
      const reverbMod = this.effects.find((m) => m.meta.type === 'reverb');

      // 1. Serieller Insert-Weg (Filter, Chorus, Tremolo, Lo-Fi)
      let node = this.sourceBus;
      for (const fx of this.effects) {
        if (fx !== delayMod && fx !== reverbMod) {
          node.connect(fx.input);
          node = fx.output;
        }
      }
      node.connect(this.chainGate);

      // 2. Delay Aux Send
      if (delayMod) {
        this.delaySendBus.connect(delayMod.input);
        delayMod.output.connect(this.chainGate);
        if (reverbMod) {
          delayMod.output.connect(this.delayToReverb);
          this.delayToReverb.connect(reverbMod.input);
        }
      }

      // 3. Reverb Aux Send
      if (reverbMod) {
        this.reverbSendBus.connect(reverbMod.input);
        reverbMod.output.connect(this.chainGate);
      }

      after?.();
    };
    if (immediate) { connect(); return; }
    const t = this.ctx.currentTime;
    this.chainGate.gain.setTargetAtTime(0, t, 0.012);
    setTimeout(() => {
      connect();
      this.chainGate.gain.setTargetAtTime(1, this.ctx.currentTime, 0.02);
    }, 60);
  }

  getState() {
    return {
      version: 2,
      master: this.masterValue,
      modules: [...this.controls, ...this.sources, ...this.effects].map((m) => m.getState()),
      cables: this.patchSystem.getState(),
      snapshots: this.snapshotSystem?.getState(),
    };
  }

  clear() {
    this.patchSystem.clear();
    [...this.controls, ...this.sources, ...this.effects].forEach((m) => m.destroy());
    this.controls = [];
    this.sources = [];
    this.effects = [];
  }

  load(state) {
    this.clear();
    (state?.modules || []).forEach((s) => this.add(s.type, s, -1, true));
    this.rewire(true);
    this.setMaster(state?.master ?? 0.8);
    if (state?.cables) {
      setTimeout(() => this.patchSystem.loadState(state.cables), 30);
    }
    if (state?.snapshots && this.snapshotSystem) {
      this.snapshotSystem.loadState(state.snapshots);
    }
  }

  checkHealth() {
    if (this.ctx.state !== 'running') return;
    this.analyser.getFloatTimeDomainData(this.probe);
    for (let i = 0; i < this.probe.length; i += 16) {
      if (!Number.isFinite(this.probe[i])) { this.recover(); return; }
    }
  }

  recover() {
    const state = this.getState();
    this.buildLimiter();
    this.load(state);
    this.onRecover?.();
  }

  // ── Aufnahme ──
  startRecording(onStop) {
    if (this.recorder) return;
    const dest = this.ctx.createMediaStreamDestination();
    this.limiter.connect(dest);
    const chunks = [];
    this.recorder = new MediaRecorder(dest.stream);
    this.recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    this.recorder.onstop = () => {
      try { this.limiter.disconnect(dest); } catch { /* ignore */ }
      const blob = new Blob(chunks, { type: this.recorder.mimeType || 'audio/webm' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `synthboard-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.webm`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      this.recorder = null;
      onStop?.();
    };
    this.recorder.start();
  }

  stopRecording() {
    this.recorder?.stop();
  }
}

// ── Vorlagen: Ausgangspunkte zum Weiterbauen ──
const m = (type, values = {}, extra) => ({ type, values, ...(extra ? { extra } : {}) });

export const TEMPLATES = {
  scenes: {
    name: '🎛️ Hypnotic Live Beat & Ambient Rack',
    category: 'Showcase & Performance',
    description: 'Vollständiges Live-Setup mit Euklidischen Rhythmen, Clock-Divider, hybriden Drums, Resonator-Glocken und Raum-Hall.',
    state: {
      master: 0.8,
      modules: [
        m('master_clock', { tempo: 92, swing: 0.1, running: 1 }),
        m('clock_divider', {}),
        m('euclidean', { steps: 16, pulses: 4, rotation: 0 }),
        m('hybrid_perc', { level: 0.85, tune: 58, body: 0.85, material: 0.1, drop: 0.6, noise: 0.1, snap: 0.35, length: 0.38, drive: 0.2 }),
        m('drum_rack', { level: 0.7, kDecay: 0.4, sSnap: 0.6, hDecay: 0.09, pTune: 420 }),
        m('bass', { level: 0.7, cutoff: 480, reso: 4.2, env: 0.55, decay: 0.5, sub: 0.5 }),
        m('morph_voice', { level: 0.6, morph: 0.35, bright: 2200, formant: 0.15, rough: 0.1, detune: 12, attack: 0.25, release: 1.8, voices: 3, jump: 0.2 }),
        m('resonator_garden', { level: 0.6, material: 0.55, size: 0.45, damp: 0.4, pos: 0.3, spread: 0.4, decay: 2.2, modes: 8 }),
        m('spectral_swarm', { level: 0.55, count: 14, inharm: 0.2, scatter: 0.3, motion: 0.2, depth: 0.5, bright: 0.45, cohesion: 0.5 }),
        m('filter', { cutoff: 5200, reso: 1.2, drive: 0.05, lfoDepth: 0.05 }),
        m('delay', { time: 0.42, feedback: 0.42, tone: 2600, mod: 0.15, mix: 0.3, mode: 'pingpong' }),
        m('reverb', { decay: 7, damp: 0.5, tone: 3600, mix: 0.4 }),
      ],
      cables: [
        { from: 'master_clock:clockOut', to: 'clock_divider:clockIn', color: '#06b6d4' },
        { from: 'clock_divider:div1Out', to: 'hybrid_perc:gateIn', color: '#fbbf24' },
        { from: 'clock_divider:div2Out', to: 'drum_rack:trigSnare', color: '#fbbf24' },
        { from: 'clock_divider:div4Out', to: 'drum_rack:trigHat', color: '#fbbf24' },
        { from: 'euclidean:gateOut', to: 'resonator_garden:gateIn', color: '#fbbf24' },
        { from: 'clock_divider:div1Out', to: 'bass:gateIn', color: '#fbbf24' },
        { from: 'euclidean:gateOut', to: 'morph_voice:gateIn', color: '#fbbf24' },
      ],
    },
  },

  felt_piano_ambient: {
    name: '🎹 Nils Frahm Felt Piano & Melodic Ambient',
    category: 'Piano & Melodie',
    description: 'Intimes Filzklavier mit Melodie-Sequenz, analogen Bassnoten, Raum-Hall und fertigen Snapshot-Presets (Tasten 1–5 switchbar, 6–8 Speed).',
    state: {
      master: 0.85,
      modules: [
        m('master_clock', { tempo: 72, swing: 0.08, running: 1 }),
        m('clock_divider', {}),
        m('random_walk', { stepSize: 2, range: 2, repeat: 8, mutation: 0.2, key: 9, scale: 'minorPenta', octave: 48 }),
        m('quantizer', { key: 9, scale: 'minorPenta', transpose: 0 }),
        m('slow_random', { rate: 0.08, smooth: 0.85, depth: 0.65, mode: 'smooth' }),
        m('felt_piano', { level: 0.82, felt: 0.7, decay: 3.2, color: 3200, body: 0.65, hammer: 0.45, chord: 'single' }),
        m('bass', { level: 0.75, cutoff: 480, reso: 3.8, env: 0.55, decay: 0.45, sub: 0.55 }),
        m('drone', { level: 0.22, tone: 520, detune: 4, sub: 0.4, fm: 0.01, drift: 0.6, root: 33, chord: 'fifth', wave: 'triangle' }, { voices: [true, false, true, false, false, false] }),
        m('chorus', { rate: 0.12, depth: 0.4, delay: 0.02, mix: 0.35 }),
        m('delay', { time: 0.52, feedback: 0.55, tone: 2200, mod: 0.25, mix: 0.38, mode: 'pingpong' }),
        m('reverb', { decay: 8.5, damp: 0.5, predelay: 0.04, tone: 3200, mix: 0.48 }),
      ],
      cables: [
        { from: 'master_clock:clockOut', to: 'clock_divider:clockIn', color: '#06b6d4' },
        { from: 'clock_divider:div2Out', to: 'random_walk:clockIn', color: '#06b6d4' },
        { from: 'random_walk:pitchOut', to: 'quantizer:pitchIn', color: '#a855f7' },
        { from: 'quantizer:pitchOut', to: 'felt_piano:pitchIn', color: '#a855f7' },
        { from: 'random_walk:gateOut', to: 'felt_piano:gateIn', color: '#fbbf24' },
        { from: 'clock_divider:div4Out', to: 'bass:gateIn', color: '#fbbf24' },
        { from: 'quantizer:pitchOut', to: 'bass:pitchIn', color: '#a855f7' },
        { from: 'slow_random:cvOut', to: 'felt_piano:feltCv', color: '#10b981' },
      ],
      snapshots: {
        currentSpeed: 7,
        activeSlot: 1,
        slots: {
          1: {
            savedAt: Date.now(),
            moduleCount: 4,
            filter: 'all',
            snapshot: {
              felt_piano: { values: { level: 0.85, felt: 0.82, decay: 4.5, color: 2400, body: 0.7, hammer: 0.5 }, enabled: true },
              bass: { values: { level: 0 }, enabled: false },
              drone: { values: { level: 0.15 }, enabled: true },
              reverb: { values: { decay: 10, mix: 0.55 }, enabled: true },
            }
          },
          2: {
            savedAt: Date.now(),
            moduleCount: 4,
            filter: 'all',
            snapshot: {
              felt_piano: { values: { level: 0.8, felt: 0.35, decay: 2.4, color: 4500, body: 0.5, hammer: 0.3 }, enabled: true },
              bass: { values: { level: 0.82, cutoff: 650 }, enabled: true },
              drone: { values: { level: 0.35 }, enabled: true },
              reverb: { values: { decay: 6, mix: 0.38 }, enabled: true },
            }
          }
        }
      }
    },
  },

  generative: {
    name: '⚡ Generatives Modular-System (Showcase)',
    category: 'Generative Synthese',
    description: 'Selbstspielendes Eurorack-System mit Random Walk Melodien, Euklidischen Rhythmen und atmender Filtermodulation.',
    state: {
      master: 0.82,
      modules: [
        m('master_clock', { tempo: 86, swing: 0.12, running: 1 }),
        m('clock_divider', {}),
        m('euclidean', { steps: 16, pulses: 5, rotation: 1 }),
        m('prob_gate', { chance: 0.82, burst: 1 }),
        m('random_walk', { stepSize: 2, range: 2, repeat: 8, mutation: 0.25, seed: 42, key: 9, scale: 'dorian', octave: 48 }),
        m('quantizer', { transpose: 0, key: 9, scale: 'dorian' }),
        m('slow_random', { rate: 0.14, smooth: 0.85, depth: 0.72, mode: 'smooth' }),
        m('macro', { density: 0.75, variation: 0.35, motion: 0.6, seed: 42 }),
        m('drone', {
          level: 0.35,
          tone: 850,
          detune: 5,
          sub: 0.42,
          fm: 0.04,
          drift: 0.7,
          root: 33,
          chord: 'sus',
          wave: 'triangle',
        }, { voices: [true, true, false, false, true, false] }),
        m('pluck', { level: 0.72, tone: 3200, damp: 1.1, bright: 0.68, body: 0.42 }),
        m('bass', { level: 0.76, cutoff: 520, reso: 4.6, env: 0.62, decay: 0.46, sub: 0.48 }),
        m('drum_rack', { level: 0.82, kDecay: 0.42, sSnap: 0.68, hDecay: 0.1, pTune: 360 }),
        m('filter', { cutoff: 1600, reso: 2.0, drive: 0.12, lfoDepth: 0.12 }),
        m('delay', { time: 0.46, feedback: 0.52, tone: 2200, mod: 0.2, mix: 0.34, mode: 'pingpong' }),
        m('reverb', { decay: 6.8, damp: 0.55, tone: 3200, mix: 0.44 }),
      ],
      cables: [
        { from: 'master_clock:clockOut', to: 'clock_divider:clockIn', color: '#06b6d4' },
        { from: 'clock_divider:div2Out', to: 'euclidean:clockIn', color: '#06b6d4' },
        { from: 'clock_divider:div2Out', to: 'random_walk:clockIn', color: '#06b6d4' },
        { from: 'clock_divider:div4Out', to: 'drum_rack:trigKick', color: '#fbbf24' },
        { from: 'clock_divider:div8Out', to: 'drum_rack:trigSnare', color: '#fbbf24' },
        { from: 'euclidean:trigOut', to: 'prob_gate:trigIn', color: '#fbbf24' },
        { from: 'prob_gate:trigOut', to: 'drum_rack:trigHat', color: '#fbbf24' },
        { from: 'prob_gate:altOut', to: 'drum_rack:trigPerc', color: '#fbbf24' },
        { from: 'random_walk:pitchOut', to: 'quantizer:pitchIn', color: '#a855f7' },
        { from: 'quantizer:pitchOut', to: 'pluck:pitchIn', color: '#a855f7' },
        { from: 'random_walk:gateOut', to: 'pluck:gateIn', color: '#fbbf24' },
        { from: 'clock_divider:div4Out', to: 'bass:gateIn', color: '#fbbf24' },
        { from: 'quantizer:pitchOut', to: 'bass:pitchIn', color: '#a855f7' },
        { from: 'slow_random:cvOut', to: 'filter:cvCutoff', color: '#10b981' },
        { from: 'slow_random:invOut', to: 'drone:cvTone', color: '#10b981' },
      ],
    },
  },

  zen_garden: {
    name: '🌸 Zen-Garten & Resonator-Meditation',
    category: 'Meditativ & Ambient',
    description: 'Traditionelle Hirajoshi-Tonskala, metallische Bambus-Resonatoren, zarte Harfentupfer und sanft rauschende Windböen.',
    state: {
      master: 0.82,
      modules: [
        m('master_clock', { tempo: 64, swing: 0.05, running: 1 }),
        m('clock_divider', {}),
        m('euclidean', { steps: 12, pulses: 4, rotation: 1 }),
        m('prob_gate', { chance: 0.75, burst: 1 }),
        m('random_walk', { stepSize: 2, range: 2, repeat: 6, mutation: 0.2, key: 2, scale: 'hirajoshi', octave: 50 }),
        m('quantizer', { key: 2, scale: 'hirajoshi', transpose: 0 }),
        m('slow_random', { rate: 0.08, smooth: 0.9, depth: 0.75, mode: 'smooth' }),
        m('resonator_garden', { level: 0.75, material: 0.72, size: 0.38, damp: 0.35, pos: 0.3, spread: 0.65, decay: 3.8, modes: 8 }),
        m('pluck', { level: 0.68, tone: 3800, damp: 0.9, bright: 0.82, body: 0.35 }),
        m('drone', {
          level: 0.32,
          tone: 720,
          detune: 3,
          sub: 0.45,
          fm: 0.02,
          drift: 0.8,
          root: 26,
          chord: 'fifth',
          wave: 'triangle',
        }, { voices: [true, true, false, false, true, false] }),
        m('noise', { level: 0.12, tone: 1400, reso: 1.2, motion: 0.5, rate: 0.06, crackle: 0.04, color: 'pink', ftype: 'bandpass' }),
        m('filter', { cutoff: 2400, reso: 1.8, drive: 0.06, lfoRate: 0.03, lfoDepth: 0.2 }),
        m('delay', { time: 0.56, feedback: 0.58, tone: 2400, mod: 0.22, mix: 0.38, mode: 'pingpong' }),
        m('reverb', { decay: 9.5, damp: 0.45, predelay: 0.03, tone: 3800, mix: 0.52 }),
      ],
      cables: [
        { from: 'master_clock:clockOut', to: 'clock_divider:clockIn', color: '#06b6d4' },
        { from: 'clock_divider:div2Out', to: 'euclidean:clockIn', color: '#06b6d4' },
        { from: 'euclidean:trigOut', to: 'prob_gate:trigIn', color: '#fbbf24' },
        { from: 'prob_gate:trigOut', to: 'resonator_garden:gateIn', color: '#fbbf24' },
        { from: 'prob_gate:altOut', to: 'pluck:gateIn', color: '#fbbf24' },
        { from: 'clock_divider:div4Out', to: 'random_walk:clockIn', color: '#06b6d4' },
        { from: 'random_walk:pitchOut', to: 'quantizer:pitchIn', color: '#a855f7' },
        { from: 'quantizer:pitchOut', to: 'pluck:pitchIn', color: '#a855f7' },
        { from: 'quantizer:pitchOut', to: 'resonator_garden:pitchIn', color: '#a855f7' },
        { from: 'slow_random:cvOut', to: 'filter:cvCutoff', color: '#10b981' },
        { from: 'slow_random:invOut', to: 'resonator_garden:posCv', color: '#10b981' },
        { from: 'slow_random:cvOut', to: 'drone:cvTone', color: '#10b981' },
      ],
    },
  },

  deep_space: {
    name: '🪐 Deep Space & Harmonic Cluster',
    category: 'Cinematic & Sci-Fi',
    description: 'Interstellare Klangreise mit schwebendem 18-fachem Sinus-Schwarm, Zupfnoten, dunklem Sub-Drone und Attenuverter-Modulation.',
    state: {
      master: 0.8,
      modules: [
        m('slow_random', { rate: 0.06, smooth: 0.95, depth: 0.85, mode: 'smooth' }),
        m('random_walk', { stepSize: 1, range: 3, repeat: 12, mutation: 0.3, key: 9, scale: 'dorian', octave: 36 }),
        m('slope_generator', { rise: 2.5, fall: 4.0, curve: 0.5, cycle: 1, mode: 'loop' }),
        m('attenuverter', { ch1Scale: 0.65, ch1Offset: 0.2, ch2Scale: -0.5, ch2Offset: 0.3 }),
        m('pluck', { level: 0.65, tone: 2400, damp: 1.5, bright: 0.7, body: 0.5 }),
        m('spectral_swarm', { level: 0.65, count: 18, inharm: 0.28, scatter: 0.42, motion: 0.25, depth: 0.6, bright: 0.52, cohesion: 0.55 }),
        m('drone', {
          level: 0.45,
          tone: 580,
          detune: 8,
          sub: 0.65,
          fm: 0.12,
          drift: 0.85,
          root: 28,
          chord: 'minor',
          wave: 'sine',
        }, { voices: [true, true, true, false, false, false] }),
        m('noise', { level: 0.16, tone: 800, reso: 2.2, motion: 0.4, rate: 0.04, crackle: 0.08, color: 'pink', ftype: 'lowpass' }),
        m('chorus', { rate: 0.08, depth: 0.5, delay: 0.025, mix: 0.45 }),
        m('filter', { cutoff: 1800, reso: 2.5, drive: 0.15, lfoRate: 0.03, lfoDepth: 0.25, ftype: 'lowpass' }),
        m('delay', { time: 0.78, feedback: 0.62, tone: 1800, mod: 0.35, mix: 0.42, mode: 'stereo' }),
        m('reverb', { decay: 15.0, damp: 0.6, predelay: 0.05, tone: 3200, mix: 0.6 }),
      ],
      cables: [
        { from: 'slow_random:cvOut', to: 'attenuverter:in1', color: '#10b981' },
        { from: 'attenuverter:out1', to: 'pluck:pitchIn', color: '#a855f7' },
        { from: 'slow_random:invOut', to: 'spectral_swarm:scatterIn', color: '#10b981' },
        { from: 'slope_generator:envOut', to: 'filter:cvCutoff', color: '#10b981' },
        { from: 'slope_generator:eorOut', to: 'pluck:gateIn', color: '#fbbf24' },
        { from: 'random_walk:pitchOut', to: 'drone:pitchIn', color: '#a855f7' },
      ],
    },
  },

  berlin_school: {
    name: '🌊 Berlin School & Hypnotic Sequenz',
    category: 'Elektronisch & Klassik',
    description: 'Hypnotische 16-Step Analogsequenz im Stil von Tangerine Dream mit resonanter Moog-Bassline, kristallinen FM-Glocken und Band-Echo.',
    state: {
      master: 0.82,
      modules: [
        m('master_clock', { tempo: 122, swing: 0.08, running: 1 }),
        m('clock_divider', {}),
        m('sequencer', { tempo: 122, decay: 0.35 }),
        m('slope_generator', { rise: 0.02, fall: 0.25, curve: 0.8, cycle: 0, mode: 'env' }),
        m('bass', { level: 0.82, cutoff: 820, reso: 5.5, env: 0.72, decay: 0.32, sub: 0.55 }),
        m('fm_voice', { level: 0.58, ratio: 3.0, index: 2.2, decay: 0.45, feedback: 0.2 }),
        m('drum_rack', { level: 0.65, kDecay: 0.36, sSnap: 0.6, hDecay: 0.08, pTune: 320 }),
        m('drone', { level: 0.25, tone: 650, detune: 4, sub: 0.5, fm: 0.02, drift: 0.5, root: 33, chord: 'octaves', wave: 'saw' }, { voices: [true, false, true, false, false, false] }),
        m('filter', { cutoff: 1600, reso: 3.2, drive: 0.25, lfoRate: 0.1, lfoDepth: 0.15 }),
        m('delay', { time: 0.37, feedback: 0.64, tone: 2200, mod: 0.2, mix: 0.42, mode: 'pingpong' }),
        m('reverb', { decay: 6.2, damp: 0.5, tone: 3400, mix: 0.38 }),
      ],
      cables: [
        { from: 'master_clock:clockOut', to: 'sequencer:clockIn', color: '#06b6d4' },
        { from: 'master_clock:clockOut', to: 'clock_divider:clockIn', color: '#06b6d4' },
        { from: 'clock_divider:div4Out', to: 'drum_rack:trigKick', color: '#fbbf24' },
        { from: 'clock_divider:div8Out', to: 'drum_rack:trigSnare', color: '#fbbf24' },
        { from: 'clock_divider:div2Out', to: 'drum_rack:trigHat', color: '#fbbf24' },
        { from: 'sequencer:pitchOut', to: 'bass:pitchIn', color: '#a855f7' },
        { from: 'sequencer:gateOut', to: 'bass:gateIn', color: '#fbbf24' },
        { from: 'sequencer:pitchOut', to: 'fm_voice:pitchIn', color: '#a855f7' },
        { from: 'sequencer:gateOut', to: 'slope_generator:trigIn', color: '#fbbf24' },
        { from: 'slope_generator:envOut', to: 'filter:cvCutoff', color: '#10b981' },
      ],
    },
  },

  cyberpunk: {
    name: '⚡ Cyberpunk & Industrial Glitch',
    category: 'Industrial & Beat',
    description: 'Aggressiver Dark-Synth Sound mit getriebener Hybrid-Percussion, roboterhafter Morph Voice, 10-Bit Bitcrusher und verzerrter Bass-Line.',
    state: {
      master: 0.8,
      modules: [
        m('master_clock', { tempo: 96, swing: 0.14, running: 1 }),
        m('euclidean', { steps: 16, pulses: 7, rotation: 3 }),
        m('prob_gate', { chance: 0.85, burst: 2 }),
        m('slow_random', { rate: 0.25, smooth: 0.4, depth: 0.8, mode: 'stepped' }),
        m('hybrid_perc', { level: 0.88, tune: 52, body: 0.9, material: 0.78, drop: 0.65, noise: 0.22, snap: 0.5, length: 0.32, drive: 0.45 }),
        m('morph_voice', { level: 0.72, morph: 0.75, bright: 3400, formant: 0.35, rough: 0.55, detune: 18, attack: 0.08, release: 0.8, voices: 4, jump: 0.3 }),
        m('bass', { level: 0.82, cutoff: 580, reso: 6.2, env: 0.68, decay: 0.42, sub: 0.6 }),
        m('noise', { level: 0.18, tone: 2600, reso: 3.5, motion: 0.3, rate: 0.2, crackle: 0.35, color: 'white', ftype: 'bandpass' }),
        m('lofi', { bitDepth: 10, sampleRate: 16000, noise: 0.25, flutter: 0.15 }),
        m('filter', { cutoff: 2800, reso: 4.5, drive: 0.42, lfoRate: 0.15, lfoDepth: 0.3 }),
        m('delay', { time: 0.31, feedback: 0.48, tone: 1600, mod: 0.1, mix: 0.32, mode: 'stereo' }),
        m('reverb', { decay: 4.8, damp: 0.65, tone: 2800, mix: 0.36 }),
      ],
      cables: [
        { from: 'master_clock:clockOut', to: 'euclidean:clockIn', color: '#06b6d4' },
        { from: 'euclidean:trigOut', to: 'prob_gate:trigIn', color: '#fbbf24' },
        { from: 'prob_gate:trigOut', to: 'hybrid_perc:gateIn', color: '#fbbf24' },
        { from: 'prob_gate:altOut', to: 'morph_voice:gateIn', color: '#fbbf24' },
        { from: 'euclidean:accentOut', to: 'bass:gateIn', color: '#fbbf24' },
        { from: 'slow_random:cvOut', to: 'morph_voice:morphCv', color: '#10b981' },
        { from: 'slow_random:invOut', to: 'filter:cvCutoff', color: '#10b981' },
        { from: 'slow_random:cvOut', to: 'hybrid_perc:materialCv', color: '#10b981' },
      ],
    },
  },

  biophilic: {
    name: '🍃 Biophilic Forest & Nature Ambient',
    category: 'Organisch & Natur',
    description: 'Lebendige Bio-Synthese: Sanfter Nieselregen, warme Rhodes-Akkorde, resonantes Holzglockenspiel und atemberaubender Naturhall.',
    state: {
      master: 0.8,
      modules: [
        m('master_clock', { tempo: 68, swing: 0.08, running: 1 }),
        m('slow_random', { rate: 0.09, smooth: 0.88, depth: 0.7, mode: 'smooth' }),
        m('random_walk', { stepSize: 2, range: 2, repeat: 8, mutation: 0.3, key: 0, scale: 'majorPenta', octave: 52 }),
        m('quantizer', { key: 0, scale: 'majorPenta', transpose: 0 }),
        m('resonator_garden', { level: 0.7, material: 0.35, size: 0.52, damp: 0.42, pos: 0.35, spread: 0.7, decay: 4.2, modes: 8 }),
        m('keys', { level: 0.65, cutoff: 1400, reso: 1.2, attack: 0.9, release: 2.8, detune: 6, wave: 'triangle', key: 0, scale: 'majorPenta', octave: 48 }),
        m('noise', { level: 0.22, tone: 950, reso: 1.0, motion: 0.6, rate: 0.06, crackle: 0.45, color: 'pink', ftype: 'lowpass' }),
        m('drone', { level: 0.28, tone: 520, detune: 3, sub: 0.4, fm: 0.01, drift: 0.6, root: 36, chord: 'major', wave: 'sine' }, { voices: [true, false, true, false, false, false] }),
        m('tremolo', { rate: 0.85, depth: 0.35, shape: 'sine' }),
        m('chorus', { rate: 0.12, depth: 0.45, delay: 0.02, mix: 0.38 }),
        m('delay', { time: 0.62, feedback: 0.54, tone: 2000, mod: 0.25, mix: 0.38, mode: 'pingpong' }),
        m('reverb', { decay: 9.0, damp: 0.5, predelay: 0.04, tone: 3200, mix: 0.5 }),
      ],
      cables: [
        { from: 'master_clock:clockOut', to: 'random_walk:clockIn', color: '#06b6d4' },
        { from: 'random_walk:pitchOut', to: 'quantizer:pitchIn', color: '#a855f7' },
        { from: 'quantizer:pitchOut', to: 'keys:pitchIn', color: '#a855f7' },
        { from: 'random_walk:gateOut', to: 'keys:gateIn', color: '#fbbf24' },
        { from: 'slow_random:cvOut', to: 'resonator_garden:gateIn', color: '#fbbf24' },
        { from: 'quantizer:pitchOut', to: 'resonator_garden:pitchIn', color: '#a855f7' },
        { from: 'slow_random:invOut', to: 'resonator_garden:posCv', color: '#10b981' },
      ],
    },
  },

  dreampop: {
    name: '☁️ Ethereal Dream-Pop & Shimmer Soundscape',
    category: 'Dream Pop & Shimmer',
    description: 'Zarte Harfen-Plucks in Dur-Penta, sanfter Chor-Swarm, Vintage Chorus und 12 Sekunden Shimmer-Hall.',
    state: {
      master: 0.82,
      modules: [
        m('master_clock', { tempo: 88, swing: 0.1, running: 1 }),
        m('clock_divider', {}),
        m('random_walk', { stepSize: 2, range: 2, repeat: 8, mutation: 0.25, key: 6, scale: 'majorPenta', octave: 54 }),
        m('quantizer', { key: 6, scale: 'majorPenta', transpose: 0 }),
        m('pluck', { level: 0.72, tone: 4200, damp: 1.1, bright: 0.88, body: 0.4 }),
        m('spectral_swarm', { level: 0.6, count: 16, inharm: 0.12, scatter: 0.32, motion: 0.2, depth: 0.5, bright: 0.65, cohesion: 0.6 }),
        m('keys', { level: 0.55, cutoff: 1800, reso: 1.4, attack: 1.1, release: 3.2, detune: 8, wave: 'saw', key: 6, scale: 'majorPenta', octave: 48 }),
        m('chorus', { rate: 0.18, depth: 0.55, delay: 0.024, mix: 0.48 }),
        m('delay', { time: 0.48, feedback: 0.58, tone: 2800, mod: 0.3, mix: 0.42, mode: 'pingpong' }),
        m('reverb', { decay: 12.0, damp: 0.45, predelay: 0.03, tone: 4200, mix: 0.55 }),
      ],
      cables: [
        { from: 'master_clock:clockOut', to: 'clock_divider:clockIn', color: '#06b6d4' },
        { from: 'clock_divider:div2Out', to: 'random_walk:clockIn', color: '#06b6d4' },
        { from: 'random_walk:pitchOut', to: 'quantizer:pitchIn', color: '#a855f7' },
        { from: 'quantizer:pitchOut', to: 'pluck:pitchIn', color: '#a855f7' },
        { from: 'random_walk:gateOut', to: 'pluck:gateIn', color: '#fbbf24' },
        { from: 'clock_divider:div4Out', to: 'keys:gateIn', color: '#fbbf24' },
        { from: 'quantizer:pitchOut', to: 'keys:pitchIn', color: '#a855f7' },
        { from: 'clock_divider:div2Out', to: 'spectral_swarm:scatterIn', color: '#fbbf24' },
      ],
    },
  },

  dub_techno: {
    name: '🥁 Minimal Dub-Techno & Tape Echo',
    category: 'Dub Techno & Minimal',
    description: 'Subterrane 808-Subbässe, metallische FM-Chordstabs, warmes Band-Echo mit 72% Feedback und staubige Lo-Fi-Textur.',
    state: {
      master: 0.82,
      modules: [
        m('master_clock', { tempo: 118, swing: 0.2, running: 1 }),
        m('clock_divider', {}),
        m('euclidean', { steps: 16, pulses: 5, rotation: 2 }),
        m('slow_random', { rate: 0.12, smooth: 0.75, depth: 0.65, mode: 'smooth' }),
        m('fm_voice', { level: 0.75, ratio: 1.5, index: 2.8, decay: 0.38, feedback: 0.35 }),
        m('bass', { level: 0.85, cutoff: 340, reso: 4.2, env: 0.5, decay: 0.55, sub: 0.75 }),
        m('drum_rack', { level: 0.8, kDecay: 0.48, sSnap: 0.55, hDecay: 0.07, pTune: 260 }),
        m('noise', { level: 0.14, tone: 1100, reso: 1.5, motion: 0.2, rate: 0.08, crackle: 0.25, color: 'pink', ftype: 'lowpass' }),
        m('lofi', { bitDepth: 12, sampleRate: 22000, noise: 0.15, flutter: 0.12 }),
        m('filter', { cutoff: 1100, reso: 4.2, drive: 0.2, lfoRate: 0.06, lfoDepth: 0.22, ftype: 'lowpass' }),
        m('delay', { time: 0.38, feedback: 0.72, tone: 1200, mod: 0.18, mix: 0.58, mode: 'pingpong' }),
        m('reverb', { decay: 7.2, damp: 0.6, predelay: 0.04, tone: 2400, mix: 0.45 }),
      ],
      cables: [
        { from: 'master_clock:clockOut', to: 'clock_divider:clockIn', color: '#06b6d4' },
        { from: 'clock_divider:div4Out', to: 'drum_rack:trigKick', color: '#fbbf24' },
        { from: 'clock_divider:div8Out', to: 'drum_rack:trigSnare', color: '#fbbf24' },
        { from: 'clock_divider:div2Out', to: 'drum_rack:trigHat', color: '#fbbf24' },
        { from: 'clock_divider:div4Out', to: 'bass:gateIn', color: '#fbbf24' },
        { from: 'euclidean:trigOut', to: 'fm_voice:gateIn', color: '#fbbf24' },
        { from: 'slow_random:cvOut', to: 'filter:cvCutoff', color: '#10b981' },
        { from: 'slow_random:invOut', to: 'fm_voice:cvIndex', color: '#10b981' },
        { from: 'slow_random:cvOut', to: 'delay:feedbackCv', color: '#10b981' },
      ],
    },
  },

  sleep: {
    name: '🌙 Somnus (Schlaf & Traumdrift)',
    category: 'Deep Sleep & Relaxation',
    description: 'Beruhigende Delta-Wellen-Frequenzen, sanfter Tri-Drone, gefiltertes rosa Rauschen, samtige Keys und 12s Raumhall.',
    state: {
      master: 0.75,
      modules: [
        m('drone', {
          level: 0.62,
          tone: 680,
          detune: 4,
          sub: 0.48,
          fm: 0.02,
          drift: 0.75,
          root: 33,
          chord: 'sus',
          wave: 'triangle',
        }, { voices: [true, true, true, false, true, false] }),
        m('noise', {
          level: 0.15,
          tone: 420,
          reso: 0.8,
          motion: 0.65,
          rate: 0.05,
          crackle: 0.02,
          color: 'pink',
          ftype: 'lowpass',
        }),
        m('keys', {
          level: 0.55,
          cutoff: 950,
          reso: 1.0,
          attack: 1.4,
          release: 3.8,
          detune: 5,
          wave: 'triangle',
          key: 9,
          scale: 'dorian',
          octave: 48,
        }),
        m('filter', {
          cutoff: 900,
          reso: 1.2,
          drive: 0.06,
          lfoRate: 0.04,
          lfoDepth: 0.22,
          ftype: 'lowpass',
        }),
        m('chorus', {
          rate: 0.1,
          depth: 0.42,
          delay: 0.022,
          mix: 0.35,
        }),
        m('delay', {
          time: 0.88,
          feedback: 0.52,
          tone: 1300,
          mod: 0.18,
          mix: 0.32,
          mode: 'stereo',
        }),
        m('reverb', {
          decay: 12.0,
          damp: 0.65,
          predelay: 0.04,
          tone: 3400,
          mix: 0.55,
        }),
      ],
      cables: [
        { from: 'filter:cvCutoff', to: 'drone:cvTone', color: '#10b981' },
      ],
    },
  },

  solar: {
    name: '☀️ Solar 42 Drone Desk',
    category: 'Drone & Space',
    description: 'Schwebendes Solar-Akkord-Cluster mit analoger Schwebung, Slow-Random Filteratmung und weiten Stereo-Echos.',
    state: {
      master: 0.8,
      modules: [
        m('slow_random', { rate: 0.08, smooth: 0.92, depth: 0.8, mode: 'smooth' }),
        m('drone', {
          level: 0.58,
          tone: 720,
          detune: 12,
          sub: 0.55,
          fm: 0.16,
          drift: 0.85,
          root: 33,
          chord: 'solarchord',
          wave: 'triangle',
        }, { voices: [true, true, true, false, true, false] }),
        m('keys', { level: 0.45, cutoff: 1100, reso: 1.2, attack: 1.5, release: 3.5, detune: 8, wave: 'sine', key: 9, scale: 'dorian', octave: 48 }),
        m('noise', { level: 0.14, tone: 600, reso: 1.8, motion: 0.4, rate: 0.05, crackle: 0.04, color: 'pink', ftype: 'lowpass' }),
        m('chorus', { rate: 0.1, depth: 0.45, delay: 0.02, mix: 0.4 }),
        m('filter', { cutoff: 1400, reso: 2.8, drive: 0.15, lfoRate: 0.04, lfoDepth: 0.25, ftype: 'lowpass' }),
        m('delay', { time: 0.65, feedback: 0.58, tone: 1600, mod: 0.28, mix: 0.42, mode: 'pingpong' }),
        m('reverb', { decay: 10.0, damp: 0.55, predelay: 0.04, tone: 3200, mix: 0.55 }),
      ],
      cables: [
        { from: 'slow_random:cvOut', to: 'filter:cvCutoff', color: '#10b981' },
        { from: 'slow_random:invOut', to: 'drone:cvTone', color: '#10b981' },
        { from: 'slow_random:cvOut', to: 'drone:cvDetune', color: '#10b981' },
      ],
    },
  },

  sequence: {
    name: '🌌 Ambient Sequenz & Plucks',
    category: 'Melodisch & Step-Sequenz',
    description: 'Melodischer Step-Sequencer trifft auf perkussiven Pluck-Synth, Bass-Begleitung, Ping-Pong Echos und weite Hallfahnen.',
    state: {
      master: 0.82,
      modules: [
        m('master_clock', { tempo: 86, swing: 0.08, running: 1 }),
        m('clock_divider', {}),
        m('sequencer', { tempo: 86, decay: 0.55 }),
        m('pluck', { level: 0.72, tone: 3400, damp: 1.0, bright: 0.75, body: 0.38 }),
        m('bass', { level: 0.7, cutoff: 540, reso: 4.5, env: 0.6, decay: 0.45, sub: 0.5 }),
        m('drone', { level: 0.3, tone: 850, detune: 4, sub: 0.4, fm: 0.03, drift: 0.6, root: 33, chord: 'sus', wave: 'triangle' }, { voices: [true, false, true, false, false, false] }),
        m('noise', { level: 0.12, tone: 1600, reso: 1.0, motion: 0.3, rate: 0.05, crackle: 0.03, color: 'pink', ftype: 'bandpass' }),
        m('chorus', { rate: 0.14, depth: 0.4, delay: 0.02, mix: 0.35 }),
        m('delay', { time: 0.48, feedback: 0.58, tone: 2200, mod: 0.25, mix: 0.42, mode: 'pingpong' }),
        m('reverb', { decay: 8.5, damp: 0.5, predelay: 0.03, tone: 3600, mix: 0.48 }),
      ],
      cables: [
        { from: 'master_clock:clockOut', to: 'sequencer:clockIn', color: '#06b6d4' },
        { from: 'master_clock:clockOut', to: 'clock_divider:clockIn', color: '#06b6d4' },
        { from: 'sequencer:pitchOut', to: 'pluck:pitchIn', color: '#a855f7' },
        { from: 'sequencer:gateOut', to: 'pluck:gateIn', color: '#fbbf24' },
        { from: 'clock_divider:div4Out', to: 'bass:gateIn', color: '#fbbf24' },
        { from: 'sequencer:pitchOut', to: 'bass:pitchIn', color: '#a855f7' },
      ],
    },
  },

  lofi: {
    name: '📼 Lo-Fi Tape & Vintage Keys',
    category: 'Vintage & Lo-Fi',
    description: 'Schwelgerische E-Piano Akkorde mit authentischem Tape-Flutter, sanftem Vinyl-Knistern, FM-Glocken und Tremolo-Vibrato.',
    state: {
      master: 0.85,
      modules: [
        m('master_clock', { tempo: 78, swing: 0.16, running: 1 }),
        m('random_walk', { stepSize: 2, range: 2, repeat: 8, mutation: 0.3, key: 5, scale: 'majorPenta', octave: 50 }),
        m('quantizer', { key: 5, scale: 'majorPenta', transpose: 0 }),
        m('keys', { level: 0.7, cutoff: 1800, reso: 1.1, attack: 0.05, release: 2.2, detune: 7, wave: 'triangle', key: 5, scale: 'majorPenta', octave: 48 }),
        m('fm_voice', { level: 0.52, ratio: 2.0, index: 1.6, decay: 1.2, feedback: 0.15 }),
        m('noise', { level: 0.16, tone: 2400, reso: 1.5, motion: 0.15, rate: 0.08, crackle: 0.65, color: 'white', ftype: 'highpass' }),
        m('lofi', { bitDepth: 11, sampleRate: 18000, noise: 0.3, flutter: 0.28 }),
        m('tremolo', { rate: 2.2, depth: 0.3, shape: 'triangle' }),
        m('delay', { time: 0.42, feedback: 0.45, tone: 1400, mod: 0.32, mix: 0.35, mode: 'stereo' }),
        m('reverb', { decay: 4.5, damp: 0.6, predelay: 0.02, tone: 2600, mix: 0.38 }),
      ],
      cables: [
        { from: 'master_clock:clockOut', to: 'random_walk:clockIn', color: '#06b6d4' },
        { from: 'random_walk:pitchOut', to: 'quantizer:pitchIn', color: '#a855f7' },
        { from: 'quantizer:pitchOut', to: 'keys:pitchIn', color: '#a855f7' },
        { from: 'random_walk:gateOut', to: 'keys:gateIn', color: '#fbbf24' },
        { from: 'quantizer:pitchOut', to: 'fm_voice:pitchIn', color: '#a855f7' },
        { from: 'random_walk:gateOut', to: 'fm_voice:gateIn', color: '#fbbf24' },
      ],
    },
  },

  empty: {
    name: '⬚ Leeres Board (Tabula Rasa)',
    category: 'Eigener Aufbau',
    description: 'Völlig freie Arbeitsfläche ohne Module und Kabel zum eigenen Rack-Aufbau von Grund auf.',
    state: { master: 0.8, modules: [], cables: [] },
  },
};
