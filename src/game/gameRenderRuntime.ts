import type { Vector2, ViewportSize, WorldPickup } from '../shared/types';
import { clamp } from '../shared/utils';
import { renderPlaneSprite, drawRegularCoinSprite, drawSpecialPickupSprite } from './sprites';
import type { PlaneBonusEventState, SpecialSpawnCue, SurfaceSample } from './gameStateTypes';

/** Renders all world pickups (coins and specials) with spin animation. */
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

export function advanceSpecialSpawnCues(
  cues: SpecialSpawnCue[],
  dtSeconds: number,
): SpecialSpawnCue[] {
  if (cues.length === 0) {
    return cues;
  }

  const deltaMs = dtSeconds * 1000;
  return cues
    .map((cue) => ({
      ...cue,
      ttlMs: cue.ttlMs - deltaMs,
    }))
    .filter((cue) => cue.ttlMs > 0);
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

export function advanceFocusModeAlpha(
  currentAlpha: number,
  policeActive: boolean,
  dtSeconds: number,
): number {
  const target = policeActive ? 0 : 1;
  const rate = target > currentAlpha ? 1.1 : 2.6;
  return currentAlpha + (target - currentAlpha) * Math.min(1, dtSeconds * rate * 6);
}

const PAGE_LIGHTNESS_SAMPLE_POINTS: readonly { x: number; y: number }[] = [
  { x: 0.18, y: 0.2 },
  { x: 0.5, y: 0.2 },
  { x: 0.82, y: 0.2 },
  { x: 0.18, y: 0.5 },
  { x: 0.5, y: 0.5 },
  { x: 0.82, y: 0.5 },
  { x: 0.18, y: 0.8 },
  { x: 0.5, y: 0.8 },
  { x: 0.82, y: 0.8 },
];

export function estimatePageLightness(
  viewport: ViewportSize,
  sampleSurfaceAt: (point: Vector2) => SurfaceSample,
): number {
  let total = 0;
  let count = 0;
  for (const point of PAGE_LIGHTNESS_SAMPLE_POINTS) {
    const sample = sampleSurfaceAt({
      x: viewport.width * point.x,
      y: viewport.height * point.y,
    });
    if (Number.isFinite(sample.lightness)) {
      total += clamp(sample.lightness, 0, 1);
      count += 1;
    }
  }
  return count > 0 ? total / count : 0.5;
}

/** Draws the radial vignette overlay centered on the player during non-police play. */
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
