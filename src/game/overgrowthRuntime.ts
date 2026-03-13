import type { Rect } from '../shared/types';
import { clamp, rectsIntersect } from '../shared/utils';
import { OVERGROWTH } from './gameConfig';
import { cloneRect, randomBetween } from './gameRuntime';

export type OvergrowthKind = 'bush' | 'tree';
export type OvergrowthStage = 'small' | 'medium' | 'large';
export type OvergrowthEdge = 'top' | 'right' | 'bottom' | 'left';

export interface OvergrowthNode {
  id: string;
  kind: OvergrowthKind;
  rect: Rect;
  anchorRect: Rect;
  anchorEdge: OvergrowthEdge;
  stage: OvergrowthStage;
  growthMs: number;
  spawnedAtRunMs: number;
}

export const OVERGROWTH_SPAWN_START_MS = OVERGROWTH.SPAWN_START_MS;
export const OVERGROWTH_SPAWN_INTERVAL_MIN_MS = OVERGROWTH.SPAWN_INTERVAL_MIN_MS;
export const OVERGROWTH_SPAWN_INTERVAL_MAX_MS = OVERGROWTH.SPAWN_INTERVAL_MAX_MS;
export const OVERGROWTH_MAX_NODES = OVERGROWTH.MAX_NODES;

export const OVERGROWTH_GROWTH_SMALL_TO_MEDIUM_MS = OVERGROWTH.GROWTH_SMALL_TO_MEDIUM_MS;
export const OVERGROWTH_GROWTH_MEDIUM_TO_LARGE_MS = OVERGROWTH.GROWTH_MEDIUM_TO_LARGE_MS;

const OVERGROWTH_SMALL_DEPTH = 10;
const OVERGROWTH_MEDIUM_DEPTH = 20;
const OVERGROWTH_LARGE_DEPTH = 32;

const OVERGROWTH_MIN_SPAN = 18;
const OVERGROWTH_MAX_SPAN = 44;

export interface OvergrowthSpawnStep {
  overgrowthSpawnTimerMs: number;
  shouldSpawn: boolean;
}

/** Checks whether a new overgrowth node should spawn this frame. */
export function resolveOvergrowthSpawnStep(options: {
  overgrowthSpawnTimerMs: number;
  runElapsedMs: number;
  existingNodeCount: number;
  dtSeconds: number;
}): OvergrowthSpawnStep {
  if (options.runElapsedMs < OVERGROWTH_SPAWN_START_MS) {
    return { overgrowthSpawnTimerMs: options.overgrowthSpawnTimerMs, shouldSpawn: false };
  }

  if (options.existingNodeCount >= OVERGROWTH_MAX_NODES) {
    return { overgrowthSpawnTimerMs: options.overgrowthSpawnTimerMs, shouldSpawn: false };
  }

  const nextTimerMs = Math.max(0, options.overgrowthSpawnTimerMs - options.dtSeconds * 1000);
  if (nextTimerMs > 0) {
    return { overgrowthSpawnTimerMs: nextTimerMs, shouldSpawn: false };
  }

  return { overgrowthSpawnTimerMs: 0, shouldSpawn: true };
}

export function getOvergrowthRespawnDelayMs(): number {
  return randomBetween(OVERGROWTH_SPAWN_INTERVAL_MIN_MS, OVERGROWTH_SPAWN_INTERVAL_MAX_MS);
}

