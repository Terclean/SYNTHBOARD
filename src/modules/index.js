// Modul-Registry, Rack-Engine & Board-Vorlagen
import { DroneModule, KeysModule, SequencerModule, NoiseModule } from './sources.js';
import { PluckModule, FmVoiceModule, BassModule, DrumRackModule } from './instruments.js';
import { FeltPianoModule } from './piano.js';
import { ViolinModule } from './violin.js';
import { MorphVoiceModule, HybridPercModule, ResonatorGardenModule, SpectralSwarmModule } from './voices.js';
import { ChordGlideModule } from './chordGlide.js';
import {
  MasterClockModule, ClockDividerModule, EuclideanModule,
  ProbabilityGateModule, RandomWalkModule, ScaleQuantizerModule,
  SlowRandomModule, MacroControllerModule, SlopeGeneratorModule, AttenuverterModule,
  LogicSwitchModule, SnapshotControllerModule, ChordArpeggiatorModule
} from './controls.js';
import { FilterModule, DelayModule, ReverbModule, ChorusModule, TremoloModule, LoFiModule, GranularCloudModule } from './effects.js';
import { PatchSystem } from './patchSystem.js';
import { PIANO_OPERA_TEMPLATE } from './pianoOperaTemplate.js';

export const MODULES = Object.fromEntries(
  [
    // Steuerung / Generatoren
    MasterClockModule, ClockDividerModule, EuclideanModule,
    ProbabilityGateModule, RandomWalkModule, ScaleQuantizerModule,
    SlowRandomModule, MacroControllerModule, SlopeGeneratorModule, AttenuverterModule,
    LogicSwitchModule, SnapshotControllerModule, ChordArpeggiatorModule,

    // Instrumente & Klangquellen
    ChordGlideModule, ViolinModule, FeltPianoModule, DroneModule, PluckModule, FmVoiceModule, BassModule,
    DrumRackModule, KeysModule, SequencerModule, NoiseModule,
    MorphVoiceModule, HybridPercModule, ResonatorGardenModule, SpectralSwarmModule,

    // Effekte
    FilterModule, ChorusModule, TremoloModule, LoFiModule, DelayModule, ReverbModule, GranularCloudModule
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
    this.studioViewGate = this.ctx.createGain();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.masterValue;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.78;

    // Stereo L/R Analysatoren für das XY-Lissajous-Vectorscope
    this.splitter = this.ctx.createChannelSplitter ? this.ctx.createChannelSplitter(2) : null;
    this.analyserL = this.ctx.createAnalyser();
    this.analyserL.fftSize = 1024;
    this.analyserL.smoothingTimeConstant = 0.75;
    this.analyserR = this.ctx.createAnalyser();
    this.analyserR.fftSize = 1024;
    this.analyserR.smoothingTimeConstant = 0.75;

    this.chainGate.connect(this.studioViewGate);
    this.studioViewGate.connect(this.masterGain);
    this.buildLimiter();
    this.rewire(true);

    // Watchdog
    this.probe = new Float32Array(this.analyser.fftSize);
    this.watchdog = setInterval(() => this.checkHealth(), 1000);
  }

  setStudioActive(active) {
    this.studioViewGate.gain.setTargetAtTime(active ? 1 : 0, this.ctx.currentTime, 0.025);
  }

  buildLimiter() {
    if (this.limiter) {
      try {
        this.masterGain.disconnect();
        this.limiter.disconnect();
        this.analyser.disconnect();
        this.splitter?.disconnect();
      } catch { /* ignore */ }
    }
    this.limiter = this.ctx.createDynamicsCompressor();
    const t = this.ctx.currentTime;
    this.limiter.threshold.setValueAtTime(-8, t);
    this.limiter.knee.setValueAtTime(4, t);
    this.limiter.ratio.setValueAtTime(16, t);
    this.limiter.attack.setValueAtTime(0.003, t);
    this.limiter.release.setValueAtTime(0.25, t);
    this.masterGain.connect(this.limiter);
    this.limiter.connect(this.analyser);
    if (this.splitter) {
      this.limiter.connect(this.splitter);
      this.splitter.connect(this.analyserL, 0);
      this.splitter.connect(this.analyserR, 1);
    }
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
    mod.engine = this;
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
    this.moveModule(id, 'effect', newIndex);
  }

  moveModule(id, targetCategory, newIndex) {
    let fromList = null;
    let fromIdx = -1;
    if ((fromIdx = this.controls.findIndex((m) => m.id === id)) >= 0) fromList = this.controls;
    else if ((fromIdx = this.sources.findIndex((m) => m.id === id)) >= 0) fromList = this.sources;
    else if ((fromIdx = this.effects.findIndex((m) => m.id === id)) >= 0) fromList = this.effects;

    if (!fromList) return;
    const [mod] = fromList.splice(fromIdx, 1);

    const toList = targetCategory === 'control' ? this.controls
                 : targetCategory === 'source' ? this.sources
                 : targetCategory === 'effect' ? this.effects
                 : fromList;

    const insertIdx = typeof newIndex === 'number'
      ? Math.max(0, Math.min(toList.length, newIndex))
      : toList.length;

    toList.splice(insertIdx, 0, mod);

    if (fromList === this.effects || toList === this.effects) {
      this.rewire();
    }
  }

  find(id) {
    return this.controls.find((m) => m.id === id) ||
           this.sources.find((m) => m.id === id) ||
           this.effects.find((m) => m.id === id);
  }

  get(id) {
    return this.find(id);
  }

  get cables() {
    return this.patchSystem.getConnections().map((c) => ({
      id: c.id,
      from: `${c.fromModuleId}:${c.fromPortId}`,
      to: `${c.toModuleId}:${c.toPortId}`,
      color: c.color,
      signal: c.signal,
    }));
  }

  set cables(arr) {
    if (!Array.isArray(arr) || arr.length === 0) {
      this.patchSystem.clear();
    }
  }

  disconnect(fromStr, toStr) {
    const id = `${fromStr}->${toStr}`;
    this.patchSystem.disconnect(id);
  }

  findByType(type) {
    if (!type) return null;
    const t = String(type).toLowerCase();
    const aliasMap = {
      'probability_gate': 'prob_gate',
      'prob_gate': 'prob_gate',
      'scale_quantizer': 'quantizer',
      'quantizer': 'quantizer',
      'chord_arpeggiator': 'chord_arp',
      'arpeggiator': 'chord_arp',
      'arp': 'chord_arp',
      'granular': 'granular_cloud',
      'granular_cloud': 'granular_cloud',
      'cloud': 'granular_cloud',
    };
    const targetType = aliasMap[t] || t;
    return this.controls.find((m) => m.meta.type === targetType || m.meta.type === t) ||
           this.sources.find((m) => m.meta.type === targetType || m.meta.type === t) ||
           this.effects.find((m) => m.meta.type === targetType || m.meta.type === t);
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
      focusDock: this.focusDock?.getState(),
    };
  }

  clear() {
    this.patchSystem.clear();
    [...this.controls, ...this.sources, ...this.effects].forEach((m) => m.destroy());
    this.controls = [];
    this.sources = [];
    this.effects = [];
    this.snapshotSystem?.clear?.();
  }

  load(state) {
    this.clear();
    const now = this.ctx.currentTime;
    try {
      this.chainGate.gain.cancelScheduledValues(now);
      this.chainGate.gain.setValueAtTime(0.0001, now);
    } catch { /* ignore */ }
    (state?.modules || []).forEach((s) => this.add(s.type, s, -1, true));
    this.rewire(true);
    this.setMaster(state?.master ?? 0.8);
    try {
      this.chainGate.gain.setTargetAtTime(1.0, this.ctx.currentTime + 0.02, 0.03);
    } catch { /* ignore */ }
    if (state?.cables) {
      this.patchSystem.loadState(state.cables);
      setTimeout(() => this.patchSystem.onConnectionsChanged?.(), 30);
    }
    if (this.snapshotSystem) {
      if (state?.snapshots && typeof state.snapshots === 'object' && Object.keys(state.snapshots).length > 0) {
        this.snapshotSystem.loadState(state.snapshots);
      } else {
        this.snapshotSystem.clear();
      }
    }
    if (state?.focusDock && this.focusDock) {
      setTimeout(() => this.focusDock.loadState(state.focusDock, this), 50);
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
  start_here: {
    name: 'Start Here – Erster Ton',
    category: 'Einstieg & Lernen',
    description: 'Übersichtlicher 4-Modul-Einstieg: Ein warmes Drone-Pad wird rhythmisch von einem Slope Generator moduliert und in Hall gebettet.',
    state: {
      version: 2,
      master: 0.78,
      modules: [
        { id: 'clk_start', type: 'master_clock', values: { tempo: 84, swing: 0, running: 1 }, pos: { x: 60, y: 60 } },
        { id: 'slp_start', type: 'slope_generator', values: { rise: 1.4, fall: 2.2, curve: 0.5, scale: 0.85, offset: 0.15, mode: 'trig' }, pos: { x: 350, y: 60 } },
        { id: 'drn_start', type: 'drone', values: { level: 0.55, tone: 900, detune: 8, sub: 0.35, fm: 0.03, drift: 0.3, root: 36, chord: 'fifths', wave: 'triangle' }, extra: { voices: [true, true, false, false, false, false] }, pos: { x: 640, y: 60 } },
        { id: 'rev_start', type: 'reverb', values: { decay: 6.5, damp: 0.4, predelay: 0.02, tone: 3600, mix: 0.42 }, pos: { x: 960, y: 60 } },
      ],
      cables: [
        { from: 'clk_start:barOut', to: 'slp_start:trigIn', depth: 1.0 },
        { from: 'slp_start:envOut', to: 'drn_start:cvTone', depth: 0.65 },
      ],
    },
  },

  piano_opera: PIANO_OPERA_TEMPLATE,

  sleep: {
    name: 'Somnus (Schlaf & Traumdrift)',
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
      cables: [],
    },
  },

  solar: {
    name: 'Solar 42 Drone Desk',
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
          chord: 'major',
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
        { from: 'slow_random:cvOut', to: 'drone:cvFm', color: '#10b981' },
      ],
    },
  },

  tpl_sleep_calm: {
    id: 'tpl_sleep_calm',
    category: 'Beruhigung & Schlaf',
    name: '01. Deep Sleep & Warm Rain',
    description: 'Sanfte, langsam atmende Moll-Akkorde mit warmem Pink-Noise-Regen und gedämpftem Filz-Klavier.',
    state: {
      version: 2,
      master: 0.8,
      modules: [
        { id: 'clk1', type: 'master_clock', enabled: true, pos: { x: 60, y: 60 }, values: { tempo: 58, swing: 0, running: 1 } },
        { id: 'breath', type: 'slope_generator', enabled: true, pos: { x: 300, y: 60 }, values: { rise: 10, fall: 14, curve: 0.6, scale: 0.45, offset: 0.45, mode: 'loop' } },
        { id: 'drift', type: 'slow_random', enabled: true, pos: { x: 560, y: 60 }, values: { rate: 0.08, smooth: 2.4, depth: 0.5, mode: 'smooth' } },
        { id: 'chord_glide', type: 'chord_glide', enabled: true, pos: { x: 60, y: 340 }, values: { level: 0.72, glide: 2.4, cutoff: 720, attack: 1.8, release: 5.5, detune: 8, key: 9, scale: 'minor', progression: 'vi_IV_I_V', voiceLeading: 1, voiceCount: 4, clockDiv: 64 } },
        { id: 'rain', type: 'noise', enabled: true, pos: { x: 360, y: 340 }, values: { level: 0.14, tone: 950, reso: 0.8, motion: 0.4, rate: 0.06, crackle: 0.05, color: 'pink', ftype: 'lowpass' } },
        { id: 'filter', type: 'filter', enabled: true, pos: { x: 60, y: 640 }, values: { cutoff: 1150, reso: 0.6, drive: 0.02, lfoRate: 0.04, lfoDepth: 0.05, ftype: 'lowpass' } },
        { id: 'reverb', type: 'reverb', enabled: true, pos: { x: 340, y: 640 }, values: { decay: 9.5, damp: 0.72, predelay: 0.04, tone: 1900, mix: 0.56 } },
      ],
      cables: [
        { from: 'clk1:clockOut', to: 'chord_glide:clockIn' },
        { from: 'breath:envOut', to: 'chord_glide:vcaCv', depth: 0.35 },
        { from: 'drift:cvOut', to: 'rain:cvTone', depth: 0.25 },
      ],
      snapshots: {
        activeSlot: 1,
        currentSpeed: 10,
        slots: {
          1: { name: 'Warm Dusk', values: { chord_glide: { cutoff: 720 }, rain: { level: 0.14 } } },
          2: { name: 'Deep Sleep', values: { chord_glide: { cutoff: 480, level: 0.6 }, rain: { level: 0.2 }, reverb: { decay: 12.0, mix: 0.65 } } },
          3: { name: 'Soft Dawn', values: { chord_glide: { cutoff: 1100, level: 0.78 }, rain: { level: 0.08 } } },
        },
      },
    },
  },

  tpl_space_drone: {
    id: 'tpl_space_drone',
    category: 'Drone & Soundscape',
    name: '02. Solar-42 Deep Space Drone',
    description: 'Endlose 6-stimmige Analog-Drone kombiniert mit 18 schwebenden Spectral-Swarm-Teiltönen und Granular-Shimmer.',
    state: {
      version: 2,
      master: 0.82,
      modules: [
        { id: 'lfo1', type: 'slope_generator', enabled: true, pos: { x: 60, y: 60 }, values: { rise: 16, fall: 20, curve: 0.55, scale: 0.8, offset: 0.1, mode: 'loop' } },
        { id: 'drift', type: 'slow_random', enabled: true, pos: { x: 320, y: 60 }, values: { rate: 0.06, smooth: 2.8, depth: 0.65, mode: 'smooth' } },
        { id: 'drone1', type: 'drone', enabled: true, pos: { x: 60, y: 340 }, values: { level: 0.68, tone: 1100, detune: 14, sub: 0.7, fm: 0.08, drift: 0.6, root: 29, chord: 'fifths', wave: 'sawtooth', scaleLock: 1, key: 5, scale: 'dorian' } },
        { id: 'swarm', type: 'spectral_swarm', enabled: true, pos: { x: 360, y: 340 }, values: { level: 0.48, count: 18, inharm: 0.12, scatter: 0.25, motion: 0.18, depth: 0.55, bright: 0.42, cohesion: 0.65, decay: 3.5, mode: 'drone' } },
        { id: 'cloud', type: 'granular_cloud', enabled: true, pos: { x: 60, y: 640 }, values: { size: 0.22, texture: 0.72, feedback: 0.42, mix: 0.32, pitchMode: 'fifthUp', freeze: 0 } },
        { id: 'reverb', type: 'reverb', enabled: true, pos: { x: 340, y: 640 }, values: { decay: 11.5, damp: 0.62, predelay: 0.035, tone: 2600, mix: 0.55 } },
      ],
      cables: [
        { from: 'lfo1:envOut', to: 'drone1:cvTone', depth: 0.45 },
        { from: 'drift:cvOut', to: 'swarm:cohesionCv', depth: 0.4 },
        { from: 'drift:invOut', to: 'cloud:cvMix', depth: 0.25 },
      ],
      snapshots: {
        activeSlot: 1,
        currentSpeed: 12,
        slots: {
          1: { name: 'Deep Orbit', values: { drone1: { tone: 950, fm: 0.06 }, swarm: { scatter: 0.2 } } },
          2: { name: 'Solar Flare', values: { drone1: { tone: 2200, fm: 0.22 }, swarm: { scatter: 0.55, bright: 0.68 }, cloud: { mix: 0.48 } } },
          3: { name: 'Frozen Void', values: { drone1: { tone: 600, level: 0.5 }, cloud: { freeze: 1, mix: 0.55 } } },
        },
      },
    },
  },

  tpl_felt_piano: {
    id: 'tpl_felt_piano',
    category: 'Piano & Neoklassik',
    name: '03. Intimate Felt Piano & Arpeggio',
    description: 'Warmes Filz-Klavier im Ólafur-Arnalds-Stil mit polyphoner Chord-Arp-Kette und sanftem Tape-Delay.',
    state: {
      version: 2,
      master: 0.84,
      modules: [
        { id: 'clk1', type: 'master_clock', enabled: true, pos: { x: 60, y: 60 }, values: { tempo: 76, swing: 0.05, running: 1 } },
        { id: 'div1', type: 'clock_divider', enabled: true, pos: { x: 280, y: 60 }, values: {} },
        { id: 'drift', type: 'slow_random', enabled: true, pos: { x: 500, y: 60 }, values: { rate: 0.14, smooth: 1.8, depth: 0.4, mode: 'smooth' } },
        { id: 'chord_glide', type: 'chord_glide', enabled: true, pos: { x: 60, y: 340 }, values: { level: 0.26, glide: 0.5, cutoff: 900, attack: 0.8, release: 3.5, detune: 6, key: 2, scale: 'minor', progression: 'i_VI_III_VII', voiceLeading: 1, voiceCount: 4, clockDiv: 64 } },
        { id: 'arp1', type: 'chord_arp', enabled: true, pos: { x: 360, y: 340 }, values: { octaves: 2, gateLen: 0.75, density: 0.88, accentEvery: 4, pattern: 'updown' } },
        { id: 'piano', type: 'felt_piano', enabled: true, pos: { x: 620, y: 340 }, values: { level: 0.78, felt: 0.78, decay: 3.8, color: 2200, body: 0.72, hammer: 0.28, octave: 48, chord: 'single', scale: 'minor' } },
        { id: 'delay', type: 'delay', enabled: true, pos: { x: 60, y: 640 }, values: { time: 0.395, feedback: 0.32, tone: 2100, mod: 0.18, mix: 0.24, mode: 'pingpong' } },
        { id: 'reverb', type: 'reverb', enabled: true, pos: { x: 340, y: 640 }, values: { decay: 5.8, damp: 0.62, predelay: 0.025, tone: 2800, mix: 0.42 } },
      ],
      cables: [
        { from: 'clk1:clockOut', to: 'div1:clockIn' },
        { from: 'clk1:clockOut', to: 'chord_glide:clockIn' },
        { from: 'div1:div2Out', to: 'arp1:clockIn' },
        { from: 'chord_glide:pitchOut', to: 'arp1:pitchIn' },
        { from: 'arp1:pitchOut', to: 'piano:pitchIn' },
        { from: 'arp1:gateOut', to: 'piano:gateIn' },
        { from: 'drift:cvOut', to: 'piano:feltCv', depth: 0.2 },
      ],
      snapshots: {
        activeSlot: 1,
        currentSpeed: 6,
        slots: {
          1: { name: 'Soft Felt', values: { piano: { felt: 0.85, color: 1800 }, arp1: { density: 0.75, octaves: 1 } } },
          2: { name: 'Flowing Arpeggio', values: { piano: { felt: 0.68, color: 2600 }, arp1: { density: 0.95, octaves: 2 } } },
          3: { name: 'Wide Octave Peak', values: { piano: { felt: 0.55, color: 3200, chord: 'octave' }, chord_glide: { level: 0.45, cutoff: 1500 } } },
        },
      },
    },
  },

  tpl_solo_violin: {
    id: 'tpl_solo_violin',
    category: 'Streicher & Kammermusik',
    name: '04. Neo-Classical Solo Violin',
    description: 'Ausdrucksstarke Solo-Violine mit Bogen-Atmung, sanftem Vibrato, Filz-Klavier und tiefem Cello-Fundament.',
    state: {
      version: 2,
      master: 0.84,
      modules: [
        { id: 'clk1', type: 'master_clock', enabled: true, pos: { x: 60, y: 60 }, values: { tempo: 72, swing: 0.02, running: 1 } },
        { id: 'div1', type: 'clock_divider', enabled: true, pos: { x: 280, y: 60 }, values: {} },
        { id: 'bow_breath', type: 'slope_generator', enabled: true, pos: { x: 500, y: 60 }, values: { rise: 8, fall: 12, curve: 0.55, scale: 0.55, offset: 0.35, mode: 'loop' } },
        { id: 'chord_glide', type: 'chord_glide', enabled: true, pos: { x: 60, y: 340 }, values: { level: 0.3, glide: 0.45, cutoff: 950, attack: 0.9, release: 4.0, detune: 6, key: 2, scale: 'minor', progression: 'i_VI_III_VII', voiceLeading: 1, voiceCount: 4, clockDiv: 64 } },
        { id: 'violin_seq', type: 'sequencer', enabled: true, pos: { x: 360, y: 340 }, values: { tempo: 72, level: 0, glide: 0.24, s1: 4, s2: 5, s3: 4, s4: 2, s5: 3, s6: 4, s7: 2, s8: 0, g1: 1, g2: 2, g3: 1, g4: 2, g5: 1, g6: 2, g7: 1, g8: 2, division: 1, key: 2, scale: 'minor', octave: 60 } },
        { id: 'violin', type: 'violin', enabled: true, pos: { x: 660, y: 340 }, values: { level: 0.72, bow: 0.44, vibrato: 0.48, glide: 0.24, tone: 2500, attack: 0.35, release: 2.4, articulation: 'sultasto', octave: 0 } },
        { id: 'cello', type: 'bass', enabled: true, pos: { x: 940, y: 340 }, values: { level: 0.32, cutoff: 220, reso: 0.8, env: 0.12, decay: 4.0, sub: 0.85 } },
        { id: 'reverb', type: 'reverb', enabled: true, pos: { x: 60, y: 640 }, values: { decay: 6.5, damp: 0.6, predelay: 0.028, tone: 3000, mix: 0.46 } },
      ],
      cables: [
        { from: 'clk1:clockOut', to: 'div1:clockIn' },
        { from: 'clk1:clockOut', to: 'chord_glide:clockIn' },
        { from: 'div1:div8Out', to: 'violin_seq:clockIn' },
        { from: 'violin_seq:pitchOut', to: 'violin:pitchIn' },
        { from: 'violin_seq:gateOut', to: 'violin:gateIn' },
        { from: 'chord_glide:rootOut', to: 'cello:pitchIn' },
        { from: 'chord_glide:gateOut', to: 'cello:gateIn' },
        { from: 'bow_breath:envOut', to: 'violin:bowCv', depth: 0.3 },
      ],
      snapshots: {
        activeSlot: 1,
        currentSpeed: 6,
        slots: {
          1: { name: 'Sul Tasto Whisper', values: { violin: { articulation: 'sultasto', bow: 0.4, tone: 2300, octave: 0 } } },
          2: { name: 'Lyrical Arco', values: { violin: { articulation: 'arco', bow: 0.56, tone: 3100, octave: 0 }, cello: { level: 0.48 } } },
          3: { name: 'Pizzicato Interlude', values: { violin: { articulation: 'pizz', attack: 0.02, release: 1.1 }, violin_seq: { division: 2 } } },
          4: { name: 'High Octave Climax', values: { violin: { articulation: 'arco', octave: 1, bow: 0.62, tone: 3400 }, chord_glide: { level: 0.55, cutoff: 1900 } } },
        },
      },
    },
  },

  tpl_organic_drums: {
    id: 'tpl_organic_drums',
    category: 'Drums & Percussion',
    name: '05. Organic Polyrhythm & Drums',
    description: 'Euklidische Polyrhythmen aus Analog-Drums, Hybrid-Percussion und gestimmtem Resonator-Holz.',
    state: {
      version: 2,
      master: 0.85,
      modules: [
        { id: 'clk1', type: 'master_clock', enabled: true, pos: { x: 60, y: 60 }, values: { tempo: 116, swing: 0.14, running: 1 } },
        { id: 'euc_k', type: 'euclidean', enabled: true, pos: { x: 280, y: 60 }, values: { steps: 16, pulses: 4, rotation: 0 } },
        { id: 'euc_s', type: 'euclidean', enabled: true, pos: { x: 520, y: 60 }, values: { steps: 16, pulses: 3, rotation: 4 } },
        { id: 'euc_p', type: 'euclidean', enabled: true, pos: { x: 760, y: 60 }, values: { steps: 13, pulses: 7, rotation: 2 } },
        { id: 'prob1', type: 'prob_gate', enabled: true, pos: { x: 1000, y: 60 }, values: { chance: 0.72, burst: 1 } },
        { id: 'drums', type: 'drum_rack', enabled: true, pos: { x: 60, y: 340 }, values: { level: 0.86, kDecay: 0.42, sSnap: 0.72, hDecay: 0.08, pTune: 340 } },
        { id: 'hperc', type: 'hybrid_perc', enabled: true, pos: { x: 340, y: 340 }, values: { level: 0.68, tune: 145, body: 0.7, material: 0.45, drop: 0.35, noise: 0.25, snap: 0.6, length: 0.22, drive: 0.12 } },
        { id: 'res', type: 'resonator_garden', enabled: true, pos: { x: 620, y: 340 }, values: { level: 0.56, material: 0.32, size: 0.42, damp: 0.55, pos: 0.35, spread: 0.3, decay: 1.6, modes: 6, excite: 'impulse' } },
        { id: 'delay', type: 'delay', enabled: true, pos: { x: 60, y: 640 }, values: { time: 0.388, feedback: 0.36, tone: 2400, mod: 0.12, mix: 0.26, mode: 'pingpong' } },
        { id: 'reverb', type: 'reverb', enabled: true, pos: { x: 340, y: 640 }, values: { decay: 2.4, damp: 0.65, predelay: 0.015, tone: 2800, mix: 0.22 } },
      ],
      cables: [
        { from: 'clk1:clockOut', to: 'euc_k:clockIn' },
        { from: 'clk1:clockOut', to: 'euc_s:clockIn' },
        { from: 'clk1:clockOut', to: 'euc_p:clockIn' },
        { from: 'euc_k:trigOut', to: 'drums:trigKick' },
        { from: 'euc_s:trigOut', to: 'drums:trigSnare' },
        { from: 'euc_p:trigOut', to: 'prob1:trigIn' },
        { from: 'prob1:trigOut', to: 'hperc:gateIn' },
        { from: 'prob1:altOut', to: 'res:gateIn' },
        { from: 'euc_p:invOut', to: 'drums:trigHat' },
      ],
      snapshots: {
        activeSlot: 1,
        currentSpeed: 2,
        slots: {
          1: { name: 'Minimal Pulse', values: { euc_k: { pulses: 4 }, euc_p: { pulses: 5 }, hperc: { level: 0.5 } } },
          2: { name: 'Tribal Groove', values: { euc_k: { pulses: 5 }, euc_p: { pulses: 9 }, hperc: { level: 0.78 }, res: { level: 0.65 } } },
          3: { name: 'Breakdown Wood', values: { drums: { level: 0.2 }, res: { level: 0.78, decay: 3.4 }, delay: { mix: 0.42 } } },
        },
      },
    },
  },

  tpl_lofi_chillhop: {
    id: 'tpl_lofi_chillhop',
    category: 'Lo-Fi & Chillhop',
    name: '06. Warm Lo-Fi Study Beats',
    description: 'Entspannte 78-BPM-Chillhop-Beats mit jazzigen Akkorden, warmem Vinyl-Knistern und sanftem Tape-Wobble.',
    state: {
      version: 2,
      master: 0.84,
      modules: [
        { id: 'clk1', type: 'master_clock', enabled: true, pos: { x: 60, y: 60 }, values: { tempo: 78, swing: 0.22, running: 1 } },
        { id: 'euc_k', type: 'euclidean', enabled: true, pos: { x: 280, y: 60 }, values: { steps: 16, pulses: 3, rotation: 0 } },
        { id: 'euc_s', type: 'euclidean', enabled: true, pos: { x: 520, y: 60 }, values: { steps: 8, pulses: 1, rotation: 4 } },
        { id: 'euc_h', type: 'euclidean', enabled: true, pos: { x: 760, y: 60 }, values: { steps: 16, pulses: 9, rotation: 0 } },
        { id: 'chord_glide', type: 'chord_glide', enabled: true, pos: { x: 60, y: 340 }, values: { level: 0.68, glide: 0.15, cutoff: 1250, attack: 0.08, release: 2.4, detune: 9, key: 5, scale: 'dorian', progression: 'ii_V_I_vi', voiceLeading: 1, voiceCount: 4, clockDiv: 32 } },
        { id: 'bass', type: 'bass', enabled: true, pos: { x: 360, y: 340 }, values: { level: 0.62, cutoff: 340, reso: 1.2, env: 0.25, decay: 1.2, sub: 0.75 } },
        { id: 'drums', type: 'drum_rack', enabled: true, pos: { x: 640, y: 340 }, values: { level: 0.76, kDecay: 0.36, sSnap: 0.58, hDecay: 0.05, pTune: 300 } },
        { id: 'vinyl', type: 'noise', enabled: true, pos: { x: 920, y: 340 }, values: { level: 0.12, tone: 2200, reso: 0.8, motion: 0.2, rate: 0.1, crackle: 0.65, color: 'tape', ftype: 'bandpass' } },
        { id: 'lofi', type: 'lofi', enabled: true, pos: { x: 60, y: 640 }, values: { drive: 0.14, bits: 16, tone: 3400, wobble: 0.22, level: 0.96 } },
        { id: 'reverb', type: 'reverb', enabled: true, pos: { x: 340, y: 640 }, values: { decay: 3.2, damp: 0.68, predelay: 0.02, tone: 2200, mix: 0.28 } },
      ],
      cables: [
        { from: 'clk1:clockOut', to: 'chord_glide:clockIn' },
        { from: 'clk1:clockOut', to: 'euc_k:clockIn' },
        { from: 'clk1:clockOut', to: 'euc_s:clockIn' },
        { from: 'clk1:clockOut', to: 'euc_h:clockIn' },
        { from: 'chord_glide:rootOut', to: 'bass:pitchIn' },
        { from: 'euc_k:trigOut', to: 'bass:gateIn' },
        { from: 'euc_k:trigOut', to: 'drums:trigKick' },
        { from: 'euc_s:trigOut', to: 'drums:trigSnare' },
        { from: 'euc_h:trigOut', to: 'drums:trigHat' },
      ],
      snapshots: {
        activeSlot: 1,
        currentSpeed: 3,
        slots: {
          1: { name: 'Chords & Vinyl Intro', values: { drums: { level: 0 }, bass: { level: 0 }, chord_glide: { cutoff: 1000 } } },
          2: { name: 'Full Study Beat', values: { drums: { level: 0.78 }, bass: { level: 0.65 }, chord_glide: { cutoff: 1400 } } },
          3: { name: 'Muffled Tape Filter', values: { lofi: { tone: 1600, wobble: 0.35 }, drums: { level: 0.55 } } },
        },
      },
    },
  },

  tpl_generative_harp: {
    id: 'tpl_generative_harp',
    category: 'Generatives Ambient',
    name: '07. Generative Harp & Kalimba Garden',
    description: 'Sich endlos weiterentwickelnde Zupf-Melodien in Hirajoshi-Skala mit Granular-Cloud-Shimmer.',
    state: {
      version: 2,
      master: 0.82,
      modules: [
        { id: 'clk1', type: 'master_clock', enabled: true, pos: { x: 60, y: 60 }, values: { tempo: 84, swing: 0.08, running: 1 } },
        { id: 'div1', type: 'clock_divider', enabled: true, pos: { x: 280, y: 60 }, values: {} },
        { id: 'walk1', type: 'random_walk', enabled: true, pos: { x: 500, y: 60 }, values: { stepSize: 2, range: 2, repeat: 8, mutation: 0.3, seed: 108, glide: 0, key: 2, scale: 'hirajoshi', octave: 60 } },
        { id: 'prob1', type: 'prob_gate', enabled: true, pos: { x: 760, y: 60 }, values: { chance: 0.68, burst: 1 } },
        { id: 'pluck1', type: 'pluck', enabled: true, pos: { x: 60, y: 340 }, values: { level: 0.72, tone: 2800, damp: 1.4, bright: 0.55, body: 0.55 } },
        { id: 'bell1', type: 'fm_voice', enabled: true, pos: { x: 340, y: 340 }, values: { level: 0.36, ratio: 2.0, index: 1.4, decay: 2.2, tone: 3400 } },
        { id: 'cloud', type: 'granular_cloud', enabled: true, pos: { x: 60, y: 640 }, values: { size: 0.16, texture: 0.65, feedback: 0.45, mix: 0.35, pitchMode: 'octUp', freeze: 0 } },
        { id: 'delay', type: 'delay', enabled: true, pos: { x: 340, y: 640 }, values: { time: 0.535, feedback: 0.44, tone: 2400, mod: 0.2, mix: 0.34, mode: 'pingpong' } },
        { id: 'reverb', type: 'reverb', enabled: true, pos: { x: 620, y: 640 }, values: { decay: 7.2, damp: 0.6, predelay: 0.03, tone: 3100, mix: 0.48 } },
      ],
      cables: [
        { from: 'clk1:clockOut', to: 'div1:clockIn' },
        { from: 'div1:div2Out', to: 'walk1:clockIn' },
        { from: 'walk1:gateOut', to: 'prob1:trigIn' },
        { from: 'walk1:pitchOut', to: 'pluck1:pitchIn' },
        { from: 'prob1:trigOut', to: 'pluck1:gateIn' },
        { from: 'walk1:pitchOut', to: 'bell1:pitchIn' },
        { from: 'prob1:altOut', to: 'bell1:gateIn' },
      ],
      snapshots: {
        activeSlot: 1,
        currentSpeed: 6,
        slots: {
          1: { name: 'Quiet Garden', values: { prob1: { chance: 0.55 }, cloud: { mix: 0.25 } } },
          2: { name: 'Shimmering Rain', values: { prob1: { chance: 0.8 }, cloud: { mix: 0.52, pitchMode: 'dualShimmer' }, delay: { feedback: 0.55 } } },
          3: { name: 'Frozen Crystal', values: { cloud: { freeze: 1, mix: 0.6 }, pluck1: { level: 0.5 } } },
        },
      },
    },
  },

  tpl_dark_halftime_trap: {
    id: 'tpl_dark_halftime_trap',
    category: 'Trap & Electronic',
    name: '08. Dark Halftime Trap & 808',
    description: 'Schwerer 68-BPM-Halftime-Groove mit dunklen Orgel-Pads, drückendem 808-Sub und Sidechain-Pumping.',
    state: {
      version: 2,
      master: 0.86,
      modules: [
        { id: 'clk1', type: 'master_clock', enabled: true, pos: { x: 60, y: 60 }, values: { tempo: 68, swing: 0.04, running: 1 } },
        { id: 'euc_k', type: 'euclidean', enabled: true, pos: { x: 280, y: 60 }, values: { steps: 16, pulses: 3, rotation: 0 } },
        { id: 'euc_s', type: 'euclidean', enabled: true, pos: { x: 520, y: 60 }, values: { steps: 8, pulses: 1, rotation: 4 } },
        { id: 'euc_h', type: 'euclidean', enabled: true, pos: { x: 760, y: 60 }, values: { steps: 16, pulses: 14, rotation: 0 } },
        { id: 'pump', type: 'slope_generator', enabled: true, pos: { x: 1000, y: 60 }, values: { rise: 0.03, fall: 0.26, curve: 0.45, scale: -0.45, offset: 1, mode: 'trig' } },
        { id: 'chord_glide', type: 'chord_glide', enabled: true, pos: { x: 60, y: 340 }, values: { level: 0.8, glide: 0.35, cutoff: 1800, attack: 0.25, release: 2.8, detune: 10, key: 0, scale: 'minor', progression: 'i_VI_III_VII', voiceLeading: 1, voiceCount: 5, clockDiv: 32 } },
        { id: 'sub808', type: 'bass', enabled: true, pos: { x: 360, y: 340 }, values: { level: 0.88, cutoff: 260, reso: 1.1, env: 0.28, decay: 1.5, sub: 1.0 } },
        { id: 'drums', type: 'drum_rack', enabled: true, pos: { x: 640, y: 340 }, values: { level: 0.9, kDecay: 0.58, sSnap: 0.86, hDecay: 0.06, pTune: 360 } },
        { id: 'filter', type: 'filter', enabled: true, pos: { x: 60, y: 640 }, values: { cutoff: 2600, reso: 0.8, drive: 0.14, lfoRate: 0.04, lfoDepth: 0.02, ftype: 'lowpass' } },
        { id: 'reverb', type: 'reverb', enabled: true, pos: { x: 340, y: 640 }, values: { decay: 4.4, damp: 0.62, predelay: 0.024, tone: 2600, mix: 0.34 } },
      ],
      cables: [
        { from: 'clk1:clockOut', to: 'chord_glide:clockIn' },
        { from: 'clk1:clockOut', to: 'euc_k:clockIn' },
        { from: 'clk1:clockOut', to: 'euc_s:clockIn' },
        { from: 'clk1:clockOut', to: 'euc_h:clockIn' },
        { from: 'chord_glide:rootOut', to: 'sub808:pitchIn' },
        { from: 'euc_k:trigOut', to: 'sub808:gateIn' },
        { from: 'euc_k:trigOut', to: 'drums:trigKick' },
        { from: 'euc_s:trigOut', to: 'drums:trigSnare' },
        { from: 'euc_h:trigOut', to: 'drums:trigHat' },
        { from: 'euc_k:trigOut', to: 'pump:trigIn' },
        { from: 'pump:envOut', to: 'chord_glide:vcaCv', depth: 0.45 },
      ],
      snapshots: {
        activeSlot: 1,
        currentSpeed: 2,
        slots: {
          1: { name: 'Dark Intro', values: { drums: { level: 0 }, sub808: { level: 0 }, pump: { scale: 0, offset: 1 }, chord_glide: { cutoff: 950 } } },
          2: { name: 'Heavy Drop', values: { drums: { level: 0.9 }, sub808: { level: 0.88 }, pump: { scale: -0.45, offset: 1 }, chord_glide: { cutoff: 2100 } } },
          3: { name: 'Rolling Peak', values: { euc_k: { pulses: 5 }, euc_h: { pulses: 16 }, chord_glide: { cutoff: 2600 }, filter: { cutoff: 3400 } } },
        },
      },
    },
  },

  tpl_cinematic_epic: {
    id: 'tpl_cinematic_epic',
    category: 'Cinematic & Filmscore',
    name: '09. Hans Zimmer Brass & Taiko Swell',
    description: 'Monumentaler Filmscore-Aufbau mit tiefen Brass-Drones, langsamem Filter-Swell und wuchtigen Taiko-Trommeln.',
    state: {
      version: 2,
      master: 0.85,
      modules: [
        { id: 'clk1', type: 'master_clock', enabled: true, pos: { x: 60, y: 60 }, values: { tempo: 64, swing: 0, running: 1 } },
        { id: 'euc_taiko', type: 'euclidean', enabled: true, pos: { x: 280, y: 60 }, values: { steps: 16, pulses: 3, rotation: 0 } },
        { id: 'swell', type: 'slope_generator', enabled: true, pos: { x: 520, y: 60 }, values: { rise: 14, fall: 10, curve: 0.65, scale: 0.75, offset: 0.15, mode: 'loop' } },
        { id: 'chord_glide', type: 'chord_glide', enabled: true, pos: { x: 60, y: 340 }, values: { level: 0.74, glide: 0.6, cutoff: 1450, attack: 1.1, release: 4.2, detune: 12, key: 2, scale: 'minor', progression: 'i_VI_III_VII', voiceLeading: 1, voiceCount: 6, clockDiv: 64 } },
        { id: 'brass_drone', type: 'drone', enabled: true, pos: { x: 360, y: 340 }, values: { level: 0.56, tone: 1100, detune: 14, sub: 0.9, fm: 0.08, drift: 0.15, root: 26, chord: 'octaves', wave: 'sawtooth', scaleLock: 1, key: 2, scale: 'minor' } },
        { id: 'taiko', type: 'hybrid_perc', enabled: true, pos: { x: 640, y: 340 }, values: { level: 0.82, tune: 52, body: 0.95, material: 0.18, drop: 0.7, noise: 0.22, snap: 0.45, length: 0.65, drive: 0.24 } },
        { id: 'filter', type: 'filter', enabled: true, pos: { x: 60, y: 640 }, values: { cutoff: 2200, reso: 0.75, drive: 0.12, lfoRate: 0.04, lfoDepth: 0.03, ftype: 'lowpass' } },
        { id: 'reverb', type: 'reverb', enabled: true, pos: { x: 340, y: 640 }, values: { decay: 8.2, damp: 0.58, predelay: 0.035, tone: 2900, mix: 0.48 } },
      ],
      cables: [
        { from: 'clk1:clockOut', to: 'chord_glide:clockIn' },
        { from: 'clk1:clockOut', to: 'euc_taiko:clockIn' },
        { from: 'chord_glide:rootOut', to: 'brass_drone:pitchIn' },
        { from: 'euc_taiko:trigOut', to: 'taiko:gateIn' },
        { from: 'swell:envOut', to: 'chord_glide:cutoffCv', depth: 0.55 },
        { from: 'swell:envOut', to: 'brass_drone:cvTone', depth: 0.45 },
      ],
      snapshots: {
        activeSlot: 1,
        currentSpeed: 6,
        slots: {
          1: { name: 'Quiet Horizon', values: { taiko: { level: 0 }, brass_drone: { level: 0.35, tone: 700 }, chord_glide: { cutoff: 900 } } },
          2: { name: 'Rising Tension', values: { taiko: { level: 0.68 }, brass_drone: { level: 0.58, tone: 1300 }, chord_glide: { cutoff: 1650 } } },
          3: { name: 'Full IMAX Finale', values: { euc_taiko: { pulses: 5 }, taiko: { level: 0.92 }, brass_drone: { level: 0.78, tone: 2200 }, chord_glide: { cutoff: 2800 }, filter: { cutoff: 3600 } } },
        },
      },
    },
  },

  tpl_synthwave_drive: {
    id: 'tpl_synthwave_drive',
    category: 'Synthwave & 80s',
    name: '10. Midnight Outrun Synthwave',
    description: 'Treibender 108-BPM-80er-Groove mit rollendem Achtel-Bass, breitem Stereo-Chorus und schimmernder Lead-Sequenz.',
    state: {
      version: 2,
      master: 0.85,
      modules: [
        { id: 'clk1', type: 'master_clock', enabled: true, pos: { x: 60, y: 60 }, values: { tempo: 108, swing: 0, running: 1 } },
        { id: 'div1', type: 'clock_divider', enabled: true, pos: { x: 280, y: 60 }, values: {} },
        { id: 'euc_s', type: 'euclidean', enabled: true, pos: { x: 500, y: 60 }, values: { steps: 8, pulses: 1, rotation: 4 } },
        { id: 'chord_glide', type: 'chord_glide', enabled: true, pos: { x: 60, y: 340 }, values: { level: 0.54, glide: 0.12, cutoff: 2100, attack: 0.08, release: 1.6, detune: 11, key: 9, scale: 'minor', progression: 'vi_IV_I_V', voiceLeading: 1, voiceCount: 4, clockDiv: 32 } },
        { id: 'lead_seq', type: 'sequencer', enabled: true, pos: { x: 360, y: 340 }, values: { tempo: 108, level: 0.56, decay: 0.42, cutoff: 2600, reso: 2.4, env: 0.5, chance: 1, glide: 0.04, s1: 0, s2: 7, s3: 4, s4: 7, s5: 9, s6: 7, s7: 4, s8: 2, g1: 1, g2: 1, g3: 1, g4: 1, g5: 1, g6: 1, g7: 1, g8: 1, wave: 'sawtooth', division: 2, key: 9, scale: 'minor', octave: 60 } },
        { id: 'bass', type: 'bass', enabled: true, pos: { x: 660, y: 340 }, values: { level: 0.78, cutoff: 620, reso: 2.6, env: 0.55, decay: 0.28, sub: 0.65 } },
        { id: 'drums', type: 'drum_rack', enabled: true, pos: { x: 940, y: 340 }, values: { level: 0.84, kDecay: 0.36, sSnap: 0.82, hDecay: 0.07, pTune: 400 } },
        { id: 'chorus', type: 'chorus', enabled: true, pos: { x: 60, y: 640 }, values: { rate: 0.45, depth: 0.55, delay: 0.016, mix: 0.48 } },
        { id: 'delay', type: 'delay', enabled: true, pos: { x: 340, y: 640 }, values: { time: 0.278, feedback: 0.36, tone: 2800, mod: 0.18, mix: 0.28, mode: 'pingpong' } },
        { id: 'reverb', type: 'reverb', enabled: true, pos: { x: 620, y: 640 }, values: { decay: 3.8, damp: 0.58, predelay: 0.02, tone: 3100, mix: 0.32 } },
      ],
      cables: [
        { from: 'clk1:clockOut', to: 'div1:clockIn' },
        { from: 'clk1:clockOut', to: 'chord_glide:clockIn' },
        { from: 'clk1:clockOut', to: 'lead_seq:clockIn' },
        { from: 'div1:div4Out', to: 'drums:trigKick' },
        { from: 'clk1:clockOut', to: 'euc_s:clockIn' },
        { from: 'euc_s:trigOut', to: 'drums:trigSnare' },
        { from: 'div1:div2Out', to: 'drums:trigHat' },
        { from: 'chord_glide:rootOut', to: 'bass:pitchIn' },
        { from: 'div1:div2Out', to: 'bass:gateIn' },
      ],
      snapshots: {
        activeSlot: 1,
        currentSpeed: 2,
        slots: {
          1: { name: 'Neon Intro', values: { drums: { level: 0 }, lead_seq: { cutoff: 1400 }, bass: { cutoff: 420 } } },
          2: { name: 'Highway Drive', values: { drums: { level: 0.84 }, lead_seq: { cutoff: 2800 }, bass: { cutoff: 680 } } },
          3: { name: 'Turbo Overdrive', values: { drums: { level: 0.9 }, lead_seq: { cutoff: 4200, level: 0.68 }, chord_glide: { cutoff: 3000 } } },
        },
      },
    },
  },

  empty: {
    name: 'Leeres Board (Tabula Rasa)',
    category: 'Eigener Aufbau',
    description: 'Völlig freie Arbeitsfläche ohne Module und Kabel zum eigenen Rack-Aufbau von Grund auf.',
    state: { master: 0.8, modules: [], cables: [] },
  },
};