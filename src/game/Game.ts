import type {
  HudState,
  InputState,
  Rect,
  SpecialEffect,
  Vector2,
  VehicleDesign,
  World,
  WorldPickup,
} from '../shared/types';
import { AudioManager } from './audio';
import { drawHud } from './hud';
import { collidesWithAny } from './collisions';
import { collectPickups, isBoosting, isOnDeadSpot, isOnIceZone, isOnSlowZone } from './pickups';
import { renderPlaneSprite } from './planeSprite';
import {
  POLICE_CAR_SIZE,
  renderEdgeWarningIndicator,
  renderPoliceCarSprite,
  renderPoliceWarningIndicator,
  type PoliceEdge,
} from './policeSprite';
import { renderPlayerSprite } from './playerSprite';
import { drawRegularCoinSprite, drawSpecialPickupSprite } from './pickupSprites';
import { Player } from './player';
import { ToastSystem, type ToastPriority } from './toastSystem';
import { clamp, rectCenter, rectsIntersect } from '../shared/utils';

export type ScrollDirection = 'up' | 'down';

interface SurfaceSample {
  lightness: number;
  saturation: number;
  hasGradient: boolean;
}

interface SpecialSpawnCue {
  x: number;
  y: number;
  label: string;
  color: string;
  ttlMs: number;
  durationMs: number;
}

interface PlaneBonusEventState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  ttlMs: number;
  distancePx: number;
  traveledPx: number;
  dropAtPx: number;
  dropped: boolean;
}

interface PoliceChaseState {
  x: number;
  y: number;
  angle: number;
  remainingMs: number;
  durationMs: number;
  phase: 'chasing' | 'leaving';
  exitEdge: PoliceEdge;
}

type PlaneCorner = 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left';

interface PoliceWarningState {
  edge: PoliceEdge;
  remainingMs: number;
  durationMs: number;
}

interface PlaneWarningState {
  edge: PoliceEdge;
  remainingMs: number;
  durationMs: number;
}

interface ShowcaseTheme {
  name: string;
  background: string;
  grid: string;
  title: string;
  subtitle: string;
  toastPanel: string;
  toastCard: string;
  toastStroke: string;
  toastText: string;
}

interface GameOverState {
  reason: 'caught';
  startedAtMs: number;
}

export type GameDebugEvent =
  | {
      type: 'pickup';
      atMs: number;
      score: number;
      pickupId: string;
      x: number;
      y: number;
      value: number;
    }
  | {
      type: 'restart';
      atMs: number;
      reason: 'manual' | 'deadSpot' | 'caught';
      score: number;
    }
  | {
      type: 'collision';
      atMs: number;
      x: number;
      y: number;
      hitX: boolean;
      hitY: boolean;
      speed: number;
      scrollY: number;
    }
  | {
      type: 'scroll';
      atMs: number;
      direction: ScrollDirection;
      amount: number;
      scrollY: number;
    };

export interface GameDebugSnapshot {
  atMs: number;
  score: number;
  scrollY: number;
  player: Rect;
  pickupsRemaining: number;
  pickups: Array<{
    id: string;
    x: number;
    y: number;
    value: number;
  }>;
  obstacleCount: number;
  boostCount: number;
  airborne: boolean;
  boostActive: boolean;
  speed: number;
  hitX: boolean;
  hitY: boolean;
}

interface GameOptions {
  canvas: HTMLCanvasElement;
  createWorld: () => World;
  getPageTitle: () => string;
  sampleSurfaceAt: (point: Vector2) => SurfaceSample;
  setPageInverted: (active: boolean) => void;
  setPageBlackout: (active: boolean) => void;
  setMagnetUiState: (state: { active: boolean; point: Vector2 | null; strength: number }) => void;
  onQuit: () => void;
  initialSoundEnabled: boolean;
  onSoundEnabledChange: (enabled: boolean) => void;
  initialVehicleDesign: VehicleDesign;
  onVehicleDesignChange: (design: VehicleDesign) => void;
  initialPageBestScore: number;
  initialLifetimeBestScore: number;
  onRunFinished?: (run: {
    score: number;
    elapsedMs: number;
    reason: 'manual' | 'deadSpot' | 'caught' | 'quit';
  }) => void;
  onDebugEvent?: (event: GameDebugEvent) => void;
}

export class Game {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private createWorld: () => World;
  private getPageTitle: () => string;
  private sampleSurfaceAt: (point: Vector2) => SurfaceSample;
  private setPageInverted: (active: boolean) => void;
  private setPageBlackout: (active: boolean) => void;
  private setMagnetUiState: (state: { active: boolean; point: Vector2 | null; strength: number }) => void;
  private onQuit: () => void;
  private onSoundEnabledChange: (enabled: boolean) => void;
  private onVehicleDesignChange: (design: VehicleDesign) => void;
  private onRunFinished?: (run: {
    score: number;
    elapsedMs: number;
    reason: 'manual' | 'deadSpot' | 'caught' | 'quit';
  }) => void;
  private onDebugEvent?: (event: GameDebugEvent) => void;
  private audio: AudioManager;
  private soundEnabled: boolean;
  private vehicleDesign: VehicleDesign;
  private player: Player | null;
  private world: World | null;
  private input: InputState;
  private debugInput: Partial<InputState> | null;
  private running: boolean;
  private frameHandle: number | null;
  private lastFrameMs: number;
  private startTimeMs: number;
  private score: number;
  private pageBestScore: number;
  private lifetimeBestScore: number;
  private dynamicPickups: WorldPickup[];
  private coinSpawnQueue: WorldPickup[];
  private coinSpawnIdCounter: number;
  private coinRefillTimerMs: number;
  private coinRefillBoostTimerMs: number;
  private toastSystem: ToastSystem;
  private specialSpawnCues: SpecialSpawnCue[];
  private planeBonusEvent: PlaneBonusEventState | null;
  private planeBonusTimerMs: number;
  private pickupFlavorIndex: number;
  private lastCollisionEventAtMs: number;
  private coinsCollectedTotal: number;
  private specialSpawnTimerMs: number;
  private magnetTimerMs: number;
  private ghostTimerMs: number;
  private invertTimerMs: number;
  private blackoutTimerMs: number;
  private invertActive: boolean;
  private blackoutActive: boolean;
  private policeChase: PoliceChaseState | null;
  private policeWarning: PoliceWarningState | null;
  private planeWarning: PlaneWarningState | null;
  private policeSpawnTimerMs: number;
  private pickupComboCount: number;
  private comboTimerMs: number;
  private gameOverState: GameOverState | null;
  private focusModeAlpha: number;
  private spriteShowcaseActive: boolean;
  private spriteShowcaseThemeIndex: number;
  private spriteShowcasePageLightness: number;

