// Realistic Hardware Rotary Knob Component

export class Knob {
  constructor(element, options = {}) {
    this.el = element;
    this.min = options.min ?? 0;
    this.max = options.max ?? 1;
    this.value = options.value ?? (this.min + this.max) / 2;
    this.step = options.step ?? 0.01;
    this.onChange = options.onChange || null;
    this.unit = options.unit || '';
    this.label = options.label || '';
    this.logarithmic = options.logarithmic || false;

    // Visual angle range: -140 deg to +140 deg (280 deg sweep)
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

    // Wheel support
    this.knobBody.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = -Math.sign(e.deltaY) * 0.04;
      const norm = this.valToNorm(this.value);
      this.setValue(this.normToVal(Math.max(0, Math.min(1, norm + delta))), true);
    }, { passive: false });
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
      this.knobBody.title = `${this.label || 'Value'}: ${this.value.toFixed(2)}${this.unit}`;
    }
  }
}
