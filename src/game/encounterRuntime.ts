import type { Rect, Vector2, ViewportSize, World } from '../shared/types';
import type {
  PlaneBonusEventState,
  PlaneWarningState,
  PoliceChaseState,
  PoliceWarningState,
} from './gameStateTypes';
import { clamp, rectCenter, rectsIntersect } from '../shared/utils';
import { ENCOUNTER, PLANE, POLICE, TIMING } from './gameConfig';
import { blendAngle, randomBetween } from './gameRuntime';
import { POLICE_CAR_SIZE, type PoliceEdge } from './sprites';

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

/** Returns the axis-aligned bounding rect for a police car at the given position. */
export function getPoliceRect(police: { x: number; y: number }): Rect {
  return {
    x: police.x,
    y: police.y,
    width: POLICE_CAR_SIZE.width,
    height: POLICE_CAR_SIZE.height,
  };
}

/** Decrements the plane warning timer and clears it when expired. */
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

/** Spawns a new airplane flyover encounter with a random corner-to-corner flight path. */
export function createPlaneBonusEncounter(viewport: World['viewport']): {
  planeBonusEvent: PlaneBonusEventState;
  planeWarning: PlaneWarningState;
} {
  const path = createPlaneCornerPath(viewport);
  const dx = path.end.x - path.start.x;
  const dy = path.end.y - path.start.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const vx = (dx / distance) * PLANE.EVENT_SPEED;
  const vy = (dy / distance) * PLANE.EVENT_SPEED;
  const ttlMs = (distance / PLANE.EVENT_SPEED) * 1000 + 650;

  const effectRoll = Math.random();
  let cumulative = 0;
  let effectMode: PlaneBonusEventState['effectMode'];
  cumulative += PLANE.MYSTERY_DROP_CHANCE;
  if (effectRoll < cumulative) {
    effectMode = 'mystery-drop';
  } else {
    cumulative += PLANE.COIN_TRAIL_CHANCE;
    if (effectRoll < cumulative) {
      effectMode = 'coin-trail';
    } else {
      cumulative += PLANE.SPOTLIGHT_CHANCE;
      if (effectRoll < cumulative) {
        effectMode = 'spotlight';
      } else {
        cumulative += PLANE.LUCKY_WIND_CHANCE;
        if (effectRoll < cumulative) {
          effectMode = Math.random() < PLANE.POLICE_DELAY_MODE_CHANCE ? 'police-delay' : 'lucky-wind';
        } else {
          effectMode = 'bonus-drop';
        }
      }
    }
  }

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
      remainingMs: TIMING.PLANE_WARNING_MS,
      durationMs: TIMING.PLANE_WARNING_MS,
    },
  };
}

/** Moves the airplane along its flight path and checks for drop/completion triggers. */
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

