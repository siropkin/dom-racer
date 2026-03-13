import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  advanceOvergrowthGrowth,
  getOvergrowthObstacles,
  getOvergrowthSlowZones,
  resolveOvergrowthSpawnStep,
  trySpawnOvergrowthNode,
  OVERGROWTH_GROWTH_MEDIUM_TO_LARGE_MS,
  OVERGROWTH_GROWTH_SMALL_TO_MEDIUM_MS,
  OVERGROWTH_MAX_NODES,
  OVERGROWTH_SPAWN_START_MS,
  type OvergrowthNode,
} from '../src/game/overgrowthRuntime';
import { createCanvas, createWorldWithRegularCoins } from './testHelpers';

vi.mock('../src/game/audio', () => {
  class MockAudioManager {
    setEnabled(): void {}
    stop(): void {}
    updateEngine(): void {}
    updatePoliceSiren(): void {}
    playPickup(): void {}
    playToggle(): void {}
    playPoliceAlert(): void {}
    playPlaneFlyover(): void {}
    playPlaneDrop(): void {}
    async resume(): Promise<void> {}
  }
  return { AudioManager: MockAudioManager };
});

import { Game } from '../src/game/Game';

describe('overgrowth spawn, growth, collision smoke invariants', () => {
  let game: Game;

  beforeEach(() => {
    game = new Game({
      canvas: createCanvas(),
      createWorld: () => createWorldWithRegularCoins(14),
      getPageTitle: () => 'DOM Racer Smoke',
      sampleSurfaceAt: () => ({ lightness: 0.6, saturation: 0.2, hasGradient: false }),
      setPageInverted: () => undefined,
      setPageBlur: () => undefined,
      setMagnetUiState: () => undefined,
      onQuit: () => undefined,
      initialSoundEnabled: false,
      onSoundEnabledChange: () => undefined,
      initialVehicleDesign: 'coupe',
      onVehicleDesignChange: () => undefined,
      initialPageBestScore: 0,
      initialLifetimeBestScore: 0,
      initialRunCount: 0,
    });
  });

  it('does not spawn overgrowth before time threshold', () => {
    const step = resolveOvergrowthSpawnStep({
      overgrowthSpawnTimerMs: 0,
      runElapsedMs: 20_000,
      existingNodeCount: 0,
      dtSeconds: 0.5,
    });
    expect(step.shouldSpawn).toBe(false);
  });

  it('spawns overgrowth after time threshold when timer expires', () => {
    const step = resolveOvergrowthSpawnStep({
      overgrowthSpawnTimerMs: 200,
      runElapsedMs: OVERGROWTH_SPAWN_START_MS + 1000,
      existingNodeCount: 0,
      dtSeconds: 0.5,
    });
    expect(step.shouldSpawn).toBe(true);
    expect(step.overgrowthSpawnTimerMs).toBe(0);
  });

  it('caps overgrowth nodes at maximum', () => {
    const step = resolveOvergrowthSpawnStep({
      overgrowthSpawnTimerMs: 0,
      runElapsedMs: OVERGROWTH_SPAWN_START_MS + 5000,
      existingNodeCount: OVERGROWTH_MAX_NODES,
      dtSeconds: 0.5,
    });
    expect(step.shouldSpawn).toBe(false);
  });

  it('spawns overgrowth nodes from barrier anchors', () => {
    const anchors = [
      { x: 0, y: 0, width: 200, height: 60 },
      { x: 0, y: 700, width: 200, height: 40 },
    ];
    const node = trySpawnOvergrowthNode(anchors, [], [], 40_000);
    expect(node).not.toBeNull();
    expect(node!.stage).toBe('small');
    expect(node!.kind === 'bush' || node!.kind === 'tree').toBe(true);
    expect(node!.rect.width).toBeGreaterThan(0);
    expect(node!.rect.height).toBeGreaterThan(0);
  });

  it('grows overgrowth from small to medium to large', () => {
    const nodes: OvergrowthNode[] = [
      {
        id: 'test:overgrowth:1',
        kind: 'bush',
        rect: { x: 50, y: 60, width: 30, height: 10 },
        anchorRect: { x: 0, y: 0, width: 200, height: 60 },
        anchorEdge: 'bottom',
        stage: 'small',
        growthMs: 0,
        spawnedAtRunMs: 35_000,
      },
    ];

    advanceOvergrowthGrowth(nodes, OVERGROWTH_GROWTH_SMALL_TO_MEDIUM_MS / 1000 + 0.1);
    expect(nodes[0].stage).toBe('medium');
    expect(nodes[0].rect.height).toBeGreaterThan(10);

    advanceOvergrowthGrowth(nodes, OVERGROWTH_GROWTH_MEDIUM_TO_LARGE_MS / 1000 + 0.1);
    expect(nodes[0].stage).toBe('large');
    expect(nodes[0].rect.height).toBeGreaterThan(20);
  });

  it('classifies small/medium overgrowth as slow zones and large as obstacles', () => {
    const nodes: OvergrowthNode[] = [
      {
        id: 'test:overgrowth:small',
        kind: 'bush',
        rect: { x: 50, y: 60, width: 30, height: 10 },
        anchorRect: { x: 0, y: 0, width: 200, height: 60 },
        anchorEdge: 'bottom',
        stage: 'small',
        growthMs: 0,
        spawnedAtRunMs: 35_000,
      },
      {
        id: 'test:overgrowth:medium',
        kind: 'tree',
        rect: { x: 100, y: 60, width: 30, height: 20 },
        anchorRect: { x: 0, y: 0, width: 200, height: 60 },
        anchorEdge: 'bottom',
        stage: 'medium',
        growthMs: 0,
        spawnedAtRunMs: 36_000,
      },
      {
        id: 'test:overgrowth:large',
        kind: 'tree',
        rect: { x: 150, y: 60, width: 30, height: 32 },
        anchorRect: { x: 0, y: 0, width: 200, height: 60 },
        anchorEdge: 'bottom',
        stage: 'large',
        growthMs: 0,
        spawnedAtRunMs: 37_000,
      },
    ];

    const slowZones = getOvergrowthSlowZones(nodes);
    const obstacles = getOvergrowthObstacles(nodes);

    expect(slowZones).toHaveLength(2);
    expect(obstacles).toHaveLength(1);
    expect(obstacles[0].height).toBe(32);
  });

  it('resets overgrowth state on beginRun and respawns timer on update', () => {
    (game as any).beginRun('manual');
    (game as any).overgrowthNodes = [
      {
        id: 'stale:overgrowth',
        kind: 'bush',
        rect: { x: 50, y: 60, width: 30, height: 10 },
        anchorRect: { x: 0, y: 0, width: 200, height: 60 },
        anchorEdge: 'bottom',
        stage: 'small',
        growthMs: 0,
        spawnedAtRunMs: 35_000,
      },
    ];

    (game as any).beginRun('manual');
    expect((game as any).overgrowthNodes).toHaveLength(0);
    expect((game as any).overgrowthSpawnTimerMs).toBe(0);
  });

  it('sets overgrowth respawn timer after spawn attempt', () => {
    (game as any).beginRun('manual');
    (game as any).startTimeMs = 1;
    (game as any).overgrowthSpawnTimerMs = 0;

    vi.spyOn(performance, 'now').mockReturnValue(OVERGROWTH_SPAWN_START_MS + 3000);
    (game as any).updateOvergrowth(0.016);
    vi.restoreAllMocks();

    expect((game as any).overgrowthSpawnTimerMs).toBeGreaterThan(0);
  });
});
