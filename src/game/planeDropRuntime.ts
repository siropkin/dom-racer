import type { Rect, Vector2, ViewportSize, WorldPickup } from '../shared/types';
import type { PlaneBonusEventState, PlaneCoinTrailState } from './gameStateTypes';
import {
  PLANE_LUCKY_WIND_MAX_COINS,
  PLANE_LUCKY_WIND_MAX_SHIFT_PX,
  PLANE_LUCKY_WIND_RADIUS_PX,
  PLANE_LUCKY_WIND_ROUTE_HALF_SPAN_PX,
} from './gameRuntime';
import { clamp, rectCenter, rectsIntersect } from '../shared/utils';

interface PlaneDropDispatchHandlers {
  spawnBonusDrop: (x: number, y: number) => boolean;
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

interface PlaneLuckyWindApplyOptions {
  worldPickups: WorldPickup[];
  viewport: ViewportSize;
  blockers: Rect[];
  center: Vector2;
  direction: Vector2;
}

export function dispatchPlaneDropWithFallback(
  planeBonusEvent: PlaneBonusEventState,
  handlers: PlaneDropDispatchHandlers,
): boolean {
  const bonusDrop = () => handlers.spawnBonusDrop(planeBonusEvent.x, planeBonusEvent.y + 14);

  switch (planeBonusEvent.effectMode) {
    case 'coin-trail': {
      const spawned = handlers.spawnCoinTrail(
        planeBonusEvent.x,
        planeBonusEvent.y + 12,
        planeBonusEvent.vx,
        planeBonusEvent.vy,
      );
      if (!spawned) {
        return bonusDrop();
      }
      return true;
    }
    case 'spotlight': {
      const spawned = handlers.spawnSpotlight(planeBonusEvent.x, planeBonusEvent.y + 14);
      if (!spawned) {
        return bonusDrop();
      }
      return true;
    }
    case 'lucky-wind': {
      const spawned = handlers.spawnLuckyWind(
        planeBonusEvent.x,
        planeBonusEvent.y + 12,
        planeBonusEvent.vx,
        planeBonusEvent.vy,
      );
      if (!spawned) {
        return bonusDrop();
      }
      return true;
    }
    case 'police-delay': {
      const spawned = handlers.spawnPoliceDelay();
      if (!spawned) {
        return bonusDrop();
      }
      return true;
    }
    case 'bonus-drop':
      return bonusDrop();
  }
}

export function applyPlaneLuckyWindToPickups({
  worldPickups,
  viewport,
  blockers,
  center,
  direction,
}: PlaneLuckyWindApplyOptions): boolean {
  const magnitude = Math.hypot(direction.x, direction.y);
  if (magnitude < 0.001) {
    return false;
  }

  const normalizedDirection = { x: direction.x / magnitude, y: direction.y / magnitude };
  const normal = { x: -normalizedDirection.y, y: normalizedDirection.x };
  const candidateCoins = worldPickups
    .filter((pickup) => pickup.kind !== 'special')
    .map((pickup) => {
      const pickupCenter = rectCenter(pickup.rect);
      const dx = pickupCenter.x - center.x;
      const dy = pickupCenter.y - center.y;
      return {
        pickup,
        along: dx * normalizedDirection.x + dy * normalizedDirection.y,
        lateral: dx * normal.x + dy * normal.y,
        distance: Math.hypot(dx, dy),
      };
    })
    .filter(
      (candidate) =>
        candidate.distance <= PLANE_LUCKY_WIND_RADIUS_PX &&
        Math.abs(candidate.lateral) <= PLANE_LUCKY_WIND_RADIUS_PX * 0.9,
    )
    .sort(
      (left, right) => left.distance - right.distance || Math.abs(left.lateral) - Math.abs(right.lateral),
    )
    .slice(0, PLANE_LUCKY_WIND_MAX_COINS);

  if (candidateCoins.length < 2) {
    return false;
  }

  const specialRects = worldPickups
    .filter((pickup) => pickup.kind === 'special')
    .map((pickup) => pickup.rect);
  const regularCoinRects = new Map(
    worldPickups
      .filter((pickup) => pickup.kind !== 'special')
      .map((pickup) => [pickup.id, { ...pickup.rect }] as const),
  );
  const updates: Array<{ id: string; rect: Rect }> = [];

  for (const candidate of candidateCoins) {
    const currentCenter = rectCenter(candidate.pickup.rect);
    const clampedAlong = clamp(
      candidate.along,
      -PLANE_LUCKY_WIND_ROUTE_HALF_SPAN_PX,
      PLANE_LUCKY_WIND_ROUTE_HALF_SPAN_PX,
    );
    const routeCenter = {
      x: center.x + normalizedDirection.x * clampedAlong,
      y: center.y + normalizedDirection.y * clampedAlong,
    };
    const toRouteX = routeCenter.x - currentCenter.x;
    const toRouteY = routeCenter.y - currentCenter.y;
    const distanceToRoute = Math.hypot(toRouteX, toRouteY);
    if (distanceToRoute < 2) {
      continue;
    }

    const shiftPx = Math.min(PLANE_LUCKY_WIND_MAX_SHIFT_PX, distanceToRoute * 0.65 + 8);
    const shiftedCenter = {
      x: currentCenter.x + (toRouteX / distanceToRoute) * shiftPx,
      y: currentCenter.y + (toRouteY / distanceToRoute) * shiftPx,
    };
    const nextRect: Rect = {
      x: clamp(shiftedCenter.x - candidate.pickup.rect.width / 2, 8, viewport.width - candidate.pickup.rect.width - 8),
      y: clamp(
        shiftedCenter.y - candidate.pickup.rect.height / 2,
        8,
        viewport.height - candidate.pickup.rect.height - 8,
      ),
      width: candidate.pickup.rect.width,
      height: candidate.pickup.rect.height,
    };

    if (blockers.some((rect) => rectsIntersect(nextRect, rect))) {
      continue;
    }

    if (specialRects.some((rect) => rectsIntersect(nextRect, rect))) {
      continue;
    }

    const collidesWithCoin = Array.from(regularCoinRects.entries()).some(
      ([pickupId, rect]) => pickupId !== candidate.pickup.id && rectsIntersect(nextRect, rect),
    );
    if (collidesWithCoin) {
      continue;
    }

    updates.push({
      id: candidate.pickup.id,
      rect: nextRect,
    });
    regularCoinRects.set(candidate.pickup.id, nextRect);
  }

  if (updates.length < 2) {
    return false;
  }

  const updateById = new Map(updates.map((update) => [update.id, update.rect] as const));
  for (const pickup of worldPickups) {
    if (pickup.kind === 'special') {
      continue;
    }
    const nextRect = updateById.get(pickup.id);
    if (!nextRect) {
      continue;
    }
    pickup.rect = nextRect;
  }

  return true;
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