  constructor(options: GameOptions) {
    const context = options.canvas.getContext('2d');
    if (!context) {
      throw new Error('DOM Racer could not create a 2D canvas context.');
    }

    this.canvas = options.canvas;
    this.context = context;
    this.createWorld = options.createWorld;
    this.getPageTitle = options.getPageTitle;
    this.sampleSurfaceAt = options.sampleSurfaceAt;
    this.setPageInverted = options.setPageInverted;
    this.setPageBlackout = options.setPageBlackout;
    this.setMagnetUiState = options.setMagnetUiState;
    this.onQuit = options.onQuit;
    this.onSoundEnabledChange = options.onSoundEnabledChange;
    this.onVehicleDesignChange = options.onVehicleDesignChange;
    this.onRunFinished = options.onRunFinished;
    this.onDebugEvent = options.onDebugEvent;
    this.soundEnabled = options.initialSoundEnabled;
    this.vehicleDesign = options.initialVehicleDesign;
    this.pageBestScore = options.initialPageBestScore;
    this.lifetimeBestScore = options.initialLifetimeBestScore;
    this.audio = new AudioManager(this.soundEnabled);
    this.player = null;
    this.world = null;
    this.input = {
      up: false,
      down: false,
      left: false,
      right: false,
    };
    this.debugInput = null;
    this.running = false;
    this.frameHandle = null;
    this.lastFrameMs = 0;
    this.startTimeMs = 0;
    this.score = 0;
    this.dynamicPickups = [];
    this.coinSpawnQueue = [];
    this.coinSpawnIdCounter = 0;
    this.coinRefillTimerMs = 0;
    this.coinRefillBoostTimerMs = 0;
    this.toastSystem = new ToastSystem({
      maxChars: TOAST_MAX_CHARS,
      maxVisible: TOAST_MAX_VISIBLE,
      duplicateWindowMs: TOAST_DUPLICATE_WINDOW_MS,
    });
    this.specialSpawnCues = [];
    this.planeBonusEvent = null;
    this.planeBonusTimerMs = randomBetween(PLANE_EVENT_INITIAL_MIN_MS, PLANE_EVENT_INITIAL_MAX_MS);
    this.pickupFlavorIndex = 0;
    this.lastCollisionEventAtMs = 0;
    this.coinsCollectedTotal = 0;
    this.specialSpawnTimerMs = randomBetween(SPECIAL_INITIAL_SPAWN_MIN_MS, SPECIAL_INITIAL_SPAWN_MAX_MS);
    this.magnetTimerMs = 0;
    this.ghostTimerMs = 0;
    this.invertTimerMs = 0;
    this.blackoutTimerMs = 0;
    this.invertActive = false;
    this.blackoutActive = false;
    this.policeChase = null;
    this.policeWarning = null;
    this.planeWarning = null;
    this.policeSpawnTimerMs = randomBetween(POLICE_INITIAL_SPAWN_MIN_MS, POLICE_INITIAL_SPAWN_MAX_MS);
    this.pickupComboCount = 0;
    this.comboTimerMs = 0;
    this.gameOverState = null;
    this.focusModeAlpha = 0.75;
    this.spriteShowcaseActive = false;
    this.spriteShowcaseThemeIndex = 0;
    this.spriteShowcasePageLightness = 0.5;
  }

  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.restart();
    this.resize();
    this.canvas.focus({ preventScroll: true });
    window.addEventListener('keydown', this.handleKeyDown, true);
    window.addEventListener('keyup', this.handleKeyUp, true);
    this.frameHandle = window.requestAnimationFrame(this.tick);
  }

  stop(): void {
    if (!this.running) {
      return;
    }

    this.finishCurrentRun('quit');
    this.running = false;
    window.removeEventListener('keydown', this.handleKeyDown, true);
    window.removeEventListener('keyup', this.handleKeyUp, true);

    if (this.frameHandle !== null) {
      window.cancelAnimationFrame(this.frameHandle);
      this.frameHandle = null;
    }

    this.audio.stop();
    this.setInverted(false);
    this.setBlackout(false);
    this.setMagnetUiState({ active: false, point: null, strength: 0 });
    this.policeChase = null;
    this.policeWarning = null;
    this.planeWarning = null;
    this.pickupComboCount = 0;
    this.comboTimerMs = 0;
    this.gameOverState = null;
    this.specialSpawnCues = [];
    this.planeBonusEvent = null;
    this.spriteShowcaseActive = false;
    this.toastSystem.clear();
    this.resetInput();
  }

  restart(): void {
    this.restartWithReason('manual');
  }

  setDebugInput(input: Partial<InputState> | null): void {
    this.debugInput = input;
  }

  triggerJump(): void {
    // Kept for debug API compatibility; manual accel is disabled.
  }

  setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    this.audio.setEnabled(enabled);
  }

  setVehicleDesign(design: VehicleDesign): void {
    this.vehicleDesign = design;
    this.player?.setVehicleDesign(design);
  }

  getDebugSnapshot(): GameDebugSnapshot | null {
    if (!this.world || !this.player) {
      return null;
    }

    const diagnostics = this.player.getLastStepDiagnostics();
    return {
      atMs: performance.now(),
      score: this.score,
      scrollY: window.scrollY,
      player: this.player.getBounds(),
      pickupsRemaining: this.world.pickups.length,
      pickups: this.world.pickups.map((pickup) => ({
        id: pickup.id,
        x: pickup.rect.x + pickup.rect.width / 2,
        y: pickup.rect.y + pickup.rect.height / 2,
        value: pickup.value,
      })),
      obstacleCount: this.world.obstacles.length,
      boostCount: this.world.boosts.length,
      airborne: this.player.isAirborne(),
      boostActive: this.player.isBoostActive(),
      speed: diagnostics.speed,
      hitX: diagnostics.hitX,
      hitY: diagnostics.hitY,
    };
  }

  private restartWithReason(reason: 'manual' | 'deadSpot' | 'caught'): void {
    this.finishCurrentRun(reason);
    this.beginRun(reason);
  }

  private finishCurrentRun(reason: 'manual' | 'deadSpot' | 'caught' | 'quit'): void {
    if (!this.world || this.startTimeMs === 0) {
      return;
    }

    const elapsedMs = Math.max(0, performance.now() - this.startTimeMs);
    if (this.score <= 0 && elapsedMs < 250) {
      return;
    }

    this.onRunFinished?.({
      score: this.score,
      elapsedMs,
      reason,
    });
  }

  applyWorld(nextWorld: World, resetPlayerPosition = false): void {
    const world = cloneWorld(nextWorld);
    const anchorCoins = world.pickups.filter((pickup) => !isSpecialPickup(pickup)).map(clonePickup);
    this.coinSpawnQueue = shufflePickups(anchorCoins);
    world.pickups = this.dynamicPickups.map(clonePickup);
    this.world = world;

    if (!this.player || resetPlayerPosition) {
      this.player = new Player(world.spawnPoint, this.vehicleDesign);
    } else {
      const currentBounds = this.player.getBounds();
      const blocked = !this.player.isAirborne() && collidesWithAny(currentBounds, world.obstacles);
      const unsafe = !this.player.isAirborne() && collidesWithAny(currentBounds, world.deadSpots);
      if (blocked || unsafe) {
        this.player.reset(world.spawnPoint);
      }
    }

    this.spawnQueuedCoins(REGULAR_COIN_STARTING_BATCH);
    const visibleRegularCoins = this.world.pickups.filter((pickup) => !isSpecialPickup(pickup)).length;
    this.coinRefillTimerMs = this.getCoinRefillDelayMs(visibleRegularCoins);
    this.coinRefillBoostTimerMs = 0;
  }

  resize(): void {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.context.imageSmoothingEnabled = false;
  }

  private tick = (timestampMs: number): void => {
    if (!this.running || !this.world || !this.player) {
      return;
    }

    if (this.lastFrameMs === 0) {
      this.lastFrameMs = timestampMs;
    }

    const dtSeconds = Math.min(0.033, (timestampMs - this.lastFrameMs) / 1000);
    this.lastFrameMs = timestampMs;

    if (this.gameOverState) {
      this.render();
      this.frameHandle = window.requestAnimationFrame(this.tick);
      return;
    }

    if (this.spriteShowcaseActive) {
      this.render();
      this.frameHandle = window.requestAnimationFrame(this.tick);
      return;
    }

    this.updateEffectTimers(dtSeconds);
    this.updateFocusMode(dtSeconds);
    this.updatePlaneWarning(dtSeconds);

    const currentBounds = this.player.getBounds();
    const boosting = isBoosting(currentBounds, this.world.boosts);
    const onIce = isOnIceZone(currentBounds, this.world.iceZones);
    const slowed = this.ghostTimerMs <= 0 && !onIce && isOnSlowZone(currentBounds, this.world.slowZones);

    const activeInput = this.getActiveInput();
    this.player.update({
      input: activeInput,
      dtSeconds,
      viewport: this.world.viewport,
      obstacles: this.world.obstacles,
      boosting,
      slowed,
      onIce,
    });
    this.emitCollisionEventIfNeeded();
    void this.audio.updateEngine(
      this.player.getLastStepDiagnostics().speed,
      activeInput.up || activeInput.down || activeInput.left || activeInput.right,
    );
    const policeStep = this.updatePoliceChase(dtSeconds);
    void this.audio.updatePoliceSiren(policeStep.active, policeStep.urgency);
    if (policeStep.caught) {
      this.render();
      this.frameHandle = window.requestAnimationFrame(this.tick);
      return;
    }

    const playerBounds = this.player.getBounds();
    if (!this.player.isAirborne() && isOnDeadSpot(playerBounds, this.world.deadSpots)) {
      this.restartWithReason('deadSpot');
      this.render();
      this.frameHandle = window.requestAnimationFrame(this.tick);
      return;
    }

    const pickupResult = collectPickups(playerBounds, this.world.pickups);
    this.world.pickups = pickupResult.remainingPickups;
    this.score += pickupResult.scoreGained;
    const collectedSpecialIds = pickupResult.collectedPickups
      .filter((pickup) => isSpecialPickup(pickup))
      .map((pickup) => pickup.id);
    if (collectedSpecialIds.length > 0) {
      const collectedIdSet = new Set(collectedSpecialIds);
      this.dynamicPickups = this.dynamicPickups.filter((pickup) => !collectedIdSet.has(pickup.id));
    }
    for (const pickup of pickupResult.collectedPickups) {
      this.audio.playPickup();
      if (isSpecialPickup(pickup) && pickup.effect) {
        this.activateSpecialEffect(pickup.effect);
      } else {
        this.spawnPickupMessage(pickup);
        this.coinsCollectedTotal += 1;
        this.score += this.applyPickupComboBonus();
        this.coinRefillBoostTimerMs = REGULAR_COIN_REFILL_BOOST_MS;
      }
      this.pageBestScore = Math.max(this.pageBestScore, this.score);
      this.lifetimeBestScore = Math.max(this.lifetimeBestScore, this.score);
      this.emitDebugEvent({
        type: 'pickup',
        atMs: performance.now(),
        score: this.score,
        pickupId: pickup.id,
        x: pickup.rect.x + pickup.rect.width / 2,
        y: pickup.rect.y + pickup.rect.height / 2,
        value: pickup.value,
      });
    }

    this.updateRegularCoinSpawns(dtSeconds);
    this.updateAmbientSpecialSpawns(dtSeconds);
    this.updatePlaneBonusEvent(dtSeconds);
    this.applyMagnet(dtSeconds);
    this.updateUiEffects();

    this.toastSystem.update(dtSeconds);
    this.updateSpecialSpawnCues(dtSeconds);

    this.render();
    this.frameHandle = window.requestAnimationFrame(this.tick);
  };

  private render(): void {
    if (!this.world || !this.player) {
      return;
    }

    const ctx = this.context;
    const { width, height } = this.world.viewport;
    ctx.clearRect(0, 0, width, height);

    if (this.gameOverState) {
      this.drawGameOverScreen();
      return;
    }

    if (this.spriteShowcaseActive) {
      this.drawSpriteShowcase();
      return;
    }

    ctx.save();
    this.drawFocusModeLayer();
    this.drawPlaneBonusEvent();
    this.drawSpecialSpawnCues();
    this.drawPickups();
    this.player.draw(ctx, {
      opacity: this.ghostTimerMs > 0 ? 0.46 : 1,
      magnetActive: this.magnetTimerMs > 0,
    });
    this.drawPoliceCar();
    this.drawPlaneWarning();
    this.drawPoliceWarning();
    this.toastSystem.draw(this.context);
    ctx.restore();

    const currentSurface = this.sampleCurrentSurface();
    const blackoutActsAsInvert =
      this.blackoutTimerMs > 0 && adaptBlackoutEffectForSurface('blackout', currentSurface) === 'invert';

    const hudState: HudState = {
      score: this.score,
      elapsedMs: performance.now() - this.startTimeMs,
      pageTitle: this.getPageTitle(),
      pickupsRemaining: this.world.pickups.length,
      scannedCount: this.world.scannedCount,
      airborne: this.player.isAirborne(),
      boostActive: this.player.isBoostActive(),
      soundEnabled: this.soundEnabled,
      flavorText: getFlavorText({
        score: this.score,
        airborne: this.player.isAirborne(),
        boostActive: this.player.isBoostActive(),
        magnetActive: this.magnetTimerMs > 0,
        ghostActive: this.ghostTimerMs > 0,
        invertActive: this.invertTimerMs > 0 || blackoutActsAsInvert,
        blackoutActive: this.blackoutTimerMs > 0 && !blackoutActsAsInvert,
        policeActive: this.isPoliceChasing(),
      }),
      pageBestScore: Math.max(this.pageBestScore, this.score),
      lifetimeBestScore: Math.max(this.lifetimeBestScore, this.score),
      activeEffects: this.getActiveEffects(currentSurface),
    };
    drawHud(ctx, this.world.viewport, hudState);
  }

  private drawPickups(): void {
    if (!this.world) {
      return;
    }

    const ctx = this.context;
    ctx.save();
    const now = performance.now();

    for (const [index, pickup] of this.world.pickups.entries()) {
      const centerX = pickup.rect.x + pickup.rect.width / 2;
      const centerY = pickup.rect.y + pickup.rect.height / 2;
      const radius = pickup.rect.width / 2 + 1;
      const spin = Math.abs(Math.sin(now / 180 + index * 0.75));
      const width = Math.max(3.5, radius * (0.3 + spin * 0.7));

      if (pickup.kind === 'special' && pickup.effect) {
        drawSpecialPickupSprite(ctx, pickup, {
          centerX,
          centerY,
          radius,
          spin,
          nowMs: now,
        });
        continue;
      }

      const isFlowCoin = this.comboTimerMs > 0 && this.pickupComboCount >= 3;
      drawRegularCoinSprite(ctx, {
        centerX,
        centerY,
        radius,
        width,
        isFlowCoin,
      });
    }

    ctx.restore();
  }

  private drawSpecialSpawnCues(): void {
    if (this.specialSpawnCues.length === 0) {
      return;
    }

    const ctx = this.context;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 9px "SFMono-Regular", "JetBrains Mono", monospace';

    for (const cue of this.specialSpawnCues) {
      const progress = 1 - cue.ttlMs / cue.durationMs;
      const ringRadius = 10 + progress * 22;
      const alpha = Math.max(0, Math.min(1, cue.ttlMs / 600));

      ctx.globalAlpha = alpha * 0.85;
      ctx.strokeStyle = cue.color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(cue.x, cue.y, ringRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
      ctx.fillRect(cue.x - 14, cue.y - 26, 28, 12);
      ctx.strokeStyle = cue.color;
      ctx.lineWidth = 1.1;
      ctx.strokeRect(cue.x - 13.5, cue.y - 25.5, 27, 11);
      ctx.fillStyle = cue.label === SPECIAL_LABELS.blackout ? '#e2e8f0' : cue.color;
      ctx.fillText(cue.label, cue.x, cue.y - 20);
    }

    ctx.restore();
  }

  private drawPlaneBonusEvent(): void {
    if (!this.planeBonusEvent) {
      return;
    }

    const ctx = this.context;
    const plane = this.planeBonusEvent;
    renderPlaneSprite(
      ctx,
      { x: plane.x, y: plane.y, angle: plane.angle },
      performance.now(),
      {
        wobbleRadians: Math.sin(performance.now() / 220) * 0.022,
        snapToPixel: true,
      },
    );
  }

  private drawSpriteShowcase(): void {
    if (!this.world) {
      return;
    }

    const ctx = this.context;
    const { width, height } = this.world.viewport;
    const now = performance.now();
    const theme = SHOWCASE_THEMES[this.spriteShowcaseThemeIndex];

    ctx.save();
    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(width, y + 0.5);
      ctx.stroke();
    }

    ctx.fillStyle = theme.title;
    ctx.font = 'bold 14px "SFMono-Regular", "JetBrains Mono", monospace';
    ctx.fillText('SPRITE SHOWCASE', 20, 20);
    ctx.fillStyle = theme.subtitle;
    ctx.font = '11px "SFMono-Regular", "JetBrains Mono", monospace';
    ctx.fillText('SHIFT+D TO EXIT + RESTART', 20, 38);
    ctx.fillText(`ARROWS THEME: ${theme.name}`, 20, 54);
    ctx.fillText(`AUTO PAGE LUMA: ${Math.round(this.spriteShowcasePageLightness * 100)}%`, 20, 70);

    const carsBaseY = 102;
    const carXs = [80, 130, 180] as const;
    const designs: VehicleDesign[] = ['coupe', 'buggy', 'truck'];
    carXs.forEach((x, index) => {
      renderPlayerSprite(ctx, {
        centerX: x,
        centerY: carsBaseY,
        angle: -0.24,
        design: designs[index],
        boostActive: index === 2,
        magnetActive: false,
        opacity: 1,
        nowMs: now,
      });
      renderPlayerSprite(ctx, {
        centerX: x,
        centerY: carsBaseY + 36,
        angle: -0.24,
        design: designs[index],
        boostActive: false,
        magnetActive: false,
        opacity: 0.46,
        nowMs: now,
      });
      renderPlayerSprite(ctx, {
        centerX: x,
        centerY: carsBaseY + 72,
        angle: -0.24,
        design: designs[index],
        boostActive: false,
        magnetActive: true,
        opacity: 1,
        nowMs: now,
      });
    });

    renderPlaneSprite(
      ctx,
      { x: width * 0.52, y: carsBaseY - 6, angle: 0.48 },
      now,
      { wobbleRadians: Math.sin(now / 220) * 0.022, scale: 1.08, snapToPixel: true },
    );

    renderPoliceCarSprite(
      ctx,
      {
        x: width * 0.68,
        y: carsBaseY - POLICE_CAR_SIZE.height / 2,
        angle: 0.38,
      },
      now,
    );

    renderPoliceWarningIndicator(
      ctx,
      this.world.viewport,
      { edge: 'right', remainingMs: 600, durationMs: 1100 },
      now,
    );

    renderEdgeWarningIndicator(ctx, this.world.viewport, now, {
      edge: 'left',
      label: 'NYOOM',
      colorOn: '#f9a8d4',
      colorOff: '#be185d',
      flashPeriodMs: 82,
      padding: 18,
    });
    const pickupsY = Math.max(176, Math.min(height - 72, carsBaseY + 112));
    const coinRadius = 9;
    const coinSpinA = Math.abs(Math.sin(now / 180));
    const coinSpinB = Math.abs(Math.sin(now / 180 + 0.75));
    drawRegularCoinSprite(ctx, {
      centerX: 70,
      centerY: pickupsY,
      radius: coinRadius,
      width: Math.max(3.5, coinRadius * (0.3 + coinSpinA * 0.7)),
      isFlowCoin: false,
    });
    drawRegularCoinSprite(ctx, {
      centerX: 102,
      centerY: pickupsY,
      radius: coinRadius,
      width: Math.max(3.5, coinRadius * (0.3 + coinSpinB * 0.7)),
      isFlowCoin: true,
    });

    const specialEffects: SpecialEffect[] = ['bonus', 'magnet', 'invert', 'ghost', 'blackout'];
    specialEffects.forEach((effect, index) => {
      const pickup: WorldPickup = {
        id: `showcase:${effect}:${index}`,
        rect: { x: 0, y: 0, width: 18, height: 18 },
        value: 0,
        kind: 'special',
        effect,
        accentColor: getSpecialColor(effect),
        label: getSpecialLabel(effect),
      };
      drawSpecialPickupSprite(ctx, pickup, {
        centerX: 154 + index * 34,
        centerY: pickupsY,
        radius: 9,
        spin: Math.abs(Math.sin(now / 180 + index * 0.75)),
        nowMs: now,
      });
    });

    const toastCols = 3;
    const toastWidth = 66;
    const toastHeight = 16;
    const toastGap = 6;
    const toastPanelX = width - (toastCols * toastWidth + (toastCols - 1) * toastGap) - 18;
    const toastPanelY = pickupsY - 56;
    ctx.fillStyle = theme.toastPanel;
    ctx.fillRect(
      toastPanelX - 8,
      toastPanelY - 22,
      toastCols * toastWidth + (toastCols - 1) * toastGap + 16,
      Math.ceil(SHOWCASE_TOAST_MESSAGES.length / toastCols) * (toastHeight + toastGap) + 32,
    );
    ctx.fillStyle = theme.subtitle;
    ctx.font = 'bold 10px "SFMono-Regular", "JetBrains Mono", monospace';
    ctx.fillText('TOASTS', toastPanelX - 2, toastPanelY - 8);

    SHOWCASE_TOAST_MESSAGES.forEach((text, index) => {
      const col = index % toastCols;
      const row = Math.floor(index / toastCols);
      const x = toastPanelX + col * (toastWidth + toastGap);
      const y = toastPanelY + row * (toastHeight + toastGap);
      ctx.fillStyle = theme.toastCard;
      ctx.fillRect(x, y, toastWidth, toastHeight);
      ctx.strokeStyle = theme.toastStroke;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, toastWidth - 1, toastHeight - 1);
      ctx.fillStyle = theme.toastText;
      ctx.font = 'bold 9px "SFMono-Regular", "JetBrains Mono", monospace';
      ctx.fillText(text, x + 4, y + 11);
    });

    ctx.restore();
  }

  private cycleSpriteShowcaseTheme(direction: -1 | 1): void {
    const total = SHOWCASE_THEMES.length;
    this.spriteShowcaseThemeIndex =
      (this.spriteShowcaseThemeIndex + direction + total) % total;
  }

  private autoPickSpriteShowcaseTheme(): void {
    this.spriteShowcasePageLightness = this.estimatePageLightness();
    this.spriteShowcaseThemeIndex = pickOppositeShowcaseThemeIndex(this.spriteShowcasePageLightness);
  }

  private estimatePageLightness(): number {
    if (!this.world) {
      return 0.5;
    }

    const samplePoints = [
      { x: 0.18, y: 0.2 },
      { x: 0.5, y: 0.2 },
      { x: 0.82, y: 0.2 },
      { x: 0.18, y: 0.5 },
      { x: 0.5, y: 0.5 },
      { x: 0.82, y: 0.5 },
      { x: 0.18, y: 0.8 },
      { x: 0.5, y: 0.8 },
      { x: 0.82, y: 0.8 },
    ];

    let total = 0;
    let count = 0;
    for (const point of samplePoints) {
      const sample = this.sampleSurfaceAt({
        x: this.world.viewport.width * point.x,
        y: this.world.viewport.height * point.y,
      });
      if (Number.isFinite(sample.lightness)) {
        total += clamp(sample.lightness, 0, 1);
        count += 1;
      }
    }

    return count > 0 ? total / count : 0.5;
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.running) {
      return;
    }

    if (this.gameOverState) {
      if (event.code === 'Escape') {
        void this.audio.resume();
        event.stopImmediatePropagation();
        event.preventDefault();
        this.onQuit();
        return;
      }

      if (event.repeat || isModifierKey(event.code) || event.code !== 'Space') {
        return;
      }

      void this.audio.resume();
      event.stopImmediatePropagation();
      event.preventDefault();
      this.beginRun('manual');
      return;
    }

    if (event.code === 'Escape') {
      void this.audio.resume();
      event.stopImmediatePropagation();
      event.preventDefault();
      this.onQuit();
      return;
    }

    if (event.code === 'KeyD' && event.shiftKey && !event.repeat) {
      void this.audio.resume();
      event.stopImmediatePropagation();
      event.preventDefault();
      if (this.spriteShowcaseActive) {
        this.spriteShowcaseActive = false;
        this.beginRun('manual');
      } else {
        this.enterSpriteShowcaseMode();
      }
      return;
    }

    if (
      this.spriteShowcaseActive &&
      !event.repeat &&
      (event.code === 'ArrowLeft' || event.code === 'ArrowRight')
    ) {
      event.stopImmediatePropagation();
      event.preventDefault();
      this.cycleSpriteShowcaseTheme(event.code === 'ArrowRight' ? 1 : -1);
      return;
    }

    if (event.code === 'KeyR' && !event.shiftKey && !event.repeat) {
      void this.audio.resume();
      event.stopImmediatePropagation();
      event.preventDefault();
      this.restart();
      return;
    }

    if (event.code === 'KeyM' && !event.repeat) {
      void this.audio.resume();
      const nextSoundEnabled = !this.soundEnabled;
      this.setSoundEnabled(nextSoundEnabled);
      this.onSoundEnabledChange(nextSoundEnabled);
      this.audio.playToggle(nextSoundEnabled);
      event.stopImmediatePropagation();
      event.preventDefault();
      return;
    }

    if (event.code === 'KeyV' && !event.repeat) {
      void this.audio.resume();
      const nextVehicleDesign = getNextVehicleDesign(this.vehicleDesign);
      this.setVehicleDesign(nextVehicleDesign);
      this.onVehicleDesignChange(nextVehicleDesign);
      this.spawnEffectMessage(getVehicleDesignLabel(nextVehicleDesign), '#f8fafc', 'low');
      event.stopImmediatePropagation();
      event.preventDefault();
      return;
    }

    const consumed = this.setInputFlag(event.code, true);
    if (consumed) {
      void this.audio.resume();
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  };

  private handleKeyUp = (event: KeyboardEvent): void => {
    if (!this.running) {
      return;
    }

    if (this.gameOverState) {
      return;
    }

    const consumed = this.setInputFlag(event.code, false);
    if (consumed) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  };

  private setInputFlag(code: string, value: boolean): boolean {
    switch (code) {
      case 'ArrowUp':
      case 'KeyW':
        this.input.up = value;
        return true;
      case 'ArrowDown':
      case 'KeyS':
        this.input.down = value;
        return true;
      case 'ArrowLeft':
      case 'KeyA':
        this.input.left = value;
        return true;
      case 'ArrowRight':
      case 'KeyD':
        this.input.right = value;
        return true;
      case 'Space':
        // Keep Space swallowed so the underlying page does not react while racing.
        return true;
      default:
        return false;
    }
  }

  private resetInput(): void {
    this.input.up = false;
    this.input.down = false;
    this.input.left = false;
    this.input.right = false;
  }

  private emitCollisionEventIfNeeded(): void {
    if (!this.player) {
      return;
    }

    const diagnostics = this.player.getLastStepDiagnostics();
    if (!diagnostics.hitX && !diagnostics.hitY) {
      return;
    }

    const now = performance.now();
    if (now - this.lastCollisionEventAtMs < 140) {
      return;
    }

    const bounds = this.player.getBounds();
    this.emitDebugEvent({
      type: 'collision',
      atMs: now,
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
      hitX: diagnostics.hitX,
      hitY: diagnostics.hitY,
      speed: diagnostics.speed,
      scrollY: window.scrollY,
    });
    this.lastCollisionEventAtMs = now;
  }

  private getActiveInput(): InputState {
    return {
      up: this.debugInput?.up ?? this.input.up,
      down: this.debugInput?.down ?? this.input.down,
      left: this.debugInput?.left ?? this.input.left,
      right: this.debugInput?.right ?? this.input.right,
    };
  }

  private spawnPickupMessage(pickup: World['pickups'][number]): void {
    const centerX = pickup.rect.x + pickup.rect.width / 2;
    const centerY = pickup.rect.y + pickup.rect.height / 2;
    const isSpecial = pickup.kind === 'special' && pickup.effect;
    const text = isSpecial
      ? `+${pickup.label ?? pickup.effect?.toUpperCase() ?? 'FX'}`
      : PICKUP_WORDS[this.pickupFlavorIndex % PICKUP_WORDS.length];
    const color = isSpecial
      ? pickup.accentColor ?? '#f8fafc'
      : PICKUP_COLORS[this.pickupFlavorIndex % PICKUP_COLORS.length];
    if (!isSpecial) {
      this.pickupFlavorIndex += 1;
    }

    this.toastSystem.enqueue({
      x: centerX,
      y: centerY - 18,
      text,
      ttlMs: isSpecial ? TOAST_EFFECT_TTL_MS : TOAST_PICKUP_TTL_MS,
      color,
      priority: 'low',
    });
  }

  private updateSpecialSpawnCues(dtSeconds: number): void {
    if (this.specialSpawnCues.length === 0) {
      return;
    }

    const deltaMs = dtSeconds * 1000;
    this.specialSpawnCues = this.specialSpawnCues
      .map((cue) => ({
        ...cue,
        ttlMs: cue.ttlMs - deltaMs,
      }))
      .filter((cue) => cue.ttlMs > 0);
  }

  private updatePlaneWarning(dtSeconds: number): void {
    if (!this.planeWarning) {
      return;
    }

    this.planeWarning.remainingMs = Math.max(0, this.planeWarning.remainingMs - dtSeconds * 1000);
    if (this.planeWarning.remainingMs === 0) {
      this.planeWarning = null;
    }
  }

  private updateRegularCoinSpawns(dtSeconds: number): void {
    if (!this.world || this.coinSpawnQueue.length === 0) {
      return;
    }

    this.coinRefillBoostTimerMs = Math.max(0, this.coinRefillBoostTimerMs - dtSeconds * 1000);
    const visibleRegularCoins = this.world.pickups.filter((pickup) => !isSpecialPickup(pickup)).length;
    if (visibleRegularCoins >= REGULAR_COIN_VISIBLE_CAP) {
      return;
    }

    this.coinRefillTimerMs = Math.max(0, this.coinRefillTimerMs - dtSeconds * 1000);
    if (this.coinRefillTimerMs > 0) {
      return;
    }

    const spawned = this.spawnQueuedCoins(1);
    const visibleRegularCoinsAfterSpawn = this.world.pickups.filter(
      (pickup) => !isSpecialPickup(pickup),
    ).length;
    this.coinRefillTimerMs = spawned
      ? this.getCoinRefillDelayMs(visibleRegularCoinsAfterSpawn)
      : randomBetween(REGULAR_COIN_RETRY_MIN_MS, REGULAR_COIN_RETRY_MAX_MS);
  }

  private updateAmbientSpecialSpawns(dtSeconds: number): void {
    if (!this.world) {
      return;
    }

    this.specialSpawnTimerMs = Math.max(0, this.specialSpawnTimerMs - dtSeconds * 1000);
    if (this.specialSpawnTimerMs > 0) {
      return;
    }

    const existingSpecials = this.dynamicPickups.filter((pickup) => pickup.kind === 'special').length;
    if (existingSpecials >= SPECIAL_VISIBLE_CAP) {
      this.specialSpawnTimerMs = randomBetween(
        SPECIAL_CAP_RETRY_MIN_MS,
        SPECIAL_CAP_RETRY_MAX_MS,
      );
      return;
    }

    const spawned = this.spawnSpecialPickup();
    this.specialSpawnTimerMs = spawned
      ? randomBetween(SPECIAL_RESPAWN_MIN_MS, SPECIAL_RESPAWN_MAX_MS)
      : randomBetween(SPECIAL_RETRY_MIN_MS, SPECIAL_RETRY_MAX_MS);
  }

  private updatePlaneBonusEvent(dtSeconds: number): void {
    if (!this.world) {
      return;
    }

    if (!this.planeBonusEvent) {
      const hasRunProgress = this.score >= PLANE_EVENT_MIN_SCORE || this.coinsCollectedTotal >= 4;
      if (!hasRunProgress) {
        return;
      }

      // Keep police and plane as separate beats, not stacked chaos.
      if (this.policeChase || this.policeWarning) {
        this.planeBonusTimerMs = Math.max(this.planeBonusTimerMs, ENCOUNTER_STAGGER_MS);
        return;
      }

      this.planeBonusTimerMs = Math.max(0, this.planeBonusTimerMs - dtSeconds * 1000);
      if (this.planeBonusTimerMs > 0) {
        return;
      }

      const path = createPlaneCornerPath(this.world.viewport);
      const dx = path.end.x - path.start.x;
      const dy = path.end.y - path.start.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const vx = (dx / distance) * PLANE_EVENT_SPEED;
      const vy = (dy / distance) * PLANE_EVENT_SPEED;
      const ttlMs = (distance / PLANE_EVENT_SPEED) * 1000 + 650;

      this.planeBonusEvent = {
        x: path.start.x,
        y: path.start.y,
        vx,
        vy,
        angle: Math.atan2(vy, vx),
        ttlMs,
        distancePx: distance,
        traveledPx: 0,
        dropAtPx: distance * randomBetween(0.36, 0.64),
        dropped: false,
      };
      this.planeWarning = {
        edge: getPlaneEntryEdge(this.world.viewport, path.start),
        remainingMs: PLANE_WARNING_MS,
        durationMs: PLANE_WARNING_MS,
      };
      this.audio.playPlaneFlyover();
      this.spawnEffectMessage('PLANE', '#93c5fd', 'medium');
      return;
    }

    const stepX = this.planeBonusEvent.vx * dtSeconds;
    const stepY = this.planeBonusEvent.vy * dtSeconds;
    this.planeBonusEvent.ttlMs = Math.max(0, this.planeBonusEvent.ttlMs - dtSeconds * 1000);
    this.planeBonusEvent.x += stepX;
    this.planeBonusEvent.y += stepY;
    this.planeBonusEvent.traveledPx += Math.hypot(stepX, stepY);

    if (!this.planeBonusEvent.dropped) {
      if (this.planeBonusEvent.traveledPx >= this.planeBonusEvent.dropAtPx) {
        this.spawnPlaneBonusDrop(this.planeBonusEvent.x, this.planeBonusEvent.y + 14);
        this.planeBonusEvent.dropped = true;
      }
    }

    const offscreen = isPointOutsideViewport(
      this.world.viewport,
      this.planeBonusEvent.x,
      this.planeBonusEvent.y,
      86,
    );
    if (
      this.planeBonusEvent.ttlMs === 0 ||
      this.planeBonusEvent.traveledPx >= this.planeBonusEvent.distancePx + 24 ||
      offscreen
    ) {
      this.planeBonusEvent = null;
      this.planeBonusTimerMs = randomBetween(PLANE_EVENT_RESPAWN_MIN_MS, PLANE_EVENT_RESPAWN_MAX_MS);
      this.policeSpawnTimerMs = Math.max(
        this.policeSpawnTimerMs,
        randomBetween(POLICE_AFTER_PLANE_MIN_MS, POLICE_AFTER_PLANE_MAX_MS),
      );
    }
  }

  private spawnPlaneBonusDrop(x: number, y: number): void {
    if (!this.world) {
      return;
    }

    const rect =
      this.findFreePickupRectNear({ x, y }, PLANE_BONUS_PICKUP_SIZE, 22) ??
      this.findFreePickupRect(PLANE_BONUS_PICKUP_SIZE);
    if (!rect) {
      return;
    }

    const pickup: WorldPickup = {
      id: `plane-bonus:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      rect,
      value: 0,
      kind: 'special',
      effect: 'bonus',
      accentColor: getSpecialColor('bonus'),
      label: getSpecialLabel('bonus'),
    };
    this.dynamicPickups.push(pickup);
    this.world.pickups.push(clonePickup(pickup));
    this.enqueueSpecialSpawnCue(pickup);
    this.audio.playPlaneDrop();
    this.spawnEffectMessage(getSpecialDropMessage('bonus'), getSpecialColor('bonus'), 'high');
  }

  private spawnQueuedCoins(count: number): boolean {
    if (!this.world || !this.player || this.coinSpawnQueue.length === 0) {
      return false;
    }

    let spawnedAny = false;
    let spawnedCount = 0;
    while (spawnedCount < count) {
      const anchor = this.nextSpawnableCoinAnchor();
      if (!anchor) {
        break;
      }

      const pickup: WorldPickup = {
        id: `coin:${anchor.sourceId ?? anchor.id}:${this.coinSpawnIdCounter}`,
        sourceId: anchor.sourceId ?? anchor.id,
        rect: cloneRect(anchor.rect),
        value: REGULAR_COIN_SCORE,
        kind: 'coin',
      };
      this.coinSpawnIdCounter += 1;
      this.world.pickups.push(pickup);
      spawnedCount += 1;
      spawnedAny = true;
    }

    return spawnedAny;
  }

  private nextSpawnableCoinAnchor(): WorldPickup | null {
    if (!this.world || !this.player || this.coinSpawnQueue.length === 0) {
      return null;
    }

    const attempts = this.coinSpawnQueue.length;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const anchor = this.coinSpawnQueue.shift();
      if (!anchor) {
        break;
      }
      this.coinSpawnQueue.push(anchor);

      const sourceId = anchor.sourceId ?? anchor.id;
      const alreadyVisible = this.world.pickups.some(
        (pickup) => !isSpecialPickup(pickup) && (pickup.sourceId ?? pickup.id) === sourceId,
      );
      if (alreadyVisible) {
        continue;
      }

      if (!this.canSpawnRegularCoinAt(anchor.rect)) {
        continue;
      }

      return anchor;
    }

    return null;
  }

  private canSpawnRegularCoinAt(rect: Rect): boolean {
    if (!this.world || !this.player) {
      return false;
    }

    if (rectsIntersect(rect, this.player.getBounds())) {
      return false;
    }

    if (this.world.obstacles.some((obstacle) => rectsIntersect(rect, obstacle))) {
      return false;
    }

    if (this.world.deadSpots.some((deadSpot) => rectsIntersect(rect, deadSpot))) {
      return false;
    }

    if (this.world.hazards.some((hazard) => rectsIntersect(rect, hazard))) {
      return false;
    }

    return !this.world.pickups.some((pickup) => rectsIntersect(rect, pickup.rect));
  }

  private getCoinRefillDelayMs(visibleRegularCoins: number): number {
    if (this.coinRefillBoostTimerMs > 0) {
      return randomBetween(REGULAR_COIN_REFILL_FAST_MIN_MS, REGULAR_COIN_REFILL_FAST_MAX_MS);
    }

    if (visibleRegularCoins <= REGULAR_COIN_LOW_PRESSURE_THRESHOLD) {
      return randomBetween(REGULAR_COIN_REFILL_LOW_MIN_MS, REGULAR_COIN_REFILL_LOW_MAX_MS);
    }

    return randomBetween(REGULAR_COIN_REFILL_MIN_MS, REGULAR_COIN_REFILL_MAX_MS);
  }

  private spawnSpecialPickup(): boolean {
    if (!this.world) {
      return false;
    }

    const existingSpecials = this.dynamicPickups.filter((pickup) => pickup.kind === 'special').length;
    if (existingSpecials >= SPECIAL_VISIBLE_CAP) {
      return false;
    }

    const rect = this.findFreePickupRect(20);
    if (!rect) {
      return false;
    }

    const surface = this.sampleSurfaceAt({
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    });
    const effect = adaptBlackoutEffectForSurface(pickSpecialEffect(surface), surface);
    const pickup: WorldPickup = {
      id: `special:${effect}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      rect,
      value: 25,
      kind: 'special',
      effect,
      accentColor: getSpecialColor(effect),
      label: getSpecialLabel(effect),
    };
    this.dynamicPickups.push(pickup);
    this.world.pickups.push(clonePickup(pickup));
    this.enqueueSpecialSpawnCue(pickup);
    this.spawnEffectMessage(getSpecialDropMessage(effect), getSpecialColor(effect), 'high');
    return true;
  }

  private findFreePickupRect(size: number): Rect | null {
    if (!this.world || !this.player) {
      return null;
    }

    const blockers = [
      ...this.world.obstacles,
      ...this.world.deadSpots,
      this.player.getBounds(),
      ...this.world.pickups.map((pickup) => pickup.rect),
    ];

    for (let attempt = 0; attempt < 48; attempt += 1) {
      const rect = {
        x: 16 + Math.random() * Math.max(1, this.world.viewport.width - size - 32),
        y: 24 + Math.random() * Math.max(1, this.world.viewport.height - size - 48),
        width: size,
        height: size,
      };

      if (!blockers.some((blocker) => rectsIntersect(rect, blocker))) {
        return rect;
      }
    }

    return null;
  }

  private findFreePickupRectNear(point: Vector2, size: number, radius: number): Rect | null {
    if (!this.world || !this.player) {
      return null;
    }

    const blockers = [
      ...this.world.obstacles,
      ...this.world.deadSpots,
      this.player.getBounds(),
      ...this.world.pickups.map((pickup) => pickup.rect),
    ];

    const preferredOffsets = [
      { x: 0, y: 0 },
      { x: 0, y: 8 },
      { x: 0, y: -8 },
      { x: 8, y: 0 },
      { x: -8, y: 0 },
      { x: 6, y: 6 },
      { x: -6, y: 6 },
      { x: 6, y: -6 },
      { x: -6, y: -6 },
      { x: 0, y: 14 },
    ];

    for (const offset of preferredOffsets) {
      const candidate = {
        x: clamp(point.x + offset.x - size / 2, 16, this.world.viewport.width - size - 16),
        y: clamp(point.y + offset.y - size / 2, 24, this.world.viewport.height - size - 24),
        width: size,
        height: size,
      };
      if (!blockers.some((blocker) => rectsIntersect(candidate, blocker))) {
        return candidate;
      }
    }

    for (let attempt = 0; attempt < 14; attempt += 1) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * radius;
      const rect = {
        x: clamp(point.x + Math.cos(angle) * distance - size / 2, 16, this.world.viewport.width - size - 16),
        y: clamp(point.y + Math.sin(angle) * distance - size / 2, 24, this.world.viewport.height - size - 24),
        width: size,
        height: size,
      };
      if (!blockers.some((blocker) => rectsIntersect(rect, blocker))) {
        return rect;
      }
    }

    return null;
  }

  private activateSpecialEffect(effect: SpecialEffect): void {
    const resolvedEffect = adaptBlackoutEffectForSurface(effect, this.sampleCurrentSurface());
    switch (resolvedEffect) {
      case 'bonus':
        this.score += BONUS_SPECIAL_SCORE;
        this.spawnEffectMessage(getSpecialActivationMessage('bonus'), SPECIAL_COLORS.bonus, 'high');
        return;
      case 'invert':
        this.invertTimerMs = 5200;
        this.setInverted(true);
        this.spawnEffectMessage(getSpecialActivationMessage('invert'), SPECIAL_COLORS.invert, 'high');
        return;
      case 'magnet':
        this.magnetTimerMs = 6200;
        this.spawnEffectMessage(getSpecialActivationMessage('magnet'), SPECIAL_COLORS.magnet, 'high');
        return;
      case 'ghost':
        this.ghostTimerMs = 5600;
        this.spawnEffectMessage(getSpecialActivationMessage('ghost'), SPECIAL_COLORS.ghost, 'high');
        return;
      case 'blackout':
        this.blackoutTimerMs = 4200;
        this.setBlackout(true);
        this.spawnEffectMessage(getSpecialActivationMessage('blackout'), SPECIAL_COLORS.blackout, 'high');
        return;
    }
  }

  private sampleCurrentSurface(): SurfaceSample {
    if (!this.world || !this.player) {
      return {
        lightness: 0.5,
        saturation: 0,
        hasGradient: false,
      };
    }

    const bounds = this.player.getBounds();
    return this.sampleSurfaceAt({
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    });
  }

  private applyMagnet(dtSeconds: number): void {
    if (!this.world || !this.player || this.magnetTimerMs <= 0) {
      return;
    }

    const playerCenter = rectCenter(this.player.getBounds());

    for (const pickup of this.world.pickups) {
      if (pickup.kind === 'special') {
        continue;
      }

      const pickupCenter = rectCenter(pickup.rect);
      const dx = playerCenter.x - pickupCenter.x;
      const dy = playerCenter.y - pickupCenter.y;
      const distance = Math.hypot(dx, dy);

      if (distance > 170 || distance < 1) {
        continue;
      }

      const pull = Math.min(220, 110 + (170 - distance) * 1.3) * dtSeconds;
      const moveX = (dx / distance) * pull;
      const moveY = (dy / distance) * pull;
      pickup.rect.x += moveX;
      pickup.rect.y += moveY;
    }
  }

  private updateUiEffects(): void {
    this.setMagnetUiState({ active: false, point: null, strength: 0 });
  }

  private applyPickupComboBonus(): number {
    if (this.comboTimerMs > 0) {
      this.pickupComboCount += 1;
    } else {
      this.pickupComboCount = 1;
    }

    this.comboTimerMs = COMBO_WINDOW_MS;

    if (this.pickupComboCount < 3) {
      return 0;
    }

    const bonus = Math.min(14, 2 + (this.pickupComboCount - 3) * 2);
    if ([3, 5, 8, 12].includes(this.pickupComboCount)) {
      this.spawnEffectMessage(`FLOW x${this.pickupComboCount}`, '#fb7185', 'medium');
    }

    return bonus;
  }

  private updatePoliceChase(dtSeconds: number): {
    active: boolean;
    urgency: number;
    caught: boolean;
  } {
    if (!this.world || !this.player) {
      return { active: false, urgency: 0, caught: false };
    }

    const ghostActive = this.ghostTimerMs > 0;
    if (ghostActive) {
      this.policeWarning = null;
      if (this.policeChase?.phase === 'chasing') {
        this.policeChase.phase = 'leaving';
        this.policeChase.exitEdge = getNearestPoliceExitEdge(this.world.viewport, this.policeChase);
        this.spawnEffectMessage('NO TRACE', '#c4b5fd', 'high');
      }
    }

    if (!this.policeChase) {
      if (ghostActive) {
        return { active: false, urgency: 0, caught: false };
      }

      const runElapsedMs = this.startTimeMs > 0 ? performance.now() - this.startTimeMs : 0;
      const hasRunProgress =
        this.score >= POLICE_START_SCORE_THRESHOLD ||
        this.coinsCollectedTotal >= POLICE_START_COINS_THRESHOLD;
      if (runElapsedMs < POLICE_START_DELAY_MS || !hasRunProgress) {
        return { active: false, urgency: 0, caught: false };
      }

      // Do not start police pressure while plane beat is active/warning.
      if (this.planeBonusEvent || this.planeWarning) {
        this.policeWarning = null;
        this.policeSpawnTimerMs = Math.max(this.policeSpawnTimerMs, ENCOUNTER_STAGGER_MS);
        return { active: false, urgency: 0, caught: false };
      }

      this.policeSpawnTimerMs = Math.max(0, this.policeSpawnTimerMs - dtSeconds * 1000);
      if (!this.policeWarning && this.policeSpawnTimerMs <= POLICE_WARNING_MS) {
        this.policeWarning = {
          edge: getRandomPoliceEdge(),
          remainingMs: this.policeSpawnTimerMs,
          durationMs: POLICE_WARNING_MS,
        };
        this.audio.playPoliceAlert();
        this.spawnEffectMessage('WEE-OO', '#93c5fd', 'critical');
      }

      if (this.policeWarning) {
        this.policeWarning.remainingMs = this.policeSpawnTimerMs;
      }

      if (this.policeSpawnTimerMs <= 0) {
        this.spawnPoliceChase(this.policeWarning?.edge);
        this.policeWarning = null;
        return { active: true, urgency: 0.3, caught: false };
      }

      return { active: false, urgency: 0, caught: false };
    }

    if (this.policeChase.phase === 'leaving') {
      const exitTarget = getPoliceExitTarget(this.world.viewport, this.policeChase);
      const policeCenter = {
        x: this.policeChase.x + POLICE_CAR_SIZE.width / 2,
        y: this.policeChase.y + POLICE_CAR_SIZE.height / 2,
      };
      const policeRect = getPoliceRect(this.policeChase);
      const onIce = isOnIceZone(policeRect, this.world.iceZones);
      const dx = exitTarget.x - policeCenter.x;
      const dy = exitTarget.y - policeCenter.y;
      const distance = Math.hypot(dx, dy);
      const exitSpeed = 230 * (onIce ? POLICE_ICE_SPEED_MULTIPLIER : 1);

      if (distance > 0.0001) {
        const targetAngle = Math.atan2(dy, dx);
        const turnBlend = clamp(dtSeconds * (onIce ? POLICE_ICE_TURN_RATE : 16), 0, 1);
        const moveAngle = blendAngle(this.policeChase.angle, targetAngle, turnBlend);
        this.policeChase.x += Math.cos(moveAngle) * exitSpeed * dtSeconds;
        this.policeChase.y += Math.sin(moveAngle) * exitSpeed * dtSeconds;
        this.policeChase.angle = moveAngle;
      }

      if (isPoliceOffscreen(this.world.viewport, this.policeChase, 28)) {
        this.policeChase = null;
        this.policeSpawnTimerMs = randomBetween(POLICE_RESPAWN_MIN_MS, POLICE_RESPAWN_MAX_MS);
        if (!this.planeBonusEvent && !this.planeWarning) {
          this.planeBonusTimerMs = randomBetween(PLANE_AFTER_POLICE_MIN_MS, PLANE_AFTER_POLICE_MAX_MS);
        }
      }

      return { active: false, urgency: 0, caught: false };
    }

    this.policeChase.remainingMs = Math.max(0, this.policeChase.remainingMs - dtSeconds * 1000);
    if (this.policeChase.remainingMs === 0) {
      this.policeChase.phase = 'leaving';
      this.policeChase.exitEdge = getNearestPoliceExitEdge(this.world.viewport, this.policeChase);
      this.spawnEffectMessage('ESCAPED', '#86efac', 'high');
      return { active: false, urgency: 0, caught: false };
    }

    const playerBounds = this.player.getBounds();
    const playerCenter = rectCenter(playerBounds);
    const policeCenter = {
      x: this.policeChase.x + POLICE_CAR_SIZE.width / 2,
      y: this.policeChase.y + POLICE_CAR_SIZE.height / 2,
    };
    const dx = playerCenter.x - policeCenter.x;
    const dy = playerCenter.y - policeCenter.y;
    const distance = Math.hypot(dx, dy);
    const urgency = clamp(1 - distance / 260, 0.12, 1);
    const policeRect = getPoliceRect(this.policeChase);
    const onIce = isOnIceZone(policeRect, this.world.iceZones);
    const speed =
      (162 + Math.min(50, this.score * 0.2) + urgency * 28) * (onIce ? POLICE_ICE_SPEED_MULTIPLIER : 1);

    if (distance > 0.0001) {
      const targetAngle = Math.atan2(dy, dx);
      const turnBlend = clamp(dtSeconds * (onIce ? POLICE_ICE_TURN_RATE : 18), 0, 1);
      const moveAngle = blendAngle(this.policeChase.angle, targetAngle, turnBlend);
      this.policeChase.x += Math.cos(moveAngle) * speed * dtSeconds;
      this.policeChase.y += Math.sin(moveAngle) * speed * dtSeconds;
      this.policeChase.angle = moveAngle;
    }

    if (rectsIntersect(playerBounds, getPoliceRect(this.policeChase))) {
      this.enterCaughtGameOver();
      return { active: false, urgency: 1, caught: true };
    }

    return { active: true, urgency, caught: false };
  }

  private spawnPoliceChase(edge?: PoliceEdge): void {
    if (!this.world) {
      return;
    }

    const spawnEdge = edge ?? getRandomPoliceEdge();
    const spawn = getPoliceSpawn(this.world.viewport, spawnEdge);
    const durationMs = randomBetween(POLICE_CHASE_DURATION_MIN_MS, POLICE_CHASE_DURATION_MAX_MS);
    this.policeChase = {
      ...spawn,
      remainingMs: durationMs,
      durationMs,
      phase: 'chasing',
      exitEdge: spawnEdge,
    };
    this.policeSpawnTimerMs = randomBetween(POLICE_POST_SPAWN_MIN_MS, POLICE_POST_SPAWN_MAX_MS);
    this.spawnEffectMessage('POLICE!', '#60a5fa', 'critical');
  }

  private drawPoliceCar(): void {
    if (!this.policeChase) {
      return;
    }

    renderPoliceCarSprite(this.context, this.policeChase, performance.now());
  }

  private isPoliceChasing(): boolean {
    return this.policeChase?.phase === 'chasing';
  }

  private drawPoliceWarning(): void {
    if (!this.world || !this.policeWarning) {
      return;
    }

    renderPoliceWarningIndicator(this.context, this.world.viewport, this.policeWarning, performance.now());
  }

  private drawPlaneWarning(): void {
    if (!this.world || !this.planeWarning) {
      return;
    }

    renderEdgeWarningIndicator(this.context, this.world.viewport, performance.now(), {
      edge: this.planeWarning.edge,
      label: 'NYOOM',
      colorOn: '#f9a8d4',
      colorOff: '#be185d',
      flashPeriodMs: 82,
      padding: 18,
    });
  }

  private drawFocusModeLayer(): void {
    if (!this.world || this.focusModeAlpha <= 0.01) {
      return;
    }

    const ctx = this.context;
    const { width, height } = this.world.viewport;
    const center = this.player ? rectCenter(this.player.getBounds()) : { x: width / 2, y: height / 2 };
    const radius = Math.max(width, height) * 0.72;

    ctx.save();
    const vignette = ctx.createRadialGradient(center.x, center.y, 44, center.x, center.y, radius);
    vignette.addColorStop(0, `rgba(56, 189, 248, ${0.05 * this.focusModeAlpha})`);
    vignette.addColorStop(0.45, `rgba(14, 116, 144, ${0.018 * this.focusModeAlpha})`);
    vignette.addColorStop(1, 'rgba(2, 6, 23, 0)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  private updateEffectTimers(dtSeconds: number): void {
    this.magnetTimerMs = Math.max(0, this.magnetTimerMs - dtSeconds * 1000);
    this.ghostTimerMs = Math.max(0, this.ghostTimerMs - dtSeconds * 1000);
    this.comboTimerMs = Math.max(0, this.comboTimerMs - dtSeconds * 1000);
    if (this.comboTimerMs === 0) {
      this.pickupComboCount = 0;
    }

    const wasInverted = this.invertTimerMs > 0;
    this.invertTimerMs = Math.max(0, this.invertTimerMs - dtSeconds * 1000);
    if (wasInverted && this.invertTimerMs === 0) {
      this.setInverted(false);
    }

    const wasBlackout = this.blackoutTimerMs > 0;
    this.blackoutTimerMs = Math.max(0, this.blackoutTimerMs - dtSeconds * 1000);
    if (wasBlackout && this.blackoutTimerMs === 0) {
      this.setBlackout(false);
    }
  }

  private updateFocusMode(dtSeconds: number): void {
    const target = this.isPoliceChasing() || this.policeWarning ? 0 : 1;
    const rate = target > this.focusModeAlpha ? 1.1 : 2.6;
    this.focusModeAlpha += (target - this.focusModeAlpha) * Math.min(1, dtSeconds * rate * 6);
  }

  private setInverted(active: boolean): void {
    if (this.invertActive === active) {
      return;
    }

    this.invertActive = active;
    this.setPageInverted(active);
  }

  private setBlackout(active: boolean): void {
    if (this.blackoutActive === active) {
      return;
    }

    this.blackoutActive = active;
    this.setPageBlackout(active);
  }

  private spawnEffectMessage(text: string, color: string, priority: ToastPriority = 'medium'): void {
    if (!this.player) {
      return;
    }

    const bounds = this.player.getBounds();
    const yOffset =
      priority === 'critical' ? 44 : priority === 'high' ? 34 : priority === 'medium' ? 26 : 18;
    this.toastSystem.enqueue({
      x: bounds.x + bounds.width / 2,
      y: bounds.y - yOffset,
      text,
      ttlMs: TOAST_EFFECT_TTL_MS,
      color,
      priority,
    });
  }

  private enqueueSpecialSpawnCue(pickup: WorldPickup): void {
    if (pickup.kind !== 'special') {
      return;
    }

    const center = rectCenter(pickup.rect);
    const durationMs = 1200;
    this.specialSpawnCues.push({
      x: center.x,
      y: center.y,
      label: pickup.label ?? 'FX',
      color: pickup.accentColor ?? '#f8fafc',
      ttlMs: durationMs,
      durationMs,
    });
    if (this.specialSpawnCues.length > 4) {
      this.specialSpawnCues.shift();
    }
  }

  private beginRun(reason: 'manual' | 'deadSpot' | 'caught'): void {
    this.dynamicPickups = [];
    this.coinSpawnQueue = [];
    this.coinSpawnIdCounter = 0;
    this.coinRefillTimerMs = 0;
    this.coinRefillBoostTimerMs = 0;
    this.toastSystem.clear();
    this.specialSpawnCues = [];
    this.planeBonusEvent = null;
    this.score = 0;
    this.coinsCollectedTotal = 0;
    this.specialSpawnTimerMs = randomBetween(SPECIAL_INITIAL_SPAWN_MIN_MS, SPECIAL_INITIAL_SPAWN_MAX_MS);
    this.planeBonusTimerMs = randomBetween(PLANE_EVENT_INITIAL_MIN_MS, PLANE_EVENT_INITIAL_MAX_MS);
    this.magnetTimerMs = 0;
    this.ghostTimerMs = 0;
    this.invertTimerMs = 0;
    this.blackoutTimerMs = 0;
    this.setInverted(false);
    this.setBlackout(false);
    this.setMagnetUiState({ active: false, point: null, strength: 0 });
    this.policeChase = null;
    this.policeWarning = null;
    this.planeWarning = null;
    this.policeSpawnTimerMs = randomBetween(POLICE_INITIAL_SPAWN_MIN_MS, POLICE_INITIAL_SPAWN_MAX_MS);
    this.pickupComboCount = 0;
    this.comboTimerMs = 0;
    this.gameOverState = null;
    this.spriteShowcaseActive = false;
    this.debugInput = null;
    this.startTimeMs = performance.now();
    this.applyWorld(this.createWorld(), true);
    this.lastFrameMs = 0;
    this.emitDebugEvent({
      type: 'restart',
      atMs: performance.now(),
      reason,
      score: this.score,
    });
  }

  private enterCaughtGameOver(): void {
    this.finishCurrentRun('caught');
    this.startTimeMs = 0;
    this.setInverted(false);
    this.setBlackout(false);
    this.setMagnetUiState({ active: false, point: null, strength: 0 });
    this.audio.stop();
    this.magnetTimerMs = 0;
    this.ghostTimerMs = 0;
    this.invertTimerMs = 0;
    this.blackoutTimerMs = 0;
    this.policeChase = null;
    this.policeWarning = null;
    this.planeWarning = null;
    this.pickupComboCount = 0;
    this.comboTimerMs = 0;
    this.spriteShowcaseActive = false;
    this.toastSystem.clear();
    this.specialSpawnCues = [];
    this.planeBonusEvent = null;
    this.resetInput();
    this.debugInput = null;
    this.gameOverState = {
      reason: 'caught',
      startedAtMs: performance.now(),
    };
  }

  private enterSpriteShowcaseMode(): void {
    this.spriteShowcaseActive = true;
    this.autoPickSpriteShowcaseTheme();
    this.audio.stop();
    this.setInverted(false);
    this.setBlackout(false);
    this.setMagnetUiState({ active: false, point: null, strength: 0 });
    this.magnetTimerMs = 0;
    this.ghostTimerMs = 0;
    this.invertTimerMs = 0;
    this.blackoutTimerMs = 0;
    this.policeChase = null;
    this.policeWarning = null;
    this.planeWarning = null;
    this.pickupComboCount = 0;
    this.comboTimerMs = 0;
    this.toastSystem.clear();
    this.specialSpawnCues = [];
    this.planeBonusEvent = null;
    this.resetInput();
    this.debugInput = null;
  }

  private drawGameOverScreen(): void {
    if (!this.world || !this.gameOverState) {
      return;
    }

    const ctx = this.context;
    const { width, height } = this.world.viewport;
    const flash = Math.sin((performance.now() - this.gameOverState.startedAtMs) / 240) > 0 ? 1 : 0.72;

    ctx.save();
    ctx.fillStyle = 'rgba(2, 6, 23, 0.94)';
    ctx.fillRect(0, 0, width, height);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = 'bold 18px "SFMono-Regular", "JetBrains Mono", monospace';
    ctx.fillStyle = '#f87171';
    ctx.fillText('BUSTED BY POLICE', width / 2, height / 2 - 82);

    ctx.font = 'bold 48px "SFMono-Regular", "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(96, 165, 250, 0.72)';
    ctx.fillText('GAME OVER', width / 2 + 3, height / 2 - 16);
    ctx.fillStyle = 'rgba(251, 113, 133, 0.78)';
    ctx.fillText('GAME OVER', width / 2 - 3, height / 2 - 16);
    ctx.fillStyle = '#f8fafc';
    ctx.fillText('GAME OVER', width / 2, height / 2 - 18);

    ctx.font = 'bold 16px "SFMono-Regular", "JetBrains Mono", monospace';
    ctx.fillStyle = '#fde68a';
    ctx.fillText(`SCORE ${this.score.toString().padStart(4, '0')}`, width / 2, height / 2 + 32);

    ctx.font = 'bold 14px "SFMono-Regular", "JetBrains Mono", monospace';
    ctx.fillStyle = `rgba(226, 232, 240, ${flash})`;
    ctx.fillText('PRESS SPACE TO RESTART', width / 2, height / 2 + 84);
    ctx.fillStyle = 'rgba(148, 163, 184, 0.9)';
    ctx.fillText('ESC TO QUIT', width / 2, height / 2 + 108);
    ctx.restore();
  }

  private getActiveEffects(currentSurface: SurfaceSample): HudState['activeEffects'] {
    const effects: HudState['activeEffects'] = [];

    if (this.magnetTimerMs > 0) {
      effects.push({
        effect: 'magnet',
        label: getSpecialHudLabel('magnet'),
        remainingMs: this.magnetTimerMs,
        durationMs: 6200,
        color: SPECIAL_COLORS.magnet,
      });
    }

    if (this.invertTimerMs > 0) {
      effects.push({
        effect: 'invert',
        label: getSpecialHudLabel('invert'),
        remainingMs: this.invertTimerMs,
        durationMs: 5200,
        color: SPECIAL_COLORS.invert,
      });
    }

    if (this.blackoutTimerMs > 0) {
      const blackoutHudEffect: Exclude<SpecialEffect, 'bonus'> =
        adaptBlackoutEffectForSurface('blackout', currentSurface) === 'invert'
          ? 'invert'
          : 'blackout';
      effects.push({
        effect: blackoutHudEffect,
        label: getSpecialHudLabel(blackoutHudEffect),
        remainingMs: this.blackoutTimerMs,
        durationMs: 4200,
        color: SPECIAL_COLORS[blackoutHudEffect],
      });
    }

    if (this.ghostTimerMs > 0) {
      effects.push({
        effect: 'ghost',
        label: getSpecialHudLabel('ghost'),
        remainingMs: this.ghostTimerMs,
        durationMs: 5600,
        color: SPECIAL_COLORS.ghost,
      });
    }

    if (this.isPoliceChasing() && this.policeChase) {
      effects.push({
        effect: 'police',
        label: 'POLICE',
        remainingMs: this.policeChase.remainingMs,
        durationMs: this.policeChase.durationMs,
        color: '#60a5fa',
      });
    }

    if (this.comboTimerMs > 0 && this.pickupComboCount >= 3) {
      effects.push({
        effect: 'flow',
        label: `FLOW x${this.pickupComboCount}`,
        remainingMs: this.comboTimerMs,
        durationMs: COMBO_WINDOW_MS,
        color: '#fb7185',
      });
    }

    return effects.sort((left, right) => right.remainingMs - left.remainingMs);
  }

  private emitDebugEvent(event: GameDebugEvent): void {
    this.onDebugEvent?.(event);
  }
}

