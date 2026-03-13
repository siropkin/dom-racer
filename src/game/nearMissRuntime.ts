import type { Rect } from '../shared/types';
import { expandRect, rectsIntersect } from '../shared/utils';

export const NEAR_MISS_COOLDOWN_MS = 800;
export const NEAR_MISS_THRESHOLD_PX = 5;
export const NEAR_MISS_SCORE_MIN = 3;
export const NEAR_MISS_SCORE_MAX = 5;

export const NEAR_MISS_COLOR = '#fb923c';
export const NEAR_MISS_TOAST_TTL_MS = 600;

const NEAR_MISS_WORDS = ['CLOSE!', 'TIGHT!', 'RAZOR!', 'WHEW!'] as const;

export interface NearMissStep {
  triggered: boolean;
  scoreBonus: number;
  cooldownMs: number;
  messageText: string;
}

export function resolveNearMissStep(options: {
  playerBounds: Rect;
  obstacles: Rect[];
  policeRect: Rect | null;
  cooldownMs: number;
  dtSeconds: number;
  flavorIndex: number;
}): NearMissStep {
  const nextCooldownMs = Math.max(0, options.cooldownMs - options.dtSeconds * 1000);

  if (nextCooldownMs > 0) {
    return { triggered: false, scoreBonus: 0, cooldownMs: nextCooldownMs, messageText: '' };
  }

  const allTargets = [...options.obstacles];
  if (options.policeRect) {
    allTargets.push(options.policeRect);
  }

  for (const target of allTargets) {
    if (isNearMiss(options.playerBounds, target, NEAR_MISS_THRESHOLD_PX)) {
      const scoreBonus =
        NEAR_MISS_SCORE_MIN +
        Math.floor(Math.random() * (NEAR_MISS_SCORE_MAX - NEAR_MISS_SCORE_MIN + 1));
      const messageText = NEAR_MISS_WORDS[options.flavorIndex % NEAR_MISS_WORDS.length];
      return {
        triggered: true,
        scoreBonus,
        cooldownMs: NEAR_MISS_COOLDOWN_MS,
        messageText,
      };
    }
  }

  return { triggered: false, scoreBonus: 0, cooldownMs: 0, messageText: '' };
}

export function isNearMiss(
  playerRect: Rect,
  obstacleRect: Rect,
  thresholdPx: number,
): boolean {
  if (rectsIntersect(playerRect, obstacleRect)) {
    return false;
  }

  return rectsIntersect(expandRect(playerRect, thresholdPx), obstacleRect);
}
