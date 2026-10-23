// SYNTHBOARD – Scene Conductor
// Steuert ganze Szenen (Ambient → Downtempo → Broken Beat → Techno): Rhythmus, Klangfarben,
// Notendichte und Raum wechseln gemeinsam – quantisiert, überblendet und mutierbar.
import { ModuleBase, SCALES, scaleNote } from './base.js';
import { clamp, lerp } from './shared.js';

const LANES = [
  { id: 'kick', label: 'KICK', port: 'kickOut', color: '#fb7185' },
  { id: 'snare', label: 'SNARE', port: 'snareOut', color: '#f97316' },
  { id: 'hat', label: 'HAT', port: 'hatOut', color: '#facc15' },
  { id: 'perc', label: 'PERC', port: 'percOut', color: '#a3e635' },
  { id: 'bass', label: 'BASS', port: 'bassGate', color: '#34d399' },
  { id: 'lead', label: 'LEAD', port: 'leadGate', color: '#60a5fa' },
];

/** '.' = nie, 'x' = immer, '1'–'9' = 10–90 % Wahrscheinlichkeit */
const P = (s) => Array.from(s.padEnd(16, '.').slice(0, 16), (c) => (c === '.' ? 0 : c === 'x' ? 1 : Number(c) / 10));

const SCENES = [
  {
    name: 'Ambient', icon: '🌫',
    patterns: {
      kick: P('................'), snare: P('................'), hat: P('1.1.1.1.1.1.1.1.'),
      perc: P('.1..1..1..1..1..'), bass: P('4...............'), lead: P('1111111111111111'),
    },
    bassDeg: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], bassLen: 12, leadLen: 5, leap: 3,
    mods: { pad: 0.9, cloud: 0.85, energy: 0.1, space: 0.9, timbre: 0.25 },
  },
  {
    name: 'Downtempo', icon: '🌆',
    patterns: {
      kick: P('x......3..7....3'), snare: P('....x.......x..2'), hat: P('8.4.8.4.8.4.8.43'),
      perc: P('...3..4....3..3.'), bass: P('x.....6...8.....'), lead: P('..3..2..4..2..3.'),
    },
    bassDeg: [0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0, 0, 0], bassLen: 3, leadLen: 2, leap: 2,
    mods: { pad: 0.55, cloud: 0.35, energy: 0.4, space: 0.6, timbre: 0.4 },
  },
  {
    name: 'Broken Beat', icon: '🧩',
    patterns: {
      kick: P('x..6..8..5..7..3'), snare: P('....x..4..3.x.5.'), hat: P('7597759775977599'),
      perc: P('.4.5..6.5.45.5.6'), bass: P('x..6..7..5..8..4'), lead: P('5.3..5.3.4.5..4.'),
    },
    bassDeg: [0, 0, 0, 2, 0, 0, 0, 0, 0, 3, 0, 0, 4, 0, 0, 2], bassLen: 2, leadLen: 1.4, leap: 3,
    mods: { pad: 0.3, cloud: 0.55, energy: 0.7, space: 0.35, timbre: 0.65 },
  },
  {
    name: 'Techno', icon: '⚙',
    patterns: {
      kick: P('x...x...x...x...'), snare: P('....x.......x...'), hat: P('2.x.2.x.2.x.2.x.'),
      perc: P('.3.4.3.4.3.4.3.5'), bass: P('..x...x...x...x6'), lead: P('x.6.7.6.8.6.7.63'),
    },
    bassDeg: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2], bassLen: 1.1, leadLen: 0.8, leap: 0, arp: [0, 2, 4, 7, 4, 2],
    mods: { pad: 0.15, cloud: 0.2, energy: 1, space: 0.2, timbre: 0.8 },
  },
];

const KEYS = [[0, 'C'], [1, 'C#'], [2, 'D'], [3, 'D#'], [4, 'E'], [5, 'F'], [6, 'F#'], [7, 'G'], [8, 'G#'], [9, 'A'], [10, 'B♭'], [11, 'B']];
const MOD_KEYS = ['pad', 'cloud', 'energy', 'space', 'timbre'];
const clonePatterns = () => SCENES.map((s) => Object.fromEntries(LANES.map((l) => [l.id, [...s.patterns[l.id]]])));
const smooth = (x) => x * x * (3 - 2 * x);