const COMBO_WINDOW_MS = 2400;
const POLICE_WARNING_MS = 1100;
const PLANE_WARNING_MS = 900;
const REGULAR_COIN_SCORE = 10;
const REGULAR_COIN_STARTING_BATCH = 7;
const REGULAR_COIN_VISIBLE_CAP = 11;
const REGULAR_COIN_REFILL_MIN_MS = 1600;
const REGULAR_COIN_REFILL_MAX_MS = 2400;
const REGULAR_COIN_REFILL_FAST_MIN_MS = 900;
const REGULAR_COIN_REFILL_FAST_MAX_MS = 1400;
const REGULAR_COIN_REFILL_LOW_MIN_MS = 750;
const REGULAR_COIN_REFILL_LOW_MAX_MS = 1150;
const REGULAR_COIN_LOW_PRESSURE_THRESHOLD = 4;
const REGULAR_COIN_RETRY_MIN_MS = 550;
const REGULAR_COIN_RETRY_MAX_MS = 900;
const REGULAR_COIN_REFILL_BOOST_MS = 2200;
const TOAST_MAX_CHARS = 8;
const TOAST_MAX_VISIBLE = 8;
const TOAST_DUPLICATE_WINDOW_MS = 260;
const TOAST_PICKUP_TTL_MS = 700;
const TOAST_EFFECT_TTL_MS = 900;
const BONUS_SPECIAL_SCORE = 40;
const PLANE_BONUS_PICKUP_SIZE = 20;
const PLANE_EVENT_MIN_SCORE = 40;
const PLANE_EVENT_SPEED = 188;
const PLANE_EVENT_ENTRY_OFFSET = 56;
const PLANE_EVENT_CORNER_SPAN = 110;
const PLANE_EVENT_INITIAL_MIN_MS = 14000;
const PLANE_EVENT_INITIAL_MAX_MS = 22000;
const PLANE_EVENT_RESPAWN_MIN_MS = 17000;
const PLANE_EVENT_RESPAWN_MAX_MS = 25000;
const SPECIAL_VISIBLE_CAP = 2;
const SPECIAL_INITIAL_SPAWN_MIN_MS = 4800;
const SPECIAL_INITIAL_SPAWN_MAX_MS = 7600;
const SPECIAL_RESPAWN_MIN_MS = 6800;
const SPECIAL_RESPAWN_MAX_MS = 10600;
const SPECIAL_RETRY_MIN_MS = 2400;
const SPECIAL_RETRY_MAX_MS = 3600;
const SPECIAL_CAP_RETRY_MIN_MS = 2600;
const SPECIAL_CAP_RETRY_MAX_MS = 4200;
const POLICE_START_DELAY_MS = 12000;
const POLICE_START_SCORE_THRESHOLD = 30;
const POLICE_START_COINS_THRESHOLD = 6;
const POLICE_INITIAL_SPAWN_MIN_MS = 10000;
const POLICE_INITIAL_SPAWN_MAX_MS = 15000;
const POLICE_RESPAWN_MIN_MS = 11000;
const POLICE_RESPAWN_MAX_MS = 17000;
const POLICE_POST_SPAWN_MIN_MS = 13000;
const POLICE_POST_SPAWN_MAX_MS = 19000;
const POLICE_CHASE_DURATION_MIN_MS = 5600;
const POLICE_CHASE_DURATION_MAX_MS = 7800;
const ENCOUNTER_STAGGER_MS = 3200;
const PLANE_AFTER_POLICE_MIN_MS = 1600;
const PLANE_AFTER_POLICE_MAX_MS = 3200;
const POLICE_AFTER_PLANE_MIN_MS = 3600;
const POLICE_AFTER_PLANE_MAX_MS = 6200;
const POLICE_ICE_SPEED_MULTIPLIER = 1.08;
const POLICE_ICE_TURN_RATE = 3.6;
const BLACKOUT_INVERT_SWAP_LIGHTNESS = 0.28;
const PICKUP_WORDS = ['LGTM', 'MERGED', 'GREEN', 'SYNCED', 'SHIPPED', 'CACHE'];
const PICKUP_COLORS = ['#fde047', '#f9a8d4', '#67e8f9', '#fca5a5', '#86efac', '#c4b5fd'];
const SHOWCASE_TOAST_MESSAGES = [
  'LGTM',
  'MERGED',
  'GREEN',
  'SYNCED',
  'SHIPPED',
  'CACHE',
  'C-MAGD',
  'P-INVD',
  'V-GHOD',
  'S-BLKD',
  'R-BOND',
  'C-MAG',
  'P-INV',
  'V-GHO',
  'S-BLK',
  'R-BON+40',
  'FLOW X3',
  'FLOW X5',
  'FLOW X8',
  'FLOW X12',
  'WEE-OO',
  'POLICE!',
  'ESCAPED',
  'PLANE',
  'COUPE',
  'BUGGY',
  'TRUCK',
  'NYOOM',
] as const;
const SHOWCASE_THEMES: ShowcaseTheme[] = [
  {
    name: 'DARK',
    background: 'rgba(2, 6, 23, 0.96)',
    grid: 'rgba(100, 116, 139, 0.24)',
    title: '#f8fafc',
    subtitle: '#94a3b8',
    toastPanel: 'rgba(15, 23, 42, 0.72)',
    toastCard: 'rgba(2, 6, 23, 0.9)',
    toastStroke: '#67e8f9',
    toastText: '#67e8f9',
  },
  {
    name: 'STEEL',
    background: 'rgba(30, 41, 59, 0.96)',
    grid: 'rgba(148, 163, 184, 0.26)',
    title: '#f8fafc',
    subtitle: '#cbd5e1',
    toastPanel: 'rgba(15, 23, 42, 0.62)',
    toastCard: 'rgba(30, 41, 59, 0.92)',
    toastStroke: '#22d3ee',
    toastText: '#e2e8f0',
  },
  {
    name: 'MIST',
    background: 'rgba(241, 245, 249, 0.98)',
    grid: 'rgba(51, 65, 85, 0.22)',
    title: '#0f172a',
    subtitle: '#334155',
    toastPanel: 'rgba(203, 213, 225, 0.78)',
    toastCard: 'rgba(248, 250, 252, 0.95)',
    toastStroke: '#0ea5e9',
    toastText: '#0f172a',
  },
  {
    name: 'PAPER',
    background: 'rgba(255, 255, 255, 0.99)',
    grid: 'rgba(71, 85, 105, 0.2)',
    title: '#020617',
    subtitle: '#1e293b',
    toastPanel: 'rgba(226, 232, 240, 0.9)',
    toastCard: 'rgba(255, 255, 255, 0.96)',
    toastStroke: '#0284c7',
    toastText: '#0f172a',
  },
];

