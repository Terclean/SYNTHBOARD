// SYNTHBOARD · Eurorack – Engine: Routing, Transport (Audio-Zeitbasis), Makros, Automation, Speicherformat
import { MODULE_TYPES, LfoModule, clamp } from './modules.js';

export const STATE_FORMAT = 'synthboard-eurorack';
export const STATE_VERSION = 1;

/** Makros → tatsächliche DSP-Parameter (absolute Werte, bewusst begrenzt) */
export const MACROS = {
  bright: {
    label: 'Helligkeit',
    targets: [
      { mod: 'filter', param: 'cutoff', fn: (h) => 600 * Math.pow(5.5, h), info: 'Filter-Cutoff 600 Hz … 3,3 kHz' },
      { mod: 'reverb', param: 'tone', fn: (h) => 1800 * Math.pow(2.3, h), info: 'Hall-Höhen 1,8 … 4,1 kHz' },
    ],
  },
  width: {
    label: 'Breite',
    targets: [
      { mod: 'osc', param: 'spread', fn: (w) => 0.15 + 0.85 * w, info: 'Oszillator-Stereobreite 15 … 100 %' },
      { mod: 'chorus', param: 'mix', fn: (w) => 0.12 + 0.30 * w, info: 'Ensemble-Anteil 12 … 42 %' },
    ],
  },
  motion: {
    label: 'Bewegung',
    targets: [
      { mod: 'lfo1', param: 'depth', fn: (m) => 0.05 + 0.30 * m, info: 'LFO 1 (Filter) Tiefe 5 … 35 %' },
      { mod: 'lfo2', param: 'depth', fn: (m) => 0.10 + 0.35 * m, info: 'LFO 2 (Ensemble) Tiefe 10 … 45 %' },
      { mod: 'osc', param: 'drift', fn: (m) => 1 + 5 * m, info: 'Oszillator-Drift 1 … 6 Cent' },
    ],
  },
  density: {
    label: 'Dichte',
    targets: [
      { mod: 'osc', param: 'detune', fn: (d) => 2.5 + 8 * d, info: 'Verstimmung 2,5 … 10,5 Cent' },
      { mod: 'osc', param: 'osc3', fn: (d) => d, info: '3. Oszillator 0 … 100 %' },
      { mod: 'sat', param: 'drive', fn: (d) => 0.1 + 0.4 * d, info: 'Sättigung 10 … 50 %' },
    ],
  },
  space: {
    label: 'Raum',
    targets: [
      { mod: 'reverb', param: 'send', fn: (r) => 0.05 + 0.40 * r, info: 'Hall-Anteil 5 … 45 %' },
    ],
  },
};
export const MACRO_KEYS = Object.keys(MACROS);

function lerp(a, b, f) { return a + (b - a) * f; }

/** Wert einer Automationsspur (Haltewert, linear, weich) an Taktposition */
export function evalLane(points, bar) {
  if (!points?.length) return 0;
  if (bar <= points[0][0]) return points[0][1];
  for (let i = 0; i < points.length - 1; i++) {
    const [b0, v0, curve] = points[i];
    const [b1, v1] = points[i + 1];
    if (bar < b1) {
      const f = (bar - b0) / Math.max(1e-9, b1 - b0);
      if (curve === 'hold') return v0;
      if (curve === 'smooth') return lerp(v0, v1, f * f * (3 - 2 * f));
      return lerp(v0, v1, f);
    }
  }
  return points[points.length - 1][1];
}

export class EurorackEngine {
  constructor(ctx, destination, opts = {}) {
    this.ctx = ctx;
    this.destination = destination;
    this.modules = new Map();
    this.cables = [];
    this.lastEvents = new Map();
    this.layout = [];
    this.name = 'Rack';
    this.bpm = 59;
    this.beatsPerBar = 4;
    this.mode = 'auto';
    this.autoBass = true;
    this.macros = { bright: 0.5, width: 0.75, motion: 0.35, density: 0.5, space: 0.35 };
    this.arrangement = { totalBars: 60, gateOffBar: 57, chordPlan: [], sections: [], lanes: {} };
    this.laneAuto = {};
    this.playing = false;
    this.ended = false;
    this.pos = 0;
    this.posAtStart = 0;
    this.startAt = 0;
    this.nextChordPos = Infinity;
    this.nextChordTime = Infinity;
    this.gateOffDone = false;
    this.onChange = null;
    this.onEnded = null;
    this.onWarning = null;
    this.timer = opts.timer === false ? null : setInterval(() => this.tick(), 25);   // einziger Scheduler
  }

