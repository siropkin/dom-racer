import type { WorldPickup } from '../../shared/types';
import { drawBorderedRect, traceStarPath } from './spriteHelpers';

export function drawRegularCoinSprite(
  ctx: CanvasRenderingContext2D,
  options: {
    centerX: number;
    centerY: number;
    radius: number;
    width: number;
  },
): void {
  const { centerX, centerY, radius, width } = options;
  const fillColor = '#f59e0b';
  const strokeColor = '#7c2d12';
  const innerColor = '#fff7ed';

  ctx.fillStyle = 'rgba(15, 23, 42, 0.16)';
  ctx.beginPath();
  ctx.ellipse(centerX, centerY + 2, width + 2, radius + 1, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = fillColor;
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, width, radius, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  ctx.strokeStyle = innerColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, width - 1.5, Math.max(2, radius - 1.5), 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = innerColor;
  ctx.fillRect(centerX - 0.75, centerY - radius + 1.5, 1.5, radius * 2 - 3);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(centerX - width * 0.55, centerY - radius * 0.4);
  ctx.lineTo(centerX - width * 0.2, centerY - radius * 0.75);
  ctx.stroke();
}

export function drawSpecialPickupSprite(
  ctx: CanvasRenderingContext2D,
  pickup: WorldPickup,
  options: {
    centerX: number;
    centerY: number;
    radius: number;
    spin: number;
    nowMs: number;
  },
): void {
  if (pickup.effect === 'jackpot') {
    drawJackpotPickupSprite(ctx, options);
    return;
  }

  const { centerX, centerY, radius, spin, nowMs } = options;
  const accent = pickup.accentColor ?? '#f8fafc';
  const pulse = 0.88 + spin * 0.2;
  const half = radius * pulse;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.18)';
  ctx.beginPath();
  ctx.ellipse(centerX, centerY + 3, half + 3, radius * 0.78, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(Math.sin(nowMs / 420) * 0.18);
  drawBorderedRect(ctx, -half, -half, half * 2, half * 2, 5, accent, '#ffffff', 1.4);

  const labelColor = pickup.effect === 'oil_slick' ? '#e2e8f0' : 'rgba(15, 23, 42, 0.86)';
  ctx.fillStyle = labelColor;
  ctx.font = 'bold 8px "SFMono-Regular", "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(pickup.label ?? 'FX', 0, 0.5);
  ctx.restore();
}

function drawJackpotPickupSprite(
  ctx: CanvasRenderingContext2D,
  options: {
    centerX: number;
    centerY: number;
    radius: number;
    spin: number;
    nowMs: number;
  },
): void {
  const { centerX, centerY, radius, spin, nowMs } = options;
  const pulse = 0.92 + spin * 0.16;
  const r = radius * pulse * 1.15;
  const glowPhase = Math.sin(nowMs / 320) * 0.5 + 0.5;

  ctx.save();

  ctx.fillStyle = `rgba(250, 204, 21, ${0.12 + glowPhase * 0.14})`;
  ctx.beginPath();
  ctx.arc(centerX, centerY, r + 6 + glowPhase * 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(15, 23, 42, 0.2)';
  ctx.beginPath();
  ctx.ellipse(centerX, centerY + 4, r + 4, radius * 0.68, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(centerX, centerY);
  ctx.rotate(Math.sin(nowMs / 340) * 0.12);

  const points = 6;
  const outerR = r;
  const innerR = r * 0.48;
  traceStarPath(ctx, points, outerR, innerR);
  ctx.fillStyle = '#facc15';
  ctx.fill();
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 1;
  const innerStarR = outerR * 0.68;
  const innerStarInner = innerR * 0.72;
  traceStarPath(ctx, points, innerStarR, innerStarInner);
  ctx.stroke();

  const sparkleCount = 4;
  const sparklePhase = nowMs / 600;
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 + glowPhase * 0.4})`;
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  for (let i = 0; i < sparkleCount; i += 1) {
    const angle = sparklePhase + (i / sparkleCount) * Math.PI * 2;
    const dist = outerR + 3 + Math.sin(nowMs / 200 + i * 1.7) * 2.5;
    const sx = Math.cos(angle) * dist;
    const sy = Math.sin(angle) * dist;
    const len = 2.2 + Math.sin(nowMs / 260 + i) * 1.2;
    ctx.beginPath();
    ctx.moveTo(sx - len, sy);
    ctx.lineTo(sx + len, sy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sx, sy - len);
    ctx.lineTo(sx, sy + len);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';

  ctx.fillStyle = 'rgba(120, 53, 15, 0.88)';
  ctx.font = 'bold 9px "SFMono-Regular", "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('JKP', 0, 0.5);

  ctx.restore();
}