export class SceneConductorModule extends ModuleBase {
  static type = 'scene_conductor';
  static title = 'Scene Conductor';
  static category = 'control';
  static color = '#e879f9';
  static icon = '🎬';
  static description = 'Wechselt ganze Szenen (Ambient → Downtempo → Broken Beat → Techno): Rhythmus, Klangfarben, Dichte und Raum';
  static params = [
    { id: 'amount', label: 'Stärke', min: 0.1, max: 1, value: 1, fmt: 'pct' },
    { id: 'density', label: 'Dichte', min: 0.3, max: 1.6, value: 1, fmt: 'x' },
    { id: 'vary', label: 'Variation', min: 0, max: 1, value: 0.15, fmt: 'pct' },
    { id: 'mutation', label: 'Mutation', min: 0, max: 1, value: 0.35, fmt: 'pct' },
  ];
  static options = [
    { id: 'quant', label: 'Wann', choices: [['now', 'Sofort'], ['beat', 'Nächster Schlag'], ['bar', 'Nächster Takt'], ['phrase', 'Nächste Phrase']], value: 'bar' },
    { id: 'xfade', label: 'Wie', choices: [['0', 'Harter Wechsel'], ['1', '1 Takt'], ['2', '2 Takte'], ['4', '4 Takte'], ['8', '8 Takte']], value: '2' },
    { id: 'scope', label: 'Was', choices: [['all', 'Ganze Szene'], ['rhythm', 'Nur Rhythmus'], ['timbre', 'Nur Klangfarben']], value: 'all' },
    { id: 'auto', label: 'Auto-Wechsel', choices: [['0', 'Aus'], ['4', 'alle 4 Takte'], ['8', 'alle 8 Takte'], ['16', 'alle 16 Takte'], ['32', 'alle 32 Takte']], value: '0' },
    { id: 'brk', label: 'Break-Länge', choices: [['1', '1 Takt'], ['2', '2 Takte'], ['4', '4 Takte']], value: '1' },
    { id: 'fx', label: 'Hall folgt', choices: [['off', 'Aus'], ['on', 'Hall & Delay']], value: 'off' },
    { id: 'key', label: 'Grundton', choices: KEYS, value: 9 },
    { id: 'scale', label: 'Skala', choices: Object.entries(SCALES).map(([k, s]) => [k, s.name]), value: 'minorPenta' },
  ];
  static jacks = [
    { id: 'clockIn', type: 'in', signal: 'clock', label: 'CLOCK' },
    { id: 'nextIn', type: 'in', signal: 'gate', label: 'NEXT SCENE' },
    { id: 'returnIn', type: 'in', signal: 'gate', label: 'RETURN' },
    { id: 'fillIn', type: 'in', signal: 'gate', label: 'FILL' },
    { id: 'breakIn', type: 'in', signal: 'gate', label: 'BREAK' },
    { id: 'mutateIn', type: 'in', signal: 'gate', label: 'MUTATE' },
    { id: 'kickOut', type: 'out', signal: 'gate', label: 'KICK' },
    { id: 'snareOut', type: 'out', signal: 'gate', label: 'SNARE' },
    { id: 'hatOut', type: 'out', signal: 'gate', label: 'HAT' },
    { id: 'percOut', type: 'out', signal: 'gate', label: 'PERC' },
    { id: 'bassGate', type: 'out', signal: 'gate', label: 'BASS GATE' },
    { id: 'bassPitch', type: 'out', signal: 'pitch', label: 'BASS PITCH' },
    { id: 'leadGate', type: 'out', signal: 'gate', label: 'LEAD GATE' },
    { id: 'leadPitch', type: 'out', signal: 'pitch', label: 'LEAD PITCH' },
    { id: 'changeOut', type: 'out', signal: 'gate', label: 'CHANGE' },
    { id: 'padOut', type: 'out', signal: 'mod', label: 'PAD' },
    { id: 'cloudOut', type: 'out', signal: 'mod', label: 'CLOUD' },
    { id: 'energyOut', type: 'out', signal: 'mod', label: 'ENERGY' },
    { id: 'spaceOut', type: 'out', signal: 'mod', label: 'SPACE' },
    { id: 'timbreOut', type: 'out', signal: 'mod', label: 'TIMBRE' },
    { id: 'sceneOut', type: 'out', signal: 'mod', label: 'SCENE' },
  ];

