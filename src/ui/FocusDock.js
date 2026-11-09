// FocusDock – Live-Controls im Performance-Board für bis zu 5 Regler
import { Knob } from './Knob.js';

export class FocusDock {
  constructor(containerEl, options = {}) {
    this.container = containerEl;
    this.onToast = options.onToast || (() => {});
    this.onModified = options.onModified || (() => {});
    this.onOpenSidebar = options.onOpenSidebar || (() => {});
    this.engine = options.engine || null;

    // Bis zu 5 gepinnte Regler: { id, modId, paramId, modTitle, modColor, label, customLabel, paramDef, modRef, fmtVal, origKnobRef }
    this.pinned = [];
    this.knobInstances = new Map(); // id -> Knob

    this.render();
  }

  get count() {
    return this.pinned.length;
  }

  isPinned(modId, paramId) {
    const id = `${modId}:${paramId}`;
    const idx = this.pinned.findIndex((x) => x.id === id);
    return idx >= 0 ? idx + 1 : 0;
  }

  toggle(item) {
    const existingIdx = this.pinned.findIndex((x) => x.id === item.id);
    if (existingIdx >= 0) {
      // Entfernen bei erneutem Shift-Klick
      const removed = this.pinned.splice(existingIdx, 1)[0];
      this.onToast(`✕ „${removed.customLabel || removed.label}“ aus Live-Controls entfernt`);
      this.render();
      this.updateRackBadges();
      this.onModified();
      return;
    }

    // Wenn bereits 5 Plätze belegt sind: Auswahl zum Ersetzen anbieten
    if (this.pinned.length >= 5) {
      this.promptReplacement(item);
      return;
    }

    this.pinned.push(item);
    this.onToast(`„${item.label}“ (#${this.pinned.length}) als Live-Control zugewiesen`);
    this.onOpenSidebar();
    this.render();
    this.updateRackBadges();
    this.onModified();
  }

  promptReplacement(newItem) {
    const slotChoices = this.pinned
      .map((p, i) => `#${i + 1}: ${p.customLabel || p.label} (${p.modTitle})`)
      .join('\n');

    const choice = prompt(
      `Alle 5 Live-Control-Plätze sind belegt!\n\nWelchen Platz möchtest du mit „${newItem.label} (${newItem.modTitle})“ ersetzen?\n\nGib eine Zahl von 1 bis 5 ein:\n\n${slotChoices}`,
      '1'
    );

    const slotNum = parseInt(choice, 10);
    if (slotNum >= 1 && slotNum <= 5) {
      const replaced = this.pinned[slotNum - 1];
      this.pinned[slotNum - 1] = newItem;
      this.onToast(`Platz #${slotNum} ersetzt mit „${newItem.label}“`);
      this.onOpenSidebar();
      this.render();
      this.updateRackBadges();
      this.onModified();
    }
  }

  remove(id) {
    const idx = this.pinned.findIndex((x) => x.id === id);
    if (idx >= 0) {
      const removed = this.pinned.splice(idx, 1)[0];
      this.onToast(`✕ „${removed.customLabel || removed.label}“ entfernt`);
      this.render();
      this.updateRackBadges();
      this.onModified();
    }
  }

  clear() {
    if (this.pinned.length === 0) return;
    this.pinned = [];
    this.onToast('Live-Controls geleert');
    this.render();
    this.updateRackBadges();
    this.onModified();
  }

  onModuleRemoved(modId) {
    const before = this.pinned.length;
    this.pinned = this.pinned.filter((x) => x.modId !== modId);
    if (this.pinned.length !== before) {
      this.render();
      this.updateRackBadges();
    }
  }

  // Serialisierung für Patches
  getState() {
    return this.pinned.map((item) => ({
      modId: item.modId,
      paramId: item.paramId,
      customLabel: item.customLabel || null,
    }));
  }

