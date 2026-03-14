import type { Rect, RailCandidate, ViewportSize } from '../shared/types';
import { rectsIntersect } from '../shared/utils';
import type { TrainState } from './gameStateTypes';
import { ENCOUNTER, TRAIN } from './gameConfig';
import { randomBetween } from './gameRuntime';

// ---------------------------------------------------------------------------
// Train spawn scheduling
// ---------------------------------------------------------------------------

export interface TrainSpawnStep {
  trainSpawnTimerMs: number;
  shouldSpawn: boolean;
}

export function resolveTrainSpawnStep(options: {
  trainSpawnTimerMs: number;
  runElapsedMs: number;
  trainEventsThisRun: number;
  railCandidateCount: number;
  policeOrWarningActive: boolean;
  planeOrWarningActive: boolean;
  trainActive: boolean;
  dtSeconds: number;
}): TrainSpawnStep {
  if (options.trainActive) {
    return { trainSpawnTimerMs: options.trainSpawnTimerMs, shouldSpawn: false };
  }

  if (options.railCandidateCount === 0) {
    return { trainSpawnTimerMs: options.trainSpawnTimerMs, shouldSpawn: false };
  }

  if (options.runElapsedMs < TRAIN.MIN_RUN_TIME_MS) {
    return { trainSpawnTimerMs: options.trainSpawnTimerMs, shouldSpawn: false };
  }

  if (options.trainEventsThisRun >= TRAIN.MAX_PER_RUN) {
    return { trainSpawnTimerMs: options.trainSpawnTimerMs, shouldSpawn: false };
  }

  if (options.policeOrWarningActive || options.planeOrWarningActive) {
    return {
      trainSpawnTimerMs: Math.max(options.trainSpawnTimerMs, ENCOUNTER.STAGGER_MS),
      shouldSpawn: false,
    };
  }

  const nextTimerMs = Math.max(0, options.trainSpawnTimerMs - options.dtSeconds * 1000);
  if (nextTimerMs > 0) {
    return { trainSpawnTimerMs: nextTimerMs, shouldSpawn: false };
  }

  return { trainSpawnTimerMs: 0, shouldSpawn: true };
}

// ---------------------------------------------------------------------------
// Train creation
// ---------------------------------------------------------------------------

export function createTrainEvent(railCandidates: RailCandidate[]): TrainState {
  const rail = railCandidates[Math.floor(Math.random() * railCandidates.length)];
  const direction: 1 | -1 = Math.random() < 0.5 ? 1 : -1;

  return {
    rail: { ...rail.rect },
    axis: rail.axis,
    direction,
    progressPx: 0,
    phase: 'warning',
    warningRemainingMs: TRAIN.WARNING_MS,
  };
}

// ---------------------------------------------------------------------------
// Train advancement
// ---------------------------------------------------------------------------

export interface TrainTickResult {
  train: TrainState | null;
  completed: boolean;
}

export function advanceTrainCrossing(
  train: TrainState,
  viewport: ViewportSize,
  dtSeconds: number,
): TrainTickResult {
  if (train.phase === 'warning') {
    train.warningRemainingMs = Math.max(0, train.warningRemainingMs - dtSeconds * 1000);
    if (train.warningRemainingMs <= 0) {
      train.phase = 'crossing';
    }
    return { train, completed: false };
  }

  train.progressPx += TRAIN.SPEED * dtSeconds;

  const totalTravel = getTrainTotalTravel(train, viewport);
  if (train.progressPx >= totalTravel) {
    return { train: null, completed: true };
  }

  return { train, completed: false };
}

// ---------------------------------------------------------------------------
// Train rect computation
// ---------------------------------------------------------------------------

export function getTrainRect(train: TrainState, viewport: ViewportSize): Rect {
  if (train.axis === 'horizontal') {
    const startX = train.direction === 1 ? -train.rail.width : viewport.width;
    const currentX = startX + train.direction * train.progressPx;
    const centerY = train.rail.y + train.rail.height / 2;

    return {
      x: currentX,
      y: centerY - TRAIN.HITBOX_HEIGHT / 2,
      width: train.rail.width,
      height: TRAIN.HITBOX_HEIGHT,
    };
  }

  const startY = train.direction === 1 ? -train.rail.height : viewport.height;
  const currentY = startY + train.direction * train.progressPx;
  const centerX = train.rail.x + train.rail.width / 2;

  return {
    x: centerX - TRAIN.HITBOX_HEIGHT / 2,
    y: currentY,
    width: TRAIN.HITBOX_HEIGHT,
    height: train.rail.height,
  };
}

// ---------------------------------------------------------------------------
// Collision detection
// ---------------------------------------------------------------------------

export function checkTrainCollision(
  train: TrainState,
  viewport: ViewportSize,
  playerBounds: Rect,
  ghostActive: boolean,
): boolean {
  if (train.phase !== 'crossing') {
    return false;
  }

  if (ghostActive) {
    return false;
  }

  const trainRect = getTrainRect(train, viewport);
  return rectsIntersect(playerBounds, trainRect);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTrainTotalTravel(train: TrainState, viewport: ViewportSize): number {
  if (train.axis === 'horizontal') {
    return viewport.width + train.rail.width;
  }
  return viewport.height + train.rail.height;
}

export function getInitialTrainSpawnTimerMs(): number {
  return randomBetween(TRAIN.INITIAL_MIN_MS, TRAIN.INITIAL_MAX_MS);
}
