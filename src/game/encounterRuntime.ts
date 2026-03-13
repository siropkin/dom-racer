import type { Rect, Vector2, World } from '../shared/types';
import type {
  PlaneBonusEventState,
  PlaneWarningState,
  PoliceChaseState,
  PoliceWarningState,
} from './gameStateTypes';
import { clamp, rectCenter } from '../shared/utils';
import {
  blendAngle,
  ENCOUNTER_STAGGER_MS,
  PLANE_COIN_TRAIL_CHANCE,
  PLANE_COIN_TRAIL_COIN_SIZE_PX,
  PLANE_COIN_TRAIL_LENGTH_PX,
  PLANE_COIN_TRAIL_STEP_PX,
  PLANE_LUCKY_WIND_CHANCE,
  PLANE_POLICE_DELAY_MODE_CHANCE,
  PLANE_SPOTLIGHT_CHANCE,
  PLANE_EVENT_CORNER_SPAN,
  PLANE_EVENT_ENTRY_OFFSET,
  PLANE_EVENT_SPEED,
  PLANE_WARNING_MS,
  POLICE_CHASE_DURATION_MAX_MS,
  POLICE_CHASE_DURATION_MIN_MS,
  POLICE_ICE_SPEED_MULTIPLIER,
  POLICE_ICE_TURN_RATE,
  POLICE_WARNING_MS,
  randomBetween,
} from './gameRuntime';
import { POLICE_CAR_SIZE, type PoliceEdge } from './policeSprite';

interface PlanePath {
  start: Vector2;
  end: Vector2;
}

type PlaneCorner = 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left';

export interface PoliceSpawnCountdownResult {
  policeSpawnTimerMs: number;
  policeWarning: PoliceWarningState | null;
  warningStarted: boolean;
  shouldSpawn: boolean;
}

export function getPoliceRect(police: { x: number; y: number }): Rect {
  return {
    x: police.x,
    y: police.y,
    width: POLICE_CAR_SIZE.width,
    height: POLICE_CAR_SIZE.height,
  };
}

export function tickPlaneWarningState(
  planeWarning: PlaneWarningState | null,
  dtSeconds: number,
): PlaneWarningState | null {
  if (!planeWarning) {
    return null;
  }

  planeWarning.remainingMs = Math.max(0, planeWarning.remainingMs - dtSeconds * 1000);
  if (planeWarning.remainingMs === 0) {
    return null;
  }

  return planeWarning;
}

export function createPlaneBonusEncounter(viewport: World['viewport']): {
  planeBonusEvent: PlaneBonusEventState;
  planeWarning: PlaneWarningState;
} {
  const path = createPlaneCornerPath(viewport);
  const dx = path.end.x - path.start.x;
  const dy = path.end.y - path.start.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const vx = (dx / distance) * PLANE_EVENT_SPEED;
  const vy = (dy / distance) * PLANE_EVENT_SPEED;
  const ttlMs = (distance / PLANE_EVENT_SPEED) * 1000 + 650;

  const effectRoll = Math.random();
  const effectMode =
    effectRoll < PLANE_COIN_TRAIL_CHANCE
      ? 'coin-trail'
      : effectRoll < PLANE_COIN_TRAIL_CHANCE + PLANE_SPOTLIGHT_CHANCE
        ? 'spotlight'
        : effectRoll < PLANE_COIN_TRAIL_CHANCE + PLANE_SPOTLIGHT_CHANCE + PLANE_LUCKY_WIND_CHANCE
          ? Math.random() < PLANE_POLICE_DELAY_MODE_CHANCE
            ? 'police-delay'
            : 'lucky-wind'
          : 'bonus-drop';

  return {
    planeBonusEvent: {
      x: path.start.x,
      y: path.start.y,
      vx,
      vy,
      angle: Math.atan2(vy, vx),
      ttlMs,
      distancePx: distance,
      traveledPx: 0,
      dropAtPx: distance * randomBetween(0.36, 0.64),
      dropped: false,
      flyoverSoundPlayed: false,
      effectMode,
    },
    planeWarning: {
      edge: getPlaneEntryEdge(viewport, path.start),
      remainingMs: PLANE_WARNING_MS,
      durationMs: PLANE_WARNING_MS,
    },
  };
}

