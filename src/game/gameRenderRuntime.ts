import type { Vector2, ViewportSize, WorldPickup } from '../shared/types';
import { renderPlaneSprite } from './planeSprite';
import { drawRegularCoinSprite, drawSpecialPickupSprite } from './pickupSprites';
import type { PlaneBonusEventState, PlaneBoostLaneState, SpecialSpawnCue } from './gameStateTypes';

export function drawPickups(
  ctx: CanvasRenderingContext2D,
  pickups: WorldPickup[],
  comboTimerMs: number,
  pickupComboCount: number,
  nowMs: number,
): void {
  ctx.save();

  for (const [index, pickup] of pickups.entries()) {
    const centerX = pickup.rect.x + pickup.rect.width / 2;
    const centerY = pickup.rect.y + pickup.rect.height / 2;
    const radius = pickup.rect.width / 2 + 1;
    const spin = Math.abs(Math.sin(nowMs / 180 + index * 0.75));
    const width = Math.max(3.5, radius * (0.3 + spin * 0.7));

    if (pickup.kind === 'special' && pickup.effect) {
      drawSpecialPickupSprite(ctx, pickup, {
        centerX,
        centerY,
        radius,
        spin,
        nowMs,
      });
      continue;
    }

    const isFlowCoin = comboTimerMs > 0 && pickupComboCount >= 3;
    drawRegularCoinSprite(ctx, {
      centerX,
      centerY,
      radius,
      width,
      isFlowCoin,
    });
  }

  ctx.restore();
}

export function drawSpecialSpawnCues(
  ctx: CanvasRenderingContext2D,
  cues: SpecialSpawnCue[],
  blackoutLabel: string,
): void {
  if (cues.length === 0) {
    return;
  }

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 9px "SFMono-Regular", "JetBrains Mono", monospace';

  for (const cue of cues) {
    const progress = 1 - cue.ttlMs / cue.durationMs;
    const ringRadius = 10 + progress * 22;
    const alpha = Math.max(0, Math.min(1, cue.ttlMs / 600));

    ctx.globalAlpha = alpha * 0.85;
    ctx.strokeStyle = cue.color;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(cue.x, cue.y, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
    ctx.fillRect(cue.x - 14, cue.y - 26, 28, 12);
    ctx.strokeStyle = cue.color;
    ctx.lineWidth = 1.1;
    ctx.strokeRect(cue.x - 13.5, cue.y - 25.5, 27, 11);
    ctx.fillStyle = cue.label === blackoutLabel ? '#e2e8f0' : cue.color;
    ctx.fillText(cue.label, cue.x, cue.y - 20);
  }

  ctx.restore();
}

export function drawPlaneBonusEvent(
  ctx: CanvasRenderingContext2D,
  planeBonusEvent: PlaneBonusEventState | null,
  nowMs: number,
): void {
  if (!planeBonusEvent) {
    return;
  }

  renderPlaneSprite(
    ctx,
    { x: planeBonusEvent.x, y: planeBonusEvent.y, angle: planeBonusEvent.angle },
    nowMs,
    {
      wobbleRadians: Math.sin(nowMs / 220) * 0.022,
      snapToPixel: true,
    },
  );
}

export function drawPlaneBoostLane(
  ctx: CanvasRenderingContext2D,
  planeBoostLane: PlaneBoostLaneState | null,
  nowMs: number,
): void {
  if (!planeBoostLane) {
    return;
  }

  const life = Math.max(0, Math.min(1, planeBoostLane.ttlMs / Math.max(1, planeBoostLane.durationMs)));
  const pulse = 0.86 + Math.sin(nowMs / 130) * 0.14;

  ctx.save();
  for (const [index, rect] of planeBoostLane.rects.entries()) {
    const shimmer = 0.82 + Math.sin(nowMs / 94 + index * 0.74) * 0.18;
    const alpha = Math.max(0.06, life * 0.24 * pulse * shimmer);
    ctx.fillStyle = `rgba(56, 189, 248, ${alpha})`;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    ctx.strokeStyle = `rgba(186, 230, 253, ${Math.max(0.18, life * 0.56)})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.width - 1, rect.height - 1);
  }
  ctx.restore();
}

export function drawFocusModeLayer(
  ctx: CanvasRenderingContext2D,
  viewport: ViewportSize,
  playerCenter: Vector2 | null,
  focusModeAlpha: number,
): void {
  if (focusModeAlpha <= 0.01) {
    return;
  }

  const { width, height } = viewport;
  const center = playerCenter ?? { x: width / 2, y: height / 2 };
  const radius = Math.max(width, height) * 0.72;

  ctx.save();
  const vignette = ctx.createRadialGradient(center.x, center.y, 44, center.x, center.y, radius);
  vignette.addColorStop(0, `rgba(56, 189, 248, ${0.05 * focusModeAlpha})`);
  vignette.addColorStop(0.45, `rgba(14, 116, 144, ${0.018 * focusModeAlpha})`);
  vignette.addColorStop(1, 'rgba(2, 6, 23, 0)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}
