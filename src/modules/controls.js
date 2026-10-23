// SYNTHBOARD – Generative Steuerungs- & Rhythmusmodule
import { ModuleBase, scaleNote, SCALES, NOTE_NAMES, midiToFreq, midiToName, createRng, getEuclideanPattern } from './base.js';

const KEYS = [[0, 'C'], [1, 'C#'], [2, 'D'], [3, 'D#'], [4, 'E'], [5, 'F'], [6, 'F#'], [7, 'G'], [8, 'G#'], [9, 'A'], [10, 'B♭'], [11, 'B']];
const SCALE_CHOICES = Object.entries(SCALES).map(([k, s]) => [k, s.name]);
const OCTAVES = [[24, 'Okt 1'], [36, 'Okt 2'], [48, 'Okt 3'], [60, 'Okt 4']];

// ───────────────────────────────────────────── 1. MASTER CLOCK ──
export class MasterClockModule extends ModuleBase {
  static type = 'master_clock';
  static title = 'Master Clock';
  static category = 'control';
  static color = '#06b6d4';
  static icon = '⏱';
  static description = 'Zentrales musikalisches Timing (BPM, Swing & Sync)';
  static params = [
    { id: 'tempo', label: 'Tempo', min: 40, max: 200, value: 88, fmt: 'bpm' },
    { id: 'swing', label: 'Swing', min: 0, max: 0.6, value: 0.12, fmt: 'pct' },
  ];
  static options = [
    { id: 'running', label: 'Transport', choices: [[1, '▶ Läuft'], [0, '■ Pause']], value: 1 },
  ];
  static jacks = [
    { id: 'clockOut', type: 'out', signal: 'clock', label: '1/16' },
    { id: 'div2Out', type: 'out', signal: 'clock', label: '1/8' },
    { id: 'div4Out', type: 'out', signal: 'clock', label: '1/4' },
    { id: 'barOut', type: 'out', signal: 'clock', label: '1 BAR' },
    { id: 'resetOut', type: 'out', signal: 'gate', label: 'RESET' },
  ];

  constructor(ctx, state = {}) {
    super(ctx, state);
    this.tickCount = 0;
    this.nextTickTime = ctx.currentTime + 0.05;
    this.initValues(state);

    this.timer = setInterval(() => this.scheduler(), 25);
  }

  scheduler() {
    if (!this.enabled || Number(this.values.running) === 0) return;
    const now = this.ctx.currentTime;
    if (this.nextTickTime < now - 0.2) this.nextTickTime = now + 0.02;

    const tempo = Math.max(30, this.values.tempo || 90);
    const tickDur = (60 / tempo) / 4; // 1/16-Noten
    const swing = this.values.swing || 0;

    while (this.nextTickTime < now + 0.12) {
      const isOdd = (this.tickCount % 2) === 1;
      const scheduledTime = this.nextTickTime + (isOdd ? swing * tickDur : 0);
      const currentTick = this.tickCount;

      // 1/16 Clock
      this.emitClock('clockOut', scheduledTime, currentTick);

      // 1/8 Clock
      if (currentTick % 2 === 0) {
        this.emitClock('div2Out', scheduledTime, Math.floor(currentTick / 2));
      }

      // 1/4 Clock (Beats)
      if (currentTick % 4 === 0) {
        this.emitClock('div4Out', scheduledTime, Math.floor(currentTick / 4));
      }

      // 1 Bar (16 Ticks)
      if (currentTick % 16 === 0) {
        this.emitClock('barOut', scheduledTime, Math.floor(currentTick / 16));
        this.emitTrigger('resetOut', scheduledTime, 1, 0.05);
      }

      // Visual LED feedback
      const delayMs = Math.max(0, (scheduledTime - now) * 1000);
      setTimeout(() => this.flashLed?.(currentTick % 16), delayMs);

      this.tickCount++;
      this.nextTickTime += tickDur;
    }
  }

  renderExtra(el) {
    el.innerHTML = `
      <div class="clock-display">
        <div class="clock-leds">${Array.from({ length: 16 }).map((_, i) => `<span class="c-led ${i % 4 === 0 ? 'downbeat' : ''}"></span>`).join('')}</div>
        <div class="clock-badge"><span class="txt-bpm">${Math.round(this.values.tempo)}</span> BPM</div>
      </div>`;
    const leds = el.querySelectorAll('.c-led');
    this.flashLed = (idx) => {
      leds.forEach((l, i) => l.classList.toggle('active', i === idx));
    };
  }

  applyParam(id, val) {
    if (id === 'tempo') {
      const b = this.cardEl?.querySelector('.txt-bpm');
      if (b) b.textContent = Math.round(val);
    }
  }

