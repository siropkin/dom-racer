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
import {
  createPlaneBoostLaneRects,
  createPlaneCornerPath,
  getNearestPoliceExitEdge,
  getPlaneEntryEdge,
  getPoliceExitTarget,
  getPoliceRect,
  getPoliceSpawn,
  getRandomPoliceEdge,
  isPointOutsideViewport,
  isPoliceOffscreen,
} from './encounterRuntime';
import { renderPlaneSprite } from './planeSprite';
import {
  POLICE_CAR_SIZE,
  renderEdgeWarningIndicator,
  renderPoliceCarSprite,
  renderPoliceWarningIndicator,
  type PoliceEdge,
} from './policeSprite';
import { drawCaughtGameOverOverlay, drawSpriteShowcaseOverlay } from './gameOverlays';
import { drawRegularCoinSprite, drawSpecialPickupSprite } from './pickupSprites';
import { Player } from './player';
import {
  adaptBlackoutEffectForSurface,
  blendAngle,
  BONUS_SPECIAL_SCORE,
  clonePickup,
  cloneRect,
  cloneWorld,
  COMBO_WINDOW_MS,
  ENCOUNTER_STAGGER_MS,
  getFlavorText,
  getNextVehicleDesign,
  getSpecialActivationMessage,
  getSpecialColor,
  getSpecialDropMessage,
  getSpecialHudLabel,
  getSpecialLabel,
  getVehicleDesignLabel,
  isModifierKey,
  isSpecialPickup,
  pickOppositeShowcaseThemeIndex,
  pickSpecialEffect,
  PICKUP_COLORS,
  PICKUP_WORDS,
  PLANE_AFTER_POLICE_MAX_MS,
  PLANE_AFTER_POLICE_MIN_MS,
  PLANE_BONUS_PICKUP_SIZE,
  PLANE_BOOST_LANE_CHANCE,
  PLANE_BOOST_LANE_DURATION_MS,
  PLANE_EVENT_INITIAL_MAX_MS,
  PLANE_EVENT_INITIAL_MIN_MS,
  PLANE_EVENT_MIN_SCORE,
  PLANE_EVENT_RESPAWN_MAX_MS,
  PLANE_EVENT_RESPAWN_MIN_MS,
  PLANE_EVENT_SPEED,
  PLANE_LANE_SPECIAL_STAGGER_MS,
  PLANE_WARNING_MS,
  POLICE_AFTER_PLANE_MAX_MS,
  POLICE_AFTER_PLANE_MIN_MS,
  POLICE_CHASE_DURATION_MAX_MS,
  POLICE_CHASE_DURATION_MIN_MS,
  POLICE_ICE_SPEED_MULTIPLIER,
  POLICE_ICE_TURN_RATE,
  POLICE_INITIAL_SPAWN_MAX_MS,
  POLICE_INITIAL_SPAWN_MIN_MS,
  POLICE_POST_SPAWN_MAX_MS,
  POLICE_POST_SPAWN_MIN_MS,
  POLICE_RESPAWN_MAX_MS,
  POLICE_RESPAWN_MIN_MS,
  POLICE_START_COINS_THRESHOLD,
  POLICE_START_DELAY_MS,
  POLICE_START_SCORE_THRESHOLD,
  POLICE_WARNING_MS,
  randomBetween,
  REGULAR_COIN_LOW_PRESSURE_THRESHOLD,
  REGULAR_COIN_REFILL_BOOST_MS,
  REGULAR_COIN_REFILL_FAST_MAX_MS,
  REGULAR_COIN_REFILL_FAST_MIN_MS,
  REGULAR_COIN_REFILL_LOW_MAX_MS,
  REGULAR_COIN_REFILL_LOW_MIN_MS,
  REGULAR_COIN_REFILL_MAX_MS,
  REGULAR_COIN_REFILL_MIN_MS,
  REGULAR_COIN_RETRY_MAX_MS,
  REGULAR_COIN_RETRY_MIN_MS,
  REGULAR_COIN_SCORE,
  REGULAR_COIN_STARTING_BATCH,
  REGULAR_COIN_VISIBLE_CAP,
  SHOWCASE_THEMES,
  shufflePickups,
  SPECIAL_CAP_RETRY_MAX_MS,
  SPECIAL_CAP_RETRY_MIN_MS,
  SPECIAL_INITIAL_SPAWN_MAX_MS,
  SPECIAL_INITIAL_SPAWN_MIN_MS,
  SPECIAL_RESPAWN_MAX_MS,
  SPECIAL_RESPAWN_MIN_MS,
  SPECIAL_RETRY_MAX_MS,
  SPECIAL_RETRY_MIN_MS,
  SPECIAL_VISIBLE_CAP,
  TOAST_DUPLICATE_WINDOW_MS,
  TOAST_EFFECT_TTL_MS,
  TOAST_MAX_CHARS,
  TOAST_MAX_VISIBLE,
  TOAST_PICKUP_TTL_MS,
  type SurfaceSample,
} from './gameRuntime';
import { ToastSystem, type ToastPriority } from './toastSystem';
import { clamp, rectCenter, rectsIntersect } from '../shared/utils';

