// Retro CRT Phosphor Oscilloscope & Spectrum Visualizer

export class Oscilloscope {
  constructor(canvas, analyser) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.analyser = analyser;
    this.mode = 'wave'; // 'wave' | 'freq'
    this.colorMode = 'amber'; // 'green' | 'amber' | 'cyan'

    this.bufferLength = analyser ? analyser.frequencyBinCount : 512;
    this.dataArray = new Uint8Array(this.bufferLength);

    this.isRunning = false;
    this.animationId = null;

    this.initCanvas();
  }

  initCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = (rect.width || 280) * dpr;
    this.canvas.height = (rect.height || 100) * dpr;
    this.ctx.scale(dpr, dpr);
    this.w = rect.width || 280;
    this.h = rect.height || 100;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    const draw = () => {
      this.draw();
      if (this.isRunning) {
        this.animationId = requestAnimationFrame(draw);
      }
    };
    draw();
  }

  stop() {
    this.isRunning = false;
    if (this.animationId) cancelAnimationFrame(this.animationId);
  }

  draw() {
    const { ctx, w, h } = this;
    if (!this.analyser) {
      // Idle line
      ctx.fillStyle = 'rgba(12, 16, 14, 0.4)';
      ctx.fillRect(0, 0, w, h);
      this.drawGrid();
      ctx.strokeStyle = this.getColor(0.4);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      return;
    }

    // CRT persistence fade
    ctx.fillStyle = 'rgba(10, 14, 12, 0.28)';
    ctx.fillRect(0, 0, w, h);

    this.drawGrid();

    if (this.mode === 'wave') {
      this.analyser.getByteTimeDomainData(this.dataArray);

      // Glow effect
      ctx.shadowBlur = 10;
      ctx.shadowColor = this.getColor(0.9);
      ctx.lineWidth = 2.0;
      ctx.strokeStyle = this.getColor(0.95);
      ctx.beginPath();

      const sliceWidth = w / this.bufferLength;
      let x = 0;

      for (let i = 0; i < this.bufferLength; i++) {
        const v = this.dataArray[i] / 128.0;
        const y = (v * h) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      ctx.lineTo(w, h / 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else {
      // Frequency Bars
      this.analyser.getByteFrequencyData(this.dataArray);
      const barWidth = (w / (this.bufferLength / 3)) * 1.5;
      let x = 0;
      ctx.fillStyle = this.getColor(0.85);

      for (let i = 0; i < this.bufferLength / 3; i++) {
        const barHeight = (this.dataArray[i] / 255) * h * 0.9;
        ctx.fillRect(x, h - barHeight, barWidth - 1, barHeight);
        x += barWidth;
      }
    }
  }

  drawGrid() {
    const { ctx, w, h } = this;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 0.5;

    // Reticle crosshair
    ctx.beginPath();
    // Horizontal center
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    // Vertical center
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
    // Amber phosphor default
    return `rgba(255, 160, 40, ${alpha})`;
  }
}
