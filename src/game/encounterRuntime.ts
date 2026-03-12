import type { Rect, Vector2, World } from '../shared/types';
import { clamp, rectCenter } from '../shared/utils';
import {
  PLANE_BOOST_LANE_LENGTH_PX,
  PLANE_BOOST_LANE_STEP_PX,
  PLANE_BOOST_LANE_WIDTH_PX,
  PLANE_EVENT_CORNER_SPAN,
  PLANE_EVENT_ENTRY_OFFSET,
  randomBetween,
} from './gameRuntime';
import { POLICE_CAR_SIZE, type PoliceEdge } from './policeSprite';

interface PlanePath {
  start: Vector2;
  end: Vector2;
}

type PlaneCorner = 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left';

export function getPoliceRect(police: { x: number; y: number }): Rect {
  return {
    x: police.x,
    y: police.y,
    width: POLICE_CAR_SIZE.width,
    height: POLICE_CAR_SIZE.height,
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

export function isPointOutsideViewport(
  viewport: World['viewport'],
  x: number,
  y: number,
  padding: number,
): boolean {
  return x < -padding || y < -padding || x > viewport.width + padding || y > viewport.height + padding;
}

export function createPlaneBoostLaneRects(
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
  const halfLength = PLANE_BOOST_LANE_LENGTH_PX / 2;
  const halfWidth = PLANE_BOOST_LANE_WIDTH_PX / 2;
  const minX = 8;
  const minY = 8;
  const maxX = Math.max(minX, viewport.width - PLANE_BOOST_LANE_WIDTH_PX - 8);
  const maxY = Math.max(minY, viewport.height - PLANE_BOOST_LANE_WIDTH_PX - 8);
  const rects: Rect[] = [];

  for (let offset = -halfLength; offset <= halfLength; offset += PLANE_BOOST_LANE_STEP_PX) {
    const centerX = center.x + dir.x * offset;
    const centerY = center.y + dir.y * offset;
    if (
      centerX < -halfWidth ||
      centerY < -halfWidth ||
      centerX > viewport.width + halfWidth ||
      centerY > viewport.height + halfWidth
    ) {
      continue;
    }

    const rect: Rect = {
      x: clamp(centerX - halfWidth, minX, maxX),
      y: clamp(centerY - halfWidth, minY, maxY),
      width: PLANE_BOOST_LANE_WIDTH_PX,
      height: PLANE_BOOST_LANE_WIDTH_PX,
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
