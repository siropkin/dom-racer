type AudioContextLike = AudioContext;

export class AudioManager {
  private context: AudioContextLike | null;
  private masterGain: GainNode | null;
  private engineGain: GainNode | null;
  private engineFilter: BiquadFilterNode | null;
  private engineOscillatorA: OscillatorNode | null;
  private engineOscillatorB: OscillatorNode | null;
  private engineLfoOscillator: OscillatorNode | null;
  private engineLfoGain: GainNode | null;
  private policeGain: GainNode | null;
  private policeFilter: BiquadFilterNode | null;
  private policeOscillatorA: OscillatorNode | null;
  private policeOscillatorB: OscillatorNode | null;
  private policeLfoOscillator: OscillatorNode | null;
  private policeLfoGain: GainNode | null;
  private enabled: boolean;

  constructor(initiallyEnabled: boolean) {
    this.context = null;
    this.masterGain = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.engineOscillatorA = null;
    this.engineOscillatorB = null;
    this.engineLfoOscillator = null;
    this.engineLfoGain = null;
    this.policeGain = null;
    this.policeFilter = null;
    this.policeOscillatorA = null;
    this.policeOscillatorB = null;
    this.policeLfoOscillator = null;
    this.policeLfoGain = null;
    this.enabled = initiallyEnabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;

    if (!enabled && this.context) {
      const now = this.context.currentTime;
      if (this.engineGain) {
        this.engineGain.gain.cancelScheduledValues(now);
        this.engineGain.gain.setTargetAtTime(0, now, 0.02);
      }
      if (this.policeGain) {
        this.policeGain.gain.cancelScheduledValues(now);
        this.policeGain.gain.setTargetAtTime(0, now, 0.02);
      }
    }
  }

  async resume(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const context = this.ensureContext();
    if (context.state === 'suspended') {
      await context.resume();
    }
  }

  stop(): void {
    if (!this.context) {
      return;
    }

    const now = this.context.currentTime;
    if (this.engineGain) {
      this.engineGain.gain.cancelScheduledValues(now);
      this.engineGain.gain.setTargetAtTime(0, now, 0.02);
    }
    if (this.policeGain) {
      this.policeGain.gain.cancelScheduledValues(now);
      this.policeGain.gain.setTargetAtTime(0, now, 0.02);
    }
  }

  updateEngine(speed: number, moving: boolean): void {
    if (!this.enabled) {
      this.stop();
      return;
    }

    const context = this.ensureContext();
    const now = context.currentTime;
    const engine = this.ensureEngineNodes();
    const normalizedSpeed = Math.max(0, Math.min(1, speed / 360));
    const targetGain = moving ? 0.01 + normalizedSpeed * 0.035 : 0;
    const baseFrequency = 52 + normalizedSpeed * 82;
    const filterFrequency = 160 + normalizedSpeed * 780;

    engine.gain.cancelScheduledValues(now);
    engine.gain.setTargetAtTime(targetGain, now, 0.04);

    if (this.engineOscillatorA && this.engineOscillatorB) {
      this.engineOscillatorA.frequency.cancelScheduledValues(now);
      this.engineOscillatorB.frequency.cancelScheduledValues(now);
      this.engineOscillatorA.frequency.setTargetAtTime(baseFrequency, now, 0.05);
      this.engineOscillatorB.frequency.setTargetAtTime(baseFrequency * 1.98, now, 0.07);
    }

    if (this.engineFilter) {
      this.engineFilter.frequency.cancelScheduledValues(now);
      this.engineFilter.frequency.setTargetAtTime(filterFrequency, now, 0.07);
    }
  }

  updatePoliceSiren(active: boolean, urgency: number): void {
    if (!this.enabled) {
      if (this.policeGain && this.context) {
        const now = this.context.currentTime;
        this.policeGain.gain.cancelScheduledValues(now);
        this.policeGain.gain.setTargetAtTime(0, now, 0.03);
      }
      return;
    }

    const context = this.ensureContext();
    const now = context.currentTime;
    const police = this.ensurePoliceNodes();
    const normalizedUrgency = Math.max(0, Math.min(1, urgency));
    const targetGain = active ? 0.012 + normalizedUrgency * 0.028 : 0;
    const baseFrequency = 620 + normalizedUrgency * 140;
    const filterFrequency = 1100 + normalizedUrgency * 700;
    const wobbleRate = 1.8 + normalizedUrgency * 0.9;

    police.gain.cancelScheduledValues(now);
    police.gain.setTargetAtTime(targetGain, now, 0.04);

    if (this.policeOscillatorA && this.policeOscillatorB) {
      this.policeOscillatorA.frequency.cancelScheduledValues(now);
      this.policeOscillatorB.frequency.cancelScheduledValues(now);
      this.policeOscillatorA.frequency.setTargetAtTime(baseFrequency, now, 0.06);
      this.policeOscillatorB.frequency.setTargetAtTime(baseFrequency * 1.34, now, 0.07);
    }

    if (this.policeFilter) {
      this.policeFilter.frequency.cancelScheduledValues(now);
      this.policeFilter.frequency.setTargetAtTime(filterFrequency, now, 0.05);
    }

    if (this.policeLfoOscillator) {
      this.policeLfoOscillator.frequency.cancelScheduledValues(now);
      this.policeLfoOscillator.frequency.setTargetAtTime(wobbleRate, now, 0.08);
    }
  }

