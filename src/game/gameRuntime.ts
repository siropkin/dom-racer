import type { Rect, SpecialEffect, VehicleDesign, World, WorldPickup } from '../shared/types';
import { clamp } from '../shared/utils';

export interface SurfaceSample {
  lightness: number;
  saturation: number;
  hasGradient: boolean;
}

export interface ShowcaseTheme {
  name: string;
  background: string;
  grid: string;
  title: string;
  subtitle: string;
  toastPanel: string;
  toastCard: string;
  toastStroke: string;
  toastText: string;
}

export const COMBO_WINDOW_MS = 2400;
export const POLICE_WARNING_MS = 1100;
export const PLANE_WARNING_MS = 900;
export const REGULAR_COIN_SCORE = 10;
export const REGULAR_COIN_STARTING_BATCH = 7;
export const REGULAR_COIN_VISIBLE_CAP = 11;
export const REGULAR_COIN_REFILL_MIN_MS = 1600;
export const REGULAR_COIN_REFILL_MAX_MS = 2400;
export const REGULAR_COIN_REFILL_FAST_MIN_MS = 900;
export const REGULAR_COIN_REFILL_FAST_MAX_MS = 1400;
export const REGULAR_COIN_REFILL_LOW_MIN_MS = 750;
export const REGULAR_COIN_REFILL_LOW_MAX_MS = 1150;
export const REGULAR_COIN_LOW_PRESSURE_THRESHOLD = 4;
export const REGULAR_COIN_RETRY_MIN_MS = 550;
export const REGULAR_COIN_RETRY_MAX_MS = 900;
export const REGULAR_COIN_REFILL_BOOST_MS = 2200;
export const TOAST_MAX_CHARS = 8;
export const TOAST_MAX_VISIBLE = 8;
export const TOAST_DUPLICATE_WINDOW_MS = 260;
export const TOAST_PICKUP_TTL_MS = 700;
export const TOAST_EFFECT_TTL_MS = 900;
export const BONUS_SPECIAL_SCORE = 40;
export const PLANE_BONUS_PICKUP_SIZE = 20;
export const PLANE_EVENT_MIN_SCORE = 40;
export const PLANE_EVENT_SPEED = 188;
export const PLANE_EVENT_ENTRY_OFFSET = 56;
export const PLANE_EVENT_CORNER_SPAN = 110;
export const PLANE_EVENT_INITIAL_MIN_MS = 14000;
export const PLANE_EVENT_INITIAL_MAX_MS = 22000;
export const PLANE_EVENT_RESPAWN_MIN_MS = 17000;
export const PLANE_EVENT_RESPAWN_MAX_MS = 25000;
export const PLANE_BOOST_LANE_CHANCE = 0.32;
export const PLANE_BOOST_LANE_DURATION_MS = 4200;
export const PLANE_BOOST_LANE_LENGTH_PX = 228;
export const PLANE_BOOST_LANE_WIDTH_PX = 24;
export const PLANE_BOOST_LANE_STEP_PX = 22;
export const PLANE_COIN_TRAIL_CHANCE = 0.36;
export const PLANE_COIN_TRAIL_DURATION_MS = 3200;
export const PLANE_COIN_TRAIL_LENGTH_PX = 188;
export const PLANE_COIN_TRAIL_COIN_SIZE_PX = 16;
export const PLANE_COIN_TRAIL_STEP_PX = 24;
export const PLANE_SPOTLIGHT_CHANCE = 0.2;
export const PLANE_SPOTLIGHT_CUE_DURATION_MS = 2200;
export const PLANE_LUCKY_WIND_CHANCE = 0.14;
export const PLANE_LUCKY_WIND_RADIUS_PX = 180;
export const PLANE_LUCKY_WIND_ROUTE_HALF_SPAN_PX = 120;
export const PLANE_LUCKY_WIND_MAX_SHIFT_PX = 36;
export const PLANE_LUCKY_WIND_MAX_COINS = 8;
export const SPECIAL_VISIBLE_CAP = 2;
export const SPECIAL_INITIAL_SPAWN_MIN_MS = 4800;
export const SPECIAL_INITIAL_SPAWN_MAX_MS = 7600;
export const SPECIAL_RESPAWN_MIN_MS = 7400;
export const SPECIAL_RESPAWN_MAX_MS = 11200;
export const SPECIAL_RETRY_MIN_MS = 2400;
export const SPECIAL_RETRY_MAX_MS = 3600;
export const SPECIAL_CAP_RETRY_MIN_MS = 2600;
export const SPECIAL_CAP_RETRY_MAX_MS = 4200;
export const PLANE_LANE_SPECIAL_STAGGER_MS = 1500;
export const POLICE_START_DELAY_MS = 12000;
export const POLICE_START_SCORE_THRESHOLD = 30;
export const POLICE_START_COINS_THRESHOLD = 6;
export const POLICE_INITIAL_SPAWN_MIN_MS = 10000;
export const POLICE_INITIAL_SPAWN_MAX_MS = 15000;
export const POLICE_RESPAWN_MIN_MS = 11000;
export const POLICE_RESPAWN_MAX_MS = 17000;
export const POLICE_POST_SPAWN_MIN_MS = 14000;
export const POLICE_POST_SPAWN_MAX_MS = 20000;
export const POLICE_CHASE_DURATION_MIN_MS = 5600;
export const POLICE_CHASE_DURATION_MAX_MS = 7800;
export const ENCOUNTER_STAGGER_MS = 3800;
export const PLANE_AFTER_POLICE_MIN_MS = 1600;
export const PLANE_AFTER_POLICE_MAX_MS = 3200;
export const POLICE_AFTER_PLANE_MIN_MS = 3600;
export const POLICE_AFTER_PLANE_MAX_MS = 6200;
export const POLICE_ICE_SPEED_MULTIPLIER = 1.08;
export const POLICE_ICE_TURN_RATE = 3.6;
export const BLACKOUT_INVERT_SWAP_LIGHTNESS = 0.28;
export const PICKUP_WORDS = ['LGTM', 'MERGED', 'GREEN', 'SYNCED', 'SHIPPED', 'CACHE'] as const;
export const PICKUP_COLORS = ['#fde047', '#f9a8d4', '#67e8f9', '#fca5a5', '#86efac', '#c4b5fd'] as const;
export const SHOWCASE_TOAST_MESSAGES = [
  'LGTM',
  'MERGED',
  'GREEN',
  'SYNCED',
  'SHIPPED',
  'CACHE',
  'C-MAGD',
  'P-INVD',
  'V-GHOD',
  'S-BLKD',
  'R-BOND',
  'C-MAG',
  'P-INV',
  'V-GHO',
  'S-BLK',
  'R-BON+40',
  'FLOW X3',
  'FLOW X5',
  'FLOW X8',
  'FLOW X12',
  'WEE-OO',
  'POLICE!',
  'ESCAPED',
  'PLANE',
  'COUPE',
  'BUGGY',
  'TRUCK',
  'NYOOM',
] as const;
export const SHOWCASE_THEMES: ShowcaseTheme[] = [
  {
    name: 'DARK',
    background: 'rgba(2, 6, 23, 0.96)',
    grid: 'rgba(100, 116, 139, 0.24)',
    title: '#f8fafc',
    subtitle: '#94a3b8',
    toastPanel: 'rgba(15, 23, 42, 0.72)',
    toastCard: 'rgba(2, 6, 23, 0.9)',
    toastStroke: '#67e8f9',
    toastText: '#67e8f9',
  },
  {
    name: 'STEEL',
    background: 'rgba(30, 41, 59, 0.96)',
    grid: 'rgba(148, 163, 184, 0.26)',
    title: '#f8fafc',
    subtitle: '#cbd5e1',
    toastPanel: 'rgba(15, 23, 42, 0.62)',
    toastCard: 'rgba(30, 41, 59, 0.92)',
    toastStroke: '#22d3ee',
    toastText: '#e2e8f0',
  },
  {
    name: 'MIST',
    background: 'rgba(241, 245, 249, 0.98)',
    grid: 'rgba(51, 65, 85, 0.22)',
    title: '#0f172a',
    subtitle: '#334155',
    toastPanel: 'rgba(203, 213, 225, 0.78)',
    toastCard: 'rgba(248, 250, 252, 0.95)',
    toastStroke: '#0ea5e9',
    toastText: '#0f172a',
  },
  {
    name: 'PAPER',
    background: 'rgba(255, 255, 255, 0.99)',
    grid: 'rgba(71, 85, 105, 0.2)',
    title: '#020617',
    subtitle: '#1e293b',
    toastPanel: 'rgba(226, 232, 240, 0.9)',
    toastCard: 'rgba(255, 255, 255, 0.96)',
    toastStroke: '#0284c7',
    toastText: '#0f172a',
  },
];

