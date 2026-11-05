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

    this.jacks = new Map(); // key `${moduleId}:${portId}` -> { el, moduleId, portId, type, signal, label }
    this.activeDrag = null; // { fromKey, currentX, currentY, color, signal }
    this.hoverTargetKey = null;
    this.drawScheduled = false;
    this.badges = []; // Stärke-Plaketten der Modulationskabel { id, x, y }
    this.depthDrag = null;

    this.initCanvas();
    this.bindEvents();
    this.setupEngineHooks();
    this.requestDraw();
  }

  initCanvas() {
    this.appEl = document.querySelector('.app');

    const updateSize = () => {
      if (!this.appEl) return;
      // DPR auf 1.5 deckeln: spart 50–70 % VRAM auf Retina, Kabel bleiben perfekt scharf
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.max(window.innerWidth, this.appEl.scrollWidth || this.appEl.offsetWidth || 1200);
      const h = Math.max(window.innerHeight, this.appEl.scrollHeight || this.appEl.offsetHeight || 800);

      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.canvas.style.width = `${w}px`;
      this.canvas.style.height = `${h}px`;

      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(dpr, dpr);
      this.requestDraw();
    };

    this.updateSize = updateSize;
    updateSize();
    window.addEventListener('resize', updateSize);

    if (window.ResizeObserver) {
      if (this.appEl) new ResizeObserver(() => updateSize()).observe(this.appEl);
      const ws = document.querySelector('.workspace');
      if (ws) new ResizeObserver(() => updateSize()).observe(ws);
      const rk = document.querySelector('.rack');
      if (rk) new ResizeObserver(() => updateSize()).observe(rk);
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
    const jack = this.jacks.get(key);
    if (!jack?.el) return;
    const led = jack.el.querySelector('.jack-led') || jack.el;
    led.classList.add('flash');
    setTimeout(() => led.classList.remove('flash'), 120);
  }

  registerJack(element, moduleId, portId, type, signal = 'gate', label = '') {
    const key = `${moduleId}:${portId}`;
    const jack = {
      key,
      el: element,
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

  getJackCenter(key) {
    const jack = this.jacks.get(key);
    if (!jack || !jack.el || !document.body.contains(jack.el)) return null;
    if (!this.appEl) this.appEl = document.querySelector('.app');
    const appRect = this.appEl.getBoundingClientRect();
    const rect = jack.el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return null;
    return {
      x: rect.left + rect.width / 2 - appRect.left,
      y: rect.top + rect.height / 2 - appRect.top,
    };
  }

  handleJackMouseDown(key, e) {
    if (e.button === 2) return;
    e.stopPropagation();
    e.preventDefault();

    const jack = this.jacks.get(key);
    if (!jack) return;
    if (!this.appEl) this.appEl = document.querySelector('.app');
    const appRect = this.appEl.getBoundingClientRect();

    if (jack.type === 'out') {
      const color = SIGNAL_COLORS[jack.signal] || '#fbbf24';
      this.activeDrag = {
        fromKey: key,
        currentX: e.clientX - appRect.left,
        currentY: e.clientY - appRect.top,
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
          currentX: e.clientX - appRect.left,
          currentY: e.clientY - appRect.top,
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
      if (!this.appEl) this.appEl = document.querySelector('.app');
      const appRect = this.appEl.getBoundingClientRect();

      this.activeDrag.currentX = e.clientX - appRect.left;
      this.activeDrag.currentY = e.clientY - appRect.top;
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

    window.addEventListener('scroll', () => {
      if (this.activeDrag && this.lastDragPoint && this.appEl) {
        const appRect = this.appEl.getBoundingClientRect();
        this.activeDrag.currentX = this.lastDragPoint.clientX - appRect.left;
        this.activeDrag.currentY = this.lastDragPoint.clientY - appRect.top;
        this.requestDraw();
      }
    }, { passive: true });

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

  /** Findet die Stärke-Plakette unter dem Mauszeiger (Koordinaten relativ zur App) */
  badgeAt(e) {
    if (!this.visible || this.activeDrag || !this.badges.length) return null;
    if (!this.appEl) this.appEl = document.querySelector('.app');
    const r = this.appEl.getBoundingClientRect();
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

  requestDraw() {
    if (this.drawScheduled) return;
    this.drawScheduled = true;
    requestAnimationFrame(() => {
      this.drawScheduled = false;
      this.drawCables();
    });
  }

  drawCables() {
    if (!this.appEl) this.appEl = document.querySelector('.app');
    const w = this.appEl ? (this.appEl.scrollWidth || this.appEl.offsetWidth) : window.innerWidth;
    const h = this.appEl ? (this.appEl.scrollHeight || this.appEl.offsetHeight) : window.innerHeight;

    this.ctx.clearRect(0, 0, w, h);
    if (!this.visible && !this.activeDrag) return;

    const conns = this.engine.patchSystem.getConnections();

    // 1. Bereits gesteckte Kabel zeichnen (starr verankert)
    this.badges = [];
    if (this.visible) {
      conns.forEach((c) => {
        const p1 = this.getJackCenter(`${c.fromModuleId}:${c.fromPortId}`);
        const p2 = this.getJackCenter(`${c.toModuleId}:${c.toPortId}`);
        if (p1 && p2) {
          this.drawDroopingCord(p1.x, p1.y, p2.x, p2.y, c.color);
          if (c.signal === 'mod') {
            const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            const sag = Math.min(80, 10 + dist * 0.12);
            this.badges.push({ id: c.id, x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 + sag * 0.5, depth: c.depth ?? 1, color: c.color });
          }
        }
      });
      this.badges.forEach((b) => this.drawDepthBadge(b));
    }

    // 2. Aktuell gezogenes Kabel zeichnen
    if (this.activeDrag) {
      const p1 = this.getJackCenter(this.activeDrag.fromKey);
      if (p1) {
        this.drawDroopingCord(
          p1.x,
          p1.y,
          this.activeDrag.currentX,
          this.activeDrag.currentY,
          this.activeDrag.color,
          true
        );
      }
    }
  }

  drawDepthBadge(b) {
    const ctx = this.ctx;
    const w = 40, h = 17;
    const active = this.depthDrag?.id === b.id;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(b.x - w / 2, b.y - h / 2, w, h, 8);
    ctx.fillStyle = active ? '#0b0d12' : 'rgba(12, 14, 20, 0.88)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = b.color;
    ctx.stroke();
    // Füllstand-Balken (0–200 %)
    ctx.fillStyle = b.color + '55';
    ctx.beginPath();
    ctx.roundRect(b.x - w / 2 + 2, b.y + h / 2 - 5, (w - 4) * (b.depth / 2), 3, 1.5);
    ctx.fill();
    ctx.fillStyle = '#e9ebf0';
    ctx.font = '600 9.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round(b.depth * 100)}%`, b.x, b.y - 1.5);
    ctx.restore();
  }

  drawDroopingCord(x1, y1, x2, y2, color, isDragging = false) {
    const ctx = this.ctx;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Straffe, formstabile Kurve ("starr" ohne extremes Durchhängen)
    const sag = Math.min(80, 10 + dist * 0.12);
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2 + sag;

    // Weicher Schattenwurf
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.moveTo(x1, y1 + 8);
    ctx.quadraticCurveTo(midX, midY + 12, x2, y2 + 8);
    ctx.stroke();

    // Straffer Kabel-Körper
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = isDragging ? 5.5 : 4.5;
    ctx.lineCap = 'round';
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(midX, midY, x2, y2);
    ctx.stroke();

    // Dezente 3D-Glanzkante
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.moveTo(x1, y1 - 1);
    ctx.quadraticCurveTo(midX, midY - 1.5, x2, y2 - 1);
    ctx.stroke();

    // Klinkenstecker
    this.drawPlugHead(x1, y1, color);
    if (!isDragging || this.hoverTargetKey) {
      this.drawPlugHead(x2, y2, color);
    } else {
      this.drawFloatingPlugHead(x2, y2, color);
    }
  }

  drawPlugHead(x, y, color) {
    const ctx = this.ctx;
    ctx.fillStyle = '#1c1e24';
    ctx.beginPath();
    ctx.arc(x, y, 8.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#d1d5db';
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  drawFloatingPlugHead(x, y, color) {
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    this.drawPlugHead(x, y, color);
    ctx.restore();
  }
}
