// SYNTHBOARD – Studio-Oszilloskop & 3D Multi-Color Timbre Analyzer
// 7 Modi: 'wave', 'fft', 'xy', '3d', 'radial', 'sculpt', 'chord' (3D Chord Voice-Leading)

const MODES = ['wave', 'fft', 'xy', '3d', 'radial', 'sculpt', 'chord'];

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiToNoteLabel(midi) {
  if (!Number.isFinite(midi)) return '';
  const m = Math.round(midi);
  return `${NOTE_NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
}

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
    this.engine = options.engine || null;
    this.analyser = analyser;
    this.analyserL = options.analyserL || null;
    this.analyserR = options.analyserR || null;
    this.onReadout = options.onReadout || null;
    this.onModeChange = options.onModeChange || null;

    this.canvases = new Map();
    if (canvas) this.registerCanvas('topbar', canvas);

    this.mode = options.initialMode || 'radial';
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
    // Schwebender 3D-Radial-Relief-Ring (~4 Takte = 96 Zeitwinkel × 14 log-Frequenzbänder)
    this.ringSlices = 96;
    this.ringBands = 14;
    this.ringGrid = Array.from({ length: this.ringSlices }, () => new Float32Array(this.ringBands));
    this.ringCursor = 0;
    this.lastRingWriteAt = 0;
    this.ringCamDip = 0;
    this.ringCamDipTarget = 0;
    this.ringFirstDropDone = false;
    this.radialShowXyInset = false;
    this.directorMode = false;
    // XY-Trajektorie mit Tiefenebenen ('orbit' = monophone Phasen-Schleife | 'stereo' = L/R)
    this.xySubMode = 'orbit';
    this.xyHistory = [];
    this.xyMaxHistory = 4;
    // Ringbuffer für stabilisierte Wave-Linie (1 Hauptlinie + 3 dünne dunkle Historienkonturen)
    this.waveHistory = [];
    this.waveMaxEchoes = 4;
    this.lastKickTriggerAt = 0;
    this.prevBassEnergy = 0;

    // Gradient-Cache pro (canvasKey + size) -> kein createLinearGradient in der Zeichenschleife
    this.gradientCache = new Map();

    this.lastReadoutAt = 0;
    this.lastAuxPitchAt = 0;
    this.lastWaterfallAt = 0;
    this.lastSlowDrawAt = 0;
    this.topbarFrameSkip = 0;
    this.centroidHz = 0;
    this.bands = [0, 0, 0, 0];
    this.lastPeak = 0;
    this.lastIsSilent = true;
    this.silentFrames = 0;
    this.idleDrawn = false;
    this.lastPitchHz = 0;
    this.initSculpture();
    this.initChordVisualizer();
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
    this.idleDrawn = false;
    this.silentFrames = 0;
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

  toggleXySubMode() {
    this.xySubMode = this.xySubMode === 'orbit' ? 'stereo' : 'orbit';
    this.xyHistory = [];
    this.idleDrawn = false;
    this.silentFrames = 0;
  }

  triggerRadialCameraDip() {
    this.ringCamDipTarget = 1.0;
    this.idleDrawn = false;
    this.silentFrames = 0;
  }

  onArrangementSlot(slotNum) {
    if (slotNum === 1) {
      this.setSculptPhase('build');
      this.radialShowXyInset = false;
      if (this.directorMode) this.setMode('xy');
    } else if (slotNum === 2 || slotNum === 3) {
      this.setSculptPhase('open');
      this.radialShowXyInset = false;
      this.triggerRadialCameraDip();
      if (this.directorMode) this.setMode('radial');
    } else if (slotNum === 4) {
      this.setSculptPhase('open');
      this.radialShowXyInset = false;
      if (this.directorMode) this.setMode('wave');
    } else if (slotNum === 5) {
      this.setSculptPhase('return');
      this.radialShowXyInset = true;
      if (this.directorMode) this.setMode('radial');
    }
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

  getCachedChordBgGradient(key, ctx, h) {
    const ch = Math.max(1, Math.round(h));
    const cacheKey = `${key}:chordbg:${ch}`;
    let grad = this.gradientCache.get(cacheKey);
    if (!grad) {
      grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#071022');
      grad.addColorStop(1, '#030814');
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

    if (now - this.lastRingWriteAt >= 55) {
      this.lastRingWriteAt = now;
      const prevSlice = this.ringGrid[this.ringCursor];
      this.ringCursor = (this.ringCursor + 1) % this.ringSlices;
      const slice = this.ringGrid[this.ringCursor];
      const minF = 28;
      const maxF = 14000;
      for (let b = 0; b < this.ringBands; b++) {
        const f0 = minF * Math.pow(maxF / minF, b / this.ringBands);
        const f1 = minF * Math.pow(maxF / minF, (b + 1) / this.ringBands);
        const idx0 = Math.max(1, Math.floor(f0 / binHz));
        const idx1 = Math.min(this.freqData.length - 1, Math.max(idx0, Math.ceil(f1 / binHz)));
        let peak = 0;
        for (let k = idx0; k <= idx1; k++) {
          if (this.freqData[k] > peak) peak = this.freqData[k];
        }
        const raw = peak / 255;
        slice[b] = prevSlice ? prevSlice[b] * 0.25 + raw * 0.75 : raw;
      }
    }

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
    if (!this.analyser || this.paused || (typeof document !== 'undefined' && document.hidden)) return;

    // 30 FPS Capping für 3D / RADIAL / XY / SCULPT / CHORD
    const isHeavyMode = this.mode === '3d' || this.mode === 'radial' || this.mode === 'xy' || this.mode === 'sculpt' || this.mode === 'chord';
    if (isHeavyMode && now - this.lastSlowDrawAt < 32) {
      return;
    }
    this.lastSlowDrawAt = now;

    // Single-Pass Audio-Daten & Stille-Erkennung (verhindert Flackern bei Stille)
    this.analyser.getFloatTimeDomainData(this.timeData);
    this.analyser.getByteFrequencyData(this.freqData);

    let peak = 0;
    for (let i = 0; i < this.timeData.length; i++) {
      const a = Math.abs(this.timeData[i]);
      if (a > peak) peak = a;
    }
    let maxFreq = 0;
    for (let i = 1; i < this.freqData.length; i++) {
      if (this.freqData[i] > maxFreq) maxFreq = this.freqData[i];
    }

    const isSilent = peak < 0.00035 && maxFreq < 3;
    this.lastPeak = peak;
    this.lastIsSilent = isSilent;

    const chordSleepReady = this.mode !== 'chord' || (
      this.chordVisualAlpha <= 0.005
      && this.chordRingWaves.length === 0
      && this.chordGhosts.length === 0
      && this.chordSparks.length === 0
    );

    if (isSilent) {
      this.silentFrames++;
      if (this.silentFrames > 45 && chordSleepReady && this.idleDrawn) {
        return;
      }
    } else {
      this.silentFrames = 0;
      this.idleDrawn = false;
    }

    this.analyzeTimbre(now);

    if (this.mode === 'xy' || (this.mode === 'radial' && this.radialShowXyInset)) {
      if (this.xySubMode === 'stereo' && this.analyserL && this.analyserR) {
        this.analyserL.getFloatTimeDomainData(this.timeL);
        this.analyserR.getFloatTimeDomainData(this.timeR);
      }
      this.captureXySnapshot();
    }

    if (this.bands[0] - this.prevBassEnergy > 0.14 && this.bands[0] > 0.36 && now - this.lastKickTriggerAt > 200) {
      this.lastKickTriggerAt = now;
      if (!this.ringFirstDropDone && this.mode === 'radial') {
        this.ringFirstDropDone = true;
        this.triggerRadialCameraDip();
      }
    }
    this.prevBassEnergy = this.bands[0] || 0;

    if (isSilent) {
      this.lastPitchHz = 0;
    }
    if (this.onReadout && now - this.lastReadoutAt > 95) {
      this.lastReadoutAt = now;
      this.lastAuxPitchAt = now;
      const peakDb = peak > 0.0001 ? Math.max(-60, 20 * Math.log10(peak)) : -60;
      const sr = this.analyser.context?.sampleRate || 48000;
      const pitchHz = isSilent ? 0 : estimatePitchHz(this.timeData, sr);
      this.lastPitchHz = pitchHz;
      const note = pitchHz > 0 ? `${freqToNoteName(pitchHz)} (${Math.round(pitchHz)} Hz)` : '—';
      const timbre = timbreFromCentroid(isSilent ? 0 : this.centroidHz);
      this.onReadout({ peakDb, note, freq: pitchHz, centroidHz: this.centroidHz, timbre });
    } else if (!isSilent && (this.mode === 'sculpt' || this.mode === 'chord') && now - this.lastAuxPitchAt > 105) {
      this.lastAuxPitchAt = now;
      const sr = this.analyser.context?.sampleRate || 48000;
      this.lastPitchHz = estimatePitchHz(this.timeData, sr);
    }

    if (this.mode === 'sculpt') {
      this.updateSculpture(now, isSilent, this.lastPitchHz);
    } else if (this.mode === 'chord') {
      this._stepChordVisualizer(isSilent);
    }

    if (this.mode === 'wave') {
      const trigIdx = this.findWaveAnchor(now);
      const snap = new Float32Array(128);
      const span = Math.min(512, this.timeData.length - trigIdx);
      for (let i = 0; i < 128; i++) {
        const idx = trigIdx + Math.floor((i / 127) * (span - 1));
        snap[i] = this.timeData[idx] || 0;
      }
      this.waveHistory.unshift(snap);
      if (this.waveHistory.length > this.waveMaxEchoes) this.waveHistory.pop();
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
      } else if (this.mode === 'sculpt') {
        this.drawSculpture(ctx, w, h, isCompact);
      } else if (this.mode === 'chord') {
        this.drawChordVisualizer(key, ctx, w, h, isCompact);
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

    // Topbar-Scope direkt im kompakten Modus rendern; bei offenem Haupt-Panel gedrosselt (halbe FPS)
    if (this.isCanvasVisible(topbarEntry)) {
      this.topbarFrameSkip = (this.topbarFrameSkip + 1) & 1;
      if (!primaryRenderedCanvas || this.topbarFrameSkip === 0) {
        renderEntry(topbarEntry);
      }
    }

    const chordDone = this.mode !== 'chord' || (
      this.chordVisualAlpha <= 0.005
      && this.chordRingWaves.length === 0
      && this.chordGhosts.length === 0
      && this.chordSparks.length === 0
    );
    if (isSilent && this.silentFrames > 45 && chordDone) {
      this.idleDrawn = true;
    }
  }

  /** Stabilisierter Anker für WAVE: Nulldurchgang mit maximaler Steigung oder Kick-Einsatz im Beat */
  findWaveAnchor(now = 0) {
    const d = this.timeData;
    const len = d.length;
    const searchLimit = Math.floor(len * 0.55);

    // Beat-Modus: kurz nach einem Kick auf den Transienten-Einsatz verankern
    if (now - this.lastKickTriggerAt < 220) {
      let peakIdx = 0;
      let peakVal = 0;
      for (let i = 4; i < searchLimit; i++) {
        const a = Math.abs(d[i]);
        if (a > peakVal) {
          peakVal = a;
          peakIdx = i;
        }
      }
      const start = Math.max(0, peakIdx - 24);
      for (let i = start; i > 2; i--) {
        if (d[i - 1] < 0 && d[i] >= 0) return i;
      }
      return start;
    }

    // Periodisches Signal: tiefpassgeglätteter steigender Nulldurchgang mit höchster Steigung
    let bestIdx = 0;
    let bestSlope = 0;
    let prev = (d[0] + d[1] + d[2] + d[3]) * 0.25;
    for (let i = 4; i < searchLimit; i++) {
      const cur = (d[i] + d[i - 1] + d[i - 2] + d[i - 3]) * 0.25;
      if (prev < 0 && cur >= 0) {
        const slope = cur - prev;
        if (slope > bestSlope) {
          bestSlope = slope;
          bestIdx = i;
        }
      }
      prev = cur;
    }
    return bestIdx;
  }

  captureXySnapshot() {
    const count = 160;
    const pts = new Float32Array(count * 2);
    const isStereo = this.xySubMode === 'stereo' && this.analyserL && this.analyserR;
    const len = isStereo ? this.timeL.length : this.timeData.length;
    const stride = Math.max(1, Math.floor((len - 24) / count));

    if (isStereo) {
      let lpL = 0;
      let lpR = 0;
      for (let i = 0; i < count; i++) {
        const idx = Math.min(len - 1, i * stride);
        lpL += 0.35 * (this.timeL[idx] - lpL);
        lpR += 0.35 * (this.timeR[idx] - lpR);
        pts[i * 2] = (lpL - lpR) * 0.707;
        pts[i * 2 + 1] = -(lpL + lpR) * 0.707;
      }
    } else {
      // Orbit-Modus: melodiöses Bandpass-Signal gegen eine leicht verzögerte Kopie (Phase-Space Loop)
      const delay = 18;
      let hp = 0;
      let lp = 0;
      let lastX = 0;
      const ring = new Float32Array(len);
      for (let k = 0; k < Math.min(len, count * stride + delay + 4); k++) {
        const x = this.timeData[k] || 0;
        hp = 0.94 * (hp + x - lastX);
        lastX = x;
        lp += 0.32 * (hp - lp);
        ring[k] = lp;
      }
      for (let i = 0; i < count; i++) {
        const idx = delay + i * stride;
        pts[i * 2] = (ring[idx] || 0) * 1.35;
        pts[i * 2 + 1] = (ring[idx - delay] || 0) * 1.35;
      }
    }

    this.xyHistory.unshift(pts);
    if (this.xyHistory.length > this.xyMaxHistory) this.xyHistory.pop();
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

  drawWave(_key, ctx, w, h, isCompact) {
    ctx.fillStyle = '#05080f';
    ctx.fillRect(0, 0, w, h);
    this.drawSubGrid(ctx, w, h, isCompact);

    const midY = h * 0.5;
    const amp = h * (isCompact ? 0.42 : 0.37);

    // Ältere Durchläufe als sehr dünne, dunkle Konturen dahinterlegen
    const echoCount = isCompact ? 2 : this.waveHistory.length;
    for (let e = echoCount - 1; e >= 1; e--) {
      const hist = this.waveHistory[e];
      if (!hist) continue;
      const dy = -e * (isCompact ? 1.0 : 3.2);
      const alpha = Math.max(0.08, 0.24 - e * 0.05);
      ctx.beginPath();
      for (let i = 0; i < hist.length; i++) {
        const x = (i / (hist.length - 1)) * w;
        const y = midY + hist[i] * amp * (1 - e * 0.04) + dy;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(100, 116, 139, ${alpha.toFixed(3)})`;
      ctx.lineWidth = 0.75;
      ctx.stroke();
    }

    // Eine scharfe Hauptlinie
    const front = this.waveHistory[0];
    if (!front) return;
    ctx.beginPath();
    for (let i = 0; i < front.length; i++) {
      const x = (i / (front.length - 1)) * w;
      const y = midY + front[i] * amp;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = isCompact ? 2.4 : 3.2;
    ctx.stroke();
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = isCompact ? 1.3 : 1.85;
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

  drawXyTraces(ctx, cx, cy, scale, isCompact) {
    const traces = this.xyHistory;
    if (!traces.length) return;

    // 1. Frühere Ausschnitte dunkler eine Ebene dahinter zeichnen
    for (let e = traces.length - 1; e >= 1; e--) {
      const pts = traces[e];
      const planeScale = scale * (1 - e * 0.075);
      const dx = -e * (isCompact ? 1.4 : 4.5);
      const dy = -e * (isCompact ? 1.0 : 3.0);
      const alpha = Math.max(0.10, 0.36 - e * 0.08);
      ctx.beginPath();
      for (let i = 0; i < pts.length; i += 2) {
        const px = cx + dx + pts[i] * planeScale;
        const py = cy + dy + pts[i + 1] * planeScale;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = `rgba(56, 189, 248, ${alpha.toFixed(3)})`;
      ctx.lineWidth = isCompact ? 0.75 : 1.05;
      ctx.stroke();
    }

    // 2. Helle Vorderkante als durchgehende Spur
    const front = traces[0];
    ctx.beginPath();
    for (let i = 0; i < front.length; i += 2) {
      const px = cx + front[i] * scale;
      const py = cy + front[i + 1] * scale;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.42)';
    ctx.lineWidth = isCompact ? 2.2 : 3.4;
    ctx.stroke();
    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = isCompact ? 1.2 : 1.85;
    ctx.stroke();
  }

  drawXy(ctx, w, h, isCompact) {
    ctx.fillStyle = '#05080f';
    ctx.fillRect(0, 0, w, h);

    const cx = w * 0.5;
    const cy = h * 0.5;
    const scale = Math.min(w, h) * 0.44;

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, 0); ctx.lineTo(cx, h);
    ctx.moveTo(0, cy); ctx.lineTo(w, cy);
    if (!isCompact) ctx.arc(cx, cy, scale * 0.72, 0, Math.PI * 2);
    ctx.stroke();

    this.drawXyTraces(ctx, cx, cy, scale, isCompact);

    if (!isCompact && w >= 200) {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.65)';
      ctx.font = '600 9px ui-monospace, monospace';
      ctx.fillText(this.xySubMode === 'stereo' ? 'XY · STEREO (L/R)' : 'XY · ORBIT', 10, h - 10);
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

  _ringBandColor(bandFrac, alpha = 1) {
    // Tiefes Violett -> kühles Blau -> Eisweiß -> Bernstein
    if (bandFrac < 0.28) return `rgba(139, 92, 246, ${alpha})`;
    if (bandFrac < 0.56) return `rgba(56, 189, 248, ${alpha})`;
    if (bandFrac < 0.80) return `rgba(224, 242, 254, ${alpha})`;
    return `rgba(245, 158, 11, ${alpha})`;
  }

  /** Schwebender gekippter 3D-Polarspektrogramm-Ring (Spuren der letzten ~4 Takte mit Höhenlinien) */
  drawRadial(ctx, w, h, isCompact) {
    ctx.fillStyle = '#04060b';
    ctx.fillRect(0, 0, w, h);

    this.ringCamDip += (this.ringCamDipTarget - this.ringCamDip) * 0.06;
    this.ringCamDipTarget *= 0.992;

    const showInset = this.radialShowXyInset && !isCompact && w >= 280;
    const cx = showInset ? w * 0.62 : w * 0.5;
    const cy = h * (0.52 + this.ringCamDip * 0.05);
    const maxR = Math.min(showInset ? w * 0.58 : w, h) * (0.45 + this.ringCamDip * 0.14);

    // Falls Motiv-Rückkehr aktiv: XY-Orbit-Nahaufnahme neben dem Ring zeichnen
    if (showInset) {
      const ix = w * 0.21;
      const iy = h * 0.52;
      const ir = Math.min(w * 0.16, h * 0.34);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(ix, iy, ir, 0, Math.PI * 2);
      ctx.stroke();
      this.drawXyTraces(ctx, ix, iy, ir * 0.9, false);
    }

    const S = isCompact ? 48 : this.ringSlices;
    const sliceStep = this.ringSlices / S;
    const B = isCompact ? 8 : this.ringBands;
    const rMin = maxR * 0.26;
    const rMax = maxR * 0.96;
    const tiltY = 0.54 - this.ringCamDip * 0.22; // flacher bei Nah-Anflug -> Grate stehen plastisch hoch
    const elevScale = maxR * (0.30 + this.ringCamDip * 0.18);
    const seamAngle = 0.42;

    const projCs = (cosA, sinA, bandIdx, energy) => {
      const frac = bandIdx / (B - 1);
      const radius = rMin + frac * (rMax - rMin);
      const px = cosA * radius;
      const py = sinA * radius * tiltY;
      const z = energy * elevScale;
      return { x: cx + px, y: cy + py - z };
    };

    // Sektoren + Trig einmal pro Frame berechnen und nach Tiefe sortieren (hinten nach vorne)
    const sliceTrig = new Array(S);
    const sectors = new Array(S);
    for (let i = 0; i < S; i++) {
      const a0 = seamAngle - (i / S) * Math.PI * 2;
      const c0 = Math.cos(a0);
      const s0 = Math.sin(a0);
      sliceTrig[i] = { c: c0, s: s0 };
    }
    for (let i = 0; i < S; i++) {
      const sIdx = (this.ringCursor - Math.round(i * sliceStep) + this.ringSlices * 2) % this.ringSlices;
      const nextIdx = (this.ringCursor - Math.round((i + 1) * sliceStep) + this.ringSlices * 2) % this.ringSlices;
      const nextS = (i + 1) % S;
      const t0 = sliceTrig[i];
      const t1 = sliceTrig[nextS];
      const aMid = seamAngle - ((i + 0.5) / S) * Math.PI * 2;
      sectors[i] = {
        i, sIdx, nextIdx,
        c0: t0.c, s0: t0.s,
        c1: t1.c, s1: t1.s,
        a0: seamAngle - (i / S) * Math.PI * 2,
        depth: Math.sin(aMid),
      };
    }
    sectors.sort((u, v) => u.depth - v.depth);

    // 1. Matte dunkle Oberfläche mit seitlicher Lichtschattierung
    for (const sec of sectors) {
      const slA = this.ringGrid[sec.sIdx];
      const slB = this.ringGrid[sec.nextIdx];
      for (let b = 0; b < B - 1; b++) {
        const e00 = slA[b];
        const e10 = slB[b];
        const e11 = slB[b + 1];
        const e01 = slA[b + 1];
        const avgE = (e00 + e10 + e11 + e01) * 0.25;
        const slope = (e00 - e10) + (e00 - e01) * 0.5;
        const sideLight = Math.max(-0.3, Math.min(0.8, Math.cos(sec.a0 + 0.6) * 0.4 + slope * 1.4));

        const p00 = projCs(sec.c0, sec.s0, b, e00);
        const p10 = projCs(sec.c1, sec.s1, b, e10);
        const p11 = projCs(sec.c1, sec.s1, b + 1, e11);
        const p01 = projCs(sec.c0, sec.s0, b + 1, e01);

        const shade = Math.round(11 + Math.max(0, sideLight) * 26 + avgE * 28);
        const blue = Math.round(20 + Math.max(0, sideLight) * 44 + avgE * 52);
        ctx.beginPath();
        ctx.moveTo(p00.x, p00.y);
        ctx.lineTo(p10.x, p10.y);
        ctx.lineTo(p11.x, p11.y);
        ctx.lineTo(p01.x, p01.y);
        ctx.closePath();
        ctx.fillStyle = `rgba(${shade}, ${Math.round(shade * 1.15)}, ${blue}, 0.94)`;
        ctx.fill();

        // Radiale Takt-/Zeitrippe dezent einzeichnen
        if (!isCompact && sec.i % 4 === 0 && b === B - 2) {
          ctx.beginPath();
          const pInner = projCs(sec.c0, sec.s0, 0, slA[0]);
          ctx.moveTo(pInner.x, pInner.y);
          ctx.lineTo(p01.x, p01.y);
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
    }

    // 2. Dünne leuchtende Höhenlinien (Frequenz-Ringe: Violett -> Blau -> Eisweiß -> Bernstein)
    for (let b = 0; b < B; b++) {
      const frac = b / (B - 1);
      ctx.beginPath();
      for (let i = 0; i <= S; i++) {
        const sMod = i % S;
        const idx = (this.ringCursor - Math.round(sMod * sliceStep) + this.ringSlices * 2) % this.ringSlices;
        const trig = sliceTrig[sMod];
        const p = projCs(trig.c, trig.s, b, this.ringGrid[idx][b]);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = this._ringBandColor(frac, isCompact ? 0.65 : 0.72);
      ctx.lineWidth = isCompact ? 0.85 : 1.05;
      ctx.stroke();
    }

    // 3. Sichtbare Nahtstelle (aktueller Moment)
    const curSlice = this.ringGrid[this.ringCursor];
    const cSeam = sliceTrig[0].c;
    const sSeam = sliceTrig[0].s;
    ctx.beginPath();
    for (let b = 0; b < B; b++) {
      const p = projCs(cSeam, sSeam, b, curSlice[b]);
      if (b === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.9)';
    ctx.lineWidth = isCompact ? 1.4 : 2.0;
    ctx.stroke();
  }

  // ───────────────────────────────────────────── 12-PUNKTE LICHTSKULPTUR ──
  initSculpture() {
    this.sculptNodes = Array.from({ length: 12 }, (_, i) => {
      const ring = i % 2 === 0 ? 0.72 : 0.42;
      const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
      const zBase = ((i * 5) % 12 - 5.5) / 5.5;
      return {
        id: i,
        x: Math.cos(angle) * ring,
        y: Math.sin(angle) * ring,
        z: zBase * 0.75,
        wing: i < 6 ? -1 : 1,
        glow: 0,
      };
    });
    this.resetSculpture();
  }

  resetSculpture() {
    this.sculptLastNode = 0;
    this.sculptEdges = new Map();
    this.sculptFaces = new Map();
    this.sculptPulses = [];
    this.sculptPhase = 'build'; // 'build' (Aufbau) | 'open' (Öffnung) | 'return' (Rückkehr)
    this.sculptCamYaw = 0;
    this.sculptCamPitch = 0;
    this.sculptDepthReveal = 0.06;
    this.sculptFoldAngle = 0;
    this.sculptFoldTarget = 0;
    this.sculptFoldVel = 0;
    this.sculptLayerCursor = 0;
    this.lastAudioNote = -1;
    this.lastAudioNoteAt = 0;
    this.lastBassHitAt = 0;
    this.lastHatHitAt = 0;
    this.prevBassBand = 0;
    this.prevAirBand = 0;
    if (this.sculptNodes) {
      this.sculptNodes.forEach((n) => { n.glow = 0; });
    }
  }

  setSculptPhase(phase) {
    if (!['build', 'open', 'return'].includes(phase)) return;
    this.sculptPhase = phase;
    if (phase === 'return') {
      for (const edge of this.sculptEdges.values()) {
        if (!edge.isMotif) edge.alpha *= 0.18;
      }
      for (const face of this.sculptFaces.values()) {
        if (!face.isMotif) face.alpha *= 0.22;
      }
    } else if (phase === 'build') {
      this.sculptFoldTarget = 0.05;
    } else if (phase === 'open') {
      this.sculptFoldTarget = Math.max(0.55, this.sculptFoldTarget + 0.3);
    }
    this.idleDrawn = false;
    this.silentFrames = 0;
  }

  pushMusicalEvent(ev) {
    if (!ev || !this.sculptNodes) return;
    const ctxState = this.analyser?.context?.state;
    if (ctxState && ctxState !== 'running') return;
    this.idleDrawn = false;
    this.silentFrames = 0;

    // Live-Noten und Akkorde an den CHORD Voice-Leading Visualizer weiterleiten
    if (this.chordVoices) {
      const audioTime = this.getAudioTime();
      if (ev.kind === 'chord' && Array.isArray(ev.midi) && ev.midi.length >= 2) {
        this.lastLiveChordAt = audioTime;
        this.lastAutoChordSig = `ev:${ev.fromModuleId || ''}:${ev.midi.map((m) => Math.round(m)).join(',')}`;
        this.triggerChordChange(ev.midi, audioTime);
      } else if (ev.kind === 'note' && ev.fromPortId !== 'rootOut') {
        const midi = Array.isArray(ev.midi) ? ev.midi[0] : ev.midi;
        if (Number.isFinite(midi)) {
          this.lastLiveChordAt = audioTime;
          this.lastAutoChordSig = `ev:${ev.fromModuleId || ''}:note:${Math.round(midi)}`;
          this.triggerArpVoiceNote(midi, audioTime);
        }
      }
    }

    if (ev.kind === 'note') {
      const midi = Array.isArray(ev.midi) ? ev.midi[0] : ev.midi;
      if (!Number.isFinite(midi)) return;
      const target = ((Math.round(midi) % 12) + 12) % 12;
      this._addSculptJump(this.sculptLastNode, target, false);
      this.sculptLastNode = target;
    } else if (ev.kind === 'chord' && Array.isArray(ev.midi)) {
      const unique = [...new Set(
        ev.midi.filter((n) => Number.isFinite(n)).map((n) => ((Math.round(n) % 12) + 12) % 12),
      )];
      if (!unique.length) return;
      this.sculptLayerCursor = (this.sculptLayerCursor + 1) % 4;
      if (unique.length === 1) {
        this._addSculptJump(this.sculptLastNode, unique[0], true);
        this.sculptLastNode = unique[0];
        return;
      }
      for (let i = 0; i < unique.length; i++) {
        const a = unique[i];
        const b = unique[(i + 1) % unique.length];
        this._addSculptJump(a, b, true);
      }
      if (unique.length >= 3) {
        for (let i = 1; i + 1 < unique.length; i++) {
          this._registerSculptFace(unique[0], unique[i], unique[i + 1], this.sculptLayerCursor);
        }
      }
      this.sculptLastNode = unique[unique.length - 1];
    } else if (ev.kind === 'trigger') {
      if (ev.subKind === 'kick') this._triggerSculptKick();
      else if (ev.subKind === 'hat') this._triggerSculptHatSpark();
    }
  }

  _addSculptJump(from, to, isChordPart = false) {
    const a = from === to ? (to + 7) % 12 : from;
    const b = to;
    if (this.sculptNodes[b]) this.sculptNodes[b].glow = 1.0;
    if (this.sculptNodes[a]) this.sculptNodes[a].glow = Math.max(this.sculptNodes[a].glow, 0.55);

    const minId = Math.min(a, b);
    const maxId = Math.max(a, b);
    const key = `${minId}-${maxId}`;
    const existing = this.sculptEdges.get(key);
    const layer = existing ? existing.layer : this.sculptLayerCursor;
    const isMotif = existing ? existing.isMotif : (this.sculptEdges.size < 6);

    this.sculptEdges.set(key, {
      a: minId,
      b: maxId,
      alpha: 1.0,
      isMotif,
      layer,
      createdAt: performance.now(),
    });

    if (this.sculptEdges.size > 28) {
      for (const [ek, edge] of this.sculptEdges.entries()) {
        if (!edge.isMotif) {
          this.sculptEdges.delete(ek);
          if (this.sculptEdges.size <= 24) break;
        }
      }
    }

    this.sculptPulses.push({
      from: a,
      to: b,
      progress: 0,
      speed: isChordPart ? 0.075 : 0.09,
      isSpark: false,
      layer,
    });
    if (this.sculptPulses.length > 36) this.sculptPulses.shift();

    this._checkTrianglesForEdge(minId, maxId, layer);
  }

  _checkTrianglesForEdge(a, b, layer) {
    for (let c = 0; c < 12; c++) {
      if (c === a || c === b) continue;
      const e1 = this.sculptEdges.get(`${Math.min(a, c)}-${Math.max(a, c)}`);
      const e2 = this.sculptEdges.get(`${Math.min(b, c)}-${Math.max(b, c)}`);
      if (e1 && e2 && e1.alpha > 0.15 && e2.alpha > 0.15) {
        this._registerSculptFace(a, b, c, layer);
      }
    }
  }

  _registerSculptFace(n1, n2, n3, layer) {
    const tri = [n1, n2, n3].sort((x, y) => x - y);
    if (tri[0] === tri[1] || tri[1] === tri[2]) return;
    const key = tri.join('-');
    const existing = this.sculptFaces.get(key);
    const isMotif = existing ? existing.isMotif : (this.sculptFaces.size < 2);
    const avgWing = (this.sculptNodes[tri[0]].wing + this.sculptNodes[tri[1]].wing + this.sculptNodes[tri[2]].wing) >= 0 ? 1 : -1;

    this.sculptFaces.set(key, {
      a: tri[0],
      b: tri[1],
      c: tri[2],
      alpha: existing ? Math.max(existing.alpha, 0.36) : 0.42,
      flash: 1.0,
      isMotif,
      layer,
      foldSide: avgWing,
      tilt: ((tri[0] + tri[1] + tri[2]) % 5) * 0.08,
    });

    if (this.sculptFaces.size > 14) {
      for (const [fk, face] of this.sculptFaces.entries()) {
        if (!face.isMotif) {
          this.sculptFaces.delete(fk);
          if (this.sculptFaces.size <= 12) break;
        }
      }
    }
  }

  _triggerSculptKick() {
    this.sculptFoldTarget = Math.min(1.25, this.sculptFoldTarget + 0.22);
    this.sculptFoldVel = (this.sculptFoldVel || 0) + 0.045;
    if (this.sculptPhase === 'build' && this.sculptFaces.size >= 1 && this.sculptEdges.size >= 4) {
      this.sculptPhase = 'open';
    } else if (this.sculptPhase === 'return') {
      this.sculptPhase = 'open';
    }
  }

  _triggerSculptHatSpark() {
    let count = 0;
    for (const edge of this.sculptEdges.values()) {
      if (edge.alpha < 0.2) continue;
      this.sculptPulses.push({
        from: count % 2 === 0 ? edge.a : edge.b,
        to: count % 2 === 0 ? edge.b : edge.a,
        progress: 0,
        speed: 0.18,
        isSpark: true,
        layer: edge.layer || 0,
      });
      count++;
      if (count >= 2) break;
    }
    if (this.sculptPulses.length > 40) this.sculptPulses.splice(0, this.sculptPulses.length - 40);
  }

  updateSculpture(now, isSilent, pitchHz) {
    // 1. Live Audio Fallback (wenn Patch keine expliziten Pitch/Gate-Kabel routet)
    if (!isSilent && pitchHz > 30) {
      const midi = Math.round(69 + 12 * Math.log2(pitchHz / 440));
      const pc = ((midi % 12) + 12) % 12;
      if (pc !== this.lastAudioNote && now - this.lastAudioNoteAt > 170) {
        this._addSculptJump(this.sculptLastNode, pc, false);
        this.sculptLastNode = pc;
        this.lastAudioNote = pc;
        this.lastAudioNoteAt = now;
      }
    }

    const bass = this.bands[0] || 0;
    const air = this.bands[3] || 0;
    if (bass - this.prevBassBand > 0.14 && bass > 0.36 && now - this.lastBassHitAt > 210) {
      this._triggerSculptKick();
      this.lastBassHitAt = now;
    }
    if (air - this.prevAirBand > 0.10 && air > 0.22 && now - this.lastHatHitAt > 110) {
      this._triggerSculptHatSpark();
      this.lastHatHitAt = now;
    }
    this.prevBassBand = bass;
    this.prevAirBand = air;

    // 2. Break-Erkennung bei Stille / Energieabfall
    if (this.sculptPhase === 'open' && isSilent && this.silentFrames === 25 && this.sculptEdges.size >= 5) {
      this.setSculptPhase('return');
    }

    // 3. Kamera, Tiefenstaffelung & Klapplogik animieren
    const targetReveal = this.sculptPhase === 'build' ? 0.08 : 1.0;
    this.sculptDepthReveal += (targetReveal - this.sculptDepthReveal) * 0.05;

    if (this.sculptPhase === 'build') {
      this.sculptCamYaw += (0 - this.sculptCamYaw) * 0.06;
      this.sculptCamPitch += (0 - this.sculptCamPitch) * 0.06;
    } else {
      this.sculptCamYaw += this.sculptPhase === 'open' ? 0.012 : 0.006;
      this.sculptCamPitch = Math.sin(this.sculptCamYaw * 0.5) * 0.24;
    }

    this.sculptFoldTarget *= 0.96;
    this.sculptFoldVel = (this.sculptFoldVel || 0) * 0.85;
    this.sculptFoldAngle += (this.sculptFoldTarget + this.sculptFoldVel - this.sculptFoldAngle) * 0.16;

    // 4. Knoten, Linien, Flächen & Impulse fortschreiben
    for (const n of this.sculptNodes) {
      n.glow *= 0.86;
    }
    for (const [k, edge] of this.sculptEdges.entries()) {
      const decay = this.sculptPhase === 'return' && !edge.isMotif ? 0.94 : 0.992;
      edge.alpha *= decay;
      const floor = edge.isMotif ? 0.28 : 0.08;
      if (edge.alpha < floor) edge.alpha = edge.isMotif ? floor : Math.max(0.05, edge.alpha);
      if (!edge.isMotif && this.sculptPhase === 'return' && edge.alpha <= 0.055) {
        this.sculptEdges.delete(k);
      }
    }
    for (const [k, face] of this.sculptFaces.entries()) {
      face.flash *= 0.88;
      if (this.sculptPhase === 'return' && !face.isMotif) {
        face.alpha *= 0.93;
        if (face.alpha < 0.02) this.sculptFaces.delete(k);
      } else {
        face.alpha = Math.max(face.isMotif ? 0.14 : 0.08, face.alpha * 0.995);
      }
    }
    for (let i = this.sculptPulses.length - 1; i >= 0; i--) {
      const p = this.sculptPulses[i];
      p.progress += p.speed;
      if (p.progress >= 1) this.sculptPulses.splice(i, 1);
    }
  }

  _projectSculptNode(node, layer = 0, w = 320, h = 190) {
    const reveal = this.sculptDepthReveal;
    const layerOffset = (layer - 1.2) * 0.28 * reveal;
    let x = node.x;
    let y = node.y;
    let z = (node.z + layerOffset) * reveal;

    // Klappen entlang einer zentralen Faltkante (x-Achse / Scharnier) bei Kick/Bass
    if (this.sculptFoldAngle > 0.001) {
      const bend = this.sculptFoldAngle * node.wing * 0.85;
      const cosB = Math.cos(bend);
      const sinB = Math.sin(bend);
      const nx = x * cosB - z * sinB;
      const nz = x * sinB + z * cosB;
      x = nx;
      z = nz;
    }

    // Kamera-Rotation (seitliches Vorbeifahren bei Öffnung)
    const cosY = Math.cos(this.sculptCamYaw);
    const sinY = Math.sin(this.sculptCamYaw);
    const rx = x * cosY - z * sinY;
    const rz1 = x * sinY + z * cosY;

    const cosP = Math.cos(this.sculptCamPitch);
    const sinP = Math.sin(this.sculptCamPitch);
    const ry = y * cosP - rz1 * sinP;
    const rz = y * sinP + rz1 * cosP;

    const perspective = 2.6 / (2.6 + rz * 0.75);
    const scale = Math.min(w, h) * 0.43 * perspective;
    return {
      sx: w * 0.5 + rx * scale,
      sy: h * 0.5 + ry * scale,
      depth: rz,
    };
  }

  drawSculpture(ctx, w, h, isCompact) {
    ctx.fillStyle = '#030508';
    ctx.fillRect(0, 0, w, h);

    // 1. Geschlossene Dreiecksflächen im einzigen kühlen Blau (#38bdf8)
    for (const face of this.sculptFaces.values()) {
      const pA = this._projectSculptNode(this.sculptNodes[face.a], face.layer, w, h);
      const pB = this._projectSculptNode(this.sculptNodes[face.b], face.layer, w, h);
      const pC = this._projectSculptNode(this.sculptNodes[face.c], face.layer, w, h);
      const fillAlpha = Math.min(0.48, face.alpha * 0.45 + face.flash * 0.34);

      ctx.beginPath();
      ctx.moveTo(pA.sx, pA.sy);
      ctx.lineTo(pB.sx, pB.sy);
      ctx.lineTo(pC.sx, pC.sy);
      ctx.closePath();
      ctx.fillStyle = `rgba(56, 189, 248, ${fillAlpha.toFixed(3)})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(56, 189, 248, ${Math.min(0.7, fillAlpha * 1.4).toFixed(3)})`;
      ctx.lineWidth = isCompact ? 0.6 : 0.9;
      ctx.stroke();
    }

    // 2. Dünne weiße Kanten (alte Linien bleiben schwach sichtbar)
    for (const edge of this.sculptEdges.values()) {
      const pA = this._projectSculptNode(this.sculptNodes[edge.a], edge.layer, w, h);
      const pB = this._projectSculptNode(this.sculptNodes[edge.b], edge.layer, w, h);
      ctx.beginPath();
      ctx.moveTo(pA.sx, pA.sy);
      ctx.lineTo(pB.sx, pB.sy);
      ctx.strokeStyle = `rgba(248, 250, 252, ${Math.min(0.9, edge.alpha * 0.62).toFixed(3)})`;
      ctx.lineWidth = edge.isMotif ? (isCompact ? 0.9 : 1.25) : (isCompact ? 0.65 : 0.95);
      ctx.stroke();
    }

    // 3. Laufende Lichtimpulse & Hi-Hat-Kantenfunken
    for (const p of this.sculptPulses) {
      const pA = this._projectSculptNode(this.sculptNodes[p.from], p.layer, w, h);
      const pB = this._projectSculptNode(this.sculptNodes[p.to], p.layer, w, h);
      const tHead = p.progress;
      const tTail = Math.max(0, tHead - (p.isSpark ? 0.25 : 0.35));
      const hx = pA.sx + (pB.sx - pA.sx) * tHead;
      const hy = pA.sy + (pB.sy - pA.sy) * tHead;
      const tx = pA.sx + (pB.sx - pA.sx) * tTail;
      const ty = pA.sy + (pB.sy - pA.sy) * tTail;

      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(hx, hy);
      ctx.strokeStyle = p.isSpark ? 'rgba(224, 242, 254, 0.95)' : 'rgba(255, 255, 255, 0.95)';
      ctx.lineWidth = p.isSpark ? (isCompact ? 1.0 : 1.5) : (isCompact ? 1.3 : 2.1);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(hx, hy, p.isSpark ? (isCompact ? 1.2 : 1.9) : (isCompact ? 1.6 : 2.6), 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }

    // 4. Die 12 matten Raumpunkte
    for (let i = 0; i < this.sculptNodes.length; i++) {
      const node = this.sculptNodes[i];
      const pt = this._projectSculptNode(node, 0, w, h);
      const g = node.glow;
      const r = (isCompact ? 1.4 : 2.5) + g * (isCompact ? 1.1 : 2.2);
      ctx.beginPath();
      ctx.arc(pt.sx, pt.sy, r, 0, Math.PI * 2);
      ctx.fillStyle = g > 0.15
        ? `rgba(255, 255, 255, ${(0.45 + g * 0.55).toFixed(3)})`
        : 'rgba(148, 163, 184, 0.42)';
      ctx.fill();

      if (!isCompact && w >= 240 && g > 0.2) {
        ctx.fillStyle = `rgba(186, 230, 253, ${(g * 0.75).toFixed(2)})`;
        ctx.font = '600 9px ui-monospace, monospace';
        ctx.fillText(NOTE_NAMES[i], pt.sx + 5, pt.sy - 4);
      }
    }

    // 5. Dezente Dramaturgie-Anzeige (Aufbau / Öffnung / Rückkehr)
    if (!isCompact && w >= 220) {
      const phaseLabel = this.sculptPhase === 'open'
        ? 'II · ÖFFNUNG'
        : (this.sculptPhase === 'return' ? 'III · RÜCKKEHR' : 'I · AUFBAU');
      ctx.fillStyle = 'rgba(148, 163, 184, 0.55)';
      ctx.font = '600 9px ui-monospace, monospace';
      ctx.fillText(phaseLabel, 10, h - 10);
    }
  }

  // ───────────────────────────────────────────── 3D CHORD VOICE-LEADING VISUALIZER ──
  getAudioTime() {
    const perfT = performance.now() * 0.001;
    const ctx = this.analyser?.context;
    if (ctx && ctx.state === 'running' && Number.isFinite(ctx.currentTime)) {
      if (this._audioTimeOffset === undefined) {
        this._audioTimeOffset = perfT - ctx.currentTime;
      }
      return ctx.currentTime + this._audioTimeOffset;
    }
    this._audioTimeOffset = undefined;
    return perfT;
  }

  initChordVisualizer() {
    this.showChordLabels = true;
    const nowT = this.getAudioTime();
    const initNotes = [48, 55, 60, 64];
    // Feste Anker in der Grundebene + feste Stimmfarben (keine Umsortierung bei Wechsel!)
    const voiceSpecs = [
      { id: 0, color: '#2dd4bf', angle: -2.35, radius: 0.68 }, // Bass: Türkis
      { id: 1, color: '#c084fc', angle: -0.82, radius: 0.72 }, // Stimme 2: Lavendel
      { id: 2, color: '#fbbf24', angle: 0.78, radius: 0.72 },  // Stimme 3: Warmes Amber
      { id: 3, color: '#fde68a', angle: 2.30, radius: 0.68 },  // Stimme 4: Warmes Hellgold
    ];
    this.chordVoices = voiceSpecs.map((spec, idx) => ({
      ...spec,
      ax: Math.cos(spec.angle) * spec.radius,
      az: Math.sin(spec.angle) * spec.radius,
      fromMidi: initNotes[idx],
      toMidi: initNotes[idx],
      currentMidi: initNotes[idx],
      startTime: nowT,
      duration: 0.32,
      moved: false,
      active: false, // Erst aktivieren, wenn tatsächlich echte Audio-/Notendaten klingen
      pulse: 0,
    }));

    const buildCircle = (n) => Array.from({ length: n + 1 }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      return { c: Math.cos(a), s: Math.sin(a) };
    });
    this.chordRingLut56 = buildCircle(56);
    this.chordRingLut36 = buildCircle(36);
    this.chordRadialLut10 = buildCircle(10).slice(0, 10);
    this.chordRadialLut6 = buildCircle(6).slice(0, 6);

    this.chordGhosts = [];
    this.chordRingWaves = [];
    this.chordSparks = [];
    this.chordEdgeDots = [
      { edge: 0, t: 0.08 },
      { edge: 1, t: 0.34 },
      { edge: 2, t: 0.62 },
      { edge: 3, t: 0.86 },
    ];
    this.chordEdgeBoost = 0;
    this.chordVisualAlpha = 0;
    this.chordCamPhase = 0;
    this.lastLiveChordAt = -999;
    this.lastAutoChordSig = '';
    this.arpVoiceCursor = 0;
    this.chordLastFrameAt = nowT;
  }

  _chordEase(tNorm) {
    if (tNorm <= 0) return 0;
    if (tNorm >= 1) return 1;
    return tNorm < 0.5
      ? 4 * tNorm * tNorm * tNorm
      : 1 - Math.pow(-2 * tNorm + 2, 3) / 2;
  }

  triggerChordChange(notes, audioTime = this.getAudioTime()) {
    if (!Array.isArray(notes) || !notes.length || !this.chordVoices) return;

    const isVisibleMode = this.mode === 'chord';
    if (isVisibleMode) {
      // Alte Außenkontur kurz als schwache Linie stehen lassen (Fläche selbst verschwindet sofort)
      const activePts = this.chordVoices
        .filter((v) => v.active)
        .map((v) => ({ ax: v.ax, az: v.az, midi: v.currentMidi }));
      if (activePts.length >= 2) {
        this.chordGhosts.push({ points: activePts, bornAt: audioTime });
        if (this.chordGhosts.length > 3) this.chordGhosts.shift();
      }
    }

    // Feste Stimm-IDs zuordnen (nicht nach Tonhöhe umsortieren!)
    for (let i = 0; i < 4; i++) {
      const v = this.chordVoices[i];
      const raw = notes[i];
      if (!Number.isFinite(raw)) {
        if (notes.length < 4 && i >= notes.length) {
          v.active = false;
        }
        continue;
      }
      const prev = v.active ? v.currentMidi : raw;
      const moved = v.active && Math.abs(raw - prev) > 0.05;
      v.fromMidi = moved ? prev : raw;
      v.toMidi = raw;
      v.currentMidi = v.fromMidi;
      v.startTime = audioTime;
      v.duration = 0.32; // ~250–400 ms Glide
      v.moved = moved;
      v.active = true;
      v.pulse = moved ? 1.0 : 0.25;

      if (moved && isVisibleMode) {
        for (let s = 0; s < 3; s++) {
          const ang = (s / 3) * Math.PI * 2 + audioTime * 3.1 + i;
          this.chordSparks.push({
            voiceIdx: i,
            vx: Math.cos(ang) * 14,
            vy: Math.sin(ang) * 10 - (raw > prev ? 6 : -6),
            bornAt: audioTime,
            life: 0.32,
          });
        }
      }
    }

    if (isVisibleMode) {
      if (this.chordSparks.length > 24) this.chordSparks.splice(0, this.chordSparks.length - 24);
      this.chordRingWaves.push({ bornAt: audioTime, duration: 0.65 });
      if (this.chordRingWaves.length > 4) this.chordRingWaves.shift();
      this.chordEdgeBoost = 1.0;
    }
  }

  triggerArpVoiceNote(midi, audioTime = this.getAudioTime()) {
    if (!Number.isFinite(midi) || !this.chordVoices) return;
    const isFreshArp = audioTime - (this.lastArpNoteAt || -999) > 1.2;
    this.lastArpNoteAt = audioTime;
    if (isFreshArp) {
      this.arpVoiceCursor = 0;
      this.chordVoices.forEach((v, idx) => { v.active = idx === 0; });
    }
    const idx = this.arpVoiceCursor % 4;
    this.arpVoiceCursor = (this.arpVoiceCursor + 1) % 4;
    const v = this.chordVoices[idx];
    const moved = v.active && Math.abs(midi - v.currentMidi) > 0.05;
    v.fromMidi = moved ? v.currentMidi : midi;
    v.toMidi = midi;
    v.currentMidi = v.fromMidi;
    v.startTime = audioTime;
    v.duration = 0.28;
    v.moved = moved;
    v.active = true;
    v.pulse = 0.85;
    if (this.mode === 'chord') {
      this.chordEdgeBoost = Math.max(this.chordEdgeBoost, 0.55);
    }
  }

  _stepChordVisualizer(isSilent) {
    const audioTime = this.getAudioTime();
    const dt = Math.min(0.08, Math.max(0.001, audioTime - (this.chordLastFrameAt || audioTime)));
    this.chordLastFrameAt = audioTime;

    const ctx = this.analyser?.context;
    const ctxRunning = !ctx || ctx.state === 'running';
    const bandSum = this.bands ? (this.bands[0] + this.bands[1] + this.bands[2] + this.bands[3]) : 0;
    const audible = ctxRunning && !isSilent && (this.lastPeak >= 0.00045 || bandSum > 0.015);

    if (!audible) {
      this.chordVisualAlpha = Math.max(0, this.chordVisualAlpha - dt * 3.0);
      this.chordEdgeBoost = Math.max(0, this.chordEdgeBoost - dt * 4.0);
      if (this.chordVisualAlpha <= 0.01) {
        this.chordVisualAlpha = 0;
        this.chordEdgeBoost = 0;
        this.lastAutoChordSig = '';
        this.chordGhosts.length = 0;
        this.chordRingWaves.length = 0;
        this.chordSparks.length = 0;
        for (const v of this.chordVoices) {
          v.active = false;
          v.moved = false;
          v.pulse = 0;
        }
      }
      return;
    }

    this.chordVisualAlpha = Math.min(1, this.chordVisualAlpha + dt * 7.0);
    this.chordCamPhase += dt * 0.42;
    this.chordEdgeBoost = Math.max(0, this.chordEdgeBoost - dt * 1.8);

    // Synchronisation mit tatsächlich klingenden Quellen (falls Standalone gespielt oder später in CHORD gewechselt)
    const hasActiveVoices = this.chordVoices.some((v) => v.active);
    const recentLiveEvent = audioTime - this.lastLiveChordAt < 0.65;
    if (!hasActiveVoices || !recentLiveEvent) {
      const sources = this.engine?.sources || [];
      const cg = sources.find(
        (m) => m?.meta?.type === 'chord_glide'
          && m.enabled
          && m.running !== false
          && (m.values?.level ?? 0.75) > 0.01
          && !m.chMute
          && (m.chLevel === undefined || m.chLevel > 0.01),
      );
      if (cg) {
        const voicing = (Array.isArray(cg.lastTriggeredVoicing) && cg.lastTriggeredVoicing.length)
          ? cg.lastTriggeredVoicing
          : (cg.computedVoicings?.[Number.isInteger(cg.lastTriggeredStepIdx) ? cg.lastTriggeredStepIdx : cg.currentStep] || null);
        if (Array.isArray(voicing) && voicing.length) {
          const notes = voicing.map((m) => Math.round(m));
          const sig = `cg:${cg.id}:${cg.lastTriggeredStepIdx ?? cg.currentStep}:${notes.join(',')}`;
          if (!hasActiveVoices || sig !== this.lastAutoChordSig) {
            this.lastAutoChordSig = sig;
            this.lastLiveChordAt = audioTime;
            this.triggerChordChange(notes, audioTime);
          }
        }
      } else {
        const drone = sources.find(
          (m) => m?.meta?.type === 'drone'
            && m.enabled
            && (m.values?.level ?? 0.7) > 0.01
            && !m.chMute
            && (m.chLevel === undefined || m.chLevel > 0.01),
        );
        if (drone && typeof drone.activeRoot === 'function' && typeof drone.activeIntervals === 'function') {
          const root = drone.activeRoot();
          const iv = drone.activeIntervals(root);
          const activeNotes = [];
          for (let i = 0; i < Math.min(iv.length, drone.voicesOn?.length || 0); i++) {
            if (drone.voicesOn[i]) activeNotes.push(Math.round(root + iv[i]));
          }
          if (activeNotes.length > 0) {
            const notes4 = activeNotes.slice(0, 4);
            const sig = `drone:${drone.id}:${notes4.join(',')}`;
            if (!hasActiveVoices || sig !== this.lastAutoChordSig) {
              this.lastAutoChordSig = sig;
              this.triggerChordChange(notes4, audioTime);
            }
          }
        } else if (!hasActiveVoices && !recentLiveEvent && this.lastPitchHz > 30) {
          const detectedMidi = Math.round(69 + 12 * Math.log2(this.lastPitchHz / 440));
          if (detectedMidi >= 24 && detectedMidi <= 96) {
            this.lastLiveChordAt = audioTime;
            this.triggerArpVoiceNote(detectedMidi, audioTime);
          }
        }
      }
    }

    // Stimmen interpolieren
    for (const v of this.chordVoices) {
      const tNorm = Math.min(1, Math.max(0, (audioTime - v.startTime) / v.duration));
      const ease = this._chordEase(tNorm);
      v.currentMidi = v.fromMidi + (v.toMidi - v.fromMidi) * ease;
      v.pulse = Math.max(0, v.pulse - dt * 2.2);
    }

    // Kanten-Lichtpunkte nur bewegen, wenn Ton hörbar ist
    let activeCount = 0;
    for (const v of this.chordVoices) if (v.active) activeCount++;
    if (activeCount >= 2 && this.chordVisualAlpha > 0.05) {
      const edgeCount = activeCount >= 3 ? activeCount : 1;
      const stepT = dt * (0.28 + this.chordEdgeBoost * 0.55);
      for (const dot of this.chordEdgeDots) {
        dot.t += stepT;
        if (dot.t >= 1) {
          dot.t -= 1;
          dot.edge = (dot.edge + 1) % edgeCount;
        }
      }
    }

    // Abgelaufene Wellen, Geister & Funken aufräumen
    for (let wi = this.chordRingWaves.length - 1; wi >= 0; wi--) {
      if ((audioTime - this.chordRingWaves[wi].bornAt) / this.chordRingWaves[wi].duration >= 1) {
        this.chordRingWaves.splice(wi, 1);
      }
    }
    for (let gi = this.chordGhosts.length - 1; gi >= 0; gi--) {
      if (audioTime - this.chordGhosts[gi].bornAt > 0.45) {
        this.chordGhosts.splice(gi, 1);
      }
    }
    for (let si = this.chordSparks.length - 1; si >= 0; si--) {
      if ((audioTime - this.chordSparks[si].bornAt) / this.chordSparks[si].life >= 1) {
        this.chordSparks.splice(si, 1);
      }
    }
  }

  _projectChordPoint(ax, az, midi, cx, baseY, ringR, tiltY, cosY, sinY, semitonePx, minLift) {
    const rx = ax * cosY - az * sinY;
    const rz = ax * sinY + az * cosY;
    const persp = 2.8 / (2.8 + rz * 0.48);
    const bx = cx + rx * ringR * persp;
    const by = baseY + rz * ringR * tiltY * persp;
    const lift = minLift + (midi - 38) * semitonePx;
    return { bx, by, nx: bx, ny: by - lift * persp, persp, depth: rz };
  }

  drawChordVisualizer(key, ctx, w, h, isCompact) {
    const audioTime = this.getAudioTime();
    const visAlpha = this.chordVisualAlpha;

    // 1. Durchgehender, tief dunkelblauer Hintergrund (gecacht pro Canvas-Höhe)
    ctx.fillStyle = this.getCachedChordBgGradient(key, ctx, h);
    ctx.fillRect(0, 0, w, h);

    // 2. Ruhige schräg-von-oben Perspektive (bewegt sich nur bei hörbarem Ton)
    const camYaw = Math.sin(this.chordCamPhase) * 0.16;
    const cosY = Math.cos(camYaw);
    const sinY = Math.sin(camYaw);
    const cx = w * 0.5;
    const baseY = h * 0.78;
    const ringR = Math.min(w * 0.42, h * 0.48);
    const tiltY = 0.34;
    // Gemeinsame, absolut stabile Tonhöhenskala für alle Stimmen (zentriert sich nie um)
    const semitonePx = (h * 0.50) / 38;
    const minLift = h * 0.11;

    // 3. Schwebender Ring in der unteren Bildhälfte (offenes Zentrum, konzentrische Linien + radiale Verbindungen)
    const ringRadii = [0.38, 0.58, 0.78, 1.0];
    const ringLut = isCompact ? this.chordRingLut36 : this.chordRingLut56;
    const radialLut = isCompact ? this.chordRadialLut6 : this.chordRadialLut10;
    for (let ri = 0; ri < ringRadii.length; ri++) {
      const rf = ringRadii[ri];
      ctx.beginPath();
      for (let s = 0; s < ringLut.length; s++) {
        const cs = ringLut[s];
        const p = this._projectChordPoint(cs.c * rf, cs.s * rf, 38, cx, baseY, ringR, tiltY, cosY, sinY, semitonePx, 0);
        if (s === 0) ctx.moveTo(p.bx, p.by);
        else ctx.lineTo(p.bx, p.by);
      }
      ctx.strokeStyle = `rgba(125, 211, 252, ${ri === 0 ? 0.28 : 0.18})`;
      ctx.lineWidth = isCompact ? 0.7 : 0.9;
      ctx.stroke();
    }

    for (let r = 0; r < radialLut.length; r++) {
      const cs = radialLut[r];
      const pIn = this._projectChordPoint(cs.c * 0.38, cs.s * 0.38, 38, cx, baseY, ringR, tiltY, cosY, sinY, semitonePx, 0);
      const pOut = this._projectChordPoint(cs.c, cs.s, 38, cx, baseY, ringR, tiltY, cosY, sinY, semitonePx, 0);
      ctx.beginPath();
      ctx.moveTo(pIn.bx, pIn.by);
      ctx.lineTo(pOut.bx, pOut.by);
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.12)';
      ctx.lineWidth = 0.75;
      ctx.stroke();
    }

    // Einzelne konzentrische Lichtwelle am Akkordwechsel (innen -> außen)
    for (let wi = 0; wi < this.chordRingWaves.length; wi++) {
      const wave = this.chordRingWaves[wi];
      const u = Math.min(1, Math.max(0, (audioTime - wave.bornAt) / wave.duration));
      const rf = 0.38 + u * 0.62;
      ctx.beginPath();
      for (let s = 0; s < ringLut.length; s++) {
        const cs = ringLut[s];
        const p = this._projectChordPoint(cs.c * rf, cs.s * rf, 38, cx, baseY, ringR, tiltY, cosY, sinY, semitonePx, 0);
        if (s === 0) ctx.moveTo(p.bx, p.by);
        else ctx.lineTo(p.bx, p.by);
      }
      ctx.strokeStyle = `rgba(186, 230, 253, ${((1 - u) * 0.55 * Math.max(0.25, visAlpha)).toFixed(3)})`;
      ctx.lineWidth = isCompact ? 1.1 : 1.6;
      ctx.stroke();
    }

    // Bei Stille ohne Restsichtbarkeit: Ring ruht sauber ohne Phantom-Akkorde
    if (visAlpha <= 0.005) return;

    // 4. Stimmen auf 2D projizieren
    const projected = [];
    for (const v of this.chordVoices) {
      const tNorm = Math.min(1, Math.max(0, (audioTime - v.startTime) / v.duration));
      const cur = this._projectChordPoint(v.ax, v.az, v.currentMidi, cx, baseY, ringR, tiltY, cosY, sinY, semitonePx, minLift);
      const old = this._projectChordPoint(v.ax, v.az, v.fromMidi, cx, baseY, ringR, tiltY, cosY, sinY, semitonePx, minLift);
      projected.push({ v, tNorm, ...cur, oldX: old.nx, oldY: old.ny });
    }

    // 5. Schwache Restkontur der alten Fläche nach Akkordwechsel
    for (let gi = 0; gi < this.chordGhosts.length; gi++) {
      const g = this.chordGhosts[gi];
      const age = Math.max(0, audioTime - g.bornAt);
      const alpha = Math.max(0, (1 - age / 0.45) * 0.28 * visAlpha);
      if (alpha <= 0.005) continue;
      ctx.beginPath();
      g.points.forEach((pt, idx) => {
        const p = this._projectChordPoint(pt.ax, pt.az, pt.midi, cx, baseY, ringR, tiltY, cosY, sinY, semitonePx, minLift);
        if (idx === 0) ctx.moveTo(p.nx, p.ny);
        else ctx.lineTo(p.nx, p.ny);
      });
      ctx.closePath();
      ctx.strokeStyle = `rgba(147, 222, 253, ${alpha.toFixed(3)})`;
      ctx.lineWidth = 0.85;
      ctx.stroke();
    }

    ctx.save();
    if (visAlpha < 0.995) ctx.globalAlpha = visAlpha;

    // 6. Feste Anker in der Grundebene + dünne gedämpfte Verbindungslinien + punktierte Spur für bewegte Stimmen
    for (const item of projected) {
      const { v, bx, by, nx, ny, oldX, oldY, tNorm } = item;
      if (!v.active) continue;

      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(nx, ny);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.24)';
      ctx.lineWidth = 0.85;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(bx, by, isCompact ? 1.5 : 2.3, 0, Math.PI * 2);
      ctx.fillStyle = v.color;
      ctx.globalAlpha = 0.45 * visAlpha;
      ctx.fill();
      ctx.globalAlpha = visAlpha;

      if (v.moved && tNorm < 0.98) {
        ctx.save();
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(oldX, oldY);
        ctx.lineTo(nx, ny);
        ctx.strokeStyle = v.color;
        ctx.globalAlpha = Math.max(0.15, (1 - tNorm * 0.72) * 0.75) * visAlpha;
        ctx.lineWidth = 1.1;
        ctx.stroke();
        ctx.restore();
      }
    }

    // 7. Durchscheinende blaugraue Fläche in fester Stimmreihenfolge + feine Diagonale + scharfe eisblaue Kanten
    const activeNodes = projected.filter((p) => p.v.active);
    if (activeNodes.length >= 3) {
      ctx.beginPath();
      activeNodes.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.nx, p.ny);
        else ctx.lineTo(p.nx, p.ny);
      });
      ctx.closePath();
      ctx.fillStyle = 'rgba(58, 96, 138, 0.22)';
      ctx.fill();

      if (activeNodes.length >= 4) {
        ctx.beginPath();
        ctx.moveTo(activeNodes[0].nx, activeNodes[0].ny);
        ctx.lineTo(activeNodes[2].nx, activeNodes[2].ny);
        ctx.strokeStyle = 'rgba(147, 222, 253, 0.36)';
        ctx.lineWidth = 0.85;
        ctx.stroke();
      }

      ctx.beginPath();
      activeNodes.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.nx, p.ny);
        else ctx.lineTo(p.nx, p.ny);
      });
      ctx.closePath();
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.90)';
      ctx.lineWidth = isCompact ? 1.0 : 1.45;
      ctx.stroke();
    } else if (activeNodes.length === 2) {
      ctx.beginPath();
      ctx.moveTo(activeNodes[0].nx, activeNodes[0].ny);
      ctx.lineTo(activeNodes[1].nx, activeNodes[1].ny);
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.90)';
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }

    // 8. Wandernde Lichtpunkte entlang der Kanten
    if (activeNodes.length >= 2) {
      for (const dot of this.chordEdgeDots) {
        const a = activeNodes[dot.edge % activeNodes.length];
        const b = activeNodes[(dot.edge + 1) % activeNodes.length];
        const px = a.nx + (b.nx - a.nx) * dot.t;
        const py = a.ny + (b.ny - a.ny) * dot.t;
        ctx.beginPath();
        ctx.arc(px, py, isCompact ? 1.1 : 1.6 + this.chordEdgeBoost * 0.9, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(224, 242, 254, ${(0.55 + this.chordEdgeBoost * 0.45).toFixed(3)})`;
        ctx.fill();
      }
    }

    // 9. Feine Funken an bewegten Knoten
    for (let si = 0; si < this.chordSparks.length; si++) {
      const sp = this.chordSparks[si];
      const u = Math.max(0, (audioTime - sp.bornAt) / sp.life);
      if (u >= 1) continue;
      const host = projected[sp.voiceIdx];
      if (!host || !host.v.active) continue;
      ctx.beginPath();
      ctx.arc(host.nx + sp.vx * u, host.ny + sp.vy * u, 1.2, 0, Math.PI * 2);
      ctx.fillStyle = host.v.color;
      ctx.globalAlpha = (1 - u) * 0.8 * visAlpha;
      ctx.fill();
    }
    ctx.globalAlpha = visAlpha;

    // 10. Leuchtende Stimmknoten & dezente Tonlabels (z. B. C3, G3, C4, E4)
    for (const item of projected) {
      const { v, nx, ny } = item;
      if (!v.active) continue;
      const rHalo = (isCompact ? 3.5 : 6.0) + v.pulse * 2.5;
      ctx.beginPath();
      ctx.arc(nx, ny, rHalo, 0, Math.PI * 2);
      ctx.fillStyle = v.color;
      ctx.globalAlpha = (0.22 + v.pulse * 0.18) * visAlpha;
      ctx.fill();
      ctx.globalAlpha = visAlpha;

      ctx.beginPath();
      ctx.arc(nx, ny, isCompact ? 1.8 : 3.0, 0, Math.PI * 2);
      ctx.fillStyle = v.color;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(nx, ny, isCompact ? 0.9 : 1.4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      if (this.showChordLabels && !isCompact && w >= 180) {
        ctx.fillStyle = v.color;
        ctx.font = '600 10px "JetBrains Mono", ui-monospace, monospace';
        ctx.fillText(midiToNoteLabel(v.currentMidi), nx + 7, ny + 3);
      }
    }

    ctx.restore();
  }
}
