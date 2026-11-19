// SYNTHBOARD – Generative Steuerungs- & Rhythmusmodule
import { ModuleBase, scaleNote, SCALES, NOTE_NAMES, midiToFreq, midiToName, createRng, getEuclideanPattern } from './base.js';

const KEYS = [[0, 'C'], [1, 'C#'], [2, 'D'], [3, 'D#'], [4, 'E'], [5, 'F'], [6, 'F#'], [7, 'G'], [8, 'G#'], [9, 'A'], [10, 'B♭'], [11, 'B']];
const SCALE_CHOICES = Object.entries(SCALES).map(([k, s]) => [k, s.name]);
const OCTAVES = [[24, 'Okt 1'], [36, 'Okt 2'], [48, 'Okt 3'], [60, 'Okt 4'], [72, 'Okt 5']];

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
    if (!this.enabled || Number(this.values.running) === 0 || (this.ctx.state && this.ctx.state !== 'running')) return;
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
    if (id === 'running') {
      const on = Number(val) === 1;
      // Neustart nach Pause: Takt-Zähler auf Stückanfang (Takt 0) zurücksetzen,
      // damit Song-Abläufe (z. B. snapshot_ctrl) wieder bei Slot 1 beginnen.
      if (on && this._wasRunning === false) {
        this.tickCount = 0;
        this.nextTickTime = this.ctx.currentTime + 0.05;
      }
      this._wasRunning = on;
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
      if (document.hidden || this._isOffscreen || this.engine?.renderLod === 'low') return;
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

  destroy() {
    clearInterval(this.slewTimer);
    super.destroy();
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
    { id: 'glide', label: 'Glide', min: 0, max: 3, value: 0, log: true, fmt: 's' },
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
    this.lastMidi = null;
    this.slewTimer = null;
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

    const glide = Math.max(0, Number(this.values.glide || 0));
    if (glide <= 0.005 || this.lastMidi === null || Math.abs(midi - this.lastMidi) < 0.01) {
      this.lastMidi = midi;
      this.emitPitch('pitchOut', time, midi, 0.9, 0.25);
    } else {
      const startMidi = this.lastMidi;
      const stepsCount = Math.max(2, Math.min(48, Math.round(glide / 0.025)));
      clearInterval(this.slewTimer);
      let sIdx = 0;
      this.slewTimer = setInterval(() => {
        sIdx++;
        const p = Math.min(1, sIdx / stepsCount);
        const cur = startMidi + (midi - startMidi) * p;
        this.lastMidi = cur;
        this.emitPitch('pitchOut', this.ctx.currentTime, cur, 0.9, 0.25);
        if (p >= 1) clearInterval(this.slewTimer);
      }, Math.max(15, (glide * 1000) / stepsCount));
      this.emitPitch('pitchOut', time, startMidi, 0.9, 0.25);
    }
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

  destroy() {
    clearInterval(this.slewTimer);
    super.destroy();
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
    const quant = Array.isArray(midiNote) ? midiNote.map((m) => this.quantize(m)) : this.quantize(midiNote);
    this.lastMidi = Array.isArray(quant) ? quant[0] : quant;
    this.emitPitch('pitchOut', time, quant, velocity, duration);
    this.emitTrigger('gateOut', time, velocity, duration);

    const delayMs = Math.max(0, (time - this.ctx.currentTime) * 1000);
    setTimeout(() => this.showUi?.(this.lastMidi), delayMs);
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
    if (!this.enabled || (this.ctx.state && this.ctx.state !== 'running')) return;
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
    if (!this.enabled || (this.ctx.state && this.ctx.state !== 'running')) return;
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
    { id: 'rise', label: 'Rise (Att)', min: 0.01, max: 180, value: 4.0, log: true, fmt: 's' },
    { id: 'fall', label: 'Fall (Dec)', min: 0.01, max: 180, value: 8.0, log: true, fmt: 's' },
    { id: 'curve', label: 'Kurve', min: 0, max: 1, value: 0.6, fmt: 'pct' },
    { id: 'scale', label: 'Scale', min: -1, max: 1, value: 1.0, fmt: 'pct' },
    { id: 'offset', label: 'Offset', min: -1, max: 1, value: 0, fmt: 'num' },
    { id: 'sustainHold', label: 'Peak Hold', min: 0, max: 1, value: 0, fmt: 'int' },
  ];
  static options = [
    { id: 'mode', label: 'Modus', choices: [['loop', '🔄 Zyklisch (LFO)'], ['trig', '⚡ Trigger AD'], ['gate', '🚪 Gate ASR'], ['oneshot', '🚀 One-Shot Auto']], value: 'loop' },
  ];
  static jacks = [
    { id: 'trigIn', type: 'in', signal: 'gate', label: 'TRIG IN' },
    { id: 'gateIn', type: 'in', signal: 'gate', label: 'GATE IN' },
    { id: 'modRise', type: 'in', signal: 'mod', label: 'RISE CV' },
    { id: 'modFall', type: 'in', signal: 'mod', label: 'FALL CV' },
    { id: 'envOut', type: 'out', signal: 'mod', label: 'ENV OUT' },
    { id: 'invOut', type: 'out', signal: 'mod', label: 'INV OUT' },
    { id: 'eorOut', type: 'out', signal: 'gate', label: 'EOR OUT' },
    { id: 'eofOut', type: 'out', signal: 'gate', label: 'EOF OUT' },
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

    if (this.values.mode === 'loop' || this.values.mode === 'oneshot') {
      this.triggerRise(ctx.currentTime);
    }

    this.timer = setInterval(() => this.tick(), 25);
  }

  static normalizeMode(rawMode, rawLoop) {
    if (rawMode !== undefined && rawMode !== null) {
      const m = String(rawMode).trim().toLowerCase();
      if (m === 'oneshot' || m === 'one-shot' || m === 'one_shot') return 'oneshot';
      if (m === 'trigger' || m === 'trig' || m === 'ad' || m === 'env' || m === 'single') return 'trig';
      if (m === 'loop' || m === 'cycle' || m === 'lfo') return 'loop';
      if (m === 'gate' || m === 'asr' || m === 'hold') return 'gate';
    }
    if (rawLoop !== undefined && rawLoop !== null) {
      return (Number(rawLoop) === 0 || rawLoop === false) ? 'trig' : 'loop';
    }
    return undefined;
  }

  initValues(state = {}) {
    const saved = { ...(state.values || {}) };
    const normMode = SlopeGeneratorModule.normalizeMode(saved.mode, saved.loop);
    if (normMode) saved.mode = normMode;
    super.initValues({ ...state, values: saved });
  }

  setParam(id, value) {
    if (id === 'mode') {
      value = SlopeGeneratorModule.normalizeMode(value) || value;
    } else if (id === 'loop') {
      const normMode = SlopeGeneratorModule.normalizeMode(undefined, value);
      if (normMode) {
        super.setParam('mode', normMode);
        return;
      }
    }
    super.setParam(id, value);
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
    if (!this.enabled || (this.ctx.state && this.ctx.state !== 'running')) return;
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
        this.emitTrigger('eorOut', now, 1.0, 0.05);
        if ((this.values.mode === 'gate' && this.gateHeld) || (this.values.mode === 'oneshot' && Math.round(this.values.sustainHold || 0) >= 1)) {
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
        this.emitTrigger('eofOut', now, 1.0, 0.05);
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
    if (id === 'mode' && (val === 'loop' || val === 'oneshot') && this.stage === 'idle') {
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
    if (!this.enabled || (this.ctx.state && this.ctx.state !== 'running')) return;
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

// ───────────────────────────────────────────── 11. CV LOGIC & SWITCH ──
export class LogicSwitchModule extends ModuleBase {
  static type = 'logic_switch';
  static title = 'CV Logic & Switch';
  static category = 'control';
  static color = '#14b8a6';
  static icon = '⎇';
  static description = 'A/B Gate Router, Flip-Flop Latch & Boolean Gate Combiner';
  static params = [
    { id: 'thresh', label: 'Schwelle', min: 0, max: 1, value: 0.5, fmt: 'pct' },
  ];
  static options = [];
  static jacks = [
    { id: 'gateIn', type: 'in', signal: 'gate', label: 'GATE IN' },
    { id: 'ctrlCv', type: 'in', signal: 'mod', label: 'CTRL CV' },
    { id: 'passOut', type: 'out', signal: 'gate', label: 'PASS A' },
    { id: 'invPassOut', type: 'out', signal: 'gate', label: 'INV B' },

    { id: 'toggleIn', type: 'in', signal: 'gate', label: 'TOGGLE IN' },
    { id: 'resetIn', type: 'in', signal: 'gate', label: 'RESET' },
    { id: 'stateOut', type: 'out', signal: 'mod', label: 'LATCH CV' },

    { id: 'in1', type: 'in', signal: 'gate', label: 'IN 1' },
    { id: 'in2', type: 'in', signal: 'gate', label: 'IN 2' },
    { id: 'andOut', type: 'out', signal: 'gate', label: 'AND OUT' },
    { id: 'orOut', type: 'out', signal: 'gate', label: 'OR OUT' },
  ];

  constructor(ctx, state = {}) {
    super(ctx, state);
    this.currentCv = 0.5;
    this.latchState = 0.0;
    this.gate1ActiveUntil = 0;
    this.gate2ActiveUntil = 0;
    this.lastGate1Time = 0;
    this.lastGate2Time = 0;
    this.initValues(state);

    // Periodischer Latch-Emitter (30ms), damit Zielmodule stabil mit der Latch-Spannung versorgt sind
    this.timer = setInterval(() => {
      if (this.enabled && (!this.ctx.state || this.ctx.state === 'running')) {
        this.emitMod('stateOut', this.latchState, this.ctx.currentTime);
      }
    }, 30);
  }

  onModulation(portId, value, _time) {
    if (portId === 'ctrlCv') {
      this.currentCv = Math.max(0, Math.min(1, value));
      this.updateRouterUi?.(this.currentCv);
    }
  }

  onTrigger(portId, time, velocity = 1, duration = 0.1, meta = null) {
    if (!this.enabled) return;
    const now = time || this.ctx.currentTime;
    const dur = duration || 0.1;

    // 1. A/B Gate Router
    if (portId === 'gateIn') {
      const thresh = this.values.thresh ?? 0.5;
      if (this.currentCv >= thresh) {
        this.emitTrigger('passOut', now, velocity, dur, meta);
        this.flashLed?.('pass');
      } else {
        this.emitTrigger('invPassOut', now, velocity, dur, meta);
        this.flashLed?.('invPass');
      }
    }

    // 2. Flip-Flop / Latch
    else if (portId === 'toggleIn') {
      this.latchState = this.latchState > 0.5 ? 0.0 : 1.0;
      this.emitMod('stateOut', this.latchState, now);
      this.updateLatchUi?.(this.latchState);
    } else if (portId === 'resetIn') {
      this.latchState = 0.0;
      this.emitMod('stateOut', 0.0, now);
      this.updateLatchUi?.(0.0);
    }

    // 3. Gate Combiner (AND / OR)
    else if (portId === 'in1' || portId === 'in2') {
      // OR gibt jeden eingehenden Impuls sofort aus
      this.emitTrigger('orOut', now, velocity, dur, meta);
      this.flashLed?.('or');

      if (portId === 'in1') {
        this.gate1ActiveUntil = now + dur;
        this.lastGate1Time = now;
        if (now < this.gate2ActiveUntil + 0.005 || Math.abs(now - this.lastGate2Time) < 0.02) {
          this.emitTrigger('andOut', now, velocity, dur, meta);
          this.flashLed?.('and');
        }
      } else if (portId === 'in2') {
        this.gate2ActiveUntil = now + dur;
        this.lastGate2Time = now;
        if (now < this.gate1ActiveUntil + 0.005 || Math.abs(now - this.lastGate1Time) < 0.02) {
          this.emitTrigger('andOut', now, velocity, dur, meta);
          this.flashLed?.('and');
        }
      }
    }
  }

  renderExtra(el) {
    el.innerHTML = `
      <div class="logic-switch-display">
        <div class="ls-col">
          <span class="ls-lbl">ROUTER A/B</span>
          <div class="ls-pills">
            <span class="ls-pill pill-a active">PASS A</span>
            <span class="ls-pill pill-b">INV B</span>
          </div>
        </div>
        <div class="ls-col">
          <span class="ls-lbl">LATCH</span>
          <div class="ls-val val-latch">0.0V (LOW)</div>
        </div>
        <div class="ls-col">
          <span class="ls-lbl">COMBINER</span>
          <div class="ls-pills">
            <span class="ls-pill pill-and">&amp; AND</span>
            <span class="ls-pill pill-or">≥1 OR</span>
          </div>
        </div>
      </div>
    `;
    const pillA = el.querySelector('.pill-a');
    const pillB = el.querySelector('.pill-b');
    const valLatch = el.querySelector('.val-latch');
    const pillAnd = el.querySelector('.pill-and');
    const pillOr = el.querySelector('.pill-or');

    this.updateRouterUi = (cv) => {
      const isA = cv >= (this.values.thresh ?? 0.5);
      if (pillA) pillA.classList.toggle('active', isA);
      if (pillB) pillB.classList.toggle('active', !isA);
    };

    this.updateLatchUi = (st) => {
      if (valLatch) {
        valLatch.textContent = st > 0.5 ? '1.0V (HIGH)' : '0.0V (LOW)';
        valLatch.classList.toggle('active', st > 0.5);
      }
    };

    this.flashLed = (type) => {
      const target = type === 'pass' ? pillA : type === 'invPass' ? pillB : type === 'and' ? pillAnd : pillOr;
      if (target) {
        target.classList.add('flash');
        setTimeout(() => target.classList.remove('flash'), 120);
      }
    };

    this.updateRouterUi(this.currentCv);
    this.updateLatchUi(this.latchState);
  }

  destroy() {
    clearInterval(this.timer);
    super.destroy();
  }
}

// ───────────────────────────────────────────── 12. SNAPSHOT CONTROLLER ──
export class SnapshotControllerModule extends ModuleBase {
  static type = 'snapshot_ctrl';
  static title = 'Snapshot Controller';
  static category = 'control';
  static color = '#f97316';
  static icon = '🎛️';
  static description = 'Automatisches Umschalten der 5 Performance-Snapshots per Patchkabel oder Song-Ablaufplan (Takte pro Slot)';
  static params = [
    { id: 'bars1', label: 'Takte S1', min: 0, max: 64, value: 8, fmt: 'int' },
    { id: 'bars2', label: 'Takte S2', min: 0, max: 64, value: 8, fmt: 'int' },
    { id: 'bars3', label: 'Takte S3', min: 0, max: 64, value: 8, fmt: 'int' },
    { id: 'bars4', label: 'Takte S4', min: 0, max: 64, value: 8, fmt: 'int' },
    { id: 'bars5', label: 'Takte S5', min: 0, max: 64, value: 8, fmt: 'int' },
  ];
  static options = [
    { id: 'autoRun', label: 'Song-Ablauf', choices: [[0, 'Aus'], [1, 'An']], value: 0 },
    { id: 'loop', label: 'Ende', choices: [[1, 'Loop'], [0, 'One-Shot']], value: 1 },
  ];
  static jacks = [
    { id: 'barIn', type: 'in', signal: 'clock', label: 'BAR IN' },
    { id: 'slot1In', type: 'in', signal: 'gate', label: 'SLOT 1' },
    { id: 'slot2In', type: 'in', signal: 'gate', label: 'SLOT 2' },
    { id: 'slot3In', type: 'in', signal: 'gate', label: 'SLOT 3' },
    { id: 'slot4In', type: 'in', signal: 'gate', label: 'SLOT 4' },
    { id: 'slot5In', type: 'in', signal: 'gate', label: 'SLOT 5' },
    { id: 'nextIn', type: 'in', signal: 'gate', label: 'NEXT' },
    { id: 'resetIn', type: 'in', signal: 'gate', label: 'RESET' },
  ];

  constructor(ctx, state = {}) {
    super(ctx, state);
    this.lastTriggeredSlot = null;
    this.songSlot = null;   // aktueller Slot im Song-Ablauf (1–5)
    this.barInSlot = 0;     // wie viele Takte der aktuelle Slot schon läuft
    this.songFinished = false;
    this.initValues(state);
  }

  getSnapSys() {
    return this.engine?.snapshotSystem || this.patchSystem?.engine?.snapshotSystem || null;
  }

  isAutoRun() {
    return Number(this.values.autoRun) === 1;
  }

  slotBars(slot) {
    const v = Math.round(Number(this.values[`bars${slot}`]) || 0);
    return Math.max(0, Math.min(64, v));
  }

  firstActiveSlot() {
    for (let s = 1; s <= 5; s++) if (this.slotBars(s) > 0) return s;
    return null;
  }

  nextActiveSlot(from) {
    for (let s = from + 1; s <= 5; s++) if (this.slotBars(s) > 0) return s;
    return null;
  }

  /** Führt eine Aktion exakt zum geplanten Audio-Zeitpunkt aus (Clock wird ~100 ms vorausgeplant) */
  atTime(time, fn) {
    const delayMs = Number.isFinite(time) ? Math.max(0, (time - this.ctx.currentTime) * 1000) : 0;
    if (delayMs < 4) fn();
    else setTimeout(fn, delayMs);
  }

  fireSlot(slot, time) {
    const snapSys = this.getSnapSys();
    this.lastTriggeredSlot = slot;
    this.atTime(time, () => {
      snapSys?.triggerSlot(slot);
      this.updateActiveUi?.(slot);
      this.updateSongUi?.();
    });
  }

  resetSong(time) {
    this.songFinished = false;
    const first = this.firstActiveSlot();
    this.songSlot = first;
    this.barInSlot = 0;
    if (first) this.fireSlot(first, time);
    else this.updateSongUi?.();
  }

  resetTransport(time) {
    if (this.isAutoRun()) this.resetSong(time);
  }

  onClock(portId, time, tick = 0) {
    if (portId !== 'barIn' || !this.enabled || !this.isAutoRun()) return;

    // Clock-Neustart (Takt 0) oder noch nicht gestartet -> Song beginnt bei Slot 1
    if (tick === 0 || this.songSlot === null) {
      this.resetSong(time);
    }
    if (!this.songSlot) return;

    // Manuell gewählter Slot (Performance-Board / Tasten 1–5) wird übernommen
    const snapSys = this.getSnapSys();
    const active = snapSys?.activeSlot;
    if (active && active !== this.songSlot && active !== this.lastTriggeredSlot) {
      this.songSlot = active;
      this.barInSlot = 0;
      this.songFinished = false;
    }

    this.barInSlot++;
    const len = this.slotBars(this.songSlot);
    if (len > 0 && this.barInSlot > len) {
      let next = this.nextActiveSlot(this.songSlot);
      if (!next && Number(this.values.loop) === 1) next = this.firstActiveSlot();
      if (next) {
        this.songSlot = next;
        this.barInSlot = 1;
        this.songFinished = false;
        this.fireSlot(next, time);
        return;
      }
      // One-Shot: im letzten Slot stehen bleiben
      this.barInSlot = len;
      this.songFinished = true;
    }
    this.atTime(time, () => this.updateSongUi?.());
  }

  onTrigger(portId, time, _velocity = 1, _duration = 0.1) {
    if (!this.enabled) return;
    const snapSys = this.getSnapSys();
    if (!snapSys) return;

    if (portId === 'resetIn' && this.isAutoRun()) {
      this.resetSong(time);
      return;
    }

    let targetSlot = null;
    if (portId === 'slot1In') targetSlot = 1;
    else if (portId === 'slot2In') targetSlot = 2;
    else if (portId === 'slot3In') targetSlot = 3;
    else if (portId === 'slot4In') targetSlot = 4;
    else if (portId === 'slot5In') targetSlot = 5;
    else if (portId === 'resetIn') targetSlot = 1;
    else if (portId === 'nextIn') {
      const cur = snapSys.activeSlot || 0;
      targetSlot = (cur % 5) + 1;
    }

    if (targetSlot !== null) {
      if (this.isAutoRun()) {
        // Song-Ablauf läuft ab dem gewählten Slot weiter
        this.songSlot = targetSlot;
        this.barInSlot = 0;
        this.songFinished = false;
      }
      this.lastTriggeredSlot = targetSlot;
      snapSys.triggerSlot(targetSlot);
      this.updateActiveUi?.(targetSlot);
      this.updateSongUi?.();
    }
  }

  applyParam(id) {
    if (id === 'autoRun') {
      this.songSlot = null;
      this.barInSlot = 0;
      this.songFinished = false;
    }
    if (id === 'autoRun' || id === 'loop' || id.startsWith('bars')) {
      this.updateSongUi?.();
    }
  }

  renderExtra(el) {
    el.innerHTML = `
      <div class="snapshot-ctrl-display">
        <span class="snap-ctrl-lbl">AKTIVER PERFORMANCE SNAPSHOT</span>
        <div class="snap-ctrl-slots">
          ${[1, 2, 3, 4, 5].map((s) => `<span class="snap-ctrl-pill" data-slot="${s}">SLOT ${s}<small class="snap-ctrl-bars"></small></span>`).join('')}
        </div>
        <div class="snap-ctrl-song">
          <span class="snap-ctrl-song-state">SONG: AUS</span>
          <span class="snap-ctrl-song-bar">—</span>
        </div>
        <div class="snap-ctrl-progress"><span class="snap-ctrl-progress-fill"></span></div>
      </div>
    `;
    const pills = el.querySelectorAll('.snap-ctrl-pill');
    const stateEl = el.querySelector('.snap-ctrl-song-state');
    const barEl = el.querySelector('.snap-ctrl-song-bar');
    const fillEl = el.querySelector('.snap-ctrl-progress-fill');

    this.updateActiveUi = (activeSlot) => {
      pills.forEach((p) => {
        const s = Number(p.dataset.slot);
        p.classList.toggle('active', s === activeSlot);
      });
    };

    this.updateSongUi = () => {
      const auto = this.isAutoRun();
      pills.forEach((p) => {
        const s = Number(p.dataset.slot);
        const bars = this.slotBars(s);
        const small = p.querySelector('.snap-ctrl-bars');
        if (small) small.textContent = auto ? (bars > 0 ? ` · ${bars}T` : ' · skip') : '';
        p.classList.toggle('skipped', auto && bars === 0);
      });
      if (!auto) {
        stateEl.textContent = 'SONG: AUS';
        barEl.textContent = '—';
        fillEl.style.width = '0%';
        return;
      }
      const len = this.songSlot ? this.slotBars(this.songSlot) : 0;
      const loopTxt = Number(this.values.loop) === 1 ? 'LOOP' : 'ONE-SHOT';
      stateEl.textContent = this.songSlot
        ? `SONG: SLOT ${this.songSlot} · ${this.songFinished ? 'ENDE' : loopTxt}`
        : 'SONG: WARTET AUF BAR';
      barEl.textContent = this.songSlot ? `Bar ${Math.max(0, this.barInSlot)} / ${len}` : 'Bar 0';
      fillEl.style.width = len > 0 ? `${Math.min(100, (this.barInSlot / len) * 100)}%` : '0%';
    };

    const snapSys = this.getSnapSys();
    if (snapSys?.activeSlot) {
      this.updateActiveUi(snapSys.activeSlot);
    }
    this.updateSongUi();
  }
}

// ───────────────────────────────────────────── 13. CHORD ARPEGGIATOR ──
export class ChordArpeggiatorModule extends ModuleBase {
  static type = 'chord_arp';
  static title = 'Chord Arpeggiator';
  static category = 'control';
  static color = '#818cf8';
  static icon = '⤹';
  static description = 'Melodische Ostinati & Arpeggios aus polyphonen Akkorden';
  static params = [
    { id: 'octaves', label: 'Oktaven', min: 1, max: 3, value: 2, fmt: 'int' },
    { id: 'gateLen', label: 'Gate-Länge', min: 0.1, max: 1.2, value: 0.65, fmt: 'pct' },
    { id: 'density', label: 'Dichte', min: 0, max: 1, value: 1.0, fmt: 'pct' },
    { id: 'accentEvery', label: 'Akzent alle', min: 0, max: 8, value: 4, fmt: 'int' },
  ];
  static options = [
    {
      id: 'pattern',
      label: 'Muster',
      choices: [
        ['up', 'Up (Aufwärts)'],
        ['down', 'Down (Abwärts)'],
        ['updown', 'Up-Down (Pendel)'],
        ['converge', 'Converge (Zusammenlauf)'],
        ['pulse', 'Root-Pulse (Anker)'],
        ['random', 'Random (Zufall)'],
      ],
      value: 'updown',
    },
  ];
  static jacks = [
    { id: 'clockIn', type: 'in', signal: 'clock', label: 'CLOCK' },
    { id: 'resetIn', type: 'in', signal: 'gate', label: 'RESET' },
    { id: 'pitchIn', type: 'in', signal: 'pitch', label: 'POLY PITCH' },
    { id: 'gateOut', type: 'out', signal: 'gate', label: 'GATE OUT' },
    { id: 'pitchOut', type: 'out', signal: 'pitch', label: 'PITCH OUT' },
    { id: 'accentOut', type: 'out', signal: 'gate', label: 'ACCENT OUT' },
  ];

  constructor(ctx, state = {}) {
    super(ctx, state);
    this.currentChord = [48, 52, 55]; // Standard C-Dur Dreiklang (C3, E3, G3)
    this.stepIndex = 0;
    this.lastClockTime = 0;
    this.activeNote = null;
    this.updateDisplay = null;
    this.initValues(state);
  }

  onPitch(portId, _time, midiNote) {
    if (portId !== 'pitchIn') return;
    if (Array.isArray(midiNote) && midiNote.length > 0) {
      const notes = midiNote
        .filter((n) => typeof n === 'number' && Number.isFinite(n))
        .map((n) => Math.round(n));
      const unique = [...new Set(notes)].sort((a, b) => a - b);
      if (unique.length > 0) {
        this.currentChord = unique;
      }
    } else if (typeof midiNote === 'number' && Number.isFinite(midiNote)) {
      const root = Math.round(midiNote);
      this.currentChord = [root, root + 4, root + 7];
    }
    this.updateDisplay?.();
  }

  onTrigger(portId, _time) {
    if (portId === 'resetIn') {
      this.stepIndex = 0;
      this.updateDisplay?.();
    }
  }

  resetTransport(_time) {
    this.stepIndex = 0;
    this.updateDisplay?.();
  }

  getArpSequence() {
    const base = this.currentChord && this.currentChord.length > 0 ? this.currentChord : [48, 52, 55];
    const oct = Math.max(1, Math.min(3, Math.round(this.values.octaves ?? 2)));
    const expanded = [];
    for (let o = 0; o < oct; o++) {
      for (const n of base) {
        expanded.push(n + o * 12);
      }
    }
    expanded.sort((a, b) => a - b);
    const N = expanded.length;
    if (N === 0) return [60];

    const pat = this.values.pattern || 'updown';
    switch (pat) {
      case 'up':
        return expanded;
      case 'down':
        return [...expanded].reverse();
      case 'updown': {
        if (N <= 2) return expanded;
        const seq = [...expanded];
        for (let i = N - 2; i >= 1; i--) {
          seq.push(expanded[i]);
        }
        return seq;
      }
      case 'converge': {
        const seq = [];
        let left = 0, right = N - 1;
        while (left <= right) {
          seq.push(expanded[left]);
          if (left !== right) seq.push(expanded[right]);
          left++;
          right--;
        }
        return seq;
      }
      case 'pulse': {
        const root = expanded[0];
        const seq = [];
        for (let i = 0; i < N; i++) {
          seq.push(root);
          seq.push(expanded[i]);
        }
        return seq;
      }
      case 'random':
      default:
        return expanded;
    }
  }

  onClock(portId, time, _tick) {
    if (portId !== 'clockIn' || !this.enabled) return;
    const seq = this.getArpSequence();
    if (seq.length === 0) return;

    const pat = this.values.pattern || 'updown';
    let note;
    if (pat === 'random') {
      const idx = Math.floor(Math.random() * seq.length);
      note = seq[idx];
    } else {
      const idx = this.stepIndex % seq.length;
      note = seq[idx];
    }

    const stepDur = (this.lastClockTime && time > this.lastClockTime)
      ? Math.max(0.04, Math.min(1.0, time - this.lastClockTime))
      : 0.25;
    this.lastClockTime = time;

    const density = this.values.density ?? 1.0;
    const playStep = Math.random() < density;

    if (playStep) {
      const gateLen = Math.max(0.02, Math.min(2.0, stepDur * (this.values.gateLen ?? 0.65)));
      this.activeNote = note;
      this.emitPitch('pitchOut', time, note, 0.9, gateLen);
      this.emitTrigger('gateOut', time, 1.0, gateLen);
    } else {
      this.activeNote = null;
    }

    const accentEvery = Math.round(this.values.accentEvery ?? 4);
    if (accentEvery > 0 && (this.stepIndex % accentEvery === 0)) {
      this.emitTrigger('accentOut', time, 1.0, 0.05);
    }

    this.stepIndex++;
    this.updateDisplay?.();
  }

  renderExtra(el) {
    el.innerHTML = `
      <div class="chord-arp-display">
        <div class="arp-header-row">
          <span class="arp-lbl">AKKORD-OSTINATO</span>
          <span class="arp-step-badge">STEP <b class="arp-step-val">1</b></span>
        </div>
        <div class="arp-notes-track"></div>
        <div class="arp-footer-row">
          <span class="arp-note-active">—</span>
          <span class="arp-pattern-tag">${(this.values.pattern || 'updown').toUpperCase()}</span>
        </div>
      </div>
    `;

    const stepVal = el.querySelector('.arp-step-val');
    const track = el.querySelector('.arp-notes-track');
    const noteActive = el.querySelector('.arp-note-active');
    const patternTag = el.querySelector('.arp-pattern-tag');

    this.updateDisplay = () => {
      const seq = this.getArpSequence();
      if (stepVal) stepVal.textContent = String((this.stepIndex % (seq.length || 1)) + 1);
      if (patternTag) patternTag.textContent = (this.values.pattern || 'updown').toUpperCase();

      if (noteActive) {
        if (this.activeNote !== null) {
          noteActive.textContent = midiToName ? midiToName(this.activeNote) : `MIDI ${this.activeNote}`;
          noteActive.classList.add('playing');
        } else {
          noteActive.textContent = '—';
          noteActive.classList.remove('playing');
        }
      }

      if (track) {
        const base = this.currentChord || [48, 52, 55];
        track.innerHTML = base.map((m) => {
          const name = midiToName ? midiToName(m) : m;
          const isAct = this.activeNote && (this.activeNote % 12 === m % 12);
          return `<span class="arp-note-pill ${isAct ? 'active' : ''}">${name}</span>`;
        }).join('');
      }
    };

    this.updateDisplay();
  }
}