  // ───────────────────────────── Zeit ──
  get secPerBar() { return (60 / this.bpm) * this.beatsPerBar; }
  get totalSec() { return this.arrangement.totalBars * this.secPerBar; }
  position(t = this.ctx.currentTime) { return this.playing ? this.posAtStart + Math.max(0, t - this.startAt) : this.pos; }

  plan() {
    const h = this.modules.get('harmony');
    if (this.mode === 'auto' && this.arrangement.chordPlan.length) return { items: this.arrangement.chordPlan, loop: false };
    return { items: (h?.chords ?? []).map((c, i) => ({ chord: i, bars: c.bars })), loop: true };
  }

  /** Akkord an Position (Sekunden) + Ende des Abschnitts */
  chordAt(posSec) {
    const { items, loop } = this.plan();
    if (!items.length) return { idx: 0, end: Infinity };
    const spb = this.secPerBar;
    const cycle = items.reduce((a, c) => a + c.bars, 0) * spb;
    let base = 0, p = posSec;
    if (loop) { base = Math.floor(p / cycle) * cycle; p -= base; }
    let acc = 0;
    for (const it of items) {
      const len = it.bars * spb;
      if (p < acc + len - 1e-9) return { idx: it.chord, end: base + acc + len };
      acc += len;
    }
    return loop ? { idx: items[0].chord, end: base + cycle + items[0].bars * spb } : { idx: items[items.length - 1].chord, end: Infinity };
  }

  sectionAt(bar) {
    return this.arrangement.sections.find((s) => bar >= s.startBar && bar < s.startBar + s.bars) ?? null;
  }

  visual(t = this.ctx.currentTime) {
    const pos = this.position(t);
    const h = this.modules.get('harmony');
    const bar = pos / this.secPerBar;
    return {
      playing: this.playing, ended: this.ended, pos, bar, totalBars: this.arrangement.totalBars,
      chordIdx: h ? (h.hold ? h.holdIdx : this.chordAt(pos).idx) : 0, section: this.mode === 'auto' ? this.sectionAt(bar) : null,
    };
  }

  // ───────────────────────────── Transport ──
  play() {
    if (this.playing) return;
    const h = this.modules.get('harmony');
    if (!h) return;
    const now = this.ctx.currentTime;
    if (this.mode === 'auto' && this.pos >= this.totalSec - 1e-6) this.pos = 0;
    if (this.pos === 0) MACRO_KEYS.concat(['build', 'bass']).forEach((k) => { this.laneAuto[k] = true; });
    this.startAt = now + 0.06;
    this.posAtStart = this.pos;
    this.playing = true;
    this.ended = false;
    this.gateOffDone = this.mode === 'auto' && this.pos >= this.arrangement.gateOffBar * this.secPerBar;
    if (this.mode === 'auto') {
      if (this.autoBass) this.modules.get('mixer')?.set('bassMute', 0, now, 0.05);
      this.applyLanes(this.pos / this.secPerBar, now, 0.03);
    }
    const { idx, end } = this.chordAt(this.pos);
    if (!h.hold) h.playChord(idx, this.startAt); else h.playChord(h.holdIdx, this.startAt);
    h.setGate(true, this.startAt);
    this.nextChordPos = end;
    this.nextChordTime = this.startAt + (end - this.posAtStart);
    this.onChange?.('transport');
  }

  pause() {
    if (!this.playing) return;
    const now = this.ctx.currentTime;
    this.pos = this.position(now);
    this.playing = false;
    const h = this.modules.get('harmony');
    if (h && !h.hold) h.setGate(false, now);
    this.onChange?.('transport');
  }

  stop() {
    const now = this.ctx.currentTime;
    this.playing = false;
    this.ended = false;
    this.pos = 0;
    const h = this.modules.get('harmony');
    if (h && !h.hold) h.setGate(false, now);   // Release klingt aus, Hallfahne bleibt
    this.onChange?.('transport');
  }

