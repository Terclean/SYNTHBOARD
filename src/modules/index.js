// Modul-Registry, Rack-Engine & Board-Vorlagen
import { DroneModule, KeysModule, SequencerModule, NoiseModule } from './sources.js';
import { FilterModule, DelayModule, ReverbModule, ChorusModule, TremoloModule, LoFiModule } from './effects.js';

export const MODULES = Object.fromEntries(
  [DroneModule, KeysModule, SequencerModule, NoiseModule,
    FilterModule, ChorusModule, TremoloModule, LoFiModule, DelayModule, ReverbModule].map((M) => [M.type, M])
);

export class RackEngine {
  constructor() {
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC({ latencyHint: 'interactive' });
    this.sources = [];
    this.effects = [];
    this.masterValue = 0.8;
    this.onRecover = null;

    this.sourceBus = this.ctx.createGain();
    this.chainGate = this.ctx.createGain();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.masterValue;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;
    this.chainGate.connect(this.masterGain);
    this.buildLimiter();
    this.rewire(true);

    // Watchdog: falls trotzdem einmal NaN/Infinity entsteht → Graph neu aufbauen statt Stille
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
    if (M.category === 'source') {
      mod.output.connect(this.sourceBus);
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
    if (mod.meta.category === 'source') {
      this.sources = this.sources.filter((m) => m !== mod);
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
    return this.sources.find((m) => m.id === id) || this.effects.find((m) => m.id === id);
  }

  /** Effektkette in aktueller Reihenfolge verbinden – mit kurzem Fade gegen Knackser */
  rewire(immediate = false, after = null) {
    const connect = () => {
      try { this.sourceBus.disconnect(); } catch { /* ignore */ }
      this.effects.forEach((m) => { try { m.output.disconnect(); } catch { /* ignore */ } });
      let node = this.sourceBus;
      for (const fx of this.effects) { node.connect(fx.input); node = fx.output; }
      node.connect(this.chainGate);
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
      version: 1,
      master: this.masterValue,
      modules: [...this.sources, ...this.effects].map((m) => m.getState()),
    };
  }

  clear() {
    [...this.sources, ...this.effects].forEach((m) => m.destroy());
    this.sources = [];
    this.effects = [];
  }

  load(state) {
    this.clear();
    (state?.modules || []).forEach((s) => this.add(s.type, s, -1, true));
    this.rewire(true);
    this.setMaster(state?.master ?? 0.8);
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
      m('sequencer', { tempo: 84, decay: 0.6 }), m('noise', { level: 0.18 }), m('drone', { level: 0.35, tone: 900 }, { voices: [true, false, true, false, false, false] }),
      m('chorus'), m('delay', { mode: 'pingpong', feedback: 0.55, mix: 0.4 }), m('reverb', { decay: 8, mix: 0.5 }),
    ] },
  },
  lofi: {
    name: '📼 Lo-Fi Keys',
    state: { master: 0.85, modules: [
      m('keys', { wave: 'triangle', cutoff: 2200, release: 1.8 }), m('noise', { level: 0.12, motion: 0.1, crackle: 0.6, ftype: 'highpass', tone: 3000 }),
      m('lofi'), m('tremolo', { rate: 2.5, depth: 0.25 }), m('reverb', { decay: 3, mix: 0.35 }),
    ] },
  },
  minimal: {
    name: '🌑 Nur Drone + Hall',
    state: { master: 0.8, modules: [m('drone', { tone: 1200 }), m('reverb', { decay: 10, mix: 0.55 })] },
  },
  empty: { name: '⬚ Leeres Board', state: { master: 0.8, modules: [] } },
};
