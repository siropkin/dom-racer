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
  PlaneWarningState,
  PoliceChaseState,
  PoliceWarningState,
  SpecialSpawnCue,
  SurfaceSample,
} from './gameStateTypes';
import { AudioManager } from './audio';
import {
  COINS,
  EFFECTS,
  ENCOUNTER,
  JACKPOT,
  PLANE,
  PLAYER,
  POLICE,
  SPECIALS,
  TOAST,
} from './gameConfig';
import { drawHud } from './hud';
import { collidesWithAny } from './collisions';
import { isBoosting, isOnDeadSpot, isOnIceZone, isOnSlowZone } from './pickups';
import { resolvePickupCollectionStep } from './gameEconomyRuntime';
import {
  advancePlaneBonusEventState,
  createPlaneBonusEncounter,
  createPlaneCoinTrailRects,
  getPoliceRect,
  resolvePlaneEncounterSchedulingStep,
  resolvePoliceChaseTickStep,
  tickPlaneWarningState,
} from './encounterRuntime';
import {
  advanceFocusModeAlpha,
  advanceSpecialSpawnCues,
  drawFocusModeLayer,
  drawPickups,
  drawPlaneBonusEvent,
  drawSpecialSpawnCues,
  estimatePageLightness,
} from './gameRenderRuntime';
import {
  drawSpeedLines,
  drawVfxParticles,
  spawnCelebrationParticles,
  spawnCoinBurstParticles,
  spawnDriftSparkParticles,
  spawnEscapedCelebrationParticles,
  spawnNewBestBurstParticles,
  spawnTireDustParticles,
  updateVfxParticles,
  type VfxParticle,
} from './vfxRuntime';
import {
  applyMagnetPullToPickups,
  resolveSpecialEffectActivation,
  tickEffectTimers,
} from './gameEffectsRuntime';
import { buildHudState, isDriveInputActive } from './gameHudAudioRuntime';
import {
  createBeginRunState,
  createCaughtGameOverTransitionState,
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
  setPageLightnessForSprites,
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
  drawFirstPlayHintOverlay,
  drawPausedOverlay,
  drawSpriteShowcaseOverlay,
} from './gameOverlays';
import { Player } from './player';
import {
  clonePickup,
  cloneWorld,
  computeViewportScaleFactor,
  type DailyModifier,
  getDailyModifier,
  getNextUnlockedVehicleDesign,
  getSpecialColor,
  getSpecialDropMessage,
  getSpecialLabel,
  getVehicleDesignLabel,
  isSpecialPickup,
  pickOppositeShowcaseThemeIndex,
  pickSpecialEffect,
  randomBetween,
  SHOWCASE_THEMES,
  shufflePickups,
} from './gameRuntime';
import {
  cloneInputState,
  resolveKeyDownAction,
  resolveKeyUpConsumed,
  resetInputState,
} from './gameInputRuntime';
import {
  applyPlaneLuckyWindToPickups,
  advancePoliceDelayCueState,
  createPoliceDelayCueState,
  dispatchPlaneDropWithFallback,
} from './planeDropRuntime';
import {
  advanceOvergrowthGrowth,
  drawOvergrowthNodes,
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
  resolveObjectiveTickStep,
  type MicroObjective,
  type ObjectiveTickEvents,
} from './microObjectiveRuntime';
import { ToastSystem, type ToastPriority } from './toastSystem';
import { rectCenter } from '../shared/utils';