const RANDOM_SPECIAL_EFFECTS: SpecialEffect[] = ['invert', 'magnet', 'ghost', 'blackout'];
const SPECIAL_LABELS: Record<SpecialEffect, string> = {
  bonus: 'BON',
  invert: 'INV',
  magnet: 'MAG',
  ghost: 'GHO',
  blackout: 'BLK',
};
const SPECIAL_COLORS: Record<SpecialEffect, string> = {
  bonus: '#f9a8d4',
  invert: '#f472b6',
  magnet: '#67e8f9',
  ghost: '#c4b5fd',
  blackout: '#334155',
};
const SPECIAL_COLOR_NAMES: Record<SpecialEffect, string> = {
  bonus: 'ROSE',
  invert: 'PINK',
  magnet: 'CYAN',
  ghost: 'VIOLET',
  blackout: 'SLATE',
};
const VEHICLE_DESIGNS: VehicleDesign[] = ['coupe', 'buggy', 'truck'];
const VEHICLE_LABELS: Record<VehicleDesign, string> = {
  coupe: 'COUPE',
  buggy: 'BUGGY',
  truck: 'TRUCK',
};

export function pickOppositeShowcaseThemeIndex(pageLightness: number): number {
  const lightness = clamp(pageLightness, 0, 1);
  if (lightness >= 0.7) {
    return 0; // DARK
  }
  if (lightness >= 0.56) {
    return 1; // STEEL
  }
  if (lightness <= 0.24) {
    return 3; // PAPER
  }
  return 2; // MIST
}

