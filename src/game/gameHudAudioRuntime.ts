import type { HudState, InputState } from '../shared/types';
import { getActiveEffectsForHud } from './gameEffectsRuntime';
import type { SurfaceSample } from './gameStateTypes';
import { getFlavorText } from './gameRuntime';
import {
  getObjectiveHudText,
  getObjectiveProgress,
  type MicroObjective,
} from './microObjectiveRuntime';

interface BuildHudStateOptions {
  score: number;
  elapsedMs: number;
  pageTitle: string;
  pickupsRemaining: number;
  scannedCount: number;
  airborne: boolean;
  boostActive: boolean;
  soundEnabled: boolean;
  pageBestScore: number;
  lifetimeBestScore: number;
  magnetTimerMs: number;
  ghostTimerMs: number;
  invertTimerMs: number;
  blurTimerMs: number;
  oilSlickTimerMs: number;
  reverseTimerMs: number;
  policeDelayCueTimerMs: number;
  policeDelayCueDurationMs: number;
  policeRemainingMs: number | null;
  policeDurationMs: number | null;
  planeActive: boolean;
  planeWarningActive: boolean;
  planeWarningRemainingMs: number | null;
  planeWarningDurationMs: number | null;
  policeActive: boolean;
  policeWarningActive: boolean;
  policeWarningRemainingMs: number | null;
  policeWarningDurationMs: number | null;
  nearMissCount: number;
  objectivesCompleted: number;
  objectiveActive: MicroObjective | null;
  currentSurface: SurfaceSample;
  viewportScaleFactor?: number;
}

export function isDriveInputActive(input: InputState): boolean {
  return input.up || input.down || input.left || input.right;
}

/** Assembles the complete HUD display state from current game parameters. */
export function buildHudState(options: BuildHudStateOptions): HudState {
  const activeEffects = getActiveEffectsForHud({
    magnetTimerMs: options.magnetTimerMs,
    ghostTimerMs: options.ghostTimerMs,
    invertTimerMs: options.invertTimerMs,
    blurTimerMs: options.blurTimerMs,
    oilSlickTimerMs: options.oilSlickTimerMs,
    reverseTimerMs: options.reverseTimerMs,
    policeRemainingMs: null,
    policeDurationMs: null,
    currentSurface: options.currentSurface,
    viewportScaleFactor: options.viewportScaleFactor,
  });
  if (
    options.policeDelayCueTimerMs > 0 &&
    options.policeDelayCueDurationMs > 0 &&
    !options.policeActive
  ) {
    activeEffects.push({
      effect: 'police',
      label: 'HOLD-UP',
      remainingMs: options.policeDelayCueTimerMs,
      durationMs: options.policeDelayCueDurationMs,
      color: '#93c5fd',
    });
  }
  activeEffects.sort((left, right) => right.remainingMs - left.remainingMs);

  return {
    score: options.score,
    elapsedMs: options.elapsedMs,
    pageTitle: options.pageTitle,
    pickupsRemaining: options.pickupsRemaining,
    scannedCount: options.scannedCount,
    airborne: options.airborne,
    boostActive: options.boostActive,
    soundEnabled: options.soundEnabled,
    flavorText: getFlavorText({
      score: options.score,
      airborne: options.airborne,
      boostActive: options.boostActive,
      magnetActive: options.magnetTimerMs > 0,
      ghostActive: options.ghostTimerMs > 0,
      invertActive: options.invertTimerMs > 0,
      blurActive: options.blurTimerMs > 0,
      oilSlickActive: options.oilSlickTimerMs > 0,
      reverseActive: options.reverseTimerMs > 0,
      nearMissCount: options.nearMissCount,
      objectivesCompleted: options.objectivesCompleted,
      planeActive: options.planeActive,
      planeWarningActive: options.planeWarningActive,
      policeActive: options.policeActive,
      policeWarningActive: options.policeWarningActive,
      policeDelayActive: options.policeDelayCueTimerMs > 0 && options.policeDelayCueDurationMs > 0,
    }),
    pageBestScore: Math.max(options.pageBestScore, options.score),
    lifetimeBestScore: Math.max(options.lifetimeBestScore, options.score),
    objectiveText: options.objectiveActive ? getObjectiveHudText(options.objectiveActive) : null,
    objectiveProgress: options.objectiveActive ? getObjectiveProgress(options.objectiveActive) : 0,
    objectiveTimeRemainingMs: options.objectiveActive
      ? options.objectiveActive.timeRemainingMs
      : null,
    objectiveTimeLimitMs: options.objectiveActive ? options.objectiveActive.timeLimitMs : null,
    objectiveMultiplierLabel: options.objectiveActive
      ? options.objectiveActive.multiplierLabel
      : null,
    policeChaseRemainingMs: options.policeActive ? options.policeRemainingMs : null,
    policeChaseDurationMs: options.policeActive ? options.policeDurationMs : null,
    activeEffects,
  };
}