  destroy() {
    clearInterval(this.timer);
    super.destroy();
  }
}

// ───────────────────────────────────────────── 2. CLOCK DIVIDER ──
export class ClockDividerModule extends ModuleBase {
  static type = 'clock_divider';
  static title = 'Clock Divider';
  static category = 'control';
  static color = '#38bdf8';
  static icon = '➗';
  static description = 'Teilt Clock-Impulse für unterschiedlich schnelle Stimmen';
  static params = [];
  static options = [];
  static jacks = [
    { id: 'clockIn', type: 'in', signal: 'clock', label: 'CLOCK' },
    { id: 'resetIn', type: 'in', signal: 'gate', label: 'RESET' },
    { id: 'div2Out', type: 'out', signal: 'clock', label: '/2 (1/8)' },
    { id: 'div3Out', type: 'out', signal: 'clock', label: '/3 (Triol)' },
    { id: 'div4Out', type: 'out', signal: 'clock', label: '/4 (1/4)' },
    { id: 'div8Out', type: 'out', signal: 'clock', label: '/8 (1/2)' },
    { id: 'div16Out', type: 'out', signal: 'clock', label: '/16 (1 Bar)' },
  ];

  constructor(ctx, state = {}) {
    super(ctx, state);
    this.count = 0;
    this.initValues(state);
  }

  onClock(portId, time, _tick) {
    if (portId !== 'clockIn' || !this.enabled) return;
    this.count++;

    if (this.count % 2 === 0) this.emitClock('div2Out', time, Math.floor(this.count / 2));
    if (this.count % 3 === 0) this.emitClock('div3Out', time, Math.floor(this.count / 3));
    if (this.count % 4 === 0) this.emitClock('div4Out', time, Math.floor(this.count / 4));
    if (this.count % 8 === 0) this.emitClock('div8Out', time, Math.floor(this.count / 8));
    if (this.count % 16 === 0) this.emitClock('div16Out', time, Math.floor(this.count / 16));

    const delayMs = Math.max(0, (time - this.ctx.currentTime) * 1000);
    setTimeout(() => this.pulseUi?.(this.count), delayMs);
  }

  onTrigger(portId, _time) {
    if (portId === 'resetIn') this.count = 0;
  }

  renderExtra(el) {
    el.innerHTML = `
      <div class="divider-meters">
        <div class="div-cell"><span class="d-label">/2</span><span class="d-led led-2"></span></div>
        <div class="div-cell"><span class="d-label">/3</span><span class="d-led led-3"></span></div>
        <div class="div-cell"><span class="d-label">/4</span><span class="d-led led-4"></span></div>
        <div class="div-cell"><span class="d-label">/8</span><span class="d-led led-8"></span></div>
        <div class="div-cell"><span class="d-label">/16</span><span class="d-led led-16"></span></div>
      </div>`;
    const l2 = el.querySelector('.led-2');
    const l3 = el.querySelector('.led-3');
    const l4 = el.querySelector('.led-4');
    const l8 = el.querySelector('.led-8');
    const l16 = el.querySelector('.led-16');

    this.pulseUi = (c) => {
      if (c % 2 === 0) flash(l2);
      if (c % 3 === 0) flash(l3);
      if (c % 4 === 0) flash(l4);
      if (c % 8 === 0) flash(l8);
      if (c % 16 === 0) flash(l16);
    };

    function flash(node) {
      if (!node) return;
      node.classList.add('flash');
      setTimeout(() => node.classList.remove('flash'), 120);
    }
  }
}

// ───────────────────────────────────────────── 3. EUCLIDEAN RHYTHM ──
export class EuclideanModule extends ModuleBase {
  static type = 'euclidean';
  static title = 'Euclidean Rhythm';
  static category = 'control';
  static color = '#f59e0b';
  static icon = '⭘';
  static description = 'Mathematisch verteilte Rhythmen (z. B. 5 Hits auf 16 Steps)';
  static params = [
    { id: 'steps', label: 'Steps', min: 1, max: 16, value: 16, fmt: 'int' },
    { id: 'pulses', label: 'Hits', min: 0, max: 16, value: 5, fmt: 'int' },
    { id: 'rotation', label: 'Rotate', min: 0, max: 15, value: 0, fmt: 'int' },
  ];
  static options = [];
  static jacks = [
    { id: 'clockIn', type: 'in', signal: 'clock', label: 'CLOCK' },
    { id: 'resetIn', type: 'in', signal: 'gate', label: 'RESET' },
    { id: 'trigOut', type: 'out', signal: 'gate', label: 'TRIG' },
    { id: 'invOut', type: 'out', signal: 'gate', label: 'OFF-BEAT' },
  ];

