import type { Rect } from '../shared/types';
import { clamp, rectsIntersect } from '../shared/utils';
import { OVERGROWTH } from './gameConfig';
import { cloneRect, randomBetween } from './gameRuntime';
import { applyAdaptiveShadow } from './sprites';

export type OvergrowthStage = 'grass' | 'bush' | 'tree';
export type OvergrowthEdge = 'top' | 'right' | 'bottom' | 'left';

export interface OvergrowthNode {
  id: string;
  rect: Rect;
  anchorRect: Rect;
  anchorEdge: OvergrowthEdge;
  stage: OvergrowthStage;
  growthMs: number;
  spawnedAtRunMs: number;
}

export const OVERGROWTH_SPAWN_START_MS = OVERGROWTH.SPAWN_START_MS;
export const OVERGROWTH_MAX_NODES = OVERGROWTH.MAX_NODES;

export const OVERGROWTH_GROWTH_GRASS_TO_BUSH_MS = OVERGROWTH.GROWTH_GRASS_TO_BUSH_MS;
export const OVERGROWTH_GROWTH_BUSH_TO_TREE_MS = OVERGROWTH.GROWTH_BUSH_TO_TREE_MS;

const OVERGROWTH_GRASS_DEPTH = 10;
const OVERGROWTH_BUSH_DEPTH = 20;
const OVERGROWTH_TREE_DEPTH = 32;

const OVERGROWTH_MIN_SPAN = 18;
const OVERGROWTH_MAX_SPAN = 44;

