import { OBJECTIVES } from './gameConfig';
import { randomBetween } from './gameRuntime';

export interface ObjectiveTemplate {
  id: string;
  label: string;
  target: number;
  timeLimitMs: number;
  bonus: number;
  multiplierLabel: string;
}

export interface MicroObjective {
  templateId: string;
  label: string;
  progress: number;
  target: number;
  timeRemainingMs: number;
  timeLimitMs: number;
  bonus: number;
  multiplierLabel: string;
}

export interface ObjectiveTickEvents {
  coinsCollectedThisFrame: number;
}

export interface ObjectiveTickResult {
  active: MicroObjective | null;
  assignDelayMs: number;
  completedCount: number;
  lastTemplateId: string;
  completed: boolean;
  completedBonus: number;
  completedMultiplier: string;
  expired: boolean;
}

export const OBJECTIVE_INITIAL_DELAY_MIN_MS = OBJECTIVES.INITIAL_DELAY_MIN_MS;
export const OBJECTIVE_INITIAL_DELAY_MAX_MS = OBJECTIVES.INITIAL_DELAY_MAX_MS;
export const OBJECTIVE_COMPLETE_DELAY_MIN_MS = OBJECTIVES.COMPLETE_DELAY_MIN_MS;
export const OBJECTIVE_COMPLETE_DELAY_MAX_MS = OBJECTIVES.COMPLETE_DELAY_MAX_MS;
export const OBJECTIVE_EXPIRE_DELAY_MIN_MS = OBJECTIVES.EXPIRE_DELAY_MIN_MS;
export const OBJECTIVE_EXPIRE_DELAY_MAX_MS = OBJECTIVES.EXPIRE_DELAY_MAX_MS;

export const OBJECTIVE_COMPLETION_COLOR = OBJECTIVES.COMPLETION_COLOR;
export const OBJECTIVE_TOAST_TTL_MS = OBJECTIVES.TOAST_TTL_MS;

export const OBJECTIVE_TEMPLATES: readonly ObjectiveTemplate[] = [
  {
    id: 'easy_5',
    label: '5 COINS',
    target: 5,
    timeLimitMs: 25_000,
    bonus: 20,
    multiplierLabel: 'x2',
  },
  {
    id: 'easy_4',
    label: '4 COINS',
    target: 4,
    timeLimitMs: 18_000,
    bonus: 20,
    multiplierLabel: 'x2',
  },
  {
    id: 'med_8',
    label: '8 COINS',
    target: 8,
    timeLimitMs: 20_000,
    bonus: 30,
    multiplierLabel: 'x3',
  },
  {
    id: 'med_6',
    label: '6 COINS',
    target: 6,
    timeLimitMs: 14_000,
    bonus: 30,
    multiplierLabel: 'x3',
  },
  {
    id: 'hard_12',
    label: '12 COINS',
    target: 12,
    timeLimitMs: 18_000,
    bonus: 40,
    multiplierLabel: 'x4',
  },
  {
    id: 'hard_10',
    label: '10 COINS',
    target: 10,
    timeLimitMs: 12_000,
    bonus: 40,
    multiplierLabel: 'x4',
  },
];

/** Creates the initial objective state with a randomized first-assignment delay. */
export function createInitialObjectiveState(): {
  assignDelayMs: number;
  completedCount: number;
  lastTemplateId: string;
} {
  return {
    assignDelayMs: randomBetween(OBJECTIVE_INITIAL_DELAY_MIN_MS, OBJECTIVE_INITIAL_DELAY_MAX_MS),
    completedCount: 0,
    lastTemplateId: '',
  };
}

