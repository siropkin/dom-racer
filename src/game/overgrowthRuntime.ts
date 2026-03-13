import type { Rect } from '../shared/types';
import { rectsIntersect } from '../shared/utils';
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
