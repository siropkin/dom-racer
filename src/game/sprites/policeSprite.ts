import type { ViewportSize } from '../../shared/types';
import { drawBorderedRect, drawWheel } from './spriteHelpers';

export type PoliceEdge = 'top' | 'right' | 'bottom' | 'left';

export interface PoliceWarningRenderState {
  edge: PoliceEdge;
  remainingMs: number;
  durationMs: number;
}

export interface PoliceCarPose {
  x: number;
  y: number;
  angle: number;
}

interface EdgeWarningOptions {
  edge: PoliceEdge;
  label: string;
  colorOn: string;
  colorOff: string;
  flashPeriodMs?: number;
  padding?: number;
}

export const POLICE_CAR_SIZE = {
  width: 30,
  height: 16,
} as const;

export function renderPoliceWarningIndicator(
  ctx: CanvasRenderingContext2D,
  viewport: ViewportSize,
  warning: PoliceWarningRenderState,
  now: number,
): void {
  renderEdgeWarningIndicator(ctx, viewport, now, {
    edge: warning.edge,
    label: 'WEE-OO',
    colorOn: '#93c5fd',
    colorOff: '#1d4ed8',
    flashPeriodMs: 70,
    padding: 20,
  });
}

export function renderEdgeWarningIndicator(
  ctx: CanvasRenderingContext2D,
  viewport: ViewportSize,
  now: number,
  options: EdgeWarningOptions,
): void {
  const flashOn = Math.sin(now / (options.flashPeriodMs ?? 80)) > -0.1;
  const alpha = flashOn ? 0.96 : 0.24;
  const color = flashOn ? options.colorOn : options.colorOff;
  const padding = options.padding ?? 20;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.font = 'bold 12px "SFMono-Regular", "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  switch (options.edge) {
    case 'top':
      drawWarningTriangle(ctx, viewport.width / 2, padding, 'down');
      ctx.fillText(options.label, viewport.width / 2, padding + 22);
      break;
    case 'right':
      drawWarningTriangle(ctx, viewport.width - padding, viewport.height / 2, 'left');
      ctx.fillText(options.label, viewport.width - 54, viewport.height / 2 + 20);
      break;
    case 'bottom': {
      const bottomPad = Math.max(padding, 70);
      drawWarningTriangle(ctx, viewport.width / 2, viewport.height - bottomPad, 'up');
      ctx.fillText(options.label, viewport.width / 2, viewport.height - bottomPad - 24);
    }
      break;
    case 'left':
      drawWarningTriangle(ctx, padding, viewport.height / 2, 'right');
      ctx.fillText(options.label, 58, viewport.height / 2 + 20);
      break;
  }

  ctx.restore();
}

export function renderPoliceCarSprite(
  ctx: CanvasRenderingContext2D,
  policeChase: PoliceCarPose,
  now: number,
  chasing = false,
): void {
  const centerX = policeChase.x + POLICE_CAR_SIZE.width / 2;
  const centerY = policeChase.y + POLICE_CAR_SIZE.height / 2;
  const pulse = Math.sin(now / 110) > 0;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(policeChase.angle);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.36)';
  ctx.fillRect(-11.5, -5.5, 23, 11);

  drawWheel(ctx, -6, -10, 1.8);
  drawWheel(ctx, 6, -10, 1.8);
  drawWheel(ctx, -6, 10, 1.8);
  drawWheel(ctx, 6, 10, 1.8);

  const sirenBody = chasing ? (Math.floor(now / 120) % 2 === 0 ? '#ef4444' : '#3b82f6') : '#e5e7eb';
  drawBorderedRect(ctx, -12.9, -7.9, 25.8, 15.8, 4.6, 'rgba(15, 23, 42, 0.78)');
  drawBorderedRect(ctx, -12, -7, 24, 14, 4, sirenBody, '#f8fafc', 1.8);
  drawBorderedRect(ctx, -6.5, -9.5, 12, 19, 4, '#111827');

  ctx.fillStyle = '#dbeafe';
  ctx.fillRect(-1.5, -5.5, 6, 11);

  drawBorderedRect(ctx, -2.2, -6.9, 4.4, 13.8, 1.8, '#0f172a');

  ctx.fillStyle = pulse ? '#93c5fd' : '#1d4ed8';
  ctx.fillRect(-1.45, -6.0, 2.9, 5.2);
  ctx.fillStyle = pulse ? '#991b1b' : '#f87171';
  ctx.fillRect(-1.45, 0.8, 2.9, 5.2);
  ctx.fillStyle = '#111827';
  ctx.fillRect(10.5, -2.5, 2, 2);
  ctx.fillRect(10.5, 0.5, 2, 2);
  ctx.fillStyle = '#7f1d1d';
  ctx.fillRect(-12.5, -2.5, 2, 2);
  ctx.fillRect(-12.5, 0.5, 2, 2);

  ctx.restore();
}

function drawWarningTriangle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  direction: 'up' | 'right' | 'down' | 'left',
): void {
  ctx.beginPath();
  switch (direction) {
    case 'up':
      ctx.moveTo(x, y - 10);
      ctx.lineTo(x - 10, y + 10);
      ctx.lineTo(x + 10, y + 10);
      break;
    case 'right':
      ctx.moveTo(x + 10, y);
      ctx.lineTo(x - 10, y - 10);
      ctx.lineTo(x - 10, y + 10);
      break;
    case 'down':
      ctx.moveTo(x, y + 10);
      ctx.lineTo(x - 10, y - 10);
      ctx.lineTo(x + 10, y - 10);
      break;
    case 'left':
      ctx.moveTo(x - 10, y);
      ctx.lineTo(x + 10, y - 10);
      ctx.lineTo(x + 10, y + 10);
      break;
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}
