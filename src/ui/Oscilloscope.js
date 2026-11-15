// Multi-Mode Studio Oscilloscope, Logarithmic FFT & Stereo XY Vectorscope
import { midiToName } from '../modules/base.js';

export class Oscilloscope {
  constructor(canvas, analyser, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    this.analyser = analyser;
    this.analyserL = options.analyserL || null;
    this.analyserR = options.analyserR || null;
    this.onReadout = options.onReadout || null;
    this.onModeChange = options.onModeChange || null;

    this.mode = 'wave'; // 'wave' | 'fft' | 'xy'
    this.colorMode = options.colorMode || 'amber'; // 'amber' | 'cyan' | 'green'

    const fftSize = analyser?.fftSize || 2048;
    const binCount = analyser?.frequencyBinCount || 1024;
    this.floatTimeBuf = new Float32Array(fftSize);
    this.freqBuf = new Uint8Array(binCount);
    this.timeL = new Float32Array(this.analyserL?.fftSize || 1024);
    this.timeR = new Float32Array(this.analyserR?.fftSize || 1024);

    // Peak-Hold für FFT (max 64 Balken)
    this.peakHold = new Float32Array(64);
    this.peakHoldTimer = new Uint8Array(64);
    this.smoothedPeakDb = -Infinity;

    // Popout-Canvas (Großansicht)
    this.popoutCanvas = null;
    this.popoutCtx = null;
    this.popoutW = 480;
    this.popoutH = 240;

    this.isRunning = false;
    this.animationId = null;
    this.lastDrawTime = 0;
    this.fpsInterval = 1000 / 30;
    this.idleFrames = 0;
    this.isSleeping = false;
    this.readoutCounter = 0;

    this.initCanvas();
    this.bindVisibility();
  }

  bindVisibility() {
    this._onVisibilityChange = () => {
      if (document.hidden) this.stop();
      else this.start();
    };
    document.addEventListener('visibilitychange', this._onVisibilityChange);
  }