  loadState(savedList, engineRef) {
    if (!Array.isArray(savedList)) return;
    const eng = engineRef || this.engine;
    if (!eng) return;

    this.pinned = [];
    savedList.slice(0, 5).forEach((saved) => {
      const mod = eng.get(saved.modId);
      if (!mod) return;
      const paramDef = mod.meta.params?.find((p) => p.id === saved.paramId);
      if (!paramDef) return;

      this.pinned.push({
        id: `${saved.modId}:${saved.paramId}`,
        modId: saved.modId,
        paramId: saved.paramId,
        modTitle: mod.meta.title,
        modColor: mod.meta.color,
        label: paramDef.label,
        customLabel: saved.customLabel || null,
        paramDef,
        modRef: mod,
        getVal: () => mod.values[saved.paramId],
        setVal: (v) => mod.setParam(saved.paramId, v),
        fmtVal: (v) => {
          switch (paramDef.fmt) {
            case 'pct': return `${Math.round(v * 100)}%`;
            case 'hz': return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)} Hz`;
            case 's': return v < 1 ? `${Math.round(v * 1000)} ms` : `${v.toFixed(1)} s`;
            case 'bpm': return `${Math.round(v)} BPM`;
            case 'cents': return `${Math.round(v)} ct`;
            default: return v.toFixed(1);
          }
        },
      });
    });
    this.render();
    this.updateRackBadges();
  }

  // Synchronisiert Werte von Rack -> FocusDock
  syncFromRack(modId, paramId, val) {
    const id = `${modId}:${paramId}`;
    const item = this.pinned.find((x) => x.id === id);
    if (!item) return;

    const knob = this.knobInstances.get(id);
    if (knob && Math.abs(knob.value - val) > 0.0001) {
      knob.setValue(val, false);
    }
    const cardEl = this.container.querySelector(`.focus-card[data-id="${id}"]`);
    if (cardEl) {
      const valEl = cardEl.querySelector('.focus-val');
      if (valEl) valEl.textContent = item.fmtVal(val);
    }
  }

  // Badges (#1, #2, ...) an den Original-Reglern im Rack aktualisieren
  updateRackBadges() {
    document.querySelectorAll('.knob-cell').forEach((cell) => {
      const modId = cell.dataset.modId;
      const paramId = cell.dataset.paramId;
      if (!modId || !paramId) return;

      const slot = this.isPinned(modId, paramId);
      if (slot > 0) {
        cell.classList.add('is-pinned');
        cell.setAttribute('data-pin-slot', `#${slot}`);
        cell.title = `Live-Control (#${slot}) · Shift+Klick zum Entfernen`;
      } else {
        cell.classList.remove('is-pinned');
        cell.removeAttribute('data-pin-slot');
        cell.title = 'Shift+Klick: Als Live-Control zuweisen';
      }
    });

    const counter = document.getElementById('live-controls-counter');
    if (counter) counter.textContent = `${this.pinned.length} / 5`;
  }

  render() {
    if (!this.container) return;

    this.knobInstances.clear();
    const count = this.pinned.length;

    const counter = document.getElementById('live-controls-counter');
    if (counter) counter.textContent = `${count} / 5`;

    let html = '<div class="focus-dock-grid">';

    // 1. Zugewiesene Plätze rendern
    this.pinned.forEach((item, idx) => {
      const displayName = item.customLabel || item.label;
      html += `
        <div class="focus-card" data-id="${item.id}" style="--mod-accent: ${item.modColor}">
          <div class="focus-card-head">
            <span class="focus-slot-badge">#${idx + 1}</span>
            <div class="focus-card-info" title="Doppelklick zum Umbenennen">
              <span class="focus-mod-name">${item.modTitle}</span>
              <span class="focus-param-title" data-rename-id="${item.id}">${displayName}</span>
            </div>
            <button class="focus-btn-close" data-remove-id="${item.id}" title="Live-Control #${idx + 1} entfernen">✕</button>
          </div>

          <div class="focus-control-row">
            <button class="btn-nudge btn-nudge-down" data-id="${item.id}" title="Schrittweise verringern">◀</button>
            <div class="focus-knob-wrapper">
              <div class="focus-knob-host" data-id="${item.id}" data-knob-color="mod" data-knob-size="lg" style="--c: ${item.modColor}"></div>
            </div>
            <button class="btn-nudge btn-nudge-up" data-id="${item.id}" title="Schrittweise erhöhen">▶</button>
          </div>

          <div class="focus-card-footer">
            <span class="focus-val">${item.fmtVal(item.getVal())}</span>
            <button class="btn-focus-reset" data-reset-id="${item.id}" title="Standardwert wiederherstellen">↺</button>
          </div>
        </div>
      `;
    });

    // 2. Freie Plätze als dezente Platzhalter anzeigen
    for (let slot = count + 1; slot <= 5; slot++) {
      html += `
        <div class="focus-card-empty" title="Shift + Klick auf einen Regler im Rack, um Platz #${slot} zu belegen">
          <span class="focus-empty-num">#${slot}</span>
          <span class="focus-empty-txt">Freier Live-Slot</span>
          <span class="focus-empty-plus">＋</span>
        </div>
      `;
    }

    html += '</div>';
    this.container.innerHTML = html;

    // Event-Listener: Entfernen
    this.container.querySelectorAll('[data-remove-id]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.remove(btn.dataset.removeId);
      });
    });

    // Event-Listener: Umbenennen per Doppelklick
    this.container.querySelectorAll('[data-rename-id]').forEach((el) => {
      el.addEventListener('dblclick', () => {
        const id = el.dataset.renameId;
        const item = this.pinned.find((p) => p.id === id);
        if (!item) return;
        const currentName = item.customLabel || item.label;
        const newName = prompt('Eigener Name für diesen Live-Control:', currentName)?.trim();
        if (newName) {
          item.customLabel = newName;
          this.render();
          this.onModified();
        }
      });
    });

    // Knobs initialisieren
    this.pinned.forEach((item) => {
      const cardEl = this.container.querySelector(`.focus-card[data-id="${item.id}"]`);
      if (!cardEl) return;

      const host = cardEl.querySelector(`.focus-knob-host[data-id="${item.id}"]`);
      const valEl = cardEl.querySelector('.focus-val');

      const knob = new Knob(host, {
        min: item.paramDef.min,
        max: item.paramDef.max,
        value: item.getVal(),
        defaultValue: item.paramDef.value,
        logarithmic: !!item.paramDef.log,
        onChange: (v) => {
          item.setVal(v);
          valEl.textContent = item.fmtVal(v);
          if (item.origKnobRef?.knob) {
            item.origKnobRef.knob.setValue(v, false);
          }
          if (item.origKnobRef?.valEl) {
            item.origKnobRef.valEl.textContent = item.fmtVal(v);
          }
          this.onModified();
        },
      });

      this.knobInstances.set(item.id, knob);

      cardEl.querySelector('.btn-nudge-down')?.addEventListener('click', () => knob.step(-1));
      cardEl.querySelector('.btn-nudge-up')?.addEventListener('click', () => knob.step(1));
      cardEl.querySelector('.btn-focus-reset')?.addEventListener('click', () => knob.setValue(item.paramDef.value, true));
    });
  }
}
