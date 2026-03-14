import type { VehicleDesign } from '../../shared/types';
import {
  applyAdaptiveShadow,
  drawBorderedRect,
  drawContourOutline,
  drawWheel,
} from './spriteHelpers';

interface RenderPlayerSpriteOptions {
  centerX: number;
  centerY: number;
  angle: number;
  design: VehicleDesign;
  boostActive: boolean;
  magnetActive: boolean;
  opacity: number;
  nowMs: number;
  airborne?: boolean;
  scaleX?: number;
  scaleY?: number;
}

export function renderPlayerSprite(
  ctx: CanvasRenderingContext2D,
  options: RenderPlayerSpriteOptions,
): void {
  const airborne = options.airborne ?? false;
  const sx = options.scaleX ?? 1;
  const sy = options.scaleY ?? 1;

  ctx.save();
  ctx.translate(options.centerX, options.centerY);
  ctx.rotate(options.angle);
  if (sx !== 1 || sy !== 1) {
    ctx.scale(sx, sy);
  }
  ctx.globalAlpha = options.opacity;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
  ctx.globalAlpha = 0.28 * options.opacity;
  ctx.fillRect(-10, -5, 20, 10);
  ctx.globalAlpha = options.opacity;

  if (options.magnetActive) {
    const pulse = 0.84 + 0.16 * Math.sin(options.nowMs / 120);
    const halo = 1 + 0.12 * Math.sin(options.nowMs / 95);
    ctx.fillStyle = 'rgba(34, 211, 238, 0.24)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 17.5 * halo, 12.5 * halo, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(103, 232, 249, 0.95)';
    ctx.lineWidth = 2.1;
    ctx.beginPath();
    ctx.ellipse(0, 0, 16.5 * pulse, 11.5 * pulse, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(34, 211, 238, 0.68)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 21.5 * pulse, 14.5 * pulse, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(165, 243, 252, 0.9)';
    for (let index = 0; index < 4; index += 1) {
      const angle = options.nowMs / 190 + index * (Math.PI / 2);
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * 15.5, Math.sin(angle) * 11, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.globalAlpha = options.opacity;
  applyAdaptiveShadow(ctx);
  drawWheel(ctx, -5, -10);
  drawWheel(ctx, 5, -10);
  drawWheel(ctx, -5, 10);
  drawWheel(ctx, 5, 10);
  drawVehicleBody(ctx, options.design, airborne);

  if (options.boostActive) {
    ctx.fillStyle = 'rgba(245, 158, 11, 0.3)';
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(-10, -6);
    ctx.lineTo(-10, 6);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(-15, -3, 3, 2);
    ctx.fillRect(-15, 1, 3, 2);
    ctx.fillStyle = '#fde68a';
    ctx.fillRect(-17, -2.5, 2, 1.5);
    ctx.fillRect(-17, 1, 2, 1.5);
  }

  ctx.restore();
}

function drawVehicleBody(
  ctx: CanvasRenderingContext2D,
  design: VehicleDesign,
  airborne: boolean,
): void {
  switch (design) {
    case 'buggy':
      drawBuggyBody(ctx, airborne);
      return;
    case 'truck':
      drawTruckBody(ctx, airborne);
      return;
    case 'coupe':
    default:
      drawCoupeBody(ctx, airborne);
  }
}

function drawCoupeBody(ctx: CanvasRenderingContext2D, airborne: boolean): void {
  drawBorderedRect(ctx, -11.5, -7.5, 22, 15, 5, airborne ? '#60a5fa' : '#2563eb', '#f8fafc', 1.8);

  drawBorderedRect(ctx, -6.5, -10.5, 12, 21, 4, '#1d4ed8', '#f8fafc', 1.8);

  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(-7, -1.5, 13, 3);

  drawBorderedRect(ctx, -1.5, -6, 5, 12, 2, '#dbeafe');

  ctx.fillStyle = '#111827';
  ctx.fillRect(10.5, -3, 2, 2);
  ctx.fillRect(10.5, 1, 2, 2);

  ctx.fillStyle = '#7f1d1d';
  ctx.fillRect(-12.5, -3, 2, 2);
  ctx.fillRect(-12.5, 1, 2, 2);

  drawContourOutline(ctx, -11.5, -7.5, 22, 15, 5, 'rgba(15, 23, 42, 0.85)', 1);
}

function drawBuggyBody(ctx: CanvasRenderingContext2D, airborne: boolean): void {
  drawBorderedRect(ctx, -10.5, -7, 20, 14, 4, airborne ? '#fb923c' : '#f97316', '#f8fafc', 1.6);

  ctx.fillStyle = '#7c2d12';
  ctx.fillRect(-7, -8.5, 9, 17);
  ctx.fillRect(3.5, -5.5, 4, 11);

  ctx.strokeStyle = '#fdba74';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-4.5, -8.5);
  ctx.lineTo(3.5, -2.5);
  ctx.moveTo(-4.5, 8.5);
  ctx.lineTo(3.5, 2.5);
  ctx.stroke();

  ctx.fillStyle = '#fed7aa';
  ctx.fillRect(-1.5, -4, 5, 8);
  ctx.fillStyle = '#fef3c7';
  ctx.fillRect(-9.5, -1.5, 2, 3);
  ctx.fillRect(8.5, -1.5, 2, 3);

  drawContourOutline(ctx, -10.5, -7, 20, 14, 4, 'rgba(15, 23, 42, 0.85)', 1);
}

function drawTruckBody(ctx: CanvasRenderingContext2D, airborne: boolean): void {
  drawBorderedRect(ctx, -12, -7.5, 24, 15, 4, airborne ? '#34d399' : '#059669', '#f8fafc', 1.7);

  drawBorderedRect(ctx, -1.5, -7.5, 12.5, 15, 4, '#064e3b', '#f8fafc', 1.7);

  ctx.fillStyle = '#d1fae5';
  ctx.fillRect(1.5, -4.5, 6.5, 4);
  ctx.fillStyle = '#a7f3d0';
  ctx.fillRect(-9, -5, 6, 10);

  ctx.fillStyle = '#111827';
  ctx.fillRect(10.5, -2.5, 2, 2);
  ctx.fillRect(10.5, 0.5, 2, 2);
  ctx.fillStyle = '#7f1d1d';
  ctx.fillRect(-12.5, -2.5, 2, 2);
  ctx.fillRect(-12.5, 0.5, 2, 2);

  drawContourOutline(ctx, -12, -7.5, 24, 15, 4, 'rgba(15, 23, 42, 0.85)', 1);
}