  constructor(ctx, state = {}) {
    super(ctx, state);
    this.currentStep = 0;
    this.pattern = [];
    this.initValues(state);
    this.recalc();
  }

  recalc() {
    const s = Math.round(this.values.steps || 16);
    const p = Math.min(s, Math.round(this.values.pulses || 5));
    const r = Math.round(this.values.rotation || 0);
    this.pattern = getEuclideanPattern(s, p, r);
    this.updateCircle?.();
  }

  applyParam() {
    this.recalc();
  }

  onClock(portId, time, _tick) {
    if (portId !== 'clockIn' || !this.enabled || !this.pattern.length) return;
    const isHit = !!this.pattern[this.currentStep % this.pattern.length];
    const stepIdx = this.currentStep;

    if (isHit) {
      this.emitTrigger('trigOut', time, 1, 0.08);
    } else {
      this.emitTrigger('invOut', time, 1, 0.08);
    }

    const delayMs = Math.max(0, (time - this.ctx.currentTime) * 1000);
    setTimeout(() => this.stepUi?.(stepIdx % this.pattern.length, isHit), delayMs);

    this.currentStep = (this.currentStep + 1) % this.pattern.length;
  }

  onTrigger(portId) {
    if (portId === 'resetIn') this.currentStep = 0;
  }

  renderExtra(el) {
    el.innerHTML = `
      <div class="euclid-wrap">
        <canvas class="euclid-canvas" width="160" height="90"></canvas>
        <div class="euclid-stats"><span class="txt-ratio">5/16</span></div>
      </div>`;

    const canvas = el.querySelector('.euclid-canvas');
    const ctx = canvas.getContext('2d');
    const ratioEl = el.querySelector('.txt-ratio');

    const draw = (activeIdx = -1, isHit = false) => {
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      const radius = Math.min(cx, cy) - 10;
      const total = this.pattern.length;
      if (!total) return;

      ratioEl.textContent = `${this.pattern.filter(Boolean).length}/${total} hits`;

      for (let i = 0; i < total; i++) {
        const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;
        const hit = this.pattern[i];
        const current = i === activeIdx;

        ctx.beginPath();
        ctx.arc(x, y, current ? 6 : hit ? 4.5 : 2.5, 0, Math.PI * 2);
        if (current) {
          ctx.fillStyle = isHit ? '#f59e0b' : '#6b7280';
          ctx.shadowColor = isHit ? '#f59e0b' : 'transparent';
          ctx.shadowBlur = isHit ? 10 : 0;
        } else {
          ctx.fillStyle = hit ? '#fbbf24' : 'rgba(255,255,255,0.2)';
          ctx.shadowBlur = 0;
        }
        ctx.fill();
      }
    };

    this.updateCircle = () => draw();
    this.stepUi = (idx, hit) => draw(idx, hit);
    draw();
  }
}

// ───────────────────────────────────────────── 4. PROBABILITY GATE ──
export class ProbabilityGateModule extends ModuleBase {
  static type = 'prob_gate';
  static title = 'Probability Gate';
  static category = 'control';
  static color = '#ec4899';
  static icon = '🎲';
  static description = 'Lässt Schläge mit einstellbarer Wahrscheinlichkeit durch';
  static params = [
    { id: 'chance', label: 'Chance', min: 0, max: 1, value: 0.75, fmt: 'pct' },
    { id: 'burst', label: 'Burst', min: 1, max: 3, value: 1, fmt: 'int' },
  ];
  static options = [];
  static jacks = [
    { id: 'trigIn', type: 'in', signal: 'gate', label: 'TRIG IN' },
    { id: 'trigOut', type: 'out', signal: 'gate', label: 'PASSED' },
    { id: 'altOut', type: 'out', signal: 'gate', label: 'DROPPED' },
  ];

  constructor(ctx, state = {}) {
    super(ctx, state);
    this.initValues(state);
  }

  onTrigger(portId, time, velocity, duration) {
    if (portId !== 'trigIn' || !this.enabled) return;
    const passed = Math.random() <= this.values.chance;
    const burstCount = Math.round(this.values.burst || 1);

    if (passed) {
      for (let b = 0; b < burstCount; b++) {
        const t = time + b * 0.06;
        this.emitTrigger('trigOut', t, velocity, duration);
      }
    } else {
      this.emitTrigger('altOut', time, velocity * 0.6, duration);
    }

    const delayMs = Math.max(0, (time - this.ctx.currentTime) * 1000);
    setTimeout(() => this.flashUi?.(passed), delayMs);
  }

