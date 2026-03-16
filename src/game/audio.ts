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
  private droneGain: GainNode | null;
  private droneFilter: BiquadFilterNode | null;
  private droneOscillatorA: OscillatorNode | null;
  private droneOscillatorB: OscillatorNode | null;
  private droneLfoOscillator: OscillatorNode | null;
  private droneLfoGain: GainNode | null;
  private chopGain: GainNode | null;
  private chopFilter: BiquadFilterNode | null;
  private chopOscillatorA: OscillatorNode | null;
  private chopOscillatorB: OscillatorNode | null;
  private chopLfoOscillator: OscillatorNode | null;
  private chopLfoGain: GainNode | null;
  private chopSirenOscillator: OscillatorNode | null;
  private chopSirenGain: GainNode | null;
  private chopSirenFilter: BiquadFilterNode | null;
  private trainRumbleGain: GainNode | null;
  private trainRumbleFilter: BiquadFilterNode | null;
  private trainRumbleOscillatorA: OscillatorNode | null;
  private trainRumbleOscillatorB: OscillatorNode | null;
  private trainRumbleLfoOscillator: OscillatorNode | null;
  private trainRumbleLfoGain: GainNode | null;
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
    this.droneGain = null;
    this.droneFilter = null;
    this.droneOscillatorA = null;
    this.droneOscillatorB = null;
    this.droneLfoOscillator = null;
    this.droneLfoGain = null;
    this.chopGain = null;
    this.chopFilter = null;
    this.chopOscillatorA = null;
    this.chopOscillatorB = null;
    this.chopLfoOscillator = null;
    this.chopLfoGain = null;
    this.chopSirenOscillator = null;
    this.chopSirenGain = null;
    this.chopSirenFilter = null;
    this.trainRumbleGain = null;
    this.trainRumbleFilter = null;
    this.trainRumbleOscillatorA = null;
    this.trainRumbleOscillatorB = null;
    this.trainRumbleLfoOscillator = null;
    this.trainRumbleLfoGain = null;
    this.enabled = initiallyEnabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;

    if (!enabled) {
      this.fadeOutAllContinuous();
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
    this.fadeOutAllContinuous();
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

  /** Continuous propeller buzz that fades in/out with the airplane's travel progress. */
  updatePropellerDrone(active: boolean, progress: number): void {
    if (!this.enabled) {
      if (this.droneGain && this.context) {
        const now = this.context.currentTime;
        this.droneGain.gain.cancelScheduledValues(now);
        this.droneGain.gain.setTargetAtTime(0, now, 0.03);
      }
      return;
    }

    const context = this.ensureContext();
    const now = context.currentTime;
    const drone = this.ensureDroneNodes();

    const fadeIn = Math.min(1, progress / 0.15);
    const fadeOut = Math.min(1, (1 - progress) / 0.2);
    const envelope = active ? fadeIn * fadeOut : 0;
    const targetGain = envelope * 0.032;

    drone.gain.cancelScheduledValues(now);
    drone.gain.setTargetAtTime(targetGain, now, 0.06);

    const baseFrequency = 78 + progress * 18;
    const filterFrequency = 320 + envelope * 460;

    if (this.droneOscillatorA && this.droneOscillatorB) {
      this.droneOscillatorA.frequency.cancelScheduledValues(now);
      this.droneOscillatorB.frequency.cancelScheduledValues(now);
      this.droneOscillatorA.frequency.setTargetAtTime(baseFrequency, now, 0.08);
      this.droneOscillatorB.frequency.setTargetAtTime(baseFrequency * 2.01, now, 0.08);
    }

    if (this.droneFilter) {
      this.droneFilter.frequency.cancelScheduledValues(now);
      this.droneFilter.frequency.setTargetAtTime(filterFrequency, now, 0.07);
    }
  }

  /**
   * Continuous rotor chop for helicopter chases.
   * Distinct from plane drone: square-wave oscillators at ~120-140Hz with faster
   * LFO at ~22-28Hz for a "thwap-thwap-thwap" chopper sound.
   */
  updateHelicopterChop(active: boolean, urgency: number): void {
    if (!this.enabled) {
      if (this.context) {
        const now = this.context.currentTime;
        if (this.chopGain) {
          this.chopGain.gain.cancelScheduledValues(now);
          this.chopGain.gain.setTargetAtTime(0, now, 0.03);
        }
        if (this.chopSirenGain) {
          this.chopSirenGain.gain.cancelScheduledValues(now);
          this.chopSirenGain.gain.setTargetAtTime(0, now, 0.03);
        }
      }
      return;
    }

    const context = this.ensureContext();
    const now = context.currentTime;
    const chop = this.ensureChopNodes();
    const normalizedUrgency = Math.max(0, Math.min(1, urgency));
    const targetGain = active ? 0.014 + normalizedUrgency * 0.022 : 0;
    const baseFrequency = 120 + normalizedUrgency * 20;
    const filterFrequency = 400 + normalizedUrgency * 200;
    const chopRate = 22 + normalizedUrgency * 6;

    chop.gain.cancelScheduledValues(now);
    chop.gain.setTargetAtTime(targetGain, now, 0.05);

    if (this.chopOscillatorA && this.chopOscillatorB) {
      this.chopOscillatorA.frequency.cancelScheduledValues(now);
      this.chopOscillatorB.frequency.cancelScheduledValues(now);
      this.chopOscillatorA.frequency.setTargetAtTime(baseFrequency, now, 0.07);
      this.chopOscillatorB.frequency.setTargetAtTime(baseFrequency * 1.52, now, 0.07);
    }

    if (this.chopFilter) {
      this.chopFilter.frequency.cancelScheduledValues(now);
      this.chopFilter.frequency.setTargetAtTime(filterFrequency, now, 0.06);
    }

    if (this.chopLfoOscillator) {
      this.chopLfoOscillator.frequency.cancelScheduledValues(now);
      this.chopLfoOscillator.frequency.setTargetAtTime(chopRate, now, 0.08);
    }

    // Layer police siren behind rotor chop
    if (this.chopSirenGain) {
      const sirenGain = active ? 0.006 + normalizedUrgency * 0.01 : 0;
      this.chopSirenGain.gain.cancelScheduledValues(now);
      this.chopSirenGain.gain.setTargetAtTime(sirenGain, now, 0.08);
    }
    if (this.chopSirenFilter) {
      const sirenFilterFreq = 600 + normalizedUrgency * 250;
      this.chopSirenFilter.frequency.cancelScheduledValues(now);
      this.chopSirenFilter.frequency.setTargetAtTime(sirenFilterFreq, now, 0.06);
    }
  }

  /** One-shot train horn blast for the warning phase. */
  playTrainHorn(): void {
    if (!this.enabled) {
      return;
    }

    const context = this.ensureContext();
    const now = context.currentTime;
    this.playSweepTone({
      time: now,
      startFrequency: 220,
      endFrequency: 185,
      duration: 0.6,
      type: 'sawtooth',
      volume: 0.039,
      startFilterFrequency: 700,
      endFilterFrequency: 420,
      q: 1.2,
    });
    this.playSweepTone({
      time: now + 0.01,
      startFrequency: 330,
      endFrequency: 278,
      duration: 0.55,
      type: 'triangle',
      volume: 0.025,
      startFilterFrequency: 900,
      endFilterFrequency: 500,
      q: 0.9,
    });
    this.playTone({
      time: now + 0.2,
      frequency: 165,
      duration: 0.35,
      type: 'square',
      volume: 0.017,
    });
  }

  /**
   * Continuous rumble/clatter while the train is crossing.
   * Low-frequency sawtooth oscillators with fast LFO for a rhythmic clickety-clack.
   */
  updateTrainRumble(active: boolean, progress: number): void {
    if (!this.enabled) {
      if (this.trainRumbleGain && this.context) {
        const now = this.context.currentTime;
        this.trainRumbleGain.gain.cancelScheduledValues(now);
        this.trainRumbleGain.gain.setTargetAtTime(0, now, 0.03);
      }
      return;
    }

    const context = this.ensureContext();
    const now = context.currentTime;
    const rumble = this.ensureTrainRumbleNodes();

    const fadeIn = Math.min(1, progress / 0.1);
    const fadeOut = Math.min(1, (1 - progress) / 0.15);
    const envelope = active ? fadeIn * fadeOut : 0;
    const targetGain = envelope * 0.034;

    rumble.gain.cancelScheduledValues(now);
    rumble.gain.setTargetAtTime(targetGain, now, 0.05);

    const baseFrequency = 48 + progress * 14;
    const filterFrequency = 220 + envelope * 340;
    const clatterRate = 18 + progress * 10;

    if (this.trainRumbleOscillatorA && this.trainRumbleOscillatorB) {
      this.trainRumbleOscillatorA.frequency.cancelScheduledValues(now);
      this.trainRumbleOscillatorB.frequency.cancelScheduledValues(now);
      this.trainRumbleOscillatorA.frequency.setTargetAtTime(baseFrequency, now, 0.07);
      this.trainRumbleOscillatorB.frequency.setTargetAtTime(baseFrequency * 1.49, now, 0.07);
    }

    if (this.trainRumbleFilter) {
      this.trainRumbleFilter.frequency.cancelScheduledValues(now);
      this.trainRumbleFilter.frequency.setTargetAtTime(filterFrequency, now, 0.06);
    }

    if (this.trainRumbleLfoOscillator) {
      this.trainRumbleLfoOscillator.frequency.cancelScheduledValues(now);
      this.trainRumbleLfoOscillator.frequency.setTargetAtTime(clatterRate, now, 0.08);
    }
  }

  playPlaneDrop(): void {
    if (!this.enabled) {
      return;
    }

    const context = this.ensureContext();
    const now = context.currentTime;
    this.playSweepTone({
      time: now,
      startFrequency: 340,
      endFrequency: 720,
      duration: 0.14,
      type: 'sawtooth',
      volume: 0.032,
      startFilterFrequency: 900,
      endFilterFrequency: 2200,
      q: 0.8,
    });
    this.playTone({
      time: now + 0.06,
      frequency: 580,
      duration: 0.1,
      type: 'triangle',
      volume: 0.028,
    });
    this.playTone({
      time: now + 0.12,
      frequency: 920,
      duration: 0.07,
      type: 'sine',
      volume: 0.018,
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

  private fadeOutAllContinuous(): void {
    if (!this.context) {
      return;
    }

    const now = this.context.currentTime;
    for (const gain of [
      this.engineGain,
      this.policeGain,
      this.droneGain,
      this.chopGain,
      this.trainRumbleGain,
    ]) {
      if (gain) {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setTargetAtTime(0, now, 0.02);
      }
    }
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
    gain.gain.value = 0.68;
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

  private ensureDroneNodes(): GainNode {
    if (
      this.droneGain &&
      this.droneFilter &&
      this.droneOscillatorA &&
      this.droneOscillatorB &&
      this.droneLfoOscillator &&
      this.droneLfoGain
    ) {
      return this.droneGain;
    }

    const context = this.ensureContext();
    const masterGain = this.ensureMasterGain();
    const droneGain = context.createGain();
    droneGain.gain.value = 0;
    const droneFilter = context.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 320;
    droneFilter.Q.value = 1.4;

    const oscillatorA = context.createOscillator();
    oscillatorA.type = 'sawtooth';
    oscillatorA.frequency.value = 78;

    const oscillatorB = context.createOscillator();
    oscillatorB.type = 'triangle';
    oscillatorB.frequency.value = 157;

    const lfoOscillator = context.createOscillator();
    lfoOscillator.type = 'sine';
    lfoOscillator.frequency.value = 14;
    const lfoGain = context.createGain();
    lfoGain.gain.value = 6;

    lfoOscillator.connect(lfoGain);
    lfoGain.connect(oscillatorA.detune);
    lfoGain.connect(oscillatorB.detune);
    oscillatorA.connect(droneFilter);
    oscillatorB.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(masterGain);

    lfoOscillator.start();
    oscillatorA.start();
    oscillatorB.start();

    this.droneGain = droneGain;
    this.droneFilter = droneFilter;
    this.droneOscillatorA = oscillatorA;
    this.droneOscillatorB = oscillatorB;
    this.droneLfoOscillator = lfoOscillator;
    this.droneLfoGain = lfoGain;
    return droneGain;
  }

  private ensureChopNodes(): GainNode {
    if (
      this.chopGain &&
      this.chopFilter &&
      this.chopOscillatorA &&
      this.chopOscillatorB &&
      this.chopLfoOscillator &&
      this.chopLfoGain &&
      this.chopSirenOscillator
    ) {
      return this.chopGain;
    }

    const context = this.ensureContext();
    const masterGain = this.ensureMasterGain();
    const chopGain = context.createGain();
    chopGain.gain.value = 0;
    const chopFilter = context.createBiquadFilter();
    chopFilter.type = 'bandpass';
    chopFilter.frequency.value = 500;
    chopFilter.Q.value = 1.8;

    const oscillatorA = context.createOscillator();
    oscillatorA.type = 'square';
    oscillatorA.frequency.value = 130;

    const oscillatorB = context.createOscillator();
    oscillatorB.type = 'square';
    oscillatorB.frequency.value = 198;

    const lfoOscillator = context.createOscillator();
    lfoOscillator.type = 'sine';
    lfoOscillator.frequency.value = 24;
    const lfoGain = context.createGain();
    lfoGain.gain.value = 28;

    lfoOscillator.connect(lfoGain);
    lfoGain.connect(oscillatorA.detune);
    lfoGain.connect(oscillatorB.detune);
    oscillatorA.connect(chopFilter);
    oscillatorB.connect(chopFilter);
    chopFilter.connect(chopGain);
    chopGain.connect(masterGain);

    // Siren layer: filtered sine oscillator for police helicopter feel
    const sirenOscillator = context.createOscillator();
    sirenOscillator.type = 'sine';
    sirenOscillator.frequency.value = 660;
    const sirenFilter = context.createBiquadFilter();
    sirenFilter.type = 'bandpass';
    sirenFilter.frequency.value = 700;
    sirenFilter.Q.value = 4;
    const sirenGain = context.createGain();
    sirenGain.gain.value = 0;

    // Siren wail LFO (slow ~1.6Hz sweep)
    const sirenLfo = context.createOscillator();
    sirenLfo.type = 'sine';
    sirenLfo.frequency.value = 1.6;
    const sirenLfoGain = context.createGain();
    sirenLfoGain.gain.value = 120;
    sirenLfo.connect(sirenLfoGain);
    sirenLfoGain.connect(sirenOscillator.frequency);

    sirenOscillator.connect(sirenFilter);
    sirenFilter.connect(sirenGain);
    sirenGain.connect(masterGain);

    lfoOscillator.start();
    oscillatorA.start();
    oscillatorB.start();
    sirenOscillator.start();
    sirenLfo.start();

    this.chopGain = chopGain;
    this.chopFilter = chopFilter;
    this.chopOscillatorA = oscillatorA;
    this.chopOscillatorB = oscillatorB;
    this.chopLfoOscillator = lfoOscillator;
    this.chopLfoGain = lfoGain;
    this.chopSirenOscillator = sirenOscillator;
    this.chopSirenGain = sirenGain;
    this.chopSirenFilter = sirenFilter;
    return chopGain;
  }

  private ensureTrainRumbleNodes(): GainNode {
    if (
      this.trainRumbleGain &&
      this.trainRumbleFilter &&
      this.trainRumbleOscillatorA &&
      this.trainRumbleOscillatorB &&
      this.trainRumbleLfoOscillator &&
      this.trainRumbleLfoGain
    ) {
      return this.trainRumbleGain;
    }

    const context = this.ensureContext();
    const masterGain = this.ensureMasterGain();
    const rumbleGain = context.createGain();
    rumbleGain.gain.value = 0;
    const rumbleFilter = context.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.value = 200;
    rumbleFilter.Q.value = 1.6;

    const oscillatorA = context.createOscillator();
    oscillatorA.type = 'sawtooth';
    oscillatorA.frequency.value = 52;

    const oscillatorB = context.createOscillator();
    oscillatorB.type = 'triangle';
    oscillatorB.frequency.value = 78;

    const lfoOscillator = context.createOscillator();
    lfoOscillator.type = 'square';
    lfoOscillator.frequency.value = 18;
    const lfoGain = context.createGain();
    lfoGain.gain.value = 12;

    lfoOscillator.connect(lfoGain);
    lfoGain.connect(oscillatorA.detune);
    lfoGain.connect(oscillatorB.detune);
    oscillatorA.connect(rumbleFilter);
    oscillatorB.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(masterGain);

    lfoOscillator.start();
    oscillatorA.start();
    oscillatorB.start();

    this.trainRumbleGain = rumbleGain;
    this.trainRumbleFilter = rumbleFilter;
    this.trainRumbleOscillatorA = oscillatorA;
    this.trainRumbleOscillatorB = oscillatorB;
    this.trainRumbleLfoOscillator = lfoOscillator;
    this.trainRumbleLfoGain = lfoGain;
    return rumbleGain;
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