  seek(bar) {
    const sec = clamp(bar, 0, this.arrangement.totalBars) * this.secPerBar;
    const now = this.ctx.currentTime;
    if (!this.playing) { this.pos = sec; this.onChange?.('transport'); return; }
    this.posAtStart = sec;
    this.startAt = now + 0.05;
    const h = this.modules.get('harmony');
    const { idx, end } = this.chordAt(sec);
    if (h && !h.hold) h.playChord(idx, this.startAt);
    this.nextChordPos = end;
    this.nextChordTime = this.startAt + (end - sec);
    this.gateOffDone = this.mode === 'auto' && sec >= this.arrangement.gateOffBar * this.secPerBar;
    if (this.mode === 'auto') this.applyLanes(sec / this.secPerBar, now, 0.1);
    if (h && !this.gateOffDone) h.setGate(true, this.startAt);
  }

  setMode(mode) {
    if (mode === this.mode) return;
    if (this.playing) this.stop();
    this.mode = mode;
    this.pos = 0;
    this.ended = false;
    MACRO_KEYS.concat(['build', 'bass']).forEach((k) => { this.laneAuto[k] = true; });
    this.onChange?.('mode');
  }

  setBpm(bpm) {
    const v = clamp(Number(bpm) || 59, 30, 200);
    if (this.playing) { this.pos = this.position(); this.posAtStart = this.pos; this.startAt = this.ctx.currentTime; }
    this.bpm = v;
    if (this.playing) {
      const { end } = this.chordAt(this.pos);
      this.nextChordPos = end;
      this.nextChordTime = this.startAt + (end - this.posAtStart);
    }
    this.onChange?.('bpm');
  }

  /** Manuelles Halten eines Akkords (Klangvergleich) */
  setHold(on, idx = null) {
    const h = this.modules.get('harmony');
    if (!h) return;
    const now = this.ctx.currentTime;
    if (on) {
      h.holdIdx = idx ?? (h.hold ? h.holdIdx : this.playing ? this.chordAt(this.position(now)).idx : h.cur);
      h.hold = true;
      h.playChord(h.holdIdx, now + 0.01);
      h.setGate(true, now + 0.01);
    } else {
      h.hold = false;
      if (this.playing) h.playChord(this.chordAt(this.position(now)).idx, now + 0.01);
      else h.setGate(false, now);
    }
    this.onChange?.('hold');
  }

  holdChord(idx) {
    const h = this.modules.get('harmony');
    if (!h?.hold) return;
    h.holdIdx = idx;
    h.playChord(idx, this.ctx.currentTime + 0.01);
    this.onChange?.('hold');
  }

  // ───────────────────────────── Scheduler ──
  tick(now = this.ctx.currentTime) {
    if (!this.playing) return;
    const h = this.modules.get('harmony');
    const horizon = now + 0.3;
    let guard = 0;
    while (this.nextChordTime < horizon && guard++ < 8) {
      if (!Number.isFinite(this.nextChordPos)) { this.nextChordTime = Infinity; break; }
      const { idx, end } = this.chordAt(this.nextChordPos + 1e-6);
      if (h && !h.hold) h.playChord(idx, this.nextChordTime);
      this.nextChordPos = end;
      this.nextChordTime = Number.isFinite(end) ? this.startAt + (end - this.posAtStart) : Infinity;
    }
    const pos = this.position(now);
    if (this.mode === 'auto') {
      this.applyLanes((this.posAtStart + (now + 0.15 - this.startAt)) / this.secPerBar, now, 0.2);
      const gateOffSec = this.arrangement.gateOffBar * this.secPerBar;
      if (!this.gateOffDone && pos >= gateOffSec - 0.35) {
        this.gateOffDone = true;
        const at = this.startAt + (gateOffSec - this.posAtStart);
        if (h && !h.hold) h.setGate(false, Math.max(at, now));
      }
      if (pos >= this.totalSec) {
        this.playing = false;
        this.ended = true;
        this.pos = this.totalSec;
        this.onEnded?.();
        this.onChange?.('transport');
      }
    }
  }

  /** Spuren auswerten und auf Makros / VCA / Bass schreiben (nur nicht übernommene Spuren) */
  applyLanes(bar, t, tc) {
    const lanes = this.arrangement.lanes;
    for (const key of Object.keys(lanes)) {
      if (!this.laneAuto[key]) continue;
      const v = evalLane(lanes[key].points, bar);
      if (key === 'build') this.modules.get('vca')?.set('level', v, t, tc);
      else if (key === 'bass') this.modules.get('mixer')?.set('bass', v, t, tc);
      else if (MACROS[key]) { this.macros[key] = v; this.applyMacro(key, v, t, tc); }
    }
  }