  renderExtra(el) {
    el.innerHTML = `
      <div class="prob-display">
        <div class="prob-dot pass">✓ PASS</div>
        <div class="prob-dot drop">✕ DROP</div>
      </div>`;
    const passDot = el.querySelector('.prob-dot.pass');
    const dropDot = el.querySelector('.prob-dot.drop');

    this.flashUi = (passed) => {
      const node = passed ? passDot : dropDot;
      node.classList.add('flash');
      setTimeout(() => node.classList.remove('flash'), 140);
    };
  }
}

// ───────────────────────────────────────────── 5. RANDOM WALK ──
export class RandomWalkModule extends ModuleBase {
  static type = 'random_walk';
  static title = 'Random Walk';
  static category = 'control';
  static color = '#8b5cf6';
  static icon = '〰';
  static description = 'Generative Melodieführung (Schrittweite, Loop-Gedächtnis & Mutation)';
  static params = [
    { id: 'stepSize', label: 'Schritt', min: 1, max: 4, value: 2, fmt: 'int' },
    { id: 'range', label: 'Umfang', min: 1, max: 3, value: 2, fmt: 'int' },
    { id: 'repeat', label: 'Loop', min: 0, max: 16, value: 8, fmt: 'int' },
    { id: 'mutation', label: 'Mutation', min: 0, max: 1, value: 0.25, fmt: 'pct' },
    { id: 'seed', label: 'Seed', min: 1, max: 9999, value: 42, fmt: 'int' },
  ];
  static options = [
    { id: 'key', label: 'Tonart', choices: KEYS, value: 9 }, // A
    { id: 'scale', label: 'Skala', choices: SCALE_CHOICES, value: 'dorian' },
    { id: 'octave', label: 'Oktave', choices: OCTAVES, value: 48 },
  ];
  static jacks = [
    { id: 'clockIn', type: 'in', signal: 'clock', label: 'CLOCK' },
    { id: 'resetIn', type: 'in', signal: 'gate', label: 'RESET' },
    { id: 'pitchOut', type: 'out', signal: 'pitch', label: 'PITCH' },
    { id: 'gateOut', type: 'out', signal: 'gate', label: 'GATE' },
  ];

  constructor(ctx, state = {}) {
    super(ctx, state);
    this.currentDegree = 0;
    this.history = [];
    this.loopBuffer = [];
    this.loopIndex = 0;
    this.initValues(state);
    this.resetRng();
  }

  resetRng() {
    this.rng = createRng(Number(this.values.seed || 42));
    this.currentDegree = 0;
    this.loopBuffer = [];
    this.loopIndex = 0;
  }

  applyParam(id) {
    if (id === 'seed') this.resetRng();
  }

  onClock(portId, time, _tick) {
    if (portId !== 'clockIn' || !this.enabled) return;
    this.step(time);
  }

  onTrigger(portId, time) {
    if (portId === 'resetIn') {
      this.currentDegree = 0;
      this.loopIndex = 0;
    } else if (portId === 'clockIn') {
      this.step(time);
    }
  }

  step(time) {
    const loopLen = Math.round(this.values.repeat || 0);
    const maxDeg = Math.round(this.values.range || 2) * 5;
    const stepSize = Math.max(1, Math.round(this.values.stepSize || 2));
    const mutation = this.values.mutation || 0;

    let deg = this.currentDegree;

    if (loopLen > 0 && this.loopBuffer.length >= loopLen) {
      deg = this.loopBuffer[this.loopIndex % loopLen];
      // Gelegentliche Mutation
      if (this.rng() < mutation) {
        const delta = Math.floor(this.rng() * (stepSize * 2 + 1)) - stepSize;
        deg = Math.max(0, Math.min(maxDeg, deg + delta));
        this.loopBuffer[this.loopIndex % loopLen] = deg;
      }
      this.loopIndex++;
    } else {
      // Neuer Schritt im Random Walk
      const delta = Math.floor(this.rng() * (stepSize * 2 + 1)) - stepSize;
      deg = Math.max(0, Math.min(maxDeg, deg + delta));
      if (loopLen > 0) this.loopBuffer.push(deg);
    }

    this.currentDegree = deg;
    const root = Number(this.values.octave) + Number(this.values.key);
    const midi = scaleNote(root, this.values.scale, deg);

    this.emitPitch('pitchOut', time, midi, 0.9, 0.25);
    this.emitTrigger('gateOut', time, 0.9, 0.25);

    const delayMs = Math.max(0, (time - this.ctx.currentTime) * 1000);
    setTimeout(() => this.showStepUi?.(midi, deg), delayMs);
  }

