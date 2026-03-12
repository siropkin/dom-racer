import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { World } from '../src/shared/types';

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

  return {
    AudioManager: MockAudioManager,
  };
});

import { Game } from '../src/game/Game';

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const contextStub = {
    setTransform: () => undefined,
    clearRect: () => undefined,
    imageSmoothingEnabled: false,
  };
  Object.defineProperty(canvas, 'clientWidth', { value: 1280, configurable: true });
  Object.defineProperty(canvas, 'clientHeight', { value: 720, configurable: true });
  Object.defineProperty(canvas, 'getContext', {
    value: () => contextStub,
    configurable: true,
  });
  Object.defineProperty(canvas, 'focus', {
    value: () => undefined,
    configurable: true,
  });
  return canvas;
}

function createWorldWithRegularCoins(coinCount: number): World {
  const pickups: World['pickups'] = [];
  for (let index = 0; index < coinCount; index += 1) {
    const col = index % 6;
    const row = Math.floor(index / 6);
    pickups.push({
      id: `anchor:${index}`,
      sourceId: `anchor:${index}`,
      kind: 'coin',
      value: 10,
      rect: {
        x: 80 + col * 86,
        y: 120 + row * 70,
        width: 16,
        height: 16,
      },
    });
  }

  return {
    viewport: { width: 1280, height: 720 },
    obstacles: [],
    slowZones: [],
    iceZones: [],
    hazards: [],
    deadSpots: [],
    boosts: [],
    pickups,
    spawnPoint: { x: 600, y: 620 },
    scannedCount: pickups.length,
  };
}