/** Counts down the police spawn timer and triggers a warning when close to spawning. */
function tickPoliceSpawnCountdown(
  policeSpawnTimerMs: number,
  policeWarning: PoliceWarningState | null,
  dtSeconds: number,
): PoliceSpawnCountdownResult {
  const nextPoliceSpawnTimerMs = Math.max(0, policeSpawnTimerMs - dtSeconds * 1000);
  let nextPoliceWarning = policeWarning;
  let warningStarted = false;

  if (!nextPoliceWarning && nextPoliceSpawnTimerMs <= TIMING.POLICE_WARNING_MS) {
    nextPoliceWarning = {
      edge: getRandomPoliceEdge(),
      remainingMs: nextPoliceSpawnTimerMs,
      durationMs: TIMING.POLICE_WARNING_MS,
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

/** Creates a new police chase state entering from the given viewport edge. */
export function createPoliceChase(
  viewport: World['viewport'],
  edge?: PoliceEdge,
  runElapsedMs = 0,
  viewportScaleFactor = 1,
  policeChaseCount = 1,
  helicopterChaseCount = 0,
): PoliceChaseState {
  const spawnEdge = edge ?? getRandomPoliceEdge();
  const spawn = getPoliceSpawn(viewport, spawnEdge);
  const escalation = Math.min(1, runElapsedMs / 180_000);
  const minMs = POLICE.CHASE_DURATION_MIN_MS + escalation * 3_000;
  const maxMs = POLICE.CHASE_DURATION_MAX_MS + escalation * 4_000;
  let durationMs = randomBetween(minMs, maxMs) * viewportScaleFactor;
  const variant: 'car' | 'helicopter' =
    policeChaseCount >= POLICE.HELICOPTER_CHASE_THRESHOLD &&
    runElapsedMs >= POLICE.HELICOPTER_MIN_RUN_TIME_MS
      ? 'helicopter'
      : 'car';

  // Progressive helicopter escalation
  let helicopterSpeedOverride: number | undefined;
  if (variant === 'helicopter' && helicopterChaseCount > 0) {
    durationMs = Math.min(
      POLICE.HELICOPTER_MAX_DURATION_MS,
      durationMs + helicopterChaseCount * POLICE.HELICOPTER_DURATION_ESCALATION_MS,
    );
    helicopterSpeedOverride = Math.min(
      POLICE.HELICOPTER_MAX_SPEED,
      POLICE.HELICOPTER_SPEED + helicopterChaseCount * POLICE.HELICOPTER_SPEED_ESCALATION,
    );
  }

  return {
    ...spawn,
    remainingMs: durationMs,
    durationMs,
    phase: 'chasing',
    exitEdge: spawnEdge,
    variant,
    helicopterSpeedOverride,
  };
}

function beginPoliceLeaving(
  viewport: World['viewport'],
  policeChase: PoliceChaseState,
): PoliceChaseState {
  policeChase.phase = 'leaving';
  policeChase.exitEdge = getNearestPoliceExitEdge(viewport, policeChase);
  return policeChase;
}

function tickPoliceChaseDuration(policeChase: PoliceChaseState, dtSeconds: number): boolean {
  policeChase.remainingMs = Math.max(0, policeChase.remainingMs - dtSeconds * 1000);
  return policeChase.remainingMs === 0;
}

function advancePoliceLeaving(
  viewport: World['viewport'],
  policeChase: PoliceChaseState,
  dtSeconds: number,
  onIce: boolean,
): void {
  const isHeli = policeChase.variant === 'helicopter';
  const exitTarget = getPoliceExitTarget(viewport, policeChase);
  const policeCenter = getPoliceCenter(policeChase);
  const dx = exitTarget.x - policeCenter.x;
  const dy = exitTarget.y - policeCenter.y;
  const distance = Math.hypot(dx, dy);
  const iceOnGround = onIce && !isHeli;
  const exitSpeed = 230 * (iceOnGround ? POLICE.ICE_SPEED_MULTIPLIER : 1);

  if (distance > 0.0001) {
    const targetAngle = Math.atan2(dy, dx);
    const turnBlend = clamp(dtSeconds * (iceOnGround ? POLICE.ICE_TURN_RATE : 16), 0, 1);
    const moveAngle = blendAngle(policeChase.angle, targetAngle, turnBlend);
    policeChase.x += Math.cos(moveAngle) * exitSpeed * dtSeconds;
    policeChase.y += Math.sin(moveAngle) * exitSpeed * dtSeconds;
    policeChase.angle = moveAngle;
  }
}

/** Moves the police car toward the player and returns chase urgency. */
export function advancePoliceChasing(
  policeChase: PoliceChaseState,
  dtSeconds: number,
  target: Vector2,
  score: number,
  onIce: boolean,
): { urgency: number } {
  const isHeli = policeChase.variant === 'helicopter';
  const policeCenter = getPoliceCenter(policeChase);
  const dx = target.x - policeCenter.x;
  const dy = target.y - policeCenter.y;
  const distance = Math.hypot(dx, dy);
  const urgency = clamp(1 - distance / 260, 0.12, 1);

  const iceOnGround = onIce && !isHeli;
  const speed = isHeli
    ? (policeChase.helicopterSpeedOverride ?? POLICE.HELICOPTER_SPEED)
    : (162 + Math.min(50, score * 0.2) + urgency * 28) *
      (iceOnGround ? POLICE.ICE_SPEED_MULTIPLIER : 1);

  if (distance > 0.0001) {
    const targetAngle = Math.atan2(dy, dx);
    const turnBlend = isHeli
      ? clamp(dtSeconds * POLICE.HELICOPTER_TURN_BLEND, 0, 1)
      : clamp(dtSeconds * (iceOnGround ? POLICE.ICE_TURN_RATE : 18), 0, 1);
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

function getRandomPoliceEdge(): PoliceEdge {
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

function getNearestPoliceExitEdge(
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

function getPoliceExitTarget(
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

function isPoliceOffscreen(
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

function createPlaneCornerPath(viewport: World['viewport']): PlanePath {
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
  const outside = PLANE.EVENT_ENTRY_OFFSET;
  const xSpan = Math.min(PLANE.EVENT_CORNER_SPAN, viewport.width * 0.26);
  const ySpan = Math.min(PLANE.EVENT_CORNER_SPAN, viewport.height * 0.26);
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

/** Determines whether it is time to start a new airplane encounter. */
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
      planeBonusTimerMs: Math.max(options.planeBonusTimerMs, ENCOUNTER.STAGGER_MS),
      shouldStartEncounter: false,
    };
  }

  const nextTimerMs = Math.max(0, options.planeBonusTimerMs - options.dtSeconds * 1000);
  if (nextTimerMs > 0) {
    return { planeBonusTimerMs: nextTimerMs, shouldStartEncounter: false };
  }

  return { planeBonusTimerMs: 0, shouldStartEncounter: true };
}

function isPointOutsideViewport(
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
  const trailLength = PLANE.COIN_TRAIL_LENGTH_PX;
  const halfSize = PLANE.COIN_TRAIL_COIN_SIZE_PX / 2;
  const minX = 8;
  const minY = 8;
  const maxX = Math.max(minX, viewport.width - PLANE.COIN_TRAIL_COIN_SIZE_PX - 8);
  const maxY = Math.max(minY, viewport.height - PLANE.COIN_TRAIL_COIN_SIZE_PX - 8);
  const rects: Rect[] = [];

  for (let offset = -trailLength; offset <= 0; offset += PLANE.COIN_TRAIL_STEP_PX) {
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
      width: PLANE.COIN_TRAIL_COIN_SIZE_PX,
      height: PLANE.COIN_TRAIL_COIN_SIZE_PX,
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

function getPlaneEntryEdge(viewport: World['viewport'], point: Vector2): PoliceEdge {
  const distances = [
    { edge: 'top' as const, distance: point.y },
    { edge: 'right' as const, distance: viewport.width - point.x },
    { edge: 'bottom' as const, distance: viewport.height - point.y },
    { edge: 'left' as const, distance: point.x },
  ];
  distances.sort((left, right) => left.distance - right.distance);
  return distances[0].edge;
}

export type PoliceChaseTickEvent =
  | 'ghost-dismiss'
  | 'warning-started'
  | 'chase-spawned'
  | 'escaped'
  | 'leaving-offscreen'
  | 'caught';

export interface PoliceChaseTickInput {
  viewport: ViewportSize;
  iceZones: Rect[];
  playerBounds: Rect;
  playerCenter: Vector2;
  ghostActive: boolean;
  policeChase: PoliceChaseState | null;
  policeWarning: PoliceWarningState | null;
  policeSpawnTimerMs: number;
  planeBonusActive: boolean;
  planeWarningActive: boolean;
  score: number;
  hasRunProgress: boolean;
  runElapsedMs: number;
  dtSeconds: number;
  viewportScaleFactor?: number;
  policeChaseCount?: number;
  helicopterChaseCount?: number;
}

export interface PoliceChaseTickResult {
  policeChase: PoliceChaseState | null;
  policeWarning: PoliceWarningState | null;
  policeSpawnTimerMs: number;
  planeBonusTimerMs: number | null;
  active: boolean;
  urgency: number;
  caught: boolean;
  events: PoliceChaseTickEvent[];
}

/** Advances the full police chase lifecycle: pre-spawn, chasing, leaving, ghost-dismiss. */
export function resolvePoliceChaseTickStep(input: PoliceChaseTickInput): PoliceChaseTickResult {
  const events: PoliceChaseTickEvent[] = [];
  let { policeChase, policeWarning, policeSpawnTimerMs } = input;

  if (input.ghostActive) {
    policeWarning = null;
    if (policeChase?.phase === 'chasing') {
      policeChase = beginPoliceLeaving(input.viewport, policeChase);
      events.push('ghost-dismiss');
    }
  }

  if (!policeChase) {
    if (input.ghostActive) {
      return {
        policeChase,
        policeWarning,
        policeSpawnTimerMs,
        planeBonusTimerMs: null,
        active: false,
        urgency: 0,
        caught: false,
        events,
      };
    }

    if (input.runElapsedMs < POLICE.START_DELAY_MS || !input.hasRunProgress) {
      return {
        policeChase,
        policeWarning,
        policeSpawnTimerMs,
        planeBonusTimerMs: null,
        active: false,
        urgency: 0,
        caught: false,
        events,
      };
    }

    if (input.planeBonusActive || input.planeWarningActive) {
      policeWarning = null;
      policeSpawnTimerMs = Math.max(policeSpawnTimerMs, ENCOUNTER.STAGGER_MS);
      return {
        policeChase,
        policeWarning,
        policeSpawnTimerMs,
        planeBonusTimerMs: null,
        active: false,
        urgency: 0,
        caught: false,
        events,
      };
    }

    const countdown = tickPoliceSpawnCountdown(policeSpawnTimerMs, policeWarning, input.dtSeconds);
    policeSpawnTimerMs = countdown.policeSpawnTimerMs;
    policeWarning = countdown.policeWarning;

    if (countdown.warningStarted) {
      events.push('warning-started');
    }

    if (countdown.shouldSpawn) {
      policeChase = createPoliceChase(
        input.viewport,
        policeWarning?.edge,
        input.runElapsedMs,
        input.viewportScaleFactor ?? 1,
        input.policeChaseCount ?? 1,
        input.helicopterChaseCount ?? 0,
      );
      policeSpawnTimerMs = randomBetween(POLICE.POST_SPAWN_MIN_MS, POLICE.POST_SPAWN_MAX_MS);
      policeWarning = null;
      events.push('chase-spawned');
      return {
        policeChase,
        policeWarning,
        policeSpawnTimerMs,
        planeBonusTimerMs: null,
        active: true,
        urgency: 0.3,
        caught: false,
        events,
      };
    }

    return {
      policeChase,
      policeWarning,
      policeSpawnTimerMs,
      planeBonusTimerMs: null,
      active: false,
      urgency: 0,
      caught: false,
      events,
    };
  }

  if (policeChase.phase === 'leaving') {
    const policeRect = getPoliceRect(policeChase);
    const onIce = isOnIceZone(policeRect, input.iceZones);
    advancePoliceLeaving(input.viewport, policeChase, input.dtSeconds, onIce);

    if (isPoliceOffscreen(input.viewport, policeChase, 28)) {
      policeChase = null;
      policeSpawnTimerMs = randomBetween(POLICE.RESPAWN_MIN_MS, POLICE.RESPAWN_MAX_MS);
      const planeBonusTimerMs =
        !input.planeBonusActive && !input.planeWarningActive
          ? randomBetween(ENCOUNTER.PLANE_AFTER_POLICE_MIN_MS, ENCOUNTER.PLANE_AFTER_POLICE_MAX_MS)
          : null;
      events.push('leaving-offscreen');
      return {
        policeChase,
        policeWarning,
        policeSpawnTimerMs,
        planeBonusTimerMs,
        active: false,
        urgency: 0,
        caught: false,
        events,
      };
    }

    return {
      policeChase,
      policeWarning,
      policeSpawnTimerMs,
      planeBonusTimerMs: null,
      active: false,
      urgency: 0,
      caught: false,
      events,
    };
  }

  const chaseExpired = tickPoliceChaseDuration(policeChase, input.dtSeconds);
  if (chaseExpired) {
    policeChase = beginPoliceLeaving(input.viewport, policeChase);
    events.push('escaped');
    return {
      policeChase,
      policeWarning,
      policeSpawnTimerMs,
      planeBonusTimerMs: null,
      active: false,
      urgency: 0,
      caught: false,
      events,
    };
  }

  const policeRect = getPoliceRect(policeChase);
  const onIce = isOnIceZone(policeRect, input.iceZones);
  const chaseStep = advancePoliceChasing(
    policeChase,
    input.dtSeconds,
    input.playerCenter,
    input.score,
    onIce,
  );

  if (rectsIntersect(input.playerBounds, getPoliceRect(policeChase))) {
    events.push('caught');
    return {
      policeChase,
      policeWarning,
      policeSpawnTimerMs,
      planeBonusTimerMs: null,
      active: false,
      urgency: 1,
      caught: true,
      events,
    };
  }

  return {
    policeChase,
    policeWarning,
    policeSpawnTimerMs,
    planeBonusTimerMs: null,
    active: true,
    urgency: chaseStep.urgency,
    caught: false,
    events,
  };
}

function isOnIceZone(rect: Rect, iceZones: Rect[]): boolean {
  return iceZones.some((zone) => rectsIntersect(rect, zone));
}

function getPoliceSpawn(
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
