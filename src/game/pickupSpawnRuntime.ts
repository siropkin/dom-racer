import type { Rect, Vector2, ViewportSize } from '../shared/types';
import { clamp, rectsIntersect } from '../shared/utils';

interface PickupSpawnBlockers {
  viewport: ViewportSize;
  player: Rect;
  obstacles: Rect[];
  deadSpots: Rect[];
  hazards: Rect[];
  pickups: Rect[];
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
