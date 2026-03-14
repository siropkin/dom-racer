import {
  PLAYER_SIZE,
  type RailCandidate,
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

  const scannedRailRects: Rect[] = [];

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

    if (element.kind === 'rail') {
      scannedRailRects.push(element.rect);
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
  const railCandidates = findRailCandidates(obstacles, slowZones, scannedRailRects, viewport);

  return {
    viewport,
    obstacles,
    slowZones,
    iceZones,
    hazards,
    deadSpots,
    boosts,
    pickups,
    railCandidates,
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
    y: viewport.height / 2,
  };

  let bestPosition: Vector2 = {
    x: Math.max(16, viewport.width / 2 - PLAYER_SIZE.width / 2),
    y: Math.max(16, viewport.height / 2),
  };
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let y = viewport.height - PLAYER_SIZE.height - 16; y >= PLAYER_SIZE.height + 16; y -= 28) {
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
      const dist = Math.sqrt(distanceSquared(center, target));
      const score = Math.min(clearance, 80) * 0.3 - dist * 0.7;

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

const RAIL_ASPECT_RATIO = 12;
const RAIL_VIEWPORT_SPAN = 0.6;
const RAIL_CLEARANCE_PX = 60;

function findRailCandidates(
  obstacles: Rect[],
  slowZones: Rect[],
  scannedRailRects: Rect[],
  viewport: ViewportSize,
): RailCandidate[] {
  const candidates: RailCandidate[] = [];

  for (const rect of scannedRailRects) {
    const candidate = toRailCandidate(rect, viewport);
    if (candidate) {
      candidates.push(candidate);
    }
  }

  for (const rect of [...obstacles, ...slowZones]) {
    const candidate = toRailCandidate(rect, viewport);
    if (candidate) {
      candidates.push(candidate);
    }
  }

  const deduped = deduplicateRails(candidates);
  return deduped.filter((c) => hasEnoughClearance(c.rect, c.axis, obstacles, viewport));
}

function toRailCandidate(rect: Rect, viewport: ViewportSize): RailCandidate | null {
  const aspectW = rect.width / Math.max(1, rect.height);
  const aspectH = rect.height / Math.max(1, rect.width);

  if (aspectW >= RAIL_ASPECT_RATIO && rect.width >= viewport.width * RAIL_VIEWPORT_SPAN) {
    return { rect, axis: 'horizontal' };
  }

  if (aspectH >= RAIL_ASPECT_RATIO && rect.height >= viewport.height * RAIL_VIEWPORT_SPAN) {
    return { rect, axis: 'vertical' };
  }

  return null;
}

function deduplicateRails(candidates: RailCandidate[]): RailCandidate[] {
  const sorted = [...candidates].sort((a, b) => railLength(b) - railLength(a));
  const kept: RailCandidate[] = [];

  for (const candidate of sorted) {
    const overlaps = kept.some(
      (existing) => existing.axis === candidate.axis && railsOverlap(existing.rect, candidate.rect),
    );
    if (!overlaps) {
      kept.push(candidate);
    }
  }

  return kept;
}

function railLength(candidate: RailCandidate): number {
  return candidate.axis === 'horizontal' ? candidate.rect.width : candidate.rect.height;
}

function railsOverlap(a: Rect, b: Rect): boolean {
  const xOverlap =
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > Math.min(a.width, b.width) * 0.5;
  const yOverlap =
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) >
    Math.min(a.height, b.height) * 0.5;
  return xOverlap && yOverlap;
}

function hasEnoughClearance(
  rail: Rect,
  axis: 'horizontal' | 'vertical',
  obstacles: Rect[],
  viewport: ViewportSize,
): boolean {
  if (axis === 'horizontal') {
    const above: Rect = {
      x: rail.x,
      y: rail.y - RAIL_CLEARANCE_PX,
      width: rail.width,
      height: RAIL_CLEARANCE_PX,
    };
    const below: Rect = {
      x: rail.x,
      y: rail.y + rail.height,
      width: rail.width,
      height: RAIL_CLEARANCE_PX,
    };

    const aboveClear = above.y >= 0 && !obstacles.some((o) => rectsIntersect(above, o));
    const belowClear =
      below.y + below.height <= viewport.height && !obstacles.some((o) => rectsIntersect(below, o));

    return aboveClear || belowClear;
  }

  const left: Rect = {
    x: rail.x - RAIL_CLEARANCE_PX,
    y: rail.y,
    width: RAIL_CLEARANCE_PX,
    height: rail.height,
  };
  const right: Rect = {
    x: rail.x + rail.width,
    y: rail.y,
    width: RAIL_CLEARANCE_PX,
    height: rail.height,
  };

  const leftClear = left.x >= 0 && !obstacles.some((o) => rectsIntersect(left, o));
  const rightClear =
    right.x + right.width <= viewport.width && !obstacles.some((o) => rectsIntersect(right, o));

  return leftClear || rightClear;
}
