import type { Rect, SpecialEffect, VehicleDesign, World, WorldPickup } from '../shared/types';
import { clamp } from '../shared/utils';
import { SPECIALS, VEHICLES } from './gameConfig';
import type { SurfaceSample } from './gameStateTypes';

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
export const PICKUP_WORDS = ['LGTM', 'MERGED', 'GREEN', 'SYNCED', 'SHIPPED', 'CACHE'] as const;
export const PICKUP_COLORS = [
  '#fde047',
  '#f9a8d4',
  '#67e8f9',
  '#fca5a5',
  '#86efac',
  '#c4b5fd',
] as const;
export const SHOWCASE_TOAST_MESSAGES = [
  '+10',
  '+20',
  '+30',
  '+40',
  '+50',
  'SYNCED',
  'SHIPPED',
  'CACHE',
  'MAGNET',
  'INVERT',
  'GHOST',
  'BLUR',
  'OIL SLICK',
  'REVERSE',
  'MYSTERY',
  'ESCAPED',
  'COUPE',
  'BUGGY',
  'TRUCK',
  'CLOSE!',
  'TIGHT!',
  'RAZOR!',
  'WHEW!',
  'NEW BEST!',
  'RUN #42',
] as const;
export const SHOWCASE_THEMES: readonly ShowcaseTheme[] = [
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

const RANDOM_SPECIAL_EFFECTS: readonly SpecialEffect[] = [
  'invert',
  'magnet',
  'ghost',
  'blur',
  'oil_slick',
  'reverse',
];
const SPECIAL_LABELS: Readonly<Record<SpecialEffect, string>> = {
  bonus: 'BON',
  invert: 'INV',
  magnet: 'MAG',
  ghost: 'GHO',
  jackpot: 'JKP',
  blur: 'BLR',
  oil_slick: 'OIL',
  reverse: 'REV',
  mystery: '???',
};
const SPECIAL_COLORS: Readonly<Record<SpecialEffect, string>> = {
  bonus: '#f9a8d4',
  invert: '#f472b6',
  magnet: '#67e8f9',
  ghost: '#c4b5fd',
  jackpot: '#facc15',
  blur: '#a78bfa',
  oil_slick: '#475569',
  reverse: '#fb923c',
  mystery: '#e879f9',
};
const VEHICLE_DESIGNS: readonly VehicleDesign[] = ['coupe', 'buggy', 'truck'];
const VEHICLE_LABELS: Readonly<Record<VehicleDesign, string>> = {
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
        ? 'blur'
        : surface.lightness <= 0.34
          ? 'ghost'
          : 'magnet';

  if (Math.random() < SPECIALS.PREFERRED_EFFECT_BIAS) {
    return preferredEffect;
  }

  const alternatives = RANDOM_SPECIAL_EFFECTS.filter((effect) => effect !== preferredEffect);
  return alternatives[Math.floor(Math.random() * alternatives.length)];
}

export function getSpecialColor(effect: SpecialEffect): string {
  return SPECIAL_COLORS[effect];
}

export function getSpecialLabel(effect: SpecialEffect): string {
  return SPECIAL_LABELS[effect];
}

export function getSpecialHudLabel(
  effect: Exclude<SpecialEffect, 'bonus' | 'jackpot' | 'mystery'>,
): string {
  switch (effect) {
    case 'magnet':
      return 'MAGNET';
    case 'invert':
      return 'INVERT';
    case 'ghost':
      return 'GHOST';
    case 'blur':
      return 'BLUR';
    case 'oil_slick':
      return 'OIL SLICK';
    case 'reverse':
      return 'REVERSE';
  }
}

export function getSpecialActivationMessage(effect: SpecialEffect): string {
  switch (effect) {
    case 'bonus':
      return `+${SPECIALS.BONUS_SCORE}`;
    case 'magnet':
      return 'MAGNET';
    case 'invert':
      return 'INVERT';
    case 'ghost':
      return 'GHOST';
    case 'jackpot':
      return 'JACKPOT';
    case 'blur':
      return 'BLUR';
    case 'oil_slick':
      return 'OIL SLICK';
    case 'reverse':
      return 'REVERSE';
    case 'mystery':
      return 'MYSTERY';
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

// ---------------------------------------------------------------------------
// Daily modifier
// ---------------------------------------------------------------------------

export type DailyModifierKind =
  | 'DOUBLE_COINS'
  | 'FAST_POLICE'
  | 'EXTRA_SPECIALS'
  | 'SLIPPERY'
  | 'EARLY_OVERGROWTH';

export interface DailyModifier {
  kind: DailyModifierKind;
  label: string;
}

const DAILY_MODIFIERS: readonly DailyModifier[] = [
  { kind: 'DOUBLE_COINS', label: 'DOUBLE COINS' },
  { kind: 'FAST_POLICE', label: 'FAST POLICE' },
  { kind: 'EXTRA_SPECIALS', label: 'EXTRA SPECIALS' },
  { kind: 'SLIPPERY', label: 'SLIPPERY' },
  { kind: 'EARLY_OVERGROWTH', label: 'EARLY OVERGROWTH' },
];

export function getDailyModifier(): DailyModifier {
  const dateStr = new Date().toDateString();
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash += dateStr.charCodeAt(i);
  }
  return DAILY_MODIFIERS[hash % DAILY_MODIFIERS.length];
}

// ---------------------------------------------------------------------------
// Vehicle unlocks
// ---------------------------------------------------------------------------

export function getUnlockedVehicleDesigns(lifetimeTotalScore: number): VehicleDesign[] {
  const designs: VehicleDesign[] = ['coupe'];
  if (lifetimeTotalScore >= VEHICLES.BUGGY_UNLOCK_SCORE) designs.push('buggy');
  if (lifetimeTotalScore >= VEHICLES.TRUCK_UNLOCK_SCORE) designs.push('truck');
  return designs;
}

export function getNextUnlockedVehicleDesign(
  current: VehicleDesign,
  lifetimeTotalScore: number,
): VehicleDesign {
  const unlocked = getUnlockedVehicleDesigns(lifetimeTotalScore);
  const idx = unlocked.indexOf(current);
  return unlocked[(idx + 1) % unlocked.length];
}

const VIEWPORT_SCALE_REFERENCE_AREA = 1280 * 720;

export function computeViewportScaleFactor(viewport: { width: number; height: number }): number {
  const area = viewport.width * viewport.height;
  return clamp(Math.sqrt(area / VIEWPORT_SCALE_REFERENCE_AREA), 0.6, 2.5);
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
  blurActive: boolean;
  oilSlickActive: boolean;
  reverseActive: boolean;
  planeActive: boolean;
  planeWarningActive: boolean;
  policeActive: boolean;
  policeWarningActive: boolean;
  policeDelayActive: boolean;
  nearMissCount: number;
  objectivesCompleted: number;
}): string {
  if (state.policeActive) {
    return 'Sirens up. Do not get audited by the law.';
  }

  if (state.policeWarningActive) {
    return 'Sirens warming up. Pick your exit lane.';
  }

  if (state.planeWarningActive) {
    return 'Nyoom inbound. Keep one eye on the edge.';
  }

  if (state.planeActive) {
    return 'Flyover live. Track the drop line.';
  }

  if (state.policeDelayActive) {
    return 'Traffic hold. Use the breathing room.';
  }

  if (state.blurActive) {
    return 'Vision hazy. Trust the shapes.';
  }

  if (state.reverseActive) {
    return 'Controls flipped. Brain recalibrating.';
  }

  if (state.oilSlickActive) {
    return 'Oil slick! Pedal feels like mud.';
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

  if (state.nearMissCount >= 8) {
    return 'Thread the needle much?';
  }

  if (state.nearMissCount >= 4) {
    return 'Living on the edge. Literally.';
  }

  if (state.objectivesCompleted >= 6) {
    return 'Objective machine. HR wants a word.';
  }

  if (state.objectivesCompleted >= 3) {
    return 'Checking boxes like a pro.';
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
