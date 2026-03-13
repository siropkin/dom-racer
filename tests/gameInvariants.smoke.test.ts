import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { World } from '../src/shared/types';
import {
  advancePoliceDelayCueState,
  applyPlaneLuckyWindToPickups,
  createPoliceDelayCueState,
} from '../src/game/planeDropRuntime';
import { advancePoliceChasing } from '../src/game/encounterRuntime';
import { advanceSpecialSpawnCues } from '../src/game/gameRenderRuntime';
import { getFlavorText } from '../src/game/gameRuntime';

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

  it('pulls special pickups while magnet effect is active', () => {
    (game as any).beginRun('manual');
    const runtimeWorld = (game as any).world as World;
    const player = (game as any).player;
    expect(player).toBeTruthy();
    runtimeWorld.pickups = [
      {
        id: 'special:bonus:pull',
        rect: { x: 520, y: 560, width: 20, height: 20 },
        value: 25,
        kind: 'special',
        effect: 'bonus',
        accentColor: '#f9a8d4',
        label: 'BON',
      },
    ];
    const before = { ...runtimeWorld.pickups[0].rect };

    (game as any).magnetTimerMs = 3000;
    (game as any).applyMagnet(0.5);

    const after = runtimeWorld.pickups[0].rect;
    const playerBounds = player.getBounds();
    const playerCenter = {
      x: playerBounds.x + playerBounds.width / 2,
      y: playerBounds.y + playerBounds.height / 2,
    };
    const beforeCenter = {
      x: before.x + before.width / 2,
      y: before.y + before.height / 2,
    };
    const afterCenter = {
      x: after.x + after.width / 2,
      y: after.y + after.height / 2,
    };
    const beforeDistance = Math.hypot(playerCenter.x - beforeCenter.x, playerCenter.y - beforeCenter.y);
    const afterDistance = Math.hypot(playerCenter.x - afterCenter.x, playerCenter.y - afterCenter.y);

    expect(afterDistance).toBeLessThan(beforeDistance);
  });

  it('keeps extracted lucky-wind reroute helper behavior unchanged', () => {
    const pickups: World['pickups'] = [
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
    const regularCentersBefore = new Map(
      pickups
        .filter((pickup) => pickup.kind !== 'special')
        .map((pickup) => [
          pickup.id,
          {
            x: pickup.rect.x + pickup.rect.width / 2,
            y: pickup.rect.y + pickup.rect.height / 2,
          },
        ]),
    );
    const specialBefore = pickups.find((pickup) => pickup.kind === 'special');
    const specialRectBefore = specialBefore ? { ...specialBefore.rect } : null;

    const applied = applyPlaneLuckyWindToPickups({
      worldPickups: pickups,
      viewport: { width: 1280, height: 720 },
      blockers: [],
      center: { x: 560, y: 300 },
      direction: { x: 1, y: 0 },
    });
    const movedRegularCoins = pickups.filter((pickup) => pickup.kind !== 'special').filter((pickup) => {
      const center = {
        x: pickup.rect.x + pickup.rect.width / 2,
        y: pickup.rect.y + pickup.rect.height / 2,
      };
      const beforeCenter = regularCentersBefore.get(pickup.id);
      if (!beforeCenter) {
        return false;
      }
      return Math.abs(center.x - beforeCenter.x) > 0.01 || Math.abs(center.y - beforeCenter.y) > 0.01;
    });
    const specialAfter = pickups.find((pickup) => pickup.kind === 'special');

    expect(applied).toBe(true);
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

  it('keeps airplane drop pending when all drop paths fail this frame', () => {
    (game as any).beginRun('manual');
    (game as any).planeBonusEvent = {
      x: 420,
      y: 240,
      vx: 160,
      vy: 0,
      angle: 0,
      ttlMs: 5000,
      distancePx: 900,
      traveledPx: 899,
      dropAtPx: 899,
      dropped: false,
      effectMode: 'boost-lane',
    };
    (game as any).spawnPlaneBonusDrop = () => false;
    (game as any).spawnPlaneBoostLane = () => false;
    (game as any).spawnPlaneCoinTrail = () => false;
    (game as any).spawnPlaneSpotlight = () => false;
    (game as any).spawnPlaneLuckyWind = () => false;
    (game as any).spawnPlanePoliceDelay = () => false;

    (game as any).updatePlaneBonusEvent(0.016);
    expect((game as any).planeBonusEvent).toBeTruthy();
    expect((game as any).planeBonusEvent.dropped).toBe(false);
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

  it('keeps extracted police-delay cue lifecycle unchanged', () => {
    const initial = createPoliceDelayCueState(3200);
    expect(initial.policeDelayCueTimerMs).toBe(3200);
    expect(initial.policeDelayCueDurationMs).toBe(3200);

    const afterHalfSecond = advancePoliceDelayCueState(initial, 0.5);
    expect(afterHalfSecond.policeDelayCueTimerMs).toBe(2700);
    expect(afterHalfSecond.policeDelayCueDurationMs).toBe(3200);

    const expired = advancePoliceDelayCueState(afterHalfSecond, 10);
    expect(expired.policeDelayCueTimerMs).toBe(0);
    expect(expired.policeDelayCueDurationMs).toBe(0);
  });

  it('keeps extracted special-spawn cue lifecycle unchanged', () => {
    const next = advanceSpecialSpawnCues(
      [
        {
          x: 128,
          y: 256,
          label: 'MAG',
          color: '#67e8f9',
          ttlMs: 1000,
          durationMs: 1000,
        },
      ],
      0.25,
    );
    expect(next).toHaveLength(1);
    expect(next[0].ttlMs).toBe(750);

    const expired = advanceSpecialSpawnCues(next, 2);
    expect(expired).toHaveLength(0);
  });

  it('keeps police chase movement faster on ice surfaces', () => {
    const baseline = {
      x: 140,
      y: 180,
      angle: 0,
      remainingMs: 6000,
      durationMs: 6000,
      phase: 'chasing' as const,
      exitEdge: 'right' as const,
    };
    const normal = { ...baseline };
    const onIce = { ...baseline };
    const target = { x: 420, y: 180 };

    advancePoliceChasing(normal, 0.5, target, 80, false);
    advancePoliceChasing(onIce, 0.5, target, 80, true);

    const normalDistance = Math.hypot(normal.x - baseline.x, normal.y - baseline.y);
    const onIceDistance = Math.hypot(onIce.x - baseline.x, onIce.y - baseline.y);
    expect(onIceDistance).toBeGreaterThan(normalDistance);
  });

  it('pauses immediately on focus loss and resumes on focus regain', () => {
    (game as any).beginRun('manual');
    (game as any).running = true;

    const visibilitySpy = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    const hasFocusSpy = vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    (game as any).syncPausedFromPageFocus();
    expect((game as any).paused).toBe(true);
    expect((game as any).pausedStartedAtMs).toBeGreaterThan(0);

    visibilitySpy.mockReturnValue('visible');
    hasFocusSpy.mockReturnValue(true);
    (game as any).syncPausedFromPageFocus();
    expect((game as any).paused).toBe(false);

    visibilitySpy.mockRestore();
    hasFocusSpy.mockRestore();
  });

  it('surfaces police-warning pre-chase flavor text', () => {
    const text = getFlavorText({
      score: 80,
      airborne: false,
      boostActive: false,
      magnetActive: false,
      ghostActive: false,
      invertActive: false,
      blackoutActive: false,
      planeActive: false,
      planeWarningActive: false,
      policeActive: false,
      policeWarningActive: true,
      policeDelayActive: false,
    });

    expect(text).toContain('Sirens warming up');
  });

  it('surfaces police-delay breathing-room flavor text', () => {
    const text = getFlavorText({
      score: 80,
      airborne: false,
      boostActive: false,
      magnetActive: false,
      ghostActive: false,
      invertActive: false,
      blackoutActive: false,
      planeActive: false,
      planeWarningActive: false,
      policeActive: false,
      policeWarningActive: false,
      policeDelayActive: true,
    });

    expect(text).toContain('Traffic hold');
  });

  it('surfaces airplane warning flavor text', () => {
    const text = getFlavorText({
      score: 80,
      airborne: false,
      boostActive: false,
      magnetActive: false,
      ghostActive: false,
      invertActive: false,
      blackoutActive: false,
      planeActive: false,
      planeWarningActive: true,
      policeActive: false,
      policeWarningActive: false,
      policeDelayActive: false,
    });

    expect(text).toContain('Nyoom inbound');
  });

  it('surfaces airplane flyover flavor text', () => {
    const text = getFlavorText({
      score: 80,
      airborne: false,
      boostActive: false,
      magnetActive: false,
      ghostActive: false,
      invertActive: false,
      blackoutActive: false,
      planeActive: true,
      planeWarningActive: false,
      policeActive: false,
      policeWarningActive: false,
      policeDelayActive: false,
    });

    expect(text).toContain('Flyover live');
  });
});
