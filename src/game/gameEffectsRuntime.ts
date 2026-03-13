import type { HudState, SpecialEffect, Vector2, WorldPickup } from '../shared/types';
import { EFFECTS, JACKPOT, SPECIALS, TIMING } from './gameConfig';
import type { SurfaceSample } from './gameStateTypes';
import {
  adaptBlackoutEffectForSurface,
  getSpecialActivationMessage,
  getSpecialColor,
  getSpecialHudLabel,
  randomBetween,
} from './gameRuntime';

interface EffectTimerState {
  magnetTimerMs: number;
  ghostTimerMs: number;
  invertTimerMs: number;
  blackoutTimerMs: number;
  lureTimerMs: number;
  comboTimerMs: number;
  pickupComboCount: number;
}

interface EffectTimerUpdateResult extends EffectTimerState {
  invertExpired: boolean;
  blackoutExpired: boolean;
}

interface ActiveEffectsInput {
  magnetTimerMs: number;
  ghostTimerMs: number;
  invertTimerMs: number;
  blackoutTimerMs: number;
  lureTimerMs: number;
  comboTimerMs: number;
  pickupComboCount: number;
  policeRemainingMs: number | null;
  policeDurationMs: number | null;
  currentSurface: SurfaceSample;
}

interface PickupComboResult {
  pickupComboCount: number;
  comboTimerMs: number;
  bonus: number;
  flowTier: number | null;
}

/** Decrements all active effect timers and flags any that just expired. */
export function tickEffectTimers(
  state: EffectTimerState,
  dtSeconds: number,
): EffectTimerUpdateResult {
  const deltaMs = dtSeconds * 1000;
  const nextInvertTimerMs = Math.max(0, state.invertTimerMs - deltaMs);
  const nextBlackoutTimerMs = Math.max(0, state.blackoutTimerMs - deltaMs);
  const nextComboTimerMs = Math.max(0, state.comboTimerMs - deltaMs);

  return {
    magnetTimerMs: Math.max(0, state.magnetTimerMs - deltaMs),
    ghostTimerMs: Math.max(0, state.ghostTimerMs - deltaMs),
    invertTimerMs: nextInvertTimerMs,
    blackoutTimerMs: nextBlackoutTimerMs,
    lureTimerMs: Math.max(0, state.lureTimerMs - deltaMs),
    comboTimerMs: nextComboTimerMs,
    pickupComboCount: nextComboTimerMs === 0 ? 0 : state.pickupComboCount,
    invertExpired: state.invertTimerMs > 0 && nextInvertTimerMs === 0,
    blackoutExpired: state.blackoutTimerMs > 0 && nextBlackoutTimerMs === 0,
  };
}

