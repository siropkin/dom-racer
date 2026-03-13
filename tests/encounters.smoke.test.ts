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
import { buildHudState } from '../src/game/gameHudAudioRuntime';
import { getFlavorText } from '../src/game/gameRuntime';
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

describe('police, plane, encounter stagger smoke invariants', () => {
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
      initialRunCount: 0,
      onRunFinished: (run) => runReasons.push(run.reason),
    });
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

    expect(hudState.activeEffects.some((effect) => effect.label === 'NYOOM')).toBe(true);
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
});
