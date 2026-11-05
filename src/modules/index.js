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
  empty: {
    name: "⬚ Leeres Board (Tabula Rasa)",
    category: "Eigener Aufbau",
    description: "Völlig freie Arbeitsfläche ohne Module und Kabel zum eigenen Rack-Aufbau von Grund auf.",
    state: { master: 0.8, modules: [], cables: [] },
  },
};