/** Updates the pickup combo chain and returns the bonus score for this collection. */
export function applyPickupComboState(
  comboTimerMs: number,
  pickupComboCount: number,
): PickupComboResult {
  const nextPickupComboCount = comboTimerMs > 0 ? pickupComboCount + 1 : 1;
  const bonus = nextPickupComboCount < 3 ? 0 : Math.min(14, 2 + (nextPickupComboCount - 3) * 2);
  const flowTier = [3, 5, 8, 12].includes(nextPickupComboCount) ? nextPickupComboCount : null;

  return {
    pickupComboCount: nextPickupComboCount,
    comboTimerMs: TIMING.COMBO_WINDOW_MS,
    bonus,
    flowTier,
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

/** Gently pulls nearby regular coins toward the player (lure effect, ignores specials). */
export function applyLurePullToPickups(
  worldPickups: WorldPickup[],
  playerCenter: Vector2,
  dtSeconds: number,
): void {
  for (const pickup of worldPickups) {
    if (pickup.kind === 'special') {
      continue;
    }

    const pickupCenter = {
      x: pickup.rect.x + pickup.rect.width / 2,
      y: pickup.rect.y + pickup.rect.height / 2,
    };
    const dx = playerCenter.x - pickupCenter.x;
    const dy = playerCenter.y - pickupCenter.y;
    const distance = Math.hypot(dx, dy);

    if (distance > EFFECTS.LURE_PULL_RADIUS || distance < 1) {
      continue;
    }

    const pull = Math.min(120, 40 + (EFFECTS.LURE_PULL_RADIUS - distance) * 0.35) * dtSeconds;
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
  policeDelayMs: number;
  messageText: string;
  messageColor: string;
  setInverted: boolean;
  setBlackout: boolean;
}

/** Resolves a special effect into its activation parameters (score, timer, messages). */
export function resolveSpecialEffectActivation(
  effect: SpecialEffect,
  surface: SurfaceSample,
): SpecialEffectActivation {
  const resolvedEffect = adaptBlackoutEffectForSurface(effect, surface);
  switch (resolvedEffect) {
    case 'bonus':
      return {
        resolvedEffect,
        scoreBonus: SPECIALS.BONUS_SCORE,
        timerMs: 0,
        policeDelayMs: 0,
        messageText: getSpecialActivationMessage('bonus'),
        messageColor: getSpecialColor('bonus'),
        setInverted: false,
        setBlackout: false,
      };
    case 'invert':
      return {
        resolvedEffect,
        scoreBonus: 0,
        timerMs: EFFECTS.INVERT_DURATION_MS,
        policeDelayMs: 0,
        messageText: getSpecialActivationMessage('invert'),
        messageColor: getSpecialColor('invert'),
        setInverted: true,
        setBlackout: false,
      };
    case 'magnet':
      return {
        resolvedEffect,
        scoreBonus: 0,
        timerMs: EFFECTS.MAGNET_DURATION_MS,
        policeDelayMs: 0,
        messageText: getSpecialActivationMessage('magnet'),
        messageColor: getSpecialColor('magnet'),
        setInverted: false,
        setBlackout: false,
      };
    case 'ghost':
      return {
        resolvedEffect,
        scoreBonus: 0,
        timerMs: EFFECTS.GHOST_DURATION_MS,
        policeDelayMs: 0,
        messageText: getSpecialActivationMessage('ghost'),
        messageColor: getSpecialColor('ghost'),
        setInverted: false,
        setBlackout: false,
      };
    case 'blackout':
      return {
        resolvedEffect,
        scoreBonus: 0,
        timerMs: EFFECTS.BLACKOUT_DURATION_MS,
        policeDelayMs: 0,
        messageText: getSpecialActivationMessage('blackout'),
        messageColor: getSpecialColor('blackout'),
        setInverted: false,
        setBlackout: true,
      };
    case 'cooldown':
      return {
        resolvedEffect,
        scoreBonus: EFFECTS.COOLDOWN_SCORE_BONUS,
        timerMs: 0,
        policeDelayMs: randomBetween(
          EFFECTS.COOLDOWN_POLICE_DELAY_MIN_MS,
          EFFECTS.COOLDOWN_POLICE_DELAY_MAX_MS,
        ),
        messageText: getSpecialActivationMessage('cooldown'),
        messageColor: getSpecialColor('cooldown'),
        setInverted: false,
        setBlackout: false,
      };
    case 'lure':
      return {
        resolvedEffect,
        scoreBonus: 0,
        timerMs: EFFECTS.LURE_DURATION_MS,
        policeDelayMs: 0,
        messageText: getSpecialActivationMessage('lure'),
        messageColor: getSpecialColor('lure'),
        setInverted: false,
        setBlackout: false,
      };
    case 'jackpot': {
      const jackpotBonus = Math.floor(randomBetween(JACKPOT.SCORE_MIN, JACKPOT.SCORE_MAX));
      return {
        resolvedEffect,
        scoreBonus: jackpotBonus,
        timerMs: 0,
        policeDelayMs: 0,
        messageText: getSpecialActivationMessage('jackpot'),
        messageColor: getSpecialColor('jackpot'),
        setInverted: false,
        setBlackout: false,
      };
    }
  }
}

export function getActiveEffectsForHud(input: ActiveEffectsInput): HudState['activeEffects'] {
  const effects: HudState['activeEffects'] = [];

  if (input.magnetTimerMs > 0) {
    effects.push({
      effect: 'magnet',
      label: getSpecialHudLabel('magnet'),
      remainingMs: input.magnetTimerMs,
      durationMs: EFFECTS.MAGNET_DURATION_MS,
      color: getSpecialColor('magnet'),
    });
  }

  if (input.invertTimerMs > 0) {
    effects.push({
      effect: 'invert',
      label: getSpecialHudLabel('invert'),
      remainingMs: input.invertTimerMs,
      durationMs: EFFECTS.INVERT_DURATION_MS,
      color: getSpecialColor('invert'),
    });
  }

  if (input.blackoutTimerMs > 0) {
    const blackoutHudEffect =
      adaptBlackoutEffectForSurface('blackout', input.currentSurface) === 'invert'
        ? 'invert'
        : 'blackout';
    effects.push({
      effect: blackoutHudEffect,
      label: getSpecialHudLabel(blackoutHudEffect),
      remainingMs: input.blackoutTimerMs,
      durationMs: EFFECTS.BLACKOUT_DURATION_MS,
      color: getSpecialColor(blackoutHudEffect),
    });
  }

  if (input.ghostTimerMs > 0) {
    effects.push({
      effect: 'ghost',
      label: getSpecialHudLabel('ghost'),
      remainingMs: input.ghostTimerMs,
      durationMs: EFFECTS.GHOST_DURATION_MS,
      color: getSpecialColor('ghost'),
    });
  }

  if (input.lureTimerMs > 0) {
    effects.push({
      effect: 'lure',
      label: getSpecialHudLabel('lure'),
      remainingMs: input.lureTimerMs,
      durationMs: EFFECTS.LURE_DURATION_MS,
      color: getSpecialColor('lure'),
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

  if (input.comboTimerMs > 0 && input.pickupComboCount >= 3) {
    effects.push({
      effect: 'flow',
      label: `FLOW x${input.pickupComboCount}`,
      remainingMs: input.comboTimerMs,
      durationMs: TIMING.COMBO_WINDOW_MS,
      color: '#fb7185',
    });
  }

  return effects.sort((left, right) => right.remainingMs - left.remainingMs);
}