function pickOppositeShowcaseThemeIndex(pageLightness: number): number {
  const lightness = clamp(pageLightness, 0, 1);
  if (lightness >= 0.7) {
    return 0; // DARK
  }
  if (lightness >= 0.56) {
    return 1; // STEEL
  }
  if (lightness <= 0.24) {
    return 3; // PAPER
  }
  return 2; // MIST
}

const RANDOM_SPECIAL_EFFECTS: SpecialEffect[] = ['invert', 'magnet', 'ghost', 'blackout'];
const SPECIAL_LABELS: Record<SpecialEffect, string> = {
  bonus: 'BON',
  invert: 'INV',
  magnet: 'MAG',
  ghost: 'GHO',
  blackout: 'BLK',
};
const SPECIAL_COLORS: Record<SpecialEffect, string> = {
  bonus: '#f9a8d4',
  invert: '#f472b6',
  magnet: '#67e8f9',
  ghost: '#c4b5fd',
  blackout: '#334155',
};
const SPECIAL_COLOR_NAMES: Record<SpecialEffect, string> = {
  bonus: 'ROSE',
  invert: 'PINK',
  magnet: 'CYAN',
  ghost: 'VIOLET',
  blackout: 'SLATE',
};
const VEHICLE_DESIGNS: VehicleDesign[] = ['coupe', 'buggy', 'truck'];
const VEHICLE_LABELS: Record<VehicleDesign, string> = {
  coupe: 'COUPE',
  buggy: 'BUGGY',
  truck: 'TRUCK',
};