  setupCanvasSize(canvas, ctx, fallbackW, fallbackH) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || fallbackW;
    const h = rect.height || fallbackH;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    return { w, h };
  }

  initCanvas() {
    const { w, h } = this.setupCanvasSize(this.canvas, this.ctx, 118, 30);
    this.w = w;
    this.h = h;
    if (this.popoutCanvas && this.popoutCtx) {
      const pSize = this.setupCanvasSize(this.popoutCanvas, this.popoutCtx, 480, 240);
      this.popoutW = pSize.w;
      this.popoutH = pSize.h;
    }
  }

  setPopoutCanvas(canvas) {
    this.popoutCanvas = canvas;
    if (canvas) {
      this.popoutCtx = canvas.getContext('2d', { alpha: false, desynchronized: true });
      const { w, h } = this.setupCanvasSize(canvas, this.popoutCtx, 480, 240);
      this.popoutW = w;
      this.popoutH = h;
      this.isSleeping = false;
      if (this.analyser?.context?.state !== 'running') {
        this.drawIdleOn(this.popoutCtx, w, h, true);
      } else {
        this.draw();
      }
    } else {
      this.popoutCtx = null;
    }
  }

  setMode(mode) {
    if (!['wave', 'fft', 'xy'].includes(mode)) return;
    this.mode = mode;
    this.peakHold.fill(0);
    this.isSleeping = false;
    this.onModeChange?.(mode);
    if (this.analyser?.context?.state !== 'running') {
      this.drawIdle();
    } else {
      this.draw();
    }
  }

  cycleMode() {
    const order = ['wave', 'fft', 'xy'];
    const next = order[(order.indexOf(this.mode) + 1) % order.length];
    this.setMode(next);
    return next;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isSleeping = false;

    const drawLoop = (now) => {
      if (!this.isRunning) return;
      this.animationId = requestAnimationFrame(drawLoop);

      const elapsed = now - this.lastDrawTime;
      if (elapsed < this.fpsInterval) return;
      this.lastDrawTime = now - (elapsed % this.fpsInterval);

      if (document.hidden) return;
      if (this.analyser?.context?.state !== 'running') {
        if (!this.isSleeping) {
          this.drawIdle();
          this.isSleeping = true;
        }
        return;
      }

      this.draw();
    };

    this.animationId = requestAnimationFrame(drawLoop);
  }

  stop() {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  drawIdle() {
    this.drawIdleOn(this.ctx, this.w, this.h, false);
    if (this.popoutCtx) {
      this.drawIdleOn(this.popoutCtx, this.popoutW, this.popoutH, true);
    }
    this.onReadout?.({ peakDb: -Infinity, note: '—', freq: 0 });
  }

  drawIdleOn(ctx, w, h, isExpanded) {
    ctx.fillStyle = '#080c0b';
    ctx.fillRect(0, 0, w, h);
    this.drawGrid(ctx, w, h, isExpanded);
    ctx.strokeStyle = this.getColor(0.35);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    if (this.mode === 'xy') {
      ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.08, 0, Math.PI * 2);
    } else {
      const y = this.mode === 'fft' ? h - 2 : h / 2;
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
  }

  draw() {
    if (!this.analyser) {
      this.drawIdle();
      return;
    }

    this.analyser.getFloatTimeDomainData(this.floatTimeBuf);

    // Peak-Pegel berechnen
    let maxAbs = 0;
    const len = this.floatTimeBuf.length;
    for (let i = 0; i < len; i += 2) {
      const a = Math.abs(this.floatTimeBuf[i]);
      if (a > maxAbs) maxAbs = a;
    }

    const isSilent = maxAbs < 0.0015;
    if (isSilent) {
      this.idleFrames++;
      if (this.idleFrames > 30) {
        if (!this.isSleeping) {
          this.drawIdle();
          this.isSleeping = true;
        }
        return;
      }
    } else {
      this.idleFrames = 0;
      this.isSleeping = false;
    }

    // Readouts aktualisieren (ca. 10x pro Sekunde, wenn Popout oder Callback aktiv)
    if (this.onReadout && (this.readoutCounter++ % 3 === 0)) {
      const instantDb = maxAbs > 1e-5 ? 20 * Math.log10(maxAbs) : -Infinity;
      if (instantDb > this.smoothedPeakDb) this.smoothedPeakDb = instantDb;
      else this.smoothedPeakDb = Math.max(-90, this.smoothedPeakDb - 0.9);

      let note = '—';
      let freq = 0;
      if (maxAbs > 0.008 && this.popoutCtx) {
        freq = this.estimatePitch(this.floatTimeBuf, this.analyser.context?.sampleRate || 44100);
        if (freq >= 32 && freq <= 1500) {
          const midi = Math.round(69 + 12 * Math.log2(freq / 440));
          note = `${midiToName(midi)} · ${Math.round(freq)} Hz`;
        }
      }
      this.onReadout({
        peakDb: maxAbs > 1e-5 ? this.smoothedPeakDb : -Infinity,
        note,
        freq,
      });
    }

    if (this.mode === 'wave') {
      const triggerIdx = this.findRisingZeroCrossing(this.floatTimeBuf);
      this.drawWave(this.ctx, this.w, this.h, triggerIdx, false);
      if (this.popoutCtx) {
        this.drawWave(this.popoutCtx, this.popoutW, this.popoutH, triggerIdx, true);
      }
    } else if (this.mode === 'fft') {
      this.analyser.getByteFrequencyData(this.freqBuf);
      this.drawFFT(this.ctx, this.w, this.h, false);
      if (this.popoutCtx) {
        this.drawFFT(this.popoutCtx, this.popoutW, this.popoutH, true);
      }
    } else if (this.mode === 'xy') {
      if (this.analyserL && this.analyserR) {
        this.analyserL.getFloatTimeDomainData(this.timeL);
        this.analyserR.getFloatTimeDomainData(this.timeR);
      } else {
        this.timeL.set(this.floatTimeBuf.subarray(0, this.timeL.length));
        this.timeR.set(this.floatTimeBuf.subarray(0, this.timeR.length));
      }
      this.drawXY(this.ctx, this.w, this.h, false);
      if (this.popoutCtx) {
        this.drawXY(this.popoutCtx, this.popoutW, this.popoutH, true);
      }
    }
  }

  /** Rising-Edge Zero-Crossing Trigger für ruhige, stehende Wellenformen */
  findRisingZeroCrossing(buf) {
    const searchLimit = Math.floor(buf.length * 0.55);
    let bestIdx = 0;
    for (let i = 2; i < searchLimit; i++) {
      if (buf[i - 1] < -0.001 && buf[i] >= 0) {
        return i;
      }
      if (bestIdx === 0 && buf[i - 1] < 0 && buf[i] >= 0) {
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  drawWave(ctx, w, h, triggerIdx, isExpanded) {
    // Phosphor-Afterglow (Motion-Trail)
    ctx.fillStyle = 'rgba(8, 12, 11, 0.34)';
    ctx.fillRect(0, 0, w, h);
    this.drawGrid(ctx, w, h, isExpanded);

    const buf = this.floatTimeBuf;
    const windowSamples = Math.min(isExpanded ? 768 : 480, buf.length - triggerIdx);
    const step = isExpanded ? 1 : 2;
    const midY = h / 2;
    const ampScale = h * 0.44;

    // 1. Halbtransparenter Gradient-Fill unter der Kurve
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, this.getColor(0.24));
    grad.addColorStop(0.5, this.getColor(0.04));
    grad.addColorStop(1, this.getColor(0.24));

    ctx.beginPath();
    ctx.moveTo(0, midY);
    for (let i = 0; i < windowSamples; i += step) {
      const x = (i / (windowSamples - 1)) * w;
      const v = Math.max(-1, Math.min(1, buf[triggerIdx + i]));
      const y = midY - v * ampScale;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, midY);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // 2. Äußerer Phosphor-Glow
    ctx.beginPath();
    for (let i = 0; i < windowSamples; i += step) {
      const x = (i / (windowSamples - 1)) * w;
      const v = Math.max(-1, Math.min(1, buf[triggerIdx + i]));
      const y = midY - v * ampScale;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineWidth = isExpanded ? 4 : 2.8;
    ctx.strokeStyle = this.getColor(0.26);
    ctx.stroke();

    // 3. Scharfer innerer Kern
    ctx.lineWidth = isExpanded ? 1.8 : 1.3;
    ctx.strokeStyle = this.getColor(0.96);
    ctx.stroke();
  }

  drawFFT(ctx, w, h, isExpanded) {
    ctx.fillStyle = 'rgba(8, 12, 11, 0.45)';
    ctx.fillRect(0, 0, w, h);
    this.drawGrid(ctx, w, h, isExpanded);

    const sr = this.analyser.context?.sampleRate || 44100;
    const fftSize = this.analyser.fftSize || 2048;
    const binCount = this.freqBuf.length;
    const numBars = isExpanded ? 64 : 32;
    const barW = w / numBars;
    const bottomPad = isExpanded ? 16 : 2;
    const usableH = h - bottomPad - 4;

    const minF = 20;
    const maxF = 16000;
    const ratio = maxF / minF;

    const barGrad = ctx.createLinearGradient(0, h, 0, 0);
    barGrad.addColorStop(0, this.getColor(0.35));
    barGrad.addColorStop(0.7, this.getColor(0.82));
    barGrad.addColorStop(1, '#ffffff');

    for (let i = 0; i < numBars; i++) {
      const fLow = minF * Math.pow(ratio, i / numBars);
      const fHigh = minF * Math.pow(ratio, (i + 1) / numBars);
      const binLow = Math.max(1, Math.floor((fLow * fftSize) / sr));
      const binHigh = Math.min(binCount - 1, Math.max(binLow, Math.ceil((fHigh * fftSize) / sr)));

      let maxVal = 0;
      for (let b = binLow; b <= binHigh; b++) {
        if (this.freqBuf[b] > maxVal) maxVal = this.freqBuf[b];
      }

      const norm = maxVal / 255;
      const barH = norm * usableH;

      // Peak-Hold aktualisieren
      if (norm >= this.peakHold[i]) {
        this.peakHold[i] = norm;
        this.peakHoldTimer[i] = 16;
      } else if (this.peakHoldTimer[i] > 0) {
        this.peakHoldTimer[i]--;
      } else {
        this.peakHold[i] = Math.max(0, this.peakHold[i] - 0.018);
      }

      const x = i * barW;
      const bw = Math.max(1.2, barW - (isExpanded ? 2 : 1));
      ctx.fillStyle = barGrad;
      ctx.fillRect(x, h - bottomPad - barH, bw, barH);

      // Peak-Hold Indikator
      if (this.peakHold[i] > 0.02) {
        const peakY = h - bottomPad - this.peakHold[i] * usableH;
        ctx.fillStyle = this.getColor(0.95);
        ctx.fillRect(x, peakY - 1.5, bw, 1.5);
      }
    }

    // Logarithmische Frequenz-Skala im Großbild
    if (isExpanded) {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
      ctx.font = '600 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      const marks = [50, 100, 250, 500, 1000, 2500, 5000, 10000];
      for (const f of marks) {
        const pos = Math.log(f / minF) / Math.log(ratio);
        const x = pos * w;
        const lbl = f >= 1000 ? `${f / 1000}k` : `${f}`;
        ctx.fillText(lbl, x, h - 4);
      }
    }
  }

  drawXY(ctx, w, h, isExpanded) {
    // Weiches Nachleuchten für Lissajous-Figuren
    ctx.fillStyle = 'rgba(8, 12, 11, 0.25)';
    ctx.fillRect(0, 0, w, h);
    this.drawGrid(ctx, w, h, isExpanded);

    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) * 0.44;

    // Goniometer Diagonal-Achsen (+45° L / -45° R)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(cx - radius, cy - radius);
    ctx.lineTo(cx + radius, cy + radius);
    ctx.moveTo(cx + radius, cy - radius);
    ctx.lineTo(cx - radius, cy + radius);
    if (isExpanded) {
      ctx.arc(cx, cy, radius * 0.88, 0, Math.PI * 2);
    }
    ctx.stroke();

    const len = this.timeL.length;
    const step = isExpanded ? 2 : 4;
    const rot = 0.70710678;

    ctx.beginPath();
    for (let i = 0; i < len; i += step) {
      const l = this.timeL[i];
      const r = this.timeR[i];
      // Side (L - R) auf X-Achse, Mid (L + R) auf Y-Achse
      const side = (l - r) * rot;
      const mid = (l + r) * rot;
      const x = cx + side * radius;
      const y = cy - mid * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.lineWidth = isExpanded ? 2.8 : 2.0;
    ctx.strokeStyle = this.getColor(0.25);
    ctx.stroke();

    ctx.lineWidth = isExpanded ? 1.3 : 1.0;
    ctx.strokeStyle = this.getColor(0.92);
    ctx.stroke();
  }

  /** Schnelle Autokorrelation zur Grundton-Schätzung (40 Hz – 1200 Hz) */
  estimatePitch(buf, sr) {
    const minLag = Math.floor(sr / 1200);
    const maxLag = Math.min(Math.floor(buf.length / 2), Math.floor(sr / 40));
    let bestLag = 0;
    let bestCorr = 0;
    const sampleCount = 512;

    for (let lag = minLag; lag < maxLag; lag++) {
      let corr = 0;
      for (let i = 0; i < sampleCount; i += 2) {
        corr += buf[i] * buf[i + lag];
      }
      if (corr > bestCorr) {
        bestCorr = corr;
        bestLag = lag;
      }
    }
    if (bestLag <= 0 || bestCorr < 0.05) return 0;
    return sr / bestLag;
  }

  drawGrid(ctx, w, h, isExpanded) {
    ctx.strokeStyle = isExpanded ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.045)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();

    if (this.mode !== 'fft') {
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
    }
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);

    const cols = isExpanded ? 10 : 6;
    const rows = isExpanded ? 6 : 4;
    for (let i = 1; i < cols; i++) {
      const x = (w / cols) * i;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let j = 1; j < rows; j++) {
      const y = (h / rows) * j;
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
  }

  getColor(alpha = 1) {
    if (this.colorMode === 'green') return `rgba(52, 211, 153, ${alpha})`;
    if (this.colorMode === 'cyan') return `rgba(56, 189, 248, ${alpha})`;
    return `rgba(251, 191, 36, ${alpha})`;
  }

  destroy() {
    this.stop();
    if (this._onVisibilityChange) {
      document.removeEventListener('visibilitychange', this._onVisibilityChange);
    }
  }
}
