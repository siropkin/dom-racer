import {
  PLAYER_SIZE,
  type Rect,
  type ScannedElement,
  type Vector2,
  type ViewportSize,
  type World,
} from '../shared/types';
import { distanceSquared, expandRect, rectCenter, rectsIntersect } from '../shared/utils';

const REGULAR_COIN_SIZE = 16;
const REGULAR_COIN_VALUE = 10;

/** Converts scanned DOM elements into a playable game world with obstacles, zones, and pickups. */
export function buildWorld(scannedElements: ScannedElement[], viewport: ViewportSize): World {
  const obstacles: Rect[] = [];
  const slowZones: Rect[] = [];
  const iceZones: Rect[] = [];
  // Reserved runtime channels; scanner intentionally does not populate these today.
  const hazards: Rect[] = [];
  const deadSpots: Rect[] = [];
  const boosts: Rect[] = [];
  const pickups: World['pickups'] = [];

  for (const element of scannedElements) {
    if (element.kind === 'wall') {
      slowZones.push(expandRect(element.rect, 1));
      continue;
    }

    if (element.kind === 'barrier') {
      obstacles.push(expandRect(element.rect, 4));
      continue;
    }

    if (element.kind === 'boost') {
      boosts.push(expandRect(element.rect, 2));
      continue;
    }

    if (element.kind === 'ice') {
      iceZones.push(expandRect(element.rect, 2));
      continue;
    }
  }

  const pickupBlockers = [...obstacles, ...deadSpots, ...hazards];

  for (const element of scannedElements) {
    if (element.kind !== 'pickup') {
      continue;
    }

    const pickupRect = createPickupRect(element.rect, viewport, pickupBlockers);
    if (!pickupRect) {
      continue;
    }

    pickups.push({
      id: element.id,
      sourceId: element.id,
      rect: pickupRect,
      value: REGULAR_COIN_VALUE,
      kind: 'coin',
    });
  }

  const spawnPoint = findSpawnPoint(obstacles, hazards, deadSpots, viewport);

  return {
    viewport,
    obstacles,
    slowZones,
    iceZones,
    hazards,
    deadSpots,
    boosts,
    pickups,
    spawnPoint,
    scannedCount: scannedElements.length,
  };
}

function createPickupRect(rect: Rect, viewport: ViewportSize, blockers: Rect[]): Rect | null {
  const size = REGULAR_COIN_SIZE;
  const center = rectCenter(rect);
  const spacing = Math.max(18, size + 6);
  const offsets = [
    { x: 0, y: 0 },
    { x: 0, y: -spacing },
    { x: spacing, y: 0 },
    { x: -spacing, y: 0 },
    { x: 0, y: spacing },
    { x: spacing, y: -spacing },
    { x: -spacing, y: -spacing },
    { x: spacing, y: spacing },
    { x: -spacing, y: spacing },
    { x: 0, y: -spacing * 2 },
    { x: 0, y: spacing * 2 },
  ];

  for (const offset of offsets) {
    const candidate = {
      x: clampToViewport(center.x - size / 2 + offset.x, size, viewport.width),
      y: clampToViewport(center.y - size / 2 + offset.y, size, viewport.height),
      width: size,
      height: size,
    };

    if (!blockers.some((blocker) => rectsIntersect(candidate, blocker))) {
      return candidate;
    }
  }

  return null;
}

function findSpawnPoint(
  obstacles: Rect[],
  hazards: Rect[],
  deadSpots: Rect[],
  viewport: ViewportSize,
): Vector2 {
  const blockers = [...obstacles, ...hazards, ...deadSpots];
  const target = {
    x: viewport.width / 2,
    y: viewport.height * 0.82,
  };

  let bestPosition: Vector2 = {
    x: Math.max(16, viewport.width / 2 - PLAYER_SIZE.width / 2),
    y: Math.max(16, viewport.height * 0.78),
  };
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let y = viewport.height - PLAYER_SIZE.height - 24; y >= viewport.height * 0.35; y -= 28) {
    for (let x = 16; x <= viewport.width - PLAYER_SIZE.width - 16; x += 28) {
      const candidate = {
        x,
        y,
        width: PLAYER_SIZE.width,
        height: PLAYER_SIZE.height,
      };

      if (blockers.some((blocker) => rectsIntersect(candidate, blocker))) {
        continue;
      }

      const clearance = nearestClearance(candidate, blockers, viewport);
      const center = rectCenter(candidate);
      const biasScore = -Math.sqrt(distanceSquared(center, target)) * 0.42 + center.y * 0.08;
      const score = clearance + biasScore;

      if (score > bestScore) {
        bestScore = score;
        bestPosition = { x, y };
      }
    }
  }

  return bestPosition;
}

function nearestClearance(candidate: Rect, blockers: Rect[], viewport: ViewportSize): number {
  if (blockers.length === 0) {
    return viewport.width + viewport.height;
  }

  let minDistance = Number.POSITIVE_INFINITY;

  for (const blocker of blockers) {
    const dx = axisDistance(
      candidate.x,
      candidate.x + candidate.width,
      blocker.x,
      blocker.x + blocker.width,
    );
    const dy = axisDistance(
      candidate.y,
      candidate.y + candidate.height,
      blocker.y,
      blocker.y + blocker.height,
    );
    const distance = Math.hypot(dx, dy);
    minDistance = Math.min(minDistance, distance);
  }

  return minDistance;
}

function axisDistance(startA: number, endA: number, startB: number, endB: number): number {
  if (endA < startB) {
    return startB - endA;
  }

  if (endB < startA) {
    return startA - endB;
  }

  return 0;
}

function clampToViewport(position: number, size: number, max: number): number {
  return Math.max(8, Math.min(position, max - size - 8));
}