function cloneWorld(world: World): World {
  return {
    viewport: { ...world.viewport },
    obstacles: world.obstacles.map(cloneRect),
    slowZones: world.slowZones.map(cloneRect),
    iceZones: world.iceZones.map(cloneRect),
    hazards: world.hazards.map(cloneRect),
    deadSpots: world.deadSpots.map(cloneRect),
    boosts: world.boosts.map(cloneRect),
    pickups: world.pickups.map(clonePickup),
    spawnPoint: { ...world.spawnPoint },
    scannedCount: world.scannedCount,
  };
}

function clonePickup(pickup: WorldPickup): WorldPickup {
  return {
    id: pickup.id,
    sourceId: pickup.sourceId,
    value: pickup.value,
    rect: cloneRect(pickup.rect),
    kind: pickup.kind,
    effect: pickup.effect,
    accentColor: pickup.accentColor,
    label: pickup.label,
  };
}

function cloneRect(rect: Rect): Rect {
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  };
}

function getPoliceRect(policeChase: PoliceChaseState): Rect {
  return {
    x: policeChase.x,
    y: policeChase.y,
    width: POLICE_CAR_SIZE.width,
    height: POLICE_CAR_SIZE.height,
  };
}

function getRandomPoliceEdge(): PoliceEdge {
  const edge = Math.floor(Math.random() * 4);
  switch (edge) {
    case 0:
      return 'top';
    case 1:
      return 'right';
    case 2:
      return 'bottom';
    default:
      return 'left';
  }
}