export function cloneWorld(world: World): World {
  return {
    viewport: { ...world.viewport },
    obstacles: world.obstacles.map(cloneRect),
    slowZones: world.slowZones.map(cloneRect),
    iceZones: world.iceZones.map(cloneRect),
    hazards: world.hazards.map(cloneRect),
    deadSpots: world.deadSpots.map(cloneRect),
    boosts: world.boosts.map(cloneRect),
    pickups: world.pickups.map(clonePickup),
    spawnPoint: { ...world.spawnPoint },
    scannedCount: world.scannedCount,
  };
}

export function clonePickup(pickup: WorldPickup): WorldPickup {
  return {
    id: pickup.id,
    sourceId: pickup.sourceId,
    value: pickup.value,
    rect: cloneRect(pickup.rect),
    kind: pickup.kind,
    effect: pickup.effect,
    accentColor: pickup.accentColor,
    label: pickup.label,
  };
}

export function cloneRect(rect: Rect): Rect {
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  };
}

export function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function blendAngle(current: number, target: number, blend: number): number {
  const normalizedBlend = clamp(blend, 0, 1);
  let delta = target - current;
  while (delta > Math.PI) {
    delta -= Math.PI * 2;
  }
  while (delta < -Math.PI) {
    delta += Math.PI * 2;
  }
  return current + delta * normalizedBlend;
}

