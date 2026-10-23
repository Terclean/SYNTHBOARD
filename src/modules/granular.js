// SYNTHBOARD – Granular Cloud: Aufnahmen werden zu spielbaren Klangwolken
import { createRng } from './base.js';
import { VoiceBase, COMMON_PARAMS, MUTATE_JACK, clamp } from './shared.js';

const SR = 22050;
const SECONDS = 6;
const wrap01 = (x) => x - Math.floor(x);

// ───────────────────────── Eingebaute Klangquellen (prozedural) ──
function normalize(d) {
  let peak = 0;
  for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  if (peak > 0) { const k = 0.9 / peak; for (let i = 0; i < d.length; i++) d[i] *= k; }
}

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

const GENERATORS = {
  /** Vokalähnlicher Akkord-Chor mit weichen Wechseln */
  choir(d) {
    const chords = [[45, 52, 57, 60, 64], [43, 50, 55, 59, 62], [41, 48, 53, 57, 60], [43, 50, 55, 59, 62]];
    const seg = d.length / chords.length;
    const H = 8;
    const formant = (f) => Math.exp(-(((f - 650) / 300) ** 2)) + 0.6 * Math.exp(-(((f - 1100) / 350) ** 2)) + 0.3 * Math.exp(-(((f - 2400) / 500) ** 2)) + 0.04;
    chords.forEach((chord, k) => {
      const center = (k + 0.5) * seg;
      const half = seg * 0.75;
      const i0 = Math.max(0, Math.floor(center - half));
      const i1 = Math.min(d.length, Math.floor(center + half));
      const amps = chord.map((m) => { const f = mtof(m); return Array.from({ length: H }, (_, h) => formant(f * (h + 1)) / Math.pow(h + 1, 0.4)); });
      for (let i = i0; i < i1; i++) {
        const t = i / SR;
        const w = 0.5 - 0.5 * Math.cos(((i - i0) / (i1 - i0)) * Math.PI * 2);
        const trem = 1 + 0.12 * Math.sin(2 * Math.PI * 4.7 * t + k);
        let s = 0;
        for (let n = 0; n < chord.length; n++) {
          const f = mtof(chord[n]) * (1 + 0.0015 * (n % 2 ? 1 : -1));
          for (let h = 0; h < H; h++) s += amps[n][h] * Math.sin(2 * Math.PI * f * (h + 1) * t);
        }
        d[i] += s * w * trem * 0.05;
      }
    });
  },

  /** Regen: Rauschteppich mit einzelnen Tropfen */
  rain(d) {
    const rng = createRng(5);
    let lp = 0, lp2 = 0;
    for (let i = 0; i < d.length; i++) {
      const x = rng() * 2 - 1;
      lp += 0.35 * (x - lp);
      lp2 += 0.08 * (x - lp2);
      d[i] = (lp - lp2) * 0.35 + lp2 * 0.15;
    }
    const drops = 6 * 110;
    for (let n = 0; n < drops; n++) {
      const start = Math.floor(rng() * (d.length - 800));
      const f = 1500 + rng() * 4500;
      const amp = 0.15 + rng() * 0.55;
      const tau = 0.004 + rng() * 0.012;
      const len = Math.floor(SR * tau * 6);
      for (let j = 0; j < len; j++) {
        const t = j / SR;
        d[start + j] += amp * Math.sin(2 * Math.PI * f * (1 + t * 40) * t) * Math.exp(-t / tau);
      }
    }
  },

  /** Klavierakkord-Arpeggio mit Nachklang */
  piano(d) {
    const rng = createRng(11);
    const seq = [60, 64, 67, 71, 72, 67, 64, 62];
    seq.forEach((m, n) => {
      const start = Math.floor(n * 0.72 * SR);
      const f = mtof(m);
      const len = Math.min(d.length - start, Math.floor(2.6 * SR));
      for (let j = 0; j < len; j++) {
        const t = j / SR;
        let s = 0;
        for (let h = 1; h <= 8; h++) {
          s += (Math.sin(2 * Math.PI * f * h * Math.sqrt(1 + 0.0004 * h * h) * t) / Math.pow(h, 1.1)) * Math.exp(-t * (1.1 + 0.55 * h));
        }
        const hammer = t < 0.006 ? (rng() * 2 - 1) * (1 - t / 0.006) * 0.5 : 0;
        d[start + j] += s * 0.5 + hammer;
      }
    });
  },

  /** Maschinenraum: Brummen, pulsierende Rauschimpulse, Klopfen */
  machine(d) {
    const rng = createRng(23);
    let prev = 0;
    for (let i = 0; i < d.length; i++) {
      const t = i / SR;
      const hum = Math.sin(2 * Math.PI * 55 * t) + 0.5 * Math.sin(2 * Math.PI * 165 * t) + 0.25 * Math.sin(2 * Math.PI * 275 * t);
      const phase = (t * 7.5) % 1;
      const x = rng() * 2 - 1;
      const hiss = (x - prev) * Math.exp(-phase * 14);
      prev = x;
      const thudPhase = (t * 1.875) % 1;
      const thud = Math.sin(2 * Math.PI * (70 - 40 * thudPhase) * thudPhase) * Math.exp(-thudPhase * 9);
      const whirr = Math.sin(2 * Math.PI * (320 + 180 * Math.sin(2 * Math.PI * 0.5 * t)) * t) * 0.12;
      d[i] = hum * 0.12 + hiss * 0.45 + thud * 0.7 + whirr;
    }
  },
};