function getNearestPoliceExitEdge(viewport: World['viewport'], policeChase: PoliceChaseState): PoliceEdge {
  const center = rectCenter(getPoliceRect(policeChase));
  const distances = [
    { edge: 'top' as const, distance: center.y },
    { edge: 'right' as const, distance: viewport.width - center.x },
    { edge: 'bottom' as const, distance: viewport.height - center.y },
    { edge: 'left' as const, distance: center.x },
  ];

  distances.sort((left, right) => left.distance - right.distance);
  return distances[0].edge;
}

function getPoliceExitTarget(
  viewport: World['viewport'],
  policeChase: PoliceChaseState,
): { x: number; y: number } {
  const center = rectCenter(getPoliceRect(policeChase));

  switch (policeChase.exitEdge) {
    case 'top':
      return { x: center.x, y: -POLICE_CAR_SIZE.height - 36 };
    case 'right':
      return { x: viewport.width + POLICE_CAR_SIZE.width + 36, y: center.y };
    case 'bottom':
      return { x: center.x, y: viewport.height + POLICE_CAR_SIZE.height + 36 };
    default:
      return { x: -POLICE_CAR_SIZE.width - 36, y: center.y };
  }
}

function isPoliceOffscreen(
  viewport: World['viewport'],
  policeChase: PoliceChaseState,
  padding: number,
): boolean {
  const rect = getPoliceRect(policeChase);
  return (
    rect.x + rect.width < -padding ||
    rect.y + rect.height < -padding ||
    rect.x > viewport.width + padding ||
    rect.y > viewport.height + padding
  );
}

