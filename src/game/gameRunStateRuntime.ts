import type { WorldPickup } from '../shared/types';
import type {
  GameOverState,
  PlaneBonusEventState,
  PlaneBoostLaneState,
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
  planeBoostLane: PlaneBoostLaneState | null;
}

export interface ClearedEffectState {
  magnetTimerMs: number;
  ghostTimerMs: number;
  invertTimerMs: number;
  blackoutTimerMs: number;
}

export interface ClearedComboState {
  pickupComboCount: number;
  comboTimerMs: number;
}

export interface BeginRunState extends ClearedEncounterState, ClearedEffectState, ClearedComboState {
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
  extends ClearedEncounterState,
    ClearedEffectState,
    ClearedComboState {
  gameOverState: GameOverState;
  spriteShowcaseActive: boolean;
  startTimeMs: number;
}

export interface SpriteShowcaseTransitionState
  extends ClearedEncounterState,
    ClearedEffectState,
    ClearedComboState {
  spriteShowcaseActive: boolean;
}

export function createClearedEncounterState(): ClearedEncounterState {
  return {
    policeChase: null,
    policeWarning: null,
    planeWarning: null,
    specialSpawnCues: [],
    planeBonusEvent: null,
    planeBoostLane: null,
  };
}

export function createClearedEffectState(): ClearedEffectState {
  return {
    magnetTimerMs: 0,
    ghostTimerMs: 0,
    invertTimerMs: 0,
    blackoutTimerMs: 0,
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
