// SYNTHBOARD – Client-Side Audio -> Synth Analyzer Modal (BPM, Akkorde root 0..11, Cutoff & Drop-Erkennung)
import { t, onLangChange } from './i18n.js';

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const CHORD_TEMPLATES = {
  maj: [0, 4, 7],
  m: [0, 3, 7],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
};

const NORMALIZED_TEMPLATES = [];
for (let root = 0; root < 12; root++) {
  for (const [type, intervals] of Object.entries(CHORD_TEMPLATES)) {
    const vec = new Float32Array(12);
    for (const iv of intervals) vec[(root + iv) % 12] = 1.0;
    const norm = Math.hypot(...vec);
    for (let i = 0; i < 12; i++) vec[i] /= norm;
    NORMALIZED_TEMPLATES.push({ root, type, label: `${NOTES[root]}${type === 'maj' ? '' : type}`, vec });
  }
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

const yieldUI = () => new Promise((r) => setTimeout(r, 0));

/** Schnelle In-Place Radix-2 FFT */
function fft(real, imag) {
  const n = real.length;
  let j = 0;
  for (let i = 0; i < n; i++) {
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
    let m = n >> 1;
    while (m >= 1 && j >= m) {
      j -= m;
      m >>= 1;
    }
    j += m;
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const angle = (-2 * Math.PI) / len;
    const wStepR = Math.cos(angle);
    const wStepI = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let wr = 1.0;
      let wi = 0.0;
      for (let k = 0; k < half; k++) {
        const idx1 = i + k;
        const idx2 = idx1 + half;
        const tr = wr * real[idx2] - wi * imag[idx2];
        const ti = wr * imag[idx2] + wi * real[idx2];
        real[idx2] = real[idx1] - tr;
        imag[idx2] = imag[idx1] - ti;
        real[idx1] += tr;
        imag[idx1] += ti;
        const nextWr = wr * wStepR - wi * wStepI;
        wi = wr * wStepI + wi * wStepR;
        wr = nextWr;
      }
    }
  }
}