  renderExtra(el) {
    el.innerHTML = `
      <div class="walk-wrap">
        <div class="walk-note">-</div>
        <div class="walk-trail">${Array.from({ length: 8 }).map(() => '<span class="w-bar"></span>').join('')}</div>
      </div>`;
    const noteEl = el.querySelector('.walk-note');
    const bars = el.querySelectorAll('.w-bar');
    const recent = [];

    this.showStepUi = (midi, deg) => {
      noteEl.textContent = `${midiToName(midi)} (${Math.round(midiToFreq(midi))} Hz)`;
      recent.unshift(deg);
      if (recent.length > 8) recent.pop();
      bars.forEach((b, i) => {
        const val = recent[i] ?? 0;
        b.style.height = `${Math.min(100, Math.max(15, val * 10 + 20))}%`;
        b.classList.toggle('active', i === 0);
      });
    };
  }
}

// ───────────────────────────────────────────── 6. SCALE QUANTIZER ──
export class ScaleQuantizerModule extends ModuleBase {
  static type = 'quantizer';
  static title = 'Scale Quantizer';
  static category = 'control';
  static color = '#c084fc';
  static icon = '♯';
  static description = 'Quantisiert Noten und CVs harmonisch auf Grundton & Skala';
  static params = [
    { id: 'transpose', label: 'Transp.', min: -12, max: 12, value: 0, fmt: 'int' },
  ];
  static options = [
    { id: 'key', label: 'Grundton', choices: KEYS, value: 9 }, // A
    { id: 'scale', label: 'Skala', choices: SCALE_CHOICES, value: 'dorian' },
  ];
  static jacks = [
    { id: 'pitchIn', type: 'in', signal: 'pitch', label: 'PITCH IN' },
    { id: 'trigIn', type: 'in', signal: 'gate', label: 'SAMPLE' },
    { id: 'pitchOut', type: 'out', signal: 'pitch', label: 'QUANT OUT' },
    { id: 'gateOut', type: 'out', signal: 'gate', label: 'GATE' },
  ];

  constructor(ctx, state = {}) {
    super(ctx, state);
    this.lastMidi = 60;
    this.initValues(state);
  }

  quantize(rawMidi) {
    const root = Number(this.values.key || 0);
    const steps = (SCALES[this.values.scale] || SCALES.dorian).steps;
    const transp = Number(this.values.transpose || 0);
    const midi = rawMidi + transp;

    const baseOct = Math.floor((midi - root) / 12) * 12 + root;
    const semi = ((midi - root) % 12 + 12) % 12;

    // Finde nächsten Skalenschritt
    let closestStep = steps[0];
    let minDist = 999;
    for (const s of steps) {
      const d = Math.abs(s - semi);
      if (d < minDist) { minDist = d; closestStep = s; }
    }
    return baseOct + closestStep;
  }

  onPitch(portId, time, midiNote, velocity, duration) {
    if (portId !== 'pitchIn' || !this.enabled) return;
    const quant = this.quantize(midiNote);
    this.lastMidi = quant;
    this.emitPitch('pitchOut', time, quant, velocity, duration);
    this.emitTrigger('gateOut', time, velocity, duration);

    const delayMs = Math.max(0, (time - this.ctx.currentTime) * 1000);
    setTimeout(() => this.showUi?.(quant), delayMs);
  }

  onTrigger(portId, time, velocity, duration) {
    if (portId === 'trigIn' && this.enabled) {
      this.emitPitch('pitchOut', time, this.lastMidi, velocity, duration);
      this.emitTrigger('gateOut', time, velocity, duration);
    }
  }

  renderExtra(el) {
    el.innerHTML = `<div class="quant-note"><span class="q-txt">A3</span><small>Harmonisch</small></div>`;
    const txt = el.querySelector('.q-txt');
    this.showUi = (m) => { txt.textContent = midiToName(m); };
  }
}

// ───────────────────────────────────────────── 7. SLOW RANDOM (LFO / S&H) ──
export class SlowRandomModule extends ModuleBase {
  static type = 'slow_random';
  static title = 'Slow Random';
  static category = 'control';
  static color = '#10b981';
  static icon = '≋';
  static description = 'Sanft fließende Modulationsspannung (CV) für Filter & Klänge';
  static params = [
    { id: 'rate', label: 'Rate', min: 0.02, max: 2.5, value: 0.15, log: true, fmt: 'hz' },
    { id: 'smooth', label: 'Glättung', min: 0.05, max: 3.0, value: 0.8, fmt: 's' },
    { id: 'depth', label: 'Tiefe', min: 0, max: 1, value: 0.75, fmt: 'pct' },
  ];
  static options = [
    { id: 'mode', label: 'Kurve', choices: [['smooth', 'Gleitend'], ['stepped', 'Stufig (S&H)']], value: 'smooth' },
  ];
  static jacks = [
    { id: 'trigIn', type: 'in', signal: 'gate', label: 'S&H CLOCK' },
    { id: 'cvOut', type: 'out', signal: 'mod', label: 'CV OUT' },
    { id: 'invOut', type: 'out', signal: 'mod', label: 'INV CV' },
  ];

