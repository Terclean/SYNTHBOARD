// 5-Step Analog Voltage Sequencer & Clock Pulser (Solar 42F)

export class StepSequencer {
  constructor(ctx, onStepCallback) {
    this.ctx = ctx;
    this.onStep = onStepCallback;

    this.steps = [0.2, 0.5, 0.8, 0.4, 0.9];
    this.currentStep = 0;
    this.isPlaying = true;
    this.rateHz = 2.0; // steps per second
    this.timerId = null;

    this.start();
  }

  setStepValue(index, val) {
    if (index >= 0 && index < this.steps.length) {
      this.steps[index] = Math.max(0, Math.min(1, val));
    }
  }

  setRate(hz) {
    this.rateHz = Math.max(0.2, Math.min(20, hz));
    if (this.isPlaying) {
      this.stop();
      this.start();
    }
  }

  start() {
    this.isPlaying = true;
    this.scheduleNext();
  }

  stop() {
    this.isPlaying = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  toggle() {
    if (this.isPlaying) {
      this.stop();
    } else {
      this.start();
    }
    return this.isPlaying;
  }

  scheduleNext() {
    if (!this.isPlaying) return;
    const intervalMs = (1 / this.rateHz) * 1000;
    this.timerId = setTimeout(() => {
      this.currentStep = (this.currentStep + 1) % this.steps.length;
      const stepVal = this.steps[this.currentStep];
      if (this.onStep) {
        this.onStep(this.currentStep, stepVal);
      }
      this.scheduleNext();
    }, intervalMs);
  }
}
