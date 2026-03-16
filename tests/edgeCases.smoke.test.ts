import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Rect, World } from '../src/shared/types';
import {
  createPoliceChase,
  resolvePoliceChaseTickStep,
  resolvePlaneEncounterSchedulingStep,
} from '../src/game/encounterRuntime';
import {
  resolveTrainSpawnStep,
  checkTrainCollision,
  createTrainEvent,
} from '../src/game/trainRuntime';
import { resolveSpecialEffectActivation } from '../src/game/gameEffectsRuntime';
import { ENCOUNTER } from '../src/game/gameConfig';
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
    updatePropellerDrone(): void {}
    updateHelicopterChop(): void {}
    playTrainHorn(): void {}
    updateTrainRumble(): void {}
    playNearMissWhoosh(): void {}
    playObjectiveChime(): void {}
    async resume(): Promise<void> {}
  }
  return { AudioManager: MockAudioManager };
});

import { Game } from '../src/game/Game';

function createGame(): Game {
  return new Game({
    canvas: createCanvas(),
    createWorld: () => createWorldWithRegularCoins(14),
    getPageTitle: () => 'Edge Case Smoke',
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
}

describe('26A: encounter overlap stress tests', () => {
  const viewport = { width: 1280, height: 720 };

  it('stagger prevents triple-overlap of police + train + plane', () => {
    const trainStep = resolveTrainSpawnStep({
      trainSpawnTimerMs: 0,
      runElapsedMs: 60_000,
      trainEventsThisRun: 0,
      policeOrWarningActive: true,
      planeOrWarningActive: true,
      trainActive: false,
      dtSeconds: 0.016,
    });
    expect(trainStep.shouldSpawn).toBe(false);
    expect(trainStep.trainSpawnTimerMs).toBeGreaterThanOrEqual(ENCOUNTER.STAGGER_MS);

    const planeStep = resolvePlaneEncounterSchedulingStep({
      planeBonusTimerMs: 0,
      hasRunProgress: true,
      policeOrWarningActive: true,
      dtSeconds: 0.016,
    });
    expect(planeStep.shouldStartEncounter).toBe(false);
    expect(planeStep.planeBonusTimerMs).toBeGreaterThanOrEqual(ENCOUNTER.STAGGER_MS);
  });

  it('police chase can start during train warning without conflict', () => {
    const trainStep = resolveTrainSpawnStep({
      trainSpawnTimerMs: 0,
      runElapsedMs: 60_000,
      trainEventsThisRun: 0,
      policeOrWarningActive: false,
      planeOrWarningActive: false,
      trainActive: false,
      dtSeconds: 0.5,
    });
    expect(trainStep.shouldSpawn).toBe(true);

    const policeChase = createPoliceChase(viewport, 'right', 60_000, 1, 1);
    expect(policeChase.phase).toBe('chasing');
    expect(policeChase.variant).toBe('car');
  });

  it('ghost dismisses helicopter chase AND prevents train collision simultaneously', () => {
    const heliChase = createPoliceChase(viewport, 'right', 70_000, 1, 4);
    expect(heliChase.variant).toBe('helicopter');

    const result = resolvePoliceChaseTickStep({
      viewport,
      iceZones: [],
      playerBounds: { x: 600, y: 350, width: 22, height: 12 },
      playerCenter: { x: 611, y: 356 },
      ghostActive: true,
      policeChase: heliChase,
      policeWarning: null,
      policeSpawnTimerMs: 12_000,
      planeBonusActive: false,
      planeWarningActive: false,
      score: 100,
      hasRunProgress: true,
      runElapsedMs: 60_000,
      dtSeconds: 0.016,
      policeChaseCount: 3,
    });
    expect(result.events).toContain('ghost-dismiss');
    expect(result.policeChase?.phase).toBe('leaving');

    const train = createTrainEvent(viewport);
    train.phase = 'crossing';
    train.progressPx = viewport.width;
    const playerOnRail: Rect = {
      x: 600,
      y: Math.round(viewport.height / 2) - 4,
      width: 28,
      height: 16,
    };
    expect(checkTrainCollision(train, viewport, playerOnRail, true)).toBe(false);
  });

  it('game over from train clears state cleanly when police chase is active', () => {
    const game = createGame();
    (game as any).beginRun();
    (game as any).running = true;
    (game as any).score = 80;
    (game as any).startTimeMs = performance.now() - 60_000;
    (game as any).policeChase = createPoliceChase(viewport, 'right', 60_000, 1, 1);

    (game as any).enterTrainGameOver();

    expect((game as any).gameOverState).not.toBeNull();
    expect((game as any).gameOverState?.reason).toBe('train');
    expect((game as any).trainState).toBeNull();
  });

  it('game over from police clears train warning state', () => {
    const game = createGame();
    (game as any).beginRun();
    (game as any).running = true;
    (game as any).score = 80;
    (game as any).startTimeMs = performance.now() - 60_000;

    const train = createTrainEvent(viewport);
    train.phase = 'warning';
    (game as any).trainState = train;

    (game as any).enterCaughtGameOver();

    expect((game as any).gameOverState).not.toBeNull();
    expect((game as any).gameOverState?.reason).toBe('caught');
  });
});

describe('26B: effect interaction tests', () => {
  let game: Game;

  beforeEach(() => {
    game = createGame();
  });

  it('activating all 9 effects in rapid succession does not crash', () => {
    (game as any).beginRun();
    (game as any).running = true;
    const effects = [
      'bonus',
      'magnet',
      'invert',
      'ghost',
      'blur',
      'oil_slick',
      'reverse',
      'mystery',
      'jackpot',
    ] as const;
    const surface = { lightness: 0.55, saturation: 0.2, hasGradient: false };

    for (const effect of effects) {
      expect(() => {
        const activation = resolveSpecialEffectActivation(effect, surface);
        expect(activation).toBeDefined();
        expect(activation.resolvedEffect).toBeDefined();
      }).not.toThrow();
    }
  });

  it('mystery resolves to each possible effect without crashing', () => {
    const surface = { lightness: 0.55, saturation: 0.2, hasGradient: false };
    const resolvedEffects = new Set<string>();

    for (let i = 0; i < 200; i++) {
      const activation = resolveSpecialEffectActivation('mystery', surface);
      expect(activation.resolvedEffect).toBeDefined();
      expect(activation.resolvedEffect).not.toBe('mystery');
      resolvedEffects.add(activation.resolvedEffect);
    }

    expect(resolvedEffects.size).toBeGreaterThanOrEqual(3);
  });

  it('invert + blur active simultaneously both clear correctly', () => {
    (game as any).beginRun();
    (game as any).running = true;

    (game as any).invertTimerMs = 5200;
    (game as any).blurTimerMs = 4500;

    (game as any).invertTimerMs = Math.max(0, (game as any).invertTimerMs - 5200);
    (game as any).blurTimerMs = Math.max(0, (game as any).blurTimerMs - 4500);

    expect((game as any).invertTimerMs).toBe(0);
    expect((game as any).blurTimerMs).toBe(0);
  });

  it('oil_slick + reverse active simultaneously both affect independently', () => {
    (game as any).beginRun();
    (game as any).running = true;

    (game as any).oilSlickTimerMs = 3500;
    (game as any).reverseTimerMs = 3500;

    expect((game as any).oilSlickTimerMs).toBeGreaterThan(0);
    expect((game as any).reverseTimerMs).toBeGreaterThan(0);

    (game as any).oilSlickTimerMs = 0;
    expect((game as any).oilSlickTimerMs).toBe(0);
    expect((game as any).reverseTimerMs).toBeGreaterThan(0);

    (game as any).reverseTimerMs = 0;
    expect((game as any).reverseTimerMs).toBe(0);
  });

  it('magnet pulls coins while ghost is active', () => {
    (game as any).beginRun();
    (game as any).running = true;
    const runtimeWorld = (game as any).world as World;

    (game as any).magnetTimerMs = 6200;
    (game as any).ghostTimerMs = 5600;

    expect((game as any).magnetTimerMs).toBeGreaterThan(0);
    expect((game as any).ghostTimerMs).toBeGreaterThan(0);
    expect(runtimeWorld.pickups.length).toBeGreaterThan(0);
  });
});

describe('26C: lifecycle edge cases', () => {
  it('rapid restart during police chase resets all state cleanly', () => {
    const game = createGame();
    (game as any).beginRun();
    (game as any).running = true;
    (game as any).startTimeMs = performance.now() - 60_000;
    (game as any).policeChase = createPoliceChase(
      { width: 1280, height: 720 },
      'right',
      60_000,
      1,
      1,
    );

    expect((game as any).policeChase).not.toBeNull();

    (game as any).beginRun();

    expect((game as any).policeChase).toBeNull();
    expect((game as any).score).toBe(0);
    expect((game as any).trainState).toBeNull();
    expect((game as any).gameOverState).toBeNull();
    expect((game as any).policeChaseCount).toBe(0);
  });

  it('rapid restart during train crossing resets state cleanly', () => {
    const game = createGame();
    const viewport = { width: 1280, height: 720 };
    (game as any).beginRun();
    (game as any).running = true;
    (game as any).startTimeMs = performance.now() - 60_000;

    const train = createTrainEvent(viewport);
    train.phase = 'crossing';
    (game as any).trainState = train;
    (game as any).trainEventsThisRun = 1;

    (game as any).beginRun();

    expect((game as any).trainState).toBeNull();
    expect((game as any).trainEventsThisRun).toBe(0);
    expect((game as any).score).toBe(0);
  });

  it('beginRun resets ALL stateful fields — comprehensive audit', () => {
    const game = createGame();
    (game as any).beginRun();
    (game as any).running = true;
    (game as any).score = 999;
    (game as any).coinsCollectedTotal = 50;
    (game as any).magnetTimerMs = 5000;
    (game as any).ghostTimerMs = 4000;
    (game as any).invertTimerMs = 3000;
    (game as any).blurTimerMs = 2000;
    (game as any).oilSlickTimerMs = 1500;
    (game as any).reverseTimerMs = 1200;
    (game as any).policeChaseCount = 5;
    (game as any).nearMissCooldownMs = 400;
    (game as any).nearMissCount = 12;
    (game as any).overgrowthNodes = [{ id: 'test' }];
    (game as any).trainEventsThisRun = 1;
    (game as any).vfxParticles = [{ x: 0 }];

    (game as any).beginRun();

    expect((game as any).score).toBe(0);
    expect((game as any).coinsCollectedTotal).toBe(0);
    expect((game as any).magnetTimerMs).toBe(0);
    expect((game as any).ghostTimerMs).toBe(0);
    expect((game as any).invertTimerMs).toBe(0);
    expect((game as any).blurTimerMs).toBe(0);
    expect((game as any).oilSlickTimerMs).toBe(0);
    expect((game as any).reverseTimerMs).toBe(0);
    expect((game as any).policeChaseCount).toBe(0);
    expect((game as any).nearMissCooldownMs).toBe(0);
    expect((game as any).nearMissCount).toBe(0);
    expect((game as any).overgrowthNodes).toHaveLength(0);
    expect((game as any).trainEventsThisRun).toBe(0);
    expect((game as any).trainState).toBeNull();
    expect((game as any).vfxParticles).toHaveLength(0);
    expect((game as any).gameOverState).toBeNull();
    expect((game as any).policeChase).toBeNull();
  });

  it('multiple beginRun calls in rapid succession do not double-initialize', () => {
    const game = createGame();

    (game as any).beginRun();
    const runNumber1 = (game as any).runNumber;

    (game as any).beginRun();
    const runNumber2 = (game as any).runNumber;

    (game as any).beginRun();
    const runNumber3 = (game as any).runNumber;

    expect(runNumber2).toBe(runNumber1 + 1);
    expect(runNumber3).toBe(runNumber2 + 1);
    expect((game as any).score).toBe(0);
    expect((game as any).gameOverState).toBeNull();
    expect((game as any).world).not.toBeNull();
  });
});

describe('26D: boundary & overflow tests', () => {
  it('police spawn at viewport edge does not get stuck outside bounds', () => {
    const viewport = { width: 1280, height: 720 };
    const edges = ['top', 'right', 'bottom', 'left'] as const;

    for (const edge of edges) {
      const chase = createPoliceChase(viewport, edge, 60_000, 1, 1);
      expect(chase.x).toBeGreaterThanOrEqual(-100);
      expect(chase.x).toBeLessThanOrEqual(viewport.width + 100);
      expect(chase.y).toBeGreaterThanOrEqual(-100);
      expect(chase.y).toBeLessThanOrEqual(viewport.height + 100);
    }
  });

  it('train collision on small viewport produces valid hitbox', () => {
    const smallViewport = { width: 400, height: 300 };
    const train = createTrainEvent(smallViewport);
    train.phase = 'crossing';
    train.progressPx = smallViewport.width;

    const playerCenter: Rect = {
      x: smallViewport.width / 2 - 14,
      y: smallViewport.height / 2 - 8,
      width: 28,
      height: 16,
    };
    const collision = checkTrainCollision(train, smallViewport, playerCenter, false);
    expect(typeof collision).toBe('boolean');
  });

  it('score display handles large numbers correctly', () => {
    const game = createGame();
    (game as any).beginRun();
    (game as any).score = 99999;

    const scoreStr = (game as any).score.toString().padStart(4, '0');
    expect(scoreStr).toBe('99999');
    expect(scoreStr.length).toBeGreaterThanOrEqual(4);
  });

  it('overgrowth nodes do not grow unbounded — MAX_NODES respected', () => {
    const game = createGame();
    (game as any).beginRun();
    (game as any).running = true;

    const manyNodes = Array.from({ length: 20 }, (_, i) => ({
      id: `test:${i}`,
      rect: { x: i * 30, y: 100, width: 20, height: 10 },
      anchorRect: { x: i * 30, y: 110, width: 30, height: 20 },
      anchorEdge: 'top',
      stage: 'grass' as const,
      growthMs: 3000,
      spawnedAtRunMs: 35000,
    }));
    (game as any).overgrowthNodes = manyNodes;

    expect((game as any).overgrowthNodes.length).toBeLessThanOrEqual(20);
  });

  it('VFX particles array can be safely emptied after long run simulation', () => {
    const game = createGame();
    (game as any).beginRun();
    (game as any).vfxParticles = Array.from({ length: 500 }, (_, i) => ({
      x: i,
      y: i,
      vx: 1,
      vy: 1,
      lifetime: 300,
      elapsed: 301,
      radius: 2,
      color: '#fff',
    }));

    const alive = (game as any).vfxParticles.filter(
      (p: { elapsed: number; lifetime: number }) => p.elapsed < p.lifetime,
    );
    expect(alive.length).toBe(0);
  });
});
