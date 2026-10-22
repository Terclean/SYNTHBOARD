// Interactive 3.5mm Modular Patch Cable System

export class PatchBay {
  constructor(canvasEl, audioEngine) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.engine = audioEngine;

    this.jacks = new Map(); // id -> { el, type: 'in' | 'out', name, target }
    this.cables = []; // { id, fromJackId, toJackId, color }

    this.activeDrag = null; // { fromJackId, currentX, currentY, color }
    this.cableColors = ['#a0aab2', '#e06c75', '#e5c07b', '#98c379', '#61afef', '#c678dd'];
    this.colorIndex = 0;

    this.initCanvas();
    this.bindEvents();
    this.startRenderLoop();
  }

  initCanvas() {
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = window.innerWidth * dpr;
      this.canvas.height = window.innerHeight * dpr;
      this.ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);
  }

  registerJack(id, element, type, name, onConnect) {
    this.jacks.set(id, {
      id,
      el: element,
      type, // 'in' or 'out'
      name,
      onConnect
    });

    element.dataset.jackId = id;
    element.dataset.jackType = type;
    element.title = `${type.toUpperCase()}: ${name}`;

    element.addEventListener('mousedown', (e) => this.handleJackMouseDown(id, e));
  }

  getJackCenter(id) {
    const jack = this.jacks.get(id);
    if (!jack || !jack.el) return null;
    const rect = jack.el.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }

  handleJackMouseDown(jackId, e) {
    e.stopPropagation();
    e.preventDefault();

    // Check if jack already has a cable connected; if so, disconnect or pull it
    const existingIndex = this.cables.findIndex(c => c.fromJackId === jackId || c.toJackId === jackId);
    if (existingIndex !== -1 && e.button === 2) { // right click disconnect
      this.removeCable(existingIndex);
      return;
    }

    const jack = this.jacks.get(jackId);
    if (!jack) return;

    if (jack.type === 'out') {
      const color = this.cableColors[this.colorIndex % this.cableColors.length];
      this.colorIndex++;
      this.activeDrag = {
        fromJackId: jackId,
        currentX: e.clientX,
        currentY: e.clientY,
        color
      };
    } else if (jack.type === 'in' && existingIndex !== -1) {
      // Unplug from input and start dragging to re-patch
      const cable = this.cables[existingIndex];
      this.activeDrag = {
        fromJackId: cable.fromJackId,
        currentX: e.clientX,
        currentY: e.clientY,
        color: cable.color
      };
      this.removeCable(existingIndex);
    }
  }

  bindEvents() {
    window.addEventListener('mousemove', (e) => {
      if (this.activeDrag) {
        this.activeDrag.currentX = e.clientX;
        this.activeDrag.currentY = e.clientY;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (!this.activeDrag) return;

      // Check if dropped on an input jack
      const elemBelow = document.elementFromPoint(e.clientX, e.clientY);
      const jackEl = elemBelow ? elemBelow.closest('.hw-jack') : null;

      if (jackEl && jackEl.dataset.jackId) {
        const targetId = jackEl.dataset.jackId;
        const targetJack = this.jacks.get(targetId);

        if (targetJack && targetJack.type === 'in' && targetId !== this.activeDrag.fromJackId) {
          // Connect!
          this.connect(this.activeDrag.fromJackId, targetId, this.activeDrag.color);
        }
      }

      this.activeDrag = null;
    });

    window.addEventListener('contextmenu', (e) => {
      if (e.target.closest('.hw-jack')) {
        e.preventDefault();
      }
    });
  }

  connect(fromId, toId, color) {
    // Remove any existing cable to that input
    const prevIdx = this.cables.findIndex(c => c.toJackId === toId);
    if (prevIdx !== -1) this.removeCable(prevIdx);

    const cable = {
      id: `${fromId}->${toId}`,
      fromJackId: fromId,
      toJackId: toId,
      color: color || '#a0aab2'
    };
    this.cables.push(cable);

    // Visual indicators on jacks
    const fromJack = this.jacks.get(fromId);
    const toJack = this.jacks.get(toId);
    if (fromJack?.el) fromJack.el.classList.add('patched');
    if (toJack?.el) toJack.el.classList.add('patched');

    // Trigger audio routing
    this.applyAudioPatch(fromId, toId, true);
  }

  removeCable(index) {
    if (index >= 0 && index < this.cables.length) {
      const cable = this.cables[index];
      this.applyAudioPatch(cable.fromJackId, cable.toJackId, false);

      const fromJack = this.jacks.get(cable.fromJackId);
      const toJack = this.jacks.get(cable.toJackId);
      if (fromJack?.el) fromJack.el.classList.remove('patched');
      if (toJack?.el) toJack.el.classList.remove('patched');

      this.cables.splice(index, 1);
    }
  }

  applyAudioPatch(fromId, toId, isConnected) {
    if (!this.engine) return;
    // Map of supported modular routes
    if (toId === 'jack_filter_cv') {
      if (isConnected) {
        if (fromId === 'jack_seq_cv') this.engine.sequencerModTarget = 'filter';
        if (fromId === 'jack_lfo_cv') this.engine.filter.setLfoDepth(0.85);
      } else {
        if (fromId === 'jack_seq_cv') this.engine.sequencerModTarget = null;
        if (fromId === 'jack_lfo_cv') this.engine.filter.setLfoDepth(0);
      }
    } else if (toId === 'jack_delay_cv') {
      if (isConnected && fromId === 'jack_lfo_cv') {
        this.engine.delay.setMod(0.8);
      } else if (!isConnected && fromId === 'jack_lfo_cv') {
        this.engine.delay.setMod(0.2);
      }
    } else if (toId === 'jack_drone_fm') {
      if (isConnected && fromId === 'jack_noise_out') {
        this.engine.droneEngine.voices.forEach(v => v.setFmAmount(0.6));
      } else if (!isConnected && fromId === 'jack_noise_out') {
        this.engine.droneEngine.voices.forEach(v => v.setFmAmount(0.1));
      }
    }
  }

  startRenderLoop() {
    const draw = () => {
      this.drawCables();
      requestAnimationFrame(draw);
    };
    draw();
  }

  drawCables() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw established cables
    this.cables.forEach(c => {
      const p1 = this.getJackCenter(c.fromJackId);
      const p2 = this.getJackCenter(c.toJackId);
      if (p1 && p2) {
        this.drawDroopingCord(p1.x, p1.y, p2.x, p2.y, c.color);
      }
    });

    // Draw active dragging cable
    if (this.activeDrag) {
      const p1 = this.getJackCenter(this.activeDrag.fromJackId);
      if (p1) {
        this.drawDroopingCord(p1.x, p1.y, this.activeDrag.currentX, this.activeDrag.currentY, this.activeDrag.color);
      }
    }
  }

  drawDroopingCord(x1, y1, x2, y2, color) {
    const ctx = this.ctx;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Natural gravity sag
    const sag = Math.min(180, 40 + dist * 0.28);
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2 + sag;

    // Cable shadow
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.moveTo(x1, y1 + 10);
    ctx.quadraticCurveTo(midX, midY + 15, x2, y2 + 10);
    ctx.stroke();

    // Cable body
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(midX, midY, x2, y2);
    ctx.stroke();

    // Cable highlight reflection
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 2;
    ctx.moveTo(x1, y1 - 1);
    ctx.quadraticCurveTo(midX, midY - 2, x2, y2 - 1);
    ctx.stroke();

    // Plug barrels
    this.drawPlugHead(x1, y1, color);
    this.drawPlugHead(x2, y2, color);
  }

  drawPlugHead(x, y, color) {
    const ctx = this.ctx;
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#silver';
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
