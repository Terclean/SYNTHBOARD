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

  empty: {
    name: 'Leeres Board (Tabula Rasa)',
    category: 'Eigener Aufbau',
    description: 'Völlig freie Arbeitsfläche ohne Module und Kabel zum eigenen Rack-Aufbau von Grund auf.',
    state: { master: 0.8, modules: [], cables: [] },
  },
};