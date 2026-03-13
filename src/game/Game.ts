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
  createPlaneCoinTrailRects,
  getPoliceRect,
  isPoliceOffscreen,
  resolvePlaneEncounterSchedulingStep,
  tickPlaneWarningState,
  tickPoliceChaseDuration,
  tickPoliceSpawnCountdown,
} from './encounterRuntime';
import {
  advanceFocusModeAlpha,
  advanceSpecialSpawnCues,
  drawFocusModeLayer,
  drawOvergrowthNodes,
  drawPickups,
  drawPlaneBonusEvent,
  drawSpecialSpawnCues,
  drawVfxParticles,
  estimatePageLightness,
  spawnCoinBurstParticles,
  spawnTireDustParticles,
  updateVfxParticles,
  type VfxParticle,
} from './gameRenderRuntime';
import {
  applyLurePullToPickups,
  applyMagnetPullToPickups,
  applyPickupComboState,
  resolveSpecialEffectActivation,
  tickEffectTimers,
} from './gameEffectsRuntime';
import { buildHudState, isDriveInputActive } from './gameHudAudioRuntime';
import {
  createBeginRunState,
  createCaughtGameOverTransitionState,
  createClearedComboState,
  createClearedEffectState,
  createClearedEncounterState,
  resolveFocusPauseTransitionState,
  createSpriteShowcaseTransitionState,
  shouldPauseForPageFocus,
} from './gameRunStateRuntime';
import {
  renderEdgeWarningIndicator,
  renderPoliceCarSprite,
  renderPoliceWarningIndicator,
} from './sprites';
import {
  getCoinRefillDelayMs,
  getSpecialSpawnRespawnDelayMs,
  canSpawnRegularCoinRect,
  findFreePickupRect,
  findFreePickupRectNear,
  resolveAmbientSpecialSpawnStep,
  resolveRegularCoinSpawnStep,
  spawnQueuedCoinsFromAnchors,
} from './pickupSpawnRuntime';
import {
  drawCaughtGameOverOverlay,
  drawPausedOverlay,
  drawSpriteShowcaseOverlay,
} from './gameOverlays';
import { Player } from './player';
import {
  adaptBlackoutEffectForSurface,
  clonePickup,
  cloneWorld,
  ENCOUNTER_STAGGER_MS,
  getNextVehicleDesign,
  getSpecialColor,
  getSpecialDropMessage,
  getSpecialLabel,
  getVehicleDesignLabel,
  isSpecialPickup,
  JACKPOT_PICKUP_SIZE,
  JACKPOT_SPAWN_CHANCE,
  pickOppositeShowcaseThemeIndex,
  pickSpecialEffect,
  PICKUP_COLORS,
  PICKUP_WORDS,
  PLANE_AFTER_POLICE_MAX_MS,
  PLANE_AFTER_POLICE_MIN_MS,
  PLANE_BONUS_PICKUP_SIZE,
  PLANE_COIN_TRAIL_DURATION_MS,
  PLANE_EVENT_INITIAL_MAX_MS,
  PLANE_EVENT_INITIAL_MIN_MS,
  PLANE_EVENT_MIN_SCORE,
  PLANE_EVENT_RESPAWN_MAX_MS,
  PLANE_EVENT_RESPAWN_MIN_MS,
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
  SHOWCASE_THEMES,
  shufflePickups,
  SPECIAL_INITIAL_SPAWN_MAX_MS,
  SPECIAL_INITIAL_SPAWN_MIN_MS,
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
  applyPlaneLuckyWindToPickups,
  advancePlaneCoinTrailState,
  advancePoliceDelayCueState,
  createPoliceDelayCueState,
  dispatchPlaneDropWithFallback,
} from './planeDropRuntime';
import {
  advanceOvergrowthGrowth,
  getOvergrowthObstacles,
  getOvergrowthRespawnDelayMs,
  getOvergrowthSlowZones,
  resolveOvergrowthSpawnStep,
  trySpawnOvergrowthNode,
  type OvergrowthNode,
} from './overgrowthRuntime';
import { resolveNearMissStep, NEAR_MISS_COLOR, NEAR_MISS_TOAST_TTL_MS } from './nearMissRuntime';
import {
  createInitialObjectiveState,
  getObjectiveCompletionWord,
  OBJECTIVE_COMPLETION_COLOR,
  OBJECTIVE_SCORE_BONUS,
  resolveObjectiveTickStep,
  type MicroObjective,
  type ObjectiveTickEvents,
} from './microObjectiveRuntime';
import { ToastSystem, type ToastPriority } from './toastSystem';
import { rectCenter, rectsIntersect } from '../shared/utils';

