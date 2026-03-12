import type { WorldPickup } from '../shared/types';
import type { PlaneBonusEventState, PlaneCoinTrailState } from './gameStateTypes';

interface PlaneDropDispatchHandlers {
  spawnBonusDrop: (x: number, y: number) => void;
  spawnBoostLane: (x: number, y: number, vx: number, vy: number) => boolean;
  spawnCoinTrail: (x: number, y: number, vx: number, vy: number) => boolean;
  spawnSpotlight: (x: number, y: number) => boolean;
  spawnLuckyWind: (x: number, y: number, vx: number, vy: number) => boolean;
  spawnPoliceDelay: () => boolean;
}

export interface PlaneCoinTrailStep {
  worldPickups: WorldPickup[];
  planeCoinTrail: PlaneCoinTrailState | null;
}

export interface PoliceDelayCueState {
  policeDelayCueTimerMs: number;
  policeDelayCueDurationMs: number;
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

export function advancePlaneCoinTrailState(
  worldPickups: WorldPickup[],
  planeCoinTrail: PlaneCoinTrailState | null,
  dtSeconds: number,
): PlaneCoinTrailStep {
  if (!planeCoinTrail) {
    return {
      worldPickups,
      planeCoinTrail: null,
    };
  }

  const nextTtlMs = Math.max(0, planeCoinTrail.ttlMs - dtSeconds * 1000);
  const livePickupIds = new Set(worldPickups.map((pickup) => pickup.id));
  const liveTrailCoinIds = planeCoinTrail.coinIds.filter((id) => livePickupIds.has(id));

  if (nextTtlMs > 0 && liveTrailCoinIds.length > 0) {
    return {
      worldPickups,
      planeCoinTrail: {
        ...planeCoinTrail,
        ttlMs: nextTtlMs,
        coinIds: liveTrailCoinIds,
      },
    };
  }

  if (liveTrailCoinIds.length === 0) {
    return {
      worldPickups,
      planeCoinTrail: null,
    };
  }

  const expiredIds = new Set(liveTrailCoinIds);
  return {
    worldPickups: worldPickups.filter((pickup) => !expiredIds.has(pickup.id)),
    planeCoinTrail: null,
  };
}

export function createPoliceDelayCueState(delayMs: number): PoliceDelayCueState {
  return {
    policeDelayCueTimerMs: delayMs,
    policeDelayCueDurationMs: delayMs,
  };
}

export function advancePoliceDelayCueState(
  state: PoliceDelayCueState,
  dtSeconds: number,
): PoliceDelayCueState {
  if (state.policeDelayCueTimerMs <= 0) {
    return {
      policeDelayCueTimerMs: 0,
      policeDelayCueDurationMs: 0,
    };
  }

  const nextTimerMs = Math.max(0, state.policeDelayCueTimerMs - dtSeconds * 1000);
  return {
    policeDelayCueTimerMs: nextTimerMs,
    policeDelayCueDurationMs: nextTimerMs === 0 ? 0 : state.policeDelayCueDurationMs,
  };
}
