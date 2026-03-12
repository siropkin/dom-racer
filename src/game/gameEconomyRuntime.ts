import type { Rect, WorldPickup } from '../shared/types';
import { collectPickups } from './pickups';
import { isSpecialPickup } from './gameRuntime';

interface ResolvePickupCollectionOptions {
  playerBounds: Rect;
  worldPickups: WorldPickup[];
  dynamicPickups: WorldPickup[];
}

export interface PickupCollectionStep {
  remainingPickups: WorldPickup[];
  collectedPickups: WorldPickup[];
  scoreGained: number;
  dynamicPickups: WorldPickup[];
}

export function resolvePickupCollectionStep({
  playerBounds,
  worldPickups,
  dynamicPickups,
}: ResolvePickupCollectionOptions): PickupCollectionStep {
  const pickupResult = collectPickups(playerBounds, worldPickups);
  const collectedSpecialIds = pickupResult.collectedPickups
    .filter((pickup) => isSpecialPickup(pickup))
    .map((pickup) => pickup.id);

  if (collectedSpecialIds.length === 0) {
    return {
      remainingPickups: pickupResult.remainingPickups,
      collectedPickups: pickupResult.collectedPickups,
      scoreGained: pickupResult.scoreGained,
      dynamicPickups,
    };
  }

  const collectedIdSet = new Set(collectedSpecialIds);
  return {
    remainingPickups: pickupResult.remainingPickups,
    collectedPickups: pickupResult.collectedPickups,
    scoreGained: pickupResult.scoreGained,
    dynamicPickups: dynamicPickups.filter((pickup) => !collectedIdSet.has(pickup.id)),
  };
}
