// SYNTHBOARD – Dynamisches zoom- & pannbares Workspace-System für Studio & Rack
// Google-Maps-Style Navigation, freie Modulplatzierung, Auto-Layout & animiertes "Alles anzeigen"

export class StudioWorkspace {
  constructor(options = {}) {
    this.viewportEl = options.viewportEl; // #rack-workspace
    this.worldEl = options.worldEl;       // #workspace-world
    this.engine = options.engine;
    this.patchBay = options.patchBay;
    this.onToast = options.onToast || (() => {});
    this.onModified = options.onModified || (() => {});
    this.onSelectModule = options.onSelectModule || (() => {});

    // Kamera-Zustand (Welt-Transformation)
    this.panX = 60;
    this.panY = 40;
    this.zoom = 0.85;
    this.minZoom = 0.25;
    this.maxZoom = 2.4;

    // Anordnungsmodus: 'free' (freie Platzierung) | 'auto' (kompakte automatische Anordnung)
    this.mode = 'free';
    this.savedFreePositions = new Map(); // id -> { x, y } vor "Alles anzeigen"
    this.hasSavedFreePositions = false;

    // Modul-Metadaten im Workspace: id -> { el, x, y, width, height, mod }
    this.cards = new Map();
    this.selectedModuleId = null;

    // Aktive Gesten & Drag-Zustände
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };
    this.cameraStart = { panX: 0, panY: 0 };

    this.isDraggingCard = false;
    this.draggedCardId = null;
    this.cardDragOffset = { x: 0, y: 0 };
    this.activeSnapGuides = [];

    // Animations-Tracking
    this.activeAnimRaf = null;

