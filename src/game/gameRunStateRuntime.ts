import type { WorldPickup } from '../shared/types';
import type {
  GameOverState,
  PlaneBonusEventState,
  PlaneCoinTrailState,
  PlaneWarningState,
  PoliceChaseState,
  PoliceWarningState,
  SpecialSpawnCue,
} from './gameStateTypes';
import {
  PLANE_EVENT_INITIAL_MAX_MS,
  PLANE_EVENT_INITIAL_MIN_MS,
  POLICE_INITIAL_SPAWN_MAX_MS,
  POLICE_INITIAL_SPAWN_MIN_MS,
  SPECIAL_INITIAL_SPAWN_MAX_MS,
  SPECIAL_INITIAL_SPAWN_MIN_MS,
  randomBetween,
} from './gameRuntime';

export interface ClearedEncounterState {
  policeChase: PoliceChaseState | null;
  policeWarning: PoliceWarningState | null;
  planeWarning: PlaneWarningState | null;
  specialSpawnCues: SpecialSpawnCue[];
  planeBonusEvent: PlaneBonusEventState | null;
  planeCoinTrail: PlaneCoinTrailState | null;
}

export interface ClearedEffectState {
  magnetTimerMs: number;
  ghostTimerMs: number;
  invertTimerMs: number;
  blackoutTimerMs: number;
  lureTimerMs: number;
}

export interface ClearedComboState {
  pickupComboCount: number;
  comboTimerMs: number;
}

export interface BeginRunState
  extends ClearedEncounterState, ClearedEffectState, ClearedComboState {
  dynamicPickups: WorldPickup[];
  coinSpawnQueue: WorldPickup[];
  coinSpawnIdCounter: number;
  coinRefillTimerMs: number;
  coinRefillBoostTimerMs: number;
  score: number;
  coinsCollectedTotal: number;
  specialSpawnTimerMs: number;
  planeBonusTimerMs: number;
  policeSpawnTimerMs: number;
  gameOverState: GameOverState | null;
  spriteShowcaseActive: boolean;
  startTimeMs: number;
  lastFrameMs: number;
}

export interface CaughtGameOverTransitionState
  extends ClearedEncounterState, ClearedEffectState, ClearedComboState {
  gameOverState: GameOverState;
  spriteShowcaseActive: boolean;
  startTimeMs: number;
}

export interface SpriteShowcaseTransitionState
  extends ClearedEncounterState, ClearedEffectState, ClearedComboState {
  spriteShowcaseActive: boolean;
}

export interface FocusPauseTransitionState {
  paused: boolean;
  pausedStartedAtMs: number;
  lastFrameMs: number;
  transition: 'none' | 'enter' | 'exit';
}

export function createClearedEncounterState(): ClearedEncounterState {
  return {
    policeChase: null,
    policeWarning: null,
    planeWarning: null,
    specialSpawnCues: [],
    planeBonusEvent: null,
    planeCoinTrail: null,
  };
}

export function createClearedEffectState(): ClearedEffectState {
  return {
    magnetTimerMs: 0,
    ghostTimerMs: 0,
    invertTimerMs: 0,
    blackoutTimerMs: 0,
    lureTimerMs: 0,
  };
}

export function createClearedComboState(): ClearedComboState {
  return {
    pickupComboCount: 0,
    comboTimerMs: 0,
  };
}

export function createBeginRunState(nowMs: number): BeginRunState {
  return {
    ...createClearedEncounterState(),
    ...createClearedEffectState(),
    ...createClearedComboState(),
    dynamicPickups: [],
    coinSpawnQueue: [],
    coinSpawnIdCounter: 0,
    coinRefillTimerMs: 0,
    coinRefillBoostTimerMs: 0,
    score: 0,
    coinsCollectedTotal: 0,
    specialSpawnTimerMs: randomBetween(SPECIAL_INITIAL_SPAWN_MIN_MS, SPECIAL_INITIAL_SPAWN_MAX_MS),
    planeBonusTimerMs: randomBetween(PLANE_EVENT_INITIAL_MIN_MS, PLANE_EVENT_INITIAL_MAX_MS),
    policeSpawnTimerMs: randomBetween(POLICE_INITIAL_SPAWN_MIN_MS, POLICE_INITIAL_SPAWN_MAX_MS),
    gameOverState: null,
    spriteShowcaseActive: false,
    startTimeMs: nowMs,
    lastFrameMs: 0,
  };
}

export function createCaughtGameOverTransitionState(nowMs: number): CaughtGameOverTransitionState {
  return {
    ...createClearedEncounterState(),
    ...createClearedEffectState(),
    ...createClearedComboState(),
    gameOverState: {
      reason: 'caught',
      startedAtMs: nowMs,
    },
    spriteShowcaseActive: false,
    startTimeMs: 0,
  };
}

export function createSpriteShowcaseTransitionState(): SpriteShowcaseTransitionState {
  return {
    ...createClearedEncounterState(),
    ...createClearedEffectState(),
    ...createClearedComboState(),
    spriteShowcaseActive: true,
  };
}

export function shouldPauseForPageFocus(
  visibilityState: DocumentVisibilityState,
  hasFocus: boolean,
): boolean {
  return visibilityState !== 'visible' || !hasFocus;
}

export function resolveFocusPauseTransitionState(options: {
  paused: boolean;
  pausedStartedAtMs: number;
  lastFrameMs: number;
  shouldPause: boolean;
  nowMs: number;
}): FocusPauseTransitionState {
  if (options.shouldPause) {
    if (options.paused) {
      return {
        paused: true,
        pausedStartedAtMs: options.pausedStartedAtMs,
        lastFrameMs: options.lastFrameMs,
        transition: 'none',
      };
    }

    return {
      paused: true,
      pausedStartedAtMs: options.nowMs,
      lastFrameMs: options.lastFrameMs,
      transition: 'enter',
    };
  }

  if (!options.paused) {
    return {
      paused: false,
      pausedStartedAtMs: options.pausedStartedAtMs,
      lastFrameMs: options.lastFrameMs,
      transition: 'none',
    };
  }

  return {
    paused: false,
    pausedStartedAtMs: options.pausedStartedAtMs,
    lastFrameMs: options.nowMs,
    transition: 'exit',
  };
}