function createPlaneCornerPath(viewport: World['viewport']): { start: Vector2; end: Vector2 } {
  const startCorner = getRandomPlaneCorner();
  const endCorner = getOppositePlaneCorner(startCorner);
  return {
    start: getPlaneCornerPoint(viewport, startCorner),
    end: getPlaneCornerPoint(viewport, endCorner),
  };
}

function getRandomPlaneCorner(): PlaneCorner {
  const corner = Math.floor(Math.random() * 4);
  switch (corner) {
    case 0:
      return 'top-left';
    case 1:
      return 'top-right';
    case 2:
      return 'bottom-right';
    default:
      return 'bottom-left';
  }
}

function getOppositePlaneCorner(corner: PlaneCorner): PlaneCorner {
  switch (corner) {
    case 'top-left':
      return 'bottom-right';
    case 'top-right':
      return 'bottom-left';
    case 'bottom-right':
      return 'top-left';
    case 'bottom-left':
      return 'top-right';
  }
}

function getPlaneCornerPoint(viewport: World['viewport'], corner: PlaneCorner): Vector2 {
  const outside = PLANE_EVENT_ENTRY_OFFSET;
  const xSpan = Math.min(PLANE_EVENT_CORNER_SPAN, viewport.width * 0.26);
  const ySpan = Math.min(PLANE_EVENT_CORNER_SPAN, viewport.height * 0.26);
  const useHorizontalEdge = Math.random() < 0.5;

  switch (corner) {
    case 'top-left':
      return useHorizontalEdge
        ? { x: randomBetween(-outside, xSpan), y: -outside }
        : { x: -outside, y: randomBetween(-outside, ySpan) };
    case 'top-right':
      return useHorizontalEdge
        ? { x: randomBetween(viewport.width - xSpan, viewport.width + outside), y: -outside }
        : { x: viewport.width + outside, y: randomBetween(-outside, ySpan) };
    case 'bottom-right':
      return useHorizontalEdge
        ? {
            x: randomBetween(viewport.width - xSpan, viewport.width + outside),
            y: viewport.height + outside,
          }
        : {
            x: viewport.width + outside,
            y: randomBetween(viewport.height - ySpan, viewport.height + outside),
          };
    case 'bottom-left':
      return useHorizontalEdge
        ? { x: randomBetween(-outside, xSpan), y: viewport.height + outside }
        : { x: -outside, y: randomBetween(viewport.height - ySpan, viewport.height + outside) };
  }
}

