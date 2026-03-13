import type { HudState, SpecialEffect, Vector2, WorldPickup } from '../shared/types';
import { EFFECTS, JACKPOT, SPECIALS } from './gameConfig';
import type { SurfaceSample } from './gameStateTypes';
import {
  getSpecialActivationMessage,
  getSpecialColor,
  getSpecialHudLabel,
  randomBetween,
} from './gameRuntime';

interface EffectTimerState {
  magnetTimerMs: number;
  ghostTimerMs: number;
  invertTimerMs: number;
  blurTimerMs: number;
  oilSlickTimerMs: number;
  reverseTimerMs: number;
}

interface EffectTimerUpdateResult extends EffectTimerState {
  invertExpired: boolean;
  blurExpired: boolean;
}

interface ActiveEffectsInput {
  magnetTimerMs: number;
  ghostTimerMs: number;
  invertTimerMs: number;
  blurTimerMs: number;
  oilSlickTimerMs: number;
  reverseTimerMs: number;
  policeRemainingMs: number | null;
  policeDurationMs: number | null;
  currentSurface: SurfaceSample;
  viewportScaleFactor?: number;
}

/** Decrements all active effect timers and flags any that just expired. */
export function tickEffectTimers(
  state: EffectTimerState,
  dtSeconds: number,
): EffectTimerUpdateResult {
  const deltaMs = dtSeconds * 1000;
  const nextInvertTimerMs = Math.max(0, state.invertTimerMs - deltaMs);
  const nextBlurTimerMs = Math.max(0, state.blurTimerMs - deltaMs);

  return {
    magnetTimerMs: Math.max(0, state.magnetTimerMs - deltaMs),
    ghostTimerMs: Math.max(0, state.ghostTimerMs - deltaMs),
    invertTimerMs: nextInvertTimerMs,
    blurTimerMs: nextBlurTimerMs,
    oilSlickTimerMs: Math.max(0, state.oilSlickTimerMs - deltaMs),
    reverseTimerMs: Math.max(0, state.reverseTimerMs - deltaMs),
    invertExpired: state.invertTimerMs > 0 && nextInvertTimerMs === 0,
    blurExpired: state.blurTimerMs > 0 && nextBlurTimerMs === 0,
  };
}