export function shufflePickups(pickups: WorldPickup[]): WorldPickup[] {
  const shuffled = pickups.map((pickup) => ({
    ...clonePickup(pickup),
    sourceId: pickup.sourceId ?? pickup.id,
  }));
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function isSpecialPickup(pickup: WorldPickup): boolean {
  return pickup.kind === 'special';
}

export function pickSpecialEffect(surface: SurfaceSample): SpecialEffect {
  const preferredEffect =
    surface.hasGradient || surface.saturation >= 0.52
      ? 'invert'
      : surface.lightness <= 0.18
        ? 'blackout'
        : surface.lightness <= 0.34
          ? 'ghost'
          : 'magnet';

  if (Math.random() < 0.58) {
    return preferredEffect;
  }

  const alternatives = RANDOM_SPECIAL_EFFECTS.filter((effect) => effect !== preferredEffect);
  return alternatives[Math.floor(Math.random() * alternatives.length)];
}

export function adaptBlackoutEffectForSurface(effect: SpecialEffect, surface: SurfaceSample): SpecialEffect {
  if (effect === 'blackout' && surface.lightness <= BLACKOUT_INVERT_SWAP_LIGHTNESS) {
    return 'invert';
  }
  return effect;
}

export function getSpecialColor(effect: SpecialEffect): string {
  return SPECIAL_COLORS[effect];
}

export function getSpecialLabel(effect: SpecialEffect): string {
  return SPECIAL_LABELS[effect];
}

function getSpecialColorName(effect: SpecialEffect): string {
  return SPECIAL_COLOR_NAMES[effect];
}

export function getSpecialDropMessage(effect: SpecialEffect): string {
  const colorCode = getSpecialColorName(effect).slice(0, 1);
  return `${colorCode}-${getSpecialLabel(effect)}D`;
}

export function getSpecialHudLabel(effect: Exclude<SpecialEffect, 'bonus'>): string {
  switch (effect) {
    case 'magnet':
      return 'MAGNET CYAN';
    case 'invert':
      return 'INVERT PINK';
    case 'ghost':
      return 'GHOST VIOLET';
    case 'blackout':
      return 'BLACKOUT SLATE';
  }
}

export function getSpecialActivationMessage(effect: SpecialEffect): string {
  switch (effect) {
    case 'bonus':
      return `R-BON+${BONUS_SPECIAL_SCORE}`;
    case 'magnet':
      return 'C-MAG';
    case 'invert':
      return 'P-INV';
    case 'ghost':
      return 'V-GHO';
    case 'blackout':
      return 'S-BLK';
  }
}

export function getNextVehicleDesign(current: VehicleDesign): VehicleDesign {
  const currentIndex = VEHICLE_DESIGNS.indexOf(current);
  const nextIndex = (currentIndex + 1) % VEHICLE_DESIGNS.length;
  return VEHICLE_DESIGNS[nextIndex];
}

export function getVehicleDesignLabel(design: VehicleDesign): string {
  return VEHICLE_LABELS[design];
}

export function isModifierKey(code: string): boolean {
  return (
    code === 'ShiftLeft' ||
    code === 'ShiftRight' ||
    code === 'ControlLeft' ||
    code === 'ControlRight' ||
    code === 'AltLeft' ||
    code === 'AltRight' ||
    code === 'MetaLeft' ||
    code === 'MetaRight'
  );
}

export function getFlavorText(state: {
  score: number;
  airborne: boolean;
  boostActive: boolean;
  magnetActive: boolean;
  ghostActive: boolean;
  invertActive: boolean;
  blackoutActive: boolean;
  policeActive: boolean;
}): string {
  if (state.policeActive) {
    return 'Sirens up. Do not get audited by the law.';
  }

  if (state.blackoutActive) {
    return 'Blackout active. Follow HUD and coin glints.';
  }

  if (state.invertActive) {
    return 'Reality flipped. Keep the rubber side up.';
  }

  if (state.magnetActive) {
    return 'Money is suddenly very into you.';
  }

  if (state.ghostActive) {
    return 'Ghost mode: no slow and no police lock.';
  }

  if (state.airborne) {
    return 'Illegal parking. Legal airtime.';
  }

  if (state.boostActive) {
    return 'Turbo engaged. HR is nervous.';
  }

  if (state.score >= 150) {
    return 'Certified page goblin.';
  }

  if (state.score >= 60) {
    return 'Looting links with intent.';
  }

  if (state.score > 0) {
    return 'A tasteful amount of chaos.';
  }

  return 'Drive like the DOM owes you money.';
}