describe('game economy and police smoke invariants', () => {
  const runReasons: Array<'manual' | 'deadSpot' | 'caught' | 'quit'> = [];
  let game: Game;

  beforeEach(() => {
    runReasons.length = 0;
    game = new Game({
      canvas: createCanvas(),
      createWorld: () => createWorldWithRegularCoins(14),
      getPageTitle: () => 'DOM Racer Smoke',
      sampleSurfaceAt: () => ({ lightness: 0.6, saturation: 0.2, hasGradient: false }),
      setPageInverted: () => undefined,
      setPageBlackout: () => undefined,
      setMagnetUiState: () => undefined,
      onQuit: () => undefined,
      initialSoundEnabled: false,
      onSoundEnabledChange: () => undefined,
      initialVehicleDesign: 'coupe',
      onVehicleDesignChange: () => undefined,
      initialPageBestScore: 0,
      initialLifetimeBestScore: 0,
      onRunFinished: (run) => runReasons.push(run.reason),
    });
  });

  it('keeps regular coin spawn staging tied to source anchors', () => {
    (game as any).beginRun('manual');
    const runtimeWorld = (game as any).world as World;
    const visibleRegularCoins = runtimeWorld.pickups.filter((pickup) => pickup.kind !== 'special');
    const visibleSourceIds = visibleRegularCoins.map((pickup) => pickup.sourceId);

    expect(visibleRegularCoins.length).toBe(7);
    expect(visibleRegularCoins.every((pickup) => pickup.value === 10)).toBe(true);
    expect(new Set(visibleSourceIds).size).toBe(visibleSourceIds.length);
    expect((game as any).coinSpawnQueue).toHaveLength(14);
    expect(
      visibleRegularCoins.every((pickup) => pickup.sourceId?.startsWith('anchor:') ?? false),
    ).toBe(true);
  });

  it('spawns specials independently from regular coin economy', () => {
    (game as any).beginRun('manual');
    const runtimeWorldBefore = (game as any).world as World;
    const regularBefore = runtimeWorldBefore.pickups.filter((pickup) => pickup.kind !== 'special').length;
    const queueBefore = (game as any).coinSpawnQueue.length;

    const spawned = (game as any).spawnSpecialPickup() as boolean;
    const runtimeWorldAfter = (game as any).world as World;
    const regularAfter = runtimeWorldAfter.pickups.filter((pickup) => pickup.kind !== 'special').length;
    const specialsAfter = runtimeWorldAfter.pickups.filter((pickup) => pickup.kind === 'special');

    expect(spawned).toBe(true);
    expect(regularAfter).toBe(regularBefore);
    expect(specialsAfter.length).toBeGreaterThan(0);
    expect(specialsAfter[0].value).toBe(25);
    expect((game as any).coinSpawnQueue.length).toBe(queueBefore);
  });

  it('keeps police catch game-over and space-restart flow intact', () => {
    (game as any).beginRun('manual');
    (game as any).running = true;
    (game as any).score = 40;
    (game as any).startTimeMs = performance.now() - 1000;

    (game as any).enterCaughtGameOver();
    expect((game as any).gameOverState?.reason).toBe('caught');
    expect(runReasons).toContain('caught');

    const restartEvent = new KeyboardEvent('keydown', { code: 'Space' });
    (game as any).handleKeyDown(restartEvent);

    expect((game as any).gameOverState).toBeNull();
    expect((game as any).score).toBe(0);
    expect((game as any).startTimeMs).toBeGreaterThan(0);
    expect((game as any).world).not.toBeNull();
  });

  it('resets player when a refreshed world places them inside a deadSpot blocker', () => {
    (game as any).beginRun('manual');
    const runtimeWorld = (game as any).world as World;
    const player = (game as any).player;
    expect(player).toBeTruthy();

    player.reset({ x: 220, y: 220 });
    const movedBounds = player.getBounds();
    expect(movedBounds.x).toBe(220);
    expect(movedBounds.y).toBe(220);

    const refreshedWorld: World = {
      ...runtimeWorld,
      deadSpots: [{ x: 210, y: 210, width: 40, height: 40 }],
      spawnPoint: { x: 44, y: 88 },
    };
    game.applyWorld(refreshedWorld, false);

    const safeBounds = (game as any).player.getBounds();
    expect(safeBounds.x).toBe(44);
    expect(safeBounds.y).toBe(88);
  });

  it('resets player when a refreshed world places them inside a hazard blocker', () => {
    (game as any).beginRun('manual');
    const runtimeWorld = (game as any).world as World;
    const player = (game as any).player;
    expect(player).toBeTruthy();

    player.reset({ x: 260, y: 260 });
    const movedBounds = player.getBounds();
    expect(movedBounds.x).toBe(260);
    expect(movedBounds.y).toBe(260);

    const refreshedWorld: World = {
      ...runtimeWorld,
      hazards: [{ x: 252, y: 252, width: 38, height: 38 }],
      spawnPoint: { x: 58, y: 102 },
    };
    game.applyWorld(refreshedWorld, false);

    const safeBounds = (game as any).player.getBounds();
    expect(safeBounds.x).toBe(58);
    expect(safeBounds.y).toBe(102);
  });

  it('spawns and expires airplane coin trail coins as short-lived route opportunities', () => {
    (game as any).beginRun('manual');
    const runtimeWorld = (game as any).world as World;
    runtimeWorld.pickups = [];

    const spawned = (game as any).spawnPlaneCoinTrail(620, 280, 1, 0) as boolean;
    expect(spawned).toBe(true);

    const trailCoins = runtimeWorld.pickups.filter((pickup) => pickup.id.startsWith('plane-trail:'));
    expect(trailCoins.length).toBeGreaterThanOrEqual(3);
    expect(trailCoins.every((pickup) => pickup.kind === 'coin')).toBe(true);
    expect(trailCoins.every((pickup) => pickup.value === 10)).toBe(true);

    (game as any).updatePlaneCoinTrail(4);
    const trailCoinsAfterExpiry = runtimeWorld.pickups.filter((pickup) =>
      pickup.id.startsWith('plane-trail:'),
    );
    expect(trailCoinsAfterExpiry).toHaveLength(0);
    expect((game as any).planeCoinTrail).toBeNull();
  });

  it('uses lucky wind to gently reroute existing regular coins only', () => {
    (game as any).beginRun('manual');
    const runtimeWorld = (game as any).world as World;
    runtimeWorld.pickups = [
      {
        id: 'coin:a',
        sourceId: 'coin:a',
        rect: { x: 488, y: 232, width: 16, height: 16 },
        value: 10,
        kind: 'coin',
      },
      {
        id: 'coin:b',
        sourceId: 'coin:b',
        rect: { x: 536, y: 360, width: 16, height: 16 },
        value: 10,
        kind: 'coin',
      },
      {
        id: 'coin:c',
        sourceId: 'coin:c',
        rect: { x: 602, y: 244, width: 16, height: 16 },
        value: 10,
        kind: 'coin',
      },
      {
        id: 'coin:d',
        sourceId: 'coin:d',
        rect: { x: 652, y: 350, width: 16, height: 16 },
        value: 10,
        kind: 'coin',
      },
      {
        id: 'special:magnet:wind',
        rect: { x: 760, y: 300, width: 20, height: 20 },
        value: 25,
        kind: 'special',
        effect: 'magnet',
        accentColor: '#67e8f9',
        label: 'MAG',
      },
    ];

    const regularBefore = runtimeWorld.pickups.filter((pickup) => pickup.kind !== 'special');
    const regularCentersBefore = new Map(
      regularBefore.map((pickup) => [
        pickup.id,
        {
          x: pickup.rect.x + pickup.rect.width / 2,
          y: pickup.rect.y + pickup.rect.height / 2,
        },
      ]),
    );
    const queueBefore = (game as any).coinSpawnQueue.length;
    const specialBefore = runtimeWorld.pickups.find((pickup) => pickup.kind === 'special');
    const specialRectBefore = specialBefore ? { ...specialBefore.rect } : null;

    const spawned = (game as any).spawnPlaneLuckyWind(560, 300, 1, 0) as boolean;

    const regularAfter = runtimeWorld.pickups.filter((pickup) => pickup.kind !== 'special');
    const movedRegularCoins = regularAfter.filter((pickup) => {
      const center = {
        x: pickup.rect.x + pickup.rect.width / 2,
        y: pickup.rect.y + pickup.rect.height / 2,
      };
      const beforeCenter = regularCentersBefore.get(pickup.id);
      if (!beforeCenter) {
        return false;
      }
      return (
        Math.abs(center.x - beforeCenter.x) > 0.01 || Math.abs(center.y - beforeCenter.y) > 0.01
      );
    });
    const specialAfter = runtimeWorld.pickups.find((pickup) => pickup.kind === 'special');

    expect(spawned).toBe(true);
    expect((game as any).coinSpawnQueue.length).toBe(queueBefore);
    expect(regularAfter.length).toBe(regularBefore.length);
    expect(regularAfter.every((pickup) => pickup.value === 10)).toBe(true);
    expect(movedRegularCoins.length).toBeGreaterThanOrEqual(2);
    expect(specialAfter?.id).toBe(specialBefore?.id);
    expect(specialAfter?.rect).toEqual(specialRectBefore);
  });

  it('uses police delay to push police timing without touching coin economy', () => {
    (game as any).beginRun('manual');
    const runtimeWorld = (game as any).world as World;
    const queueBefore = (game as any).coinSpawnQueue.length;
    const pickupSnapshotBefore = runtimeWorld.pickups.map((pickup) => ({
      id: pickup.id,
      sourceId: pickup.sourceId,
      kind: pickup.kind,
      value: pickup.value,
      rect: { ...pickup.rect },
    }));
    const spawnTimerBefore = 1200;
    (game as any).policeSpawnTimerMs = spawnTimerBefore;
    (game as any).policeWarning = {
      edge: 'top',
      remainingMs: 600,
      durationMs: 1100,
    };

    const spawned = (game as any).spawnPlanePoliceDelay() as boolean;
    const delayCueMs = (game as any).policeDelayCueTimerMs as number;
    const delayCueDurationMs = (game as any).policeDelayCueDurationMs as number;

    expect(spawned).toBe(true);
    expect((game as any).policeWarning).toBeNull();
    expect((game as any).policeSpawnTimerMs).toBeGreaterThan(spawnTimerBefore + 2500);
    expect(delayCueMs).toBeGreaterThan(2500);
    expect(delayCueDurationMs).toBe(delayCueMs);

    (game as any).updatePoliceDelayCue(10);
    expect((game as any).policeDelayCueTimerMs).toBe(0);
    expect((game as any).policeDelayCueDurationMs).toBe(0);

    expect((game as any).coinSpawnQueue.length).toBe(queueBefore);
    expect(runtimeWorld.pickups).toEqual(pickupSnapshotBefore);
  });

  it('uses airplane spotlight as a short-lived special highlight only', () => {
    (game as any).beginRun('manual');
    const runtimeWorld = (game as any).world as World;
    const queueBefore = (game as any).coinSpawnQueue.length;
    const cuesBefore = (game as any).specialSpawnCues.length;
    const specialCountBefore = runtimeWorld.pickups.filter((pickup) => pickup.kind === 'special').length;

    runtimeWorld.pickups.push({
      id: 'special:magnet:test',
      rect: { x: 540, y: 250, width: 20, height: 20 },
      value: 25,
      kind: 'special',
      effect: 'magnet',
      accentColor: '#67e8f9',
      label: 'MAG',
    });

    const spawned = (game as any).spawnPlaneSpotlight(560, 260) as boolean;
    const specialCountAfter = runtimeWorld.pickups.filter((pickup) => pickup.kind === 'special').length;
    const cuesAfter = (game as any).specialSpawnCues as Array<{ label: string; ttlMs: number }>;

    expect(spawned).toBe(true);
    expect((game as any).coinSpawnQueue.length).toBe(queueBefore);
    expect(specialCountAfter).toBe(specialCountBefore + 1);
    expect(cuesAfter.length).toBe(cuesBefore + 1);
    expect(cuesAfter.at(-1)?.label).toBe('MAG');
    expect(cuesAfter.at(-1)?.ttlMs).toBeGreaterThan(1500);
  });
});