const SOURCE_LABELS = { choir: 'Stimme (Chor)', rain: 'Regen', piano: 'Klavier', machine: 'Maschine', user: 'Eigene Aufnahme' };
const builtinCache = new WeakMap();

function getBuiltin(ctx, name) {
  let map = builtinCache.get(ctx);
  if (!map) { map = new Map(); builtinCache.set(ctx, map); }
  if (map.has(name)) return map.get(name);
  const buf = ctx.createBuffer(1, SR * SECONDS, SR);
  const d = buf.getChannelData(0);
  (GENERATORS[name] || GENERATORS.choir)(d);
  normalize(d);
  map.set(name, buf);
  return buf;
}

function reverseOf(ctx, buf) {
  const rev = ctx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const src = buf.getChannelData(c);
    const dst = rev.getChannelData(c);
    for (let i = 0, n = src.length; i < n; i++) dst[i] = src[n - 1 - i];
  }
  return rev;
}

const HANN = (() => {
  const n = 32;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  return c;
})();

export class GranularCloudModule extends VoiceBase {
  static type = 'granular_cloud';
  static title = 'Granular Cloud';
  static category = 'source';
  static color = '#f59e0b';
  static icon = '☁';
  static description = 'Aufnahmen werden zu Klangwolken oder rhythmischen Körnerwolken – eigene Datei, Mitschnitt oder eingebaute Quellen';
  static params = [
    { id: 'level', label: 'Level', min: 0, max: 1, value: 0.7, fmt: 'pct' },
    { id: 'pos', label: 'Position', min: 0, max: 1, value: 0.3, fmt: 'pct' },
    { id: 'size', label: 'Korngröße', min: 0.01, max: 1, value: 0.14, log: true, fmt: 's' },
    { id: 'density', label: 'Dichte', min: 1, max: 80, value: 14, log: true, fmt: 'gps' },
    { id: 'pitch', label: 'Tonhöhe', min: -24, max: 24, value: 0, fmt: 'st' },
    { id: 'reverse', label: 'Rückwärts', min: 0, max: 1, value: 0.15, fmt: 'pct' },
    { id: 'scatter', label: 'Zeitstreuung', min: 0, max: 1, value: 0.3, fmt: 'pct' },
    { id: 'width', label: 'Stereobreite', min: 0, max: 1, value: 0.6, fmt: 'pct' },
    { id: 'scan', label: 'Scan', min: -1, max: 1, value: 0.12, fmt: 'sgn' },
    { id: 'jump', label: 'Sprung', min: 0, max: 1, value: 0.5, fmt: 'pct' },
    ...COMMON_PARAMS,
  ];
  static options = [
    { id: 'mode', label: 'Spielweise', choices: [['cloud', 'Cloud'], ['trigger', 'Trigger']], value: 'cloud' },
    { id: 'source', label: 'Quelle', choices: [['choir', 'Stimme'], ['rain', 'Regen'], ['piano', 'Klavier'], ['machine', 'Maschine'], ['user', 'Eigene Aufnahme']], value: 'choir' },
  ];
  static jacks = [
    { id: 'gateIn', type: 'in', signal: 'gate', label: 'GATE' },
    { id: 'jumpIn', type: 'in', signal: 'gate', label: 'JUMP' },
    { id: 'freezeIn', type: 'in', signal: 'gate', label: 'FREEZE' },
    { id: 'pitchIn', type: 'in', signal: 'pitch', label: 'PITCH' },
    { id: 'posCv', type: 'in', signal: 'mod', label: 'POS CV' },
    { id: 'densityCv', type: 'in', signal: 'mod', label: 'DENSITY CV' },
    { id: 'vcaCv', type: 'in', signal: 'mod', label: 'VCA CV' },
    { id: 'panCv', type: 'in', signal: 'mod', label: 'PAN CV' },
    MUTATE_JACK,
  ];
  static mutateSkipOptions = ['source', 'mode'];
  static defaultLocks = ['pitch'];

