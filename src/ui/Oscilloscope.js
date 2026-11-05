// Retro CRT Phosphor Oscilloscope & Spectrum Visualizer (CPU & RAM Optimized)

export class Oscilloscope {
  constructor(canvas, analyser) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    this.analyser = analyser;
    this.mode = 'wave'; // 'wave' | 'freq'
    this.colorMode = 'amber'; // 'green' | 'amber' | 'cyan'

    this.bufferLength = analyser ? Math.min(analyser.frequencyBinCount, 512) : 256;
    this.dataArray = new Uint8Array(this.bufferLength);

    this.isRunning = false;
    this.animationId = null;
    this.lastDrawTime = 0;
    this.fpsInterval = 1000 / 30; // 30 FPS limit spart massiv CPU & GPU
    this.idleFrames = 0;
    this.isSleeping = false;

    this.initCanvas();
    this.bindVisibility();
  }

  bindVisibility() {
    this._onVisibilityChange = () => {
      if (document.hidden) {
        this.stop();
      } else {
        this.start();
      }
    };
    document.addEventListener('visibilitychange', this._onVisibilityChange);
  }

  initCanvas() {
    // DPR auf maximal 1.5 deckeln – spart 50–70 % VRAM auf Retina-Displays ohne sichtbaren Verlust
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width || 280;
    const h = rect.height || 100;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
    this.w = w;
    this.h = h;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isSleeping = false;

    const drawLoop = (now) => {
      if (!this.isRunning) return;
      this.animationId = requestAnimationFrame(drawLoop);

      // Throttling auf max. 30 FPS
      const elapsed = now - this.lastDrawTime;
      if (elapsed < this.fpsInterval) return;
      this.lastDrawTime = now - (elapsed % this.fpsInterval);

      // Pausieren wenn Audio nicht läuft oder Tab im Hintergrund
      if (document.hidden) return;
      if (this.analyser?.context?.state !== 'running') {
        if (!this.isSleeping) {
          this.drawIdle();
          this.isSleeping = true;
        }
        return;
      }

      this.draw();
    };

    this.animationId = requestAnimationFrame(drawLoop);
  }

  stop() {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  drawIdle() {
    const { ctx, w, h } = this;
    ctx.fillStyle = '#0a0e0c';
    ctx.fillRect(0, 0, w, h);
    this.drawGrid();
    ctx.strokeStyle = this.getColor(0.4);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
  }

  draw() {
    const { ctx, w, h } = this;
    if (!this.analyser) {
      this.drawIdle();
      return;
    }

    if (this.mode === 'wave') {
      this.analyser.getByteTimeDomainData(this.dataArray);

      // Stille-Erkennung: Wenn das Signal absolut flach ist, nach 45 Frames einschlafen
      let isSilent = true;
      const step = Math.max(1, Math.floor(this.bufferLength / 32));
      for (let i = 0; i < this.bufferLength; i += step) {
        if (Math.abs(this.dataArray[i] - 128) > 2) {
          isSilent = false;
          break;
        }
      }

      if (isSilent) {
        this.idleFrames++;
        if (this.idleFrames > 30) {
          this.drawIdle();
          this.isSleeping = true;
          return;
        }
      } else {
        this.idleFrames = 0;
        this.isSleeping = false;
      }

      // CRT persistence fade
      ctx.fillStyle = 'rgba(10, 14, 12, 0.32)';
      ctx.fillRect(0, 0, w, h);
      this.drawGrid();

      // Schlanker Glow-Effekt OHNE teures shadowBlur: Doppelter Stroke
      // 1. Weicher äußerer Glow (schnell, kein GPU-Blur-Raster)
      ctx.lineWidth = 3.2;
      ctx.strokeStyle = this.getColor(0.28);
      ctx.beginPath();
      const sliceWidth = w / this.bufferLength;
      let x = 0;
      for (let i = 0; i < this.bufferLength; i += 2) {
        const v = this.dataArray[i] / 128.0;
        const y = (v * h) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth * 2;
      }
      ctx.stroke();

      // 2. Scharfer innerer Kern
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = this.getColor(0.95);
      ctx.beginPath();
      x = 0;
      for (let i = 0; i < this.bufferLength; i += 2) {
        const v = this.dataArray[i] / 128.0;
        const y = (v * h) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth * 2;
      }
      ctx.stroke();
    } else {
      // Frequency Bars
      ctx.fillStyle = '#0a0e0c';
      ctx.fillRect(0, 0, w, h);
      this.drawGrid();

      this.analyser.getByteFrequencyData(this.dataArray);
      const count = Math.min(64, Math.floor(this.bufferLength / 3));
      const barWidth = w / count;
      let x = 0;
      ctx.fillStyle = this.getColor(0.85);

      for (let i = 0; i < count; i++) {
        const barHeight = (this.dataArray[i] / 255) * h * 0.9;
        ctx.fillRect(x, h - barHeight, Math.max(1, barWidth - 1), barHeight);
        x += barWidth;
      }
    }
  }

  drawGrid() {
    const { ctx, w, h } = this;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 0.5;

    ctx.beginPath();
    // Centerlines
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);

    // Minor divisions
    const stepX = w / 8;
    for (let x = stepX; x < w; x += stepX) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    const stepY = h / 4;
    for (let y = stepY; y < h; y += stepY) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
  }

  getColor(alpha = 1) {
    if (this.colorMode === 'green') return `rgba(50, 255, 120, ${alpha})`;
    if (this.colorMode === 'cyan') return `rgba(60, 220, 255, ${alpha})`;
    return `rgba(255, 160, 40, ${alpha})`;
  }

  destroy() {
    this.stop();
    if (this._onVisibilityChange) {
      document.removeEventListener('visibilitychange', this._onVisibilityChange);
    }
  }
}
