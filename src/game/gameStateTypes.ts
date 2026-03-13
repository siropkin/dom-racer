import type { Vector2, VehicleDesign, World } from '../shared/types';
import type { PoliceEdge } from './sprites';

export interface SurfaceSample {
  lightness: number;
  saturation: number;
  hasGradient: boolean;
}

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
  flyoverSoundPlayed: boolean;
  effectMode: 'bonus-drop' | 'coin-trail' | 'spotlight' | 'lucky-wind' | 'police-delay';
}

export interface PlaneCoinTrailState {
  coinIds: string[];
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
  runElapsedMs: number;
  coinsCollected: number;
  nearMisses: number;
  objectivesCompleted: number;
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
  initialRunCount: number;
  onRunStarted?: (runNumber: number) => void;
  onRunFinished?: (run: {
    score: number;
    elapsedMs: number;
    reason: 'manual' | 'deadSpot' | 'caught' | 'quit';
  }) => void;
  getPageTintColor?: () => string | null;
}
