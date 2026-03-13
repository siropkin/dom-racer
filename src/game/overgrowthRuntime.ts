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

interface BushStageStyle {
  fill: string;
  dark: string;
  light: string;
  alpha: number;
  stroke: string;
}

interface TreeStageStyle {
  fill: string;
  alpha: number;
  stroke: string;
  trunk: string;
  branch: string;
  canopyDark: string;
  canopyLight: string;
}

const BUSH_STAGE_STYLES: Readonly<Record<OvergrowthStage, BushStageStyle>> = {
  small: { fill: '#86efac', dark: '#22c55e', light: '#bbf7d0', alpha: 0.36, stroke: '' },
  medium: { fill: '#4ade80', dark: '#16a34a', light: '#86efac', alpha: 0.62, stroke: '' },
  large: { fill: '#22c55e', dark: '#166534', light: '#4ade80', alpha: 0.88, stroke: '#15803d' },
};

const TREE_STAGE_STYLES: Readonly<Record<OvergrowthStage, TreeStageStyle>> = {
  small: {
    fill: '#6ee7b7',
    alpha: 0.36,
    stroke: '',
    trunk: '#a16207',
    branch: '#92400e',
    canopyDark: '#34d399',
    canopyLight: '#a7f3d0',
  },
  medium: {
    fill: '#34d399',
    alpha: 0.62,
    stroke: '',
    trunk: '#92400e',
    branch: '#78350f',
    canopyDark: '#059669',
    canopyLight: '#6ee7b7',
  },
  large: {
    fill: '#059669',
    alpha: 0.88,
    stroke: '#15803d',
    trunk: '#78350f',
    branch: '#713f12',
    canopyDark: '#047857',
    canopyLight: '#34d399',
  },
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
  const seed = ((cx * 7.3 + cy * 13.7) | 0) & 0xff;

  ctx.save();
  ctx.globalAlpha = style.alpha * entryAlpha;
  applyAdaptiveShadow(ctx);

  // Ground shadow
  ctx.fillStyle = 'rgba(15, 23, 42, 0.10)';
  ctx.beginPath();
  ctx.ellipse(cx + sway * 0.4, cy + hh * 0.15, hw * 0.7, hh * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Dark core for interior depth
  ctx.fillStyle = style.dark;
  ctx.beginPath();
  ctx.ellipse(cx + sway * 0.3, cy, hw * 0.5, hh * 0.46, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mid-tone leaf clusters creating a lumpy natural silhouette
  ctx.fillStyle = style.fill;
  const clusterCount = stage === 'small' ? 4 : stage === 'medium' ? 6 : 8;
  for (let i = 0; i < clusterCount; i += 1) {
    const angle = (i / clusterCount) * Math.PI * 2 + (seed & 7) * 0.4;
    const leafSway = sway * (0.8 + (i % 3) * 0.15);
    const dist = 0.46 + ((seed + i * 31) % 17) / 90;
    const r = 0.3 + ((seed + i * 19) % 11) / 60;
    ctx.beginPath();
    ctx.ellipse(
      cx + leafSway + Math.cos(angle) * hw * dist,
      cy + Math.sin(angle) * hh * dist,
      hw * r,
      hh * r * 0.88,
      angle * 0.15,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  // Bright highlight clusters on sun-facing side
  ctx.fillStyle = style.light;
  const lightCount = stage === 'small' ? 2 : stage === 'medium' ? 3 : 4;
  for (let i = 0; i < lightCount; i += 1) {
    const angle = (i / lightCount) * Math.PI * 2 + (seed & 3) * 1.2 + 0.5;
    ctx.beginPath();
    ctx.ellipse(
      cx + sway * 0.9 + Math.cos(angle) * hw * 0.34,
      cy + Math.sin(angle) * hh * 0.3,
      hw * 0.2,
      hh * 0.18,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  // Tiny sparkle dots where light catches individual leaves
  if (stage !== 'small') {
    ctx.fillStyle = stage === 'medium' ? 'rgba(187, 247, 208, 0.55)' : 'rgba(220, 252, 231, 0.65)';
    const spotCount = stage === 'medium' ? 3 : 5;
    for (let i = 0; i < spotCount; i += 1) {
      const angle = (seed + i * 17) * 0.618;
      const dist = 0.18 + ((seed + i * 7) % 13) / 42;
      ctx.beginPath();
      ctx.arc(
        cx + sway * 0.6 + Math.cos(angle) * hw * dist,
        cy + Math.sin(angle) * hh * dist,
        0.8 + (i % 2) * 0.4,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }

  // Scalloped contour outline (large stage only)
  if (stage === 'large' && style.stroke) {
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = 1.4;
    const pts = 20;
    ctx.beginPath();
    for (let i = 0; i <= pts; i += 1) {
      const angle = (i / pts) * Math.PI * 2;
      const wobble = 0.82 + Math.sin(angle * 3 + seed * 0.1) * 0.06;
      const px = cx + sway + Math.cos(angle) * hw * wobble;
      const py = cy + Math.sin(angle) * hh * wobble;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
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
  const seed = ((cx * 11.3 + cy * 7.7) | 0) & 0xff;

  ctx.save();
  ctx.globalAlpha = style.alpha * entryAlpha;
  applyAdaptiveShadow(ctx);

  // Ground shadow beneath the tree
  ctx.fillStyle = 'rgba(15, 23, 42, 0.12)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + hh * 0.1, hw * 0.65, hh * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();

  // Trunk (top-down brown rectangle with wood grain)
  const trunkW = Math.max(3, Math.min(hw, hh) * 0.28);
  const trunkH = Math.max(4, Math.min(hw, hh) * 0.55);
  ctx.fillStyle = style.trunk;
  ctx.beginPath();
  ctx.roundRect(cx - trunkW / 2, cy - trunkH / 2, trunkW, trunkH, trunkW * 0.3);
  ctx.fill();
  ctx.strokeStyle = style.branch;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(cx, cy - trunkH * 0.35);
  ctx.lineTo(cx, cy + trunkH * 0.35);
  ctx.stroke();

  // Branch stubs radiating outward from the trunk
  ctx.strokeStyle = style.trunk;
  ctx.lineWidth = Math.max(1.2, trunkW * 0.35);
  ctx.lineCap = 'round';
  const branchCount = stage === 'small' ? 2 : stage === 'medium' ? 3 : 4;
  for (let i = 0; i < branchCount; i += 1) {
    const angle = (i / branchCount) * Math.PI * 2 + (seed & 5) * 0.5 + 0.3;
    const branchLen = Math.min(hw, hh) * 0.45;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * branchLen, cy + Math.sin(angle) * branchLen);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';

  // Canopy dark base layer
  ctx.fillStyle = style.canopyDark;
  ctx.beginPath();
  ctx.ellipse(cx + sway * 0.4, cy, hw * 0.6, hh * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();

  // Canopy main leaf circles (overlapping, varied)
  ctx.fillStyle = style.fill;
  const canopyCount = stage === 'small' ? 3 : stage === 'medium' ? 5 : 7;
  for (let i = 0; i < canopyCount; i += 1) {
    const angle = (i / canopyCount) * Math.PI * 2 + (seed & 3) * 0.8;
    const canopySway = sway * (0.85 + (i % 3) * 0.1);
    const dist = 0.38 + ((seed + i * 23) % 13) / 65;
    const r = 0.28 + ((seed + i * 11) % 9) / 50;
    ctx.beginPath();
    ctx.arc(
      cx + canopySway + Math.cos(angle) * hw * dist,
      cy + Math.sin(angle) * hh * dist,
      Math.min(hw, hh) * r,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  // Lighter canopy highlights
  ctx.fillStyle = style.canopyLight;
  const highlightCount = stage === 'small' ? 1 : stage === 'medium' ? 2 : 3;
  for (let i = 0; i < highlightCount; i += 1) {
    const angle = (i / Math.max(1, highlightCount)) * Math.PI * 2 + (seed & 7) * 0.6;
    ctx.beginPath();
    ctx.arc(
      cx + sway * 0.7 + Math.cos(angle) * hw * 0.3,
      cy + Math.sin(angle) * hh * 0.28,
      Math.min(hw, hh) * 0.18,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  // Leaf-gap sparkle spots
  if (stage !== 'small') {
    ctx.fillStyle = stage === 'medium' ? 'rgba(167, 243, 208, 0.5)' : 'rgba(209, 250, 229, 0.6)';
    const spotCount = stage === 'medium' ? 2 : 4;
    for (let i = 0; i < spotCount; i += 1) {
      const angle = (seed + i * 13) * 0.618;
      const dist = 0.2 + ((seed + i * 5) % 11) / 48;
      ctx.beginPath();
      ctx.arc(
        cx + sway * 0.5 + Math.cos(angle) * hw * dist,
        cy + Math.sin(angle) * hh * dist,
        0.7 + (i % 2) * 0.4,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }

  // Organic contour outline (large stage only)
  if (stage === 'large' && style.stroke) {
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = 1.4;
    const pts = 20;
    ctx.beginPath();
    for (let i = 0; i <= pts; i += 1) {
      const angle = (i / pts) * Math.PI * 2;
      const wobble = 0.78 + Math.sin(angle * 4 + seed * 0.1) * 0.05;
      const px = cx + sway + Math.cos(angle) * hw * wobble;
      const py = cy + Math.sin(angle) * hh * wobble;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  }

  ctx.restore();
}