  // ───────────────────────────── Makros & Parameter ──
  applyMacro(key, v, t = this.ctx.currentTime, tc = 0.12) {
    const m = MACROS[key];
    if (!m) return;
    for (const tg of m.targets) this.modules.get(tg.mod)?.set(tg.param, tg.fn(v), t, tc);
  }

  setMacro(key, v, user = true) {
    if (!MACROS[key]) return;
    this.macros[key] = clamp(v, 0, 1);
    this.applyMacro(key, this.macros[key]);
    if (user) this.laneAuto[key] = false;
    this.onChange?.('macro');
  }

  /** Parameter durch Benutzer ändern; übernimmt ggf. die zugehörige Automationsspur */
  setParam(modId, param, value) {
    const m = this.modules.get(modId);
    if (!m) return;
    m.set(param, value);
    if (modId === 'vca' && param === 'level') this.laneAuto.build = false;
    if (modId === 'mixer' && param === 'bass') this.laneAuto.bass = false;
    this.onChange?.('param');
  }

  laneIsAuto(key) { return this.mode === 'auto' && this.playing && !!this.laneAuto[key] && !!this.arrangement.lanes[key]; }

  reengage(key) {
    this.laneAuto[key] = true;
    if (this.mode === 'auto') this.applyLanes(this.position() / this.secPerBar, this.ctx.currentTime, 0.4);
    this.onChange?.('lane');
  }

  // ───────────────────────────── Verkabelung ──
  cableId(from, to) { return `${from}->${to}`; }

  emit(fromId, port, ev) {
    this.lastEvents.set(`${fromId}:${port}`, ev);
    for (const c of this.cables) {
      if (c.fromId === fromId && c.fromPort === port && (c.signal === 'pitch' || c.signal === 'gate')) {
        this.modules.get(c.toId)?.onEvent(c.toPort, ev);
      }
    }
  }

  reaches(startId, targetId, seen = new Set()) {
    if (startId === targetId) return true;
    if (seen.has(startId)) return false;
    seen.add(startId);
    return this.cables.some((c) => (c.signal === 'audio' || c.signal === 'cv') && c.fromId === startId && this.reaches(c.toId, targetId, seen));
  }

  /** Kabel stecken. Liefert { ok, error?, cable? } mit verständlicher Fehlermeldung */
  connect(fromId, fromPort, toId, toPort, depth = 1) {
    const a = this.modules.get(fromId), b = this.modules.get(toId);
    if (!a || !b) return { ok: false, error: 'Modul nicht gefunden.' };
    const ja = a.meta.jacks.find((j) => j.id === fromPort), jb = b.meta.jacks.find((j) => j.id === toPort);
    if (!ja || !jb) return { ok: false, error: `Unbekannte Buchse (${fromPort} → ${toPort}).` };
    if (ja.dir !== 'out' || jb.dir !== 'in') return { ok: false, error: 'Ein Kabel führt von einem Ausgang zu einem Eingang.' };
    if (ja.fixed) return { ok: false, error: 'Der Master-Ausgang ist fest mit dem System verdrahtet.' };
    if (ja.sig !== jb.sig) return { ok: false, error: `Signaltypen passen nicht: ${ja.sig.toUpperCase()} kann nicht in einen ${jb.sig.toUpperCase()}-Eingang.` };
    if (a === b) return { ok: false, error: 'Ein Modul kann nicht mit sich selbst verbunden werden.' };
    if ((ja.sig === 'audio' || ja.sig === 'cv') && this.reaches(toId, fromId)) {
      return { ok: false, error: 'Rückkopplung abgelehnt: Diese Verbindung würde einen Signalkreis schließen.' };
    }
    this.disconnectInput(toId, toPort);
    const cable = { id: this.cableId(`${fromId}:${fromPort}`, `${toId}:${toPort}`), fromId, fromPort, toId, toPort, signal: ja.sig, depth: clamp(depth, 0, 2) };
    if (cable.signal === 'audio') {
      a.audioOut[fromPort].connect(b.audioIn[toPort]);
    } else if (cable.signal === 'cv') {
      const tgt = b.cvIn[toPort];
      cable.gain = this.ctx.createGain();
      cable.gain.gain.value = cable.depth * tgt.scale;
      a.audioOut[fromPort].connect(cable.gain);
      cable.gain.connect(tgt.target);
    }
    this.cables.push(cable);
    if (cable.signal === 'pitch' || cable.signal === 'gate') {
      const last = this.lastEvents.get(`${fromId}:${fromPort}`);
      if (last && (last.kind === 'pitch' || last.open)) b.onEvent(toPort, { ...last, time: this.ctx.currentTime + 0.02 });
    }
    this.onChange?.('cables');
    return { ok: true, cable };
  }

