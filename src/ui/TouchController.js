// Solar 42F Capacitive Touch Plate Controller

export class TouchController {
  constructor(containerEl, touchSynth) {
    this.container = containerEl;
    this.synth = touchSynth;

    // Ambient Musical Scales (frequencies in Hz for 8 plates)
    this.scales = {
      dorian: {
        name: 'Dorian Ambient',
        notes: ['A2', 'B2', 'C3', 'D3', 'E3', 'F#3', 'G3', 'A3'],
        freqs: [110.0, 123.47, 130.81, 146.83, 164.81, 185.0, 196.0, 220.0]
      },
      pentatonic: {
        name: 'Minor Pentatonic',
        notes: ['A2', 'C3', 'D3', 'E3', 'G3', 'A3', 'C4', 'E4'],
        freqs: [110.0, 130.81, 146.83, 164.81, 196.0, 220.0, 261.63, 329.63]
      },
      hirajoshi: {
        name: 'Hirajoshi (Mystic)',
        notes: ['A2', 'B2', 'C3', 'E3', 'F3', 'A3', 'B3', 'C4'],
        freqs: [110.0, 123.47, 130.81, 164.81, 174.61, 220.0, 246.94, 261.63]
      },
      solarchord: {
        name: 'Solar Cluster',
        notes: ['A1', 'E2', 'A2', 'C#3', 'E3', 'G#3', 'B3', 'E4'],
        freqs: [55.0, 82.41, 110.0, 138.59, 164.81, 207.65, 246.94, 329.63]
      }
    };

    this.currentScale = 'pentatonic';
    this.activeStripIndex = -1;
    this.isPressed = false;

    this.render();
    this.bindEvents();
  }

  render() {
    const scale = this.scales[this.currentScale];
    this.container.innerHTML = `
      <div class="touch-plate-housing">
        <div class="touch-plate-header">
          <div class="touch-plate-title">CAPACITIVE SENSITIVE CONTROLLER</div>
          <div class="scale-selector-wrap">
            <label for="scale-select">SCALE:</label>
            <select id="scale-select" class="hw-select">
              ${Object.entries(this.scales).map(([key, s]) => `
                <option value="${key}" ${key === this.currentScale ? 'selected' : ''}>${s.name}</option>
              `).join('')}
            </select>
          </div>
        </div>

        <div class="touch-strips-grid">
          <div class="touch-geo-left">
            <svg viewBox="0 0 40 100" class="geo-svg">
              <polygon points="20,10 38,90 2,90" fill="none" stroke="currentColor" stroke-width="2"/>
              <circle cx="20" cy="60" r="6" fill="currentColor"/>
            </svg>
          </div>

          <div class="strips-group strips-group-1">
            ${[0, 1, 2, 3].map(i => this.renderStrip(i, scale)).join('')}
          </div>

          <div class="touch-geo-center">
            <div class="solar-sun-emblem">
              <div class="sun-inner"></div>
              <div class="sun-glow"></div>
            </div>
            <div class="solar-label">SOLAR 42</div>
          </div>

          <div class="strips-group strips-group-2">
            ${[4, 5, 6, 7].map(i => this.renderStrip(i, scale)).join('')}
          </div>

          <div class="touch-geo-right">
            <svg viewBox="0 0 40 100" class="geo-svg">
              <polygon points="20,10 38,90 2,90" fill="none" stroke="currentColor" stroke-width="2"/>
              <circle cx="20" cy="60" r="6" fill="currentColor"/>
            </svg>
          </div>
        </div>
      </div>
    `;
  }

  renderStrip(index, scale) {
    const note = scale.notes[index] || `P${index + 1}`;
    return `
      <div class="touch-strip" data-index="${index}" tabindex="0">
        <div class="strip-copper-traces">
          ${Array.from({ length: 14 }).map((_, barIdx) => `<div class="copper-bar" style="--bar-idx: ${barIdx}"></div>`).join('')}
        </div>
        <div class="strip-glow-overlay"></div>
        <div class="strip-note-label">${note}</div>
      </div>
    `;
  }

  bindEvents() {
    const select = this.container.querySelector('#scale-select');
    if (select) {
      select.addEventListener('change', (e) => {
        this.currentScale = e.target.value;
        this.render();
        this.bindEvents();
      });
    }

    const strips = this.container.querySelectorAll('.touch-strip');

    const handlePointerDown = (strip, e) => {
      this.isPressed = true;
      const index = parseInt(strip.dataset.index, 10);
      const rect = strip.getBoundingClientRect();
      const clientY = e.clientY ?? (e.touches ? e.touches[0].clientY : rect.bottom);
      // Normalized pressure from 0 (bottom) to 1 (top)
      const pressure = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));

      this.triggerNote(index, pressure);
      strip.classList.add('active');
    };

    const handlePointerMove = (strip, e) => {
      if (!this.isPressed) return;
      const rect = strip.getBoundingClientRect();
      const clientY = e.clientY ?? (e.touches ? e.touches[0].clientY : rect.bottom);
      const pressure = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
      if (this.synth) {
        this.synth.updatePressure(pressure);
      }
    };

    const handlePointerUp = (strip) => {
      if (!this.isPressed) return;
      this.isPressed = false;
      this.releaseNote();
      this.container.querySelectorAll('.touch-strip').forEach(s => s.classList.remove('active'));
    };

    strips.forEach(strip => {
      strip.addEventListener('mousedown', (e) => handlePointerDown(strip, e));
      strip.addEventListener('mouseenter', (e) => {
        if (this.isPressed) {
          this.container.querySelectorAll('.touch-strip').forEach(s => s.classList.remove('active'));
          handlePointerDown(strip, e);
        }
      });
      strip.addEventListener('mousemove', (e) => handlePointerMove(strip, e));
      strip.addEventListener('mouseup', () => handlePointerUp(strip));

      // Touch
      strip.addEventListener('touchstart', (e) => {
        e.preventDefault();
        handlePointerDown(strip, e);
      }, { passive: false });

      strip.addEventListener('touchmove', (e) => {
        e.preventDefault();
        handlePointerMove(strip, e);
      }, { passive: false });

      strip.addEventListener('touchend', (e) => {
        e.preventDefault();
        handlePointerUp(strip);
      }, { passive: false });
    });

    window.addEventListener('mouseup', () => {
      if (this.isPressed) {
        this.isPressed = false;
        this.releaseNote();
        this.container.querySelectorAll('.touch-strip').forEach(s => s.classList.remove('active'));
      }
    });
  }

  triggerNote(index, pressure) {
    this.activeStripIndex = index;
    const scale = this.scales[this.currentScale];
    const freq = scale.freqs[index];
    if (this.synth) {
      this.synth.noteOn(freq, pressure);
    }
  }

  releaseNote() {
    this.activeStripIndex = -1;
    if (this.synth) {
      this.synth.noteOff();
    }
  }
}