function mixdownAndDownsample(audioBuffer, targetSr = 22050) {
  const numChannels = audioBuffer.numberOfChannels;
  const origSr = audioBuffer.sampleRate;
  const origLen = audioBuffer.length;
  const mono = new Float32Array(origLen);
  for (let ch = 0; ch < numChannels; ch++) {
    const data = audioBuffer.getChannelData(ch);
    for (let i = 0; i < origLen; i++) mono[i] += data[i] / numChannels;
  }
  if (origSr <= targetSr) return { samples: mono, sr: origSr };
  const ratio = origSr / targetSr;
  const newLen = Math.floor(origLen / ratio);
  const down = new Float32Array(newLen);
  for (let i = 0; i < newLen; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(origLen, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += mono[j];
    down[i] = sum / Math.max(1, end - start);
  }
  return { samples: down, sr: targetSr };
}

function detectBpm(samples, sr) {
  const hop = 512;
  const frameCount = Math.floor(samples.length / hop);
  if (frameCount < 10) return 120;

  const energies = new Float32Array(frameCount);
  for (let f = 0; f < frameCount; f++) {
    let sum = 0;
    const offset = f * hop;
    for (let i = 0; i < hop; i++) {
      const v = samples[offset + i];
      sum += v * v;
    }
    energies[f] = Math.sqrt(sum / hop);
  }

  const onset = new Float32Array(frameCount);
  for (let f = 1; f < frameCount; f++) {
    const diff = energies[f] - energies[f - 1];
    onset[f] = diff > 0 ? diff : 0;
  }

  const fps = sr / hop;
  const minLag = Math.floor((60 / 160) * fps);
  const maxLag = Math.ceil((60 / 60) * fps);
  let bestLag = minLag;
  let bestCorr = -1;

  for (let lag = minLag; lag <= maxLag && lag < frameCount; lag++) {
    let corr = 0;
    const limit = frameCount - lag;
    for (let i = 0; i < limit; i++) corr += onset[i] * onset[i + lag];
    const bpmCandidate = (60 * fps) / lag;
    const weight = 1 - (0.15 * Math.abs(bpmCandidate - 115)) / 55;
    const score = (corr / limit) * weight;
    if (score > bestCorr) {
      bestCorr = score;
      bestLag = lag;
    }
  }
  return Math.round(((60 * fps) / bestLag) * 10) / 10;
}

function goertzelMag(samples, start, len, freq, sr) {
  const k = (len * freq) / sr;
  const omega = (2 * Math.PI * k) / len;
  const coeff = 2 * Math.cos(omega);
  let s0 = 0;
  let s1 = 0;
  let s2 = 0;
  const end = start + len;
  for (let i = start; i < end; i++) {
    s0 = samples[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - coeff * s1 * s2));
}

function computeChroma(samples, start, end, sr) {
  const chroma = new Float32Array(12);
  const segLen = end - start;
  const winLen = Math.min(4096, segLen);
  const numWins = Math.min(4, Math.max(1, Math.floor(segLen / winLen)));
  const step = numWins > 1 ? Math.floor((segLen - winLen) / (numWins - 1)) : 0;

  for (let w = 0; w < numWins; w++) {
    const wStart = start + w * step;
    for (let midi = 36; midi <= 83; midi++) {
      const freq = 440 * Math.pow(2, (midi - 69) / 12);
      if (freq >= sr * 0.45) continue;
      chroma[midi % 12] += goertzelMag(samples, wStart, winLen, freq, sr);
    }
  }
  return chroma;
}

function matchChord(chroma) {
  let norm = 0;
  for (let i = 0; i < 12; i++) norm += chroma[i] * chroma[i];
  norm = Math.sqrt(norm) + 1e-6;
  let best = NORMALIZED_TEMPLATES[0];
  let bestScore = -1;
  for (const tpl of NORMALIZED_TEMPLATES) {
    let dot = 0;
    for (let i = 0; i < 12; i++) dot += (chroma[i] / norm) * tpl.vec[i];
    if (dot > bestScore) {
      bestScore = dot;
      best = tpl;
    }
  }
  return best;
}

function computeSpectralFeatures(samples, start, end, sr) {
  const fftSize = 1024;
  const hop = 512;
  const real = new Float32Array(fftSize);
  const imag = new Float32Array(fftSize);
  const prevMag = new Float32Array(fftSize / 2);
  const hann = new Float32Array(fftSize);
  for (let i = 0; i < fftSize; i++) hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));

  let centroidSum = 0;
  let fluxSum = 0;
  let frames = 0;
  const totalFrames = Math.max(1, Math.floor((end - start - fftSize) / hop));
  const frameStride = Math.max(1, Math.floor(totalFrames / 24));

  for (let f = 0; f < totalFrames; f += frameStride) {
    const offset = start + f * hop;
    if (offset + fftSize > end) break;
    for (let i = 0; i < fftSize; i++) {
      real[i] = samples[offset + i] * hann[i];
      imag[i] = 0;
    }
    fft(real, imag);

    let weightedSum = 0;
    let magSum = 0;
    let flux = 0;
    const half = fftSize / 2;
    const binHz = sr / fftSize;

    for (let b = 1; b < half; b++) {
      const mag = Math.hypot(real[b], imag[b]);
      const freq = b * binHz;
      weightedSum += freq * mag;
      magSum += mag;
      if (frames > 0) {
        const diff = mag - prevMag[b];
        if (diff > 0) {
          flux += diff * (freq < 180 || freq > 1500 ? 1.4 : 0.7);
        }
      }
      prevMag[b] = mag;
    }
    if (magSum > 1e-6) centroidSum += weightedSum / magSum;
    fluxSum += flux;
    frames++;
  }

  return {
    centroidHz: frames > 0 ? Math.round(centroidSum / frames) : 0,
    drumRaw: frames > 1 ? fluxSum / (frames - 1) : 0,
  };
}