  constructor(ctx, state = {}) {
    super(ctx, state);
    this.buffer = null;
    this.reversed = null;
    this.userBuffer = null;
    this.userName = '';
    this.peaks = null;
    this.head = 0.3;
    this.cv = { pos: 0.5, density: 0.5 };
    this.pitchOffset = 0;
    this.frozen = false;
    this.queue = [];
    this.active = 0;
    this.nextGrain = 0;
    this.lastTick = ctx.currentTime;
    this.lastGrain = 0;

    this.levelGain = ctx.createGain();
    this.levelGain.connect(this.output);
    this.initValues(state);
    this.loadSource();
    this.timer = setInterval(() => this.tick(), 25);
    this.uiTimer = setInterval(() => this.drawWave?.(), 90);
  }

  isPatched(id) { return !!this.patchSystem?.hasIncoming(this.id, id); }

  applyParam(id, val) {
    if (id === 'level') this.ramp(this.levelGain.gain, val);
    else if (id === 'pos') this.head = val;
    else if (id === 'source' && this.levelGain) this.loadSource();
  }

  // ───────────────────────── Quelle ──
  loadSource() {
    const name = this.values.source || 'choir';
    if (name === 'user' && this.userBuffer) { this.setBuffer(this.userBuffer, this.userName); return; }
    const key = name === 'user' ? 'choir' : name;
    clearTimeout(this.genTimer);
    this.genTimer = setTimeout(() => this.setBuffer(getBuiltin(this.ctx, key), SOURCE_LABELS[name] + (name === 'user' ? ' (leer → Chor)' : '')), 10);
  }

  setBuffer(buf, label = '') {
    this.buffer = buf;
    this.reversed = reverseOf(this.ctx, buf);
    const cols = 240;
    const d = buf.getChannelData(0);
    const step = Math.max(1, Math.floor(d.length / cols));
    this.peaks = new Float32Array(cols);
    for (let c = 0; c < cols; c++) {
      let m = 0;
      for (let i = c * step; i < Math.min(d.length, (c + 1) * step); i += 4) m = Math.max(m, Math.abs(d[i]));
      this.peaks[c] = m;
    }
    this.sourceLabel = label;
    this.labelUi?.(label);
  }

  useUserBuffer(buf, name) {
    this.userBuffer = buf;
    this.userName = name;
    this.setParam('source', 'user');
    this.syncSourceSelect?.();
    this.notifyChanged?.();
  }

  async loadFile(file) {
    try {
      const buf = await this.ctx.decodeAudioData(await file.arrayBuffer());
      this.useUserBuffer(buf, file.name);
    } catch (e) {
      this.labelUi?.('Datei nicht lesbar');
    }
  }

  /** Nimmt den Master-Ausgang für ein paar Sekunden auf und macht ihn zur Quelle */
  capture(seconds = 8) {
    const engine = this.patchSystem?.engine;
    if (!engine?.limiter || typeof MediaRecorder === 'undefined' || this.capturing) {
      this.labelUi?.('Mitschnitt nicht verfügbar');
      return;
    }
    this.capturing = true;
    const dest = this.ctx.createMediaStreamDestination();
    engine.limiter.connect(dest);
    const chunks = [];
    const rec = new MediaRecorder(dest.stream);
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = async () => {
      try { engine.limiter.disconnect(dest); } catch { /* ignore */ }
      try {
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        const buf = await this.ctx.decodeAudioData(await blob.arrayBuffer());
        this.useUserBuffer(buf, 'Mitschnitt');
      } catch { this.labelUi?.('Mitschnitt fehlgeschlagen'); }
      this.capturing = false;
      this.captureUi?.(false);
    };
    rec.start();
    this.captureUi?.(true, seconds);
    setTimeout(() => { if (rec.state !== 'inactive') rec.stop(); }, seconds * 1000);
  }

