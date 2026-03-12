import type {
  InputState,
  Rect,
  SpecialEffect,
  Vector2,
  VehicleDesign,
  World,
  WorldPickup,
} from '../shared/types';
import type {
  GameOptions,
  GameOverState,
  PlaneBonusEventState,
  PlaneBoostLaneState,
  PlaneCoinTrailState,
  PlaneWarningState,
  PoliceChaseState,
  PoliceWarningState,
  SpecialSpawnCue,
} from './gameStateTypes';
import { AudioManager } from './audio';
import { drawHud } from './hud';
import { collidesWithAny } from './collisions';
import { isBoosting, isOnDeadSpot, isOnIceZone, isOnSlowZone } from './pickups';
import { resolvePickupCollectionStep } from './gameEconomyRuntime';
import {
  advancePlaneBonusEventState,
  advancePoliceChasing,
  advancePoliceLeaving,
  beginPoliceLeaving,
  createPlaneBonusEncounter,
  createPoliceChase,
  createPlaneBoostLaneRects,
  createPlaneCoinTrailRects,
  getPoliceRect,
  isPoliceOffscreen,
  tickPlaneBoostLaneState,
  tickPlaneWarningState,
  tickPoliceChaseDuration,
  tickPoliceSpawnCountdown,
} from './encounterRuntime';
import {
  drawFocusModeLayer,
  drawPickups,
  drawPlaneBoostLane,
  drawPlaneBonusEvent,
  drawSpecialSpawnCues,
} from './gameRenderRuntime';
import {
  BLACKOUT_EFFECT_DURATION_MS,
  applyPickupComboState,
  GHOST_EFFECT_DURATION_MS,
  INVERT_EFFECT_DURATION_MS,
  MAGNET_EFFECT_DURATION_MS,
  tickEffectTimers,
} from './gameEffectsRuntime';
import { buildHudState, isDriveInputActive } from './gameHudAudioRuntime';
import {
  createBeginRunState,
  createCaughtGameOverTransitionState,
  createClearedComboState,
  createClearedEffectState,
  createClearedEncounterState,
  createSpriteShowcaseTransitionState,
} from './gameRunStateRuntime';
import {
  renderEdgeWarningIndicator,
  renderPoliceCarSprite,
  renderPoliceWarningIndicator,
} from './policeSprite';
import {
  getCoinRefillDelayMs,
  canSpawnRegularCoinRect,
  findFreePickupRect,
  findFreePickupRectNear,
  spawnQueuedCoinsFromAnchors,
} from './pickupSpawnRuntime';
import { drawCaughtGameOverOverlay, drawSpriteShowcaseOverlay } from './gameOverlays';
import { Player } from './player';
import {
  adaptBlackoutEffectForSurface,
  BONUS_SPECIAL_SCORE,
  clonePickup,
  cloneWorld,
  ENCOUNTER_STAGGER_MS,
  getNextVehicleDesign,
  getSpecialActivationMessage,
  getSpecialColor,
  getSpecialDropMessage,
  getSpecialLabel,
  getVehicleDesignLabel,
  isSpecialPickup,
  pickOppositeShowcaseThemeIndex,
  pickSpecialEffect,
  PICKUP_COLORS,
  PICKUP_WORDS,
  PLANE_AFTER_POLICE_MAX_MS,
  PLANE_AFTER_POLICE_MIN_MS,
  PLANE_BONUS_PICKUP_SIZE,
  PLANE_BOOST_LANE_DURATION_MS,
  PLANE_COIN_TRAIL_DURATION_MS,
  PLANE_EVENT_INITIAL_MAX_MS,
  PLANE_EVENT_INITIAL_MIN_MS,
  PLANE_EVENT_MIN_SCORE,
  PLANE_EVENT_RESPAWN_MAX_MS,
  PLANE_EVENT_RESPAWN_MIN_MS,
  PLANE_LUCKY_WIND_MAX_COINS,
  PLANE_LUCKY_WIND_MAX_SHIFT_PX,
  PLANE_LUCKY_WIND_RADIUS_PX,
  PLANE_LUCKY_WIND_ROUTE_HALF_SPAN_PX,
  PLANE_LANE_SPECIAL_STAGGER_MS,
  PLANE_POLICE_DELAY_MAX_MS,
  PLANE_POLICE_DELAY_MIN_MS,
  PLANE_SPOTLIGHT_CUE_DURATION_MS,
  POLICE_AFTER_PLANE_MAX_MS,
  POLICE_AFTER_PLANE_MIN_MS,
  POLICE_INITIAL_SPAWN_MAX_MS,
  POLICE_INITIAL_SPAWN_MIN_MS,
  POLICE_POST_SPAWN_MAX_MS,
  POLICE_POST_SPAWN_MIN_MS,
  POLICE_RESPAWN_MAX_MS,
  POLICE_RESPAWN_MIN_MS,
  POLICE_START_COINS_THRESHOLD,
  POLICE_START_DELAY_MS,
  POLICE_START_SCORE_THRESHOLD,
  randomBetween,
  REGULAR_COIN_REFILL_BOOST_MS,
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
import {
  cloneInputState,
  resolveKeyDownAction,
  resolveKeyUpConsumed,
  resetInputState,
} from './gameInputRuntime';
import {
  advancePlaneCoinTrailState,
  advancePoliceDelayCueState,
  createPoliceDelayCueState,
  dispatchPlaneDropWithFallback,
} from './planeDropRuntime';
import { ToastSystem, type ToastPriority } from './toastSystem';
import { clamp, rectCenter, rectsIntersect } from '../shared/utils';

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
  private audio: AudioManager;
  private soundEnabled: boolean;
  private vehicleDesign: VehicleDesign;
  private player: Player | null;
  private world: World | null;
  private input: InputState;
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
  private planeCoinTrail: PlaneCoinTrailState | null;
  private policeDelayCueTimerMs: number;
  private policeDelayCueDurationMs: number;
  private planeBonusTimerMs: number;
  private pickupFlavorIndex: number;
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
    this.planeCoinTrail = null;
    this.policeDelayCueTimerMs = 0;
    this.policeDelayCueDurationMs = 0;
    this.planeBonusTimerMs = randomBetween(PLANE_EVENT_INITIAL_MIN_MS, PLANE_EVENT_INITIAL_MAX_MS);
    this.pickupFlavorIndex = 0;
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
    this.clearEncounterRuntimeState();
    this.clearPoliceDelayCue();
    this.resetComboState();
    this.gameOverState = null;
    this.spriteShowcaseActive = false;
    this.toastSystem.clear();
    this.resetInput();
  }

  restart(): void {
    this.restartWithReason('manual');
  }

  setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    this.audio.setEnabled(enabled);
  }

  setVehicleDesign(design: VehicleDesign): void {
    this.vehicleDesign = design;
    this.player?.setVehicleDesign(design);
  }

  private restartWithReason(reason: 'manual' | 'deadSpot' | 'caught'): void {
    this.finishCurrentRun(reason);
    this.beginRun();
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
      const unsafe =
        !this.player.isAirborne() &&
        (collidesWithAny(currentBounds, world.deadSpots) || collidesWithAny(currentBounds, world.hazards));
      if (blocked || unsafe) {
        this.player.reset(world.spawnPoint);
      }
    }

    this.spawnQueuedCoins(REGULAR_COIN_STARTING_BATCH);
    const visibleRegularCoins = this.world.pickups.filter((pickup) => !isSpecialPickup(pickup)).length;
    this.coinRefillTimerMs = getCoinRefillDelayMs(visibleRegularCoins, this.coinRefillBoostTimerMs);
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
    this.updatePlaneCoinTrail(dtSeconds);
    this.updatePoliceDelayCue(dtSeconds);

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
    void this.audio.updateEngine(
      this.player.getLastStepDiagnostics().speed,
      isDriveInputActive(activeInput),
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

    const pickupStep = resolvePickupCollectionStep({
      playerBounds,
      worldPickups: this.world.pickups,
      dynamicPickups: this.dynamicPickups,
    });
    this.world.pickups = pickupStep.remainingPickups;
    this.dynamicPickups = pickupStep.dynamicPickups;
    this.score += pickupStep.scoreGained;
    for (const pickup of pickupStep.collectedPickups) {
      this.audio.playPickup();
      if (isSpecialPickup(pickup) && pickup.effect) {
        this.activateSpecialEffect(pickup.effect);
      } else {
        this.spawnCoinPickupMessage(pickup);
        this.coinsCollectedTotal += 1;
        this.score += this.applyPickupComboBonus();
        this.coinRefillBoostTimerMs = REGULAR_COIN_REFILL_BOOST_MS;
      }
      this.pageBestScore = Math.max(this.pageBestScore, this.score);
      this.lifetimeBestScore = Math.max(this.lifetimeBestScore, this.score);
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
    drawFocusModeLayer(
      ctx,
      this.world.viewport,
      this.player ? rectCenter(this.player.getBounds()) : null,
      this.focusModeAlpha,
    );
    drawPlaneBoostLane(ctx, this.planeBoostLane, performance.now());
    drawPlaneBonusEvent(ctx, this.planeBonusEvent, performance.now());
    drawSpecialSpawnCues(ctx, this.specialSpawnCues, getSpecialLabel('blackout'));
    drawPickups(ctx, this.world.pickups, this.comboTimerMs, this.pickupComboCount, performance.now());
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
    const policeRemainingMs = this.isPoliceChasing() && this.policeChase ? this.policeChase.remainingMs : null;
    const policeDurationMs = this.isPoliceChasing() && this.policeChase ? this.policeChase.durationMs : null;
    const hudState = buildHudState({
      score: this.score,
      elapsedMs: performance.now() - this.startTimeMs,
      pageTitle: this.getPageTitle(),
      pickupsRemaining: this.world.pickups.length,
      scannedCount: this.world.scannedCount,
      airborne: this.player.isAirborne(),
      boostActive: this.player.isBoostActive(),
      soundEnabled: this.soundEnabled,
      pageBestScore: this.pageBestScore,
      lifetimeBestScore: this.lifetimeBestScore,
      magnetTimerMs: this.magnetTimerMs,
      ghostTimerMs: this.ghostTimerMs,
      invertTimerMs: this.invertTimerMs,
      blackoutTimerMs: this.blackoutTimerMs,
      policeDelayCueTimerMs: this.policeDelayCueTimerMs,
      policeDelayCueDurationMs: this.policeDelayCueDurationMs,
      comboTimerMs: this.comboTimerMs,
      pickupComboCount: this.pickupComboCount,
      policeRemainingMs,
      policeDurationMs,
      policeActive: this.isPoliceChasing(),
      currentSurface,
    });
    drawHud(ctx, this.world.viewport, hudState);
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

    const action = resolveKeyDownAction(
      {
        gameOverActive: Boolean(this.gameOverState),
        spriteShowcaseActive: this.spriteShowcaseActive,
      },
      {
        code: event.code,
        shiftKey: event.shiftKey,
        repeat: event.repeat,
      },
      this.input,
    );

    switch (action.kind) {
      case 'none':
        return;
      case 'quit':
        void this.audio.resume();
        event.stopImmediatePropagation();
        event.preventDefault();
        this.onQuit();
        return;
      case 'game-over-restart':
        void this.audio.resume();
        event.stopImmediatePropagation();
        event.preventDefault();
        this.beginRun();
        return;
      case 'toggle-showcase':
        void this.audio.resume();
        event.stopImmediatePropagation();
        event.preventDefault();
        if (this.spriteShowcaseActive) {
          this.spriteShowcaseActive = false;
          this.beginRun();
        } else {
          this.enterSpriteShowcaseMode();
        }
        return;
      case 'cycle-showcase-theme':
        event.stopImmediatePropagation();
        event.preventDefault();
        this.cycleSpriteShowcaseTheme(action.direction);
        return;
      case 'restart-run':
        void this.audio.resume();
        event.stopImmediatePropagation();
        event.preventDefault();
        this.restart();
        return;
      case 'toggle-sound': {
        void this.audio.resume();
        const nextSoundEnabled = !this.soundEnabled;
        this.setSoundEnabled(nextSoundEnabled);
        this.onSoundEnabledChange(nextSoundEnabled);
        this.audio.playToggle(nextSoundEnabled);
        event.stopImmediatePropagation();
        event.preventDefault();
        return;
      }
      case 'cycle-vehicle': {
        void this.audio.resume();
        const nextVehicleDesign = getNextVehicleDesign(this.vehicleDesign);
        this.setVehicleDesign(nextVehicleDesign);
        this.onVehicleDesignChange(nextVehicleDesign);
        this.spawnEffectMessage(getVehicleDesignLabel(nextVehicleDesign), '#f8fafc', 'low');
        event.stopImmediatePropagation();
        event.preventDefault();
        return;
      }
      case 'apply-input':
        if (action.consumed) {
          void this.audio.resume();
          event.stopImmediatePropagation();
          event.preventDefault();
        }
        return;
    }
  };

  private handleKeyUp = (event: KeyboardEvent): void => {
    if (!this.running) {
      return;
    }

    const consumed = resolveKeyUpConsumed(this.input, {
      code: event.code,
      gameOverActive: Boolean(this.gameOverState),
    });
    if (consumed) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  };

  private resetInput(): void {
    resetInputState(this.input);
  }

  private getActiveInput(): InputState {
    return cloneInputState(this.input);
  }

  private spawnCoinPickupMessage(pickup: World['pickups'][number]): void {
    const centerX = pickup.rect.x + pickup.rect.width / 2;
    const centerY = pickup.rect.y + pickup.rect.height / 2;
    const text = PICKUP_WORDS[this.pickupFlavorIndex % PICKUP_WORDS.length];
    const color = PICKUP_COLORS[this.pickupFlavorIndex % PICKUP_COLORS.length];
    this.pickupFlavorIndex += 1;

    this.toastSystem.enqueue({
      x: centerX,
      y: centerY - 18,
      text,
      ttlMs: TOAST_PICKUP_TTL_MS,
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
    this.planeWarning = tickPlaneWarningState(this.planeWarning, dtSeconds);
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
      ? getCoinRefillDelayMs(visibleRegularCoinsAfterSpawn, this.coinRefillBoostTimerMs)
      : randomBetween(REGULAR_COIN_RETRY_MIN_MS, REGULAR_COIN_RETRY_MAX_MS);
  }

  private updateAmbientSpecialSpawns(dtSeconds: number): void {
    if (!this.world) {
      return;
    }

    if (this.planeBoostLane || this.planeCoinTrail) {
      // Keep temporary plane-route moments readable by delaying ambient specials a bit.
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

      const encounter = createPlaneBonusEncounter(this.world.viewport);
      this.planeBonusEvent = encounter.planeBonusEvent;
      this.planeWarning = encounter.planeWarning;
      this.audio.playPlaneFlyover();
      this.spawnEffectMessage('PLANE', '#93c5fd', 'medium');
      return;
    }

    const planeStep = advancePlaneBonusEventState(
      this.world.viewport,
      this.planeBonusEvent,
      dtSeconds,
    );
    if (planeStep.dropReady) {
      dispatchPlaneDropWithFallback(this.planeBonusEvent, {
        spawnBonusDrop: (x, y) => this.spawnPlaneBonusDrop(x, y),
        spawnBoostLane: (x, y, vx, vy) => this.spawnPlaneBoostLane(x, y, vx, vy),
        spawnCoinTrail: (x, y, vx, vy) => this.spawnPlaneCoinTrail(x, y, vx, vy),
        spawnSpotlight: (x, y) => this.spawnPlaneSpotlight(x, y),
        spawnLuckyWind: (x, y, vx, vy) => this.spawnPlaneLuckyWind(x, y, vx, vy),
        spawnPoliceDelay: () => this.spawnPlanePoliceDelay(),
      });
      this.planeBonusEvent.dropped = true;
    }

    if (planeStep.completed) {
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

  private spawnPlaneCoinTrail(x: number, y: number, vx: number, vy: number): boolean {
    if (!this.world) {
      return false;
    }

    const trailRects = createPlaneCoinTrailRects(this.world.viewport, { x, y }, { x: vx, y: vy });
    if (trailRects.length === 0) {
      return false;
    }

    const trailSeed = `${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    const trailPickups: WorldPickup[] = [];
    for (const [index, rect] of trailRects.entries()) {
      if (!this.canSpawnRegularCoinAt(rect)) {
        continue;
      }
      trailPickups.push({
        id: `plane-trail:${trailSeed}:${index}`,
        sourceId: `plane-trail:${trailSeed}:${index}`,
        rect: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        },
        value: REGULAR_COIN_SCORE,
        kind: 'coin',
      });
    }

    if (trailPickups.length < 3) {
      return false;
    }

    for (const pickup of trailPickups) {
      this.world.pickups.push(pickup);
    }

    this.planeCoinTrail = {
      coinIds: trailPickups.map((pickup) => pickup.id),
      ttlMs: PLANE_COIN_TRAIL_DURATION_MS,
      durationMs: PLANE_COIN_TRAIL_DURATION_MS,
    };
    this.specialSpawnTimerMs = Math.max(this.specialSpawnTimerMs, PLANE_LANE_SPECIAL_STAGGER_MS);
    this.audio.playPlaneDrop();
    this.spawnEffectMessage('COIN TRAIL', '#facc15', 'high');
    return true;
  }

  private spawnPlaneSpotlight(x: number, y: number): boolean {
    if (!this.world) {
      return false;
    }

    const specialPickups = this.world.pickups.filter((pickup) => pickup.kind === 'special');
    if (specialPickups.length === 0) {
      return false;
    }

    const target = specialPickups.reduce((best, candidate) => {
      const candidateCenter = rectCenter(candidate.rect);
      const bestCenter = rectCenter(best.rect);
      const candidateDistance = Math.hypot(candidateCenter.x - x, candidateCenter.y - y);
      const bestDistance = Math.hypot(bestCenter.x - x, bestCenter.y - y);
      return candidateDistance < bestDistance ? candidate : best;
    });
    this.enqueueSpecialSpawnCue(target, PLANE_SPOTLIGHT_CUE_DURATION_MS);
    this.specialSpawnTimerMs = Math.max(this.specialSpawnTimerMs, PLANE_LANE_SPECIAL_STAGGER_MS);
    this.audio.playPlaneDrop();
    this.spawnEffectMessage('SPOTLIGHT', '#fde047', 'high');
    return true;
  }

  private spawnPlanePoliceDelay(): boolean {
    if (this.policeChase?.phase === 'chasing') {
      return false;
    }

    const delayMs = randomBetween(PLANE_POLICE_DELAY_MIN_MS, PLANE_POLICE_DELAY_MAX_MS);
    this.policeWarning = null;
    this.policeSpawnTimerMs = Math.max(0, this.policeSpawnTimerMs) + delayMs;
    const delayCue = createPoliceDelayCueState(delayMs);
    this.policeDelayCueTimerMs = delayCue.policeDelayCueTimerMs;
    this.policeDelayCueDurationMs = delayCue.policeDelayCueDurationMs;
    this.audio.playPlaneDrop();
    this.spawnEffectMessage('HOLD-UP', '#93c5fd', 'high');
    return true;
  }

  private spawnPlaneLuckyWind(x: number, y: number, vx: number, vy: number): boolean {
    if (!this.world) {
      return false;
    }

    const magnitude = Math.hypot(vx, vy);
    if (magnitude < 0.001) {
      return false;
    }

    const direction = { x: vx / magnitude, y: vy / magnitude };
    const normal = { x: -direction.y, y: direction.x };
    const candidateCoins = this.world.pickups
      .filter((pickup) => pickup.kind !== 'special')
      .map((pickup) => {
        const center = rectCenter(pickup.rect);
        const dx = center.x - x;
        const dy = center.y - y;
        return {
          pickup,
          along: dx * direction.x + dy * direction.y,
          lateral: dx * normal.x + dy * normal.y,
          distance: Math.hypot(dx, dy),
        };
      })
      .filter(
        (candidate) =>
          candidate.distance <= PLANE_LUCKY_WIND_RADIUS_PX &&
          Math.abs(candidate.lateral) <= PLANE_LUCKY_WIND_RADIUS_PX * 0.9,
      )
      .sort(
        (left, right) =>
          left.distance - right.distance || Math.abs(left.lateral) - Math.abs(right.lateral),
      )
      .slice(0, PLANE_LUCKY_WIND_MAX_COINS);

    if (candidateCoins.length < 2) {
      return false;
    }

    const obstacleBlockers = [...this.world.obstacles, ...this.world.deadSpots, ...this.world.hazards];
    const specialRects = this.world.pickups
      .filter((pickup) => pickup.kind === 'special')
      .map((pickup) => pickup.rect);
    const regularCoinRects = new Map(
      this.world.pickups
        .filter((pickup) => pickup.kind !== 'special')
        .map((pickup) => [pickup.id, { ...pickup.rect }] as const),
    );
    const updates: Array<{ id: string; rect: Rect }> = [];

    for (const candidate of candidateCoins) {
      const currentCenter = rectCenter(candidate.pickup.rect);
      const clampedAlong = clamp(
        candidate.along,
        -PLANE_LUCKY_WIND_ROUTE_HALF_SPAN_PX,
        PLANE_LUCKY_WIND_ROUTE_HALF_SPAN_PX,
      );
      const routeCenter = {
        x: x + direction.x * clampedAlong,
        y: y + direction.y * clampedAlong,
      };
      const toRouteX = routeCenter.x - currentCenter.x;
      const toRouteY = routeCenter.y - currentCenter.y;
      const distanceToRoute = Math.hypot(toRouteX, toRouteY);
      if (distanceToRoute < 2) {
        continue;
      }

      const shiftPx = Math.min(PLANE_LUCKY_WIND_MAX_SHIFT_PX, distanceToRoute * 0.65 + 8);
      const shiftedCenter = {
        x: currentCenter.x + (toRouteX / distanceToRoute) * shiftPx,
        y: currentCenter.y + (toRouteY / distanceToRoute) * shiftPx,
      };
      const nextRect: Rect = {
        x: clamp(
          shiftedCenter.x - candidate.pickup.rect.width / 2,
          8,
          this.world.viewport.width - candidate.pickup.rect.width - 8,
        ),
        y: clamp(
          shiftedCenter.y - candidate.pickup.rect.height / 2,
          8,
          this.world.viewport.height - candidate.pickup.rect.height - 8,
        ),
        width: candidate.pickup.rect.width,
        height: candidate.pickup.rect.height,
      };

      if (obstacleBlockers.some((rect) => rectsIntersect(nextRect, rect))) {
        continue;
      }

      if (specialRects.some((rect) => rectsIntersect(nextRect, rect))) {
        continue;
      }

      const collidesWithCoin = Array.from(regularCoinRects.entries()).some(
        ([pickupId, rect]) => pickupId !== candidate.pickup.id && rectsIntersect(nextRect, rect),
      );
      if (collidesWithCoin) {
        continue;
      }

      updates.push({
        id: candidate.pickup.id,
        rect: nextRect,
      });
      regularCoinRects.set(candidate.pickup.id, nextRect);
    }

    if (updates.length < 2) {
      return false;
    }

    const updateById = new Map(updates.map((update) => [update.id, update.rect] as const));
    for (const pickup of this.world.pickups) {
      if (pickup.kind === 'special') {
        continue;
      }
      const nextRect = updateById.get(pickup.id);
      if (!nextRect) {
        continue;
      }
      pickup.rect = nextRect;
    }

    this.specialSpawnTimerMs = Math.max(this.specialSpawnTimerMs, PLANE_LANE_SPECIAL_STAGGER_MS);
    this.audio.playPlaneDrop();
    this.spawnEffectMessage('L-WIND', '#86efac', 'high');
    return true;
  }

  private updatePlaneBoostLane(dtSeconds: number): void {
    this.planeBoostLane = tickPlaneBoostLaneState(this.planeBoostLane, dtSeconds);
  }

  private updatePlaneCoinTrail(dtSeconds: number): void {
    if (!this.world || !this.planeCoinTrail) {
      return;
    }

    const nextTrailStep = advancePlaneCoinTrailState(
      this.world.pickups,
      this.planeCoinTrail,
      dtSeconds,
    );
    this.world.pickups = nextTrailStep.worldPickups;
    this.planeCoinTrail = nextTrailStep.planeCoinTrail;
  }

  private updatePoliceDelayCue(dtSeconds: number): void {
    const cueState = advancePoliceDelayCueState(
      {
        policeDelayCueTimerMs: this.policeDelayCueTimerMs,
        policeDelayCueDurationMs: this.policeDelayCueDurationMs,
      },
      dtSeconds,
    );
    this.policeDelayCueTimerMs = cueState.policeDelayCueTimerMs;
    this.policeDelayCueDurationMs = cueState.policeDelayCueDurationMs;
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

    const result = spawnQueuedCoinsFromAnchors({
      worldPickups: this.world.pickups,
      coinSpawnQueue: this.coinSpawnQueue,
      coinSpawnIdCounter: this.coinSpawnIdCounter,
      count,
      canSpawnRegularCoinAt: (rect) => this.canSpawnRegularCoinAt(rect),
    });
    this.coinSpawnIdCounter = result.coinSpawnIdCounter;
    return result.spawnedAny;
  }

  private canSpawnRegularCoinAt(rect: Rect): boolean {
    if (!this.world || !this.player) {
      return false;
    }

    return canSpawnRegularCoinRect(rect, this.getPickupSpawnBlockers());
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

    return findFreePickupRect(size, this.getPickupSpawnBlockers());
  }

  private findFreePickupRectNear(point: Vector2, size: number, radius: number): Rect | null {
    if (!this.world || !this.player) {
      return null;
    }

    return findFreePickupRectNear(point, size, radius, this.getPickupSpawnBlockers());
  }

  private getPickupSpawnBlockers() {
    if (!this.world || !this.player) {
      throw new Error('Pickup spawn blockers require an active world and player.');
    }

    return {
      viewport: this.world.viewport,
      player: this.player.getBounds(),
      obstacles: this.world.obstacles,
      deadSpots: this.world.deadSpots,
      hazards: this.world.hazards,
      pickups: this.world.pickups.map((pickup) => pickup.rect),
    };
  }

  private activateSpecialEffect(effect: SpecialEffect): void {
    const resolvedEffect = adaptBlackoutEffectForSurface(effect, this.sampleCurrentSurface());
    switch (resolvedEffect) {
      case 'bonus':
        this.score += BONUS_SPECIAL_SCORE;
        this.spawnEffectMessage(getSpecialActivationMessage('bonus'), getSpecialColor('bonus'), 'high');
        return;
      case 'invert':
        this.invertTimerMs = INVERT_EFFECT_DURATION_MS;
        this.setInverted(true);
        this.spawnEffectMessage(getSpecialActivationMessage('invert'), getSpecialColor('invert'), 'high');
        return;
      case 'magnet':
        this.magnetTimerMs = MAGNET_EFFECT_DURATION_MS;
        this.spawnEffectMessage(getSpecialActivationMessage('magnet'), getSpecialColor('magnet'), 'high');
        return;
      case 'ghost':
        this.ghostTimerMs = GHOST_EFFECT_DURATION_MS;
        this.spawnEffectMessage(getSpecialActivationMessage('ghost'), getSpecialColor('ghost'), 'high');
        return;
      case 'blackout':
        this.blackoutTimerMs = BLACKOUT_EFFECT_DURATION_MS;
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
    const nextComboState = applyPickupComboState(this.comboTimerMs, this.pickupComboCount);
    this.pickupComboCount = nextComboState.pickupComboCount;
    this.comboTimerMs = nextComboState.comboTimerMs;
    if (nextComboState.flowTier !== null) {
      this.spawnEffectMessage(`FLOW x${nextComboState.flowTier}`, '#fb7185', 'medium');
    }
    return nextComboState.bonus;
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
        this.policeChase = beginPoliceLeaving(this.world.viewport, this.policeChase);
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

      const spawnCountdown = tickPoliceSpawnCountdown(
        this.policeSpawnTimerMs,
        this.policeWarning,
        dtSeconds,
      );
      this.policeSpawnTimerMs = spawnCountdown.policeSpawnTimerMs;
      this.policeWarning = spawnCountdown.policeWarning;

      if (spawnCountdown.warningStarted) {
        this.audio.playPoliceAlert();
        this.spawnEffectMessage('WEE-OO', '#93c5fd', 'critical');
      }

      if (spawnCountdown.shouldSpawn) {
        this.policeChase = createPoliceChase(this.world.viewport, this.policeWarning?.edge);
        this.policeSpawnTimerMs = randomBetween(POLICE_POST_SPAWN_MIN_MS, POLICE_POST_SPAWN_MAX_MS);
        this.spawnEffectMessage('POLICE!', '#60a5fa', 'critical');
        this.policeWarning = null;
        return { active: true, urgency: 0.3, caught: false };
      }

      return { active: false, urgency: 0, caught: false };
    }

    if (this.policeChase.phase === 'leaving') {
      const policeRect = getPoliceRect(this.policeChase);
      const onIce = isOnIceZone(policeRect, this.world.iceZones);
      advancePoliceLeaving(this.world.viewport, this.policeChase, dtSeconds, onIce);

      if (isPoliceOffscreen(this.world.viewport, this.policeChase, 28)) {
        this.policeChase = null;
        this.policeSpawnTimerMs = randomBetween(POLICE_RESPAWN_MIN_MS, POLICE_RESPAWN_MAX_MS);
        if (!this.planeBonusEvent && !this.planeWarning) {
          this.planeBonusTimerMs = randomBetween(PLANE_AFTER_POLICE_MIN_MS, PLANE_AFTER_POLICE_MAX_MS);
        }
      }

      return { active: false, urgency: 0, caught: false };
    }

    const chaseExpired = tickPoliceChaseDuration(this.policeChase, dtSeconds);
    if (chaseExpired) {
      this.policeChase = beginPoliceLeaving(this.world.viewport, this.policeChase);
      this.spawnEffectMessage('ESCAPED', '#86efac', 'high');
      return { active: false, urgency: 0, caught: false };
    }

    const playerBounds = this.player.getBounds();
    const playerCenter = rectCenter(playerBounds);
    const policeRect = getPoliceRect(this.policeChase);
    const onIce = isOnIceZone(policeRect, this.world.iceZones);
    const chaseStep = advancePoliceChasing(
      this.policeChase,
      dtSeconds,
      playerCenter,
      this.score,
      onIce,
    );

    if (rectsIntersect(playerBounds, getPoliceRect(this.policeChase))) {
      this.enterCaughtGameOver();
      return { active: false, urgency: 1, caught: true };
    }

    return { active: true, urgency: chaseStep.urgency, caught: false };
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

  private updateEffectTimers(dtSeconds: number): void {
    const timers = tickEffectTimers(
      {
        magnetTimerMs: this.magnetTimerMs,
        ghostTimerMs: this.ghostTimerMs,
        invertTimerMs: this.invertTimerMs,
        blackoutTimerMs: this.blackoutTimerMs,
        comboTimerMs: this.comboTimerMs,
        pickupComboCount: this.pickupComboCount,
      },
      dtSeconds,
    );
    this.magnetTimerMs = timers.magnetTimerMs;
    this.ghostTimerMs = timers.ghostTimerMs;
    this.invertTimerMs = timers.invertTimerMs;
    this.blackoutTimerMs = timers.blackoutTimerMs;
    this.comboTimerMs = timers.comboTimerMs;
    this.pickupComboCount = timers.pickupComboCount;

    if (timers.invertExpired) {
      this.setInverted(false);
    }
    if (timers.blackoutExpired) {
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

  private enqueueSpecialSpawnCue(pickup: WorldPickup, durationMs = 1200): void {
    if (pickup.kind !== 'special') {
      return;
    }

    const center = rectCenter(pickup.rect);
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

  private clearEncounterRuntimeState(): void {
    const cleared = createClearedEncounterState();
    this.policeChase = cleared.policeChase;
    this.policeWarning = cleared.policeWarning;
    this.planeWarning = cleared.planeWarning;
    this.specialSpawnCues = cleared.specialSpawnCues;
    this.planeBonusEvent = cleared.planeBonusEvent;
    this.planeBoostLane = cleared.planeBoostLane;
    this.planeCoinTrail = cleared.planeCoinTrail;
  }

  private clearPoliceDelayCue(): void {
    this.policeDelayCueTimerMs = 0;
    this.policeDelayCueDurationMs = 0;
  }

  private clearEffectRuntimeState(): void {
    const cleared = createClearedEffectState();
    this.magnetTimerMs = cleared.magnetTimerMs;
    this.ghostTimerMs = cleared.ghostTimerMs;
    this.invertTimerMs = cleared.invertTimerMs;
    this.blackoutTimerMs = cleared.blackoutTimerMs;
  }

  private resetComboState(): void {
    const cleared = createClearedComboState();
    this.pickupComboCount = cleared.pickupComboCount;
    this.comboTimerMs = cleared.comboTimerMs;
  }

  private beginRun(): void {
    const nextRunState = createBeginRunState(performance.now());
    this.dynamicPickups = nextRunState.dynamicPickups;
    this.coinSpawnQueue = nextRunState.coinSpawnQueue;
    this.coinSpawnIdCounter = nextRunState.coinSpawnIdCounter;
    this.coinRefillTimerMs = nextRunState.coinRefillTimerMs;
    this.coinRefillBoostTimerMs = nextRunState.coinRefillBoostTimerMs;
    this.toastSystem.clear();
    this.score = nextRunState.score;
    this.coinsCollectedTotal = nextRunState.coinsCollectedTotal;
    this.specialSpawnTimerMs = nextRunState.specialSpawnTimerMs;
    this.planeBonusTimerMs = nextRunState.planeBonusTimerMs;
    this.clearEffectRuntimeState();
    this.setInverted(false);
    this.setBlackout(false);
    this.setMagnetUiState({ active: false, point: null, strength: 0 });
    this.clearEncounterRuntimeState();
    this.clearPoliceDelayCue();
    this.policeSpawnTimerMs = nextRunState.policeSpawnTimerMs;
    this.resetComboState();
    this.gameOverState = nextRunState.gameOverState;
    this.spriteShowcaseActive = nextRunState.spriteShowcaseActive;
    this.startTimeMs = nextRunState.startTimeMs;
    this.applyWorld(this.createWorld(), true);
    this.lastFrameMs = nextRunState.lastFrameMs;
  }

  private enterCaughtGameOver(): void {
    const transition = createCaughtGameOverTransitionState(performance.now());
    this.finishCurrentRun('caught');
    this.startTimeMs = transition.startTimeMs;
    this.setInverted(false);
    this.setBlackout(false);
    this.setMagnetUiState({ active: false, point: null, strength: 0 });
    this.audio.stop();
    this.clearEffectRuntimeState();
    this.clearEncounterRuntimeState();
    this.clearPoliceDelayCue();
    this.resetComboState();
    this.spriteShowcaseActive = transition.spriteShowcaseActive;
    this.toastSystem.clear();
    this.resetInput();
    this.gameOverState = transition.gameOverState;
  }

  private enterSpriteShowcaseMode(): void {
    const transition = createSpriteShowcaseTransitionState();
    this.spriteShowcaseActive = transition.spriteShowcaseActive;
    this.autoPickSpriteShowcaseTheme();
    this.audio.stop();
    this.setInverted(false);
    this.setBlackout(false);
    this.setMagnetUiState({ active: false, point: null, strength: 0 });
    this.clearEffectRuntimeState();
    this.clearEncounterRuntimeState();
    this.clearPoliceDelayCue();
    this.resetComboState();
    this.toastSystem.clear();
    this.resetInput();
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
}
