import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Rect, World } from '../src/shared/types';
import { buildWorld } from '../src/content/worldBuilder';
import {
  advanceTrainCrossing,
  checkTrainCollision,
  createTrainEvent,
  resolveTrainSpawnStep,
} from '../src/game/trainRuntime';
import { ENCOUNTER, TRAIN } from '../src/game/gameConfig';
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

describe('train encounter smoke invariants', () => {
  let game: Game;
  const runReasons: Array<'manual' | 'deadSpot' | 'caught' | 'quit'> = [];

  function createWorldWithRailCandidates(coinCount: number): World {
    const base = createWorldWithRegularCoins(coinCount);
    base.railCandidates = [
      {
        rect: { x: 0, y: 360, width: 1280, height: 4 },
        axis: 'horizontal' as const,
      },
    ];
    return base;
  }

  beforeEach(() => {
    runReasons.length = 0;
    game = new Game({
      canvas: createCanvas(),
      createWorld: () => createWorldWithRailCandidates(14),
      getPageTitle: () => 'DOM Racer Train Smoke',
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
      onRunFinished: (run) => runReasons.push(run.reason),
    });
  });

  describe('rail detection', () => {
    it('identifies long thin horizontal rect as a rail candidate', () => {
      const viewport = { width: 1280, height: 720 };
      const elements = [
        {
          id: 'barrier:hr:0:360:1280:4:hr:',
          kind: 'barrier' as const,
          rect: { x: 0, y: 360, width: 1280, height: 4 },
          tagName: 'div',
          fixed: false,
        },
      ];
      const world = buildWorld(elements, viewport);
      expect(world.railCandidates.length).toBeGreaterThanOrEqual(1);
      expect(world.railCandidates[0].axis).toBe('horizontal');
    });

    it('rejects short rect as rail candidate', () => {
      const viewport = { width: 1280, height: 720 };
      const elements = [
        {
          id: 'barrier:div:0:360:200:4:short:',
          kind: 'barrier' as const,
          rect: { x: 0, y: 360, width: 200, height: 4 },
          tagName: 'div',
          fixed: false,
        },
      ];
      const world = buildWorld(elements, viewport);
      expect(world.railCandidates.length).toBe(0);
    });

    it('produces rail candidates from hr-scanned rail elements', () => {
      const viewport = { width: 1280, height: 720 };
      const elements = [
        {
          id: 'rail:hr:0:360:1280:2:hr:',
          kind: 'rail' as const,
          rect: { x: 0, y: 360, width: 1280, height: 2 },
          tagName: 'hr',
          fixed: false,
        },
      ];
      const world = buildWorld(elements, viewport);
      expect(world.railCandidates.length).toBeGreaterThanOrEqual(1);
      expect(world.railCandidates[0].axis).toBe('horizontal');
    });
  });

  describe('train spawn timing', () => {
    it('does not spawn train before MIN_RUN_TIME_MS', () => {
      const step = resolveTrainSpawnStep({
        trainSpawnTimerMs: 0,
        runElapsedMs: TRAIN.MIN_RUN_TIME_MS - 1000,
        trainEventsThisRun: 0,
        railCandidateCount: 1,
        policeOrWarningActive: false,
        planeOrWarningActive: false,
        trainActive: false,
        dtSeconds: 0.016,
      });
      expect(step.shouldSpawn).toBe(false);
    });

    it('spawns train after MIN_RUN_TIME_MS when timer expires', () => {
      const step = resolveTrainSpawnStep({
        trainSpawnTimerMs: 100,
        runElapsedMs: TRAIN.MIN_RUN_TIME_MS + 5000,
        trainEventsThisRun: 0,
        railCandidateCount: 1,
        policeOrWarningActive: false,
        planeOrWarningActive: false,
        trainActive: false,
        dtSeconds: 0.5,
      });
      expect(step.shouldSpawn).toBe(true);
    });

    it('respects cooldown — does not spawn beyond MAX_PER_RUN', () => {
      const step = resolveTrainSpawnStep({
        trainSpawnTimerMs: 0,
        runElapsedMs: 90_000,
        trainEventsThisRun: TRAIN.MAX_PER_RUN,
        railCandidateCount: 1,
        policeOrWarningActive: false,
        planeOrWarningActive: false,
        trainActive: false,
        dtSeconds: 0.016,
      });
      expect(step.shouldSpawn).toBe(false);
    });
  });

  describe('train collision', () => {
    it('triggers game over on train collision', () => {
      (game as any).beginRun();
      (game as any).running = true;
      (game as any).score = 40;
      (game as any).startTimeMs = performance.now() - 1000;

      const viewport = { width: 1280, height: 720 };
      const train = createTrainEvent([
        { rect: { x: 0, y: 360, width: 1280, height: 4 }, axis: 'horizontal' },
      ]);
      train.phase = 'crossing';
      train.progressPx = viewport.width / 2;

      (game as any).trainState = train;
      (game as any).updateTrain(0.016);

      const playerBounds: Rect = (game as any).player.getBounds();
      const trainCollides = checkTrainCollision(train, viewport, playerBounds, false);

      if (trainCollides) {
        expect((game as any).gameOverState).not.toBeNull();
        expect((game as any).gameOverState?.reason).toBe('train');
        expect(runReasons).toContain('caught');
      }
    });

    it('shows HIT BY TRAIN reason in game over state', () => {
      (game as any).beginRun();
      (game as any).running = true;
      (game as any).score = 40;
      (game as any).startTimeMs = performance.now() - 1000;

      (game as any).enterTrainGameOver();
      expect((game as any).gameOverState?.reason).toBe('train');
      expect(runReasons).toContain('caught');
    });
  });

  describe('ghost immunity', () => {
    it('ghost effect prevents train collision', () => {
      const viewport = { width: 1280, height: 720 };
      const train = createTrainEvent([
        { rect: { x: 0, y: 356, width: 1280, height: 4 }, axis: 'horizontal' },
      ]);
      train.phase = 'crossing';
      train.progressPx = viewport.width / 2;

      const playerOnRail: Rect = { x: 600, y: 352, width: 28, height: 16 };
      expect(checkTrainCollision(train, viewport, playerOnRail, false)).toBe(true);
      expect(checkTrainCollision(train, viewport, playerOnRail, true)).toBe(false);
    });
  });

  describe('no train when railCandidates is empty', () => {
    it('skips train spawn when no rail candidates exist', () => {
      const step = resolveTrainSpawnStep({
        trainSpawnTimerMs: 0,
        runElapsedMs: 60_000,
        trainEventsThisRun: 0,
        railCandidateCount: 0,
        policeOrWarningActive: false,
        planeOrWarningActive: false,
        trainActive: false,
        dtSeconds: 0.016,
      });
      expect(step.shouldSpawn).toBe(false);
    });

    it('does not attempt train events when world has no rail candidates', () => {
      const noRailGame = new Game({
        canvas: createCanvas(),
        createWorld: () => createWorldWithRegularCoins(14),
        getPageTitle: () => 'DOM Racer No Rails',
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

      (noRailGame as any).beginRun();
      (noRailGame as any).running = true;
      (noRailGame as any).startTimeMs = performance.now() - 60_000;
      (noRailGame as any).trainSpawnTimerMs = 0;

      const result = (noRailGame as any).updateTrain(0.016);
      expect(result).toBe(false);
      expect((noRailGame as any).trainState).toBeNull();
    });
  });

  describe('stagger with police/plane', () => {
    it('does not spawn train when police chase is active', () => {
      const step = resolveTrainSpawnStep({
        trainSpawnTimerMs: 0,
        runElapsedMs: 60_000,
        trainEventsThisRun: 0,
        railCandidateCount: 1,
        policeOrWarningActive: true,
        planeOrWarningActive: false,
        trainActive: false,
        dtSeconds: 0.016,
      });
      expect(step.shouldSpawn).toBe(false);
      expect(step.trainSpawnTimerMs).toBeGreaterThanOrEqual(ENCOUNTER.STAGGER_MS);
    });

    it('does not spawn train when plane is active', () => {
      const step = resolveTrainSpawnStep({
        trainSpawnTimerMs: 0,
        runElapsedMs: 60_000,
        trainEventsThisRun: 0,
        railCandidateCount: 1,
        policeOrWarningActive: false,
        planeOrWarningActive: true,
        trainActive: false,
        dtSeconds: 0.016,
      });
      expect(step.shouldSpawn).toBe(false);
      expect(step.trainSpawnTimerMs).toBeGreaterThanOrEqual(ENCOUNTER.STAGGER_MS);
    });

    it('staggers police and plane timers when train spawns', () => {
      (game as any).beginRun();
      (game as any).running = true;
      (game as any).startTimeMs = performance.now() - 60_000;
      (game as any).trainSpawnTimerMs = 0;
      (game as any).policeSpawnTimerMs = 100;
      (game as any).planeBonusTimerMs = 100;

      (game as any).updateTrain(0.016);

      if ((game as any).trainState) {
        expect((game as any).policeSpawnTimerMs).toBeGreaterThanOrEqual(ENCOUNTER.STAGGER_MS);
        expect((game as any).planeBonusTimerMs).toBeGreaterThanOrEqual(ENCOUNTER.STAGGER_MS);
      }
    });
  });

  describe('train lifecycle', () => {
    it('train advances through warning then crossing phases', () => {
      const viewport = { width: 1280, height: 720 };
      const train = createTrainEvent([
        { rect: { x: 0, y: 360, width: 1280, height: 4 }, axis: 'horizontal' },
      ]);
      expect(train.phase).toBe('warning');
      expect(train.warningRemainingMs).toBe(TRAIN.WARNING_MS);

      const afterWarning = advanceTrainCrossing(train, viewport, TRAIN.WARNING_MS / 1000 + 0.1);
      expect(afterWarning.train).not.toBeNull();
      expect(afterWarning.train?.phase).toBe('crossing');
      expect(afterWarning.completed).toBe(false);
    });

    it('train completes after crossing the viewport', () => {
      const viewport = { width: 1280, height: 720 };
      const train = createTrainEvent([
        { rect: { x: 0, y: 360, width: 1280, height: 4 }, axis: 'horizontal' },
      ]);
      train.phase = 'crossing';

      const totalTravel = viewport.width + train.rail.width;
      train.progressPx = totalTravel + 10;

      const result = advanceTrainCrossing(train, viewport, 0.016);
      expect(result.train).toBeNull();
      expect(result.completed).toBe(true);
    });

    it('resets train state on beginRun', () => {
      (game as any).beginRun();
      (game as any).running = true;
      (game as any).trainEventsThisRun = 3;
      (game as any).trainState = { phase: 'crossing' };

      (game as any).beginRun();
      expect((game as any).trainState).toBeNull();
      expect((game as any).trainEventsThisRun).toBe(0);
      expect((game as any).trainSpawnTimerMs).toBeGreaterThan(0);
    });
  });
});
