import type { WorldPickup } from '../shared/types';

export function drawRegularCoinSprite(
  ctx: CanvasRenderingContext2D,
  options: {
    centerX: number;
    centerY: number;
    radius: number;
    width: number;
    isFlowCoin: boolean;
  },
): void {
  const { centerX, centerY, radius, width, isFlowCoin } = options;
  const fillColor = isFlowCoin ? '#60a5fa' : '#f59e0b';
  const strokeColor = isFlowCoin ? '#1e3a8a' : '#7c2d12';
  const innerColor = isFlowCoin ? '#eff6ff' : '#fff7ed';

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
  ctx.fillStyle = accent;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.roundRect(-half, -half, half * 2, half * 2, 5);
  ctx.fill();
  ctx.stroke();

  const labelColor = pickup.effect === 'blackout' ? '#e2e8f0' : 'rgba(15, 23, 42, 0.86)';
  ctx.fillStyle = labelColor;
  ctx.font = 'bold 8px "SFMono-Regular", "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(pickup.label ?? 'FX', 0, 0.5);
  ctx.restore();
}