export function advancePlaneBonusEventState(
  viewport: World['viewport'],
  planeBonusEvent: PlaneBonusEventState,
  dtSeconds: number,
): { dropReady: boolean; completed: boolean; enteredViewport: boolean } {
  const stepX = planeBonusEvent.vx * dtSeconds;
  const stepY = planeBonusEvent.vy * dtSeconds;
  planeBonusEvent.ttlMs = Math.max(0, planeBonusEvent.ttlMs - dtSeconds * 1000);
  planeBonusEvent.x += stepX;
  planeBonusEvent.y += stepY;
  planeBonusEvent.traveledPx += Math.hypot(stepX, stepY);

  const dropReady =
    !planeBonusEvent.dropped && planeBonusEvent.traveledPx >= planeBonusEvent.dropAtPx;
  const onscreen = !isPointOutsideViewport(viewport, planeBonusEvent.x, planeBonusEvent.y, 20);
  const enteredViewport = onscreen && !planeBonusEvent.flyoverSoundPlayed;
  if (enteredViewport) {
    planeBonusEvent.flyoverSoundPlayed = true;
  }
  const offscreen = isPointOutsideViewport(viewport, planeBonusEvent.x, planeBonusEvent.y, 86);
  const completed =
    planeBonusEvent.ttlMs === 0 ||
    planeBonusEvent.traveledPx >= planeBonusEvent.distancePx + 24 ||
    (offscreen && planeBonusEvent.flyoverSoundPlayed);

  return { dropReady, completed, enteredViewport };
}

export function tickPoliceSpawnCountdown(
  policeSpawnTimerMs: number,
  policeWarning: PoliceWarningState | null,
  dtSeconds: number,
): PoliceSpawnCountdownResult {
  const nextPoliceSpawnTimerMs = Math.max(0, policeSpawnTimerMs - dtSeconds * 1000);
  let nextPoliceWarning = policeWarning;
  let warningStarted = false;

  if (!nextPoliceWarning && nextPoliceSpawnTimerMs <= POLICE_WARNING_MS) {
    nextPoliceWarning = {
      edge: getRandomPoliceEdge(),
      remainingMs: nextPoliceSpawnTimerMs,
      durationMs: POLICE_WARNING_MS,
    };
    warningStarted = true;
  }

  if (nextPoliceWarning) {
    nextPoliceWarning.remainingMs = nextPoliceSpawnTimerMs;
  }

  return {
    policeSpawnTimerMs: nextPoliceSpawnTimerMs,
    policeWarning: nextPoliceWarning,
    warningStarted,
    shouldSpawn: nextPoliceSpawnTimerMs <= 0,
  };
}

export function createPoliceChase(
  viewport: World['viewport'],
  edge?: PoliceEdge,
): PoliceChaseState {
  const spawnEdge = edge ?? getRandomPoliceEdge();
  const spawn = getPoliceSpawn(viewport, spawnEdge);
  const durationMs = randomBetween(POLICE_CHASE_DURATION_MIN_MS, POLICE_CHASE_DURATION_MAX_MS);
  return {
    ...spawn,
    remainingMs: durationMs,
    durationMs,
    phase: 'chasing',
    exitEdge: spawnEdge,
  };
}

export function beginPoliceLeaving(
  viewport: World['viewport'],
  policeChase: PoliceChaseState,
): PoliceChaseState {
  policeChase.phase = 'leaving';
  policeChase.exitEdge = getNearestPoliceExitEdge(viewport, policeChase);
  return policeChase;
}

