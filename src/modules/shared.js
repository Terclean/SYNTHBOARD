// SYNTHBOARD – Gemeinsame Grundfunktionen der neuen Instrumente
// Velocity-Empfindlichkeit, Mutation mit Parametersperren und die zugehörige UI.
import { SourceBase } from './base.js';

/** Regler, die jedes neue Instrument besitzt */
export const COMMON_PARAMS = [
  { id: 'velSens', label: 'Velocity', min: 0, max: 1, value: 0.6, fmt: 'pct' },
  { id: 'mutation', label: 'Mutation', min: 0, max: 1, value: 0.3, fmt: 'pct' },
];

/** Trigger-Eingang, der eine Mutation auslöst */
export const MUTATE_JACK = { id: 'mutateIn', type: 'in', signal: 'gate', label: 'MUTATE' };

export const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Cache für Sättigungskurven (grob quantisiert, damit nicht pro Anschlag neu gerechnet wird) */
const shaperCache = new Map();
export function getShaperCurve(amount, steps = 8) {
  const q = Math.round(clamp(amount) * steps);
  if (shaperCache.has(q)) return shaperCache.get(q);
  const n = 1024;
  const curve = new Float32Array(n);
  const k = 1 + (q / steps) * 9;
  const norm = Math.tanh(k);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1;
    curve[i] = Math.tanh(k * x) / norm;
  }
  shaperCache.set(q, curve);
  return curve;
}

/**
 * Basis für die neuen Instrumente:
 * - Velocity-Empfindlichkeit (this.vel)
 * - Mutation: zufällige Klangveränderung, gesperrte Parameter bleiben fest
 * - Mutation per Trigger-Eingang (MUTATE) oder Knopf
 */
export class VoiceBase extends SourceBase {
  /** Parameter, die nie mutiert werden */
  static mutateSkipParams = ['level', 'mutation', 'velSens'];
  static mutateSkipOptions = [];
  /** Standardmäßig gesperrte Parameter (z. B. Stimmung) */
  static defaultLocks = [];

  constructor(ctx, state = {}) {
    super(ctx, state);
    const saved = state.extra?.locks;
    this.locks = new Set(Array.isArray(saved) ? saved : this.meta.defaultLocks);
    this.notifyChanged = null; // wird von der UI gesetzt (Autosave)
    this.refreshKnobs = null;  // wird von der UI gesetzt (Regler nachziehen)
  }

  /** Wirksame Velocity: Empfindlichkeit 0 = immer volle Lautstärke, 1 = voll dynamisch */
  vel(v = 1) {
    const s = this.values.velSens ?? 0.6;
    return 1 - s + s * clamp(v, 0, 1.2);
  }

  /** Mutierbare Parameter & Optionen (für Sperr-Chips) */
  mutableItems() {
    const M = this.meta;
    return [
      ...M.params.filter((p) => !M.mutateSkipParams.includes(p.id)).map((p) => ({ id: p.id, label: p.label })),
      ...M.options.filter((o) => !M.mutateSkipOptions.includes(o.id)).map((o) => ({ id: o.id, label: o.label })),
    ];
  }

  mutate(amount = this.values.mutation ?? 0.3) {
    const M = this.meta;
    for (const p of M.params) {
      if (M.mutateSkipParams.includes(p.id) || this.locks.has(p.id)) continue;
      const cur = this.values[p.id];
      const lo = p.log ? Math.log(p.min) : p.min;
      const hi = p.log ? Math.log(p.max) : p.max;
      let n = ((p.log ? Math.log(cur) : cur) - lo) / (hi - lo);
      n = clamp(n + (Math.random() * 2 - 1) * amount * 0.6);
      const raw = lo + n * (hi - lo);
      const v = p.log ? Math.exp(raw) : raw;
      this.setParam(p.id, p.fmt === 'int' ? Math.round(v) : v);
    }
    for (const o of M.options) {
      if (M.mutateSkipOptions.includes(o.id) || this.locks.has(o.id)) continue;
      if (Math.random() < amount * 0.35) {
        const choice = o.choices[Math.floor(Math.random() * o.choices.length)];
        this.setParam(o.id, choice[0]);
      }
    }
    this.refreshKnobs?.();
    this.notifyChanged?.();
    this.flashMutate?.();
  }

  /** Mutation-Trigger aus dem Patch; gibt true zurück, wenn behandelt */
  handleMutateTrigger(portId) {
    if (portId !== 'mutateIn') return false;
    this.mutate();
    return true;
  }

  voiceExtra() { return {}; }

  getExtra() {
    return { locks: [...this.locks], ...this.voiceExtra() };
  }

  /** Instrumentspezifisches Zusatz-UI (Subklassen überschreiben diese Methode) */
  renderBody(_el, _helpers) {}

  renderExtra(el, helpers = {}) {
    const changed = helpers.changed || (() => {});
    const items = this.mutableItems();
    el.innerHTML = `
      <div class="voice-body"></div>
      <div class="mut-panel">
        <div class="mut-head">
          <button class="mini-btn mut-go" title="Würfelt alle ungesperrten Parameter neu (Stärke = Mutation-Regler)">🎲 MUTATE</button>
          <span class="mut-hint">🔒 gesperrt = bleibt fest</span>
        </div>
        <div class="lock-row">
          ${items.map((it) => `<button class="lock-chip ${this.locks.has(it.id) ? 'on' : ''}" data-id="${it.id}" title="Parameter sperren / freigeben">${this.locks.has(it.id) ? '🔒' : '🎲'} ${esc(it.label)}</button>`).join('')}
        </div>
      </div>`;

    this.renderBody(el.querySelector('.voice-body'), helpers);

    const go = el.querySelector('.mut-go');
    this.flashMutate = () => {
      go.classList.add('flash');
      setTimeout(() => go.classList.remove('flash'), 220);
    };
    go.addEventListener('click', () => this.mutate());
    el.querySelectorAll('.lock-chip').forEach((chip) => chip.addEventListener('click', () => {
      const id = chip.dataset.id;
      if (this.locks.has(id)) this.locks.delete(id); else this.locks.add(id);
      const on = this.locks.has(id);
      chip.classList.toggle('on', on);
      chip.textContent = `${on ? '🔒' : '🎲'} ${items.find((i) => i.id === id)?.label ?? id}`;
      changed();
    }));
  }
}

/** Kleine Hilfsfunktion: Audio-Nodes nach Ende einer Quelle trennen */
export function cleanupOnEnd(node, nodes) {
  node.onended = () => nodes.forEach((n) => { try { n.disconnect(); } catch { /* ignore */ } });
}
