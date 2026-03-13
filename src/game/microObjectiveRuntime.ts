import { OBJECTIVES } from './gameConfig';
import { randomBetween } from './gameRuntime';

export type ObjectiveTracker =
  | 'coins_collected'
  | 'specials_collected'
  | 'near_misses'
  | 'score_threshold'
  | 'combo_threshold';

export interface ObjectiveTemplate {
  id: string;
  label: string;
  target: number;
  timeLimitMs: number;
  tracker: ObjectiveTracker;
}

export interface MicroObjective {
  templateId: string;
  label: string;
  progress: number;
  target: number;
  timeRemainingMs: number;
  timeLimitMs: number;
  tracker: ObjectiveTracker;
}

export interface ObjectiveTickEvents {
  coinsCollectedThisFrame: number;
  specialsCollectedThisFrame: number;
  nearMissTriggeredThisFrame: boolean;
  currentScore: number;
  currentComboCount: number;
}

export interface ObjectiveTickResult {
  active: MicroObjective | null;
  assignDelayMs: number;
  completedCount: number;
  lastTemplateId: string;
  completed: boolean;
  expired: boolean;
}

export const OBJECTIVE_SCORE_BONUS = OBJECTIVES.SCORE_BONUS;
export const OBJECTIVE_INITIAL_DELAY_MIN_MS = OBJECTIVES.INITIAL_DELAY_MIN_MS;
export const OBJECTIVE_INITIAL_DELAY_MAX_MS = OBJECTIVES.INITIAL_DELAY_MAX_MS;
export const OBJECTIVE_COMPLETE_DELAY_MIN_MS = OBJECTIVES.COMPLETE_DELAY_MIN_MS;
export const OBJECTIVE_COMPLETE_DELAY_MAX_MS = OBJECTIVES.COMPLETE_DELAY_MAX_MS;
export const OBJECTIVE_EXPIRE_DELAY_MIN_MS = OBJECTIVES.EXPIRE_DELAY_MIN_MS;
export const OBJECTIVE_EXPIRE_DELAY_MAX_MS = OBJECTIVES.EXPIRE_DELAY_MAX_MS;

const OBJECTIVE_COMPLETION_WORDS = ['NAILED!', 'DONE!', 'CLEAR!', 'CHECK!'] as const;
export const OBJECTIVE_COMPLETION_COLOR = OBJECTIVES.COMPLETION_COLOR;
export const OBJECTIVE_TOAST_TTL_MS = OBJECTIVES.TOAST_TTL_MS;

export const OBJECTIVE_TEMPLATES: readonly ObjectiveTemplate[] = [
  { id: 'collect_5', label: '5 COINS', target: 5, timeLimitMs: 25_000, tracker: 'coins_collected' },
  {
    id: 'collect_8',
    label: '8 COINS',
    target: 8,
    timeLimitMs: 20_000,
    tracker: 'coins_collected',
  },
  {
    id: 'score_80',
    label: 'REACH 80',
    target: 80,
    timeLimitMs: 35_000,
    tracker: 'score_threshold',
  },
  {
    id: 'near_3',
    label: '3 NEAR-MISS',
    target: 3,
    timeLimitMs: 25_000,
    tracker: 'near_misses',
  },
  {
    id: 'grab_special',
    label: 'GRAB SPECIAL',
    target: 1,
    timeLimitMs: 30_000,
    tracker: 'specials_collected',
  },
  {
    id: 'flow_x5',
    label: 'FLOW X5',
    target: 5,
    timeLimitMs: 30_000,
    tracker: 'combo_threshold',
  },
  {
    id: 'collect_12',
    label: '12 COINS',
    target: 12,
    timeLimitMs: 30_000,
    tracker: 'coins_collected',
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
        expired: true,
      };
    }

    return {
      active: updated,
      assignDelayMs: options.assignDelayMs,
      completedCount: options.completedCount,
      lastTemplateId: options.lastTemplateId,
      completed: false,
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
      expired: false,
    };
  }

  const template = pickObjectiveTemplate(options.lastTemplateId, options.events.currentScore);
  if (!template) {
    return {
      active: null,
      assignDelayMs: randomBetween(OBJECTIVE_EXPIRE_DELAY_MIN_MS, OBJECTIVE_EXPIRE_DELAY_MAX_MS),
      completedCount: options.completedCount,
      lastTemplateId: options.lastTemplateId,
      completed: false,
      expired: false,
    };
  }

  return {
    active: createObjectiveFromTemplate(template),
    assignDelayMs: 0,
    completedCount: options.completedCount,
    lastTemplateId: template.id,
    completed: false,
    expired: false,
  };
}

function advanceObjectiveProgress(
  objective: MicroObjective,
  events: ObjectiveTickEvents,
  dtSeconds: number,
): MicroObjective {
  let nextProgress = objective.progress;
  let nextTimeRemaining = objective.timeRemainingMs;

  if (objective.timeLimitMs > 0) {
    nextTimeRemaining = Math.max(0, objective.timeRemainingMs - dtSeconds * 1000);
  }

  switch (objective.tracker) {
    case 'coins_collected':
      nextProgress += events.coinsCollectedThisFrame;
      break;
    case 'specials_collected':
      nextProgress += events.specialsCollectedThisFrame;
      break;
    case 'near_misses':
      nextProgress += events.nearMissTriggeredThisFrame ? 1 : 0;
      break;
    case 'score_threshold':
      nextProgress = events.currentScore;
      break;
    case 'combo_threshold':
      nextProgress = Math.max(nextProgress, events.currentComboCount);
      break;
  }

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
    tracker: template.tracker,
  };
}

export function pickObjectiveTemplate(
  lastTemplateId: string,
  currentScore: number,
): ObjectiveTemplate | null {
  const eligible = OBJECTIVE_TEMPLATES.filter((t) => {
    if (t.id === lastTemplateId) return false;
    if (t.tracker === 'score_threshold' && currentScore >= t.target * 0.8) return false;
    return true;
  });

  if (eligible.length === 0) return null;
  return eligible[Math.floor(Math.random() * eligible.length)];
}

export function getObjectiveCompletionWord(completedCount: number): string {
  return OBJECTIVE_COMPLETION_WORDS[completedCount % OBJECTIVE_COMPLETION_WORDS.length];
}

export function getObjectiveHudText(objective: MicroObjective): string {
  const progress = Math.min(objective.progress, objective.target);
  return `${objective.label} ${progress}/${objective.target}`;
}

export function getObjectiveProgress(objective: MicroObjective): number {
  return Math.min(1, objective.progress / Math.max(1, objective.target));
}
