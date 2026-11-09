// SYNTHBOARD – Performance Preset-Slots & Morph Speed System
// Slots 1 bis 5: Regler-Snapshots & Modul-Zuweisung
// Speed 6, 7, 8: Direkt (0s) · Glide (0.8s) · Slow Morph (3.5s)

export class SnapshotSystem {
  constructor(engine, options = {}) {
    this.engine = engine;
    this.onToast = options.onToast || (() => {});
    this.onModified = options.onModified || (() => {});

    // 5 Preset-Slots (1 bis 5)
    this.slots = {
      1: null,
      2: null,
      3: null,
      4: null,
      5: null,
    };

    // Umschalt-Geschwindigkeiten (6 = Direkt, 7 = Glide, 8 = Slow)
    this.SPEEDS = {
      6: { id: 6, label: '6: Direkt', duration: 0, text: 'Sofort (0s)' },
      7: { id: 7, label: '7: Glide', duration: 0.8, text: 'Glide (0.8s)' },
      8: { id: 8, label: '8: Slow', duration: 3.5, text: 'Slow Morph (3.5s)' },
    };

    this.currentSpeed = 7; // Standard: geschmeidiges Glätten
    this.activeSlot = null;
    this.activeMorphAnim = null;

    // Aktuelle Modul-Auswahl für den nächsten Snapshot ('all' oder Set von moduleIds)
    this.selectedModulesFilter = 'all';

    this.initUi();
    this.bindKeyboard();
  }

