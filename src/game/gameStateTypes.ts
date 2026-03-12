import type {
  HudState,
  InputState,
  Rect,
  Vector2,
  VehicleDesign,
  World,
} from '../shared/types';
import type { SurfaceSample } from './gameRuntime';
import type { PoliceEdge } from './policeSprite';

export type ScrollDirection = 'up' | 'down';

export interface SpecialSpawnCue {
  x: number;
  y: number;
  label: string;
  color: string;
  ttlMs: number;
  durationMs: number;
}

export interface PlaneBonusEventState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  ttlMs: number;
  distancePx: number;
  traveledPx: number;
  dropAtPx: number;
  dropped: boolean;
  effectMode: 'bonus-drop' | 'boost-lane';
}

export interface PlaneBoostLaneState {
  rects: Rect[];
  ttlMs: number;
  durationMs: number;
}

export interface PoliceChaseState {
  x: number;
  y: number;
  angle: number;
  remainingMs: number;
  durationMs: number;
  phase: 'chasing' | 'leaving';
  exitEdge: PoliceEdge;
}

export interface PoliceWarningState {
  edge: PoliceEdge;
  remainingMs: number;
  durationMs: number;
}

export interface PlaneWarningState {
  edge: PoliceEdge;
  remainingMs: number;
  durationMs: number;
}

export interface GameOverState {
  reason: 'caught';
  startedAtMs: number;
}

export type GameDebugEvent =
  | {
      type: 'pickup';
      atMs: number;
      score: number;
      pickupId: string;
      x: number;
      y: number;
      value: number;
    }
  | {
      type: 'restart';
      atMs: number;
      reason: 'manual' | 'deadSpot' | 'caught';
      score: number;
    }
  | {
      type: 'collision';
      atMs: number;
      x: number;
      y: number;
      hitX: boolean;
      hitY: boolean;
      speed: number;
      scrollY: number;
    }
  | {
      type: 'scroll';
      atMs: number;
      direction: ScrollDirection;
      amount: number;
      scrollY: number;
    };

export interface GameDebugSnapshot {
  atMs: number;
  score: number;
  scrollY: number;
  player: Rect;
  pickupsRemaining: number;
  pickups: Array<{
    id: string;
    x: number;
    y: number;
    value: number;
  }>;
  obstacleCount: number;
  boostCount: number;
  airborne: boolean;
  boostActive: boolean;
  speed: number;
  hitX: boolean;
  hitY: boolean;
}

export interface GameOptions {
  canvas: HTMLCanvasElement;
  createWorld: () => World;
  getPageTitle: () => string;
  sampleSurfaceAt: (point: Vector2) => SurfaceSample;
  setPageInverted: (active: boolean) => void;
  setPageBlackout: (active: boolean) => void;
  setMagnetUiState: (state: { active: boolean; point: Vector2 | null; strength: number }) => void;
  onQuit: () => void;
  initialSoundEnabled: boolean;
  onSoundEnabledChange: (enabled: boolean) => void;
  initialVehicleDesign: VehicleDesign;
  onVehicleDesignChange: (design: VehicleDesign) => void;
  initialPageBestScore: number;
  initialLifetimeBestScore: number;
  onRunFinished?: (run: {
    score: number;
    elapsedMs: number;
    reason: 'manual' | 'deadSpot' | 'caught' | 'quit';
  }) => void;
  onDebugEvent?: (event: GameDebugEvent) => void;
}

export type ActiveEffects = HudState['activeEffects'];
export type InputOverrides = Partial<InputState> | null;