    this.initDOM();
    this.bindGestures();
    this.updateWorldTransform();
  }

  initDOM() {
    if (!this.viewportEl) return;
    this.viewportEl.classList.add('studio-workspace-viewport');

    // Schnapp-Hilfslinien-Container
    this.guidesOverlay = document.createElement('div');
    this.guidesOverlay.className = 'workspace-guides-overlay';
    this.viewportEl.appendChild(this.guidesOverlay);

    // Floating HUD Controller auf der Arbeitsfläche
    this.hudEl = document.createElement('div');
    this.hudEl.className = 'workspace-floating-hud';
    this.hudEl.innerHTML = `
      <div class="hud-mode-group" role="group" aria-label="Anordnungsmodus">
        <button type="button" class="hud-pill-btn active" id="btn-mode-free" title="Freie Modulplatzierung mit Ausrichtungshilfen">Frei</button>
        <button type="button" class="hud-pill-btn" id="btn-mode-auto" title="Automatische kompakte Anordnung">Auto</button>
      </div>

      <div class="hud-divider"></div>

      <button type="button" class="hud-action-btn hud-fit-btn" id="btn-hud-fit-all" title="Alles anzeigen: Kompakt anordnen und vollständig einpassen [O / F]">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
        </svg>
        <span>Alles anzeigen</span>
      </button>

      <button type="button" class="hud-action-btn hidden" id="btn-hud-restore-free" title="Zuvor gespeicherte freie Anordnung wiederherstellen">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
          <path d="M3 3v5h5"/>
        </svg>
        <span>Freie Positionen</span>
      </button>

      <div class="hud-divider"></div>

      <div class="hud-zoom-group">
        <button type="button" class="hud-btn" id="btn-hud-zoom-out" title="Verkleinern [-]">−</button>
        <button type="button" class="hud-btn hud-zoom-val" id="btn-hud-zoom-reset" title="100% Zoom [0]">85%</button>
        <button type="button" class="hud-btn" id="btn-hud-zoom-in" title="Vergrößern [+]">＋</button>
      </div>

      <div class="hud-divider"></div>

      <button type="button" class="hud-action-btn" id="btn-hud-focus" title="Ausgewähltes Modul zentrieren [Z]" disabled>
        <span>Fokussieren</span>
      </button>
    `;
    this.viewportEl.appendChild(this.hudEl);

    // HUD Events
    this.hudEl.querySelector('#btn-mode-free')?.addEventListener('click', () => this.setMode('free'));
    this.hudEl.querySelector('#btn-mode-auto')?.addEventListener('click', () => this.setMode('auto'));
    this.hudEl.querySelector('#btn-hud-fit-all')?.addEventListener('click', () => this.fitAll(true));
    this.hudEl.querySelector('#btn-hud-restore-free')?.addEventListener('click', () => this.restoreFreePositions());
    this.hudEl.querySelector('#btn-hud-zoom-out')?.addEventListener('click', () => this.zoomRelative(-0.15));
    this.hudEl.querySelector('#btn-hud-zoom-in')?.addEventListener('click', () => this.zoomRelative(0.15));
    this.hudEl.querySelector('#btn-hud-zoom-reset')?.addEventListener('click', () => this.resetZoom());
    this.hudEl.querySelector('#btn-hud-focus')?.addEventListener('click', () => this.focusSelected());
  }

  // ───────────────────────────── Koordinaten-Transformationen ──
  screenToWorld(clientX, clientY) {
    const rect = this.viewportEl.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    return {
      x: (sx - this.panX) / this.zoom,
      y: (sy - this.panY) / this.zoom,
    };
  }

  worldToScreen(worldX, worldY) {
    const rect = this.viewportEl.getBoundingClientRect();
    return {
      x: worldX * this.zoom + this.panX + rect.left,
      y: worldY * this.zoom + this.panY + rect.top,
    };
  }

  updateWorldTransform() {
    if (!this.worldEl || !this.viewportEl) return;
    this.worldEl.style.transform = `translate3d(${this.panX}px, ${this.panY}px, 0) scale(${this.zoom})`;

    // Hintergrund-Gittermuster pannt und skaliert nahtlos mit der Welt
    const gridSize = Math.round(24 * this.zoom);
    this.viewportEl.style.backgroundSize = `${gridSize}px ${gridSize}px`;
    this.viewportEl.style.backgroundPosition = `${this.panX}px ${this.panY}px`;

    // Zoom-Wertanzeige im HUD & Topbar aktualisieren
    const pct = `${Math.round(this.zoom * 100)}%`;
    const hudVal = this.hudEl.querySelector('#btn-hud-zoom-reset');
    if (hudVal) hudVal.textContent = pct;
    const topVal = document.getElementById('zoom-val');
    if (topVal) topVal.textContent = pct;

    // 3-stufiges Zoom-LOD (Level of Detail)
    const lod = this.zoom < 0.5 ? 'low' : this.zoom < 0.75 ? 'medium' : 'high';
    if (this.currentLod !== lod) {
      this.currentLod = lod;
      this.viewportEl.classList?.toggle?.('lod-medium', lod === 'medium');
      this.viewportEl.classList?.toggle?.('lod-low', lod === 'low');
      if (typeof document !== 'undefined' && document.body?.classList?.toggle) {
        document.body.classList.toggle('lod-medium', lod === 'medium');
        document.body.classList.toggle('lod-low', lod === 'low');
      }
      if (this.engine) this.engine.renderLod = lod;
      this.patchBay?.setLod?.(lod);
    }

    this.patchBay?.requestDraw?.();
  }

  // ───────────────────────────── Kamera-Animationen ──
  animateCamera(targetPanX, targetPanY, targetZoom, duration = 380, onComplete = null) {
    if (this.activeAnimRaf) cancelAnimationFrame(this.activeAnimRaf);

    // Bei prefers-reduced-motion sofort springen
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || duration <= 0) {
      this.panX = targetPanX;
      this.panY = targetPanY;
      this.zoom = targetZoom;
      this.updateWorldTransform();
      onComplete?.();
      return;
    }

    const startPanX = this.panX;
    const startPanY = this.panY;
    const startZoom = this.zoom;
    const startTime = performance.now();

    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const frame = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = easeOutCubic(progress);

      this.panX = startPanX + (targetPanX - startPanX) * ease;
      this.panY = startPanY + (targetPanY - startPanY) * ease;
      this.zoom = startZoom + (targetZoom - startZoom) * ease;
      this.updateWorldTransform();

      if (progress < 1) {
        this.activeAnimRaf = requestAnimationFrame(frame);
      } else {
        this.activeAnimRaf = null;
        this.panX = targetPanX;
        this.panY = targetPanY;
        this.zoom = targetZoom;
        this.updateWorldTransform();
        onComplete?.();
      }
    };

    this.activeAnimRaf = requestAnimationFrame(frame);
  }

  // ───────────────────────────── Karten-Navigation & Gesten ──
  bindGestures() {
    const vp = this.viewportEl;
    if (!vp) return;

    // Mausrad & Trackpad Pinch
    vp.addEventListener('wheel', (e) => {
      // Regler und Scrollbereiche in Modulen haben Vorrang
      if (e.target.closest('.strip-slider, .lib-scroll-area, .perf-board-scroll, select, input[type="range"]')) return;

      e.preventDefault();
      const rect = vp.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      let delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 20; // Zeilen-Modus

      // Trackpad Pinch sendet e.ctrlKey === true
      const zoomFactor = e.ctrlKey ? Math.exp(-delta * 0.015) : Math.exp(-delta * 0.0016);
      const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * zoomFactor));

      // Zoom zentriert auf aktuellen Mauszeiger (Google-Maps-Prinzip)
      const worldX = (mouseX - this.panX) / this.zoom;
      const worldY = (mouseY - this.panY) / this.zoom;

      this.panX = mouseX - worldX * newZoom;
      this.panY = mouseY - worldY * newZoom;
      this.zoom = newZoom;

      this.updateWorldTransform();
    }, { passive: false });

    // Verschieben (Pan) per Maus / Geste
    vp.addEventListener('pointerdown', (e) => {
      // Wenn Klick auf interaktive Elemente wie Knöpfe, Jacks oder Menüs -> kein Pan
      if (e.target.closest('button, input, select, textarea, .hw-jack, .knob-host, .er-jack, .workspace-floating-hud')) return;

      // Wenn Klick auf Modul-Grip/Kopfbereich -> Modulverschiebung (wird separat behandelt)
      if (e.target.closest('.mod-head, .mod-grip')) return;

      // Wenn Klick auf Modul-Inhalt -> nur Modulauswahl, kein Pan
      if (e.target.closest('.module-card')) return;

      // Pan starten (Leertaste, mittlere Maustaste oder Klick auf freie Fläche)
      this.isPanning = true;
      this.panStart = { x: e.clientX, y: e.clientY };
      this.cameraStart = { panX: this.panX, panY: this.panY };
      vp.classList.add('is-panning');
      vp.setPointerCapture(e.pointerId);
    });

    vp.addEventListener('pointermove', (e) => {
      if (!this.isPanning) return;
      const dx = e.clientX - this.panStart.x;
      const dy = e.clientY - this.panStart.y;
      this.panX = this.cameraStart.panX + dx;
      this.panY = this.cameraStart.panY + dy;
      this.updateWorldTransform();
    });

    const endPan = (e) => {
      if (this.isPanning) {
        this.isPanning = false;
        vp.classList.remove('is-panning');
        try { vp.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      }
    };
    vp.addEventListener('pointerup', endPan);
    vp.addEventListener('pointercancel', endPan);

    // Drag-over & Drop aus der Bibliothek auf die Welt
    vp.addEventListener('dragover', (e) => {
      if (e.dataTransfer.types.includes('application/x-module-type')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        vp.classList.add('drop-target-active');
      }
    });

    vp.addEventListener('dragleave', (e) => {
      if (!vp.contains(e.relatedTarget)) {
        vp.classList.remove('drop-target-active');
      }
    });

    vp.addEventListener('drop', (e) => {
      vp.classList.remove('drop-target-active');
      const modType = e.dataTransfer.getData('application/x-module-type');
      if (!modType) return;
      e.preventDefault();

      // Weltposition an der Ablage-Stelle berechnen (unabhängig von Pan & Zoom)
      const worldPos = this.screenToWorld(e.clientX, e.clientY);
      const cardW = 320;
      const cardH = 380;
      const x = Math.round(worldPos.x - cardW / 2);
      const y = Math.round(worldPos.y - 24);

      if (typeof this.onAddModuleAt === 'function') {
        this.onAddModuleAt(modType, { x, y });
      }
    });
  }

  // ───────────────────────────── Modul-Karten-Verwaltung ──
  registerCard(mod, cardEl, initialPos = null) {
    const id = mod.id;
    let x = initialPos?.x;
    let y = initialPos?.y;

    if (x === undefined || y === undefined) {
      if (this.mode === 'auto' || this.cards.size === 0) {
        const layout = this.computeCompactLayout([...this.engine.controls, ...this.engine.sources, ...this.engine.effects]);
        const pos = layout.get(id);
        x = pos?.x ?? 80;
        y = pos?.y ?? 60;
      } else {
        // Freie Platzierung: Suche erste freie Stelle neben dem letzten Modul
        const last = Array.from(this.cards.values()).pop();
        x = (last ? last.x + last.width + 20 : 80);
        y = (last ? last.y : 60);
      }
    }

    cardEl.style.position = 'absolute';
    cardEl.style.left = '0';
    cardEl.style.top = '0';
    cardEl.style.transform = `translate3d(${x}px, ${y}px, 0)`;

    const cardInfo = {
      id,
      el: cardEl,
      x,
      y,
      width: 320,
      height: 400,
      mod,
    };
    this.cards.set(id, cardInfo);
    this.worldEl.appendChild(cardEl);

    // Tatsächliche Abmessungen ermitteln
    requestAnimationFrame(() => {
      const r = cardEl.getBoundingClientRect();
      if (r.width > 0) cardInfo.width = r.width / this.zoom;
      if (r.height > 0) cardInfo.height = r.height / this.zoom;
    });

    this.bindCardDrag(cardInfo);

    if (this.mode === 'auto') {
      this.rearrangeAuto(true);
    }
  }

  unregisterCard(id) {
    const info = this.cards.get(id);
    if (!info) return;
    info.el.remove();
    this.cards.delete(id);
    this.savedFreePositions.delete(id);

    if (this.mode === 'auto') {
      this.rearrangeAuto(true);
    }
  }

  clear() {
    this.cards.forEach((info) => info.el.remove());
    this.cards.clear();
    this.savedFreePositions.clear();
    this.hasSavedFreePositions = false;
    this.updateRestoreButtonState();
  }

  // ───────────────────────────── Modul-Verschiebung im Freien Modus ──
  bindCardDrag(cardInfo) {
    const head = cardInfo.el.querySelector('.mod-head');
    if (!head) return;

    let onPointerMove = null;
    let onPointerUp = null;

    head.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button, input, select, textarea, .hw-jack, .knob-host')) return;
      if (e.button !== 0) return;

      e.stopPropagation();
      e.preventDefault();
      this.isDraggingCard = true;
      this.draggedCardId = cardInfo.id;

      this.selectCard(cardInfo.id);

      // Klickversatz in Weltkoordinaten erfassen
      const clickWorld = this.screenToWorld(e.clientX, e.clientY);
      this.cardDragOffset = {
        x: clickWorld.x - cardInfo.x,
        y: clickWorld.y - cardInfo.y,
      };

      cardInfo.el.classList.add('is-dragging');
      this.worldEl.appendChild(cardInfo.el); // Nach oben holen (höchster Z-Index)

      onPointerMove = (ev) => {
        if (!this.isDraggingCard || this.draggedCardId !== cardInfo.id) return;

        const mouseWorld = this.screenToWorld(ev.clientX, ev.clientY);
        let targetX = mouseWorld.x - this.cardDragOffset.x;
        let targetY = mouseWorld.y - this.cardDragOffset.y;

        // Wenn im "Frei"-Modus: Ausrichtungshilfen & sanftes Einrasten an Nachbarmodulen
        if (this.mode === 'free') {
          const snapRes = this.computeSnapping(cardInfo.id, targetX, targetY, cardInfo.width, cardInfo.height);
          targetX = snapRes.x;
          targetY = snapRes.y;
          this.renderSnapGuides(snapRes.guides);
        }

        cardInfo.x = targetX;
        cardInfo.y = targetY;
        cardInfo.el.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
        if (cardInfo.mod) {
          cardInfo.mod.pos = { x: targetX, y: targetY };
        }

        // Kabellänge und Durchhang passen sich sofort und flüssig in Echtzeit an!
        this.patchBay?.requestDraw?.();
      };

      onPointerUp = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);

        if (this.isDraggingCard && this.draggedCardId === cardInfo.id) {
          this.isDraggingCard = false;
          this.draggedCardId = null;
          cardInfo.el.classList.remove('is-dragging');
          this.clearSnapGuides();

          if (this.mode === 'free') {
            // Überlappungen durch lokale Positionskorrektur verhindern
            const resolved = this.resolveOverlap(cardInfo.id, cardInfo.x, cardInfo.y, cardInfo.width, cardInfo.height);
            if (resolved.x !== cardInfo.x || resolved.y !== cardInfo.y) {
              this.animateCardTo(cardInfo, resolved.x, resolved.y, 220);
            } else {
              cardInfo.x = Math.round(cardInfo.x);
              cardInfo.y = Math.round(cardInfo.y);
              cardInfo.el.style.transform = `translate3d(${cardInfo.x}px, ${cardInfo.y}px, 0)`;
              if (cardInfo.mod) cardInfo.mod.pos = { x: cardInfo.x, y: cardInfo.y };
              this.patchBay?.requestDraw?.();
            }
          } else {
            // Im Auto-Modus nach manuellem Eingriff die Ordnung wiederherstellen
            this.rearrangeAuto(true);
          }

          this.onModified?.();
        }
      };

      window.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    });
  }

  // ───────────────────────────── Ausrichtungshilfen & Snapping ──
  computeSnapping(activeId, x, y, width, height) {
    const SNAP_THRESH = 12; // Pixel
    let snappedX = x;
    let snappedY = y;
    const guides = [];

    const activeLeft = x;
    const activeRight = x + width;
    const activeTop = y;
    const activeBottom = y + height;

    for (const [id, other] of this.cards.entries()) {
      if (id === activeId) continue;
      const otherLeft = other.x;
      const otherRight = other.x + other.width;
      const otherTop = other.y;
      const otherBottom = other.y + other.height;

      // X-Achsen Snapping (Kante an Kante)
      if (Math.abs(activeLeft - otherLeft) < SNAP_THRESH) {
        snappedX = otherLeft;
        guides.push({ type: 'v', x: otherLeft });
      } else if (Math.abs(activeLeft - (otherRight + 16)) < SNAP_THRESH) {
        snappedX = otherRight + 16;
        guides.push({ type: 'v', x: snappedX });
      } else if (Math.abs(activeRight - otherRight) < SNAP_THRESH) {
        snappedX = otherRight - width;
        guides.push({ type: 'v', x: otherRight });
      } else if (Math.abs(activeRight - (otherLeft - 16)) < SNAP_THRESH) {
        snappedX = otherLeft - 16 - width;
        guides.push({ type: 'v', x: otherLeft - 16 });
      }

      // Y-Achsen Snapping
      if (Math.abs(activeTop - otherTop) < SNAP_THRESH) {
        snappedY = otherTop;
        guides.push({ type: 'h', y: otherTop });
      } else if (Math.abs(activeTop - (otherBottom + 16)) < SNAP_THRESH) {
        snappedY = otherBottom + 16;
        guides.push({ type: 'h', y: snappedY });
      } else if (Math.abs(activeBottom - otherBottom) < SNAP_THRESH) {
        snappedY = otherBottom - height;
        guides.push({ type: 'h', y: otherBottom });
      } else if (Math.abs(activeBottom - (otherTop - 16)) < SNAP_THRESH) {
        snappedY = otherTop - 16 - height;
        guides.push({ type: 'h', y: otherTop - 16 });
      }
    }

    return { x: snappedX, y: snappedY, guides };
  }

  renderSnapGuides(guides) {
    if (!this.guidesOverlay) return;
    this.guidesOverlay.innerHTML = '';
    const rect = this.viewportEl.getBoundingClientRect();

    guides.forEach((g) => {
      const line = document.createElement('div');
      line.className = `snap-guide-line ${g.type === 'v' ? 'guide-v' : 'guide-h'}`;
      if (g.type === 'v') {
        const sx = g.x * this.zoom + this.panX;
        line.style.left = `${sx}px`;
      } else {
        const sy = g.y * this.zoom + this.panY;
        line.style.top = `${sy}px`;
      }
      this.guidesOverlay.appendChild(line);
    });
  }

  clearSnapGuides() {
    if (this.guidesOverlay) this.guidesOverlay.innerHTML = '';
  }

  // ───────────────────────────── Lokale Überlappungsverhinderung ──
  resolveOverlap(activeId, x, y, width, height) {
    const GAP = 16;
    let resX = x;
    let resY = y;
    let hasOverlap = true;
    let attempts = 0;

    const checkOverlap = (cx, cy) => {
      for (const [id, o] of this.cards.entries()) {
        if (id === activeId) continue;
        const overlap = !(
          cx + width + GAP <= o.x ||
          cx >= o.x + o.width + GAP ||
          cy + height + GAP <= o.y ||
          cy >= o.y + o.height + GAP
        );
        if (overlap) return o;
      }
      return null;
    };

    while (attempts < 10) {
      const colliding = checkOverlap(resX, resY);
      if (!colliding) break;
      attempts++;

      // Ermittle den kürzesten Ausweichweg nach rechts oder unten
      const pushRight = colliding.x + colliding.width + GAP - resX;
      const pushDown = colliding.y + colliding.height + GAP - resY;

      if (pushRight < pushDown) {
        resX += pushRight;
      } else {
        resY += pushDown;
      }
    }

    return { x: Math.round(resX), y: Math.round(resY) };
  }

  // ───────────────────────────── Auto-Layout & Kompakte Anordnung ──
  computeCompactLayout(allEngineMods = null) {
    const mods = allEngineMods || Array.from(this.cards.values()).map((c) => c.mod);
    const layout = new Map();
    if (!mods.length) return layout;

    // Viewport-Seitenverhältnis ermitteln
    const vpRect = this.viewportEl.getBoundingClientRect();
    const aspect = Math.max(0.6, Math.min(2.5, vpRect.width / Math.max(1, vpRect.height)));

    const GAP = 18;
    const CARD_W = 330;

    // Logische Gruppierung nach Signalfluss (Controls -> Sources -> Effects)
    const controls = mods.filter((m) => m.meta?.category === 'control');
    const sources = mods.filter((m) => m.meta?.category === 'source');
    const effects = mods.filter((m) => m.meta?.category === 'effect');

    // Auf breiten Bildschirmen dürfen 3–4 Spalten nebeneinander stehen, auf schmalen 1–2
    let targetCols = Math.max(2, Math.min(5, Math.round(Math.sqrt(mods.length * aspect))));
    if (vpRect.width < 900) targetCols = 2;
    if (vpRect.width < 600) targetCols = 1;

    let curX = 60;
    let curY = 60;
    let rowMaxH = 0;
    let colIdx = 0;

    const orderedMods = [...controls, ...sources, ...effects];

    orderedMods.forEach((m) => {
      const cardInfo = this.cards.get(m.id);
      const w = cardInfo?.width || CARD_W;
      const h = cardInfo?.height || 380;

      if (colIdx >= targetCols) {
        colIdx = 0;
        curX = 60;
        curY += rowMaxH + GAP;
        rowMaxH = 0;
      }

      layout.set(m.id, { x: curX, y: curY });
      curX += w + GAP;
      rowMaxH = Math.max(rowMaxH, h);
      colIdx++;
    });

    return layout;
  }

  rearrangeAuto(animate = true) {
    const layout = this.computeCompactLayout();
    if (!layout.size) return;

    if (animate) {
      this.animateCardsToLayout(layout, 360);
    } else {
      layout.forEach((pos, id) => {
        const card = this.cards.get(id);
        if (card) {
          card.x = pos.x;
          card.y = pos.y;
          card.el.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
        }
      });
      this.patchBay?.requestDraw?.();
    }
  }

  animateCardTo(cardInfo, targetX, targetY, duration = 240) {
    const startX = cardInfo.x;
    const startY = cardInfo.y;
    const startTime = performance.now();
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const step = (now) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const ease = easeOutCubic(progress);
      cardInfo.x = startX + (targetX - startX) * ease;
      cardInfo.y = startY + (targetY - startY) * ease;
      cardInfo.el.style.transform = `translate3d(${cardInfo.x}px, ${cardInfo.y}px, 0)`;
      if (cardInfo.mod) cardInfo.mod.pos = { x: cardInfo.x, y: cardInfo.y };
      this.patchBay?.requestDraw?.();

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        cardInfo.x = Math.round(targetX);
        cardInfo.y = Math.round(targetY);
        cardInfo.el.style.transform = `translate3d(${cardInfo.x}px, ${cardInfo.y}px, 0)`;
        if (cardInfo.mod) cardInfo.mod.pos = { x: cardInfo.x, y: cardInfo.y };
        this.patchBay?.requestDraw?.();
      }
    };
    requestAnimationFrame(step);
  }

  animateCardsToLayout(layoutMap, duration = 380, onComplete = null) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || duration <= 0) {
      layoutMap.forEach((pos, id) => {
        const card = this.cards.get(id);
        if (card) {
          card.x = pos.x;
          card.y = pos.y;
          card.el.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
        }
      });
      this.patchBay?.requestDraw?.();
      onComplete?.();
      return;
    }

    const startPositions = new Map();
    layoutMap.forEach((pos, id) => {
      const card = this.cards.get(id);
      if (card) {
        startPositions.set(id, { x: card.x, y: card.y, targetX: pos.x, targetY: pos.y });
      }
    });

    const startTime = performance.now();
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const step = (now) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const ease = easeOutCubic(progress);

      startPositions.forEach(({ x, y, targetX, targetY }, id) => {
        const card = this.cards.get(id);
        if (card) {
          card.x = x + (targetX - x) * ease;
          card.y = y + (targetY - y) * ease;
          card.el.style.transform = `translate3d(${card.x}px, ${card.y}px, 0)`;
        }
      });

      this.patchBay?.requestDraw?.();

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        startPositions.forEach(({ targetX, targetY }, id) => {
          const card = this.cards.get(id);
          if (card) {
            card.x = Math.round(targetX);
            card.y = Math.round(targetY);
            card.el.style.transform = `translate3d(${card.x}px, ${card.y}px, 0)`;
          }
        });
        this.patchBay?.requestDraw?.();
        onComplete?.();
      }
    };
    requestAnimationFrame(step);
  }

  // ───────────────────────────── „Alles anzeigen“ (Zentrale Funktion) ──
  fitAll(animate = true) {
    if (!this.cards.size) {
      this.animateCamera(60, 40, 1.0, animate ? 300 : 0);
      return;
    }

    // 1. Vor dem Zusammenrücken: Freie Anordnung sichern
    if (this.mode === 'free') {
      this.savedFreePositions.clear();
      this.cards.forEach((card, id) => {
        this.savedFreePositions.set(id, { x: card.x, y: card.y });
      });
      this.hasSavedFreePositions = true;
      this.updateRestoreButtonState();
    }

    // 2. Kompakte Zielanordnung berechnen
    const compactLayout = this.computeCompactLayout();

    // Bounding Box der kompakten Gruppe ermitteln
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    compactLayout.forEach((pos, id) => {
      const card = this.cards.get(id);
      const w = card?.width || 330;
      const h = card?.height || 380;
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + w);
      maxY = Math.max(maxY, pos.y + h);
    });

    const groupW = Math.max(100, maxX - minX);
    const groupH = Math.max(100, maxY - minY);
    const groupCenterX = minX + groupW / 2;
    const groupCenterY = minY + groupH / 2;

    // Verfügbaren Viewport-Bereich abzüglich Sicherheitsabstand (Padding 48px) ermitteln
    const vpRect = this.viewportEl.getBoundingClientRect();
    const padX = 54;
    const padY = 54;
    const availW = Math.max(200, vpRect.width - padX * 2);
    const availH = Math.max(200, vpRect.height - padY * 2);

    const fitRatio = Math.min(availW / groupW, availH / groupH);
    const targetZoom = Math.max(this.minZoom, Math.min(1.15, Math.round(fitRatio * 100) / 100));

    // Kamera so zentrieren, dass die Modulgruppe in der Mitte des Bildschirms ruht
    const targetPanX = Math.round(vpRect.width / 2 - groupCenterX * targetZoom);
    const targetPanY = Math.round(vpRect.height / 2 - groupCenterY * targetZoom);

    // 3. Gleichzeitige harmonische Animation der Module und der Kamera (380 ms)
    if (animate) {
      this.animateCardsToLayout(compactLayout, 380);
      this.animateCamera(targetPanX, targetPanY, targetZoom, 380);
    } else {
      this.animateCardsToLayout(compactLayout, 0);
      this.panX = targetPanX;
      this.panY = targetPanY;
      this.zoom = targetZoom;
      this.updateWorldTransform();
    }

    this.onToast('Alles auf einen Blick: Kompakt angeordnet');
  }

  // ───────────────────────────── Freie Anordnung wiederherstellen ──
  restoreFreePositions(animate = true) {
    if (!this.savedFreePositions.size) return;

    const layout = new Map();
    this.savedFreePositions.forEach((pos, id) => {
      layout.set(id, pos);
    });

    this.setMode('free');
    this.animateCardsToLayout(layout, animate ? 360 : 0, () => {
      // Kamera nach Wiederherstellung sanft an die wiederhergestellten Bounds anpassen
      this.fitBounds(false, false);
    });

    this.hasSavedFreePositions = false;
    this.updateRestoreButtonState();
    this.onToast('Freie Anordnung wiederhergestellt');
  }

  updateRestoreButtonState() {
    const btn = this.hudEl.querySelector('#btn-hud-restore-free');
    if (btn) {
      btn.classList.toggle('hidden', !this.hasSavedFreePositions);
    }
  }

  // ───────────────────────────── Modus-Umschaltung (Frei vs. Auto) ──
  setMode(newMode) {
    if (this.mode === newMode) return;
    this.mode = newMode === 'auto' ? 'auto' : 'free';

    this.hudEl.querySelector('#btn-mode-free')?.classList.toggle('active', this.mode === 'free');
    this.hudEl.querySelector('#btn-mode-auto')?.classList.toggle('active', this.mode === 'auto');

    if (this.mode === 'auto') {
      this.rearrangeAuto(true);
      this.onToast('Automatischer Anordnungsmodus aktiv');
    } else {
      this.onToast('Freier Anordnungsmodus aktiv');
    }
    this.onModified?.();
  }

  // ───────────────────────────── Modul-Fokussierung ──
  selectCard(id) {
    this.selectedModuleId = id;
    this.cards.forEach((c) => {
      c.el.classList.toggle('is-selected', c.id === id);
    });
    const focusBtn = this.hudEl.querySelector('#btn-hud-focus');
    if (focusBtn) focusBtn.disabled = !id;
    this.onSelectModule?.(id);
  }

  focusSelected() {
    if (!this.selectedModuleId) return;
    const card = this.cards.get(this.selectedModuleId);
    if (!card) return;

    const vpRect = this.viewportEl.getBoundingClientRect();
    const cardCenterX = card.x + card.width / 2;
    const cardCenterY = card.y + card.height / 2;

    const targetZoom = Math.max(1.0, Math.min(1.2, this.zoom));
    const targetPanX = Math.round(vpRect.width / 2 - cardCenterX * targetZoom);
    const targetPanY = Math.round(vpRect.height / 2 - cardCenterY * targetZoom);

    this.animateCamera(targetPanX, targetPanY, targetZoom, 340);
    this.onToast(`Fokus auf ${card.mod.meta?.title || 'Modul'}`);
  }

  fitBounds(animate = true, rearrange = false) {
    if (rearrange) {
      this.fitAll(animate);
      return;
    }

    if (!this.cards.size) {
      this.animateCamera(60, 40, 1.0, animate ? 300 : 0);
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    this.cards.forEach((c) => {
      minX = Math.min(minX, c.x);
      minY = Math.min(minY, c.y);
      maxX = Math.max(maxX, c.x + c.width);
      maxY = Math.max(maxY, c.y + c.height);
    });

    const w = Math.max(100, maxX - minX);
    const h = Math.max(100, maxY - minY);
    const centerX = minX + w / 2;
    const centerY = minY + h / 2;

    const vpRect = this.viewportEl.getBoundingClientRect();
    const fitRatio = Math.min((vpRect.width - 90) / w, (vpRect.height - 90) / h);
    const targetZoom = Math.max(this.minZoom, Math.min(1.15, Math.round(fitRatio * 100) / 100));

    const targetPanX = Math.round(vpRect.width / 2 - centerX * targetZoom);
    const targetPanY = Math.round(vpRect.height / 2 - centerY * targetZoom);

    this.animateCamera(targetPanX, targetPanY, targetZoom, animate ? 340 : 0);
  }

  zoomRelative(delta) {
    const vpRect = this.viewportEl.getBoundingClientRect();
    const centerX = vpRect.width / 2;
    const centerY = vpRect.height / 2;

    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, Math.round((this.zoom + delta) * 100) / 100));
    const worldX = (centerX - this.panX) / this.zoom;
    const worldY = (centerY - this.panY) / this.zoom;

    const targetPanX = centerX - worldX * newZoom;
    const targetPanY = centerY - worldY * newZoom;

    this.animateCamera(targetPanX, targetPanY, newZoom, 180);
  }

  resetZoom() {
    const vpRect = this.viewportEl.getBoundingClientRect();
    const centerX = vpRect.width / 2;
    const centerY = vpRect.height / 2;

    const worldX = (centerX - this.panX) / this.zoom;
    const worldY = (centerY - this.panY) / this.zoom;

    const targetPanX = centerX - worldX * 1.0;
    const targetPanY = centerY - worldY * 1.0;

    this.animateCamera(targetPanX, targetPanY, 1.0, 240);
  }

  // ───────────────────────────── Zustandsspeicherung ──
  getState() {
    const positions = {};
    this.cards.forEach((info, id) => {
      positions[id] = { x: Math.round(info.x), y: Math.round(info.y) };
    });
    return {
      panX: Math.round(this.panX),
      panY: Math.round(this.panY),
      zoom: Math.round(this.zoom * 100) / 100,
      mode: this.mode,
      positions,
    };
  }

  loadState(state) {
    if (!state) return;
    if (typeof state.panX === 'number') this.panX = state.panX;
    if (typeof state.panY === 'number') this.panY = state.panY;
    if (typeof state.zoom === 'number') this.zoom = clamp(state.zoom, this.minZoom, this.maxZoom);
    if (state.mode === 'auto' || state.mode === 'free') this.setMode(state.mode);

    if (state.positions) {
      for (const [id, pos] of Object.entries(state.positions)) {
        const card = this.cards.get(id);
        if (card && typeof pos.x === 'number' && typeof pos.y === 'number') {
          card.x = pos.x;
          card.y = pos.y;
          card.el.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
        }
      }
    }
    this.updateWorldTransform();
  }
}