/** Pulls all nearby pickups toward the player position (magnet effect). */
export function applyMagnetPullToPickups(
  worldPickups: WorldPickup[],
  playerCenter: Vector2,
  dtSeconds: number,
): void {
  for (const pickup of worldPickups) {
    const pickupCenter = {
      x: pickup.rect.x + pickup.rect.width / 2,
      y: pickup.rect.y + pickup.rect.height / 2,
    };
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

export interface SpecialEffectActivation {
  resolvedEffect: SpecialEffect;
  scoreBonus: number;
  timerMs: number;
  messageText: string;
  messageColor: string;
  setInverted: boolean;
  setBlur: boolean;
}

/** Resolves a special effect into its activation parameters (score, timer, messages). */
export function resolveSpecialEffectActivation(
  effect: SpecialEffect,
  surface: SurfaceSample,
): SpecialEffectActivation {
  switch (effect) {
    case 'bonus':
      return {
        resolvedEffect: 'bonus',
        scoreBonus: SPECIALS.BONUS_SCORE,
        timerMs: 0,
        messageText: getSpecialActivationMessage('bonus'),
        messageColor: getSpecialColor('bonus'),
        setInverted: false,
        setBlur: false,
      };
    case 'invert':
      return {
        resolvedEffect: 'invert',
        scoreBonus: 0,
        timerMs: EFFECTS.INVERT_DURATION_MS,
        messageText: getSpecialActivationMessage('invert'),
        messageColor: getSpecialColor('invert'),
        setInverted: true,
        setBlur: false,
      };
    case 'magnet':
      return {
        resolvedEffect: 'magnet',
        scoreBonus: 0,
        timerMs: EFFECTS.MAGNET_DURATION_MS,
        messageText: getSpecialActivationMessage('magnet'),
        messageColor: getSpecialColor('magnet'),
        setInverted: false,
        setBlur: false,
      };
    case 'ghost':
      return {
        resolvedEffect: 'ghost',
        scoreBonus: 0,
        timerMs: EFFECTS.GHOST_DURATION_MS,
        messageText: getSpecialActivationMessage('ghost'),
        messageColor: getSpecialColor('ghost'),
        setInverted: false,
        setBlur: false,
      };
    case 'blur':
      return {
        resolvedEffect: 'blur',
        scoreBonus: 0,
        timerMs: EFFECTS.BLUR_DURATION_MS,
        messageText: getSpecialActivationMessage('blur'),
        messageColor: getSpecialColor('blur'),
        setInverted: false,
        setBlur: true,
      };
    case 'oil_slick':
      return {
        resolvedEffect: 'oil_slick',
        scoreBonus: 0,
        timerMs: EFFECTS.OIL_SLICK_DURATION_MS,
        messageText: getSpecialActivationMessage('oil_slick'),
        messageColor: getSpecialColor('oil_slick'),
        setInverted: false,
        setBlur: false,
      };
    case 'reverse':
      return {
        resolvedEffect: 'reverse',
        scoreBonus: 0,
        timerMs: EFFECTS.REVERSE_DURATION_MS,
        messageText: getSpecialActivationMessage('reverse'),
        messageColor: getSpecialColor('reverse'),
        setInverted: false,
        setBlur: false,
      };
    case 'mystery': {
      const pool: SpecialEffect[] = [
        'bonus',
        'magnet',
        'invert',
        'ghost',
        'blur',
        'oil_slick',
        'reverse',
      ];
      const resolved = pool[Math.floor(Math.random() * pool.length)];
      const inner = resolveSpecialEffectActivation(resolved, surface);
      return {
        ...inner,
        messageText: getSpecialActivationMessage('mystery'),
        messageColor: getSpecialColor('mystery'),
      };
    }
    case 'jackpot': {
      const jackpotBonus = Math.floor(randomBetween(JACKPOT.SCORE_MIN, JACKPOT.SCORE_MAX));
      return {
        resolvedEffect: 'jackpot',
        scoreBonus: jackpotBonus,
        timerMs: 0,
        messageText: getSpecialActivationMessage('jackpot'),
        messageColor: getSpecialColor('jackpot'),
        setInverted: false,
        setBlur: false,
      };
    }
  }
}

export function getActiveEffectsForHud(input: ActiveEffectsInput): HudState['activeEffects'] {
  const effects: HudState['activeEffects'] = [];
  const sf = input.viewportScaleFactor ?? 1;

  if (input.magnetTimerMs > 0) {
    effects.push({
      effect: 'magnet',
      label: getSpecialHudLabel('magnet'),
      remainingMs: input.magnetTimerMs,
      durationMs: EFFECTS.MAGNET_DURATION_MS * sf,
      color: getSpecialColor('magnet'),
    });
  }

  if (input.invertTimerMs > 0) {
    effects.push({
      effect: 'invert',
      label: getSpecialHudLabel('invert'),
      remainingMs: input.invertTimerMs,
      durationMs: EFFECTS.INVERT_DURATION_MS * sf,
      color: getSpecialColor('invert'),
    });
  }

  if (input.ghostTimerMs > 0) {
    effects.push({
      effect: 'ghost',
      label: getSpecialHudLabel('ghost'),
      remainingMs: input.ghostTimerMs,
      durationMs: EFFECTS.GHOST_DURATION_MS * sf,
      color: getSpecialColor('ghost'),
    });
  }

  if (input.blurTimerMs > 0) {
    effects.push({
      effect: 'blur',
      label: getSpecialHudLabel('blur'),
      remainingMs: input.blurTimerMs,
      durationMs: EFFECTS.BLUR_DURATION_MS * sf,
      color: getSpecialColor('blur'),
    });
  }

  if (input.oilSlickTimerMs > 0) {
    effects.push({
      effect: 'oil_slick',
      label: getSpecialHudLabel('oil_slick'),
      remainingMs: input.oilSlickTimerMs,
      durationMs: EFFECTS.OIL_SLICK_DURATION_MS * sf,
      color: getSpecialColor('oil_slick'),
    });
  }

  if (input.reverseTimerMs > 0) {
    effects.push({
      effect: 'reverse',
      label: getSpecialHudLabel('reverse'),
      remainingMs: input.reverseTimerMs,
      durationMs: EFFECTS.REVERSE_DURATION_MS * sf,
      color: getSpecialColor('reverse'),
    });
  }

  if (input.policeRemainingMs !== null && input.policeDurationMs !== null) {
    effects.push({
      effect: 'police',
      label: 'POLICE',
      remainingMs: input.policeRemainingMs,
      durationMs: input.policeDurationMs,
      color: '#60a5fa',
    });
  }

  return effects.sort((left, right) => right.remainingMs - left.remainingMs);
}
