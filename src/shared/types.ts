export const PLAYER_SIZE = {
  width: 28,
  height: 16,
} as const;

export interface Vector2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export type VehicleDesign = 'coupe' | 'buggy' | 'truck';
export type SpecialEffect = 'invert' | 'magnet' | 'ghost' | 'blackout' | 'bonus';
export type HudEffectKind = SpecialEffect | 'police' | 'flow';

export type ScannedKind = 'wall' | 'pickup' | 'boost' | 'ice' | 'barrier';

export interface ScannedElement {
  id: string;
  kind: ScannedKind;
  rect: Rect;
  tagName: string;
  fixed: boolean;
}

export interface WorldPickup {
  id: string;
  sourceId?: string;
  rect: Rect;
  value: number;
  kind?: 'coin' | 'special';
  effect?: SpecialEffect;
  accentColor?: string;
  label?: string;
}

export interface World {
  viewport: ViewportSize;
  obstacles: Rect[];
  slowZones: Rect[];
  iceZones: Rect[];
  hazards: Rect[];
  deadSpots: Rect[];
  pickups: WorldPickup[];
  boosts: Rect[];
  spawnPoint: Vector2;
  scannedCount: number;
}

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export interface HudState {
  score: number;
  elapsedMs: number;
  pageTitle: string;
  pickupsRemaining: number;
  scannedCount: number;
  airborne: boolean;
  boostActive: boolean;
  soundEnabled: boolean;
  flavorText: string;
  pageBestScore: number;
  lifetimeBestScore: number;
  activeEffects: Array<{
    effect: HudEffectKind;
    label: string;
    remainingMs: number;
    durationMs: number;
    color: string;
  }>;
}