export class Game {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private createWorld: () => World;
  private getPageTitle: () => string;
  private sampleSurfaceAt: (point: Vector2) => SurfaceSample;
  private setPageInverted: (active: boolean) => void;
  private setPageBlackout: (active: boolean) => void;
  private setMagnetUiState: (state: {
    active: boolean;
    point: Vector2 | null;
    strength: number;
  }) => void;
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
  private lureTimerMs: number;
  private invertActive: boolean;
  private blackoutActive: boolean;
  private policeChase: PoliceChaseState | null;
  private policeWarning: PoliceWarningState | null;
  private planeWarning: PlaneWarningState | null;
  private policeSpawnTimerMs: number;
  private pickupComboCount: number;
  private comboTimerMs: number;
  private gameOverState: GameOverState | null;
  private paused: boolean;
  private pausedStartedAtMs: number;
  private focusModeAlpha: number;
  private spriteShowcaseActive: boolean;
  private spriteShowcaseThemeIndex: number;
  private spriteShowcasePageLightness: number;
  private overgrowthNodes: OvergrowthNode[];
  private overgrowthSpawnTimerMs: number;
  private nearMissCooldownMs: number;
  private nearMissCount: number;
  private nearMissFlavorIndex: number;
  private objectiveActive: MicroObjective | null;
  private objectiveAssignDelayMs: number;
  private objectiveCompletedCount: number;
  private objectiveLastTemplateId: string;
  private vfxParticles: VfxParticle[];

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
    this.planeCoinTrail = null;
    this.policeDelayCueTimerMs = 0;
    this.policeDelayCueDurationMs = 0;
    this.planeBonusTimerMs = randomBetween(PLANE_EVENT_INITIAL_MIN_MS, PLANE_EVENT_INITIAL_MAX_MS);
    this.pickupFlavorIndex = 0;
    this.coinsCollectedTotal = 0;
    this.specialSpawnTimerMs = randomBetween(
      SPECIAL_INITIAL_SPAWN_MIN_MS,
      SPECIAL_INITIAL_SPAWN_MAX_MS,
    );
    this.magnetTimerMs = 0;
    this.ghostTimerMs = 0;
    this.invertTimerMs = 0;
    this.blackoutTimerMs = 0;
    this.lureTimerMs = 0;
    this.invertActive = false;
    this.blackoutActive = false;
    this.policeChase = null;
    this.policeWarning = null;
    this.planeWarning = null;
    this.policeSpawnTimerMs = randomBetween(
      POLICE_INITIAL_SPAWN_MIN_MS,
      POLICE_INITIAL_SPAWN_MAX_MS,
    );
    this.pickupComboCount = 0;
    this.comboTimerMs = 0;
    this.gameOverState = null;
    this.paused = false;
    this.pausedStartedAtMs = 0;
    this.focusModeAlpha = 0.75;
    this.spriteShowcaseActive = false;
    this.spriteShowcaseThemeIndex = 0;
    this.spriteShowcasePageLightness = 0.5;
    this.overgrowthNodes = [];
    this.overgrowthSpawnTimerMs = 0;
    this.nearMissCooldownMs = 0;
    this.nearMissCount = 0;
    this.nearMissFlavorIndex = 0;
    this.objectiveActive = null;
    this.objectiveAssignDelayMs = 0;
    this.objectiveCompletedCount = 0;
    this.objectiveLastTemplateId = '';
    this.vfxParticles = [];
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
    window.addEventListener('blur', this.handleWindowFocusChange, true);
    window.addEventListener('focus', this.handleWindowFocusChange, true);
    document.addEventListener('visibilitychange', this.handleWindowFocusChange, true);
    this.syncPausedFromPageFocus();
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
    window.removeEventListener('blur', this.handleWindowFocusChange, true);
    window.removeEventListener('focus', this.handleWindowFocusChange, true);
    document.removeEventListener('visibilitychange', this.handleWindowFocusChange, true);

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
    this.overgrowthNodes = [];
    this.overgrowthSpawnTimerMs = 0;
    this.nearMissCooldownMs = 0;
    this.nearMissCount = 0;
    this.nearMissFlavorIndex = 0;
    this.objectiveActive = null;
    this.objectiveAssignDelayMs = 0;
    this.objectiveCompletedCount = 0;
    this.objectiveLastTemplateId = '';
    this.vfxParticles = [];
    this.gameOverState = null;
    this.paused = false;
    this.pausedStartedAtMs = 0;
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
        (collidesWithAny(currentBounds, world.deadSpots) ||
          collidesWithAny(currentBounds, world.hazards));
      if (blocked || unsafe) {
        this.player.reset(world.spawnPoint);
      }
    }

    this.spawnQueuedCoins(REGULAR_COIN_STARTING_BATCH);
    const visibleRegularCoins = this.world.pickups.filter(
      (pickup) => !isSpecialPickup(pickup),
    ).length;
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

    if (this.paused) {
      this.lastFrameMs = timestampMs;
      this.render();
      this.frameHandle = window.requestAnimationFrame(this.tick);
      return;
    }

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
    this.updatePlaneCoinTrail(dtSeconds);
    this.updatePoliceDelayCue(dtSeconds);

    const currentBounds = this.player.getBounds();
    const boosting = isBoosting(currentBounds, this.getActiveBoostZones());
    const onIce = isOnIceZone(currentBounds, this.world.iceZones);
    const activeObstacles = [
      ...this.world.obstacles,
      ...getOvergrowthObstacles(this.overgrowthNodes),
    ];
    const activeSlowZones = [
      ...this.world.slowZones,
      ...getOvergrowthSlowZones(this.overgrowthNodes),
    ];
    const slowed = this.ghostTimerMs <= 0 && !onIce && isOnSlowZone(currentBounds, activeSlowZones);

    const activeInput = this.getActiveInput();
    this.player.update({
      input: activeInput,
      dtSeconds,
      viewport: this.world.viewport,
      obstacles: activeObstacles,
      boosting,
      slowed,
      onIce,
    });
    void this.audio.updateEngine(
      this.player.getLastStepDiagnostics().speed,
      isDriveInputActive(activeInput),
    );
    const playerSpeed = this.player.getLastStepDiagnostics().speed;
    if (playerSpeed > 50 && !this.player.isAirborne()) {
      const pBounds = this.player.getBounds();
      const dustSurface = onIce ? 'ice' : boosting ? 'boost' : 'normal';
      spawnTireDustParticles(
        this.vfxParticles,
        pBounds.x + pBounds.width / 2,
        pBounds.y + pBounds.height / 2,
        this.player.getAngle(),
        dustSurface,
      );
    }

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

    const nearMissCountBefore = this.nearMissCount;
    this.updateNearMiss(dtSeconds, activeObstacles);

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
      spawnCoinBurstParticles(
        this.vfxParticles,
        pickup.rect.x + pickup.rect.width / 2,
        pickup.rect.y + pickup.rect.height / 2,
      );
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

    const coinsCollectedThisFrame = pickupStep.collectedPickups.filter(
      (p) => !isSpecialPickup(p),
    ).length;
    const specialsCollectedThisFrame = pickupStep.collectedPickups.filter((p) =>
      isSpecialPickup(p),
    ).length;
    this.updateMicroObjective(
      {
        coinsCollectedThisFrame,
        specialsCollectedThisFrame,
        nearMissTriggeredThisFrame: this.nearMissCount > nearMissCountBefore,
        currentScore: this.score,
        currentComboCount: this.pickupComboCount,
      },
      dtSeconds,
    );

    this.updateRegularCoinSpawns(dtSeconds);
    this.updateAmbientSpecialSpawns(dtSeconds);
    this.updatePlaneBonusEvent(dtSeconds);
    this.updateOvergrowth(dtSeconds);
    this.applyMagnet(dtSeconds);
    this.applyLure(dtSeconds);
    this.updateUiEffects();

    this.toastSystem.update(dtSeconds);
    this.updateSpecialSpawnCues(dtSeconds);
    updateVfxParticles(this.vfxParticles, dtSeconds);

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

    if (this.paused) {
      this.drawPausedScreen();
      return;
    }

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
    drawOvergrowthNodes(ctx, this.overgrowthNodes, performance.now());
    drawPlaneBonusEvent(ctx, this.planeBonusEvent, performance.now());
    drawSpecialSpawnCues(ctx, this.specialSpawnCues, getSpecialLabel('blackout'));
    drawPickups(
      ctx,
      this.world.pickups,
      this.comboTimerMs,
      this.pickupComboCount,
      performance.now(),
    );
    drawVfxParticles(ctx, this.vfxParticles);
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
    const policeRemainingMs =
      this.isPoliceChasing() && this.policeChase ? this.policeChase.remainingMs : null;
    const policeDurationMs =
      this.isPoliceChasing() && this.policeChase ? this.policeChase.durationMs : null;
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
      lureTimerMs: this.lureTimerMs,
      policeDelayCueTimerMs: this.policeDelayCueTimerMs,
      policeDelayCueDurationMs: this.policeDelayCueDurationMs,
      comboTimerMs: this.comboTimerMs,
      pickupComboCount: this.pickupComboCount,
      policeRemainingMs,
      policeDurationMs,
      planeActive: Boolean(this.planeBonusEvent),
      planeWarningActive: Boolean(this.planeWarning),
      planeWarningRemainingMs: this.planeWarning ? this.planeWarning.remainingMs : null,
      planeWarningDurationMs: this.planeWarning ? this.planeWarning.durationMs : null,
      policeActive: this.isPoliceChasing(),
      policeWarningActive: Boolean(this.policeWarning) && !this.isPoliceChasing(),
      policeWarningRemainingMs:
        this.policeWarning && !this.isPoliceChasing() ? this.policeWarning.remainingMs : null,
      policeWarningDurationMs:
        this.policeWarning && !this.isPoliceChasing() ? this.policeWarning.durationMs : null,
      nearMissCount: this.nearMissCount,
      objectivesCompleted: this.objectiveCompletedCount,
      objectiveActive: this.objectiveActive,
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
    this.spriteShowcaseThemeIndex = (this.spriteShowcaseThemeIndex + direction + total) % total;
  }

  private autoPickSpriteShowcaseTheme(): void {
    this.spriteShowcasePageLightness = this.estimatePageLightness();
    this.spriteShowcaseThemeIndex = pickOppositeShowcaseThemeIndex(
      this.spriteShowcasePageLightness,
    );
  }

  private estimatePageLightness(): number {
    if (!this.world) {
      return 0.5;
    }

    return estimatePageLightness(this.world.viewport, this.sampleSurfaceAt);
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
    this.specialSpawnCues = advanceSpecialSpawnCues(this.specialSpawnCues, dtSeconds);
  }

  private updatePlaneWarning(dtSeconds: number): void {
    this.planeWarning = tickPlaneWarningState(this.planeWarning, dtSeconds);
  }

  private updateRegularCoinSpawns(dtSeconds: number): void {
    if (!this.world) {
      return;
    }

    const step = resolveRegularCoinSpawnStep({
      coinRefillBoostTimerMs: this.coinRefillBoostTimerMs,
      coinRefillTimerMs: this.coinRefillTimerMs,
      coinSpawnQueueEmpty: this.coinSpawnQueue.length === 0,
      visibleRegularCoins: this.world.pickups.filter((pickup) => !isSpecialPickup(pickup)).length,
      dtSeconds,
    });
    this.coinRefillBoostTimerMs = step.coinRefillBoostTimerMs;
    this.coinRefillTimerMs = step.coinRefillTimerMs;

    if (step.shouldSpawn) {
      const spawned = this.spawnQueuedCoins(1);
      const visibleRegularCoinsAfterSpawn = this.world.pickups.filter(
        (pickup) => !isSpecialPickup(pickup),
      ).length;
      this.coinRefillTimerMs = spawned
        ? getCoinRefillDelayMs(visibleRegularCoinsAfterSpawn, this.coinRefillBoostTimerMs)
        : randomBetween(REGULAR_COIN_RETRY_MIN_MS, REGULAR_COIN_RETRY_MAX_MS);
    }
  }

  private updateAmbientSpecialSpawns(dtSeconds: number): void {
    if (!this.world) {
      return;
    }

    const step = resolveAmbientSpecialSpawnStep({
      specialSpawnTimerMs: this.specialSpawnTimerMs,
      existingSpecialCount: this.dynamicPickups.filter((pickup) => pickup.kind === 'special')
        .length,
      planeRouteActive: Boolean(this.planeCoinTrail),
      dtSeconds,
    });
    this.specialSpawnTimerMs = step.specialSpawnTimerMs;

    if (step.shouldAttemptSpawn) {
      const spawned = this.spawnSpecialPickup();
      this.specialSpawnTimerMs = getSpecialSpawnRespawnDelayMs(spawned);
    }
  }

  private updateOvergrowth(dtSeconds: number): void {
    if (!this.world) {
      return;
    }

    const runElapsedMs = this.startTimeMs > 0 ? performance.now() - this.startTimeMs : 0;
    const step = resolveOvergrowthSpawnStep({
      overgrowthSpawnTimerMs: this.overgrowthSpawnTimerMs,
      runElapsedMs,
      existingNodeCount: this.overgrowthNodes.length,
      dtSeconds,
    });
    this.overgrowthSpawnTimerMs = step.overgrowthSpawnTimerMs;

    if (step.shouldSpawn) {
      const anchors = [...this.world.obstacles];
      const playerBounds = this.player ? this.player.getBounds() : null;
      const spawnBlockers = [
        ...(playerBounds ? [playerBounds] : []),
        ...this.world.pickups.map((pickup) => pickup.rect),
      ];
      const node = trySpawnOvergrowthNode(
        anchors,
        this.overgrowthNodes,
        spawnBlockers,
        runElapsedMs,
      );
      if (node) {
        this.overgrowthNodes.push(node);
      }
      this.overgrowthSpawnTimerMs = getOvergrowthRespawnDelayMs();
    }

    advanceOvergrowthGrowth(this.overgrowthNodes, dtSeconds);
  }

  private updateNearMiss(dtSeconds: number, activeObstacles: Rect[]): void {
    if (!this.world || !this.player) {
      return;
    }

    if (this.player.isAirborne() || this.ghostTimerMs > 0) {
      this.nearMissCooldownMs = Math.max(0, this.nearMissCooldownMs - dtSeconds * 1000);
      return;
    }

    const policeRect =
      this.policeChase?.phase === 'chasing' ? getPoliceRect(this.policeChase) : null;
    const step = resolveNearMissStep({
      playerBounds: this.player.getBounds(),
      obstacles: activeObstacles,
      policeRect,
      cooldownMs: this.nearMissCooldownMs,
      dtSeconds,
      flavorIndex: this.nearMissFlavorIndex,
    });
    this.nearMissCooldownMs = step.cooldownMs;

    if (step.triggered) {
      this.score += step.scoreBonus;
      this.nearMissCount += 1;
      this.nearMissFlavorIndex += 1;
      this.pageBestScore = Math.max(this.pageBestScore, this.score);
      this.lifetimeBestScore = Math.max(this.lifetimeBestScore, this.score);
      this.toastSystem.enqueue({
        x: this.player.getBounds().x + this.player.getBounds().width / 2,
        y: this.player.getBounds().y - 18,
        text: step.messageText,
        ttlMs: NEAR_MISS_TOAST_TTL_MS,
        color: NEAR_MISS_COLOR,
        priority: 'low',
      });
    }
  }

  private updateMicroObjective(events: ObjectiveTickEvents, dtSeconds: number): void {
    const step = resolveObjectiveTickStep({
      active: this.objectiveActive,
      assignDelayMs: this.objectiveAssignDelayMs,
      completedCount: this.objectiveCompletedCount,
      lastTemplateId: this.objectiveLastTemplateId,
      events,
      dtSeconds,
    });
    this.objectiveActive = step.active;
    this.objectiveAssignDelayMs = step.assignDelayMs;
    this.objectiveCompletedCount = step.completedCount;
    this.objectiveLastTemplateId = step.lastTemplateId;

    if (step.completed) {
      this.score += OBJECTIVE_SCORE_BONUS;
      this.pageBestScore = Math.max(this.pageBestScore, this.score);
      this.lifetimeBestScore = Math.max(this.lifetimeBestScore, this.score);
      const word = getObjectiveCompletionWord(step.completedCount - 1);
      this.spawnEffectMessage(word, OBJECTIVE_COMPLETION_COLOR, 'high');
    }
  }

  private updatePlaneBonusEvent(dtSeconds: number): void {
    if (!this.world) {
      return;
    }

    if (!this.planeBonusEvent) {
      const schedulingStep = resolvePlaneEncounterSchedulingStep({
        planeBonusTimerMs: this.planeBonusTimerMs,
        hasRunProgress: this.score >= PLANE_EVENT_MIN_SCORE || this.coinsCollectedTotal >= 4,
        policeOrWarningActive: Boolean(this.policeChase) || Boolean(this.policeWarning),
        dtSeconds,
      });
      this.planeBonusTimerMs = schedulingStep.planeBonusTimerMs;

      if (schedulingStep.shouldStartEncounter) {
        const encounter = createPlaneBonusEncounter(this.world.viewport);
        this.planeBonusEvent = encounter.planeBonusEvent;
        this.planeWarning = encounter.planeWarning;
        this.spawnEffectMessage('PLANE', '#93c5fd', 'medium');
      }
      return;
    }

    const planeStep = advancePlaneBonusEventState(
      this.world.viewport,
      this.planeBonusEvent,
      dtSeconds,
    );
    if (planeStep.enteredViewport) {
      this.audio.playPlaneFlyover();
    }
    if (planeStep.dropReady) {
      const dropSpawned = dispatchPlaneDropWithFallback(this.planeBonusEvent, {
        spawnBonusDrop: (x, y) => this.spawnPlaneBonusDrop(x, y),
        spawnCoinTrail: (x, y, vx, vy) => this.spawnPlaneCoinTrail(x, y, vx, vy),
        spawnSpotlight: (x, y) => this.spawnPlaneSpotlight(x, y),
        spawnLuckyWind: (x, y, vx, vy) => this.spawnPlaneLuckyWind(x, y, vx, vy),
        spawnPoliceDelay: () => this.spawnPlanePoliceDelay(),
      });
      this.planeBonusEvent.dropped = dropSpawned;
    }

    if (planeStep.completed) {
      this.planeBonusEvent = null;
      this.planeBonusTimerMs = randomBetween(
        PLANE_EVENT_RESPAWN_MIN_MS,
        PLANE_EVENT_RESPAWN_MAX_MS,
      );
      this.policeSpawnTimerMs = Math.max(
        this.policeSpawnTimerMs,
        randomBetween(POLICE_AFTER_PLANE_MIN_MS, POLICE_AFTER_PLANE_MAX_MS),
      );
    }
  }

  private spawnPlaneBonusDrop(x: number, y: number): boolean {
    if (!this.world) {
      return false;
    }

    const rect =
      this.findFreePickupRectNear({ x, y }, PLANE_BONUS_PICKUP_SIZE, 22) ??
      this.findFreePickupRect(PLANE_BONUS_PICKUP_SIZE);
    if (!rect) {
      return false;
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

    const moved = applyPlaneLuckyWindToPickups({
      worldPickups: this.world.pickups,
      viewport: this.world.viewport,
      blockers: [...this.world.obstacles, ...this.world.deadSpots, ...this.world.hazards],
      center: { x, y },
      direction: { x: vx, y: vy },
    });
    if (!moved) {
      return false;
    }

    this.specialSpawnTimerMs = Math.max(this.specialSpawnTimerMs, PLANE_LANE_SPECIAL_STAGGER_MS);
    this.audio.playPlaneDrop();
    this.spawnEffectMessage('L-WIND', '#86efac', 'high');
    return true;
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

    return this.world.boosts;
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

    const existingSpecials = this.dynamicPickups.filter(
      (pickup) => pickup.kind === 'special',
    ).length;
    if (existingSpecials >= SPECIAL_VISIBLE_CAP) {
      return false;
    }

    const isJackpot = Math.random() < JACKPOT_SPAWN_CHANCE;
    const pickupSize = isJackpot ? JACKPOT_PICKUP_SIZE : 20;
    const rect = this.findFreePickupRect(pickupSize);
    if (!rect) {
      return false;
    }

    const surface = this.sampleSurfaceAt({
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    });
    const effect = isJackpot
      ? ('jackpot' as const)
      : adaptBlackoutEffectForSurface(pickSpecialEffect(surface), surface);
    const pickup: WorldPickup = {
      id: `special:${effect}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      rect,
      value: isJackpot ? 0 : 25,
      kind: 'special',
      effect,
      accentColor: getSpecialColor(effect),
      label: getSpecialLabel(effect),
    };
    this.dynamicPickups.push(pickup);
    this.world.pickups.push(clonePickup(pickup));
    this.enqueueSpecialSpawnCue(pickup, isJackpot ? 1800 : 1200);
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
      obstacles: [...this.world.obstacles, ...getOvergrowthObstacles(this.overgrowthNodes)],
      deadSpots: this.world.deadSpots,
      hazards: this.world.hazards,
      pickups: this.world.pickups.map((pickup) => pickup.rect),
    };
  }

  private activateSpecialEffect(effect: SpecialEffect): void {
    const activation = resolveSpecialEffectActivation(effect, this.sampleCurrentSurface());
    this.score += activation.scoreBonus;

    switch (activation.resolvedEffect) {
      case 'invert':
        this.invertTimerMs = activation.timerMs;
        break;
      case 'magnet':
        this.magnetTimerMs = activation.timerMs;
        break;
      case 'ghost':
        this.ghostTimerMs = activation.timerMs;
        break;
      case 'blackout':
        this.blackoutTimerMs = activation.timerMs;
        break;
      case 'lure':
        this.lureTimerMs = activation.timerMs;
        break;
      case 'cooldown':
        this.applyCooldownPoliceDelay(activation.policeDelayMs);
        break;
      case 'jackpot':
        break;
    }

    if (activation.setInverted) {
      this.setInverted(true);
    }
    if (activation.setBlackout) {
      this.setBlackout(true);
    }

    this.spawnEffectMessage(activation.messageText, activation.messageColor, 'high');
  }

  private applyCooldownPoliceDelay(delayMs: number): void {
    this.policeWarning = null;
    this.policeSpawnTimerMs = Math.max(0, this.policeSpawnTimerMs) + delayMs;
    const delayCue = createPoliceDelayCueState(delayMs);
    this.policeDelayCueTimerMs = delayCue.policeDelayCueTimerMs;
    this.policeDelayCueDurationMs = delayCue.policeDelayCueDurationMs;
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

    applyMagnetPullToPickups(this.world.pickups, rectCenter(this.player.getBounds()), dtSeconds);
  }

  private applyLure(dtSeconds: number): void {
    if (!this.world || !this.player || this.lureTimerMs <= 0) {
      return;
    }

    applyLurePullToPickups(this.world.pickups, rectCenter(this.player.getBounds()), dtSeconds);
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
          this.planeBonusTimerMs = randomBetween(
            PLANE_AFTER_POLICE_MIN_MS,
            PLANE_AFTER_POLICE_MAX_MS,
          );
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

    renderPoliceCarSprite(
      this.context,
      this.policeChase,
      performance.now(),
      this.policeChase.phase === 'chasing',
    );
  }

  private isPoliceChasing(): boolean {
    return this.policeChase?.phase === 'chasing';
  }

  private drawPoliceWarning(): void {
    if (!this.world || !this.policeWarning) {
      return;
    }

    renderPoliceWarningIndicator(
      this.context,
      this.world.viewport,
      this.policeWarning,
      performance.now(),
    );
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
        lureTimerMs: this.lureTimerMs,
        comboTimerMs: this.comboTimerMs,
        pickupComboCount: this.pickupComboCount,
      },
      dtSeconds,
    );
    this.magnetTimerMs = timers.magnetTimerMs;
    this.ghostTimerMs = timers.ghostTimerMs;
    this.invertTimerMs = timers.invertTimerMs;
    this.blackoutTimerMs = timers.blackoutTimerMs;
    this.lureTimerMs = timers.lureTimerMs;
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
    this.focusModeAlpha = advanceFocusModeAlpha(
      this.focusModeAlpha,
      this.isPoliceChasing() || Boolean(this.policeWarning),
      dtSeconds,
    );
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

  private spawnEffectMessage(
    text: string,
    color: string,
    priority: ToastPriority = 'medium',
  ): void {
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
    this.lureTimerMs = cleared.lureTimerMs;
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
    this.overgrowthNodes = [];
    this.overgrowthSpawnTimerMs = 0;
    this.nearMissCooldownMs = 0;
    this.nearMissCount = 0;
    this.nearMissFlavorIndex = 0;
    this.vfxParticles = [];
    const objState = createInitialObjectiveState();
    this.objectiveActive = null;
    this.objectiveAssignDelayMs = objState.assignDelayMs;
    this.objectiveCompletedCount = 0;
    this.objectiveLastTemplateId = '';
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

  private drawPausedScreen(): void {
    if (!this.world) {
      return;
    }

    drawPausedOverlay({
      ctx: this.context,
      viewport: this.world.viewport,
      nowMs: performance.now(),
      startedAtMs: this.pausedStartedAtMs || performance.now(),
    });
  }

  private handleWindowFocusChange = (): void => {
    this.syncPausedFromPageFocus();
  };

  private syncPausedFromPageFocus(): void {
    if (!this.running) {
      return;
    }

    const pauseTransition = resolveFocusPauseTransitionState({
      paused: this.paused,
      pausedStartedAtMs: this.pausedStartedAtMs,
      lastFrameMs: this.lastFrameMs,
      shouldPause: shouldPauseForPageFocus(document.visibilityState, document.hasFocus()),
      nowMs: performance.now(),
    });
    this.paused = pauseTransition.paused;
    this.pausedStartedAtMs = pauseTransition.pausedStartedAtMs;
    this.lastFrameMs = pauseTransition.lastFrameMs;

    if (pauseTransition.transition === 'enter') {
      this.audio.stop();
      this.resetInput();
      return;
    }

    if (pauseTransition.transition === 'exit') {
      this.resetInput();
    }
  }
}