  constructor(ctx, state = {}) {
    super(ctx, state);
    this.val = 0.5;
    this.target = 0.5;
    this.initValues(state);

    this.timer = setInterval(() => this.tick(), 40);
  }

  tick() {
    if (!this.enabled) return;
    const now = this.ctx.currentTime;
    const rate = this.values.rate || 0.15;
    const smooth = this.values.smooth || 0.8;
    const depth = this.values.depth || 0.75;
    const isSmooth = this.values.mode === 'smooth';

    // Zielwert gelegentlich neu würfeln
    if (Math.random() < rate * 0.04 * 2) {
      this.target = Math.random();
    }

    if (isSmooth) {
      const alpha = Math.min(1, 0.04 / Math.max(0.05, smooth));
      this.val += (this.target - this.val) * alpha;
    } else {
      this.val = this.target;
    }

    const cv = 0.5 + (this.val - 0.5) * depth;
    this.emitMod('cvOut', cv, now);
    this.emitMod('invOut', 1 - cv, now);
    this.meterUi?.(cv);
  }

  onTrigger(portId, time) {
    if (portId === 'trigIn' && this.enabled) {
      this.target = Math.random();
      this.val = this.target;
      const cv = 0.5 + (this.val - 0.5) * (this.values.depth || 0.75);
      this.emitMod('cvOut', cv, time);
      this.meterUi?.(cv);
    }
  }

  renderExtra(el) {
    el.innerHTML = `
      <div class="mod-meter-wrap">
        <div class="mod-meter-bar"><div class="mod-meter-fill"></div></div>
      </div>`;
    const fill = el.querySelector('.mod-meter-fill');
    this.meterUi = (cv) => {
      if (fill) fill.style.width = `${Math.min(100, Math.max(0, cv * 100))}%`;
    };
  }

  destroy() {
    clearInterval(this.timer);
    super.destroy();
  }
}

// ───────────────────────────────────────────── 8. MACRO CONTROLLER ──
export class MacroControllerModule extends ModuleBase {
  static type = 'macro';
  static title = 'Macro & Szene';
  static category = 'control';
  static color = '#f97316';
  static icon = '🎛';
  static description = 'Zentraler Szenen- & Generativ-Direktor (Dichte, Variation, Bewegung, Seed)';
  static params = [
    { id: 'density', label: 'Dichte', min: 0, max: 1, value: 0.65, fmt: 'pct' },
    { id: 'variation', label: 'Variation', min: 0, max: 1, value: 0.4, fmt: 'pct' },
    { id: 'motion', label: 'Bewegung', min: 0, max: 1, value: 0.55, fmt: 'pct' },
    { id: 'seed', label: 'Seed', min: 1, max: 9999, value: 42, fmt: 'int' },
  ];
  static options = [];
  static jacks = [
    { id: 'densityCv', type: 'out', signal: 'mod', label: 'DICHTE CV' },
    { id: 'variationCv', type: 'out', signal: 'mod', label: 'VARIATION CV' },
    { id: 'motionCv', type: 'out', signal: 'mod', label: 'BEWEGUNG CV' },
  ];

  constructor(ctx, state = {}) {
    super(ctx, state);
    this.initValues(state);
    this.interval = setInterval(() => this.broadcast(), 60);
  }

  broadcast() {
    if (!this.enabled) return;
    const now = this.ctx.currentTime;
    this.emitMod('densityCv', this.values.density, now);
    this.emitMod('variationCv', this.values.variation, now);
    this.emitMod('motionCv', this.values.motion, now);
  }

  applyParam(id, val) {
    if (id === 'seed' && this.updateSeedDisplay) this.updateSeedDisplay(val);
  }

  renderExtra(el, { changed }) {
    el.innerHTML = `
      <div class="macro-row">
        <div class="macro-seed-box">
          <span class="seed-lbl">SEEDS:</span>
          <span class="seed-val">${Math.round(this.values.seed)}</span>
          <button class="mini-btn btn-seed" title="Neuen Zufalls-Seed generieren">🎲 Würfeln</button>
        </div>
      </div>`;
    const seedVal = el.querySelector('.seed-val');
    this.updateSeedDisplay = (s) => { if (seedVal) seedVal.textContent = Math.round(s); };

    el.querySelector('.btn-seed').addEventListener('click', () => {
      const newSeed = Math.floor(Math.random() * 8999) + 1000;
      this.setParam('seed', newSeed);
      this.updateSeedDisplay(newSeed);
      changed();
    });
  }

  destroy() {
    clearInterval(this.interval);
    super.destroy();
  }
}