  playPickup(): void {
    if (!this.enabled) {
      return;
    }

    const context = this.ensureContext();
    const now = context.currentTime;
    const pitch = 0.9 + Math.random() * 0.2;
    this.playTone({
      time: now,
      frequency: 880 * pitch,
      duration: 0.06,
      type: 'square',
      volume: 0.042,
    });
    this.playTone({
      time: now + 0.055,
      frequency: 1174 * pitch,
      duration: 0.065,
      type: 'square',
      volume: 0.038,
    });
    this.playTone({
      time: now + 0.11,
      frequency: 1568 * pitch,
      duration: 0.09,
      type: 'triangle',
      volume: 0.05,
    });
  }

  playToggle(enabled: boolean): void {
    const context = this.ensureContext();
    const now = context.currentTime;
    if (enabled) {
      this.playTone({
        time: now,
        frequency: 523,
        duration: 0.07,
        type: 'triangle',
        volume: 0.04,
      });
      this.playTone({
        time: now + 0.055,
        frequency: 784,
        duration: 0.1,
        type: 'triangle',
        volume: 0.045,
      });
      return;
    }

    this.playTone({
      time: now,
      frequency: 660,
      duration: 0.06,
      type: 'triangle',
      volume: 0.04,
    });
    this.playTone({
      time: now + 0.05,
      frequency: 392,
      duration: 0.09,
      type: 'triangle',
      volume: 0.038,
    });
  }

  playPoliceAlert(): void {
    if (!this.enabled) {
      return;
    }

    const context = this.ensureContext();
    const now = context.currentTime;
    this.playTone({
      time: now,
      frequency: 740,
      duration: 0.07,
      type: 'square',
      volume: 0.032,
    });
    this.playTone({
      time: now + 0.09,
      frequency: 560,
      duration: 0.07,
      type: 'square',
      volume: 0.03,
    });
  }

  playPlaneFlyover(): void {
    if (!this.enabled) {
      return;
    }

    const context = this.ensureContext();
    const now = context.currentTime;
    this.playSweepTone({
      time: now,
      startFrequency: 560,
      endFrequency: 280,
      duration: 0.46,
      type: 'sawtooth',
      volume: 0.021,
      startFilterFrequency: 1800,
      endFilterFrequency: 640,
      q: 0.9,
    });
    this.playSweepTone({
      time: now + 0.025,
      startFrequency: 840,
      endFrequency: 430,
      duration: 0.4,
      type: 'triangle',
      volume: 0.016,
      startFilterFrequency: 2100,
      endFilterFrequency: 900,
      q: 0.8,
    });
    this.playTone({
      time: now + 0.2,
      frequency: 1080,
      duration: 0.08,
      type: 'sine',
      volume: 0.009,
    });
  }

  playPlaneDrop(): void {
    if (!this.enabled) {
      return;
    }

    const context = this.ensureContext();
    const now = context.currentTime;
    this.playSweepTone({
      time: now,
      startFrequency: 380,
      endFrequency: 620,
      duration: 0.11,
      type: 'triangle',
      volume: 0.018,
      startFilterFrequency: 980,
      endFilterFrequency: 1500,
      q: 0.7,
    });
    this.playTone({
      time: now + 0.075,
      frequency: 520,
      duration: 0.08,
      type: 'triangle',
      volume: 0.013,
    });
  }

  playNearMissWhoosh(): void {
    if (!this.enabled) {
      return;
    }

    const context = this.ensureContext();
    const now = context.currentTime;
    this.playSweepTone({
      time: now,
      startFrequency: 2200,
      endFrequency: 600,
      duration: 0.05,
      type: 'sine',
      volume: 0.015,
      startFilterFrequency: 3000,
      endFilterFrequency: 800,
      q: 0.5,
    });
  }

  playObjectiveChime(): void {
    if (!this.enabled) {
      return;
    }

    const context = this.ensureContext();
    const now = context.currentTime;
    this.playTone({
      time: now,
      frequency: 800,
      duration: 0.1,
      type: 'sine',
      volume: 0.04,
    });
    this.playTone({
      time: now + 0.08,
      frequency: 1200,
      duration: 0.08,
      type: 'sine',
      volume: 0.03,
    });
  }

  private ensureContext(): AudioContextLike {
    if (this.context) {
      return this.context;
    }

    this.context = new AudioContext();
    return this.context;
  }

  private ensureMasterGain(): GainNode {
    if (this.masterGain) {
      return this.masterGain;
    }

    const context = this.ensureContext();
    const gain = context.createGain();
    gain.gain.value = 0.42;
    gain.connect(context.destination);
    this.masterGain = gain;
    return gain;
  }

