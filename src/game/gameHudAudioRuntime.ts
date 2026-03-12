import type { HudState, InputState } from '../shared/types';
import { getActiveEffectsForHud } from './gameEffectsRuntime';
import { adaptBlackoutEffectForSurface, getFlavorText } from './gameRuntime';
import type { SurfaceSample } from './gameRuntime';

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
  blackoutTimerMs: number;
  policeDelayCueTimerMs: number;
  policeDelayCueDurationMs: number;
  comboTimerMs: number;
  pickupComboCount: number;
  policeRemainingMs: number | null;
  policeDurationMs: number | null;
  policeActive: boolean;
  currentSurface: SurfaceSample;
}

export function isDriveInputActive(input: InputState): boolean {
  return input.up || input.down || input.left || input.right;
}

export function buildHudState(options: BuildHudStateOptions): HudState {
  const blackoutActsAsInvert =
    options.blackoutTimerMs > 0 &&
    adaptBlackoutEffectForSurface('blackout', options.currentSurface) === 'invert';
  const activeEffects = getActiveEffectsForHud({
    magnetTimerMs: options.magnetTimerMs,
    ghostTimerMs: options.ghostTimerMs,
    invertTimerMs: options.invertTimerMs,
    blackoutTimerMs: options.blackoutTimerMs,
    comboTimerMs: options.comboTimerMs,
    pickupComboCount: options.pickupComboCount,
    policeRemainingMs: options.policeRemainingMs,
    policeDurationMs: options.policeDurationMs,
    currentSurface: options.currentSurface,
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
    activeEffects.sort((left, right) => right.remainingMs - left.remainingMs);
  }

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
      invertActive: options.invertTimerMs > 0 || blackoutActsAsInvert,
      blackoutActive: options.blackoutTimerMs > 0 && !blackoutActsAsInvert,
      policeActive: options.policeActive,
    }),
    pageBestScore: Math.max(options.pageBestScore, options.score),
    lifetimeBestScore: Math.max(options.lifetimeBestScore, options.score),
    activeEffects,
  };
}