  constructor(ctx, state = {}) {
    super(ctx, state);
    const ex = state.extra || {};
    const idx = Number.isInteger(ex.scene) && ex.scene >= 0 && ex.scene < SCENES.length ? ex.scene : 0;

    this.patterns = clonePatterns();
    if (Array.isArray(ex.patterns) && ex.patterns.length === SCENES.length) {
      ex.patterns.forEach((sp, i) => LANES.forEach((l) => {
        if (Array.isArray(sp?.[l.id]) && sp[l.id].length === 16) this.patterns[i][l.id] = sp[l.id].map((v) => clamp(Number(v) || 0));
      }));
    }
    this.locks = new Set(Array.isArray(ex.locks) ? ex.locks : []);
    this.mutes = new Set(Array.isArray(ex.mutes) ? ex.mutes : []);

    this.sceneIndex = idx;
    this.prevScene = idx;
    this.rhythm = { a: idx, b: idx, mix: 0, t: null };
    this.timbre = { a: idx, b: idx, mix: 0, t: null };
    this.pending = null;
    this.breakPending = false;
    this.breakEnd = 0;
    this.dropNext = false;
    this.fillStart = 0;
    this.fillEnd = 0;
    this.step = 0;
    this.stepDur = 0.15;
    this.lastClockTime = 0;
    this.leadDeg = 2;
    this.arpIdx = 0;
    this.mod = Object.fromEntries(MOD_KEYS.map((k) => [k, SCENES[idx].mods[k]]));
    this.sceneVal = idx;
    this.fxTouched = false;
    this.notifyChanged = null;

    this.initValues(state);
    this.timer = setInterval(() => this.tickMods(), 60);
  }

  hasClock() { return !!this.patchSystem?.hasIncoming(this.id, 'clockIn'); }
  opt(id) { return this.values[id]; }

  // ───────────────────────── Szenenwechsel ──
  boundaryHit(step) {
    switch (this.opt('quant')) {
      case 'beat': return step % 4 === 0;
      case 'bar': return step % 16 === 0;
      case 'phrase': return step % 64 === 0;
      default: return true;
    }
  }

  immediate() { return !this.hasClock() || this.opt('quant') === 'now'; }

  requestScene(target, time) {
    target = ((target % SCENES.length) + SCENES.length) % SCENES.length;
    if (this.immediate()) { this.executeChange(target, time); return; }
    this.pending = { target };
    this.refreshUi?.();
  }

  startLayer(layer, to, steps, amount) {
    const L = this[layer];
    const base = L.mix >= 0.5 ? L.b : L.a;
    L.a = base; L.b = to; L.mix = 0;
    if (steps <= 0) {
      L.t = null;
      L.mix = amount;
      if (amount >= 0.999) { L.a = to; L.b = to; L.mix = 0; }
    } else {
      L.t = { n: 0, steps, amount, to };
    }
  }

  executeChange(target, time) {
    const scope = this.opt('scope');
    const amount = this.values.amount;
    const steps = this.hasClock() ? Number(this.opt('xfade')) * 16 : 0;
    if (target !== this.sceneIndex) this.prevScene = this.sceneIndex;
    this.sceneIndex = target;
    this.pending = null;
    if (scope !== 'timbre') this.startLayer('rhythm', target, steps, amount);
    if (scope !== 'rhythm') this.startLayer('timbre', target, steps, amount);
    this.emitTrigger('changeOut', time, 1, 0.1);
    this.refreshUi?.();
    this.notifyChanged?.();
  }