export interface OvergrowthSpawnStep {
  overgrowthSpawnTimerMs: number;
  shouldSpawn: boolean;
}

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
  return randomBetween(OVERGROWTH.SPAWN_INTERVAL_MIN_MS, OVERGROWTH.SPAWN_INTERVAL_MAX_MS);
}

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
      const rect = computeOvergrowthRect(anchor, edge, OVERGROWTH_GRASS_DEPTH, span);
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

      return {
        id: `overgrowth:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
        rect,
        anchorRect: cloneRect(anchor),
        anchorEdge: edge,
        stage: 'grass',
        growthMs: 0,
        spawnedAtRunMs: runElapsedMs,
      };
    }
  }

  return null;
}

export function advanceOvergrowthGrowth(
  nodes: OvergrowthNode[],
  dtSeconds: number,
): OvergrowthNode[] {
  const deltaMs = dtSeconds * 1000;

  for (const node of nodes) {
    node.growthMs += deltaMs;

    if (node.stage === 'grass' && node.growthMs >= OVERGROWTH_GROWTH_GRASS_TO_BUSH_MS) {
      node.stage = 'bush';
      node.growthMs = 0;
      node.rect = growRect(node.anchorRect, node.anchorEdge, OVERGROWTH_BUSH_DEPTH, node.rect);
    } else if (node.stage === 'bush' && node.growthMs >= OVERGROWTH_GROWTH_BUSH_TO_TREE_MS) {
      node.stage = 'tree';
      node.growthMs = 0;
      node.rect = growRect(node.anchorRect, node.anchorEdge, OVERGROWTH_TREE_DEPTH, node.rect);
    }
  }

  return nodes;
}

export function getOvergrowthSlowZones(nodes: OvergrowthNode[]): Rect[] {
  return nodes
    .filter((node) => node.stage === 'grass' || node.stage === 'bush')
    .map((node) => cloneRect(node.rect));
}

export function getOvergrowthObstacles(nodes: OvergrowthNode[]): Rect[] {
  return nodes.filter((node) => node.stage === 'tree').map((node) => cloneRect(node.rect));
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
  alpha: number;
  trunk?: string;
  branch?: string;
}

const OVERGROWTH_STYLES: Readonly<Record<OvergrowthStage, OvergrowthStyle>> = {
  grass: { body: '#86efac', dark: '#4ade80', light: '#dcfce7', alpha: 0.45 },
  bush: { body: '#22c55e', dark: '#15803d', light: '#86efac', alpha: 0.75 },
  tree: {
    body: '#059669',
    dark: '#064e3b',
    light: '#34d399',
    alpha: 0.92,
    trunk: '#713f12',
    branch: '#78350f',
  },
};

interface LeafCluster {
  ox: number;
  oy: number;
  r: number;
}

function buildClusterLayout(count: number, spread: number, seed: number): LeafCluster[] {
  const clusters: LeafCluster[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + ((seed + i * 7) % 11) * 0.15;
    const dist = spread * (0.35 + ((seed + i * 13) % 17) / 34);
    const r = spread * (0.38 + ((seed + i * 23) % 13) / 52);
    clusters.push({
      ox: Math.cos(angle) * dist,
      oy: Math.sin(angle) * dist,
      r,
    });
  }
  return clusters;
}

function drawShadedCluster(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  bodyColor: string,
  darkColor: string,
  lightColor: string,
): void {
  ctx.fillStyle = darkColor;
  ctx.beginPath();
  ctx.arc(x, y + r * 0.1, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.92, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = lightColor;
  ctx.beginPath();
  ctx.arc(x - r * 0.2, y - r * 0.22, r * 0.45, 0, Math.PI * 2);
  ctx.fill();
}

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
    if (node.stage === 'tree') {
      drawOvergrowthTree(ctx, node, nowMs);
    } else {
      drawOvergrowthCluster(ctx, node, nowMs);
    }
  }
  ctx.restore();
}

function drawOvergrowthCluster(
  ctx: CanvasRenderingContext2D,
  node: OvergrowthNode,
  nowMs: number,
): void {
  const { rect, stage, growthMs } = node;
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const scale = getOvergrowthEntryScale(growthMs);
  const style = OVERGROWTH_STYLES[stage];

  const sway = Math.sin(nowMs / 1100 + cx * 0.013) * 0.7;
  const entryAlpha = 0.7 + clamp(growthMs / 800, 0, 1) * 0.3;
  const spread = Math.min(rect.width, rect.height) * 0.5 * scale;
  const seed = ((cx * 7.3 + cy * 13.7) | 0) & 0xff;
  const count = stage === 'grass' ? 3 : 6;
  const clusters = buildClusterLayout(count, spread, seed);

  ctx.save();
  ctx.globalAlpha = style.alpha * entryAlpha;
  applyAdaptiveShadow(ctx);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.08)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + spread * 0.15, spread * 0.7, spread * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  for (const c of clusters) {
    const clusterSway = sway * (0.7 + (Math.abs(c.ox) / spread) * 0.5);
    drawShadedCluster(
      ctx,
      cx + c.ox + clusterSway,
      cy + c.oy,
      c.r,
      style.body,
      style.dark,
      style.light,
    );
  }

  drawShadedCluster(ctx, cx + sway * 0.3, cy, spread * 0.42, style.body, style.dark, style.light);

  ctx.restore();
}

function drawOvergrowthTree(
  ctx: CanvasRenderingContext2D,
  node: OvergrowthNode,
  nowMs: number,
): void {
  const { rect, growthMs } = node;
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const scale = getOvergrowthEntryScale(growthMs);
  const style = OVERGROWTH_STYLES.tree;

  const sway = Math.sin(nowMs / 1300 + cx * 0.011) * 0.5;
  const entryAlpha = 0.7 + clamp(growthMs / 800, 0, 1) * 0.3;
  const spread = Math.min(rect.width, rect.height) * 0.5 * scale;
  const seed = ((cx * 11.3 + cy * 7.7) | 0) & 0xff;

  ctx.save();
  ctx.globalAlpha = style.alpha * entryAlpha;
  applyAdaptiveShadow(ctx);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.08)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + spread * 0.12, spread * 0.65, spread * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();

  const branchCount = 5;
  ctx.strokeStyle = style.branch!;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1.2, spread * 0.1);
  for (let i = 0; i < branchCount; i += 1) {
    const angle = (i / branchCount) * Math.PI * 2 + (seed & 7) * 0.4;
    const len = spread * (0.5 + ((seed + i * 11) % 9) / 30);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';

  const trunkR = Math.max(2, spread * 0.14);
  ctx.fillStyle = style.trunk!;
  ctx.beginPath();
  ctx.arc(cx, cy, trunkR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = style.branch!;
  ctx.lineWidth = 0.6;
  ctx.stroke();

  const count = 9;
  const clusters = buildClusterLayout(count, spread, seed);

  for (const c of clusters) {
    const clusterSway = sway * (0.6 + (Math.abs(c.ox) / spread) * 0.6);
    drawShadedCluster(
      ctx,
      cx + c.ox + clusterSway,
      cy + c.oy,
      c.r,
      style.body,
      style.dark,
      style.light,
    );
  }

  drawShadedCluster(ctx, cx + sway * 0.3, cy, spread * 0.36, style.body, style.dark, style.light);

  ctx.restore();
}
