import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createInitialObjectiveState,
  getObjectiveCompletionWord,
  getObjectiveHudText,
  getObjectiveProgress,
  OBJECTIVE_TEMPLATES,
  pickObjectiveTemplate,
  resolveObjectiveTickStep,
  type MicroObjective,
  type ObjectiveTickEvents,
} from '../src/game/microObjectiveRuntime';
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

describe('micro-objective smoke invariants', () => {
  let game: Game;

  beforeEach(() => {
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
    });
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
    expect(getObjectiveHudText(surviveObj)).toBe('SURVIVE 20S');
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
});
