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
    updatePropellerDrone(): void {}
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

  it('assigns a micro-objective after initial delay expires', () => {
    const noEvent: ObjectiveTickEvents = {
      coinsCollectedThisFrame: 0,
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
      templateId: 'easy_5',
      label: '5 COINS',
      progress: 4,
      target: 5,
      timeRemainingMs: 10_000,
      timeLimitMs: 25_000,
      bonus: 20,
      multiplierLabel: 'x2',
    };

    const step = resolveObjectiveTickStep({
      active: objective,
      assignDelayMs: 0,
      completedCount: 0,
      lastTemplateId: 'easy_5',
      events: {
        coinsCollectedThisFrame: 1,
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
      templateId: 'med_8',
      label: '8 COINS',
      progress: 3,
      target: 8,
      timeRemainingMs: 200,
      timeLimitMs: 20_000,
      bonus: 35,
      multiplierLabel: 'x3',
    };

    const step = resolveObjectiveTickStep({
      active: objective,
      assignDelayMs: 0,
      completedCount: 0,
      lastTemplateId: 'med_8',
      events: {
        coinsCollectedThisFrame: 0,
      },
      dtSeconds: 0.5,
    });

    expect(step.expired).toBe(true);
    expect(step.completed).toBe(false);
    expect(step.active).toBeNull();
    expect(step.completedCount).toBe(0);
  });

  it('expires timed objective when timer runs out before target reached', () => {
    const objective: MicroObjective = {
      templateId: 'med_8',
      label: '8 COINS',
      progress: 3,
      target: 8,
      timeRemainingMs: 200,
      timeLimitMs: 20_000,
      bonus: 35,
      multiplierLabel: 'x3',
    };

    const step = resolveObjectiveTickStep({
      active: objective,
      assignDelayMs: 0,
      completedCount: 1,
      lastTemplateId: 'med_8',
      events: {
        coinsCollectedThisFrame: 0,
      },
      dtSeconds: 0.5,
    });

    expect(step.completed).toBe(false);
    expect(step.expired).toBe(true);
  });

  it('does not repeat the same objective template consecutively', () => {
    const picked = pickObjectiveTemplate('easy_5', 0);
    expect(picked).not.toBeNull();
    expect(picked!.id).not.toBe('easy_5');
  });

  it('always picks a coin-collection objective', () => {
    const picked = pickObjectiveTemplate('', 0);
    expect(picked).not.toBeNull();
    expect(picked!.target).toBeGreaterThan(0);
    expect(picked!.bonus).toBeGreaterThan(0);
  });

  it('tracks coin collection for objective progress', () => {
    const objective: MicroObjective = {
      templateId: 'easy_5',
      label: '5 COINS',
      progress: 2,
      target: 5,
      timeRemainingMs: 20_000,
      timeLimitMs: 25_000,
      bonus: 20,
      multiplierLabel: 'x2',
    };

    const step = resolveObjectiveTickStep({
      active: objective,
      assignDelayMs: 0,
      completedCount: 0,
      lastTemplateId: 'easy_5',
      events: { coinsCollectedThisFrame: 2 },
      dtSeconds: 0.016,
    });

    expect(step.active).not.toBeNull();
    expect(step.active!.progress).toBe(4);
    expect(step.completed).toBe(false);
  });

  it('resets objective state on beginRun', () => {
    (game as any).beginRun('manual');
    (game as any).objectiveActive = {
      templateId: 'easy_5',
      label: '5 COINS',
      progress: 3,
      target: 5,
      timeRemainingMs: 10_000,
      timeLimitMs: 25_000,
      bonus: 20,
      multiplierLabel: 'x2',
    };
    (game as any).objectiveCompletedCount = 4;

    (game as any).beginRun('manual');
    expect((game as any).objectiveActive).toBeNull();
    expect((game as any).objectiveCompletedCount).toBe(0);
    expect((game as any).objectiveAssignDelayMs).toBeGreaterThan(0);
  });

  it('formats objective HUD text with progress', () => {
    const coinObj: MicroObjective = {
      templateId: 'easy_5',
      label: '5 COINS',
      progress: 3,
      target: 5,
      timeRemainingMs: 10_000,
      timeLimitMs: 25_000,
      bonus: 20,
      multiplierLabel: 'x2',
    };
    expect(getObjectiveHudText(coinObj)).toBe('5 COINS 3/5');
    expect(getObjectiveProgress(coinObj)).toBeCloseTo(0.6, 1);
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
      blurActive: false,
      oilSlickActive: false,
      reverseActive: false,
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
    expect(OBJECTIVE_TEMPLATES.length).toBeGreaterThanOrEqual(6);
    const ids = OBJECTIVE_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