  advanceLayers() {
    for (const key of ['rhythm', 'timbre']) {
      const L = this[key];
      if (!L.t) continue;
      L.t.n++;
      const p = clamp(L.t.n / L.t.steps);
      L.mix = L.t.amount * smooth(p);
      if (p >= 1) {
        L.mix = L.t.amount;
        if (L.t.amount >= 0.999) { L.a = L.t.to; L.b = L.t.to; L.mix = 0; }
        L.t = null;
      }
    }
  }

  // ───────────────────────── Fill / Break ──
  startFill() {
    const cur = this.step;
    const barEnd = cur - (cur % 16) + 16;
    this.fillEnd = barEnd - cur < 3 ? cur + 4 : barEnd;
    this.fillStart = Math.max(cur, this.fillEnd - 8);
    this.refreshUi?.();
  }

  requestBreak() {
    if (this.immediate()) this.startBreak(this.step);
    else { this.breakPending = true; this.refreshUi?.(); }
  }

  startBreak(step) {
    this.breakEnd = step + Number(this.opt('brk')) * 16;
    this.breakPending = false;
    this.refreshUi?.();
  }

  // ───────────────────────── Mutation ──
  mutate(amount = this.values.mutation) {
    const pats = this.patterns[this.sceneIndex];
    for (const lane of LANES) {
      if (this.locks.has(lane.id)) continue;
      const row = pats[lane.id];
      for (let s = 0; s < 16; s++) {
        if (Math.random() > amount * 0.28) continue;
        const v = row[s];
        if (v > 0 && Math.random() < 0.5) row[s] = 0;
        else if (v > 0) row[s] = clamp(v + (Math.random() - 0.5) * 0.5, 0.15, 1);
        else row[s] = s % 4 === 0 ? 0.35 + Math.random() * 0.4 : 0.2 + Math.random() * 0.5;
      }
    }
    this.refreshUi?.();
    this.notifyChanged?.();
    this.flashMutate?.();
  }

  resetPatterns() {
    this.patterns[this.sceneIndex] = Object.fromEntries(LANES.map((l) => [l.id, [...SCENES[this.sceneIndex].patterns[l.id]]]));
    this.refreshUi?.();
    this.notifyChanged?.();
  }

  // ───────────────────────── Eingänge ──
  onTrigger(portId, time) {
    if (!this.enabled) return;
    switch (portId) {
      case 'nextIn': this.requestScene((this.pending ? this.pending.target : this.sceneIndex) + 1, time); break;
      case 'returnIn': this.requestScene(this.prevScene, time); break;
      case 'fillIn': this.startFill(); break;
      case 'breakIn': this.requestBreak(); break;
      case 'mutateIn': this.mutate(); break;
      default:
    }
  }

  layerProb(L, lane, s) {
    const A = this.patterns[L.a][lane][s];
    if (!L.mix || L.a === L.b) return A;
    return Math.random() < L.mix ? this.patterns[L.b][lane][s] : A;
  }

  dominant(L) { return L.mix >= 0.5 ? L.b : L.a; }