/** Attempts to place a new overgrowth node along a random barrier edge. */
export function trySpawnOvergrowthNode(
  anchors: Rect[],
  existingNodes: OvergrowthNode[],
  blockers: Rect[],
  runElapsedMs: number,
): OvergrowthNode | null {
  if (anchors.length === 0) {
    return null;
  }

  const shuffledAnchors = [...anchors].sort(() => Math.random() - 0.5);

  for (const anchor of shuffledAnchors) {
    const edges = getUsableEdges(anchor);
    const shuffledEdges = edges.sort(() => Math.random() - 0.5);

    for (const edge of shuffledEdges) {
      const span = randomBetween(OVERGROWTH_MIN_SPAN, OVERGROWTH_MAX_SPAN);
      const rect = computeOvergrowthRect(anchor, edge, OVERGROWTH_SMALL_DEPTH, span);
      if (!rect) {
        continue;
      }

      const tooClose = existingNodes.some((node) => {
        const dx = rect.x + rect.width / 2 - (node.rect.x + node.rect.width / 2);
        const dy = rect.y + rect.height / 2 - (node.rect.y + node.rect.height / 2);
        return Math.hypot(dx, dy) < 40;
      });
      if (tooClose) {
        continue;
      }

      if (blockers.some((blocker) => rectsIntersect(rect, blocker))) {
        continue;
      }

      const kind: OvergrowthKind = Math.random() < OVERGROWTH.BUSH_CHANCE ? 'bush' : 'tree';
      return {
        id: `overgrowth:${kind}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
        kind,
        rect,
        anchorRect: cloneRect(anchor),
        anchorEdge: edge,
        stage: 'small',
        growthMs: 0,
        spawnedAtRunMs: runElapsedMs,
      };
    }
  }

  return null;
}

/** Advances growth timers on all overgrowth nodes, promoting stages when thresholds are reached. */
export function advanceOvergrowthGrowth(
  nodes: OvergrowthNode[],
  dtSeconds: number,
): OvergrowthNode[] {
  const deltaMs = dtSeconds * 1000;

  for (const node of nodes) {
    node.growthMs += deltaMs;

    if (node.stage === 'small' && node.growthMs >= OVERGROWTH_GROWTH_SMALL_TO_MEDIUM_MS) {
      node.stage = 'medium';
      node.growthMs = 0;
      node.rect = growRect(node.anchorRect, node.anchorEdge, OVERGROWTH_MEDIUM_DEPTH, node.rect);
    } else if (node.stage === 'medium' && node.growthMs >= OVERGROWTH_GROWTH_MEDIUM_TO_LARGE_MS) {
      node.stage = 'large';
      node.growthMs = 0;
      node.rect = growRect(node.anchorRect, node.anchorEdge, OVERGROWTH_LARGE_DEPTH, node.rect);
    }
  }

  return nodes;
}

export function getOvergrowthSlowZones(nodes: OvergrowthNode[]): Rect[] {
  return nodes
    .filter((node) => node.stage === 'small' || node.stage === 'medium')
    .map((node) => cloneRect(node.rect));
}

export function getOvergrowthObstacles(nodes: OvergrowthNode[]): Rect[] {
  return nodes.filter((node) => node.stage === 'large').map((node) => cloneRect(node.rect));
}

function getUsableEdges(anchor: Rect): OvergrowthEdge[] {
  const edges: OvergrowthEdge[] = [];
  if (anchor.y > 30) {
    edges.push('top');
  }
  if (anchor.x > 30) {
    edges.push('left');
  }
  edges.push('bottom');
  edges.push('right');
  return edges;
}

function computeOvergrowthRect(
  anchor: Rect,
  edge: OvergrowthEdge,
  depth: number,
  span: number,
): Rect | null {
  const clampedSpan = Math.min(
    span,
    edge === 'top' || edge === 'bottom' ? anchor.width : anchor.height,
  );
  if (clampedSpan < OVERGROWTH_MIN_SPAN) {
    return null;
  }

  const offsetAlongEdge = randomBetween(
    0,
    Math.max(0, (edge === 'top' || edge === 'bottom' ? anchor.width : anchor.height) - clampedSpan),
  );

  switch (edge) {
    case 'top':
      return {
        x: anchor.x + offsetAlongEdge,
        y: anchor.y - depth,
        width: clampedSpan,
        height: depth,
      };
    case 'bottom':
      return {
        x: anchor.x + offsetAlongEdge,
        y: anchor.y + anchor.height,
        width: clampedSpan,
        height: depth,
      };
    case 'left':
      return {
        x: anchor.x - depth,
        y: anchor.y + offsetAlongEdge,
        width: depth,
        height: clampedSpan,
      };
    case 'right':
      return {
        x: anchor.x + anchor.width,
        y: anchor.y + offsetAlongEdge,
        width: depth,
        height: clampedSpan,
      };
  }
}

function growRect(
  anchorRect: Rect,
  edge: OvergrowthEdge,
  newDepth: number,
  currentRect: Rect,
): Rect {
  switch (edge) {
    case 'top':
      return {
        x: currentRect.x,
        y: anchorRect.y - newDepth,
        width: currentRect.width,
        height: newDepth,
      };
    case 'bottom':
      return {
        x: currentRect.x,
        y: anchorRect.y + anchorRect.height,
        width: currentRect.width,
        height: newDepth,
      };
    case 'left':
      return {
        x: anchorRect.x - newDepth,
        y: currentRect.y,
        width: newDepth,
        height: currentRect.height,
      };
    case 'right':
      return {
        x: anchorRect.x + anchorRect.width,
        y: currentRect.y,
        width: newDepth,
        height: currentRect.height,
      };
  }
}

// ---------------------------------------------------------------------------
// Overgrowth rendering
// ---------------------------------------------------------------------------

interface OvergrowthStageStyle {
  fill: string;
  alpha: number;
  stroke: string;
}

const BUSH_STAGE_STYLES: Readonly<Record<OvergrowthStage, OvergrowthStageStyle>> = {
  small: { fill: '#86efac', alpha: 0.36, stroke: '' },
  medium: { fill: '#4ade80', alpha: 0.62, stroke: '' },
  large: { fill: '#22c55e', alpha: 0.88, stroke: '#15803d' },
};

const TREE_STAGE_STYLES: Readonly<
  Record<OvergrowthStage, OvergrowthStageStyle & { trunk: string; inner: string }>
> = {
  small: { fill: '#6ee7b7', alpha: 0.36, stroke: '', trunk: '#a16207', inner: '#86efac' },
  medium: { fill: '#34d399', alpha: 0.62, stroke: '', trunk: '#92400e', inner: '#4ade80' },
  large: { fill: '#059669', alpha: 0.88, stroke: '#15803d', trunk: '#78350f', inner: '#22c55e' },
};

function getOvergrowthEntryScale(growthMs: number): number {
  return 0.6 + clamp(growthMs / 1200, 0, 1) * 0.4;
}

/** Renders all active overgrowth nodes (bushes and trees) with growth and sway animation. */
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