  private ensureEngineNodes(): GainNode {
    if (
      this.engineGain &&
      this.engineFilter &&
      this.engineOscillatorA &&
      this.engineOscillatorB &&
      this.engineLfoOscillator &&
      this.engineLfoGain
    ) {
      return this.engineGain;
    }

    const context = this.ensureContext();
    const masterGain = this.ensureMasterGain();
    const engineGain = context.createGain();
    engineGain.gain.value = 0;
    const engineFilter = context.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 260;
    engineFilter.Q.value = 1.1;

    const oscillatorA = context.createOscillator();
    oscillatorA.type = 'triangle';
    oscillatorA.frequency.value = 60;

    const oscillatorB = context.createOscillator();
    oscillatorB.type = 'sawtooth';
    oscillatorB.frequency.value = 118;

    const lfoOscillator = context.createOscillator();
    lfoOscillator.type = 'sine';
    lfoOscillator.frequency.value = 8;
    const lfoGain = context.createGain();
    lfoGain.gain.value = 5;

    lfoOscillator.connect(lfoGain);
    lfoGain.connect(oscillatorA.detune);
    lfoGain.connect(oscillatorB.detune);
    oscillatorA.connect(engineFilter);
    oscillatorB.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(masterGain);

    lfoOscillator.start();
    oscillatorA.start();
    oscillatorB.start();

    this.engineGain = engineGain;
    this.engineFilter = engineFilter;
    this.engineOscillatorA = oscillatorA;
    this.engineOscillatorB = oscillatorB;
    this.engineLfoOscillator = lfoOscillator;
    this.engineLfoGain = lfoGain;
    return engineGain;
  }

  private ensurePoliceNodes(): GainNode {
    if (
      this.policeGain &&
      this.policeFilter &&
      this.policeOscillatorA &&
      this.policeOscillatorB &&
      this.policeLfoOscillator &&
      this.policeLfoGain
    ) {
      return this.policeGain;
    }

    const context = this.ensureContext();
    const masterGain = this.ensureMasterGain();
    const policeGain = context.createGain();
    policeGain.gain.value = 0;
    const policeFilter = context.createBiquadFilter();
    policeFilter.type = 'bandpass';
    policeFilter.frequency.value = 1200;
    policeFilter.Q.value = 2.2;

    const oscillatorA = context.createOscillator();
    oscillatorA.type = 'square';
    oscillatorA.frequency.value = 680;

    const oscillatorB = context.createOscillator();
    oscillatorB.type = 'triangle';
    oscillatorB.frequency.value = 910;

    const lfoOscillator = context.createOscillator();
    lfoOscillator.type = 'sine';
    lfoOscillator.frequency.value = 1.9;
    const lfoGain = context.createGain();
    lfoGain.gain.value = 180;

    lfoOscillator.connect(lfoGain);
    lfoGain.connect(oscillatorA.detune);
    lfoGain.connect(oscillatorB.detune);
    oscillatorA.connect(policeFilter);
    oscillatorB.connect(policeFilter);
    policeFilter.connect(policeGain);
    policeGain.connect(masterGain);

    lfoOscillator.start();
    oscillatorA.start();
    oscillatorB.start();

    this.policeGain = policeGain;
    this.policeFilter = policeFilter;
    this.policeOscillatorA = oscillatorA;
    this.policeOscillatorB = oscillatorB;
    this.policeLfoOscillator = lfoOscillator;
    this.policeLfoGain = lfoGain;
    return policeGain;
  }

  private playTone(options: {
    time: number;
    frequency: number;
    duration: number;
    type: OscillatorType;
    volume: number;
  }): void {
    const context = this.ensureContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();

    oscillator.type = options.type;
    oscillator.frequency.setValueAtTime(options.frequency, options.time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.max(900, options.frequency * 2.2), options.time);

    gain.gain.setValueAtTime(0.0001, options.time);
    gain.gain.exponentialRampToValueAtTime(options.volume, options.time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, options.time + options.duration);

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(this.ensureMasterGain());

    oscillator.start(options.time);
    oscillator.stop(options.time + options.duration + 0.02);
  }

  private playSweepTone(options: {
    time: number;
    startFrequency: number;
    endFrequency: number;
    duration: number;
    type: OscillatorType;
    volume: number;
    startFilterFrequency: number;
    endFilterFrequency: number;
    q: number;
  }): void {
    const context = this.ensureContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    const attackAt = options.time + 0.012;
    const endAt = options.time + options.duration;

    oscillator.type = options.type;
    oscillator.frequency.setValueAtTime(Math.max(1, options.startFrequency), options.time);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, options.endFrequency), endAt);
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(options.q, options.time);
    filter.frequency.setValueAtTime(Math.max(100, options.startFilterFrequency), options.time);
    filter.frequency.exponentialRampToValueAtTime(Math.max(100, options.endFilterFrequency), endAt);

    gain.gain.setValueAtTime(0.0001, options.time);
    gain.gain.exponentialRampToValueAtTime(options.volume, attackAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(this.ensureMasterGain());

    oscillator.start(options.time);
    oscillator.stop(endAt + 0.02);
  }
}