  setCableDepth(id, depth) {
    const c = this.cables.find((x) => x.id === id);
    if (!c || c.signal !== 'cv') return;
    c.depth = clamp(depth, 0, 2);
    const tgt = this.modules.get(c.toId).cvIn[c.toPort];
    c.gain.gain.setTargetAtTime(c.depth * tgt.scale, this.ctx.currentTime, 0.05);
    this.onChange?.('cables');
  }

  disconnectCable(c) {
    const a = this.modules.get(c.fromId), b = this.modules.get(c.toId);
    try {
      if (c.signal === 'audio' && a && b) a.audioOut[c.fromPort].disconnect(b.audioIn[c.toPort]);
      else if (c.signal === 'cv') { a?.audioOut[c.fromPort].disconnect(c.gain); c.gain.disconnect(); }
    } catch { /* bereits getrennt */ }
    if (c.signal === 'gate' && b) b.onEvent(c.toPort, { kind: 'gate', open: false, time: this.ctx.currentTime + 0.02 });
    this.cables = this.cables.filter((x) => x !== c);
  }

  disconnect(id) {
    const c = this.cables.find((x) => x.id === id);
    if (!c) return false;
    this.disconnectCable(c);
    this.onChange?.('cables');
    return true;
  }

  disconnectAll() {
    const all = [...this.cables];
    all.forEach((c) => this.disconnectCable(c));
    this.onChange?.('cables');
  }

  /** Spielt eine MIDI-Note frei über Tastatur/Sequenzer an */
  playNote(midiNote, velocity = 1, time = this.ctx.currentTime) {
    const h = this.modules.get('harmony');
    if (h) {
      h.sounding = true;
      const notes = [midiNote, midiNote, midiNote, midiNote];
      h.emit('pitchOut', { kind: 'pitch', notes, time });
      h.emit('rootOut', { kind: 'pitch', notes: [Math.max(24, midiNote - 24)], time });
      h.setGate(true, time);
    }
  }

  stopNote(midiNote, time = this.ctx.currentTime) {
    const h = this.modules.get('harmony');
    if (h) {
      h.setGate(false, time);
    } else {
      this.emit('harmony', 'gateOut', { kind: 'gate', open: false, time });
    }
  }

  disconnectInput(toId, toPort) {
    this.cables.filter((c) => c.toId === toId && c.toPort === toPort).forEach((c) => this.disconnectCable(c));
  }

  // ───────────────────────────── Module & Zustand ──
  addModule(spec, index = 0) {
    const Type = MODULE_TYPES[spec.type];
    const mod = spec.type === 'lfo' ? new LfoModule(this.ctx, spec.id, index + 1) : new Type(this.ctx, spec.id);
    mod.host = this;
    const unknown = mod.boot(spec);
    this.modules.set(spec.id, mod);
    if (spec.type === 'mixer') mod.audioOut.out.connect(this.destination);
    return { mod, unknown };
  }

  removeModule(id) {
    const m = this.modules.get(id);
    if (!m) return;
    this.cables.filter((c) => c.fromId === id || c.toId === id).forEach((c) => this.disconnectCable(c));
    if (m.meta.type === 'mixer') { try { m.audioOut.out.disconnect(this.destination); } catch { /* ignore */ } }
    m.destroy();
    this.modules.delete(id);
  }

