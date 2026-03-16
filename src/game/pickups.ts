import type { Rect, WorldPickup } from '../shared/types';
import { rectsIntersect } from '../shared/utils';

interface PickupResult {
  remainingPickups: WorldPickup[];
  scoreGained: number;
  collectedPickups: WorldPickup[];
}

export function collectPickups(playerBounds: Rect, pickups: WorldPickup[]): PickupResult {
  const remainingPickups: WorldPickup[] = [];
  const collectedPickups: WorldPickup[] = [];
  let scoreGained = 0;

  for (const pickup of pickups) {
    if (rectsIntersect(playerBounds, pickup.rect)) {
      scoreGained += pickup.value;
      collectedPickups.push(pickup);
      continue;
    }

    remainingPickups.push(pickup);
  }

  return {
    remainingPickups,
    scoreGained,
    collectedPickups,
  };
}

export function isBoosting(playerBounds: Rect, boosts: Rect[]): boolean {
  return boosts.some((boost) => rectsIntersect(playerBounds, boost));
}

export function isOnIceZone(playerBounds: Rect, iceZones: Rect[]): boolean {
  return iceZones.some((iceZone) => rectsIntersect(playerBounds, iceZone));
}

export function isOnDeadSpot(playerBounds: Rect, deadSpots: Rect[]): boolean {
  return deadSpots.some((deadSpot) => rectsIntersect(playerBounds, deadSpot));
}