// ───────────────────────────────────────────── 9. SLOPE GENERATOR (AMBIENT ENVELOPE) ──
export class SlopeGeneratorModule extends ModuleBase {
  static type = 'slope_generator';
  static title = 'Slope Generator';
  static category = 'control';
  static color = '#eab308';
  static icon = '⋀';
  static description = 'Flexible Ambient-Hüllkurve & Funktionsgenerator (0.05s–60s)';
  static params = [
    { id: 'rise', label: 'Rise (Att)', min: 0.05, max: 60, value: 4.0, log: true, fmt: 's' },
    { id: 'fall', label: 'Fall (Dec)', min: 0.05, max: 60, value: 8.0, log: true, fmt: 's' },
    { id: 'curve', label: 'Kurve', min: 0, max: 1, value: 0.6, fmt: 'pct' },
    { id: 'scale', label: 'Scale', min: -1, max: 1, value: 1.0, fmt: 'pct' },
    { id: 'offset', label: 'Offset', min: -1, max: 1, value: 0, fmt: 'num' },
  ];
  static options = [
    { id: 'mode', label: 'Modus', choices: [['loop', '🔄 Zyklisch (LFO)'], ['trig', '⚡ Trigger AD'], ['gate', '🚪 Gate ASR']], value: 'loop' },
  ];
  static jacks = [
    { id: 'trigIn', type: 'in', signal: 'gate', label: 'TRIG IN' },
    { id: 'gateIn', type: 'in', signal: 'gate', label: 'GATE IN' },
    { id: 'modRise', type: 'in', signal: 'mod', label: 'RISE CV' },
    { id: 'modFall', type: 'in', signal: 'mod', label: 'FALL CV' },
    { id: 'envOut', type: 'out', signal: 'mod', label: 'ENV OUT' },
    { id: 'invOut', type: 'out', signal: 'mod', label: 'INV OUT' },
    { id: 'eocOut', type: 'out', signal: 'gate', label: 'EOC OUT' },
  ];

  constructor(ctx, state = {}) {
    super(ctx, state);
    this.stage = 'idle';
    this.currentVal = 0;
    this.startVal = 0;
    this.stageProgress = 0;
    this.stageStartTime = ctx.currentTime;
    this.gateHeld = false;
    this.cvRiseMod = 1.0;
    this.cvFallMod = 1.0;
    this.initValues(state);

    if (this.values.mode === 'loop') {
      this.triggerRise(ctx.currentTime);
    }

    this.timer = setInterval(() => this.tick(), 25);
  }

  triggerRise(time = null) {
    this.stage = 'rise';
    this.stageStartTime = time || this.ctx.currentTime;
    this.startVal = this.currentVal;
  }

  triggerFall(time = null) {
    this.stage = 'fall';
    this.stageStartTime = time || this.ctx.currentTime;
    this.startVal = this.currentVal;
  }

  onTrigger(portId, time, _velocity = 1, duration = 0.1) {
    if (portId === 'trigIn' && this.enabled) {
      this.triggerRise(time);
    } else if (portId === 'gateIn' && this.enabled) {
      this.gateHeld = true;
      this.triggerRise(time);
      if (duration) {
        setTimeout(() => {
          this.gateHeld = false;
          if (this.stage === 'sustain') this.triggerFall();
        }, duration * 1000);
      }
    }
  }

  onModulation(portId, value) {
    if (portId === 'modRise') {
      this.cvRiseMod = Math.max(0.1, value * 2);
    } else if (portId === 'modFall') {
      this.cvFallMod = Math.max(0.1, value * 2);
    }
  }

  tick() {
    if (!this.enabled) return;
    const now = this.ctx.currentTime;
    const riseTime = Math.max(0.02, (this.values.rise || 4) * this.cvRiseMod);
    const fallTime = Math.max(0.02, (this.values.fall || 8) * this.cvFallMod);
    const curveExp = (this.values.curve || 0.6) * 1.5 + 1;

    if (this.stage === 'rise') {
      const elapsed = now - this.stageStartTime;
      const linearP = Math.min(1, elapsed / riseTime);
      this.stageProgress = Math.pow(linearP, 1 / curveExp);
      this.currentVal = this.startVal + (1.0 - this.startVal) * this.stageProgress;

      if (linearP >= 1) {
        this.currentVal = 1.0;
        if (this.values.mode === 'gate' && this.gateHeld) {
          this.stage = 'sustain';
        } else {
          this.triggerFall(now);
        }
      }
    } else if (this.stage === 'fall') {
      const elapsed = now - this.stageStartTime;
      const linearP = Math.min(1, elapsed / fallTime);
      this.stageProgress = Math.pow(linearP, curveExp);
      this.currentVal = Math.max(0, this.startVal * (1.0 - this.stageProgress));

      if (linearP >= 1) {
        this.currentVal = 0;
        this.stage = 'idle';
        this.emitTrigger('eocOut', now, 1.0, 0.05);

        if (this.values.mode === 'loop') {
          this.triggerRise(now);
        }
      }
    } else if (this.stage === 'idle' && this.values.mode === 'loop') {
      this.triggerRise(now);
    }

    const scale = this.values.scale ?? 1.0;
    const offset = this.values.offset ?? 0.0;
    const scaledVal = Math.max(-1, Math.min(1, this.currentVal * scale + offset));
    const invVal = Math.max(-1, Math.min(1, (1.0 - this.currentVal) * scale + offset));

    this.emitMod('envOut', Math.max(0, scaledVal), now);
    this.emitMod('invOut', Math.max(0, invVal), now);
    this.updateDisplay?.(this.currentVal, this.stage);
  }

