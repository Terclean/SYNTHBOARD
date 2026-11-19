// SYNTHBOARD – Interaktives modulares Patch-Kabel-System
import { SIGNAL_COLORS } from '../modules/patchSystem.js';

export class PatchBay {
  constructor(canvasEl, engine, options = {}) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.engine = engine;
    this.appEl = document.querySelector('.app');
    this.onModified = options.onModified || null;
    this.visible = true;
    this.selectedModuleId = null;

    this.jacks = new Map(); // key `${moduleId}:${portId}` -> { el, moduleId, portId, type, signal, label }
    this.activeDrag = null; // { fromKey, currentX, currentY, color, signal }
    this.hoverTargetKey = null;
    this.drawScheduled = false;
    this.badges = []; // Stärke-Plaketten der Modulationskabel { id, x, y }
    this.depthDrag = null;
    this.lod = 'high'; // 'high' | 'medium' | 'low'

    this.initCanvas();
    this.bindEvents();
    this.setupEngineHooks();
    this.requestDraw();
  }

  initCanvas() {
    this.appEl = document.querySelector('.app');

    const updateSize = () => {
      const parent = this.canvas.parentElement || this.appEl || document.body;
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.max(rect.width || window.innerWidth, 400);
      const h = Math.max(rect.height || window.innerHeight, 300);

      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.canvas.style.width = '100%';
      this.canvas.style.height = '100%';

      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(dpr, dpr);
      this.requestDraw();
    };

    this.updateSize = updateSize;
    updateSize();
    window.addEventListener('resize', updateSize);

    if (window.ResizeObserver) {
      if (this.canvas.parentElement) new ResizeObserver(() => updateSize()).observe(this.canvas.parentElement);
      if (this.appEl) new ResizeObserver(() => updateSize()).observe(this.appEl);
    }
  }

  setupEngineHooks() {
    this.engine.patchSystem.onConnectionsChanged = () => {
      this.syncPatchedClasses();
      this.requestDraw();
      this.onModified?.();
    };

    this.engine.patchSystem.onActivity = ({ fromModuleId, fromPortId, toModuleId, toPortId }) => {
      const fromKey = `${fromModuleId}:${fromPortId}`;
      const toKey = `${toModuleId}:${toPortId}`;
      this.flashJack(fromKey);
      this.flashJack(toKey);
    };
  }

  flashJack(key) {
    if (!this.visible || (typeof document !== 'undefined' && document.hidden)) return;
    const jack = this.jacks.get(key);
    if (!jack?.el) return;
    const now = performance.now();
    if (now - jack.lastFlashAt < 90) return;
    jack.lastFlashAt = now;
    const led = jack.ledEl || jack.el;
    led.classList.add('flash');
    clearTimeout(jack.flashTimer);
    jack.flashTimer = setTimeout(() => led.classList.remove('flash'), 120);
  }

  registerJack(element, moduleId, portId, type, signal = 'gate', label = '') {
    const key = `${moduleId}:${portId}`;
    const jack = {
      key,
      el: element,
      ledEl: element.querySelector('.jack-led') || element,
      lastFlashAt: 0,
      flashTimer: null,
      moduleId,
      portId,
      type, // 'in' | 'out'
      signal, // 'gate' | 'pitch' | 'mod' | 'clock'
      label,
    };
    this.jacks.set(key, jack);

    element.dataset.jackKey = key;
    element.dataset.jackType = type;
    element.dataset.jackSignal = signal;
    element.title = `${type === 'out' ? 'AUSGANG' : 'EINGANG'}: ${label} (${signal.toUpperCase()})`;

    // Jack Event-Listener
    element.onmousedown = (e) => this.handleJackMouseDown(key, e);
    element.oncontextmenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.disconnectJack(key);
    };

    this.syncPatchedClassFor(key);
    this.requestDraw();
  }

  clearJacks() {
    for (const [, j] of this.jacks.entries()) {
      if (j.el) {
        j.el.onmousedown = null;
        j.el.oncontextmenu = null;
      }
    }
    this.jacks.clear();
  }

  unregisterModuleJacks(moduleId) {
    for (const [key, j] of this.jacks.entries()) {
      if (j.moduleId === moduleId) {
        if (j.el) {
          j.el.onmousedown = null;
          j.el.oncontextmenu = null;
        }
        this.jacks.delete(key);
      }
    }
    this.requestDraw();
  }

  disconnectJack(key) {
    const jack = this.jacks.get(key);
    if (!jack) return;
    this.engine.patchSystem.disconnectPort(jack.moduleId, jack.portId);
    this.syncPatchedClasses();
    this.requestDraw();
    this.onModified?.();
  }

  syncPatchedClasses() {
    for (const [key, jack] of this.jacks.entries()) {
      this.syncPatchedClassFor(key);
    }
  }

  syncPatchedClassFor(key) {
    const jack = this.jacks.get(key);
    if (!jack?.el) return;
    const conns = this.engine.patchSystem.getConnections();
    const isConnected = conns.some(
      (c) => `${c.fromModuleId}:${c.fromPortId}` === key || `${c.toModuleId}:${c.toPortId}` === key
    );
    jack.el.classList.toggle('patched', isConnected);
  }

  getJackCenter(key, canvasRect = null, frameCache = null) {
    if (frameCache && frameCache.has(key)) return frameCache.get(key);
    const jack = this.jacks.get(key);
    if (!jack || !jack.el || !jack.el.isConnected) {
      frameCache?.set(key, null);
      return null;
    }
    const cRect = canvasRect || this.canvas.getBoundingClientRect();
    const rect = jack.el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      frameCache?.set(key, null);
      return null;
    }
    const center = {
      x: rect.left + rect.width / 2 - cRect.left,
      y: rect.top + rect.height / 2 - cRect.top,
    };
    frameCache?.set(key, center);
    return center;
  }

  handleJackMouseDown(key, e) {
    if (e.button === 2) return;
    e.stopPropagation();
    e.preventDefault();

    const jack = this.jacks.get(key);
    if (!jack) return;
    const canvasRect = this.canvas.getBoundingClientRect();

    if (jack.type === 'out') {
      const color = SIGNAL_COLORS[jack.signal] || '#fbbf24';
      this.activeDrag = {
        fromKey: key,
        currentX: e.clientX - canvasRect.left,
        currentY: e.clientY - canvasRect.top,
        color,
        signal: jack.signal,
      };
      this.requestDraw();
    } else if (jack.type === 'in') {
      const incoming = this.engine.patchSystem.getIncoming(jack.moduleId, jack.portId);
      if (incoming) {
        const fromKey = `${incoming.fromModuleId}:${incoming.fromPortId}`;
        const color = incoming.color;
        const signal = incoming.signal;
        this.engine.patchSystem.disconnect(incoming.id);
        this.syncPatchedClasses();
        this.onModified?.();

        this.activeDrag = {
          fromKey,
          currentX: e.clientX - canvasRect.left,
          currentY: e.clientY - canvasRect.top,
          color,
          signal,
        };
        this.requestDraw();
      }
    }
  }

  handleAutoScroll(e) {
    if (!this.activeDrag) {
      this.stopAutoScroll();
      return;
    }
    this.lastDragPoint = { clientX: e.clientX, clientY: e.clientY };
    const edgeMargin = 75;
    const maxSpeed = 18;
    const y = e.clientY;
    const h = window.innerHeight;

    let vy = 0;
    if (y < edgeMargin) {
      const factor = (edgeMargin - y) / edgeMargin;
      vy = -Math.round(factor * maxSpeed + 4);
    } else if (y > h - edgeMargin) {
      const factor = (y - (h - edgeMargin)) / edgeMargin;
      vy = Math.round(factor * maxSpeed + 4);
    }

    this.autoScrollVy = vy;

    if (vy !== 0 && !this.autoScrollTimer) {
      const loop = () => {
        if (!this.activeDrag || this.autoScrollVy === 0) {
          this.autoScrollTimer = null;
          return;
        }
        window.scrollBy(0, this.autoScrollVy);

        if (this.lastDragPoint && this.appEl) {
          const appRect = this.appEl.getBoundingClientRect();
          this.activeDrag.currentX = this.lastDragPoint.clientX - appRect.left;
          this.activeDrag.currentY = this.lastDragPoint.clientY - appRect.top;
          this.requestDraw();

          const elems = document.elementsFromPoint(this.lastDragPoint.clientX, this.lastDragPoint.clientY);
          const jackEl = elems.find((el) => el.classList.contains('hw-jack'));
          if (jackEl?.dataset.jackKey && jackEl.dataset.jackType === 'in') {
            const targetKey = jackEl.dataset.jackKey;
            if (targetKey !== this.activeDrag.fromKey) {
              if (this.hoverTargetKey !== targetKey) {
                this.clearHoverTarget();
                this.hoverTargetKey = targetKey;
                jackEl.classList.add('jack-hover-target');
              }
            }
          } else {
            this.clearHoverTarget();
          }
        }
        this.autoScrollTimer = requestAnimationFrame(loop);
      };
      this.autoScrollTimer = requestAnimationFrame(loop);
    } else if (vy === 0 && this.autoScrollTimer) {
      cancelAnimationFrame(this.autoScrollTimer);
      this.autoScrollTimer = null;
    }
  }

  stopAutoScroll() {
    if (this.autoScrollTimer) {
      cancelAnimationFrame(this.autoScrollTimer);
      this.autoScrollTimer = null;
    }
    this.autoScrollVy = 0;
    this.lastDragPoint = null;
  }

  bindEvents() {
    window.addEventListener('mousemove', (e) => {
      if (!this.activeDrag) return;
      const canvasRect = this.canvas.getBoundingClientRect();

      this.activeDrag.currentX = e.clientX - canvasRect.left;
      this.activeDrag.currentY = e.clientY - canvasRect.top;
      this.requestDraw();

      this.handleAutoScroll(e);

      const elems = document.elementsFromPoint(e.clientX, e.clientY);
      const jackEl = elems.find((el) => el.classList.contains('hw-jack'));
      if (jackEl?.dataset.jackKey && jackEl.dataset.jackType === 'in') {
        const targetKey = jackEl.dataset.jackKey;
        if (targetKey !== this.activeDrag.fromKey) {
          if (this.hoverTargetKey !== targetKey) {
            this.clearHoverTarget();
            this.hoverTargetKey = targetKey;
            jackEl.classList.add('jack-hover-target');
          }
          return;
        }
      }
      this.clearHoverTarget();
    });

    document.addEventListener('scroll', () => {
      if (this.activeDrag && this.lastDragPoint) {
        const canvasRect = this.canvas.getBoundingClientRect();
        this.activeDrag.currentX = this.lastDragPoint.clientX - canvasRect.left;
        this.activeDrag.currentY = this.lastDragPoint.clientY - canvasRect.top;
      }
      this.requestDraw();
    }, { passive: true, capture: true });

    window.addEventListener('mouseup', (e) => {
      if (!this.activeDrag) return;
      this.stopAutoScroll();

      const elems = document.elementsFromPoint(e.clientX, e.clientY);
      const jackEl = elems.find((el) => el.classList.contains('hw-jack'));

      if (jackEl?.dataset.jackKey && jackEl.dataset.jackType === 'in') {
        const targetKey = jackEl.dataset.jackKey;
        const fromJack = this.jacks.get(this.activeDrag.fromKey);
        const toJack = this.jacks.get(targetKey);

        if (fromJack && toJack && fromJack.key !== toJack.key) {
          this.engine.patchSystem.connect(
            fromJack.moduleId,
            fromJack.portId,
            toJack.moduleId,
            toJack.portId,
            this.activeDrag.color
          );
          this.syncPatchedClasses();
          this.onModified?.();
        }
      }

      this.clearHoverTarget();
      this.activeDrag = null;
      this.requestDraw();
    });

    this.bindDepthEvents();
  }

  /** Findet die Stärke-Plakette unter dem Mauszeiger (Koordinaten relativ zum Canvas) */
  badgeAt(e) {
    if (!this.visible || this.activeDrag || !this.badges.length) return null;
    const r = this.canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    return this.badges.find((b) => Math.abs(x - b.x) <= 21 && Math.abs(y - b.y) <= 10) || null;
  }

  setDepth(id, depth) {
    const c = this.engine.patchSystem.connections.get(id);
    if (!c) return;
    c.depth = Math.max(0, Math.min(2, Math.round(depth * 100) / 100));
    this.requestDraw();
    this.onModified?.();
  }

  bindDepthEvents() {
    window.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const b = this.badgeAt(e);
      if (!b) return;
      const c = this.engine.patchSystem.connections.get(b.id);
      if (!c) return;
      e.preventDefault();
      e.stopPropagation();
      this.depthDrag = { id: b.id, startY: e.clientY, startDepth: c.depth ?? 1 };
      document.body.style.cursor = 'ns-resize';
    }, true);

    window.addEventListener('mousemove', (e) => {
      if (!this.depthDrag) return;
      this.setDepth(this.depthDrag.id, this.depthDrag.startDepth + (this.depthDrag.startY - e.clientY) * 0.01);
    });

    window.addEventListener('mouseup', () => {
      if (!this.depthDrag) return;
      this.depthDrag = null;
      document.body.style.cursor = '';
    });

    window.addEventListener('dblclick', (e) => {
      const b = this.badgeAt(e);
      if (b) { e.preventDefault(); this.setDepth(b.id, 1); }
    }, true);

    window.addEventListener('wheel', (e) => {
      const b = this.badgeAt(e);
      if (!b) return;
      e.preventDefault();
      const c = this.engine.patchSystem.connections.get(b.id);
      this.setDepth(b.id, (c?.depth ?? 1) - Math.sign(e.deltaY) * 0.05);
    }, { passive: false, capture: true });
  }

  clearHoverTarget() {
    if (this.hoverTargetKey) {
      const prev = this.jacks.get(this.hoverTargetKey);
      if (prev?.el) prev.el.classList.remove('jack-hover-target');
      this.hoverTargetKey = null;
    }
  }

  toggleVisible() {
    this.visible = !this.visible;
    this.requestDraw();
    return this.visible;
  }

  setLod(lod) {
    if (this.lod === lod) return;
    this.lod = lod;
    this.requestDraw();
  }

  requestDraw() {
    if (this.drawScheduled || document.hidden) return;
    this.drawScheduled = true;
    requestAnimationFrame(() => {
      this.drawScheduled = false;
      this.drawCables();
    });
  }

  setSelectedModule(moduleId) {
    if (this.selectedModuleId === moduleId) return;
    this.selectedModuleId = moduleId;
    this.requestDraw();
  }

  drawCables() {
    const canvasRect = this.canvas.getBoundingClientRect();
    const w = canvasRect.width || window.innerWidth;
    const h = canvasRect.height || window.innerHeight;

    this.ctx.clearRect(0, 0, w, h);
    if (!this.visible && !this.activeDrag) return;

    const conns = this.engine.patchSystem.getConnections();
    const selId = this.selectedModuleId;
    if (!this._frameCenterCache) this._frameCenterCache = new Map();
    const frameCache = this._frameCenterCache;
    frameCache.clear();

    // 1. Bereits gesteckte Kabel zeichnen (starr verankert)
    this.badges = [];
    if (this.visible) {
      conns.forEach((c) => {
        const p1 = this.getJackCenter(`${c.fromModuleId}:${c.fromPortId}`, canvasRect, frameCache);
        const p2 = this.getJackCenter(`${c.toModuleId}:${c.toPortId}`, canvasRect, frameCache);
        if (p1 && p2) {
          const isConnectedToSelected = !selId || (c.fromModuleId === selId || c.toModuleId === selId);
          this.drawDroopingCord(p1.x, p1.y, p2.x, p2.y, c.color, false, isConnectedToSelected);
          if (c.signal === 'mod' && this.lod !== 'low') {
            const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            const sag = Math.min(80, 10 + dist * 0.12);
            this.badges.push({
              id: c.id,
              x: (p1.x + p2.x) / 2,
              y: (p1.y + p2.y) / 2 + sag * 0.5,
              depth: c.depth ?? 1,
              color: c.color,
              isFocus: isConnectedToSelected
            });
          }
        }
      });
      if (this.lod === 'high') {
        this.badges.forEach((b) => this.drawDepthBadge(b));
      } else if (this.lod === 'medium' && selId) {
        this.badges.filter((b) => b.isFocus).forEach((b) => this.drawDepthBadge(b));
      }
    }

    // 2. Aktuell gezogenes Kabel zeichnen
    if (this.activeDrag) {
      const p1 = this.getJackCenter(this.activeDrag.fromKey, canvasRect, frameCache);
      if (p1) {
        this.drawDroopingCord(
          p1.x,
          p1.y,
          this.activeDrag.currentX,
          this.activeDrag.currentY,
          this.activeDrag.color,
          true,
          true
        );
      }
    }
  }

  drawDepthBadge(b) {
    const ctx = this.ctx;
    const w = 38, h = 16;
    const active = this.depthDrag?.id === b.id;
    ctx.save();
    if (!b.isFocus) ctx.globalAlpha = 0.42;
    ctx.beginPath();
    ctx.roundRect(b.x - w / 2, b.y - h / 2, w, h, 6);
    ctx.fillStyle = active ? '#0b0d12' : 'rgba(18, 20, 26, 0.92)';
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = b.color;
    ctx.stroke();
    // Füllstand-Balken (0–200 %)
    ctx.fillStyle = b.color + '66';
    ctx.beginPath();
    ctx.roundRect(b.x - w / 2 + 2, b.y + h / 2 - 4.5, (w - 4) * (b.depth / 2), 2.5, 1.2);
    ctx.fill();
    ctx.fillStyle = '#e5e7eb';
    ctx.font = '600 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round(b.depth * 100)}%`, b.x, b.y - 1);
    ctx.restore();
  }

  drawDroopingCord(x1, y1, x2, y2, color, isDragging = false, isFocus = true) {
    const ctx = this.ctx;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Formstabile Studio-Kurve
    const sag = Math.min(75, 8 + dist * 0.11);
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2 + sag;

    ctx.save();

    // Dimmung: nicht-ausgewählte Kabel werden dezent abgeblendet, bleiben aber klar sichtbar
    if (!isFocus) {
      ctx.globalAlpha = 0.42;
    }

    // Low-LOD (Overview Mode): Direkte Linien ohne Schattenwurf und ohne Stecker-Details
    if (this.lod === 'low' && !isDragging) {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = isFocus ? 1.8 : 1.2;
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
      return;
    }

    // Weicher, dezenter Schattenwurf (nur im High-LOD)
    if (this.lod === 'high') {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.lineWidth = isFocus ? 4.5 : 2.5;
      ctx.lineCap = 'round';
      ctx.moveTo(x1, y1 + 4);
      ctx.quadraticCurveTo(midX, midY + 6, x2, y2 + 4);
      ctx.stroke();
    }

    // Matter, technischer Kabel-Körper
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = isDragging ? 3.4 : isFocus ? 2.6 : 1.8;
    ctx.lineCap = 'round';
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(midX, midY, x2, y2);
    ctx.stroke();

    // Klinkenstecker
    this.drawPlugHead(x1, y1, color, isFocus);
    if (!isDragging || this.hoverTargetKey) {
      this.drawPlugHead(x2, y2, color, isFocus);
    } else {
      this.drawFloatingPlugHead(x2, y2, color);
    }

    ctx.restore();
  }

  drawPlugHead(x, y, color, isFocus = true) {
    const ctx = this.ctx;
    ctx.fillStyle = '#181b22';
    ctx.beginPath();
    ctx.arc(x, y, 6.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = isFocus ? '#4b5563' : '#2d3340';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 3.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#d1d5db';
    ctx.beginPath();
    ctx.arc(x, y, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  drawFloatingPlugHead(x, y, color) {
    const ctx = this.ctx;
    ctx.save();
    if (this.lod === 'high') {
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
    }
    this.drawPlugHead(x, y, color);
    ctx.restore();
  }
}