  onClock(portId, time) {
    if (portId !== 'clockIn' || !this.enabled) return;
    const step = this.step++;
    const s16 = step % 16;
    if (this.lastClockTime) {
      const d = time - this.lastClockTime;
      if (d > 0.02 && d < 1) this.stepDur = d;
    }
    this.lastClockTime = time;

    // Quantisierte Wechsel ausführen
    if (this.pending && this.boundaryHit(step)) this.executeChange(this.pending.target, time);
    if (this.breakPending && this.boundaryHit(step)) this.startBreak(step);
    const auto = Number(this.opt('auto'));
    if (auto > 0 && step > 0 && step % (auto * 16) === 0 && !this.pending) {
      this.executeChange((this.sceneIndex + 1) % SCENES.length, time);
    }

    let dropNow = false;
    if (this.breakEnd && step >= this.breakEnd) { this.breakEnd = 0; dropNow = true; this.emitTrigger('changeOut', time, 1, 0.1); }
    const inBreak = this.breakEnd > 0 && step < this.breakEnd;
    const inFill = step >= this.fillStart && step < this.fillEnd;
    const fq = inFill ? (step - this.fillStart) / Math.max(1, this.fillEnd - this.fillStart) : 0;

    this.advanceLayers();

    const V = this.values;
    const dens = V.density;
    const sceneR = SCENES[this.dominant(this.rhythm)];
    const hits = [];

    for (const lane of LANES) {
      if (this.mutes.has(lane.id)) continue;
      let p = this.layerProb(this.rhythm, lane.id, s16);

      // Break: Fundament weg, Fläche bleibt
      if (inBreak) {
        if (['kick', 'bass', 'hat'].includes(lane.id)) p = 0;
        else p *= 0.3;
      }
      // Fill: Snare-Wirbel, dichtere Hats & Percussion, Kick fällt am Ende weg
      if (inFill) {
        if (lane.id === 'snare') p = Math.max(p, 0.3 + 0.7 * fq);
        else if (lane.id === 'hat') p = Math.max(p, 0.6);
        else if (lane.id === 'perc') p = Math.max(p, 0.2 + 0.4 * fq);
        else if (lane.id === 'kick' && fq > 0.75) p = 0;
      }
      if (dropNow && lane.id === 'kick' && s16 === 0) p = 1;

      p = clamp(p * dens);
      // Variation: zufällige Geisterschläge und Aussetzer
      if (V.vary > 0 && (lane.id === 'hat' || lane.id === 'perc') && p === 0 && Math.random() < V.vary * 0.06) p = 1;
      if (V.vary > 0 && lane.id !== 'kick' && p > 0 && Math.random() < V.vary * 0.1) p = 0;
      if (p > 0 && Math.random() < p) {
        let vel = 0.72 + 0.28 * clamp(p) + (s16 % 4 === 0 ? 0.1 : 0) + (Math.random() - 0.5) * 0.15;
        if (inFill) vel = lerp(0.6, 1, fq);
        hits.push([lane, clamp(vel, 0.3, 1)]);
      }
    }

    const key = Number(V.key ?? 9);
    const scale = V.scale || 'minorPenta';
    for (const [lane, vel] of hits) {
      if (lane.id === 'bass') {
        const deg = sceneR.bassDeg[s16] + (Math.random() < 0.08 ? 2 : 0);
        this.emitPitch('bassPitch', time, scaleNote(36 + key, scale, deg), vel, 0.1);
        this.emitTrigger('bassGate', time, vel, Math.max(0.05, sceneR.bassLen * this.stepDur));
      } else if (lane.id === 'lead') {
        let deg;
        if (sceneR.arp) { deg = sceneR.arp[this.arpIdx++ % sceneR.arp.length]; } else {
          this.leadDeg = clamp(this.leadDeg + Math.round((Math.random() * 2 - 1) * (sceneR.leap || 1)), -2, 9);
          deg = this.leadDeg;
        }
        this.emitPitch('leadPitch', time, scaleNote(60 + key, scale, deg), vel, 0.1);
        this.emitTrigger('leadGate', time, vel, Math.max(0.05, sceneR.leadLen * this.stepDur));
      } else {
        this.emitTrigger(lane.port, time, vel, 0.08);
      }
    }

    const delayMs = Math.max(0, (time - this.ctx.currentTime) * 1000);
    setTimeout(() => this.uiStep?.(s16, hits.map(([l]) => l.id)), delayMs);
  }

  // ───────────────────────── Modulationsausgänge ──
  tickMods() {
    if (!this.enabled) return;
    const now = this.ctx.currentTime;
    const T = this.timbre;
    const target = {};
    for (const k of MOD_KEYS) target[k] = lerp(SCENES[T.a].mods[k], SCENES[T.b].mods[k], T.mix);
    const step = this.step;
    if (this.breakEnd > 0 && step < this.breakEnd) {
      target.pad = 1; target.cloud = 1; target.space = lerp(target.space, 1, 0.8); target.energy = 0.1;
    }
    if (step >= this.fillStart && step < this.fillEnd) target.energy = clamp(target.energy + 0.25);
    for (const k of MOD_KEYS) this.mod[k] += (target[k] - this.mod[k]) * 0.18;
    this.sceneVal += (lerp(T.a, T.b, T.mix) - this.sceneVal) * 0.2;

    this.emitMod('padOut', this.mod.pad, now);
    this.emitMod('cloudOut', this.mod.cloud, now);
    this.emitMod('energyOut', this.mod.energy, now);
    this.emitMod('spaceOut', this.mod.space, now);
    this.emitMod('timbreOut', this.mod.timbre, now);
    this.emitMod('sceneOut', this.sceneVal / (SCENES.length - 1), now);
    this.applyFx(this.mod.space);
    this.refreshUi?.();
  }