/** Advances the active micro-objective or assigns a new one when the delay expires. */
export function resolveObjectiveTickStep(options: {
  active: MicroObjective | null;
  assignDelayMs: number;
  completedCount: number;
  lastTemplateId: string;
  events: ObjectiveTickEvents;
  dtSeconds: number;
}): ObjectiveTickResult {
  if (options.active) {
    const updated = advanceObjectiveProgress(options.active, options.events, options.dtSeconds);

    if (isObjectiveCompleted(updated)) {
      return {
        active: null,
        assignDelayMs: randomBetween(
          OBJECTIVE_COMPLETE_DELAY_MIN_MS,
          OBJECTIVE_COMPLETE_DELAY_MAX_MS,
        ),
        completedCount: options.completedCount + 1,
        lastTemplateId: options.lastTemplateId,
        completed: true,
        completedBonus: options.active!.bonus,
        completedMultiplier: options.active!.multiplierLabel,
        expired: false,
      };
    }

    if (updated.timeLimitMs > 0 && updated.timeRemainingMs <= 0) {
      return {
        active: null,
        assignDelayMs: randomBetween(OBJECTIVE_EXPIRE_DELAY_MIN_MS, OBJECTIVE_EXPIRE_DELAY_MAX_MS),
        completedCount: options.completedCount,
        lastTemplateId: options.lastTemplateId,
        completed: false,
        completedBonus: 0,
        completedMultiplier: '',
        expired: true,
      };
    }

    return {
      active: updated,
      assignDelayMs: options.assignDelayMs,
      completedCount: options.completedCount,
      lastTemplateId: options.lastTemplateId,
      completed: false,
      completedBonus: 0,
      completedMultiplier: '',
      expired: false,
    };
  }

  const nextDelayMs = Math.max(0, options.assignDelayMs - options.dtSeconds * 1000);
  if (nextDelayMs > 0) {
    return {
      active: null,
      assignDelayMs: nextDelayMs,
      completedCount: options.completedCount,
      lastTemplateId: options.lastTemplateId,
      completed: false,
      completedBonus: 0,
      completedMultiplier: '',
      expired: false,
    };
  }

  const template = pickObjectiveTemplate(options.lastTemplateId, 0);
  if (!template) {
    return {
      active: null,
      assignDelayMs: randomBetween(OBJECTIVE_EXPIRE_DELAY_MIN_MS, OBJECTIVE_EXPIRE_DELAY_MAX_MS),
      completedCount: options.completedCount,
      lastTemplateId: options.lastTemplateId,
      completed: false,
      completedBonus: 0,
      completedMultiplier: '',
      expired: false,
    };
  }

  return {
    active: createObjectiveFromTemplate(template),
    assignDelayMs: 0,
    completedCount: options.completedCount,
    lastTemplateId: template.id,
    completed: false,
    completedBonus: 0,
    completedMultiplier: '',
    expired: false,
  };
}

function advanceObjectiveProgress(
  objective: MicroObjective,
  events: ObjectiveTickEvents,
  dtSeconds: number,
): MicroObjective {
  const nextTimeRemaining = Math.max(0, objective.timeRemainingMs - dtSeconds * 1000);
  const nextProgress = objective.progress + events.coinsCollectedThisFrame;

  return {
    ...objective,
    progress: nextProgress,
    timeRemainingMs: nextTimeRemaining,
  };
}

function isObjectiveCompleted(objective: MicroObjective): boolean {
  return objective.progress >= objective.target;
}

function createObjectiveFromTemplate(template: ObjectiveTemplate): MicroObjective {
  return {
    templateId: template.id,
    label: template.label,
    progress: 0,
    target: template.target,
    timeRemainingMs: template.timeLimitMs,
    timeLimitMs: template.timeLimitMs,
    bonus: template.bonus,
    multiplierLabel: template.multiplierLabel,
  };
}

export function pickObjectiveTemplate(
  lastTemplateId: string,
  _currentScore: number,
): ObjectiveTemplate | null {
  const eligible = OBJECTIVE_TEMPLATES.filter((t) => t.id !== lastTemplateId);
  if (eligible.length === 0) return null;
  return eligible[Math.floor(Math.random() * eligible.length)];
}

export function getObjectiveHudText(objective: MicroObjective): string {
  const progress = Math.min(objective.progress, objective.target);
  return `${objective.label} ${progress}/${objective.target}`;
}

export function getObjectiveProgress(objective: MicroObjective): number {
  return Math.min(1, objective.progress / Math.max(1, objective.target));
}