export type ScrollDirection = 'up' | 'down';

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
  effectMode: 'bonus-drop' | 'boost-lane';
}

interface PlaneBoostLaneState {
  rects: Rect[];
  ttlMs: number;
  durationMs: number;
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
  private planeBoostLane: PlaneBoostLaneState | null;
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
    this.planeBoostLane = null;
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
    this.planeBoostLane = null;
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
    this.updatePlaneBoostLane(dtSeconds);

    const currentBounds = this.player.getBounds();
    const boosting = isBoosting(currentBounds, this.getActiveBoostZones());
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
    this.drawPlaneBoostLane();
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
      ctx.fillStyle = cue.label === getSpecialLabel('blackout') ? '#e2e8f0' : cue.color;
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

  private drawPlaneBoostLane(): void {
    if (!this.planeBoostLane) {
      return;
    }

    const ctx = this.context;
    const lane = this.planeBoostLane;
    const now = performance.now();
    const life = Math.max(0, Math.min(1, lane.ttlMs / Math.max(1, lane.durationMs)));
    const pulse = 0.86 + Math.sin(now / 130) * 0.14;

    ctx.save();
    for (const [index, rect] of lane.rects.entries()) {
      const shimmer = 0.82 + Math.sin(now / 94 + index * 0.74) * 0.18;
      const alpha = Math.max(0.06, life * 0.24 * pulse * shimmer);
      ctx.fillStyle = `rgba(56, 189, 248, ${alpha})`;
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
      ctx.strokeStyle = `rgba(186, 230, 253, ${Math.max(0.18, life * 0.56)})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.width - 1, rect.height - 1);
    }
    ctx.restore();
  }

  private drawSpriteShowcase(): void {
    if (!this.world) {
      return;
    }
    drawSpriteShowcaseOverlay({
      ctx: this.context,
      viewport: this.world.viewport,
      nowMs: performance.now(),
      themeIndex: this.spriteShowcaseThemeIndex,
      pageLightness: this.spriteShowcasePageLightness,
    });
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

    if (this.planeBoostLane) {
      // Keep lane moments readable by delaying ambient specials a bit.
      this.specialSpawnTimerMs = Math.max(this.specialSpawnTimerMs, PLANE_LANE_SPECIAL_STAGGER_MS);
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
        effectMode: Math.random() < PLANE_BOOST_LANE_CHANCE ? 'boost-lane' : 'bonus-drop',
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
        if (this.planeBonusEvent.effectMode === 'boost-lane') {
          const spawnedLane = this.spawnPlaneBoostLane(
            this.planeBonusEvent.x,
            this.planeBonusEvent.y + 12,
            this.planeBonusEvent.vx,
            this.planeBonusEvent.vy,
          );
          if (!spawnedLane) {
            this.spawnPlaneBonusDrop(this.planeBonusEvent.x, this.planeBonusEvent.y + 14);
          }
        } else {
          this.spawnPlaneBonusDrop(this.planeBonusEvent.x, this.planeBonusEvent.y + 14);
        }
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

  private spawnPlaneBoostLane(x: number, y: number, vx: number, vy: number): boolean {
    if (!this.world) {
      return false;
    }

    const laneRects = createPlaneBoostLaneRects(this.world.viewport, { x, y }, { x: vx, y: vy });
    if (laneRects.length === 0) {
      return false;
    }

    this.planeBoostLane = {
      rects: laneRects,
      ttlMs: PLANE_BOOST_LANE_DURATION_MS,
      durationMs: PLANE_BOOST_LANE_DURATION_MS,
    };
    this.specialSpawnTimerMs = Math.max(this.specialSpawnTimerMs, PLANE_LANE_SPECIAL_STAGGER_MS);
    this.audio.playPlaneDrop();
    this.spawnEffectMessage('JET LANE', '#7dd3fc', 'high');
    return true;
  }

  private updatePlaneBoostLane(dtSeconds: number): void {
    if (!this.planeBoostLane) {
      return;
    }

    this.planeBoostLane.ttlMs = Math.max(0, this.planeBoostLane.ttlMs - dtSeconds * 1000);
    if (this.planeBoostLane.ttlMs === 0) {
      this.planeBoostLane = null;
    }
  }

  private getActiveBoostZones(): Rect[] {
    if (!this.world) {
      return [];
    }

    if (!this.planeBoostLane) {
      return this.world.boosts;
    }

    return [...this.world.boosts, ...this.planeBoostLane.rects];
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
        this.spawnEffectMessage(getSpecialActivationMessage('bonus'), getSpecialColor('bonus'), 'high');
        return;
      case 'invert':
        this.invertTimerMs = 5200;
        this.setInverted(true);
        this.spawnEffectMessage(getSpecialActivationMessage('invert'), getSpecialColor('invert'), 'high');
        return;
      case 'magnet':
        this.magnetTimerMs = 6200;
        this.spawnEffectMessage(getSpecialActivationMessage('magnet'), getSpecialColor('magnet'), 'high');
        return;
      case 'ghost':
        this.ghostTimerMs = 5600;
        this.spawnEffectMessage(getSpecialActivationMessage('ghost'), getSpecialColor('ghost'), 'high');
        return;
      case 'blackout':
        this.blackoutTimerMs = 4200;
        this.setBlackout(true);
        this.spawnEffectMessage(getSpecialActivationMessage('blackout'), getSpecialColor('blackout'), 'high');
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
    this.planeBoostLane = null;
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
    this.planeBoostLane = null;
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
    this.planeBoostLane = null;
    this.resetInput();
    this.debugInput = null;
  }

  private drawGameOverScreen(): void {
    if (!this.world || !this.gameOverState) {
      return;
    }
    drawCaughtGameOverOverlay({
      ctx: this.context,
      viewport: this.world.viewport,
      nowMs: performance.now(),
      startedAtMs: this.gameOverState.startedAtMs,
      score: this.score,
    });
  }

  private getActiveEffects(currentSurface: SurfaceSample): HudState['activeEffects'] {
    const effects: HudState['activeEffects'] = [];

    if (this.magnetTimerMs > 0) {
      effects.push({
        effect: 'magnet',
        label: getSpecialHudLabel('magnet'),
        remainingMs: this.magnetTimerMs,
        durationMs: 6200,
        color: getSpecialColor('magnet'),
      });
    }

    if (this.invertTimerMs > 0) {
      effects.push({
        effect: 'invert',
        label: getSpecialHudLabel('invert'),
        remainingMs: this.invertTimerMs,
        durationMs: 5200,
        color: getSpecialColor('invert'),
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
        color: getSpecialColor(blackoutHudEffect),
      });
    }

    if (this.ghostTimerMs > 0) {
      effects.push({
        effect: 'ghost',
        label: getSpecialHudLabel('ghost'),
        remainingMs: this.ghostTimerMs,
        durationMs: 5600,
        color: getSpecialColor('ghost'),
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
