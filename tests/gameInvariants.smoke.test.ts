import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { World } from '../src/shared/types';
import {
  advancePoliceDelayCueState,
  applyPlaneLuckyWindToPickups,
  createPoliceDelayCueState,
} from '../src/game/planeDropRuntime';
import {
  advancePoliceChasing,
  resolvePlaneEncounterSchedulingStep,
} from '../src/game/encounterRuntime';
import {
  advanceFocusModeAlpha,
  advanceSpecialSpawnCues,
  estimatePageLightness,
} from '../src/game/gameRenderRuntime';
import {
  resolveFocusPauseTransitionState,
  shouldPauseForPageFocus,
} from '../src/game/gameRunStateRuntime';
import { buildHudState } from '../src/game/gameHudAudioRuntime';
import {
  applyLurePullToPickups,
  applyMagnetPullToPickups,
  resolveSpecialEffectActivation,
} from '../src/game/gameEffectsRuntime';
import { getFlavorText } from '../src/game/gameRuntime';
import {
  resolveAmbientSpecialSpawnStep,
  getSpecialSpawnRespawnDelayMs,
  resolveRegularCoinSpawnStep,
} from '../src/game/pickupSpawnRuntime';
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
import {
  isNearMiss,
  resolveNearMissStep,
  NEAR_MISS_COOLDOWN_MS,
  NEAR_MISS_THRESHOLD_PX,
} from '../src/game/nearMissRuntime';
import {
  createInitialObjectiveState,
  getObjectiveCompletionWord,
  getObjectiveHudText,
  getObjectiveProgress,
  OBJECTIVE_TEMPLATES,
  pickObjectiveTemplate,
  resolveObjectiveTickStep,
  type MicroObjective,
} from '../src/game/microObjectiveRuntime';
import {
  JACKPOT_SCORE_MIN,
  JACKPOT_SCORE_MAX,
  JACKPOT_SPAWN_CHANCE,
  JACKPOT_PICKUP_SIZE,
} from '../src/game/gameRuntime';

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
    const regularBefore = runtimeWorldBefore.pickups.filter(
      (pickup) => pickup.kind !== 'special',
    ).length;
    const queueBefore = (game as any).coinSpawnQueue.length;

    const spawned = (game as any).spawnSpecialPickup() as boolean;
    const runtimeWorldAfter = (game as any).world as World;
    const regularAfter = runtimeWorldAfter.pickups.filter(
      (pickup) => pickup.kind !== 'special',
    ).length;
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

    const trailCoins = runtimeWorld.pickups.filter((pickup) =>
      pickup.id.startsWith('plane-trail:'),
    );
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
    const beforeDistance = Math.hypot(
      playerCenter.x - beforeCenter.x,
      playerCenter.y - beforeCenter.y,
    );
    const afterDistance = Math.hypot(
      playerCenter.x - afterCenter.x,
      playerCenter.y - afterCenter.y,
    );

    expect(afterDistance).toBeLessThan(beforeDistance);
  });

  it('keeps extracted magnet pull helper behavior unchanged', () => {
    const pickups: World['pickups'] = [
      {
        id: 'coin:near',
        sourceId: 'coin:near',
        rect: { x: 530, y: 300, width: 16, height: 16 },
        value: 10,
        kind: 'coin',
      },
      {
        id: 'special:near',
        rect: { x: 470, y: 230, width: 20, height: 20 },
        value: 25,
        kind: 'special',
        effect: 'magnet',
        accentColor: '#67e8f9',
        label: 'MAG',
      },
      {
        id: 'coin:far',
        sourceId: 'coin:far',
        rect: { x: 860, y: 520, width: 16, height: 16 },
        value: 10,
        kind: 'coin',
      },
    ];
    const playerCenter = { x: 600, y: 340 };
    const before = pickups.map((pickup) => ({
      id: pickup.id,
      centerX: pickup.rect.x + pickup.rect.width / 2,
      centerY: pickup.rect.y + pickup.rect.height / 2,
      distance: Math.hypot(
        playerCenter.x - (pickup.rect.x + pickup.rect.width / 2),
        playerCenter.y - (pickup.rect.y + pickup.rect.height / 2),
      ),
    }));

    applyMagnetPullToPickups(pickups, playerCenter, 0.5);

    const after = pickups.map((pickup) => ({
      id: pickup.id,
      centerX: pickup.rect.x + pickup.rect.width / 2,
      centerY: pickup.rect.y + pickup.rect.height / 2,
      distance: Math.hypot(
        playerCenter.x - (pickup.rect.x + pickup.rect.width / 2),
        playerCenter.y - (pickup.rect.y + pickup.rect.height / 2),
      ),
    }));

    const nearCoinBefore = before.find((entry) => entry.id === 'coin:near');
    const nearCoinAfter = after.find((entry) => entry.id === 'coin:near');
    const nearSpecialBefore = before.find((entry) => entry.id === 'special:near');
    const nearSpecialAfter = after.find((entry) => entry.id === 'special:near');
    const farCoinBefore = before.find((entry) => entry.id === 'coin:far');
    const farCoinAfter = after.find((entry) => entry.id === 'coin:far');
    expect(nearCoinAfter?.distance).toBeLessThan(
      nearCoinBefore?.distance ?? Number.POSITIVE_INFINITY,
    );
    expect(nearSpecialAfter?.distance).toBeLessThan(
      nearSpecialBefore?.distance ?? Number.POSITIVE_INFINITY,
    );
    expect(farCoinAfter?.centerX).toBe(farCoinBefore?.centerX);
    expect(farCoinAfter?.centerY).toBe(farCoinBefore?.centerY);
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
    const movedRegularCoins = pickups
      .filter((pickup) => pickup.kind !== 'special')
      .filter((pickup) => {
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
      effectMode: 'coin-trail',
    };
    (game as any).spawnPlaneBonusDrop = () => false;
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
    const specialCountBefore = runtimeWorld.pickups.filter(
      (pickup) => pickup.kind === 'special',
    ).length;

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
    const specialCountAfter = runtimeWorld.pickups.filter(
      (pickup) => pickup.kind === 'special',
    ).length;
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

  it('keeps extracted focus-pause transition helper behavior unchanged', () => {
    expect(shouldPauseForPageFocus('hidden', true)).toBe(true);
    expect(shouldPauseForPageFocus('visible', false)).toBe(true);
    expect(shouldPauseForPageFocus('visible', true)).toBe(false);

    const entered = resolveFocusPauseTransitionState({
      paused: false,
      pausedStartedAtMs: 0,
      lastFrameMs: 2400,
      shouldPause: true,
      nowMs: 3600,
    });
    expect(entered.transition).toBe('enter');
    expect(entered.paused).toBe(true);
    expect(entered.pausedStartedAtMs).toBe(3600);
    expect(entered.lastFrameMs).toBe(2400);

    const exited = resolveFocusPauseTransitionState({
      paused: true,
      pausedStartedAtMs: entered.pausedStartedAtMs,
      lastFrameMs: entered.lastFrameMs,
      shouldPause: false,
      nowMs: 4200,
    });
    expect(exited.transition).toBe('exit');
    expect(exited.paused).toBe(false);
    expect(exited.pausedStartedAtMs).toBe(entered.pausedStartedAtMs);
    expect(exited.lastFrameMs).toBe(4200);
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
      lureActive: false,
      nearMissCount: 0,
      objectivesCompleted: 0,
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
      lureActive: false,
      nearMissCount: 0,
      objectivesCompleted: 0,
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
      lureActive: false,
      nearMissCount: 0,
      objectivesCompleted: 0,
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
      lureActive: false,
      nearMissCount: 0,
      objectivesCompleted: 0,
      planeActive: true,
      planeWarningActive: false,
      policeActive: false,
      policeWarningActive: false,
      policeDelayActive: false,
    });

    expect(text).toContain('Flyover live');
  });

  it('surfaces lure active flavor text', () => {
    const text = getFlavorText({
      score: 80,
      airborne: false,
      boostActive: false,
      magnetActive: false,
      ghostActive: false,
      invertActive: false,
      blackoutActive: false,
      lureActive: true,
      nearMissCount: 0,
      objectivesCompleted: 0,
      planeActive: false,
      planeWarningActive: false,
      policeActive: false,
      policeWarningActive: false,
      policeDelayActive: false,
    });

    expect(text).toContain('Loose change incoming');
  });

  it('keeps extracted focus-mode alpha helper behavior unchanged', () => {
    const relaxed = advanceFocusModeAlpha(0.75, false, 0.5);
    expect(relaxed).toBeGreaterThan(0.75);
    expect(relaxed).toBeLessThanOrEqual(1);

    const focused = advanceFocusModeAlpha(0.75, true, 0.5);
    expect(focused).toBeLessThan(0.75);
    expect(focused).toBeGreaterThanOrEqual(0);

    const stableAtTarget = advanceFocusModeAlpha(1.0, false, 0.016);
    expect(Math.abs(stableAtTarget - 1.0)).toBeLessThan(0.01);
  });

  it('shows airplane/police warning countdown cues in HUD active effects', () => {
    const hudState = buildHudState({
      score: 90,
      elapsedMs: 22000,
      pageTitle: 'DOM Racer Smoke',
      pickupsRemaining: 8,
      scannedCount: 120,
      airborne: false,
      boostActive: false,
      soundEnabled: true,
      pageBestScore: 140,
      lifetimeBestScore: 220,
      magnetTimerMs: 0,
      ghostTimerMs: 0,
      invertTimerMs: 0,
      blackoutTimerMs: 0,
      lureTimerMs: 0,
      policeDelayCueTimerMs: 0,
      policeDelayCueDurationMs: 0,
      comboTimerMs: 0,
      pickupComboCount: 0,
      policeRemainingMs: null,
      policeDurationMs: null,
      planeActive: false,
      planeWarningActive: true,
      planeWarningRemainingMs: 620,
      planeWarningDurationMs: 900,
      policeActive: false,
      policeWarningActive: true,
      policeWarningRemainingMs: 840,
      policeWarningDurationMs: 1100,
      nearMissCount: 0,
      objectivesCompleted: 0,
      objectiveActive: null,
      currentSurface: { lightness: 0.55, saturation: 0.2, hasGradient: false },
    });

    expect(hudState.activeEffects.some((effect) => effect.label === 'WEE-OO')).toBe(true);
    expect(hudState.activeEffects.some((effect) => effect.label === 'NYOOM')).toBe(true);
  });

  it('keeps extracted ambient special spawn scheduling unchanged', () => {
    const staggered = resolveAmbientSpecialSpawnStep({
      specialSpawnTimerMs: 500,
      existingSpecialCount: 0,
      planeRouteActive: true,
      dtSeconds: 0.5,
    });
    expect(staggered.shouldAttemptSpawn).toBe(false);
    expect(staggered.specialSpawnTimerMs).toBeGreaterThanOrEqual(1500);

    const waiting = resolveAmbientSpecialSpawnStep({
      specialSpawnTimerMs: 3000,
      existingSpecialCount: 0,
      planeRouteActive: false,
      dtSeconds: 0.5,
    });
    expect(waiting.shouldAttemptSpawn).toBe(false);
    expect(waiting.specialSpawnTimerMs).toBe(2500);

    const atCap = resolveAmbientSpecialSpawnStep({
      specialSpawnTimerMs: 0,
      existingSpecialCount: 2,
      planeRouteActive: false,
      dtSeconds: 0.5,
    });
    expect(atCap.shouldAttemptSpawn).toBe(false);
    expect(atCap.specialSpawnTimerMs).toBeGreaterThan(0);

    const ready = resolveAmbientSpecialSpawnStep({
      specialSpawnTimerMs: 200,
      existingSpecialCount: 0,
      planeRouteActive: false,
      dtSeconds: 0.5,
    });
    expect(ready.shouldAttemptSpawn).toBe(true);
    expect(ready.specialSpawnTimerMs).toBe(0);

    const respawnDelay = getSpecialSpawnRespawnDelayMs(true);
    expect(respawnDelay).toBeGreaterThan(0);
    const retryDelay = getSpecialSpawnRespawnDelayMs(false);
    expect(retryDelay).toBeGreaterThan(0);
    expect(respawnDelay).toBeGreaterThanOrEqual(retryDelay * 0.5);
  });

  it('keeps extracted plane encounter scheduling unchanged', () => {
    const noProgress = resolvePlaneEncounterSchedulingStep({
      planeBonusTimerMs: 8000,
      hasRunProgress: false,
      policeOrWarningActive: false,
      dtSeconds: 0.5,
    });
    expect(noProgress.shouldStartEncounter).toBe(false);
    expect(noProgress.planeBonusTimerMs).toBe(8000);

    const staggered = resolvePlaneEncounterSchedulingStep({
      planeBonusTimerMs: 1200,
      hasRunProgress: true,
      policeOrWarningActive: true,
      dtSeconds: 0.5,
    });
    expect(staggered.shouldStartEncounter).toBe(false);
    expect(staggered.planeBonusTimerMs).toBeGreaterThanOrEqual(3800);

    const waiting = resolvePlaneEncounterSchedulingStep({
      planeBonusTimerMs: 5000,
      hasRunProgress: true,
      policeOrWarningActive: false,
      dtSeconds: 0.5,
    });
    expect(waiting.shouldStartEncounter).toBe(false);
    expect(waiting.planeBonusTimerMs).toBe(4500);

    const ready = resolvePlaneEncounterSchedulingStep({
      planeBonusTimerMs: 300,
      hasRunProgress: true,
      policeOrWarningActive: false,
      dtSeconds: 0.5,
    });
    expect(ready.shouldStartEncounter).toBe(true);
    expect(ready.planeBonusTimerMs).toBe(0);
  });

  it('does not toast when ambient specials spawn (spawn cue ring only)', () => {
    (game as any).beginRun('manual');
    (game as any).toastSystem.clear();

    const spawned = (game as any).spawnSpecialPickup() as boolean;
    expect(spawned).toBe(true);

    const cues = (game as any).specialSpawnCues as Array<{ label: string }>;
    expect(cues.length).toBeGreaterThan(0);

    const toastMessages = (game as any).toastSystem['messages'] as Array<{ text: string }>;
    expect(toastMessages).toHaveLength(0);
  });

  it('keeps extracted regular coin spawn step timer logic unchanged', () => {
    const emptyQueue = resolveRegularCoinSpawnStep({
      coinRefillBoostTimerMs: 1200,
      coinRefillTimerMs: 800,
      coinSpawnQueueEmpty: true,
      visibleRegularCoins: 3,
      dtSeconds: 0.5,
    });
    expect(emptyQueue.shouldSpawn).toBe(false);
    expect(emptyQueue.coinRefillBoostTimerMs).toBe(1200);
    expect(emptyQueue.coinRefillTimerMs).toBe(800);

    const atCap = resolveRegularCoinSpawnStep({
      coinRefillBoostTimerMs: 1200,
      coinRefillTimerMs: 800,
      coinSpawnQueueEmpty: false,
      visibleRegularCoins: 11,
      dtSeconds: 0.5,
    });
    expect(atCap.shouldSpawn).toBe(false);
    expect(atCap.coinRefillBoostTimerMs).toBe(700);

    const waiting = resolveRegularCoinSpawnStep({
      coinRefillBoostTimerMs: 1200,
      coinRefillTimerMs: 1600,
      coinSpawnQueueEmpty: false,
      visibleRegularCoins: 5,
      dtSeconds: 0.5,
    });
    expect(waiting.shouldSpawn).toBe(false);
    expect(waiting.coinRefillTimerMs).toBe(1100);
    expect(waiting.coinRefillBoostTimerMs).toBe(700);

    const ready = resolveRegularCoinSpawnStep({
      coinRefillBoostTimerMs: 200,
      coinRefillTimerMs: 300,
      coinSpawnQueueEmpty: false,
      visibleRegularCoins: 5,
      dtSeconds: 0.5,
    });
    expect(ready.shouldSpawn).toBe(true);
    expect(ready.coinRefillTimerMs).toBe(0);
    expect(ready.coinRefillBoostTimerMs).toBe(0);
  });

  it('keeps extracted special-effect activation resolution unchanged', () => {
    const brightSurface = { lightness: 0.7, saturation: 0.2, hasGradient: false };
    const darkSurface = { lightness: 0.2, saturation: 0.1, hasGradient: false };

    const bonus = resolveSpecialEffectActivation('bonus', brightSurface);
    expect(bonus.resolvedEffect).toBe('bonus');
    expect(bonus.scoreBonus).toBe(40);
    expect(bonus.timerMs).toBe(0);
    expect(bonus.policeDelayMs).toBe(0);
    expect(bonus.setInverted).toBe(false);
    expect(bonus.setBlackout).toBe(false);
    expect(bonus.messageText).toContain('BON');

    const magnet = resolveSpecialEffectActivation('magnet', brightSurface);
    expect(magnet.resolvedEffect).toBe('magnet');
    expect(magnet.scoreBonus).toBe(0);
    expect(magnet.timerMs).toBeGreaterThan(0);
    expect(magnet.policeDelayMs).toBe(0);
    expect(magnet.setInverted).toBe(false);
    expect(magnet.setBlackout).toBe(false);

    const invert = resolveSpecialEffectActivation('invert', brightSurface);
    expect(invert.resolvedEffect).toBe('invert');
    expect(invert.timerMs).toBeGreaterThan(0);
    expect(invert.setInverted).toBe(true);
    expect(invert.setBlackout).toBe(false);

    const ghost = resolveSpecialEffectActivation('ghost', brightSurface);
    expect(ghost.resolvedEffect).toBe('ghost');
    expect(ghost.timerMs).toBeGreaterThan(0);
    expect(ghost.setInverted).toBe(false);
    expect(ghost.setBlackout).toBe(false);

    const blackout = resolveSpecialEffectActivation('blackout', brightSurface);
    expect(blackout.resolvedEffect).toBe('blackout');
    expect(blackout.timerMs).toBeGreaterThan(0);
    expect(blackout.setInverted).toBe(false);
    expect(blackout.setBlackout).toBe(true);

    const blackoutOnDark = resolveSpecialEffectActivation('blackout', darkSurface);
    expect(blackoutOnDark.resolvedEffect).toBe('invert');
    expect(blackoutOnDark.setInverted).toBe(true);
    expect(blackoutOnDark.setBlackout).toBe(false);
  });

  it('resolves cooldown activation with score bonus and police delay', () => {
    const surface = { lightness: 0.6, saturation: 0.2, hasGradient: false };
    const cooldown = resolveSpecialEffectActivation('cooldown', surface);
    expect(cooldown.resolvedEffect).toBe('cooldown');
    expect(cooldown.scoreBonus).toBe(15);
    expect(cooldown.timerMs).toBe(0);
    expect(cooldown.policeDelayMs).toBeGreaterThanOrEqual(5400);
    expect(cooldown.policeDelayMs).toBeLessThanOrEqual(8200);
    expect(cooldown.setInverted).toBe(false);
    expect(cooldown.setBlackout).toBe(false);
    expect(cooldown.messageText).toContain('CDN');
  });

  it('resolves lure activation with timer and no visual side effects', () => {
    const surface = { lightness: 0.6, saturation: 0.2, hasGradient: false };
    const lure = resolveSpecialEffectActivation('lure', surface);
    expect(lure.resolvedEffect).toBe('lure');
    expect(lure.scoreBonus).toBe(0);
    expect(lure.timerMs).toBe(5400);
    expect(lure.policeDelayMs).toBe(0);
    expect(lure.setInverted).toBe(false);
    expect(lure.setBlackout).toBe(false);
    expect(lure.messageText).toContain('LUR');
  });

  it('uses lure pull to attract distant coins but not specials', () => {
    const pickups: World['pickups'] = [
      {
        id: 'coin:near',
        sourceId: 'coin:near',
        rect: { x: 460, y: 260, width: 16, height: 16 },
        value: 10,
        kind: 'coin',
      },
      {
        id: 'coin:far',
        sourceId: 'coin:far',
        rect: { x: 360, y: 180, width: 16, height: 16 },
        value: 10,
        kind: 'coin',
      },
      {
        id: 'coin:out-of-range',
        sourceId: 'coin:out-of-range',
        rect: { x: 860, y: 520, width: 16, height: 16 },
        value: 10,
        kind: 'coin',
      },
      {
        id: 'special:magnet:lure-test',
        rect: { x: 480, y: 240, width: 20, height: 20 },
        value: 25,
        kind: 'special',
        effect: 'magnet',
        accentColor: '#67e8f9',
        label: 'MAG',
      },
    ];
    const playerCenter = { x: 500, y: 300 };
    const nearBefore = { ...pickups[0].rect };
    const farBefore = { ...pickups[1].rect };
    const outOfRangeBefore = { ...pickups[2].rect };
    const specialBefore = { ...pickups[3].rect };

    applyLurePullToPickups(pickups, playerCenter, 0.5);

    const nearDistance = Math.hypot(
      playerCenter.x - (pickups[0].rect.x + 8),
      playerCenter.y - (pickups[0].rect.y + 8),
    );
    const nearBeforeDistance = Math.hypot(
      playerCenter.x - (nearBefore.x + 8),
      playerCenter.y - (nearBefore.y + 8),
    );
    expect(nearDistance).toBeLessThan(nearBeforeDistance);

    const farDistance = Math.hypot(
      playerCenter.x - (pickups[1].rect.x + 8),
      playerCenter.y - (pickups[1].rect.y + 8),
    );
    const farBeforeDistance = Math.hypot(
      playerCenter.x - (farBefore.x + 8),
      playerCenter.y - (farBefore.y + 8),
    );
    expect(farDistance).toBeLessThan(farBeforeDistance);

    expect(pickups[2].rect.x).toBe(outOfRangeBefore.x);
    expect(pickups[2].rect.y).toBe(outOfRangeBefore.y);

    expect(pickups[3].rect.x).toBe(specialBefore.x);
    expect(pickups[3].rect.y).toBe(specialBefore.y);
  });

  it('uses cooldown to push police timer and show delay cue', () => {
    (game as any).beginRun('manual');
    const spawnTimerBefore = 2000;
    (game as any).policeSpawnTimerMs = spawnTimerBefore;

    (game as any).activateSpecialEffect('cooldown');

    expect((game as any).policeSpawnTimerMs).toBeGreaterThan(spawnTimerBefore + 5000);
    expect((game as any).policeDelayCueTimerMs).toBeGreaterThan(5000);
    expect((game as any).policeDelayCueDurationMs).toBe((game as any).policeDelayCueTimerMs);
    expect((game as any).score).toBe(15);
    expect((game as any).policeWarning).toBeNull();
  });

  it('activates lure timer when lure special is collected', () => {
    (game as any).beginRun('manual');
    expect((game as any).lureTimerMs).toBe(0);

    (game as any).activateSpecialEffect('lure');

    expect((game as any).lureTimerMs).toBe(5400);
    expect((game as any).score).toBe(0);
  });

  it('keeps extracted page lightness estimation unchanged', () => {
    const viewport = { width: 1280, height: 720 };
    const brightSampler = () => ({ lightness: 0.9, saturation: 0.1, hasGradient: false });
    const darkSampler = () => ({ lightness: 0.15, saturation: 0.05, hasGradient: false });
    const mixedCallIndex = { i: 0 };
    const mixedSampler = () => {
      mixedCallIndex.i += 1;
      return {
        lightness: mixedCallIndex.i % 2 === 0 ? 0.8 : 0.2,
        saturation: 0.1,
        hasGradient: false,
      };
    };

    const bright = estimatePageLightness(viewport, brightSampler);
    expect(bright).toBeCloseTo(0.9, 1);

    const dark = estimatePageLightness(viewport, darkSampler);
    expect(dark).toBeCloseTo(0.15, 1);

    const mixed = estimatePageLightness(viewport, mixedSampler);
    expect(mixed).toBeGreaterThan(0.1);
    expect(mixed).toBeLessThan(0.9);

    const fallback = estimatePageLightness(viewport, () => ({
      lightness: Number.NaN,
      saturation: 0,
      hasGradient: false,
    }));
    expect(fallback).toBe(0.5);
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

  it('detects near-miss when player is within threshold of an obstacle', () => {
    const player = { x: 100, y: 100, width: 28, height: 16 };
    const obstacle = { x: 100, y: 100 + 16 + 3, width: 40, height: 20 };
    expect(isNearMiss(player, obstacle, NEAR_MISS_THRESHOLD_PX)).toBe(true);
  });

  it('does not detect near-miss when player is colliding', () => {
    const player = { x: 100, y: 100, width: 28, height: 16 };
    const obstacle = { x: 110, y: 108, width: 40, height: 20 };
    expect(isNearMiss(player, obstacle, NEAR_MISS_THRESHOLD_PX)).toBe(false);
  });

  it('does not detect near-miss when player is beyond threshold', () => {
    const player = { x: 100, y: 100, width: 28, height: 16 };
    const obstacle = { x: 100, y: 200, width: 40, height: 20 };
    expect(isNearMiss(player, obstacle, NEAR_MISS_THRESHOLD_PX)).toBe(false);
  });

  it('blocks near-miss triggers during cooldown', () => {
    const player = { x: 100, y: 100, width: 28, height: 16 };
    const obstacle = { x: 100, y: 119, width: 40, height: 20 };
    const step = resolveNearMissStep({
      playerBounds: player,
      obstacles: [obstacle],
      policeRect: null,
      cooldownMs: NEAR_MISS_COOLDOWN_MS,
      dtSeconds: 0.016,
      flavorIndex: 0,
    });
    expect(step.triggered).toBe(false);
    expect(step.cooldownMs).toBeGreaterThan(0);
    expect(step.cooldownMs).toBeLessThan(NEAR_MISS_COOLDOWN_MS);
  });

  it('triggers near-miss with score bonus when close to obstacle and off cooldown', () => {
    const player = { x: 100, y: 100, width: 28, height: 16 };
    const obstacle = { x: 100, y: 119, width: 40, height: 20 };
    const step = resolveNearMissStep({
      playerBounds: player,
      obstacles: [obstacle],
      policeRect: null,
      cooldownMs: 0,
      dtSeconds: 0.016,
      flavorIndex: 0,
    });
    expect(step.triggered).toBe(true);
    expect(step.scoreBonus).toBeGreaterThanOrEqual(3);
    expect(step.scoreBonus).toBeLessThanOrEqual(5);
    expect(step.cooldownMs).toBe(NEAR_MISS_COOLDOWN_MS);
    expect(step.messageText.length).toBeGreaterThan(0);
  });

  it('detects near-miss against police car rect', () => {
    const player = { x: 200, y: 200, width: 28, height: 16 };
    const policeRect = { x: 200, y: 200 + 16 + 4, width: 26, height: 18 };
    const step = resolveNearMissStep({
      playerBounds: player,
      obstacles: [],
      policeRect,
      cooldownMs: 0,
      dtSeconds: 0.016,
      flavorIndex: 0,
    });
    expect(step.triggered).toBe(true);
    expect(step.scoreBonus).toBeGreaterThanOrEqual(3);
  });

  it('resets near-miss state on beginRun', () => {
    (game as any).beginRun('manual');
    (game as any).nearMissCooldownMs = 500;
    (game as any).nearMissCount = 6;
    (game as any).nearMissFlavorIndex = 4;

    (game as any).beginRun('manual');
    expect((game as any).nearMissCooldownMs).toBe(0);
    expect((game as any).nearMissCount).toBe(0);
    expect((game as any).nearMissFlavorIndex).toBe(0);
  });

  it('surfaces near-miss flavor text at threshold counts', () => {
    const base = {
      score: 80,
      airborne: false,
      boostActive: false,
      magnetActive: false,
      ghostActive: false,
      invertActive: false,
      blackoutActive: false,
      lureActive: false,
      objectivesCompleted: 0,
      planeActive: false,
      planeWarningActive: false,
      policeActive: false,
      policeWarningActive: false,
      policeDelayActive: false,
    };

    const at4 = getFlavorText({ ...base, nearMissCount: 4 });
    expect(at4).toContain('Living on the edge');

    const at8 = getFlavorText({ ...base, nearMissCount: 8 });
    expect(at8).toContain('Thread the needle');

    const at0 = getFlavorText({ ...base, nearMissCount: 0 });
    expect(at0).not.toContain('needle');
    expect(at0).not.toContain('edge');
  });

  it('assigns a micro-objective after initial delay expires', () => {
    const noEvent: ObjectiveTickEvents = {
      coinsCollectedThisFrame: 0,
      specialsCollectedThisFrame: 0,
      nearMissTriggeredThisFrame: false,
      currentScore: 0,
      currentComboCount: 0,
    };
    const initial = createInitialObjectiveState();
    expect(initial.assignDelayMs).toBeGreaterThan(0);

    const waiting = resolveObjectiveTickStep({
      active: null,
      assignDelayMs: 2000,
      completedCount: 0,
      lastTemplateId: '',
      events: noEvent,
      dtSeconds: 0.5,
    });
    expect(waiting.active).toBeNull();
    expect(waiting.assignDelayMs).toBe(1500);

    const assigned = resolveObjectiveTickStep({
      active: null,
      assignDelayMs: 200,
      completedCount: 0,
      lastTemplateId: '',
      events: noEvent,
      dtSeconds: 0.5,
    });
    expect(assigned.active).not.toBeNull();
    expect(assigned.active!.progress).toBe(0);
  });

  it('completes a coin-collection objective when target is reached', () => {
    const objective: MicroObjective = {
      templateId: 'collect_5',
      label: '5 COINS',
      progress: 4,
      target: 5,
      timeRemainingMs: 0,
      timeLimitMs: 0,
      tracker: 'coins_collected',
    };

    const step = resolveObjectiveTickStep({
      active: objective,
      assignDelayMs: 0,
      completedCount: 0,
      lastTemplateId: 'collect_5',
      events: {
        coinsCollectedThisFrame: 1,
        specialsCollectedThisFrame: 0,
        nearMissTriggeredThisFrame: false,
        currentScore: 50,
        currentComboCount: 0,
      },
      dtSeconds: 0.016,
    });

    expect(step.completed).toBe(true);
    expect(step.active).toBeNull();
    expect(step.completedCount).toBe(1);
    expect(step.assignDelayMs).toBeGreaterThan(0);
  });

  it('expires a timed objective when time runs out without reaching target', () => {
    const objective: MicroObjective = {
      templateId: 'collect_8_20s',
      label: '8 COINS 20S',
      progress: 3,
      target: 8,
      timeRemainingMs: 200,
      timeLimitMs: 20_000,
      tracker: 'coins_collected',
    };

    const step = resolveObjectiveTickStep({
      active: objective,
      assignDelayMs: 0,
      completedCount: 0,
      lastTemplateId: 'collect_8_20s',
      events: {
        coinsCollectedThisFrame: 0,
        specialsCollectedThisFrame: 0,
        nearMissTriggeredThisFrame: false,
        currentScore: 30,
        currentComboCount: 0,
      },
      dtSeconds: 0.5,
    });

    expect(step.expired).toBe(true);
    expect(step.completed).toBe(false);
    expect(step.active).toBeNull();
    expect(step.completedCount).toBe(0);
  });

  it('completes survive-duration objective when timer expires', () => {
    const objective: MicroObjective = {
      templateId: 'survive_20',
      label: 'SURVIVE 20S',
      progress: 19_800,
      target: 20_000,
      timeRemainingMs: 200,
      timeLimitMs: 20_000,
      tracker: 'survive_duration',
    };

    const step = resolveObjectiveTickStep({
      active: objective,
      assignDelayMs: 0,
      completedCount: 1,
      lastTemplateId: 'survive_20',
      events: {
        coinsCollectedThisFrame: 0,
        specialsCollectedThisFrame: 0,
        nearMissTriggeredThisFrame: false,
        currentScore: 60,
        currentComboCount: 0,
      },
      dtSeconds: 0.5,
    });

    expect(step.completed).toBe(true);
    expect(step.expired).toBe(false);
    expect(step.completedCount).toBe(2);
  });

  it('does not repeat the same objective template consecutively', () => {
    const picked = pickObjectiveTemplate('collect_5', 40);
    expect(picked).not.toBeNull();
    expect(picked!.id).not.toBe('collect_5');
  });

  it('skips score-threshold objectives when score already near target', () => {
    const picked = pickObjectiveTemplate('', 70);
    if (picked && picked.tracker === 'score_threshold') {
      expect(picked.target).toBeGreaterThan(70 / 0.8);
    }
  });

  it('tracks near-miss triggers for objective progress', () => {
    const objective: MicroObjective = {
      templateId: 'near_3',
      label: '3 CLOSE CALLS',
      progress: 1,
      target: 3,
      timeRemainingMs: 0,
      timeLimitMs: 0,
      tracker: 'near_misses',
    };

    const step = resolveObjectiveTickStep({
      active: objective,
      assignDelayMs: 0,
      completedCount: 0,
      lastTemplateId: 'near_3',
      events: {
        coinsCollectedThisFrame: 0,
        specialsCollectedThisFrame: 0,
        nearMissTriggeredThisFrame: true,
        currentScore: 40,
        currentComboCount: 0,
      },
      dtSeconds: 0.016,
    });

    expect(step.active).not.toBeNull();
    expect(step.active!.progress).toBe(2);
    expect(step.completed).toBe(false);
  });

  it('resets objective state on beginRun', () => {
    (game as any).beginRun('manual');
    (game as any).objectiveActive = {
      templateId: 'collect_5',
      label: '5 COINS',
      progress: 3,
      target: 5,
      timeRemainingMs: 0,
      timeLimitMs: 0,
      tracker: 'coins_collected',
    };
    (game as any).objectiveCompletedCount = 4;

    (game as any).beginRun('manual');
    expect((game as any).objectiveActive).toBeNull();
    expect((game as any).objectiveCompletedCount).toBe(0);
    expect((game as any).objectiveAssignDelayMs).toBeGreaterThan(0);
  });

  it('formats objective HUD text with progress', () => {
    const coinObj: MicroObjective = {
      templateId: 'collect_5',
      label: '5 COINS',
      progress: 3,
      target: 5,
      timeRemainingMs: 0,
      timeLimitMs: 0,
      tracker: 'coins_collected',
    };
    expect(getObjectiveHudText(coinObj)).toBe('5 COINS 3/5');
    expect(getObjectiveProgress(coinObj)).toBeCloseTo(0.6, 1);

    const surviveObj: MicroObjective = {
      templateId: 'survive_20',
      label: 'SURVIVE 20S',
      progress: 10_000,
      target: 20_000,
      timeRemainingMs: 10_000,
      timeLimitMs: 20_000,
      tracker: 'survive_duration',
    };
    expect(getObjectiveHudText(surviveObj)).toBe('SURVIVE 20S 10/20');
    expect(getObjectiveProgress(surviveObj)).toBeCloseTo(0.5, 1);
  });

  it('cycles through completion words', () => {
    const words = [0, 1, 2, 3].map(getObjectiveCompletionWord);
    expect(words).toEqual(['NAILED!', 'DONE!', 'CLEAR!', 'CHECK!']);
    expect(getObjectiveCompletionWord(4)).toBe('NAILED!');
  });

  it('surfaces objective flavor text at threshold counts', () => {
    const base = {
      score: 80,
      airborne: false,
      boostActive: false,
      magnetActive: false,
      ghostActive: false,
      invertActive: false,
      blackoutActive: false,
      lureActive: false,
      nearMissCount: 0,
      planeActive: false,
      planeWarningActive: false,
      policeActive: false,
      policeWarningActive: false,
      policeDelayActive: false,
    };

    const at3 = getFlavorText({ ...base, objectivesCompleted: 3 });
    expect(at3).toContain('Checking boxes');

    const at6 = getFlavorText({ ...base, objectivesCompleted: 6 });
    expect(at6).toContain('Objective machine');

    const at0 = getFlavorText({ ...base, objectivesCompleted: 0 });
    expect(at0).not.toContain('Checking boxes');
    expect(at0).not.toContain('Objective machine');
  });

  it('has at least 8 objective templates in the pool', () => {
    expect(OBJECTIVE_TEMPLATES.length).toBeGreaterThanOrEqual(8);
    const ids = OBJECTIVE_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('resolves jackpot activation with large score bonus and no timer', () => {
    const surface = { lightness: 0.6, saturation: 0.2, hasGradient: false };
    const jackpot = resolveSpecialEffectActivation('jackpot', surface);
    expect(jackpot.resolvedEffect).toBe('jackpot');
    expect(jackpot.scoreBonus).toBeGreaterThanOrEqual(JACKPOT_SCORE_MIN);
    expect(jackpot.scoreBonus).toBeLessThanOrEqual(JACKPOT_SCORE_MAX);
    expect(jackpot.timerMs).toBe(0);
    expect(jackpot.policeDelayMs).toBe(0);
    expect(jackpot.setInverted).toBe(false);
    expect(jackpot.setBlackout).toBe(false);
    expect(jackpot.messageText).toBe('JACKPOT!');
  });

  it('uses jackpot spawn chance constant within expected range', () => {
    expect(JACKPOT_SPAWN_CHANCE).toBeGreaterThan(0);
    expect(JACKPOT_SPAWN_CHANCE).toBeLessThanOrEqual(0.1);
  });

  it('uses a larger pickup size for jackpot than regular specials', () => {
    expect(JACKPOT_PICKUP_SIZE).toBeGreaterThan(20);
  });

  it('spawns jackpot pickup when jackpot roll succeeds', () => {
    (game as any).beginRun('manual');
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.02);
    const spawned = (game as any).spawnSpecialPickup() as boolean;
    randomSpy.mockRestore();

    expect(spawned).toBe(true);
    const runtimeWorld = (game as any).world as World;
    const jackpots = runtimeWorld.pickups.filter(
      (pickup) => pickup.kind === 'special' && pickup.effect === 'jackpot',
    );
    expect(jackpots.length).toBe(1);
    expect(jackpots[0].rect.width).toBe(JACKPOT_PICKUP_SIZE);
    expect(jackpots[0].rect.height).toBe(JACKPOT_PICKUP_SIZE);
    expect(jackpots[0].label).toBe('JKP');
  });

  it('spawns regular special when jackpot roll fails', () => {
    (game as any).beginRun('manual');
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const spawned = (game as any).spawnSpecialPickup() as boolean;
    randomSpy.mockRestore();

    expect(spawned).toBe(true);
    const runtimeWorld = (game as any).world as World;
    const jackpots = runtimeWorld.pickups.filter(
      (pickup) => pickup.kind === 'special' && pickup.effect === 'jackpot',
    );
    expect(jackpots.length).toBe(0);
    const specials = runtimeWorld.pickups.filter((pickup) => pickup.kind === 'special');
    expect(specials.length).toBeGreaterThan(0);
    expect(specials[0].rect.width).toBe(20);
  });

  it('activates jackpot effect with large score bonus in Game', () => {
    (game as any).beginRun('manual');
    expect((game as any).score).toBe(0);

    (game as any).activateSpecialEffect('jackpot');

    expect((game as any).score).toBeGreaterThanOrEqual(JACKPOT_SCORE_MIN);
    expect((game as any).score).toBeLessThanOrEqual(JACKPOT_SCORE_MAX);
  });
});