export function tickPoliceChaseDuration(policeChase: PoliceChaseState, dtSeconds: number): boolean {
  policeChase.remainingMs = Math.max(0, policeChase.remainingMs - dtSeconds * 1000);
  return policeChase.remainingMs === 0;
}

export function advancePoliceLeaving(
  viewport: World['viewport'],
  policeChase: PoliceChaseState,
  dtSeconds: number,
  onIce: boolean,
): void {
  const exitTarget = getPoliceExitTarget(viewport, policeChase);
  const policeCenter = getPoliceCenter(policeChase);
  const dx = exitTarget.x - policeCenter.x;
  const dy = exitTarget.y - policeCenter.y;
  const distance = Math.hypot(dx, dy);
  const exitSpeed = 230 * (onIce ? POLICE_ICE_SPEED_MULTIPLIER : 1);

  if (distance > 0.0001) {
    const targetAngle = Math.atan2(dy, dx);
    const turnBlend = clamp(dtSeconds * (onIce ? POLICE_ICE_TURN_RATE : 16), 0, 1);
    const moveAngle = blendAngle(policeChase.angle, targetAngle, turnBlend);
    policeChase.x += Math.cos(moveAngle) * exitSpeed * dtSeconds;
    policeChase.y += Math.sin(moveAngle) * exitSpeed * dtSeconds;
    policeChase.angle = moveAngle;
  }
}

export function advancePoliceChasing(
  policeChase: PoliceChaseState,
  dtSeconds: number,
  target: Vector2,
  score: number,
  onIce: boolean,
): { urgency: number } {
  const policeCenter = getPoliceCenter(policeChase);
  const dx = target.x - policeCenter.x;
  const dy = target.y - policeCenter.y;
  const distance = Math.hypot(dx, dy);
  const urgency = clamp(1 - distance / 260, 0.12, 1);
  const speed =
    (162 + Math.min(50, score * 0.2) + urgency * 28) * (onIce ? POLICE_ICE_SPEED_MULTIPLIER : 1);

  if (distance > 0.0001) {
    const targetAngle = Math.atan2(dy, dx);
    const turnBlend = clamp(dtSeconds * (onIce ? POLICE_ICE_TURN_RATE : 18), 0, 1);
    const moveAngle = blendAngle(policeChase.angle, targetAngle, turnBlend);
    policeChase.x += Math.cos(moveAngle) * speed * dtSeconds;
    policeChase.y += Math.sin(moveAngle) * speed * dtSeconds;
    policeChase.angle = moveAngle;
  }

  return { urgency };
}

function getPoliceCenter(police: { x: number; y: number }): Vector2 {
  return {
    x: police.x + POLICE_CAR_SIZE.width / 2,
    y: police.y + POLICE_CAR_SIZE.height / 2,
  };
}

export function getRandomPoliceEdge(): PoliceEdge {
  const edge = Math.floor(Math.random() * 4);
  switch (edge) {
    case 0:
      return 'top';
    case 1:
      return 'right';
    case 2:
      return 'bottom';
    default:
      return 'left';
  }
}

export function getNearestPoliceExitEdge(
  viewport: World['viewport'],
  police: { x: number; y: number },
): PoliceEdge {
  const center = rectCenter(getPoliceRect(police));
  const distances = [
    { edge: 'top' as const, distance: center.y },
    { edge: 'right' as const, distance: viewport.width - center.x },
    { edge: 'bottom' as const, distance: viewport.height - center.y },
    { edge: 'left' as const, distance: center.x },
  ];

  distances.sort((left, right) => left.distance - right.distance);
  return distances[0].edge;
}

export function getPoliceExitTarget(
  viewport: World['viewport'],
  police: { x: number; y: number; exitEdge: PoliceEdge },
): { x: number; y: number } {
  const center = rectCenter(getPoliceRect(police));

  switch (police.exitEdge) {
    case 'top':
      return { x: center.x, y: -POLICE_CAR_SIZE.height - 36 };
    case 'right':
      return { x: viewport.width + POLICE_CAR_SIZE.width + 36, y: center.y };
    case 'bottom':
      return { x: center.x, y: viewport.height + POLICE_CAR_SIZE.height + 36 };
    default:
      return { x: -POLICE_CAR_SIZE.width - 36, y: center.y };
  }
}

