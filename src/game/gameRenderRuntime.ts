import type { Vector2, ViewportSize, WorldPickup } from '../shared/types';
import { clamp } from '../shared/utils';
import { renderPlaneSprite } from './planeSprite';
import { drawRegularCoinSprite, drawSpecialPickupSprite } from './pickupSprites';
import type { PlaneBonusEventState, SpecialSpawnCue } from './gameStateTypes';
import type { SurfaceSample } from './gameRuntime';
import type { OvergrowthNode, OvergrowthStage } from './overgrowthRuntime';

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

const PAGE_LIGHTNESS_SAMPLE_POINTS = [
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

interface OvergrowthStageStyle {
  fill: string;
  alpha: number;
  stroke: string;
}

const BUSH_STAGE_STYLES: Record<OvergrowthStage, OvergrowthStageStyle> = {
  small: { fill: '#86efac', alpha: 0.36, stroke: '' },
  medium: { fill: '#4ade80', alpha: 0.62, stroke: '' },
  large: { fill: '#22c55e', alpha: 0.88, stroke: '#15803d' },
};

const TREE_STAGE_STYLES: Record<OvergrowthStage, OvergrowthStageStyle & { trunk: string; inner: string }> = {
  small: { fill: '#6ee7b7', alpha: 0.36, stroke: '', trunk: '#a16207', inner: '#86efac' },
  medium: { fill: '#34d399', alpha: 0.62, stroke: '', trunk: '#92400e', inner: '#4ade80' },
  large: { fill: '#059669', alpha: 0.88, stroke: '#15803d', trunk: '#78350f', inner: '#22c55e' },
};

function getOvergrowthEntryScale(growthMs: number): number {
  return 0.6 + clamp(growthMs / 1200, 0, 1) * 0.4;
}

export function drawOvergrowthNodes(
  ctx: CanvasRenderingContext2D,
  nodes: OvergrowthNode[],
  nowMs: number,
): void {
  if (nodes.length === 0) {
    return;
  }

  ctx.save();
  for (const node of nodes) {
    if (node.kind === 'bush') {
      drawOvergrowthBush(ctx, node, nowMs);
    } else {
      drawOvergrowthTree(ctx, node, nowMs);
    }
  }
  ctx.restore();
}

function drawOvergrowthBush(
  ctx: CanvasRenderingContext2D,
  node: OvergrowthNode,
  nowMs: number,
): void {
  const { rect, stage, growthMs } = node;
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const scale = getOvergrowthEntryScale(growthMs);
  const style = BUSH_STAGE_STYLES[stage];

  const sway = Math.sin(nowMs / 1100 + cx * 0.013) * 0.8;
  const entryAlpha = 0.7 + clamp(growthMs / 800, 0, 1) * 0.3;

  const hw = (rect.width / 2) * scale;
  const hh = (rect.height / 2) * scale;

  ctx.save();
  ctx.globalAlpha = style.alpha * entryAlpha;
  ctx.fillStyle = style.fill;

  ctx.beginPath();
  ctx.ellipse(cx + sway, cy, hw * 0.82, hh * 0.82, 0, 0, Math.PI * 2);
  ctx.fill();

  const bumpCount = stage === 'small' ? 3 : stage === 'medium' ? 5 : 7;
  const bumpRadius = Math.min(hw, hh) * (stage === 'small' ? 0.32 : 0.38);
  for (let i = 0; i < bumpCount; i += 1) {
    const angle = (i / bumpCount) * Math.PI * 2 + nowMs / 6000;
    const bx = cx + sway + Math.cos(angle) * hw * 0.58;
    const by = cy + Math.sin(angle) * hh * 0.58;
    ctx.beginPath();
    ctx.ellipse(bx, by, bumpRadius, bumpRadius * 0.88, angle * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  if (stage === 'large' && style.stroke) {
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(cx + sway, cy, hw * 0.86, hh * 0.86, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawOvergrowthTree(
  ctx: CanvasRenderingContext2D,
  node: OvergrowthNode,
  nowMs: number,
): void {
  const { rect, stage, growthMs } = node;
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const scale = getOvergrowthEntryScale(growthMs);
  const style = TREE_STAGE_STYLES[stage];

  const sway = Math.sin(nowMs / 1300 + cx * 0.011) * 0.6;
  const entryAlpha = 0.7 + clamp(growthMs / 800, 0, 1) * 0.3;

  const hw = (rect.width / 2) * scale;
  const hh = (rect.height / 2) * scale;

  ctx.save();
  ctx.globalAlpha = style.alpha * entryAlpha;

  const trunkRadius = Math.max(2.5, Math.min(hw, hh) * 0.22);
  ctx.fillStyle = style.trunk;
  ctx.beginPath();
  ctx.ellipse(cx, cy, trunkRadius, trunkRadius, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = style.fill;
  ctx.beginPath();
  ctx.ellipse(cx + sway, cy, hw * 0.78, hh * 0.78, 0, 0, Math.PI * 2);
  ctx.fill();

  const innerRadius = Math.min(hw, hh) * 0.42;
  ctx.fillStyle = style.inner;
  ctx.beginPath();
  ctx.ellipse(cx + sway * 0.5, cy, innerRadius, innerRadius * 0.88, 0, 0, Math.PI * 2);
  ctx.fill();

  if (stage === 'large' && style.stroke) {
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(cx + sway, cy, hw * 0.82, hh * 0.82, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}
