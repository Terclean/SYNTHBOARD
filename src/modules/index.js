// Modul-Registry, Rack-Engine & Board-Vorlagen
import { DroneModule, KeysModule, SequencerModule, NoiseModule } from './sources.js';
import { PluckModule, FmVoiceModule, BassModule, DrumRackModule } from './instruments.js';
import { MorphVoiceModule, HybridPercModule, ResonatorGardenModule, SpectralSwarmModule } from './voices.js';
import { GranularCloudModule } from './granular.js';
import { SceneConductorModule } from './conductor.js';
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
    SceneConductorModule,

    // Instrumente & Klangquellen
    DroneModule, PluckModule, FmVoiceModule, BassModule,
    DrumRackModule, KeysModule, SequencerModule, NoiseModule,
    MorphVoiceModule, HybridPercModule, ResonatorGardenModule, GranularCloudModule, SpectralSwarmModule,

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
  generative: {
    name: '⚡ Generatives Modular-System (Showcase)',
    state: {
      master: 0.82,
      modules: [
        // Steuerung
        m('master_clock', { tempo: 86, swing: 0.12, running: 1 }),
        m('clock_divider', {}),
        m('euclidean', { steps: 16, pulses: 5, rotation: 1 }),
        m('prob_gate', { chance: 0.82, burst: 1 }),
        m('random_walk', { stepSize: 2, range: 2, repeat: 8, mutation: 0.25, seed: 42, key: 9, scale: 'dorian', octave: 48 }),
        m('quantizer', { transpose: 0, key: 9, scale: 'dorian' }),
        m('slow_random', { rate: 0.14, smooth: 0.85, depth: 0.72, mode: 'smooth' }),
        m('macro', { density: 0.75, variation: 0.35, motion: 0.6, seed: 42 }),

        // Instrumente & Klangquellen
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

        // Effektkette
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
  sleep: {
    name: '🌙 Somnus (Schlaf & Traum)',
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
    },
  },
  solar: {
    name: '☀️ Solar Drone Desk',
    state: { master: 0.8, modules: [
      m('drone'), m('keys'),
      m('filter', { cutoff: 1800, lfoDepth: 0.3 }), m('delay', { mix: 0.35 }), m('reverb', { decay: 6, mix: 0.45 }),
    ] },
  },
  sequence: {
    name: '🌌 Ambient Sequenz',
    state: { master: 0.8, modules: [
      m('master_clock', { tempo: 84 }),
      m('sequencer', { tempo: 84, decay: 0.6 }),
      m('pluck', { level: 0.65 }),
      m('noise', { level: 0.15 }),
      m('drone', { level: 0.35, tone: 900 }, { voices: [true, false, true, false, false, false] }),
      m('chorus'), m('delay', { mode: 'pingpong', feedback: 0.55, mix: 0.4 }), m('reverb', { decay: 8, mix: 0.5 }),
    ],
    cables: [
      { from: 'master_clock:clockOut', to: 'sequencer:clockIn', color: '#06b6d4' },
      { from: 'sequencer:pitchOut', to: 'pluck:pitchIn', color: '#a855f7' },
      { from: 'sequencer:gateOut', to: 'pluck:gateIn', color: '#fbbf24' },
    ] },
  },
  lofi: {
    name: '📼 Lo-Fi Keys & FM',
    state: { master: 0.85, modules: [
      m('keys', { wave: 'triangle', cutoff: 2200, release: 1.8 }),
      m('fm_voice', { level: 0.5, ratio: 2.0, index: 1.8, decay: 1.5 }),
      m('noise', { level: 0.12, motion: 0.1, crackle: 0.6, ftype: 'highpass', tone: 3000 }),
      m('lofi'), m('tremolo', { rate: 2.5, depth: 0.25 }), m('reverb', { decay: 3, mix: 0.35 }),
    ] },
  },
  scenes: {
    name: '🎬 Szenen-Wechsel (Ambient ↔ Beats)',
    state: {
      master: 0.8,
      modules: [
        m('master_clock', { tempo: 92, swing: 0.1, running: 1 }),
        m('scene_conductor', { amount: 1, density: 1, vary: 0.15, mutation: 0.35, quant: 'bar', xfade: '2', scope: 'all', auto: '8', brk: '1', fx: 'on', key: 9, scale: 'minorPenta' }),

        m('hybrid_perc', { level: 0.85, tune: 58, body: 0.85, material: 0.1, drop: 0.6, noise: 0.1, snap: 0.35, length: 0.38, drive: 0.2 }),
        m('drum_rack', { level: 0.7, kDecay: 0.4, sSnap: 0.6, hDecay: 0.09, pTune: 420 }),
        m('bass', { level: 0.7, cutoff: 480, reso: 4.2, env: 0.55, decay: 0.5, sub: 0.5 }),
        m('morph_voice', { level: 0.6, morph: 0.35, bright: 2200, formant: 0.15, rough: 0.1, detune: 12, attack: 0.25, release: 1.8, voices: 3, jump: 0.2 }),
        m('resonator_garden', { level: 0.6, material: 0.55, size: 0.45, damp: 0.4, pos: 0.3, spread: 0.4, decay: 2.2, modes: 8 }),
        m('granular_cloud', { level: 0.6, pos: 0.3, size: 0.18, density: 16, pitch: 0, reverse: 0.2, scatter: 0.35, width: 0.7, scan: 0.1, jump: 0.5 }),
        m('spectral_swarm', { level: 0.55, count: 14, inharm: 0.2, scatter: 0.3, motion: 0.2, depth: 0.5, bright: 0.45, cohesion: 0.5 }),

        m('filter', { cutoff: 5200, reso: 1.2, drive: 0.05, lfoDepth: 0.05 }),
        m('delay', { time: 0.42, feedback: 0.42, tone: 2600, mod: 0.15, mix: 0.3, mode: 'pingpong' }),
        m('reverb', { decay: 7, damp: 0.5, tone: 3600, mix: 0.4 }),
      ],
      cables: [
        { from: 'master_clock:clockOut', to: 'scene_conductor:clockIn', color: '#06b6d4' },
        { from: 'scene_conductor:kickOut', to: 'hybrid_perc:gateIn', color: '#fbbf24' },
        { from: 'scene_conductor:snareOut', to: 'drum_rack:trigSnare', color: '#fbbf24' },
        { from: 'scene_conductor:hatOut', to: 'drum_rack:trigHat', color: '#fbbf24' },
        { from: 'scene_conductor:percOut', to: 'resonator_garden:gateIn', color: '#fbbf24' },
        { from: 'scene_conductor:bassGate', to: 'bass:gateIn', color: '#fbbf24' },
        { from: 'scene_conductor:bassPitch', to: 'bass:pitchIn', color: '#a855f7' },
        { from: 'scene_conductor:leadGate', to: 'morph_voice:gateIn', color: '#fbbf24' },
        { from: 'scene_conductor:leadPitch', to: 'morph_voice:pitchIn', color: '#a855f7' },
        { from: 'scene_conductor:leadPitch', to: 'resonator_garden:pitchIn', color: '#a855f7' },
        { from: 'scene_conductor:timbreOut', to: 'morph_voice:morphCv', color: '#10b981' },
        { from: 'scene_conductor:cloudOut', to: 'granular_cloud:vcaCv', color: '#10b981' },
        { from: 'scene_conductor:energyOut', to: 'granular_cloud:densityCv', color: '#10b981' },
        { from: 'scene_conductor:padOut', to: 'spectral_swarm:vcaCv', color: '#10b981' },
        { from: 'scene_conductor:changeOut', to: 'spectral_swarm:scatterIn', color: '#fbbf24' },
      ],
    },
  },
  empty: { name: '⬚ Leeres Board', state: { master: 0.8, modules: [], cables: [] } },
};