  /** Optional: Hall- und Delay-Anteil folgen dem Raum der Szene (Fahnen klingen natürlich weiter aus) */
  applyFx(space) {
    const eng = this.patchSystem?.engine;
    if (!eng?.findByType) return;
    const rev = eng.findByType('reverb');
    const dly = eng.findByType('delay');
    if (this.opt('fx') === 'on') {
      if (rev?.values.mix != null) rev.applyParam('mix', clamp(rev.values.mix * (0.35 + space * 0.95)));
      if (dly?.values.mix != null) dly.applyParam('mix', clamp(dly.values.mix * (0.55 + space * 0.7)));
      this.fxTouched = true;
    } else if (this.fxTouched) {
      if (rev?.values.mix != null) rev.applyParam('mix', rev.values.mix);
      if (dly?.values.mix != null) dly.applyParam('mix', dly.values.mix);
      this.fxTouched = false;
    }
  }

  getExtra() {
    return {
      scene: this.sceneIndex,
      patterns: this.patterns.map((sp) => Object.fromEntries(LANES.map((l) => [l.id, sp[l.id].map((v) => Math.round(v * 100) / 100)]))),
      locks: [...this.locks],
      mutes: [...this.mutes],
    };
  }

  // ───────────────────────── UI ──
  renderExtra(el, { changed } = {}) {
    el.innerHTML = `
      <div class="scene-bar">
        ${SCENES.map((s, i) => `<button class="scene-btn" data-i="${i}" title="Zu dieser Szene wechseln (Wann/Wie/Was siehe Optionen)"><span class="sc-ic">${s.icon}</span><span class="sc-nm">${s.name}</span></button>`).join('')}
      </div>
      <div class="scene-progress"><div class="scene-progress-fill"></div></div>
      <div class="scene-actions">
        <button class="mini-btn sc-next" title="Nächste Szene">⏭ NEXT</button>
        <button class="mini-btn sc-ret" title="Zurück zur vorherigen Szene">↩ RETURN</button>
        <button class="mini-btn sc-fill" title="Drum-Fill bis Taktende">🥁 FILL</button>
        <button class="mini-btn sc-break" title="Break: Fundament weg, Fläche und Raum wachsen">⏸ BREAK</button>
        <button class="mini-btn sc-mut" title="Würfelt die Muster der aktuellen Szene (gesperrte Spuren bleiben)">🎲 MUTATE</button>
        <button class="mini-btn sc-reset" title="Muster der Szene zurücksetzen">⟲</button>
      </div>
      <div class="scene-grid">
        ${LANES.map((l) => `
          <div class="scene-lane" data-lane="${l.id}" style="--lc:${l.color}">
            <button class="lane-lbl" title="Spur stumm / aktiv">${l.label}</button>
            <button class="lane-lock" title="Gegen Mutation sperren">🎲</button>
            <div class="lane-cells">${Array.from({ length: 16 }, (_, s) => `<i class="lane-cell ${s % 4 === 0 ? 'beat' : ''}" data-s="${s}"></i>`).join('')}</div>
          </div>`).join('')}
      </div>
      <div class="scene-status"></div>`;

    const btns = [...el.querySelectorAll('.scene-btn')];
    const fill = el.querySelector('.scene-progress-fill');
    const status = el.querySelector('.scene-status');
    const lanes = Object.fromEntries(LANES.map((l) => {
      const row = el.querySelector(`.scene-lane[data-lane="${l.id}"]`);
      return [l.id, { row, cells: [...row.querySelectorAll('.lane-cell')], lock: row.querySelector('.lane-lock'), lbl: row.querySelector('.lane-lbl') }];
    }));

    btns.forEach((b) => b.addEventListener('click', () => { this.requestScene(Number(b.dataset.i), this.ctx.currentTime); }));
    el.querySelector('.sc-next').addEventListener('click', () => this.onTrigger('nextIn', this.ctx.currentTime));
    el.querySelector('.sc-ret').addEventListener('click', () => this.onTrigger('returnIn', this.ctx.currentTime));
    el.querySelector('.sc-fill').addEventListener('click', () => this.startFill());
    el.querySelector('.sc-break').addEventListener('click', () => this.requestBreak());
    const mutBtn = el.querySelector('.sc-mut');
    mutBtn.addEventListener('click', () => this.mutate());
    el.querySelector('.sc-reset').addEventListener('click', () => this.resetPatterns());
    this.flashMutate = () => { mutBtn.classList.add('flash'); setTimeout(() => mutBtn.classList.remove('flash'), 220); };

    LANES.forEach((l) => {
      const ui = lanes[l.id];
      ui.lbl.addEventListener('click', () => {
        if (this.mutes.has(l.id)) this.mutes.delete(l.id); else this.mutes.add(l.id);
        this.refreshUi();
        (changed || this.notifyChanged)?.();
      });
      ui.lock.addEventListener('click', () => {
        if (this.locks.has(l.id)) this.locks.delete(l.id); else this.locks.add(l.id);
        this.refreshUi();
        (changed || this.notifyChanged)?.();
      });
    });
    if (changed) this.notifyChanged = this.notifyChanged || changed;

    const quantNames = { now: 'sofort', beat: 'nächsten Schlag', bar: 'nächsten Takt', phrase: 'nächste Phrase' };
    this.refreshUi = () => {
      if (!el.isConnected) return;
      const R = this.rhythm;
      btns.forEach((b, i) => {
        b.classList.toggle('active', i === this.sceneIndex);
        b.classList.toggle('pending', !!this.pending && this.pending.target === i);
      });
      const t = R.t || this.timbre.t;
      const prog = t ? clamp(t.n / t.steps) : 0;
      fill.style.width = `${prog * 100}%`;
      LANES.forEach((l) => {
        const ui = lanes[l.id];
        const A = this.patterns[R.a][l.id];
        const B = this.patterns[R.b][l.id];
        ui.cells.forEach((c, s) => c.style.setProperty('--p', String(lerp(A[s], B[s], R.mix)).slice(0, 4)));
        ui.row.classList.toggle('muted', this.mutes.has(l.id));
        const locked = this.locks.has(l.id);
        ui.lock.textContent = locked ? '🔒' : '🎲';
        ui.lock.classList.toggle('on', locked);
      });
      let txt = `<b>${SCENES[this.sceneIndex].icon} ${SCENES[this.sceneIndex].name}</b>`;
      if (this.pending) txt += ` · wechselt zu <b>${SCENES[this.pending.target].name}</b> (${quantNames[this.opt('quant')]})`;
      else if (R.t || this.timbre.t) txt += ` · Übergang ${Math.round(prog * 100)} %`;
      if (this.breakEnd > 0 || this.breakPending) txt += ' · ⏸ Break';
      if (this.step >= this.fillStart && this.step < this.fillEnd) txt += ' · 🥁 Fill';
      if (!this.hasClock()) txt += ' · <i>CLOCK verbinden für Takt-Wechsel</i>';
      status.innerHTML = txt;
    };

    let lastCol = 0;
    this.uiStep = (s16, hitLanes) => {
      if (!el.isConnected) return;
      LANES.forEach((l) => {
        const cells = lanes[l.id].cells;
        cells[lastCol].classList.remove('now');
        cells[s16].classList.add('now');
        if (hitLanes.includes(l.id)) {
          cells[s16].classList.add('hit');
          setTimeout(() => cells[s16].classList.remove('hit'), 130);
        }
      });
      lastCol = s16;
    };
    this.refreshUi();
  }

  destroy() {
    clearInterval(this.timer);
    if (this.fxTouched) { this.values.fx = 'off'; this.applyFx(0); }
    super.destroy();
  }
}
