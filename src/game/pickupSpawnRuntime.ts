import type { Rect, Vector2, ViewportSize, WorldPickup } from '../shared/types';
import { clamp, rectsIntersect } from '../shared/utils';
import {
  cloneRect,
  PLANE_LANE_SPECIAL_STAGGER_MS,
  randomBetween,
  REGULAR_COIN_LOW_PRESSURE_THRESHOLD,
  REGULAR_COIN_REFILL_FAST_MAX_MS,
  REGULAR_COIN_REFILL_FAST_MIN_MS,
  REGULAR_COIN_REFILL_LOW_MAX_MS,
  REGULAR_COIN_REFILL_LOW_MIN_MS,
  REGULAR_COIN_REFILL_MAX_MS,
  REGULAR_COIN_REFILL_MIN_MS,
  REGULAR_COIN_SCORE,
  REGULAR_COIN_VISIBLE_CAP,
  SPECIAL_CAP_RETRY_MAX_MS,
  SPECIAL_CAP_RETRY_MIN_MS,
  SPECIAL_RESPAWN_MAX_MS,
  SPECIAL_RESPAWN_MIN_MS,
  SPECIAL_RETRY_MAX_MS,
  SPECIAL_RETRY_MIN_MS,
  SPECIAL_VISIBLE_CAP,
} from './gameRuntime';

interface PickupSpawnBlockers {
  viewport: ViewportSize;
  player: Rect;
  obstacles: Rect[];
  deadSpots: Rect[];
  hazards: Rect[];
  pickups: Rect[];
}

interface SpawnQueuedCoinsOptions {
  worldPickups: WorldPickup[];
  coinSpawnQueue: WorldPickup[];
  coinSpawnIdCounter: number;
  count: number;
  canSpawnRegularCoinAt: (rect: Rect) => boolean;
}

interface SpawnQueuedCoinsResult {
  spawnedAny: boolean;
  coinSpawnIdCounter: number;
}

export function canSpawnRegularCoinRect(rect: Rect, blockers: PickupSpawnBlockers): boolean {
  if (rectsIntersect(rect, blockers.player)) {
    return false;
  }

  if (blockers.obstacles.some((obstacle) => rectsIntersect(rect, obstacle))) {
    return false;
  }

  if (blockers.deadSpots.some((deadSpot) => rectsIntersect(rect, deadSpot))) {
    return false;
  }

  if (blockers.hazards.some((hazard) => rectsIntersect(rect, hazard))) {
    return false;
  }

  return !blockers.pickups.some((pickupRect) => rectsIntersect(rect, pickupRect));
}

export function findFreePickupRect(size: number, blockers: PickupSpawnBlockers): Rect | null {
  const blockedRects = [
    ...blockers.obstacles,
    ...blockers.deadSpots,
    ...blockers.hazards,
    blockers.player,
    ...blockers.pickups,
  ];

  for (let attempt = 0; attempt < 48; attempt += 1) {
    const rect = {
      x: 16 + Math.random() * Math.max(1, blockers.viewport.width - size - 32),
      y: 24 + Math.random() * Math.max(1, blockers.viewport.height - size - 48),
      width: size,
      height: size,
    };

    if (!blockedRects.some((blockedRect) => rectsIntersect(rect, blockedRect))) {
      return rect;
    }
  }

  return null;
}

export function findFreePickupRectNear(
  point: Vector2,
  size: number,
  radius: number,
  blockers: PickupSpawnBlockers,
): Rect | null {
  const blockedRects = [
    ...blockers.obstacles,
    ...blockers.deadSpots,
    ...blockers.hazards,
    blockers.player,
    ...blockers.pickups,
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
      x: clamp(point.x + offset.x - size / 2, 16, blockers.viewport.width - size - 16),
      y: clamp(point.y + offset.y - size / 2, 24, blockers.viewport.height - size - 24),
      width: size,
      height: size,
    };
    if (!blockedRects.some((blockedRect) => rectsIntersect(candidate, blockedRect))) {
      return candidate;
    }
  }

  for (let attempt = 0; attempt < 14; attempt += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * radius;
    const rect = {
      x: clamp(
        point.x + Math.cos(angle) * distance - size / 2,
        16,
        blockers.viewport.width - size - 16,
      ),
      y: clamp(
        point.y + Math.sin(angle) * distance - size / 2,
        24,
        blockers.viewport.height - size - 24,
      ),
      width: size,
      height: size,
    };
    if (!blockedRects.some((blockedRect) => rectsIntersect(rect, blockedRect))) {
      return rect;
    }
  }

  return null;
}

export function getCoinRefillDelayMs(
  visibleRegularCoins: number,
  coinRefillBoostTimerMs: number,
): number {
  if (coinRefillBoostTimerMs > 0) {
    return randomBetween(REGULAR_COIN_REFILL_FAST_MIN_MS, REGULAR_COIN_REFILL_FAST_MAX_MS);
  }

  if (visibleRegularCoins <= REGULAR_COIN_LOW_PRESSURE_THRESHOLD) {
    return randomBetween(REGULAR_COIN_REFILL_LOW_MIN_MS, REGULAR_COIN_REFILL_LOW_MAX_MS);
  }

  return randomBetween(REGULAR_COIN_REFILL_MIN_MS, REGULAR_COIN_REFILL_MAX_MS);
}

