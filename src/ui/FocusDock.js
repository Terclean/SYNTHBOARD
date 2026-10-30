// FocusDock – Leistungsstarkes Inspektions- & Makro-Fenster für bis zu 5 Regler
import { Knob } from './Knob.js';

export class FocusDock {
  constructor(containerEl, options = {}) {
    this.container = containerEl;
    this.onToast = options.onToast || (() => {});
    this.onModified = options.onModified || (() => {});
    this.onOpenSidebar = options.onOpenSidebar || (() => {});

    // Bis zu 5 gepinnte Regler: { id, modId, paramId, modTitle, modColor, label, paramDef, modRef, fmtVal, cellEl }
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
      // Entfernen
      const removed = this.pinned.splice(existingIdx, 1)[0];
      this.onToast(`✕ ${removed.label} aus Fokus-Reglern entfernt`);
    } else {
      // Hinzufügen
      if (this.pinned.length >= 5) {
        // Ältesten Regler entfernen, wenn voll
        const removed = this.pinned.shift();
        this.onToast(`ℹ️ ${removed.label} verdrängt – max. 5 Fokus-Regler`);
      }
      this.pinned.push(item);
      this.onToast(`🎛️ ${item.label} (${item.modTitle}) im Fokus-Dock geladen`);
      this.onOpenSidebar();
    }
    this.render();
    this.updateRackBadges();
  }

  remove(id) {
    const idx = this.pinned.findIndex((x) => x.id === id);
    if (idx >= 0) {
      const removed = this.pinned.splice(idx, 1)[0];
      this.onToast(`✕ ${removed.label} entfernt`);
      this.render();
      this.updateRackBadges();
    }
  }

  clear() {
    if (this.pinned.length === 0) return;
    this.pinned = [];
    this.onToast('Fokus-Dock geleert');
    this.render();
    this.updateRackBadges();
  }

  onModuleRemoved(modId) {
    const before = this.pinned.length;
    this.pinned = this.pinned.filter((x) => x.modId !== modId);
    if (this.pinned.length !== before) {
      this.render();
      this.updateRackBadges();
    }
  }

  // Synchronisiert Werte von Rack -> FocusDock (z. B. wenn im Rack gedreht wird oder Mutation läuft)
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

  // Badges (★ 1, ★ 2, ...) an den Original-Reglern im Rack aktualisieren
  updateRackBadges() {
    document.querySelectorAll('.knob-cell').forEach((cell) => {
      const modId = cell.dataset.modId;
      const paramId = cell.dataset.paramId;
      if (!modId || !paramId) return;

      const slot = this.isPinned(modId, paramId);
      if (slot > 0) {
        cell.classList.add('is-pinned');
        cell.setAttribute('data-pin-slot', `#${slot}`);
        cell.title = `Im Fokus-Dock (#${slot}) · Shift+Klick zum Entfernen`;
      } else {
        cell.classList.remove('is-pinned');
        cell.removeAttribute('data-pin-slot');
        cell.title = 'Shift+Klick: Im Fokus-Dock groß bedienen';
      }
    });
  }

  render() {
    if (!this.container) return;

    this.knobInstances.clear();

    const count = this.pinned.length;

    this.container.innerHTML = `
      <div class="focus-dock-header">
        <div class="focus-dock-title">
          <span class="focus-dock-led ${count > 0 ? 'on' : ''}"></span>
          <span class="focus-dock-name">FOKUS-DOCK</span>
          <span class="focus-dock-badge">${count}/5</span>
        </div>
        ${count > 0 ? `<button class="btn btn-xs focus-dock-clear" title="Alle Fokus-Regler leeren">Leeren</button>` : ''}
      </div>

      ${count === 0 ? `
        <div class="focus-dock-empty">
          <span class="focus-dock-hint-icon">💡</span>
          <p><b>Shift + Klick</b> auf beliebige Drehregler im Rack, um bis zu 5 Regler hier extra groß zu bedienen.</p>
        </div>
      ` : `
        <div class="focus-dock-list">
          ${this.pinned.map((item, idx) => `
            <div class="focus-card" data-id="${item.id}" style="--c: ${item.modColor}">
              <div class="focus-card-head">
                <span class="focus-slot-num">#${idx + 1}</span>
                <span class="focus-mod-name" title="${item.modTitle}">${item.modTitle}</span>
                <button class="focus-btn-close" data-remove-id="${item.id}" title="Diesen Regler entfernen">✕</button>
              </div>

              <div class="focus-param-title">${item.label}</div>

              <div class="focus-control-row">
                <button class="btn-nudge btn-nudge-down" data-id="${item.id}" title="Schrittweise verringern [Pfeil runter]">◀</button>
                <div class="focus-knob-wrapper">
                  <div class="focus-knob-host" data-id="${item.id}" data-knob-color="mod" data-knob-size="lg" style="--c: ${item.modColor}"></div>
                </div>
                <button class="btn-nudge btn-nudge-up" data-id="${item.id}" title="Schrittweise erhöhen [Pfeil hoch]">▶</button>
              </div>

              <div class="focus-card-footer">
                <span class="focus-val">${item.fmtVal(item.getVal())}</span>
                <button class="btn-focus-reset" data-reset-id="${item.id}" title="Standardwert wiederherstellen [Doppelklick]">↺</button>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    `;

    // Event-Listener: Leeren
    this.container.querySelector('.focus-dock-clear')?.addEventListener('click', () => this.clear());

    // Event-Listener: Schließen einzelner Karten
    this.container.querySelectorAll('[data-remove-id]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.remove(btn.dataset.removeId);
      });
    });

    // Knobs in den Karten initialisieren
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
          // Wert an Modul übergeben
          item.setVal(v);
          valEl.textContent = item.fmtVal(v);
          // Original-Regler im Rack updaten
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

      // Nudge Down
      cardEl.querySelector('.btn-nudge-down')?.addEventListener('click', () => {
        knob.step(-1);
      });

      // Nudge Up
      cardEl.querySelector('.btn-nudge-up')?.addEventListener('click', () => {
        knob.step(1);
      });

      // Reset
      cardEl.querySelector('.btn-focus-reset')?.addEventListener('click', () => {
        knob.setValue(item.paramDef.value, true);
      });
    });
  }
}