function buildPlainTextReport(data) {
  const lines = [
    `=== TRACK ANALYSE: ${data.fileName} ===`,
    `Dauer: ${data.duration.toFixed(1)}s | BPM: ${data.bpm.toFixed(1)} (Halftime: ${data.halftime.toFixed(1)})`,
    `Haupt-Akkorde: ${data.topChords.join(', ')}`,
    `${'Zeit'.padEnd(11)} | ${'Akkord'.padEnd(18)} | ${'Cutoff~Hz'.padEnd(9)} | ${'Energie'.padEnd(7)} | Drums`,
    '-'.repeat(68),
  ];
  for (const s of data.segments) {
    lines.push(
      `${`${formatTime(s.startSec)}-${formatTime(s.endSec)}`.padEnd(11)} | ${`${s.chord.label} (root:${s.chord.root})`.padEnd(18)} | ${`${s.cutoffHz}`.padEnd(9)} | ${`${String(s.energyPct).padStart(3)}%   `} | ${`${String(s.drumPct).padStart(3)}% (${s.drumLabel})`}`,
    );
  }
  return lines.join('\n');
}

const ICON_WAVE = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 12h3l3-8 4 16 3-8h7"/></svg>';
const ICON_UPLOAD = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';
const ICON_COPY = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

export class AudioSynthAnalyzerModal {
  constructor({ onToast, onApplyBpm } = {}) {
    this.onToast = onToast || (() => {});
    this.onApplyBpm = onApplyBpm || null;
    this.el = null;
    this.isOpen = false;
    this.currentFile = null;
    this.currentAudioUrl = null;
    this.segmentSec = 4;
    this.lastAnalysis = null;
    this.isAnalyzing = false;
    this.progress = 0;
    this.progressText = '';
    this.audioCtx = null;

    onLangChange(() => {
      if (this.isOpen) this.render();
    });
  }

