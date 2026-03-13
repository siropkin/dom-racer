import type { Rect } from '../shared/types';
import { clamp, rectsIntersect } from '../shared/utils';
import { OVERGROWTH } from './gameConfig';
import { cloneRect, randomBetween } from './gameRuntime';
import { applyAdaptiveShadow } from './sprites';

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
  spawnStartMs?: number;
}): OvergrowthSpawnStep {
  const startMs = options.spawnStartMs ?? OVERGROWTH_SPAWN_START_MS;
  if (options.runElapsedMs < startMs) {
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

interface OvergrowthStyle {
  body: string;
  dark: string;
  light: string;
  outline: string;
  alpha: number;
}

const BUSH_STYLES: Readonly<Record<OvergrowthStage, OvergrowthStyle>> = {
  small: { body: '#86efac', dark: '#22c55e', light: '#bbf7d0', outline: '#15803d', alpha: 0.5 },
  medium: { body: '#4ade80', dark: '#16a34a', light: '#86efac', outline: '#15803d', alpha: 0.72 },
  large: { body: '#22c55e', dark: '#166534', light: '#4ade80', outline: '#15803d', alpha: 0.92 },
};

const TREE_STYLES: Readonly<Record<OvergrowthStage, OvergrowthStyle & { trunk: string }>> = {
  small: {
    body: '#6ee7b7',
    dark: '#059669',
    light: '#a7f3d0',
    outline: '#047857',
    alpha: 0.5,
    trunk: '#92400e',
  },
  medium: {
    body: '#34d399',
    dark: '#047857',
    light: '#6ee7b7',
    outline: '#047857',
    alpha: 0.72,
    trunk: '#78350f',
  },
  large: {
    body: '#059669',
    dark: '#064e3b',
    light: '#34d399',
    outline: '#047857',
    alpha: 0.92,
    trunk: '#713f12',
  },
};

function getOvergrowthEntryScale(growthMs: number): number {
  return 0.6 + clamp(growthMs / 1200, 0, 1) * 0.4;
}

function traceBushPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  hw: number,
  hh: number,
  lobes: number,
  bumpDepth: number,
): void {
  const pts = lobes * 6;
  ctx.beginPath();
  for (let i = 0; i <= pts; i += 1) {
    const t = (i / pts) * Math.PI * 2;
    const bump = 1 + Math.sin(t * lobes) * bumpDepth;
    const px = cx + Math.cos(t) * hw * bump;
    const py = cy + Math.sin(t) * hh * bump;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
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
  const style = BUSH_STYLES[stage];

  const sway = Math.sin(nowMs / 1100 + cx * 0.013) * 0.7;
  const entryAlpha = 0.7 + clamp(growthMs / 800, 0, 1) * 0.3;
  const hw = (rect.width / 2) * scale;
  const hh = (rect.height / 2) * scale;
  const lobes = stage === 'small' ? 4 : stage === 'medium' ? 5 : 6;

  ctx.save();
  ctx.globalAlpha = style.alpha * entryAlpha;
  ctx.translate(sway, 0);
  applyAdaptiveShadow(ctx);

  traceBushPath(ctx, cx, cy, hw * 0.72, hh * 0.68, lobes, 0.14);
  ctx.fillStyle = style.dark;
  ctx.fill();

  traceBushPath(ctx, cx, cy - hh * 0.06, hw * 0.7, hh * 0.64, lobes, 0.16);
  ctx.fillStyle = style.body;
  ctx.fill();

  traceBushPath(ctx, cx - hw * 0.08, cy - hh * 0.12, hw * 0.4, hh * 0.36, lobes, 0.1);
  ctx.fillStyle = style.light;
  ctx.fill();

  traceBushPath(ctx, cx, cy - hh * 0.06, hw * 0.72, hh * 0.66, lobes, 0.16);
  ctx.strokeStyle = style.outline;
  ctx.lineWidth = stage === 'large' ? 1.6 : 1.2;
  ctx.stroke();

  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = stage === 'large' ? 0.9 : 0.6;
  ctx.stroke();

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
  const style = TREE_STYLES[stage];

  const sway = Math.sin(nowMs / 1300 + cx * 0.011) * 0.5;
  const entryAlpha = 0.7 + clamp(growthMs / 800, 0, 1) * 0.3;
  const hw = (rect.width / 2) * scale;
  const hh = (rect.height / 2) * scale;
  const r = Math.min(hw, hh);
  const lobes = stage === 'small' ? 5 : stage === 'medium' ? 6 : 7;

  ctx.save();
  ctx.globalAlpha = style.alpha * entryAlpha;
  applyAdaptiveShadow(ctx);

  const trunkW = Math.max(2.5, r * 0.22);
  const trunkLen = r * 0.7;
  ctx.fillStyle = style.trunk;
  ctx.beginPath();
  ctx.roundRect(cx - trunkW / 2, cy - trunkLen / 2, trunkW, trunkLen, trunkW * 0.25);
  ctx.fill();
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  ctx.save();
  ctx.translate(sway, 0);

  traceBushPath(ctx, cx, cy, r * 0.76, r * 0.72, lobes, 0.12);
  ctx.fillStyle = style.dark;
  ctx.fill();

  traceBushPath(ctx, cx, cy - r * 0.05, r * 0.74, r * 0.68, lobes, 0.13);
  ctx.fillStyle = style.body;
  ctx.fill();

  traceBushPath(ctx, cx - r * 0.1, cy - r * 0.1, r * 0.38, r * 0.34, lobes, 0.08);
  ctx.fillStyle = style.light;
  ctx.fill();

  traceBushPath(ctx, cx, cy - r * 0.04, r * 0.76, r * 0.7, lobes, 0.13);
  ctx.strokeStyle = style.outline;
  ctx.lineWidth = stage === 'large' ? 1.6 : 1.2;
  ctx.stroke();

  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = stage === 'large' ? 0.9 : 0.6;
  ctx.stroke();

  ctx.restore();
  ctx.restore();
}