function isPointOutsideViewport(
  viewport: World['viewport'],
  x: number,
  y: number,
  padding: number,
): boolean {
  return x < -padding || y < -padding || x > viewport.width + padding || y > viewport.height + padding;
}

function getPlaneEntryEdge(viewport: World['viewport'], point: Vector2): PoliceEdge {
  const distances = [
    { edge: 'top' as const, distance: point.y },
    { edge: 'right' as const, distance: viewport.width - point.x },
    { edge: 'bottom' as const, distance: viewport.height - point.y },
    { edge: 'left' as const, distance: point.x },
  ];
  distances.sort((left, right) => left.distance - right.distance);
  return distances[0].edge;
}

function getPoliceSpawn(viewport: World['viewport'], edge: PoliceEdge): Pick<PoliceChaseState, 'x' | 'y' | 'angle'> {
  switch (edge) {
    case 'top':
      return {
        x: randomBetween(24, viewport.width - POLICE_CAR_SIZE.width - 24),
        y: -POLICE_CAR_SIZE.height - 12,
        angle: Math.PI / 2,
      };
    case 'right':
      return {
        x: viewport.width + 12,
        y: randomBetween(20, viewport.height - POLICE_CAR_SIZE.height - 20),
        angle: Math.PI,
      };
    case 'bottom':
      return {
        x: randomBetween(24, viewport.width - POLICE_CAR_SIZE.width - 24),
        y: viewport.height + 12,
        angle: -Math.PI / 2,
      };
    default:
      return {
        x: -POLICE_CAR_SIZE.width - 12,
        y: randomBetween(20, viewport.height - POLICE_CAR_SIZE.height - 20),
        angle: 0,
      };
  }
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function blendAngle(current: number, target: number, blend: number): number {
  const normalizedBlend = clamp(blend, 0, 1);
  let delta = target - current;
  while (delta > Math.PI) {
    delta -= Math.PI * 2;
  }
  while (delta < -Math.PI) {
    delta += Math.PI * 2;
  }
  return current + delta * normalizedBlend;
}

function shufflePickups(pickups: WorldPickup[]): WorldPickup[] {
  const shuffled = pickups.map((pickup) => ({
    ...clonePickup(pickup),
    sourceId: pickup.sourceId ?? pickup.id,
  }));
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function isSpecialPickup(pickup: WorldPickup): boolean {
  return pickup.kind === 'special';
}

function pickSpecialEffect(surface: SurfaceSample): SpecialEffect {
  const preferredEffect =
    surface.hasGradient || surface.saturation >= 0.52
      ? 'invert'
      : surface.lightness <= 0.18
        ? 'blackout'
        : surface.lightness <= 0.34
          ? 'ghost'
          : 'magnet';

  if (Math.random() < 0.58) {
    return preferredEffect;
  }

  const alternatives = RANDOM_SPECIAL_EFFECTS.filter((effect) => effect !== preferredEffect);
  return alternatives[Math.floor(Math.random() * alternatives.length)];
}

function adaptBlackoutEffectForSurface(effect: SpecialEffect, surface: SurfaceSample): SpecialEffect {
  if (effect === 'blackout' && surface.lightness <= BLACKOUT_INVERT_SWAP_LIGHTNESS) {
    return 'invert';
  }
  return effect;
}

function getSpecialColor(effect: SpecialEffect): string {
  return SPECIAL_COLORS[effect];
}

function getSpecialLabel(effect: SpecialEffect): string {
  return SPECIAL_LABELS[effect];
}

function getSpecialColorName(effect: SpecialEffect): string {
  return SPECIAL_COLOR_NAMES[effect];
}

function getSpecialDropMessage(effect: SpecialEffect): string {
  const colorCode = getSpecialColorName(effect).slice(0, 1);
  return `${colorCode}-${getSpecialLabel(effect)}D`;
}

function getSpecialHudLabel(effect: Exclude<SpecialEffect, 'bonus'>): string {
  switch (effect) {
    case 'magnet':
      return 'MAGNET CYAN';
    case 'invert':
      return 'INVERT PINK';
    case 'ghost':
      return 'GHOST VIOLET';
    case 'blackout':
      return 'BLACKOUT SLATE';
  }
}

function getSpecialActivationMessage(effect: SpecialEffect): string {
  switch (effect) {
    case 'bonus':
      return `R-BON+${BONUS_SPECIAL_SCORE}`;
    case 'magnet':
      return 'C-MAG';
    case 'invert':
      return 'P-INV';
    case 'ghost':
      return 'V-GHO';
    case 'blackout':
      return 'S-BLK';
  }
}

function getNextVehicleDesign(current: VehicleDesign): VehicleDesign {
  const currentIndex = VEHICLE_DESIGNS.indexOf(current);
  const nextIndex = (currentIndex + 1) % VEHICLE_DESIGNS.length;
  return VEHICLE_DESIGNS[nextIndex];
}

function getVehicleDesignLabel(design: VehicleDesign): string {
  return VEHICLE_LABELS[design];
}

function isModifierKey(code: string): boolean {
  return code === 'ShiftLeft' || code === 'ShiftRight' || code === 'ControlLeft' || code === 'ControlRight' || code === 'AltLeft' || code === 'AltRight' || code === 'MetaLeft' || code === 'MetaRight';
}

function getFlavorText(state: {
  score: number;
  airborne: boolean;
  boostActive: boolean;
  magnetActive: boolean;
  ghostActive: boolean;
  invertActive: boolean;
  blackoutActive: boolean;
  policeActive: boolean;
}): string {
  if (state.policeActive) {
    return 'Sirens up. Do not get audited by the law.';
  }

  if (state.blackoutActive) {
    return 'Blackout active. Follow HUD and coin glints.';
  }

  if (state.invertActive) {
    return 'Reality flipped. Keep the rubber side up.';
  }

  if (state.magnetActive) {
    return 'Money is suddenly very into you.';
  }

  if (state.ghostActive) {
    return 'Ghost mode: no slow and no police lock.';
  }

  if (state.airborne) {
    return 'Illegal parking. Legal airtime.';
  }

  if (state.boostActive) {
    return 'Turbo engaged. HR is nervous.';
  }

  if (state.score >= 150) {
    return 'Certified page goblin.';
  }

  if (state.score >= 60) {
    return 'Looting links with intent.';
  }

  if (state.score > 0) {
    return 'A tasteful amount of chaos.';
  }

  return 'Drive like the DOM owes you money.';
}