  // ───────────────────────── Eingänge ──
  onPitch(portId, _time, midiNote) {
    if (portId !== 'pitchIn') return;
    this.pitchOffset = midiNote - 60;
    this.updateNoteUi?.();
  }

  onModulation(portId, value) {
    if (this.handleSourceModulation(portId, value)) return;
    if (portId === 'posCv') this.cv.pos = value;
    else if (portId === 'densityCv') this.cv.density = value;
  }

  onTrigger(portId, time, velocity = 1) {
    if (!this.enabled) return;
    if (this.handleMutateTrigger(portId)) return;
    if (portId === 'freezeIn') { this.setFrozen(!this.frozen); return; }
    if (portId === 'jumpIn') { this.jump(true); return; }
    if (portId !== 'gateIn') return;
    this.jump(false);
    if (this.values.mode === 'trigger') this.burst(time, velocity);
    this.flashUi?.();
  }

  setFrozen(on) {
    this.frozen = on;
    this.freezeUi?.(on);
  }

  /** Springt zu einer anderen Stelle der Aufnahme (Wahrscheinlichkeit = Sprung-Regler) */
  jump(force) {
    if (force || Math.random() < (this.values.jump ?? 0.5)) this.head = Math.random();
  }

  /** Trigger-Modus: ein Impuls startet eine kurze Körnerwolke */
  burst(time, velocity = 1) {
    const V = this.values;
    const k = 3 + Math.round(V.density / 6);
    const win = V.size * 3;
    for (let i = 0; i < k; i++) {
      this.queue.push({ t: Math.max(time, this.ctx.currentTime) + (i / k) * win + Math.random() * 0.01, vel: this.vel(velocity) });
    }
  }

  effPos() {
    return wrap01(this.head + (this.isPatched('posCv') ? this.cv.pos - 0.5 : 0));
  }

  effDensity() {
    const k = this.isPatched('densityCv') ? Math.pow(2, (this.cv.density - 0.5) * 3) : 1;
    return clamp(this.values.density * k, 0.5, 120);
  }

  // ───────────────────────── Grain-Scheduler ──
  tick() {
    if (!this.enabled || !this.buffer || this.ctx.state !== 'running') { this.lastTick = this.ctx.currentTime; return; }
    const now = this.ctx.currentTime;
    const dt = Math.min(0.2, now - this.lastTick);
    this.lastTick = now;
    const V = this.values;

    if (!this.frozen && V.scan) this.head = wrap01(this.head + V.scan * 0.08 * dt);

    const continuous = V.mode === 'cloud' || this.frozen;
    if (continuous) {
      if (this.nextGrain < now - 0.1) this.nextGrain = now;
      const dens = this.effDensity();
      while (this.nextGrain < now + 0.1) {
        this.spawn(this.nextGrain, 1);
        this.nextGrain += (1 / dens) * (0.6 + Math.random() * 0.8);
      }
    } else {
      this.nextGrain = now;
    }
    if (this.queue.length) {
      const rest = [];
      for (const q of this.queue) {
        if (q.t < now + 0.1) this.spawn(q.t, q.vel); else rest.push(q);
      }
      this.queue = rest;
    }
  }

  spawn(time, vel = 1) {
    if (this.active > 140) return;
    const ctx = this.ctx;
    const V = this.values;
    const useRev = Math.random() < V.reverse;
    const buf = useRev ? this.reversed : this.buffer;
    const bufDur = buf.duration;

    const pos = wrap01(this.effPos() + (Math.random() * 2 - 1) * V.scatter * 0.25);
    const size = clamp(V.size * (0.8 + Math.random() * 0.4), 0.01, 1.2);
    const semis = V.pitch + this.pitchOffset + (Math.random() * 2 - 1) * V.scatter * 0.4;
    const rate = clamp(Math.pow(2, semis / 12), 0.1, 8);
    const len = Math.min(size * rate, bufDur * 0.95);
    const a = pos * bufDur;
    let offset = useRev ? bufDur - a - len : a;
    offset = clamp(offset, 0, Math.max(0, bufDur - len));
    const st = Math.max(time, ctx.currentTime) + Math.random() * V.scatter * 0.05;

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    const overlap = this.effDensity() * size;
    const amp = (0.9 / Math.sqrt(Math.max(1, overlap))) * vel;
    g.gain.value = 0;
    g.gain.setValueCurveAtTime(HANN.map((h) => h * amp), st, size);
    src.connect(g);
    let tail = g;
    let pn = null;
    if (ctx.createStereoPanner) {
      pn = ctx.createStereoPanner();
      pn.pan.value = (Math.random() * 2 - 1) * V.width;
      g.connect(pn);
      tail = pn;
    }
    tail.connect(this.levelGain);
    this.active++;
    src.onended = () => {
      this.active--;
      try { src.disconnect(); g.disconnect(); pn?.disconnect(); } catch { /* ignore */ }
    };
    src.start(st, offset, len);
    this.lastGrain = performance.now();
  }