export function isPoliceOffscreen(
  viewport: World['viewport'],
  police: { x: number; y: number },
  padding: number,
): boolean {
  const rect = getPoliceRect(police);
  return (
    rect.x + rect.width < -padding ||
    rect.y + rect.height < -padding ||
    rect.x > viewport.width + padding ||
    rect.y > viewport.height + padding
  );
}

export function createPlaneCornerPath(viewport: World['viewport']): PlanePath {
  const startCorner = getRandomPlaneCorner();
  const endCorner = getOppositePlaneCorner(startCorner);
  return {
    start: getPlaneCornerPoint(viewport, startCorner),
    end: getPlaneCornerPoint(viewport, endCorner),
  };
}

function getRandomPlaneCorner(): PlaneCorner {
  const corner = Math.floor(Math.random() * 4);
  switch (corner) {
    case 0:
      return 'top-left';
    case 1:
      return 'top-right';
    case 2:
      return 'bottom-right';
    default:
      return 'bottom-left';
  }
}

function getOppositePlaneCorner(corner: PlaneCorner): PlaneCorner {
  switch (corner) {
    case 'top-left':
      return 'bottom-right';
    case 'top-right':
      return 'bottom-left';
    case 'bottom-right':
      return 'top-left';
    case 'bottom-left':
      return 'top-right';
  }
}

function getPlaneCornerPoint(viewport: World['viewport'], corner: PlaneCorner): Vector2 {
  const outside = PLANE_EVENT_ENTRY_OFFSET;
  const xSpan = Math.min(PLANE_EVENT_CORNER_SPAN, viewport.width * 0.26);
  const ySpan = Math.min(PLANE_EVENT_CORNER_SPAN, viewport.height * 0.26);
  const useHorizontalEdge = Math.random() < 0.5;

  switch (corner) {
    case 'top-left':
      return useHorizontalEdge
        ? { x: randomBetween(-outside, xSpan), y: -outside }
        : { x: -outside, y: randomBetween(-outside, ySpan) };
    case 'top-right':
      return useHorizontalEdge
        ? { x: randomBetween(viewport.width - xSpan, viewport.width + outside), y: -outside }
        : { x: viewport.width + outside, y: randomBetween(-outside, ySpan) };
    case 'bottom-right':
      return useHorizontalEdge
        ? {
            x: randomBetween(viewport.width - xSpan, viewport.width + outside),
            y: viewport.height + outside,
          }
        : {
            x: viewport.width + outside,
            y: randomBetween(viewport.height - ySpan, viewport.height + outside),
          };
    case 'bottom-left':
      return useHorizontalEdge
        ? { x: randomBetween(-outside, xSpan), y: viewport.height + outside }
        : { x: -outside, y: randomBetween(viewport.height - ySpan, viewport.height + outside) };
  }
}

export interface PlaneEncounterSchedulingStep {
  planeBonusTimerMs: number;
  shouldStartEncounter: boolean;
}

export function resolvePlaneEncounterSchedulingStep(options: {
  planeBonusTimerMs: number;
  hasRunProgress: boolean;
  policeOrWarningActive: boolean;
  dtSeconds: number;
}): PlaneEncounterSchedulingStep {
  if (!options.hasRunProgress) {
    return { planeBonusTimerMs: options.planeBonusTimerMs, shouldStartEncounter: false };
  }

  if (options.policeOrWarningActive) {
    return {
      planeBonusTimerMs: Math.max(options.planeBonusTimerMs, ENCOUNTER_STAGGER_MS),
      shouldStartEncounter: false,
    };
  }

  const nextTimerMs = Math.max(0, options.planeBonusTimerMs - options.dtSeconds * 1000);
  if (nextTimerMs > 0) {
    return { planeBonusTimerMs: nextTimerMs, shouldStartEncounter: false };
  }

  return { planeBonusTimerMs: 0, shouldStartEncounter: true };
}