export class Game {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private createWorld: () => World;
  private getPageTitle: () => string;
  private sampleSurfaceAt: (point: Vector2) => SurfaceSample;
  private setPageInverted: (active: boolean) => void;
  private setPageBlur: (active: boolean) => void;
  private setMagnetUiState: (state: {
    active: boolean;
    point: Vector2 | null;
    strength: number;
  }) => void;
  private onQuit: () => void;
  private onSoundEnabledChange: (enabled: boolean) => void;
  private onVehicleDesignChange: (design: VehicleDesign) => void;
  private onRunStarted?: (runNumber: number) => void;
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
  private policeDelayCueTimerMs: number;
  private policeDelayCueDurationMs: number;
  private planeBonusTimerMs: number;
  private coinsCollectedTotal: number;
  private specialSpawnTimerMs: number;
  private magnetTimerMs: number;
  private ghostTimerMs: number;
  private invertTimerMs: number;
  private blurTimerMs: number;
  private oilSlickTimerMs: number;
  private reverseTimerMs: number;
  private invertActive: boolean;
  private blurActive: boolean;
  private policeChase: PoliceChaseState | null;
  private policeWarning: PoliceWarningState | null;
  private planeWarning: PlaneWarningState | null;
  private policeSpawnTimerMs: number;
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
  private runNumber: number;
  private pageBestScoreAtRunStart: number;
  private newBestCelebrated: boolean;
  private getPageTintColor: (() => string | null) | undefined;
  private pageTintColor: string | null;
  private firstPlayHintTimerMs: number;
  private dailyModifier: DailyModifier;
  private lifetimeTotalScore: number;
  private viewportScaleFactor: number;
  private pageLightness: number;

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
    this.setPageBlur = options.setPageBlur;
    this.setMagnetUiState = options.setMagnetUiState;
    this.onQuit = options.onQuit;
    this.onSoundEnabledChange = options.onSoundEnabledChange;
    this.onVehicleDesignChange = options.onVehicleDesignChange;
    this.onRunStarted = options.onRunStarted;
    this.onRunFinished = options.onRunFinished;
    this.getPageTintColor = options.getPageTintColor;
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
      maxChars: TOAST.MAX_CHARS,
      maxVisible: TOAST.MAX_VISIBLE,
      duplicateWindowMs: TOAST.DUPLICATE_WINDOW_MS,
    });
    this.specialSpawnCues = [];
    this.planeBonusEvent = null;
    this.policeDelayCueTimerMs = 0;
    this.policeDelayCueDurationMs = 0;
    this.planeBonusTimerMs = randomBetween(PLANE.INITIAL_MIN_MS, PLANE.INITIAL_MAX_MS);
    this.coinsCollectedTotal = 0;
    this.specialSpawnTimerMs = randomBetween(
      SPECIALS.INITIAL_SPAWN_MIN_MS,
      SPECIALS.INITIAL_SPAWN_MAX_MS,
    );
    this.magnetTimerMs = 0;
    this.ghostTimerMs = 0;
    this.invertTimerMs = 0;
    this.blurTimerMs = 0;
    this.oilSlickTimerMs = 0;
    this.reverseTimerMs = 0;
    this.invertActive = false;
    this.blurActive = false;
    this.policeChase = null;
    this.policeWarning = null;
    this.planeWarning = null;
    this.policeSpawnTimerMs = randomBetween(
      POLICE.INITIAL_SPAWN_MIN_MS,
      POLICE.INITIAL_SPAWN_MAX_MS,
    );
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
    this.runNumber = options.initialRunCount;
    this.pageBestScoreAtRunStart = options.initialPageBestScore;
    this.newBestCelebrated = false;
    this.pageTintColor = null;
    this.firstPlayHintTimerMs = 0;
    this.dailyModifier = getDailyModifier();
    this.lifetimeTotalScore = options.initialLifetimeTotalScore;
    this.viewportScaleFactor = 1;
    this.pageLightness = 0.5;
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
    this.setBlur(false);
    this.setMagnetUiState({ active: false, point: null, strength: 0 });
    this.clearEncounterRuntimeState();
    this.clearPoliceDelayCue();
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

  showMilestoneToast(milestone: number): void {
    if (!this.player || !this.running) return;
    const text = milestone >= 10_000 ? `LT${milestone}!` : `LT ${milestone}!`;
    this.spawnEffectMessage(text, '#22d3ee', 'high');
  }

  showVehicleUnlockToast(name: string): void {
    if (!this.player || !this.running) return;
    this.spawnEffectMessage(`UNLOCKED: ${name}`, '#facc15', 'critical');
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

    this.spawnQueuedCoins(COINS.STARTING_BATCH);
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
    this.updatePoliceDelayCue(dtSeconds);

    const currentBounds = this.player.getBounds();
    const boosting = isBoosting(currentBounds, this.getActiveBoostZones());
    const onIce =
      isOnIceZone(currentBounds, this.world.iceZones) || this.dailyModifier.kind === 'SLIPPERY';
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
    const oilSlickMultiplier = this.oilSlickTimerMs > 0 ? EFFECTS.OIL_SLICK_SPEED_MULTIPLIER : 1;
    this.player.update({
      input: activeInput,
      dtSeconds,
      viewport: this.world.viewport,
      obstacles: activeObstacles,
      boosting,
      slowed,
      onIce,
      speedMultiplier: oilSlickMultiplier,
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
    if (boosting && !this.player.isAirborne() && this.player.getAngularDelta() > 0.08) {
      const pBounds = this.player.getBounds();
      spawnDriftSparkParticles(
        this.vfxParticles,
        pBounds.x + pBounds.width / 2,
        pBounds.y + pBounds.height / 2,
        this.player.getAngle(),
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

    this.updateNearMiss(dtSeconds, activeObstacles);

    const pickupStep = resolvePickupCollectionStep({
      playerBounds,
      worldPickups: this.world.pickups,
      dynamicPickups: this.dynamicPickups,
    });
    this.world.pickups = pickupStep.remainingPickups;
    this.dynamicPickups = pickupStep.dynamicPickups;
    const coinMultiplier = this.dailyModifier.kind === 'DOUBLE_COINS' ? 2 : 1;
    this.score += pickupStep.scoreGained * coinMultiplier;
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
        this.coinRefillBoostTimerMs = COINS.REFILL_BOOST_MS;
      }
      this.pageBestScore = Math.max(this.pageBestScore, this.score);
      this.lifetimeBestScore = Math.max(this.lifetimeBestScore, this.score);
    }
    this.checkNewBestCelebration();

    const coinsCollectedThisFrame = pickupStep.collectedPickups.filter(
      (p) => !isSpecialPickup(p),
    ).length;
    this.updateMicroObjective({ coinsCollectedThisFrame }, dtSeconds);

    this.updateRegularCoinSpawns(dtSeconds);
    this.updateAmbientSpecialSpawns(dtSeconds);
    this.updatePlaneBonusEvent(dtSeconds);
    this.updateOvergrowth(dtSeconds);
    this.applyMagnet(dtSeconds);
    this.updateUiEffects();

    if (this.firstPlayHintTimerMs > 0) {
      this.firstPlayHintTimerMs = Math.max(0, this.firstPlayHintTimerMs - dtSeconds * 1000);
    }

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

    setPageLightnessForSprites(this.pageLightness);
    ctx.save();
    if (this.pageTintColor) {
      ctx.fillStyle = this.pageTintColor;
      ctx.fillRect(0, 0, width, height);
    }
    drawFocusModeLayer(
      ctx,
      this.world.viewport,
      this.player ? rectCenter(this.player.getBounds()) : null,
      this.focusModeAlpha,
    );
    drawOvergrowthNodes(ctx, this.overgrowthNodes, performance.now());
    drawPlaneBonusEvent(ctx, this.planeBonusEvent, performance.now());
    drawSpecialSpawnCues(ctx, this.specialSpawnCues);
    drawPickups(ctx, this.world.pickups, performance.now());
    drawVfxParticles(ctx, this.vfxParticles);
    const renderSpeed = this.player.getLastStepDiagnostics().speed;
    drawSpeedLines(
      ctx,
      rectCenter(this.player.getBounds()).x,
      rectCenter(this.player.getBounds()).y,
      this.player.getAngle(),
      renderSpeed,
      PLAYER.BOOST_SPEED,
    );
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
      blurTimerMs: this.blurTimerMs,
      oilSlickTimerMs: this.oilSlickTimerMs,
      reverseTimerMs: this.reverseTimerMs,
      policeDelayCueTimerMs: this.policeDelayCueTimerMs,
      policeDelayCueDurationMs: this.policeDelayCueDurationMs,
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
      viewportScaleFactor: this.viewportScaleFactor,
    });
    drawHud(ctx, this.world.viewport, hudState);

    if (this.firstPlayHintTimerMs > 0) {
      const hintAlpha = this.firstPlayHintTimerMs < 500 ? this.firstPlayHintTimerMs / 500 : 1;
      drawFirstPlayHintOverlay({
        ctx,
        viewport: this.world.viewport,
        alpha: hintAlpha,
      });
    }
  }

  private drawSpriteShowcase(): void {
    if (!this.world) {
      return;
    }
    setPageLightnessForSprites(this.spriteShowcasePageLightness);
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
        const effectiveTotal = this.lifetimeTotalScore + this.score;
        const nextVehicleDesign = getNextUnlockedVehicleDesign(this.vehicleDesign, effectiveTotal);
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
    const raw = cloneInputState(this.input);
    if (this.reverseTimerMs > 0) {
      return { up: raw.down, down: raw.up, left: raw.right, right: raw.left };
    }
    return raw;
  }

  private spawnCoinPickupMessage(pickup: World['pickups'][number]): void {
    const centerX = pickup.rect.x + pickup.rect.width / 2;
    const centerY = pickup.rect.y + pickup.rect.height / 2;
    const coinMultiplier = this.dailyModifier.kind === 'DOUBLE_COINS' ? 2 : 1;
    const amount = (pickup.value || COINS.SCORE) * coinMultiplier;
    const text = `+${amount}`;

    this.toastSystem.enqueue({
      x: centerX,
      y: centerY - 18,
      text,
      ttlMs: TOAST.PICKUP_TTL_MS,
      color: '#fde047',
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
        : randomBetween(COINS.RETRY_MIN_MS, COINS.RETRY_MAX_MS);
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
      planeRouteActive: false,
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
    const overgrowthStartMs = this.dailyModifier.kind === 'EARLY_OVERGROWTH' ? 15_000 : undefined;
    const step = resolveOvergrowthSpawnStep({
      overgrowthSpawnTimerMs: this.overgrowthSpawnTimerMs,
      runElapsedMs,
      existingNodeCount: this.overgrowthNodes.length,
      dtSeconds,
      spawnStartMs: overgrowthStartMs,
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
      this.audio.playNearMissWhoosh();
      this.toastSystem.enqueue({
        x: this.player.getBounds().x + this.player.getBounds().width / 2,
        y: this.player.getBounds().y - 18,
        text: step.messageText,
        ttlMs: NEAR_MISS_TOAST_TTL_MS,
        color: NEAR_MISS_COLOR,
        priority: 'low',
      });
      this.checkNewBestCelebration();
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
      this.score += step.completedBonus;
      this.pageBestScore = Math.max(this.pageBestScore, this.score);
      this.lifetimeBestScore = Math.max(this.lifetimeBestScore, this.score);
      this.audio.playObjectiveChime();
      const word = getObjectiveCompletionWord(step.completedCount - 1);
      this.spawnEffectMessage(
        `${word} +${step.completedBonus}`,
        OBJECTIVE_COMPLETION_COLOR,
        'high',
      );
      if (this.player) {
        this.player.triggerCelebration();
        const pb = this.player.getBounds();
        spawnCelebrationParticles(this.vfxParticles, pb.x + pb.width / 2, pb.y + pb.height / 2);
      }
      this.checkNewBestCelebration();
    }
  }

  private updatePlaneBonusEvent(dtSeconds: number): void {
    if (!this.world) {
      return;
    }

    if (!this.planeBonusEvent) {
      const schedulingStep = resolvePlaneEncounterSchedulingStep({
        planeBonusTimerMs: this.planeBonusTimerMs,
        hasRunProgress: this.score >= PLANE.EVENT_MIN_SCORE || this.coinsCollectedTotal >= 4,
        policeOrWarningActive: Boolean(this.policeChase) || Boolean(this.policeWarning),
        dtSeconds,
      });
      this.planeBonusTimerMs = schedulingStep.planeBonusTimerMs;

      if (schedulingStep.shouldStartEncounter) {
        const encounter = createPlaneBonusEncounter(this.world.viewport);
        this.planeBonusEvent = encounter.planeBonusEvent;
        this.planeWarning = encounter.planeWarning;
        // edge indicator is sufficient — no toast for plane
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
    const droneProgress =
      this.planeBonusEvent.distancePx > 0
        ? this.planeBonusEvent.traveledPx / this.planeBonusEvent.distancePx
        : 0;
    this.audio.updatePropellerDrone(true, droneProgress);
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
      this.audio.updatePropellerDrone(false, 1);
      this.planeBonusEvent = null;
      this.planeBonusTimerMs = randomBetween(PLANE.RESPAWN_MIN_MS, PLANE.RESPAWN_MAX_MS);
      this.policeSpawnTimerMs = Math.max(
        this.policeSpawnTimerMs,
        randomBetween(ENCOUNTER.POLICE_AFTER_PLANE_MIN_MS, ENCOUNTER.POLICE_AFTER_PLANE_MAX_MS),
      );
    }
  }

  private spawnPlaneBonusDrop(x: number, y: number): boolean {
    if (!this.world) {
      return false;
    }

    const rect =
      this.findFreePickupRectNear({ x, y }, PLANE.BONUS_PICKUP_SIZE, 22) ??
      this.findFreePickupRect(PLANE.BONUS_PICKUP_SIZE);
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
        value: COINS.SCORE,
        kind: 'coin',
      });
    }

    if (trailPickups.length < 3) {
      return false;
    }

    for (const pickup of trailPickups) {
      this.world.pickups.push(pickup);
    }

    this.specialSpawnTimerMs = Math.max(this.specialSpawnTimerMs, PLANE.LANE_SPECIAL_STAGGER_MS);
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
    this.enqueueSpecialSpawnCue(target, PLANE.SPOTLIGHT_CUE_DURATION_MS);
    this.specialSpawnTimerMs = Math.max(this.specialSpawnTimerMs, PLANE.LANE_SPECIAL_STAGGER_MS);
    this.audio.playPlaneDrop();
    this.spawnEffectMessage('SPOTLIGHT', '#fde047', 'high');
    return true;
  }

  private spawnPlanePoliceDelay(): boolean {
    if (this.policeChase?.phase === 'chasing') {
      return false;
    }

    const delayMs = randomBetween(PLANE.POLICE_DELAY_MIN_MS, PLANE.POLICE_DELAY_MAX_MS);
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

    this.specialSpawnTimerMs = Math.max(this.specialSpawnTimerMs, PLANE.LANE_SPECIAL_STAGGER_MS);
    this.audio.playPlaneDrop();
    this.spawnEffectMessage('L-WIND', '#86efac', 'high');
    return true;
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
    if (existingSpecials >= SPECIALS.VISIBLE_CAP) {
      return false;
    }

    const isJackpot = Math.random() < JACKPOT.SPAWN_CHANCE;
    const pickupSize = isJackpot ? JACKPOT.PICKUP_SIZE : 20;
    const rect = this.findFreePickupRect(pickupSize);
    if (!rect) {
      return false;
    }

    const surface = this.sampleSurfaceAt({
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    });
    const effect = isJackpot ? ('jackpot' as const) : pickSpecialEffect(surface);
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
    const scaledTimer = activation.timerMs * this.viewportScaleFactor;

    switch (activation.resolvedEffect) {
      case 'invert':
        this.invertTimerMs = scaledTimer;
        break;
      case 'magnet':
        this.magnetTimerMs = scaledTimer;
        break;
      case 'ghost':
        this.ghostTimerMs = scaledTimer;
        break;
      case 'blur':
        this.blurTimerMs = scaledTimer;
        break;
      case 'oil_slick':
        this.oilSlickTimerMs = scaledTimer;
        break;
      case 'reverse':
        this.reverseTimerMs = scaledTimer;
        break;
      case 'bonus':
      case 'jackpot':
      case 'mystery':
        break;
    }

    if (activation.setInverted) {
      this.setInverted(true);
    }
    if (activation.setBlur) {
      this.setBlur(true);
    }

    this.spawnEffectMessage(activation.messageText, activation.messageColor, 'high');
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

  private updateUiEffects(): void {
    this.setMagnetUiState({ active: false, point: null, strength: 0 });
  }

  private updatePoliceChase(dtSeconds: number): {
    active: boolean;
    urgency: number;
    caught: boolean;
  } {
    if (!this.world || !this.player) {
      return { active: false, urgency: 0, caught: false };
    }

    const playerBounds = this.player.getBounds();
    const step = resolvePoliceChaseTickStep({
      viewport: this.world.viewport,
      iceZones: this.world.iceZones,
      playerBounds,
      playerCenter: rectCenter(playerBounds),
      ghostActive: this.ghostTimerMs > 0,
      policeChase: this.policeChase,
      policeWarning: this.policeWarning,
      policeSpawnTimerMs: this.policeSpawnTimerMs,
      planeBonusActive: Boolean(this.planeBonusEvent),
      planeWarningActive: Boolean(this.planeWarning),
      score: this.score,
      hasRunProgress:
        this.score >= POLICE.START_SCORE_THRESHOLD ||
        this.coinsCollectedTotal >= POLICE.START_COINS_THRESHOLD,
      runElapsedMs: this.startTimeMs > 0 ? performance.now() - this.startTimeMs : 0,
      dtSeconds,
      viewportScaleFactor: this.viewportScaleFactor,
    });

    this.policeChase = step.policeChase;
    this.policeWarning = step.policeWarning;
    this.policeSpawnTimerMs = step.policeSpawnTimerMs;
    if (step.planeBonusTimerMs !== null) {
      this.planeBonusTimerMs = step.planeBonusTimerMs;
    }

    for (const event of step.events) {
      switch (event) {
        case 'ghost-dismiss':
          this.spawnEffectMessage('NO TRACE', '#c4b5fd', 'high');
          break;
        case 'warning-started':
          this.audio.playPoliceAlert();
          break;
        case 'chase-spawned':
          break;
        case 'escaped':
          this.spawnEffectMessage('ESCAPED', '#86efac', 'high');
          if (this.player) {
            this.player.triggerCelebration();
            const pb = this.player.getBounds();
            spawnEscapedCelebrationParticles(
              this.vfxParticles,
              pb.x + pb.width / 2,
              pb.y + pb.height / 2,
            );
          }
          this.audio.playObjectiveChime();
          break;
        case 'caught':
          this.enterCaughtGameOver();
          break;
      }
    }

    return { active: step.active, urgency: step.urgency, caught: step.caught };
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
        blurTimerMs: this.blurTimerMs,
        oilSlickTimerMs: this.oilSlickTimerMs,
        reverseTimerMs: this.reverseTimerMs,
      },
      dtSeconds,
    );
    this.magnetTimerMs = timers.magnetTimerMs;
    this.ghostTimerMs = timers.ghostTimerMs;
    this.invertTimerMs = timers.invertTimerMs;
    this.blurTimerMs = timers.blurTimerMs;
    this.oilSlickTimerMs = timers.oilSlickTimerMs;
    this.reverseTimerMs = timers.reverseTimerMs;

    if (timers.invertExpired) {
      this.setInverted(false);
    }
    if (timers.blurExpired) {
      this.setBlur(false);
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

  private setBlur(active: boolean): void {
    if (this.blurActive === active) {
      return;
    }

    this.blurActive = active;
    this.setPageBlur(active);
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
      ttlMs: TOAST.EFFECT_TTL_MS,
      color,
      priority,
    });
  }

  private spawnRunStartMessage(
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
      ttlMs: TOAST.RUN_START_TTL_MS,
      color,
      priority,
    });
  }

  private checkNewBestCelebration(): void {
    if (
      this.newBestCelebrated ||
      this.pageBestScoreAtRunStart <= 0 ||
      this.score <= this.pageBestScoreAtRunStart
    ) {
      return;
    }
    this.newBestCelebrated = true;
    this.spawnEffectMessage('NEW BEST!', '#facc15', 'high');
    if (this.player) {
      const b = this.player.getBounds();
      spawnNewBestBurstParticles(this.vfxParticles, b.x + b.width / 2, b.y + b.height / 2);
    }
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
    this.blurTimerMs = cleared.blurTimerMs;
    this.oilSlickTimerMs = cleared.oilSlickTimerMs;
    this.reverseTimerMs = cleared.reverseTimerMs;
  }

  private beginRun(): void {
    this.runNumber += 1;
    this.pageBestScoreAtRunStart = this.pageBestScore;
    this.newBestCelebrated = false;
    this.onRunStarted?.(this.runNumber);
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
    this.setBlur(false);
    this.setMagnetUiState({ active: false, point: null, strength: 0 });
    this.clearEncounterRuntimeState();
    this.clearPoliceDelayCue();
    this.policeSpawnTimerMs = nextRunState.policeSpawnTimerMs;
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
    this.pageTintColor = this.getPageTintColor?.() ?? null;
    this.applyWorld(this.createWorld(), true);
    this.lastFrameMs = nextRunState.lastFrameMs;

    if (this.world) {
      this.viewportScaleFactor = computeViewportScaleFactor(this.world.viewport);
    }

    this.pageLightness = this.estimatePageLightness();

    this.dailyModifier = getDailyModifier();
    if (this.dailyModifier.kind === 'FAST_POLICE') {
      this.policeSpawnTimerMs = Math.round(this.policeSpawnTimerMs * 0.7);
    }
    if (this.dailyModifier.kind === 'EXTRA_SPECIALS') {
      this.specialSpawnTimerMs = Math.round(this.specialSpawnTimerMs * 0.6);
    }

    this.firstPlayHintTimerMs = this.runNumber === 1 ? 4500 : 0;
    this.spawnRunStartMessage(`RUN #${this.runNumber}`, '#e2e8f0', 'medium');
    this.spawnRunStartMessage(`TODAY: ${this.dailyModifier.label}`, '#67e8f9', 'low');
  }

  private enterCaughtGameOver(): void {
    const transition = createCaughtGameOverTransitionState(performance.now());
    this.finishCurrentRun('caught');
    this.startTimeMs = transition.startTimeMs;
    this.setInverted(false);
    this.setBlur(false);
    this.setMagnetUiState({ active: false, point: null, strength: 0 });
    this.audio.stop();
    this.clearEffectRuntimeState();
    this.clearEncounterRuntimeState();
    this.clearPoliceDelayCue();
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
    this.setBlur(false);
    this.setMagnetUiState({ active: false, point: null, strength: 0 });
    this.clearEffectRuntimeState();
    this.clearEncounterRuntimeState();
    this.clearPoliceDelayCue();
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
      runNumber: this.runNumber,
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

    if (this.gameOverState) {
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
      const pauseDurationMs = performance.now() - this.pausedStartedAtMs;
      if (this.startTimeMs > 0) {
        this.startTimeMs += pauseDurationMs;
      }
      this.resetInput();
    }
  }
}