  getState() {
    return {
      format: STATE_FORMAT,
      version: STATE_VERSION,
      name: this.name,
      bpm: this.bpm,
      beatsPerBar: this.beatsPerBar,
      mode: this.mode,
      autoBass: this.autoBass,
      macros: { ...this.macros },
      arrangement: JSON.parse(JSON.stringify(this.arrangement)),
      layout: this.layout.map((r) => [...r]),
      modules: [...this.modules.values()].map((m) => m.getState()),
      cables: this.cables.map((c) => ({ from: `${c.fromId}:${c.fromPort}`, to: `${c.toId}:${c.toPort}`, depth: c.depth })),
    };
  }

  /**
   * Zustand laden. Läuft Audio, bleiben vorhandene Module bestehen (kein Neustart); nur Werte/Kabel werden angeglichen.
   * Ungültiges wird nicht stillschweigend übernommen: Rückgabe enthält warnings[].
   */
  loadState(state) {
    const warnings = [];
    if (!state || state.format !== STATE_FORMAT) return { ok: false, error: `Keine Eurorack-Datei (Format „${STATE_FORMAT}“ fehlt).`, warnings };
    if (!Number.isFinite(state.version) || state.version < 1 || state.version > STATE_VERSION) {
      return { ok: false, error: `Dateiversion ${state.version} wird nicht unterstützt (unterstützt: 1 bis ${STATE_VERSION}).`, warnings };
    }
    if (!Array.isArray(state.modules)) return { ok: false, error: 'Die Datei enthält keine Modulliste.', warnings };

    if (this.playing) this.stop();
    this.cables.slice().forEach((c) => this.disconnectCable(c));
    const keep = new Set();
    state.modules.forEach((spec, i) => {
      const Type = MODULE_TYPES[spec.type];
      if (!Type) { warnings.push(`Unbekanntes Modul „${spec.type}“ (${spec.id}) wurde übersprungen.`); return; }
      if (!spec.id) { warnings.push(`Modul vom Typ „${spec.type}“ ohne ID übersprungen.`); return; }
      keep.add(spec.id);
      const existing = this.modules.get(spec.id);
      if (existing && existing.meta === Type) {
        const known = new Set(Type.params.map((p) => p.id));
        Object.keys(spec.values || {}).forEach((k) => { if (!known.has(k)) warnings.push(`${spec.id}: unbekannter Parameter „${k}“ ignoriert.`); });
        Type.params.forEach((p) => { if (Number.isFinite(spec.values?.[p.id])) existing.set(p.id, spec.values[p.id], null, 0.15); else existing.set(p.id, p.value, null, 0.15); });
        if (spec.extra) existing.setExtra(spec.extra);
      } else {
        if (existing) this.removeModule(spec.id);
        const { unknown } = this.addModule(spec, i);
        unknown.forEach((k) => warnings.push(`${spec.id}: unbekannter Parameter „${k}“ ignoriert.`));
      }
    });
    [...this.modules.keys()].filter((id) => !keep.has(id)).forEach((id) => this.removeModule(id));
    (state.cables || []).forEach((c) => {
      const [f, fp] = String(c.from).split(':'), [t, tp] = String(c.to).split(':');
      const r = this.connect(f, fp, t, tp, c.depth ?? 1);
      if (!r.ok) warnings.push(`Kabel ${c.from} → ${c.to}: ${r.error}`);
    });
    this.name = state.name ?? this.name;
    this.bpm = clamp(Number(state.bpm) || 59, 30, 200);
    this.beatsPerBar = clamp(Math.round(state.beatsPerBar) || 4, 2, 8);
    this.mode = state.mode === 'manual' ? 'manual' : 'auto';
    this.autoBass = state.autoBass !== false;
    MACRO_KEYS.forEach((k) => { if (Number.isFinite(state.macros?.[k])) this.macros[k] = clamp(state.macros[k], 0, 1); });
    if (state.arrangement) this.arrangement = JSON.parse(JSON.stringify(state.arrangement));
    this.layout = Array.isArray(state.layout) ? state.layout.map((r) => r.filter((id) => this.modules.has(id))) : [[...this.modules.keys()]];
    this.pos = 0; this.ended = false;
    MACRO_KEYS.concat(['build', 'bass']).forEach((k) => { this.laneAuto[k] = true; });
    this.modules.get('harmony')?.replay(this.ctx.currentTime);
    this.onChange?.('load');
    return { ok: true, warnings };
  }

  dispose() {
    clearInterval(this.timer);
    [...this.modules.keys()].forEach((id) => this.removeModule(id));
  }
}