export function isPointOutsideViewport(
  viewport: World['viewport'],
  x: number,
  y: number,
  padding: number,
): boolean {
  return (
    x < -padding || y < -padding || x > viewport.width + padding || y > viewport.height + padding
  );
}

export function createPlaneCoinTrailRects(
  viewport: World['viewport'],
  center: Vector2,
  direction: Vector2,
): Rect[] {
  const magnitude = Math.hypot(direction.x, direction.y);
  if (magnitude < 0.001) {
    return [];
  }

  const dir = {
    x: direction.x / magnitude,
    y: direction.y / magnitude,
  };
  const halfLength = PLANE_COIN_TRAIL_LENGTH_PX / 2;
  const halfSize = PLANE_COIN_TRAIL_COIN_SIZE_PX / 2;
  const minX = 8;
  const minY = 8;
  const maxX = Math.max(minX, viewport.width - PLANE_COIN_TRAIL_COIN_SIZE_PX - 8);
  const maxY = Math.max(minY, viewport.height - PLANE_COIN_TRAIL_COIN_SIZE_PX - 8);
  const rects: Rect[] = [];

  for (let offset = -halfLength; offset <= halfLength; offset += PLANE_COIN_TRAIL_STEP_PX) {
    const centerX = center.x + dir.x * offset;
    const centerY = center.y + dir.y * offset;
    if (
      centerX < -halfSize ||
      centerY < -halfSize ||
      centerX > viewport.width + halfSize ||
      centerY > viewport.height + halfSize
    ) {
      continue;
    }

    const rect: Rect = {
      x: clamp(centerX - halfSize, minX, maxX),
      y: clamp(centerY - halfSize, minY, maxY),
      width: PLANE_COIN_TRAIL_COIN_SIZE_PX,
      height: PLANE_COIN_TRAIL_COIN_SIZE_PX,
    };

    const duplicate = rects.some(
      (existing) =>
        Math.abs(existing.x - rect.x) < 0.5 &&
        Math.abs(existing.y - rect.y) < 0.5 &&
        existing.width === rect.width &&
        existing.height === rect.height,
    );
    if (!duplicate) {
      rects.push(rect);
    }
  }

  return rects;
}

export function getPlaneEntryEdge(viewport: World['viewport'], point: Vector2): PoliceEdge {
  const distances = [
    { edge: 'top' as const, distance: point.y },
    { edge: 'right' as const, distance: viewport.width - point.x },
    { edge: 'bottom' as const, distance: viewport.height - point.y },
    { edge: 'left' as const, distance: point.x },
  ];
  distances.sort((left, right) => left.distance - right.distance);
  return distances[0].edge;
}

export function getPoliceSpawn(
  viewport: World['viewport'],
  edge: PoliceEdge,
): { x: number; y: number; angle: number } {
  switch (edge) {
    case 'top':
      return {
        x: randomBetween(24, viewport.width - POLICE_CAR_SIZE.width - 24),
        y: -POLICE_CAR_SIZE.height - 12,
        angle: Math.PI / 2,
      };
    case 'right':
      return {
        x: viewport.width + 12,
        y: randomBetween(20, viewport.height - POLICE_CAR_SIZE.height - 20),
        angle: Math.PI,
      };
    case 'bottom':
      return {
        x: randomBetween(24, viewport.width - POLICE_CAR_SIZE.width - 24),
        y: viewport.height + 12,
        angle: -Math.PI / 2,
      };
    default:
      return {
        x: -POLICE_CAR_SIZE.width - 12,
        y: randomBetween(20, viewport.height - POLICE_CAR_SIZE.height - 20),
        angle: 0,
      };
  }
}