  // ───────────────────────── UI ──
  renderBody(el, { changed } = {}) {
    el.innerHTML = `
      <div class="cloud-wrap">
        <canvas class="cloud-canvas" width="240" height="46"></canvas>
        <div class="cloud-label">–</div>
      </div>
      <div class="cloud-actions">
        <button class="mini-btn cl-file" title="Audiodatei laden">📂 Datei</button>
        <button class="mini-btn cl-cap" title="Master-Ausgang 8 s mitschneiden">● Mitschnitt</button>
        <button class="mini-btn cl-freeze" title="Position einfrieren">❄ Freeze</button>
        <button class="mini-btn cl-jump" title="An eine andere Stelle springen">⤳ Jump</button>
        <input type="file" class="cl-input" accept="audio/*" hidden />
      </div>`;
    const cv = el.querySelector('.cloud-canvas');
    const c = cv.getContext('2d');
    const label = el.querySelector('.cloud-label');
    const card = () => el.closest('.module-card');
    this.labelUi = (t) => { label.textContent = t || '–'; };
    this.labelUi(this.sourceLabel);
    this.syncSourceSelect = () => {
      const sel = card()?.querySelector('select[data-opt="source"]');
      if (sel) sel.value = this.values.source;
    };

    const input = el.querySelector('.cl-input');
    el.querySelector('.cl-file').addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      const f = input.files[0];
      input.value = '';
      if (f) { await this.loadFile(f); changed?.(); }
    });
    const capBtn = el.querySelector('.cl-cap');
    capBtn.addEventListener('click', () => this.capture(8));
    this.captureUi = (on, secs) => {
      capBtn.classList.toggle('rec-on', on);
      if (on) {
        let left = secs;
        capBtn.textContent = `● ${left} s`;
        const iv = setInterval(() => {
          left--;
          if (left <= 0 || !this.capturing) { clearInterval(iv); capBtn.textContent = '● Mitschnitt'; } else capBtn.textContent = `● ${left} s`;
        }, 1000);
      } else capBtn.textContent = '● Mitschnitt';
    };
    const frz = el.querySelector('.cl-freeze');
    frz.addEventListener('click', () => this.setFrozen(!this.frozen));
    this.freezeUi = (on) => frz.classList.toggle('active', on);
    this.freezeUi(this.frozen);
    el.querySelector('.cl-jump').addEventListener('click', () => this.jump(true));

    this.drawWave = () => {
      if (!el.isConnected) return;
      c.clearRect(0, 0, cv.width, cv.height);
      const mid = cv.height / 2;
      if (this.peaks) {
        c.fillStyle = 'rgba(245, 158, 11, 0.55)';
        for (let i = 0; i < this.peaks.length; i++) {
          const h = Math.max(1, this.peaks[i] * (mid - 2));
          c.fillRect(i, mid - h, 1, h * 2);
        }
      }
      const dur = this.buffer?.duration || SECONDS;
      const x = this.effPos() * cv.width;
      const w = Math.max(2, (this.values.size / dur) * cv.width * 2);
      const age = performance.now() - this.lastGrain;
      c.fillStyle = `rgba(255,255,255,${0.12 + Math.max(0, 0.3 - age / 400)})`;
      c.fillRect(x - w / 2, 0, w, cv.height);
      c.fillStyle = this.frozen ? '#7dd3fc' : '#fff';
      c.fillRect(x - 0.75, 0, 1.5, cv.height);
    };

    // Mini-Anzeige für Tonhöhen-Versatz durch Pitch-Kabel
    this.updateNoteUi = () => {};
    this.flashUi = () => {
      cv.classList.add('flash');
      setTimeout(() => cv.classList.remove('flash'), 100);
    };
  }

  destroy() {
    clearInterval(this.timer);
    clearInterval(this.uiTimer);
    clearTimeout(this.genTimer);
    super.destroy();
  }
}