  initUi() {
    // Falls Container schon existiert, wiederverwenden
    let host = document.getElementById('preset-bar-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'preset-bar-host';
      host.className = 'preset-bar-strip';

      // Vor den Rack-Zonen oben im Rack einfügen
      const rackEl = document.querySelector('.rack');
      if (rackEl) {
        rackEl.prepend(host);
      } else {
        document.querySelector('.workspace')?.prepend(host);
      }
    }

    host.innerHTML = `
      <div class="preset-bar-inner">
        <div class="preset-section slots-section">
          <span class="preset-bar-lbl"><span class="badge-dot"></span>PRESET SLOTS (1–5)</span>
          <div class="slot-buttons-group">
            ${[1, 2, 3, 4, 5].map((num) => `
              <button class="btn btn-slot" data-slot="${num}" title="Preset-Slot ${num} abrufen [Taste ${num}] (Shift+Klick = Schnell-Speichern)">
                <span class="slot-num">${num}</span>
                <span class="slot-led"></span>
              </button>
            `).join('')}
          </div>
        </div>

        <div class="preset-divider"></div>

        <div class="preset-section actions-section">
          <button id="btn-slot-save" class="btn btn-accent-dim btn-save-slot" title="Aktuelle Reglerstände der gewählten Blöcke in aktiven Slot speichern">
            Speichern auf <b class="target-slot-lbl">Slot 1</b>
          </button>
          <button id="btn-slot-modules" class="btn btn-slot-modules" title="Auswählen, welche Blöcke in den Preset-Slot gepackt werden">
            Blöcke wählen (<span class="mod-count-lbl">Alle</span>)
          </button>
        </div>

        <div class="preset-divider"></div>

        <div class="preset-section speed-section">
          <span class="preset-bar-lbl">SPEED (6–8)</span>
          <div class="speed-buttons-group">
            ${[6, 7, 8].map((sId) => `
              <button class="btn btn-speed" data-speed="${sId}" title="${this.SPEEDS[sId].text} [Taste ${sId}]">
                ${this.SPEEDS[sId].label}
              </button>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Modul-Auswahl Popover/Modal -->
      <div id="slot-module-modal" class="slot-module-modal hidden">
        <div class="slot-modal-card">
          <div class="modal-head">
            <h3>Blöcke für Preset-Slots auswählen</h3>
            <button class="btn-close-modal">✕</button>
          </div>
          <p class="modal-sub">Wähle, von welchen Blöcken die Reglerstände gespeichert und geswitcht werden sollen:</p>
          <div class="modal-quick-select">
            <button class="mini-btn qk-all">Alle Blöcke</button>
            <button class="mini-btn qk-sources">Nur Stimmen/Piano</button>
            <button class="mini-btn qk-effects">Nur Effekte</button>
          </div>
          <div class="modal-module-list" id="modal-module-list"></div>
          <div class="modal-foot">
            <button class="btn btn-primary btn-done-modal">Fertig</button>
          </div>
        </div>
      </div>
    `;

    this.container = host;
    this.bindEvents();
    this.updateVisuals();
  }

  bindEvents() {
    // Klick auf Slot 1–5
    this.container.querySelectorAll('.btn-slot').forEach((btn) => {
      const slotNum = Number(btn.dataset.slot);
      btn.addEventListener('click', (e) => {
        if (e.shiftKey) {
          this.saveToSlot(slotNum);
        } else {
          this.triggerSlot(slotNum);
        }
      });
    });

    // Klick auf Speichern
    const saveBtn = this.container.querySelector('#btn-slot-save');
    saveBtn?.addEventListener('click', () => {
      const target = this.activeSlot || 1;
      this.saveToSlot(target);
    });

    // Klick auf Speed 6, 7, 8
    this.container.querySelectorAll('.btn-speed').forEach((btn) => {
      const sId = Number(btn.dataset.speed);
      btn.addEventListener('click', () => this.setSpeed(sId));
    });

    // Modul-Auswahl Modal
    const modBtn = this.container.querySelector('#btn-slot-modules');
    const modal = this.container.querySelector('#slot-module-modal');
    const closeBtn = modal?.querySelector('.btn-close-modal');
    const doneBtn = modal?.querySelector('.btn-done-modal');

    modBtn?.addEventListener('click', () => this.openModuleSelector());
    closeBtn?.addEventListener('click', () => modal?.classList.add('hidden'));
    doneBtn?.addEventListener('click', () => modal?.classList.add('hidden'));
    modal?.addEventListener('pointerdown', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });

    // Quick-Select Buttons
    modal?.querySelector('.qk-all')?.addEventListener('click', () => {
      this.selectedModulesFilter = 'all';
      this.refreshModuleCheckboxes();
      this.updateVisuals();
    });
    modal?.querySelector('.qk-sources')?.addEventListener('click', () => {
      this.selectedModulesFilter = new Set(this.engine.sources.map((m) => m.id));
      this.refreshModuleCheckboxes();
      this.updateVisuals();
    });
    modal?.querySelector('.qk-effects')?.addEventListener('click', () => {
      this.selectedModulesFilter = new Set(this.engine.effects.map((m) => m.id));
      this.refreshModuleCheckboxes();
      this.updateVisuals();
    });
  }

  bindKeyboard() {
    const isTyping = (el) => el && (el.tagName === 'INPUT' && el.type !== 'range') || el?.tagName === 'TEXTAREA' || el?.tagName === 'SELECT';

    window.addEventListener('keydown', (e) => {
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;

      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 5) {
        e.preventDefault();
        if (e.shiftKey) {
          this.saveToSlot(num);
        } else {
          this.triggerSlot(num);
        }
      } else if (num >= 6 && num <= 8) {
        e.preventDefault();
        this.setSpeed(num);
      }
    });
  }

  setSpeed(speedId) {
    if (!this.SPEEDS[speedId]) return;
    this.currentSpeed = speedId;
    this.updateVisuals();
    this.onToast(`Switch-Speed: ${this.SPEEDS[speedId].text}`);
    this.onModified();
  }

  /** Speichert die Reglerstände der gewählten Blöcke in einen Slot */
  saveToSlot(slotNum) {
    const allModules = [...this.engine.controls, ...this.engine.sources, ...this.engine.effects];
    const targetModules = this.selectedModulesFilter === 'all'
      ? allModules
      : allModules.filter((m) => this.selectedModulesFilter.has(m.id));

    if (!targetModules.length) {
      this.onToast('Keine Blöcke zum Speichern ausgewählt');
      return;
    }

    const snapshot = {};
    targetModules.forEach((m) => {
      snapshot[m.id] = {
        type: m.meta.type,
        title: m.meta.title,
        values: { ...m.values },
        enabled: m.enabled,
        channelStrip: m.getChannelStripState ? m.getChannelStripState() : null,
        extra: m.getExtra ? m.getExtra() : null,
      };
    });

    this.slots[slotNum] = {
      savedAt: Date.now(),
      moduleCount: targetModules.length,
      filter: this.selectedModulesFilter === 'all' ? 'all' : Array.from(this.selectedModulesFilter),
      snapshot,
    };

    this.activeSlot = slotNum;
    this.updateVisuals();
    this.onToast(`In Preset-Slot ${slotNum} gespeichert (${targetModules.length} Blöcke)`);
    this.onModified();
  }

  /** Schaltet auf Slot 1–5 um mit gewählter Geschwindigkeit (0s, 0.8s, 3.5s) */
  triggerSlot(slotNum) {
    const slot = this.slots[slotNum];
    if (!slot || !slot.snapshot) {
      this.activeSlot = slotNum;
      this.updateVisuals();
      this.onToast(`Slot ${slotNum} ist leer. Drehe Regler und drücke 'Speichern'!`);
      return;
    }

    this.activeSlot = slotNum;
    this.updateVisuals();

    const speedInfo = this.SPEEDS[this.currentSpeed] || this.SPEEDS[7];
    const duration = speedInfo.duration;

    // Breche vorherige Morph-Animation ab
    if (this.activeMorphAnim) {
      cancelAnimationFrame(this.activeMorphAnim);
      this.activeMorphAnim = null;
    }

    const allModules = [...this.engine.controls, ...this.engine.sources, ...this.engine.effects];
    const targetModuleMap = new Map();

    // Finde alle Module, die im Snapshot hinterlegt sind
    Object.entries(slot.snapshot).forEach(([modId, savedData]) => {
      const mod = allModules.find((m) => m.id === modId);
      if (mod) {
        targetModuleMap.set(mod, savedData);
      }
    });

    if (duration === 0) {
      // ── DIREKT (Speed 6): Sofort alle Parameter & Optionen setzen ──
      targetModuleMap.forEach((savedData, mod) => {
        if (typeof savedData.enabled === 'boolean' && savedData.enabled !== mod.enabled) {
          mod.setEnabled(savedData.enabled);
        }
        Object.entries(savedData.values || {}).forEach(([pId, targetVal]) => {
          mod.setParam(pId, targetVal);
        });
        if (savedData.channelStrip && mod.setChannelStrip) {
          mod.setChannelStrip(savedData.channelStrip);
        }
        if (savedData.extra) {
          if (mod.setExtra) {
            mod.setExtra(savedData.extra);
          } else if (savedData.extra.voices && mod.voicesOn) {
            mod.voicesOn = [...savedData.extra.voices];
            mod.updateVoices?.();
            mod.refreshPads?.();
          }
        }
        mod.refreshKnobs?.();
      });

      this.onToast(`Slot ${slotNum} aktiviert (Direkt)`);
      this.onModified();
      return;
    }

    // ── GLIDE / SLOW MORPH (Speed 7 oder 8): Weiche Interpolation ──
    const startTime = performance.now();
    const durationMs = duration * 1000;

    // Vorbereitung: Diskrete Optionen (Akkorde, Wellenformen, Skalen) sofort schalten,
    // kontinuierliche Zahlenwerte sanft morphen
    const transitions = [];
    const discreteParams = [];

    targetModuleMap.forEach((savedData, mod) => {
      // Enabled sofort setzen
      if (typeof savedData.enabled === 'boolean') {
        mod.setEnabled(savedData.enabled);
      }
      // Extra-State sofort wiederherstellen (z. B. Stimmen-Pads)
      if (savedData.extra) {
        if (mod.setExtra) {
          mod.setExtra(savedData.extra);
        } else if (savedData.extra.voices && mod.voicesOn) {
          mod.voicesOn = [...savedData.extra.voices];
          mod.updateVoices?.();
          mod.refreshPads?.();
        }
      }

      Object.entries(savedData.values || {}).forEach(([pId, targetVal]) => {
        const startVal = mod.values[pId] ?? targetVal;
        const isDiscrete =
          typeof targetVal === 'string' ||
          typeof targetVal === 'boolean' ||
          typeof startVal === 'string' ||
          typeof startVal === 'boolean';

        if (isDiscrete) {
          discreteParams.push({ mod, pId, targetVal });
        } else {
          transitions.push({
            mod,
            pId,
            startVal: Number(startVal),
            targetVal: Number(targetVal),
          });
        }
      });
    });

    // Diskrete Parameter (z. B. Akkord: Quinte ➔ Oktave) sofort anwenden
    discreteParams.forEach(({ mod, pId, targetVal }) => {
      mod.setParam(pId, targetVal);
    });

    targetModuleMap.forEach((savedData, mod) => {
      if (savedData.channelStrip && mod.setChannelStrip) {
        mod.setChannelStrip(savedData.channelStrip);
      }
      mod.refreshKnobs?.();
    });

    // Smoothstep Easing (sanftes Beschleunigen und Abbremsen)
    const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    let lastKnobRefresh = 0;

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = easeInOut(progress);

      // Aktualisiere numerische Werte
      const touchedModules = new Set();
      transitions.forEach(({ mod, pId, startVal, targetVal }) => {
        const currentVal = startVal + (targetVal - startVal) * eased;
        mod.setParam(pId, currentVal);
        touchedModules.add(mod);
      });

      // Knobs im UI synchron mitdrehen (gedrosselt auf 30 FPS zur Entlastung des Frontends)
      if (progress >= 1 || now - lastKnobRefresh >= 33) {
        lastKnobRefresh = now;
        touchedModules.forEach((mod) => mod.refreshKnobs?.());
      }

      if (progress < 1) {
        this.activeMorphAnim = requestAnimationFrame(step);
      } else {
        this.activeMorphAnim = null;
        this.onModified();
      }
    };

    this.activeMorphAnim = requestAnimationFrame(step);
    this.onToast(`〰 Slot ${slotNum} aktiviert (${speedInfo.text})`);
  }

  openModuleSelector() {
    const modal = this.container.querySelector('#slot-module-modal');
    if (!modal) return;
    this.renderModuleList();
    modal.classList.remove('hidden');
  }

  renderModuleList() {
    const listEl = this.container.querySelector('#modal-module-list');
    if (!listEl) return;

    const allModules = [...this.engine.sources, ...this.engine.effects, ...this.engine.controls];
    listEl.innerHTML = allModules.map((m) => {
      const isSelected = this.selectedModulesFilter === 'all' || this.selectedModulesFilter.has(m.id);
      return `
        <label class="modal-mod-item" style="--c:${m.meta.color}">
          <input type="checkbox" data-mod-id="${m.id}" ${isSelected ? 'checked' : ''} />
          <span class="mod-chk-icon">${m.meta.icon}</span>
          <span class="mod-chk-title">${m.meta.title}</span>
          <span class="mod-chk-cat">${m.meta.category}</span>
        </label>
      `;
    }).join('');

    listEl.querySelectorAll('input[data-mod-id]').forEach((input) => {
      input.addEventListener('change', () => {
        const all = [...listEl.querySelectorAll('input[data-mod-id]')];
        const checked = all.filter((i) => i.checked).map((i) => i.dataset.modId);
        if (checked.length === all.length) {
          this.selectedModulesFilter = 'all';
        } else {
          this.selectedModulesFilter = new Set(checked);
        }
        this.updateVisuals();
      });
    });
  }

  refreshModuleCheckboxes() {
    const listEl = this.container.querySelector('#modal-module-list');
    if (!listEl) return;
    listEl.querySelectorAll('input[data-mod-id]').forEach((input) => {
      input.checked = this.selectedModulesFilter === 'all' || this.selectedModulesFilter.has(input.dataset.modId);
    });
  }

  updateVisuals() {
    if (!this.container) return;

    // Slots updaten
    this.container.querySelectorAll('.btn-slot').forEach((btn) => {
      const sNum = Number(btn.dataset.slot);
      const isSaved = !!this.slots[sNum];
      const isActive = this.activeSlot === sNum;

      btn.classList.toggle('has-preset', isSaved);
      btn.classList.toggle('is-active', isActive);

      const count = isSaved ? `${this.slots[sNum].moduleCount} Blöcke` : 'leer';
      btn.title = `Slot ${sNum}: ${count} [Taste ${sNum}] (Shift+Klick = Speichern)`;
    });

    // Speed Buttons updaten
    this.container.querySelectorAll('.btn-speed').forEach((btn) => {
      const sId = Number(btn.dataset.speed);
      btn.classList.toggle('active', this.currentSpeed === sId);
    });

    // Label für Ziel-Slot
    const targetLbl = this.container.querySelector('.target-slot-lbl');
    if (targetLbl) {
      targetLbl.textContent = `Slot ${this.activeSlot || 1}`;
    }

    // Label für Blöcke-Filter
    const countLbl = this.container.querySelector('.mod-count-lbl');
    if (countLbl) {
      if (this.selectedModulesFilter === 'all') {
        countLbl.textContent = 'Alle Blöcke';
      } else {
        countLbl.textContent = `${this.selectedModulesFilter.size} Blöcke`;
      }
    }
  }

  getState() {
    return {
      slots: this.slots,
      activeSlot: this.activeSlot,
      currentSpeed: this.currentSpeed,
      filter: this.selectedModulesFilter === 'all' ? 'all' : Array.from(this.selectedModulesFilter),
    };
  }

  loadState(state = {}) {
    if (!state) return;
    if (state.slots) this.slots = { ...this.slots, ...state.slots };
    if (state.currentSpeed) this.currentSpeed = state.currentSpeed;
    if (state.activeSlot) this.activeSlot = state.activeSlot;
    if (state.filter) {
      this.selectedModulesFilter = state.filter === 'all' ? 'all' : new Set(state.filter);
    }
    this.updateVisuals();
  }
}
