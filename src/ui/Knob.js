// Realistic Hardware Rotary Knob Component

export class Knob {
  constructor(element, options = {}) {
    this.el = element;
    this.min = options.min ?? 0;
    this.max = options.max ?? 1;
    this.value = options.value ?? (this.min + this.max) / 2;
    this.defaultValue = options.defaultValue !== undefined ? options.defaultValue : this.value;
    this.stepVal = options.step ?? 0.01;
    this.onChange = options.onChange || null;
    this.onShiftClick = options.onShiftClick || null;
    this.onFocus = options.onFocus || null;
    this.onBlur = options.onBlur || null;
    this.unit = options.unit || '';
    this.label = options.label || '';
    this.logarithmic = options.logarithmic || false;

    // Visual angle range: -135 deg to +135 deg (270 deg sweep)
    this.minAngle = -135;
    this.maxAngle = 135;

    this.isDragging = false;
    this.startY = 0;
    this.startVal = this.value;

    this.render();
    this.bindEvents();
    this.updateVisuals();
  }

  render() {
    this.el.classList.add('hw-knob-container');
    const colorClass = this.el.dataset.knobColor ? `knob-${this.el.dataset.knobColor}` : 'knob-default';
    const sizeClass = this.el.dataset.knobSize ? `knob-${this.el.dataset.knobSize}` : 'knob-med';

    this.el.innerHTML = `
      <div class="hw-knob ${colorClass} ${sizeClass}" tabindex="0" role="slider" aria-valuenow="${this.value}">
        <div class="knob-body">
          <div class="knob-cap"></div>
          <div class="knob-indicator"></div>
        </div>
      </div>
      ${this.label ? `<div class="knob-label">${this.label}</div>` : ''}
    `;

    this.knobBody = this.el.querySelector('.hw-knob');
    this.indicator = this.el.querySelector('.knob-indicator');
  }

  bindEvents() {
    const onMouseDown = (e) => {
      // Shift + Klick -> Spezialaktion (z. B. im Fokus-Dock laden)
      if (e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        if (this.onShiftClick) {
          this.onShiftClick(this, e);
        }
        return;
      }

      this.knobBody.focus();
      this.isDragging = true;
      this.startY = e.clientY;
      this.startVal = this.value;
      document.body.style.cursor = 'ns-resize';
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      e.preventDefault();
    };

    const onMouseMove = (e) => {
      if (!this.isDragging) return;
      const deltaY = this.startY - e.clientY;
      const sensitivity = 0.005;
      const normalized = this.valToNorm(this.startVal);
      const newNorm = Math.max(0, Math.min(1, normalized + deltaY * sensitivity));
      this.setValue(this.normToVal(newNorm), true);
    };

    const onMouseUp = () => {
      this.isDragging = false;
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    this.knobBody.addEventListener('mousedown', onMouseDown);

    // Tastatur-Steuerung: Pfeiltasten hoch/runter/links/rechts drehen den Regler
    this.knobBody.addEventListener('keydown', (e) => {
      const keys = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'PageUp', 'PageDown', 'Home', 'End'];
      if (!keys.includes(e.key)) return;
      e.preventDefault();
      e.stopPropagation();

      let stepRatio = 0.02; // Standard: 2%
      if (e.shiftKey) stepRatio = 0.005; // Fein: 0.5%
      if (e.altKey || e.key === 'PageUp' || e.key === 'PageDown') stepRatio = 0.08; // Grob: 8%

      const norm = this.valToNorm(this.value);
      let nextNorm = norm;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight' || e.key === 'PageUp') {
        nextNorm = Math.min(1, norm + stepRatio);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'PageDown') {
        nextNorm = Math.max(0, norm - stepRatio);
      } else if (e.key === 'Home') {
        nextNorm = 0;
      } else if (e.key === 'End') {
        nextNorm = 1;
      }
      this.setValue(this.normToVal(nextNorm), true);
    });

    // Fokus-Zustand für visuelle Hervorhebung
    this.knobBody.addEventListener('focus', () => {
      this.knobBody.classList.add('is-focused');
      this.onFocus?.(this);
    });

    this.knobBody.addEventListener('blur', () => {
      this.knobBody.classList.remove('is-focused');
      this.onBlur?.(this);
    });

    // Touch support
    this.knobBody.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.startY = e.touches[0].clientY;
        this.startVal = this.value;
      }
    }, { passive: true });

    this.knobBody.addEventListener('touchmove', (e) => {
      if (!this.isDragging || e.touches.length !== 1) return;
      const deltaY = this.startY - e.touches[0].clientY;
      const sensitivity = 0.005;
      const normalized = this.valToNorm(this.startVal);
      const newNorm = Math.max(0, Math.min(1, normalized + deltaY * sensitivity));
      this.setValue(this.normToVal(newNorm), true);
    }, { passive: true });

    this.knobBody.addEventListener('touchend', () => {
      this.isDragging = false;
    });

    // Mausrad-Unterstützung
    this.knobBody.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = -Math.sign(e.deltaY) * 0.03;
      const norm = this.valToNorm(this.value);
      this.setValue(this.normToVal(Math.max(0, Math.min(1, norm + delta))), true);
    }, { passive: false });

    // Doppelklick: Zurücksetzen auf Standardwert
    this.knobBody.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.setValue(this.defaultValue, true);
    });
  }

  step(direction = 1, factor = 1) {
    const stepRatio = 0.02 * factor;
    const norm = this.valToNorm(this.value);
    const nextNorm = Math.max(0, Math.min(1, norm + direction * stepRatio));
    this.setValue(this.normToVal(nextNorm), true);
  }

  focus() {
    this.knobBody?.focus();
  }

  valToNorm(val) {
    if (this.logarithmic) {
      return (Math.log(val) - Math.log(this.min)) / (Math.log(this.max) - Math.log(this.min));
    }
    return (val - this.min) / (this.max - this.min);
  }

  normToVal(norm) {
    if (this.logarithmic) {
      return Math.exp(Math.log(this.min) + norm * (Math.log(this.max) - Math.log(this.min)));
    }
    return this.min + norm * (this.max - this.min);
  }

  setValue(val, triggerChange = false) {
    this.value = Math.max(this.min, Math.min(this.max, val));
    this.updateVisuals();
    if (triggerChange && this.onChange) {
      this.onChange(this.value);
    }
  }

  updateVisuals() {
    const norm = this.valToNorm(this.value);
    const angle = this.minAngle + norm * (this.maxAngle - this.minAngle);
    if (this.indicator) {
      this.indicator.style.transform = `rotate(${angle}deg)`;
    }
    if (this.knobBody) {
      this.knobBody.setAttribute('aria-valuenow', this.value.toFixed(2));
      this.knobBody.title = `${this.label || 'Value'}: ${this.value.toFixed(2)}${this.unit} · Pfeiltasten zum Drehen`;
    }
  }
}
