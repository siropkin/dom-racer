import type { PlaneBonusEventState } from './gameStateTypes';

interface PlaneDropDispatchHandlers {
  spawnBonusDrop: (x: number, y: number) => void;
  spawnBoostLane: (x: number, y: number, vx: number, vy: number) => boolean;
  spawnCoinTrail: (x: number, y: number, vx: number, vy: number) => boolean;
  spawnSpotlight: (x: number, y: number) => boolean;
  spawnLuckyWind: (x: number, y: number, vx: number, vy: number) => boolean;
  spawnPoliceDelay: () => boolean;
}

export function dispatchPlaneDropWithFallback(
  planeBonusEvent: PlaneBonusEventState,
  handlers: PlaneDropDispatchHandlers,
): void {
  const bonusDrop = () => handlers.spawnBonusDrop(planeBonusEvent.x, planeBonusEvent.y + 14);

  switch (planeBonusEvent.effectMode) {
    case 'boost-lane': {
      const spawned = handlers.spawnBoostLane(
        planeBonusEvent.x,
        planeBonusEvent.y + 12,
        planeBonusEvent.vx,
        planeBonusEvent.vy,
      );
      if (!spawned) {
        bonusDrop();
      }
      return;
    }
    case 'coin-trail': {
      const spawned = handlers.spawnCoinTrail(
        planeBonusEvent.x,
        planeBonusEvent.y + 12,
        planeBonusEvent.vx,
        planeBonusEvent.vy,
      );
      if (!spawned) {
        bonusDrop();
      }
      return;
    }
    case 'spotlight': {
      const spawned = handlers.spawnSpotlight(planeBonusEvent.x, planeBonusEvent.y + 14);
      if (!spawned) {
        bonusDrop();
      }
      return;
    }
    case 'lucky-wind': {
      const spawned = handlers.spawnLuckyWind(
        planeBonusEvent.x,
        planeBonusEvent.y + 12,
        planeBonusEvent.vx,
        planeBonusEvent.vy,
      );
      if (!spawned) {
        bonusDrop();
      }
      return;
    }
    case 'police-delay': {
      const spawned = handlers.spawnPoliceDelay();
      if (!spawned) {
        bonusDrop();
      }
      return;
    }
    case 'bonus-drop':
      bonusDrop();
  }
}
