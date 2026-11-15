// SYNTHBOARD – Studio-Oszilloskop & 3D Multi-Color Timbre Analyzer
// 5 Modi: 'wave' (3D Ribbon), 'fft' (Multi-Color Spectrum), 'xy' (3D Multi-Band Lissajous),
//         '3d' (40-Frame Spectral Waterfall), 'radial' (3D Sound-Vortex)

const MODES = ['wave', 'fft', 'xy', '3d', 'radial'];

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function freqToNoteName(freq) {
  if (!freq || freq < 27 || freq > 4500) return '—';
  const midi = Math.round(69 + 12 * Math.log2(freq / 440));
  const note = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${note}${octave}`;
}

function estimatePitchHz(buf, sampleRate) {
  const n = buf.length;
  let rms = 0;
  for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / n);
  if (rms < 0.012) return 0;

  const minLag = Math.floor(sampleRate / 1200);
  const maxLag = Math.min(Math.floor(n / 2), Math.floor(sampleRate / 32));
  let bestLag = -1;
  let bestCorr = 0;
  for (let lag = minLag; lag < maxLag; lag++) {
    let corr = 0;
    let norm = 0;
    for (let i = 0; i < maxLag; i += 2) {
      corr += buf[i] * buf[i + lag];
      norm += buf[i] * buf[i] + buf[i + lag] * buf[i + lag];
    }
    const r = norm > 0 ? (2 * corr) / norm : 0;
    if (r > bestCorr) {
      bestCorr = r;
      bestLag = lag;
    }
  }
  if (bestCorr < 0.72 || bestLag <= 0) return 0;
  return sampleRate / bestLag;
}

function colorForFreq(hz, alpha = 1) {
  if (hz < 160) return `rgba(168, 85, 247, ${alpha})`;      // Sub / Bass: Violett
  if (hz < 800) return `rgba(16, 185, 129, ${alpha})`;      // Low-Mid / Warmth: Smaragd
  if (hz < 3500) return `rgba(245, 158, 11, ${alpha})`;     // High-Mid / Presence: Gold
  return `rgba(236, 72, 153, ${alpha})`;                    // Air / Shimmer: Neon-Pink
}

function timbreFromCentroid(hz) {
  if (!hz || hz < 1) return { color: '#38bdf8', label: 'SILENT' };
  if (hz < 180) return { color: '#a855f7', label: 'SUB / BASS' };
  if (hz < 750) return { color: '#10b981', label: 'WARMTH' };
  if (hz < 2800) return { color: '#fbbf24', label: 'PRESENCE' };
  return { color: '#ec4899', label: 'AIR / SHIMMER' };
}

export class Oscilloscope {
  constructor(canvas, analyser, options = {}) {
    this.analyser = analyser;
    this.analyserL = options.analyserL || null;
    this.analyserR = options.analyserR || null;
    this.onReadout = options.onReadout || null;
    this.onModeChange = options.onModeChange || null;

    this.canvases = new Map();
    if (canvas) this.registerCanvas('topbar', canvas);

    this.mode = options.initialMode || '3d';
    this.running = false;
    this.paused = false;
    this.rafId = null;

    if (this.analyser) {
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.78;
    }
    this.timeData = new Float32Array(this.analyser ? this.analyser.fftSize : 2048);
    this.freqData = new Uint8Array(this.analyser ? this.analyser.frequencyBinCount : 1024);
    this.timeL = new Float32Array(this.analyserL ? this.analyserL.fftSize : 1024);
    this.timeR = new Float32Array(this.analyserR ? this.analyserR.fftSize : 1024);

    // Peak-Hold pro FFT-Balken
    this.fftPeaks = new Float32Array(80);
    // Ringbuffer für 3D-Spectral-Waterfall (40 Frames × 64 log-Bins)
    this.waterfallHistory = [];
    this.waterfallMaxFrames = 40;
    this.waterfallBins = 64;
    // Ringbuffer für Radial-3D (nutzt bis zu 22 Frames × 48 Bins)
    this.radialMaxFrames = 22;
    this.radialBins = 48;
    this.radialAngle = 0;
    // Ringbuffer für 3D-Wave-Ribbon (letzte 5 Trigger-Wellen)
    this.waveHistory = [];
    this.waveMaxEchoes = 5;

    // Gradient-Cache pro (canvasKey + size) -> kein createLinearGradient in der Zeichenschleife
    this.gradientCache = new Map();

    this.lastReadoutAt = 0;
    this.lastWaterfallAt = 0;
    this.lastSlowDrawAt = 0;
    this.centroidHz = 0;
    this.bands = [0, 0, 0, 0];
  }

  registerCanvas(key, canvas) {
    if (!canvas) {
      this.canvases.delete(key);
      return;
    }
    this.canvases.set(key, {
      key,
      canvas,
      ctx: canvas.getContext('2d'),
    });
  }

  setPopoutCanvas(canvas) {
    this.registerCanvas('popout', canvas);
  }

  setMode(mode) {
    if (!MODES.includes(mode)) return;
    this.mode = mode;
    this.canvases.forEach(({ ctx, canvas }) => {
      const w = canvas.clientWidth || canvas.width;
      const h = canvas.clientHeight || canvas.height;
      ctx.clearRect(0, 0, w, h);
    });
    this.onModeChange?.(mode);
  }

  cycleMode() {
    const idx = MODES.indexOf(this.mode);
    const next = MODES[(idx + 1) % MODES.length];
    this.setMode(next);
  }

  setPaused(paused) {
    this.paused = !!paused;
    if (this.paused) {
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    } else if (this.running && !this.rafId) {
      const loop = (now) => {
        if (!this.running || this.paused) return;
        this.drawFrame(now);
        this.rafId = requestAnimationFrame(loop);
      };
      this.rafId = requestAnimationFrame(loop);
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    if (!this.paused) {
      const loop = (now) => {
        if (!this.running || this.paused) return;
        this.drawFrame(now);
        this.rafId = requestAnimationFrame(loop);
      };
      this.rafId = requestAnimationFrame(loop);
    }
  }

  stop() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  syncCanvasSize(key, canvas, ctx) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rectW = canvas.clientWidth || parseInt(canvas.getAttribute('width'), 10) || 170;
    const rectH = canvas.clientHeight || parseInt(canvas.getAttribute('height'), 10) || 30;
    const targetW = Math.round(rectW * dpr);
    const targetH = Math.round(rectH * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
      // Cache für diesen Canvas bei Resize invalidieren
      for (const ck of this.gradientCache.keys()) {
        if (ck.startsWith(`${key}:`)) this.gradientCache.delete(ck);
      }
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: rectW, h: rectH };
  }

  getCachedHorizontalGradient(key, ctx, x0, x1) {
    const cacheKey = `${key}:horiz:${Math.round(x0)}:${Math.round(x1)}`;
    let grad = this.gradientCache.get(cacheKey);
    if (!grad) {
      grad = ctx.createLinearGradient(x0, 0, x1, 0);
      grad.addColorStop(0.0, '#a855f7');
      grad.addColorStop(0.28, '#10b981');
      grad.addColorStop(0.58, '#fbbf24');
      grad.addColorStop(0.82, '#ec4899');
      grad.addColorStop(1.0, '#67e8f9');
      this.gradientCache.set(cacheKey, grad);
    }
    return grad;
  }

  analyzeTimbre(now) {
    const sr = this.analyser.context?.sampleRate || 48000;
    const binHz = (sr * 0.5) / this.freqData.length;

    let weightedSum = 0;
    let magSum = 0;
    let b0 = 0, c0 = 0;
    let b1 = 0, c1 = 0;
    let b2 = 0, c2 = 0;
    let b3 = 0, c3 = 0;

    for (let i = 1; i < this.freqData.length; i++) {
      const hz = i * binHz;
      if (hz > 16000) break;
      const v = this.freqData[i] / 255;
      weightedSum += hz * v;
      magSum += v;

      if (hz < 160) { b0 += v; c0++; }
      else if (hz < 800) { b1 += v; c1++; }
      else if (hz < 3500) { b2 += v; c2++; }
      else { b3 += v; c3++; }
    }

    this.centroidHz = magSum > 0.08 ? weightedSum / magSum : 0;
    this.bands = [
      c0 ? Math.min(1, (b0 / c0) * 1.4) : 0,
      c1 ? Math.min(1, (b1 / c1) * 1.5) : 0,
      c2 ? Math.min(1, (b2 / c2) * 1.7) : 0,
      c3 ? Math.min(1, (b3 / c3) * 2.0) : 0,
    ];

    if (now - this.lastWaterfallAt >= 32) {
      this.lastWaterfallAt = now;
      const frame = new Float32Array(this.waterfallBins);
      const minF = 20;
      const maxF = 16000;
      for (let i = 0; i < this.waterfallBins; i++) {
        const f0 = minF * Math.pow(maxF / minF, i / this.waterfallBins);
        const f1 = minF * Math.pow(maxF / minF, (i + 1) / this.waterfallBins);
        const idx0 = Math.max(1, Math.floor(f0 / binHz));
        const idx1 = Math.min(this.freqData.length - 1, Math.max(idx0, Math.ceil(f1 / binHz)));
        let peak = 0;
        for (let k = idx0; k <= idx1; k++) {
          if (this.freqData[k] > peak) peak = this.freqData[k];
        }
        frame[i] = peak / 255;
      }
      this.waterfallHistory.unshift(frame);
      if (this.waterfallHistory.length > this.waterfallMaxFrames) {
        this.waterfallHistory.pop();
      }
    }
  }

  isCanvasVisible(entry) {
    if (!entry || !entry.canvas.isConnected) return false;
    return !(entry.canvas.offsetParent === null && entry.canvas.clientWidth === 0);
  }

  drawFrame(now) {
    if (!this.analyser || this.paused) return;

    // 30 FPS Capping für 3D / RADIAL / XY
    const isHeavyMode = this.mode === '3d' || this.mode === 'radial' || this.mode === 'xy';
    if (isHeavyMode && now - this.lastSlowDrawAt < 32) {
      return;
    }
    this.lastSlowDrawAt = now;

    // Single-Pass Audio-Daten & Timbre-Analyse
    this.analyser.getFloatTimeDomainData(this.timeData);
    this.analyser.getByteFrequencyData(this.freqData);
    this.analyzeTimbre(now);

    if (this.mode === 'xy' && this.analyserL && this.analyserR) {
      this.analyserL.getFloatTimeDomainData(this.timeL);
      this.analyserR.getFloatTimeDomainData(this.timeR);
    }

    if (this.onReadout && now - this.lastReadoutAt > 95) {
      this.lastReadoutAt = now;
      let peak = 0;
      for (let i = 0; i < this.timeData.length; i++) {
        const a = Math.abs(this.timeData[i]);
        if (a > peak) peak = a;
      }
      const peakDb = peak > 0.0001 ? Math.max(-60, 20 * Math.log10(peak)) : -60;
      const sr = this.analyser.context?.sampleRate || 48000;
      const pitchHz = estimatePitchHz(this.timeData, sr);
      const note = pitchHz > 0 ? `${freqToNoteName(pitchHz)} (${Math.round(pitchHz)} Hz)` : '—';
      const timbre = timbreFromCentroid(this.centroidHz);
      this.onReadout({ peakDb, note, freq: pitchHz, centroidHz: this.centroidHz, timbre });
    }

    if (this.mode === 'wave') {
      const trigIdx = this.findRisingZeroCrossing();
      const snap = new Float32Array(128);
      const span = Math.min(512, this.timeData.length - trigIdx);
      for (let i = 0; i < 128; i++) {
        const idx = trigIdx + Math.floor((i / 127) * (span - 1));
        snap[i] = this.timeData[idx] || 0;
      }
      this.waveHistory.unshift(snap);
      if (this.waveHistory.length > this.waveMaxEchoes) this.waveHistory.pop();
    }

    if (this.mode === 'radial') {
      this.radialAngle += 0.008;
    }

    // Primär-Canvas bestimmen (Popout > Perf > Topbar)
    const popoutEntry = this.canvases.get('popout');
    const perfEntry = this.canvases.get('perf');
    const topbarEntry = this.canvases.get('topbar');

    let primaryRenderedCanvas = null;

    const renderEntry = (entry) => {
      if (!this.isCanvasVisible(entry)) return false;
      const { key, canvas, ctx } = entry;
      const { w, h } = this.syncCanvasSize(key, canvas, ctx);
      const isCompact = h <= 46;

      if (this.mode === 'wave') {
        this.drawWave(key, ctx, w, h, isCompact);
      } else if (this.mode === 'fft') {
        this.drawFft(ctx, w, h, isCompact);
      } else if (this.mode === 'xy') {
        this.drawXy(ctx, w, h, isCompact);
      } else if (this.mode === 'radial') {
        this.drawRadial(ctx, w, h, isCompact);
      } else {
        this.draw3DWaterfall(key, ctx, w, h, isCompact);
      }
      return true;
    };

    if (renderEntry(popoutEntry)) {
      primaryRenderedCanvas = popoutEntry.canvas;
    }
    if (renderEntry(perfEntry)) {
      primaryRenderedCanvas = primaryRenderedCanvas || perfEntry.canvas;
    }

    // Topbar-Scope: Wenn bereits auf großem Display gerendert wurde, per drawImage() spiegeln!
    if (this.isCanvasVisible(topbarEntry)) {
      if (primaryRenderedCanvas) {
        const { key, canvas, ctx } = topbarEntry;
        const { w, h } = this.syncCanvasSize(key, canvas, ctx);
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(primaryRenderedCanvas, 0, 0, w, h);
      } else {
        renderEntry(topbarEntry);
      }
    }
  }

  findRisingZeroCrossing() {
    const len = this.timeData.length;
    const searchLimit = Math.floor(len * 0.55);
    for (let i = 1; i < searchLimit; i++) {
      if (this.timeData[i - 1] < 0 && this.timeData[i] >= 0) {
        return i;
      }
    }
    return 0;
  }

  drawSubGrid(ctx, w, h, isCompact) {
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    if (!isCompact) {
      for (let x = w / 8; x < w; x += w / 8) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
      ctx.moveTo(0, h * 0.25);
      ctx.lineTo(w, h * 0.25);
      ctx.moveTo(0, h * 0.75);
      ctx.lineTo(w, h * 0.75);
    }
    ctx.stroke();
  }

  drawWave(key, ctx, w, h, isCompact) {
    ctx.fillStyle = 'rgba(6, 9, 15, 0.45)';
    ctx.fillRect(0, 0, w, h);
    this.drawSubGrid(ctx, w, h, isCompact);

    const midY = h * 0.5;
    const amp = h * (isCompact ? 0.42 : 0.36);

    // Hintere 3D-Ribbon-Spuren ohne shadowBlur
    const echoCount = isCompact ? 2 : this.waveHistory.length;
    for (let e = echoCount - 1; e >= 1; e--) {
      const hist = this.waveHistory[e];
      if (!hist) continue;
      const dx = -e * (isCompact ? 2 : 5);
      const dy = -e * (isCompact ? 1.2 : 4.5);
      const alpha = Math.max(0.08, 0.36 - e * 0.07);
      ctx.beginPath();
      for (let i = 0; i < hist.length; i++) {
        const x = (i / (hist.length - 1)) * w + dx;
        const y = midY + hist[i] * amp * (1 - e * 0.06) + dy;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(129, 140, 248, ${alpha})`;
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }

    const front = this.waveHistory[0];
    if (!front) return;
    const timbre = timbreFromCentroid(this.centroidHz);

    ctx.beginPath();
    for (let i = 0; i < front.length; i++) {
      const x = (i / (front.length - 1)) * w;
      const y = midY + front[i] * amp;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.strokeStyle = isCompact ? timbre.color : this.getCachedHorizontalGradient(key, ctx, 0, w);
    ctx.lineWidth = isCompact ? 1.6 : 2.1;
    ctx.stroke();
  }

  drawFft(ctx, w, h, isCompact) {
    ctx.fillStyle = '#06090f';
    ctx.fillRect(0, 0, w, h);

    if (!isCompact) {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      [0.25, 0.5, 0.75].forEach((r) => {
        ctx.moveTo(0, h * r);
        ctx.lineTo(w, h * r);
      });
      ctx.stroke();
    }

    const sr = this.analyser.context?.sampleRate || 48000;
    const binHz = (sr * 0.5) / this.freqData.length;
    const minF = 20;
    const maxF = 16000;
    const numBars = isCompact ? 28 : Math.min(72, Math.max(40, Math.floor(w / 7)));
    const barGap = isCompact ? 1.5 : 2.5;
    const barW = Math.max(2, (w - barGap * (numBars - 1)) / numBars);

    for (let i = 0; i < numBars; i++) {
      const f0 = minF * Math.pow(maxF / minF, i / numBars);
      const f1 = minF * Math.pow(maxF / minF, (i + 1) / numBars);
      const fMid = Math.sqrt(f0 * f1);
      const idx0 = Math.max(1, Math.floor(f0 / binHz));
      const idx1 = Math.min(this.freqData.length - 1, Math.max(idx0, Math.ceil(f1 / binHz)));

      let peak = 0;
      for (let k = idx0; k <= idx1; k++) {
        if (this.freqData[k] > peak) peak = this.freqData[k];
      }
      const norm = peak / 255;
      const barH = norm * (h - (isCompact ? 3 : 10));
      const x = i * (barW + barGap);
      const y = h - barH;

      ctx.fillStyle = colorForFreq(fMid, 0.78);
      ctx.fillRect(x, y, barW, barH);

      if (!isCompact && barH > 2) {
        ctx.fillStyle = colorForFreq(fMid, 1);
        ctx.fillRect(x, y, barW, 2);
      }

      if (norm > this.fftPeaks[i]) this.fftPeaks[i] = norm;
      else this.fftPeaks[i] = Math.max(0, this.fftPeaks[i] - 0.008);

      const peakY = h - this.fftPeaks[i] * (h - (isCompact ? 3 : 10));
      if (this.fftPeaks[i] > 0.02) {
        ctx.fillStyle = colorForFreq(fMid, 0.95);
        ctx.fillRect(x, Math.max(0, peakY - 1.5), barW, 1.5);
      }
    }
  }

  drawXy(ctx, w, h, isCompact) {
    ctx.fillStyle = 'rgba(6, 9, 15, 0.24)';
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const scale = Math.min(w, h) * 0.44;

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.09)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, 0); ctx.lineTo(cx, h);
    ctx.moveTo(0, cy); ctx.lineTo(w, cy);
    if (!isCompact) ctx.arc(cx, cy, scale * 0.65, 0, Math.PI * 2);
    ctx.stroke();

    const len = this.analyserL && this.analyserR ? this.timeL.length : this.timeData.length;
    const step = isCompact ? 4 : 2;

    // 1. Geglätteter Bass-Kern (Violett/Indigo)
    let lpL = 0;
    let lpR = 0;
    ctx.beginPath();
    for (let i = 0; i < len; i += step) {
      const l = this.analyserL ? this.timeL[i] : this.timeData[i];
      const r = this.analyserR ? this.timeR[i] : this.timeData[(i + 64) % len];
      lpL += 0.09 * (l - lpL);
      lpR += 0.09 * (r - lpR);
      const mid = (lpL + lpR) * 0.707;
      const side = (lpL - lpR) * 0.707;
      const x = cx + side * scale * 1.15;
      const y = cy - mid * scale * 1.15;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.75)';
    ctx.lineWidth = isCompact ? 1.8 : 3.0;
    ctx.stroke();

    // 2. Mittelton-Schicht (Smaragd / Gold)
    ctx.beginPath();
    let midLpL = 0;
    let midLpR = 0;
    for (let i = 0; i < len; i += step) {
      const l = this.analyserL ? this.timeL[i] : this.timeData[i];
      const r = this.analyserR ? this.timeR[i] : this.timeData[(i + 64) % len];
      midLpL += 0.09 * (l - midLpL);
      midLpR += 0.09 * (r - midLpR);
      const hpL = l - midLpL;
      const hpR = r - midLpR;
      const mid = (hpL + hpR) * 0.707;
      const side = (hpL - hpR) * 0.707;
      const x = cx + side * scale;
      const y = cy - mid * scale;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = this.bands[2] > this.bands[1] ? 'rgba(251, 191, 36, 0.68)' : 'rgba(16, 185, 129, 0.68)';
    ctx.lineWidth = isCompact ? 1.0 : 1.4;
    ctx.stroke();

    // 3. Hochfrequenz-Transienten als glitzernde Cyan/Pink-Partikel außen herum
    if (!isCompact) {
      for (let i = 1; i < len; i += 4) {
        const l = this.analyserL ? this.timeL[i] : this.timeData[i];
        const r = this.analyserR ? this.timeR[i] : this.timeData[(i + 64) % len];
        const pl = this.analyserL ? this.timeL[i - 1] : this.timeData[i - 1];
        const pr = this.analyserR ? this.timeR[i - 1] : this.timeData[(i + 63) % len];
        const dl = l - pl;
        const dr = r - pr;
        const energy = Math.abs(dl) + Math.abs(dr);
        if (energy > 0.045) {
          const side = (l - r) * 0.707 + dl * 0.8;
          const mid = (l + r) * 0.707 + dr * 0.8;
          const px = cx + side * scale * 1.15;
          const py = cy - mid * scale * 1.15;
          ctx.fillStyle = i % 8 === 0 ? 'rgba(236, 72, 153, 0.85)' : 'rgba(103, 232, 249, 0.85)';
          ctx.fillRect(px - 1, py - 1, 2.2, 2.2);
        }
      }
    }
  }

  draw3DWaterfall(key, ctx, w, h, isCompact) {
    ctx.fillStyle = '#05080f';
    ctx.fillRect(0, 0, w, h);

    const frames = this.waterfallHistory;
    if (!frames.length) {
      this.drawSubGrid(ctx, w, h, isCompact);
      return;
    }

    const total = isCompact ? Math.min(18, frames.length) : frames.length;
    const bins = this.waterfallBins;
    const frontY = h - (isCompact ? 3 : 10);
    const backY = isCompact ? 6 : 22;
    const peakHeight = isCompact ? h * 0.55 : h * 0.42;

    for (let z = total - 1; z >= 0; z--) {
      const frame = frames[z];
      const depth = total > 1 ? z / (total - 1) : 0;
      const baseY = frontY - depth * (frontY - backY);

      const marginX = depth * w * 0.14;
      const spanW = w - marginX * 2;
      const ampScale = peakHeight * (1 - depth * 0.42);

      ctx.beginPath();
      ctx.moveTo(marginX, baseY);
      for (let i = 0; i < bins; i++) {
        const x = marginX + (i / (bins - 1)) * spanW;
        const val = frame[i] || 0;
        const y = baseY - val * ampScale;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(marginX + spanW, baseY);
      ctx.closePath();

      ctx.fillStyle = z === 0 ? 'rgba(8, 12, 22, 0.94)' : 'rgba(5, 8, 15, 0.92)';
      ctx.fill();

      ctx.beginPath();
      for (let i = 0; i < bins; i++) {
        const x = marginX + (i / (bins - 1)) * spanW;
        const val = frame[i] || 0;
        const y = baseY - val * ampScale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      const alpha = Math.max(0.18, 1 - depth * 0.78);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = this.getCachedHorizontalGradient(key, ctx, 0, w);
      ctx.lineWidth = z === 0 ? (isCompact ? 1.5 : 2.0) : (isCompact ? 0.8 : 1.15);
      ctx.stroke();
      ctx.restore();
    }
  }

  /** Radialer 3D-Sound-Vortex (konzentrische, rotierende FFT-Ringe mit Timbre-Farbcode) */
  drawRadial(ctx, w, h, isCompact) {
    ctx.fillStyle = '#05080f';
    ctx.fillRect(0, 0, w, h);

    const cx = w * 0.5;
    const cy = h * 0.5;
    const maxR = Math.min(w, h) * 0.41;

    // Dezente Tunnel-Fadenkreuze
    if (!isCompact) {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, maxR * 0.35, 0, Math.PI * 2);
      ctx.arc(cx, cy, maxR * 0.72, 0, Math.PI * 2);
      ctx.stroke();
    }

    const frames = this.waterfallHistory;
    if (!frames.length) return;

    const total = Math.min(isCompact ? 10 : this.radialMaxFrames, frames.length);
    const pts = this.radialBins;
    const zoneColors = ['#a855f7', '#10b981', '#fbbf24', '#ec4899'];

    // Von hinten (inneres Zentrum) nach vorne (äußerer Ring) zeichnen
    for (let z = total - 1; z >= 0; z--) {
      const frame = frames[z];
      const depth = total > 1 ? z / (total - 1) : 0; // 0 = vorne/außen, 1 = hinten/innen
      const scale = 1 - depth * 0.82;
      const baseR = maxR * scale * 0.72;
      const radialGain = maxR * scale * 0.46;
      const rot = this.radialAngle + depth * 0.55;
      const alpha = Math.max(0.16, 1 - depth * 0.78);

      // Spiegelsymmetrische geschlossene Kurve (0..2π ohne Nahtstelle)
      ctx.beginPath();
      for (let i = 0; i <= pts; i++) {
        const frac = i / pts;
        const theta = frac * Math.PI * 2 + rot;
        // Symmetrie: 0..π -> Bass..Air, π..2π -> Air..Bass
        const mirrorFrac = frac <= 0.5 ? frac * 2 : (1 - frac) * 2;
        const binIdx = Math.min(this.waterfallBins - 1, Math.floor(mirrorFrac * (this.waterfallBins - 1)));
        const amp = frame[binIdx] || 0;
        const r = baseR + amp * radialGain;
        const x = cx + Math.cos(theta) * r;
        const y = cy + Math.sin(theta) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();

      // Klangfarbe pro Ring anhand der dominanten Energie-Zone wählen
      const zIdx = z % 4;
      const dominantBand = this.bands.indexOf(Math.max(...this.bands));
      const ringColor = z === 0 ? zoneColors[dominantBand >= 0 ? dominantBand : 0] : zoneColors[zIdx];

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = z === 0 ? (isCompact ? 1.5 : 2.1) : (isCompact ? 0.8 : 1.15);
      ctx.stroke();
      ctx.restore();
    }
  }
}