  applyParam(id, val) {
    if (id === 'mode' && val === 'loop' && this.stage === 'idle') {
      this.triggerRise();
    }
  }

  renderExtra(el) {
    el.innerHTML = `
      <div class="slope-meter-wrap">
        <div class="slope-bar">
          <div class="slope-fill"></div>
        </div>
        <div class="slope-info">
          <span class="slope-stage">IDLE</span>
          <span class="slope-val">0%</span>
        </div>
      </div>`;
    const fill = el.querySelector('.slope-fill');
    const stageEl = el.querySelector('.slope-stage');
    const valEl = el.querySelector('.slope-val');

    this.updateDisplay = (v, st) => {
      if (fill) fill.style.width = `${Math.round(v * 100)}%`;
      if (stageEl) {
        stageEl.textContent = st.toUpperCase();
        stageEl.className = `slope-stage is-${st}`;
      }
      if (valEl) valEl.textContent = `${Math.round(v * 100)}%`;
    };
  }

  destroy() {
    clearInterval(this.timer);
    super.destroy();
  }
}

// ───────────────────────────────────────────── 10. ATTENUVERTER & OFFSET ──
export class AttenuverterModule extends ModuleBase {
  static type = 'attenuverter';
  static title = 'Attenuverter & Offset';
  static category = 'control';
  static color = '#a855f7';
  static icon = '⧉';
  static description = 'Dämpfen, Invertieren (-100%..+100%) & CV-Offset/Mischer';
  static params = [
    { id: 'scaleA', label: 'Skala A', min: -1, max: 1, value: 1.0, fmt: 'pct' },
    { id: 'offsetA', label: 'Offset A', min: -1, max: 1, value: 0, fmt: 'num' },
    { id: 'scaleB', label: 'Skala B', min: -1, max: 1, value: -1.0, fmt: 'pct' },
    { id: 'offsetB', label: 'Offset B', min: -1, max: 1, value: 0, fmt: 'num' },
  ];
  static options = [];
  static jacks = [
    { id: 'inA', type: 'in', signal: 'mod', label: 'IN A' },
    { id: 'outA', type: 'out', signal: 'mod', label: 'OUT A' },
    { id: 'inB', type: 'in', signal: 'mod', label: 'IN B' },
    { id: 'outB', type: 'out', signal: 'mod', label: 'OUT B' },
    { id: 'sumOut', type: 'out', signal: 'mod', label: 'SUM OUT' },
  ];

  constructor(ctx, state = {}) {
    super(ctx, state);
    this.inAVal = 0.5;
    this.inBVal = 0.5;
    this.initValues(state);
    this.timer = setInterval(() => this.process(), 30);
  }

  onModulation(portId, value) {
    if (portId === 'inA') {
      this.inAVal = value;
    } else if (portId === 'inB') {
      this.inBVal = value;
    }
  }

  process() {
    if (!this.enabled) return;
    const now = this.ctx.currentTime;
    const inAPatched = this.patchSystem?.hasIncoming(this.id, 'inA');
    const inBPatched = this.patchSystem?.hasIncoming(this.id, 'inB');

    const valA = inAPatched ? this.inAVal : 1.0;
    const valB = inBPatched ? this.inBVal : 1.0;

    const outA = Math.max(0, Math.min(1, valA * this.values.scaleA + this.values.offsetA));
    const outB = Math.max(0, Math.min(1, valB * this.values.scaleB + this.values.offsetB));
    const sum = Math.max(0, Math.min(1, (outA + outB) * 0.5));

    this.emitMod('outA', outA, now);
    this.emitMod('outB', outB, now);
    this.emitMod('sumOut', sum, now);
  }

  destroy() {
    clearInterval(this.timer);
    super.destroy();
  }
}

