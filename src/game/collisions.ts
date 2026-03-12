import type { Rect, Vector2 } from '../shared/types';
import { rectsIntersect } from '../shared/utils';

interface MoveResult {
  position: Vector2;
  hitX: boolean;
  hitY: boolean;
}

export function collidesWithAny(rect: Rect, obstacles: Rect[]): boolean {
  return obstacles.some((obstacle) => rectsIntersect(rect, obstacle));
}

export function moveWithCollisions(
  position: Vector2,
  size: { width: number; height: number },
  delta: Vector2,
  obstacles: Rect[],
): MoveResult {
  let nextX = position.x + delta.x;
  let nextY = position.y + delta.y;
  let hitX = false;
  let hitY = false;

  const xRect: Rect = {
    x: nextX,
    y: position.y,
    width: size.width,
    height: size.height,
  };

  if (collidesWithAny(xRect, obstacles)) {
    nextX = position.x;
    hitX = true;
  }

  const yRect: Rect = {
    x: nextX,
    y: nextY,
    width: size.width,
    height: size.height,
  };

  if (collidesWithAny(yRect, obstacles)) {
    nextY = position.y;
    hitY = true;
  }

  return {
    position: {
      x: nextX,
      y: nextY,
    },
    hitX,
    hitY,
  };
}