  ensureDom() {
    if (this.el) return;
    this.el = document.createElement('div');
    this.el.id = 'audio-synth-analyzer-modal';
    this.el.className = 'asa-modal hidden';
    document.body.appendChild(this.el);

    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.close();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close();
    });
    window.addEventListener('resize', () => {
      if (this.isOpen && this.lastAnalysis) this.drawChart();
    });
  }

  open() {
    this.ensureDom();
    this.isOpen = true;
    this.el.classList.remove('hidden');
    this.render();
  }

  close() {
    if (!this.el) return;
    this.isOpen = false;
    this.el.classList.add('hidden');
  }

  handleFileSelect(file) {
    if (!file || (!file.type.startsWith('audio/') && !/\.(mp3|wav|ogg|m4a|flac|webm)$/i.test(file.name))) {
      this.onToast(t('Bitte eine gültige Audio-Datei (MP3, WAV, OGG) wählen.', 'Please select a valid audio file (MP3, WAV, OGG).'));
      return;
    }
    this.currentFile = file;
    if (this.currentAudioUrl) URL.revokeObjectURL(this.currentAudioUrl);
    this.currentAudioUrl = URL.createObjectURL(file);
    this.runAnalysis();
  }

  setProgress(pct, text) {
    this.progress = Math.max(0, Math.min(100, pct));
    this.progressText = text;
    const bar = this.el?.querySelector('#asa-loading-bar');
    const lbl = this.el?.querySelector('#asa-loading-pct');
    const txt = this.el?.querySelector('#asa-loading-txt');
    if (bar) bar.style.width = `${this.progress}%`;
    if (lbl) lbl.textContent = `${Math.round(this.progress)}%`;
    if (txt) txt.textContent = text;
  }

  async runAnalysis() {
    if (!this.currentFile || this.isAnalyzing) return;
    this.isAnalyzing = true;
    this.render();

    try {
      this.setProgress(8, t('Lese Audio-Datei…', 'Reading audio file…'));
      await yieldUI();
      const arrayBuffer = await this.currentFile.arrayBuffer();

      this.setProgress(20, t('Decodiere Audio (Web Audio API)…', 'Decoding audio (Web Audio API)…'));
      await yieldUI();
      if (!this.audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new Ctx();
      }
      const audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
      const duration = audioBuffer.duration;

      this.setProgress(35, t('Mono-Mixdown & Downsampling…', 'Mono mixdown & downsampling…'));
      await yieldUI();
      const { samples, sr } = mixdownAndDownsample(audioBuffer, 22050);

      this.setProgress(48, t('Ermittle Tempo (BPM)…', 'Detecting tempo (BPM)…'));
      await yieldUI();
      const bpm = detectBpm(samples, sr);
      const halftime = Math.round((bpm / 2) * 10) / 10;

      const segSamples = Math.floor(this.segmentSec * sr);
      const numSegments = Math.max(1, Math.ceil(samples.length / segSamples));
      const rawSegments = [];
      let maxRms = 1e-6;
      let maxDrum = 1e-6;

      for (let i = 0; i < numSegments; i++) {
        const start = i * segSamples;
        const end = Math.min(samples.length, start + segSamples);
        if (end - start < sr * 0.25) continue;

        let sumSq = 0;
        for (let j = start; j < end; j++) sumSq += samples[j] * samples[j];
        const rms = Math.sqrt(sumSq / (end - start));
        if (rms > maxRms) maxRms = rms;

        const chord = matchChord(computeChroma(samples, start, end, sr));
        const spec = computeSpectralFeatures(samples, start, end, sr);
        if (spec.drumRaw > maxDrum) maxDrum = spec.drumRaw;

        rawSegments.push({
          startSec: i * this.segmentSec,
          endSec: Math.min(duration, (i + 1) * this.segmentSec),
          chord,
          cutoffHz: spec.centroidHz,
          rms,
          drumRaw: spec.drumRaw,
        });

        this.setProgress(50 + ((i + 1) / numSegments) * 48, `${t('Analysiere Segment', 'Analyzing segment')} ${i + 1} / ${numSegments}…`);
        if (i % 3 === 0) await yieldUI();
      }

      const segments = rawSegments.map((seg) => {
        const energyPct = Math.round((seg.rms / maxRms) * 100);
        const drumPct = Math.round((seg.drumRaw / maxDrum) * 100);
        return {
          ...seg,
          energyPct,
          drumPct,
          drumLabel: drumPct > 55 ? 'DROP' : (drumPct > 25 ? 'beat' : '-'),
        };
      });

      const chordCounts = {};
      for (const s of segments) {
        const key = `${s.chord.label} (r:${s.chord.root})`;
        chordCounts[key] = (chordCounts[key] || 0) + 1;
      }
      const topChords = Object.entries(chordCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map((e) => e[0]);

      this.lastAnalysis = {
        fileName: this.currentFile.name,
        duration,
        bpm,
        halftime,
        topChords,
        segments,
      };
      this.onToast(t('Track-Analyse abgeschlossen', 'Track analysis complete'));
    } catch (err) {
      console.error(err);
      this.onToast(t('Fehler beim Decodieren der Audio-Datei', 'Error decoding audio file'));
    } finally {
      this.isAnalyzing = false;
      if (this.isOpen) this.render();
    }
  }

  drawChart() {
    const canvas = this.el?.querySelector('#asa-chart-canvas');
    const segments = this.lastAnalysis?.segments;
    if (!canvas || !segments?.length) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    canvas.width = Math.max(300, Math.floor(rect.width * dpr));
    canvas.height = Math.max(150, Math.floor(rect.height * dpr));

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = rect.width;
    const h = rect.height;
    const padL = 12;
    const padR = 12;
    const padT = 18;
    const padB = 22;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    ctx.fillStyle = '#090d14';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.lineWidth = 1;
    for (let g = 0; g <= 4; g++) {
      const y = padT + (plotH / 4) * g;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
    }

    const n = segments.length;
    const barW = Math.max(3, (plotW / n) * 0.65);
    const maxCutoff = Math.max(3000, ...segments.map((s) => s.cutoffHz));

    segments.forEach((seg, idx) => {
      const xCenter = padL + ((idx + 0.5) / n) * plotW;
      const barH = (seg.energyPct / 100) * plotH;
      const y = padT + plotH - barH;
      ctx.fillStyle = seg.drumLabel === 'DROP' ? 'rgba(16, 185, 129, 0.58)' : 'rgba(16, 185, 129, 0.28)';
      ctx.fillRect(xCenter - barW / 2, y, barW, barH);

      if (seg.drumLabel === 'DROP') {
        ctx.fillStyle = '#f07832';
        ctx.beginPath();
        ctx.arc(xCenter, padT - 6, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    segments.forEach((seg, idx) => {
      const x = padL + ((idx + 0.5) / n) * plotW;
      const y = padT + plotH - (seg.cutoffHz / maxCutoff) * plotH;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    const step = Math.max(1, Math.floor(n / 6));
    for (let i = 0; i < n; i += step) {
      const x = padL + ((i + 0.5) / n) * plotW;
      ctx.fillText(formatTime(segments[i].startSec), x, h - 6);
    }
  }

  render() {
    if (!this.el) return;
    const d = this.lastAnalysis;

    const resultsHtml = d
      ? `
        <div class="asa-stats-grid">
          <div class="asa-stat-card">
            <span class="asa-stat-lbl">${esc(t('Datei', 'File'))}</span>
            <strong class="asa-stat-file" title="${esc(d.fileName)}">${esc(d.fileName)}</strong>
            <small>${esc(t('Dauer', 'Duration'))}: ${formatTime(d.duration)} (${d.duration.toFixed(1)}s)</small>
          </div>
          <div class="asa-stat-card">
            <span class="asa-stat-lbl">Tempo (BPM)</span>
            <strong class="asa-stat-bpm">${d.bpm.toFixed(1)} BPM</strong>
            <small class="asa-stat-half">Halftime: ${d.halftime.toFixed(1)} BPM</small>
          </div>
          <div class="asa-stat-card">
            <span class="asa-stat-lbl">${esc(t('Haupt-Akkorde', 'Top Chords'))}</span>
            <div class="asa-stat-chords">${esc(d.topChords.join(' · ') || '—')}</div>
          </div>
          <div class="asa-stat-card asa-actions-card">
            <button type="button" id="asa-copy-btn" class="asa-btn-primary">${ICON_COPY} <span>${esc(t('Analyse kopieren', 'Copy Report'))}</span></button>
            ${this.onApplyBpm ? `<button type="button" id="asa-apply-bpm" class="asa-btn-sec">${esc(t('BPM ins Studio übernehmen', 'Apply BPM to Studio'))}</button>` : ''}
          </div>
        </div>

        <div class="asa-chart-box">
          <div class="asa-chart-head">
            <span>${esc(t('Energie-, Cutoff- & Drum-Verlauf', 'Energy, Cutoff & Drum Timeline'))}</span>
            <div class="asa-legend">
              <span class="leg-en"><i></i>${esc(t('Energie %', 'Energy %'))}</span>
              <span class="leg-co"><i></i>Cutoff (Hz)</span>
              <span class="leg-dr"><i></i>DROP</span>
            </div>
          </div>
          <canvas id="asa-chart-canvas" class="asa-chart-canvas"></canvas>
        </div>

        <div class="asa-table-wrap">
          <div class="asa-table-head">
            <span>${esc(t('Segment-Analyse', 'Segment Breakdown'))}</span>
            <small>${d.segments.length} ${esc(t('Segmente', 'Segments'))} (${this.segmentSec}s)</small>
          </div>
          <div class="asa-table-scroll">
            <table class="asa-table">
              <thead>
                <tr>
                  <th>${esc(t('Zeit', 'Time'))}</th>
                  <th>${esc(t('Akkord (root)', 'Chord (root)'))}</th>
                  <th>Cutoff ~Hz</th>
                  <th>${esc(t('Energie', 'Energy'))}</th>
                  <th>Drums</th>
                </tr>
              </thead>
              <tbody>
                ${d.segments.map((seg) => `
                  <tr>
                    <td>${formatTime(seg.startSec)}–${formatTime(seg.endSec)}</td>
                    <td><strong>${esc(seg.chord.label)}</strong> <small>(r:${seg.chord.root})</small></td>
                    <td class="asa-hz">${seg.cutoffHz} Hz</td>
                    <td>
                      <div class="asa-en-bar"><span class="asa-en-track"><i style="width:${seg.energyPct}%"></i></span><b>${seg.energyPct}%</b></div>
                    </td>
                    <td><span class="asa-badge ${seg.drumLabel === 'DROP' ? 'is-drop' : seg.drumLabel === 'beat' ? 'is-beat' : ''}">${seg.drumPct}% · ${seg.drumLabel}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `
      : '';

    this.el.innerHTML = `
      <div class="asa-dialog">
        <header class="asa-header">
          <div class="asa-header-title">
            ${ICON_WAVE}
            <div>
              <h2>Audio → Synth Analyzer</h2>
              <span class="asa-sub">${esc(t('100 % lokal im Browser · BPM, Akkorde (root 0–11), Cutoff & Drop-Erkennung', '100% local in browser · BPM, chords (root 0–11), cutoff & drop detection'))}</span>
            </div>
          </div>
          <button type="button" id="asa-close-btn" class="asa-close-btn" title="${esc(t('Schließen [Esc]', 'Close [Esc]'))}">✕</button>
        </header>

        <div class="asa-body">
          <div class="asa-top-grid">
            <div id="asa-dropzone" class="asa-dropzone">
              <input id="asa-file-input" type="file" accept=".mp3,.wav,.ogg,.m4a,.flac,audio/*" hidden />
              <div class="asa-upload-icon">${ICON_UPLOAD}</div>
              <strong>${esc(t('MP3, WAV oder OGG hier ablegen', 'Drop MP3, WAV or OGG here'))}</strong>
              <span>${esc(t('oder klicken zum Auswählen · Verarbeitung lokal via Web Audio API', 'or click to browse · processed locally via Web Audio API'))}</span>
              ${this.currentFile ? `<div class="asa-file-pill">${esc(this.currentFile.name)}</div>` : ''}
            </div>

            <div class="asa-controls-card">
              <div class="asa-ctrl-group">
                <label>${esc(t('Segmentlänge', 'Segment Length'))}</label>
                <div class="asa-seg-pills">
                  ${[2, 4, 8].map((s) => `<button type="button" class="asa-seg-btn ${this.segmentSec === s ? 'active' : ''}" data-seg="${s}">${s}s</button>`).join('')}
                </div>
              </div>
              ${this.currentAudioUrl ? `<audio controls class="asa-player" src="${esc(this.currentAudioUrl)}"></audio>` : ''}
              <button type="button" id="asa-analyze-btn" class="asa-btn-accent" ${!this.currentFile || this.isAnalyzing ? 'disabled' : ''}>
                ${esc(this.isAnalyzing ? t('Analysiere…', 'Analyzing…') : t('Analysieren', 'Analyze'))}
              </button>
            </div>
          </div>

          ${this.isAnalyzing ? `
            <div class="asa-loading">
              <div class="asa-loading-head">
                <span id="asa-loading-txt">${esc(this.progressText)}</span>
                <span id="asa-loading-pct">${Math.round(this.progress)}%</span>
              </div>
              <div class="asa-progress-track"><div id="asa-loading-bar" style="width:${this.progress}%"></div></div>
            </div>
          ` : ''}

          ${resultsHtml}
        </div>
      </div>
    `;

    this.bindEvents();
    if (d) requestAnimationFrame(() => this.drawChart());
  }

  bindEvents() {
    this.el.querySelector('#asa-close-btn')?.addEventListener('click', () => this.close());

    const dropZone = this.el.querySelector('#asa-dropzone');
    const fileInput = this.el.querySelector('#asa-file-input');
    dropZone?.addEventListener('click', () => fileInput?.click());
    dropZone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('is-drag');
    });
    dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('is-drag'));
    dropZone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('is-drag');
      const file = e.dataTransfer?.files?.[0];
      if (file) this.handleFileSelect(file);
    });
    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) this.handleFileSelect(file);
    });

    this.el.querySelectorAll('.asa-seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.segmentSec = Number(btn.dataset.seg) || 4;
        if (this.currentFile) this.runAnalysis();
        else this.render();
      });
    });

    this.el.querySelector('#asa-analyze-btn')?.addEventListener('click', () => this.runAnalysis());

    this.el.querySelector('#asa-copy-btn')?.addEventListener('click', async () => {
      if (!this.lastAnalysis) return;
      const report = buildPlainTextReport(this.lastAnalysis);
      try {
        await navigator.clipboard?.writeText(report);
        this.onToast(t('Analyse-Text in die Zwischenablage kopiert', 'Analysis report copied to clipboard'));
      } catch {
        this.onToast(t('Kopieren fehlgeschlagen', 'Copy failed'));
      }
    });

    this.el.querySelector('#asa-apply-bpm')?.addEventListener('click', () => {
      if (!this.lastAnalysis || !this.onApplyBpm) return;
      const bpm = Math.round(this.lastAnalysis.bpm);
      this.onApplyBpm(bpm);
      this.onToast(`${t('Studio-Tempo gesetzt auf', 'Studio tempo set to')} ${bpm} BPM`);
    });
  }
}