export function spawnQueuedCoinsFromAnchors({
  worldPickups,
  coinSpawnQueue,
  coinSpawnIdCounter,
  count,
  canSpawnRegularCoinAt,
}: SpawnQueuedCoinsOptions): SpawnQueuedCoinsResult {
  if (coinSpawnQueue.length === 0) {
    return {
      spawnedAny: false,
      coinSpawnIdCounter,
    };
  }

  let nextCoinSpawnIdCounter = coinSpawnIdCounter;
  let spawnedAny = false;
  let spawnedCount = 0;
  while (spawnedCount < count) {
    const anchor = nextSpawnableCoinAnchor(worldPickups, coinSpawnQueue, canSpawnRegularCoinAt);
    if (!anchor) {
      break;
    }

    const pickup: WorldPickup = {
      id: `coin:${anchor.sourceId ?? anchor.id}:${nextCoinSpawnIdCounter}`,
      sourceId: anchor.sourceId ?? anchor.id,
      rect: cloneRect(anchor.rect),
      value: REGULAR_COIN_SCORE,
      kind: 'coin',
    };
    nextCoinSpawnIdCounter += 1;
    worldPickups.push(pickup);
    spawnedCount += 1;
    spawnedAny = true;
  }

  return {
    spawnedAny,
    coinSpawnIdCounter: nextCoinSpawnIdCounter,
  };
}

function nextSpawnableCoinAnchor(
  worldPickups: WorldPickup[],
  coinSpawnQueue: WorldPickup[],
  canSpawnRegularCoinAt: (rect: Rect) => boolean,
): WorldPickup | null {
  if (coinSpawnQueue.length === 0) {
    return null;
  }

  const attempts = coinSpawnQueue.length;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const anchor = coinSpawnQueue.shift();
    if (!anchor) {
      break;
    }
    coinSpawnQueue.push(anchor);

    const sourceId = anchor.sourceId ?? anchor.id;
    const alreadyVisible = worldPickups.some(
      (pickup) => pickup.kind !== 'special' && (pickup.sourceId ?? pickup.id) === sourceId,
    );
    if (alreadyVisible) {
      continue;
    }

    if (!canSpawnRegularCoinAt(anchor.rect)) {
      continue;
    }

    return anchor;
  }

  return null;
}

export interface AmbientSpecialSpawnStep {
  specialSpawnTimerMs: number;
  shouldAttemptSpawn: boolean;
}

/** Determines whether it is time to attempt spawning an ambient special pickup. */
export function resolveAmbientSpecialSpawnStep(options: {
  specialSpawnTimerMs: number;
  existingSpecialCount: number;
  planeRouteActive: boolean;
  dtSeconds: number;
}): AmbientSpecialSpawnStep {
  if (options.planeRouteActive) {
    return {
      specialSpawnTimerMs: Math.max(options.specialSpawnTimerMs, PLANE_LANE_SPECIAL_STAGGER_MS),
      shouldAttemptSpawn: false,
    };
  }

  const nextTimerMs = Math.max(0, options.specialSpawnTimerMs - options.dtSeconds * 1000);
  if (nextTimerMs > 0) {
    return {
      specialSpawnTimerMs: nextTimerMs,
      shouldAttemptSpawn: false,
    };
  }

  if (options.existingSpecialCount >= SPECIAL_VISIBLE_CAP) {
    return {
      specialSpawnTimerMs: randomBetween(SPECIAL_CAP_RETRY_MIN_MS, SPECIAL_CAP_RETRY_MAX_MS),
      shouldAttemptSpawn: false,
    };
  }

  return {
    specialSpawnTimerMs: nextTimerMs,
    shouldAttemptSpawn: true,
  };
}

export function getSpecialSpawnRespawnDelayMs(spawned: boolean): number {
  return spawned
    ? randomBetween(SPECIAL_RESPAWN_MIN_MS, SPECIAL_RESPAWN_MAX_MS)
    : randomBetween(SPECIAL_RETRY_MIN_MS, SPECIAL_RETRY_MAX_MS);
}

export interface RegularCoinSpawnStep {
  coinRefillBoostTimerMs: number;
  coinRefillTimerMs: number;
  shouldSpawn: boolean;
}

/** Advances coin refill timers and determines whether to spawn the next coin. */
export function resolveRegularCoinSpawnStep(options: {
  coinRefillBoostTimerMs: number;
  coinRefillTimerMs: number;
  coinSpawnQueueEmpty: boolean;
  visibleRegularCoins: number;
  dtSeconds: number;
}): RegularCoinSpawnStep {
  if (options.coinSpawnQueueEmpty) {
    return {
      coinRefillBoostTimerMs: options.coinRefillBoostTimerMs,
      coinRefillTimerMs: options.coinRefillTimerMs,
      shouldSpawn: false,
    };
  }

  const nextBoostMs = Math.max(0, options.coinRefillBoostTimerMs - options.dtSeconds * 1000);

  if (options.visibleRegularCoins >= REGULAR_COIN_VISIBLE_CAP) {
    return {
      coinRefillBoostTimerMs: nextBoostMs,
      coinRefillTimerMs: options.coinRefillTimerMs,
      shouldSpawn: false,
    };
  }

  const nextRefillMs = Math.max(0, options.coinRefillTimerMs - options.dtSeconds * 1000);
  if (nextRefillMs > 0) {
    return {
      coinRefillBoostTimerMs: nextBoostMs,
      coinRefillTimerMs: nextRefillMs,
      shouldSpawn: false,
    };
  }

  return {
    coinRefillBoostTimerMs: nextBoostMs,
    coinRefillTimerMs: 0,
    shouldSpawn: true,
  };
}
