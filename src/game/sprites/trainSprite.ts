import type { Rect, ViewportSize } from '../../shared/types';
import type { TrainState } from '../gameStateTypes';
import { TRAIN } from '../gameConfig';
import { applyAdaptiveShadow, clearAdaptiveShadow, drawBorderedRect } from './spriteHelpers';

// ---------------------------------------------------------------------------
// Caltrain-style top-down train sprite
// ---------------------------------------------------------------------------

const LOCO_LENGTH = 28;
const CAR_LENGTH = 24;
const CAR_GAP = 2;
const CAR_COUNT = 2;
const TOTAL_LENGTH = LOCO_LENGTH + CAR_COUNT * (CAR_LENGTH + CAR_GAP);

const BODY_COLOR = '#cbd5e1';
const BODY_STROKE = '#94a3b8';
const STRIPE_COLOR = '#dc2626';
const LOCO_ACCENT = '#64748b';
const WINDOW_COLOR = '#1e3a8a';
const COUPLER_COLOR = '#475569';

export function renderTrainSprite(
  ctx: CanvasRenderingContext2D,
  train: TrainState,
  viewport: ViewportSize,
  now: number,
): void {
  if (train.phase === 'warning') {
    renderRailFlash(ctx, train, now);
    return;
  }

  const bodyRect = getTrainVisualRect(train, viewport);
  renderRailFlash(ctx, train, now);

  ctx.save();

  if (train.axis === 'horizontal') {
    renderHorizontalTrain(ctx, bodyRect, train.direction, now);
  } else {
    renderVerticalTrain(ctx, bodyRect, train.direction, now);
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Rail flash effect (warning + crossing phases)
// ---------------------------------------------------------------------------

export function renderRailFlash(
  ctx: CanvasRenderingContext2D,
  train: TrainState,
  now: number,
): void {
  const pulse = 0.15 + 0.25 * (0.5 + 0.5 * Math.sin(now / 80));

  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#eab308';

  if (train.axis === 'horizontal') {
    ctx.fillRect(train.rail.x, train.rail.y - 2, train.rail.width, train.rail.height + 4);
  } else {
    ctx.fillRect(train.rail.x - 2, train.rail.y, train.rail.width + 4, train.rail.height);
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Horizontal train rendering (left-to-right or right-to-left)
// ---------------------------------------------------------------------------

function renderHorizontalTrain(
  ctx: CanvasRenderingContext2D,
  bodyRect: Rect,
  direction: 1 | -1,
  now: number,
): void {
  const bodyH = TRAIN.BODY_HEIGHT;
  const centerY = bodyRect.y + bodyRect.height / 2;
  const headX = direction === 1 ? bodyRect.x + bodyRect.width : bodyRect.x;
  const dir = -direction;

  applyAdaptiveShadow(ctx);

  for (let i = CAR_COUNT - 1; i >= 0; i--) {
    const carStart = headX + dir * (LOCO_LENGTH + i * (CAR_LENGTH + CAR_GAP));
    const carX = direction === 1 ? carStart - CAR_LENGTH : carStart;
    drawPassengerCar(ctx, carX, centerY - bodyH / 2, CAR_LENGTH, bodyH);

    const couplerX = direction === 1 ? carStart - CAR_LENGTH - CAR_GAP : carStart + CAR_LENGTH;
    ctx.fillStyle = COUPLER_COLOR;
    ctx.fillRect(couplerX, centerY - 1.5, CAR_GAP, 3);
  }

  const locoX = direction === 1 ? headX - LOCO_LENGTH : headX;
  drawLocomotive(ctx, locoX, centerY - bodyH / 2, LOCO_LENGTH, bodyH, direction, now);

  clearAdaptiveShadow(ctx);
}

// ---------------------------------------------------------------------------
// Vertical train rendering (top-to-bottom or bottom-to-top)
// ---------------------------------------------------------------------------

function renderVerticalTrain(
  ctx: CanvasRenderingContext2D,
  bodyRect: Rect,
  direction: 1 | -1,
  now: number,
): void {
  const bodyW = TRAIN.BODY_HEIGHT;
  const centerX = bodyRect.x + bodyRect.width / 2;
  const headY = direction === 1 ? bodyRect.y + bodyRect.height : bodyRect.y;
  const dir = -direction;

  ctx.save();
  ctx.translate(centerX, headY);
  ctx.rotate(Math.PI / 2);
  ctx.translate(-headY, -centerX);

  applyAdaptiveShadow(ctx);

  for (let i = CAR_COUNT - 1; i >= 0; i--) {
    const carStartY = headY + dir * (LOCO_LENGTH + i * (CAR_LENGTH + CAR_GAP));
    const carY = direction === 1 ? carStartY - CAR_LENGTH : carStartY;
    drawPassengerCar(ctx, carY, centerX - bodyW / 2, CAR_LENGTH, bodyW);

    const couplerY = direction === 1 ? carStartY - CAR_LENGTH - CAR_GAP : carStartY + CAR_LENGTH;
    ctx.fillStyle = COUPLER_COLOR;
    ctx.fillRect(couplerY, centerX - 1.5, CAR_GAP, 3);
  }

  const locoY = direction === 1 ? headY - LOCO_LENGTH : headY;
  drawLocomotive(ctx, locoY, centerX - bodyW / 2, LOCO_LENGTH, bodyW, direction, now);

  clearAdaptiveShadow(ctx);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Car sub-components
// ---------------------------------------------------------------------------

function drawLocomotive(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  direction: 1 | -1,
  _now: number,
): void {
  drawBorderedRect(ctx, x - 0.5, y - 0.5, w + 1, h + 1, 3, 'rgba(15, 23, 42, 0.5)');
  drawBorderedRect(ctx, x, y, w, h, 2.5, LOCO_ACCENT, BODY_STROKE, 1.0);

  ctx.fillStyle = STRIPE_COLOR;
  ctx.fillRect(x + 2, y + h / 2 - 1.2, w - 4, 2.4);

  const cabX = direction === 1 ? x + w - 10 : x + 2;
  drawBorderedRect(ctx, cabX, y + 2, 8, h - 4, 1.5, BODY_COLOR, BODY_STROKE, 0.8);

  ctx.fillStyle = WINDOW_COLOR;
  ctx.fillRect(cabX + 1.5, y + 3, 5, h - 6);

  const noseX = direction === 1 ? x : x + w - 4;
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.roundRect(noseX, y + 1.5, 4, h - 3, [
    direction === 1 ? 2 : 0,
    direction === 1 ? 0 : 2,
    direction === 1 ? 0 : 2,
    direction === 1 ? 2 : 0,
  ]);
  ctx.fill();

  const lightX = direction === 1 ? x + 1 : x + w - 3;
  ctx.fillStyle = '#facc15';
  ctx.fillRect(lightX, y + 2.5, 2, 2);
  ctx.fillRect(lightX, y + h - 4.5, 2, 2);
}

function drawPassengerCar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  drawBorderedRect(ctx, x - 0.4, y - 0.4, w + 0.8, h + 0.8, 2, 'rgba(15, 23, 42, 0.4)');
  drawBorderedRect(ctx, x, y, w, h, 1.8, BODY_COLOR, BODY_STROKE, 0.9);

  ctx.fillStyle = STRIPE_COLOR;
  ctx.fillRect(x + 1.5, y + h / 2 - 0.8, w - 3, 1.6);

  const windowCount = Math.floor((w - 4) / 5);
  const windowSpacing = (w - 4) / windowCount;
  ctx.fillStyle = WINDOW_COLOR;
  for (let i = 0; i < windowCount; i++) {
    ctx.fillRect(x + 2 + i * windowSpacing + 1, y + 2, 2.5, h - 4);
  }
}

// ---------------------------------------------------------------------------
// Visual rect helper (for rendering — uses BODY_HEIGHT, not HITBOX_HEIGHT)
// ---------------------------------------------------------------------------

function getTrainVisualRect(train: TrainState, viewport: ViewportSize): Rect {
  if (train.axis === 'horizontal') {
    const startX = train.direction === 1 ? -TOTAL_LENGTH : viewport.width;
    const currentX = startX + train.direction * train.progressPx;
    const centerY = train.rail.y + train.rail.height / 2;
    return {
      x: currentX,
      y: centerY - TRAIN.BODY_HEIGHT / 2,
      width: TOTAL_LENGTH,
      height: TRAIN.BODY_HEIGHT,
    };
  }

  const startY = train.direction === 1 ? -TOTAL_LENGTH : viewport.height;
  const currentY = startY + train.direction * train.progressPx;
  const centerX = train.rail.x + train.rail.width / 2;
  return {
    x: centerX - TRAIN.BODY_HEIGHT / 2,
    y: currentY,
    width: TRAIN.BODY_HEIGHT,
    height: TOTAL_LENGTH,
  };
}
