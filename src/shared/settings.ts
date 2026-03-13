import type { VehicleDesign } from './types';

const PROFILE_KEY = 'domRacer.profile';
const SOUND_ENABLED_KEY = 'domRacer.soundEnabled';
const VEHICLE_DESIGN_KEY = 'domRacer.vehicleDesign';
const PROFILE_VERSION = 1;
let profileWriteQueue: Promise<void> = Promise.resolve();

interface ExtensionStorageArea {
  get: (keys: Record<string, unknown>, callback: (items: Record<string, unknown>) => void) => void;
  set: (items: Record<string, unknown>, callback?: () => void) => void;
}

interface ExtensionChrome {
  runtime?: {
    lastError?: {
      message?: string;
    };
  };
  storage?: {
    local?: ExtensionStorageArea;
  };
}

export interface DomRacerPageStats {
  key: string;
  url: string;
  title: string;
  highScore: number;
  lastScore: number;
  totalScore: number;
  runs: number;
  bestElapsedMs: number | null;
  lastReason: 'manual' | 'deadSpot' | 'caught' | 'quit';
  updatedAt: number;
}

export interface DomRacerProfile {
  version: number;
  soundEnabled: boolean;
  vehicleDesign: VehicleDesign;
  lifetime: {
    bestScore: number;
    totalScore: number;
    totalRuns: number;
    runsStarted: number;
    updatedAt: number;
  };
  pages: Record<string, DomRacerPageStats>;
}

export interface PageRunSnapshot {
  url: string;
  title: string;
  score: number;
  elapsedMs: number;
  reason: 'manual' | 'deadSpot' | 'caught' | 'quit';
}

export interface ScoreSummary {
  pageBestScore: number;
  lifetimeBestScore: number;
  lifetimeRunsStarted: number;
}

export async function loadSoundEnabledSetting(): Promise<boolean> {
  const profile = await loadDomRacerProfile();
  return profile.soundEnabled;
}

export async function saveSoundEnabledSetting(enabled: boolean): Promise<void> {
  await updateDomRacerProfile((profile) => {
    profile.soundEnabled = enabled;
  });
}

export async function loadVehicleDesignSetting(): Promise<VehicleDesign> {
  const profile = await loadDomRacerProfile();
  return profile.vehicleDesign;
}

export async function saveVehicleDesignSetting(design: VehicleDesign): Promise<void> {
  await updateDomRacerProfile((profile) => {
    profile.vehicleDesign = design;
  });
}

export async function loadDomRacerProfile(): Promise<DomRacerProfile> {
  await profileWriteQueue;
  return readNormalizedProfile();
}

export async function recordPageRun(snapshot: PageRunSnapshot): Promise<void> {
  await updateDomRacerProfile((profile) => {
    const pageKey = buildPageKey(snapshot.url);
    const existing =
      profile.pages[pageKey] ?? createEmptyPageStats(pageKey, snapshot.url, snapshot.title);
    const previousHighScore = existing.highScore;
    const nextHighScore = Math.max(previousHighScore, snapshot.score);
    const shouldRefreshBestElapsed =
      snapshot.score > 0 &&
      (snapshot.score > previousHighScore ||
        (snapshot.score === previousHighScore &&
          (existing.bestElapsedMs === null || snapshot.elapsedMs < existing.bestElapsedMs)));

    profile.pages[pageKey] = {
      key: pageKey,
      url: snapshot.url,
      title: snapshot.title,
      highScore: nextHighScore,
      lastScore: snapshot.score,
      totalScore: existing.totalScore + snapshot.score,
      runs: existing.runs + 1,
      bestElapsedMs: shouldRefreshBestElapsed ? snapshot.elapsedMs : existing.bestElapsedMs,
      lastReason: snapshot.reason,
      updatedAt: Date.now(),
    };

    profile.lifetime.bestScore = Math.max(profile.lifetime.bestScore, snapshot.score);
    profile.lifetime.totalScore += snapshot.score;
    profile.lifetime.totalRuns += 1;
    profile.lifetime.updatedAt = Date.now();
  });
}

export async function loadScoreSummary(url: string): Promise<ScoreSummary> {
  const profile = await loadDomRacerProfile();
  const page = profile.pages[buildPageKey(url)];
  return {
    pageBestScore: page?.highScore ?? 0,
    lifetimeBestScore: profile.lifetime.bestScore,
    lifetimeRunsStarted: profile.lifetime.runsStarted,
  };
}

export async function incrementRunCount(): Promise<number> {
  let next = 0;
  await updateDomRacerProfile((profile) => {
    profile.lifetime.runsStarted += 1;
    next = profile.lifetime.runsStarted;
  });
  return next;
}

async function readNormalizedProfile(): Promise<DomRacerProfile> {
  const stored = await readStorageItems();
  return normalizeProfile(stored[PROFILE_KEY], {
    soundEnabled: normalizeLegacyBoolean(stored[SOUND_ENABLED_KEY], true),
    vehicleDesign: normalizeVehicleDesign(stored[VEHICLE_DESIGN_KEY]),
  });
}

async function updateDomRacerProfile(
  mutator: (profile: DomRacerProfile) => void | Promise<void>,
): Promise<void> {
  const operation = profileWriteQueue.then(async () => {
    const profile = await readNormalizedProfile();
    await mutator(profile);
    await writeProfileDirect(profile);
  });

  profileWriteQueue = operation.catch(() => undefined);
  return operation;
}

async function writeProfileDirect(profile: DomRacerProfile): Promise<void> {
  const normalized = normalizeProfile(profile, {
    soundEnabled: profile.soundEnabled,
    vehicleDesign: profile.vehicleDesign,
  });
  const storage = getExtensionStorage();
  if (storage) {
    return new Promise<void>((resolve) => {
      try {
        storage.set(
          {
            [PROFILE_KEY]: normalized,
            [SOUND_ENABLED_KEY]: normalized.soundEnabled,
            [VEHICLE_DESIGN_KEY]: normalized.vehicleDesign,
          },
          () => {
            if (getExtensionRuntimeLastErrorMessage()) {
              writeLocalStorageFallback(normalized);
            }
            resolve();
          },
        );
      } catch {
        writeLocalStorageFallback(normalized);
        resolve();
      }
    });
  }

  writeLocalStorageFallback(normalized);
}

function getExtensionStorage(): ExtensionStorageArea | null {
  const maybeChrome = globalThis as typeof globalThis & { chrome?: ExtensionChrome };
  return maybeChrome.chrome?.storage?.local ?? null;
}

async function readStorageItems(): Promise<Record<string, unknown>> {
  const defaults = getStorageDefaults();
  const storage = getExtensionStorage();
  if (storage) {
    return new Promise<Record<string, unknown>>((resolve) => {
      try {
        storage.get(defaults, (items) => {
          if (getExtensionRuntimeLastErrorMessage()) {
            resolve(readLocalStorageFallback(defaults));
            return;
          }
          resolve(items);
        });
      } catch {
        resolve(readLocalStorageFallback(defaults));
      }
    });
  }

  return readLocalStorageFallback(defaults);
}

function getStorageDefaults(): Record<string, unknown> {
  return {
    [PROFILE_KEY]: null,
    [SOUND_ENABLED_KEY]: true,
    [VEHICLE_DESIGN_KEY]: 'coupe',
  };
}

function readLocalStorageFallback(defaults: Record<string, unknown>): Record<string, unknown> {
  const rawProfile = safeLocalStorageGetItem(PROFILE_KEY);
  return {
    [PROFILE_KEY]: rawProfile ? parseJsonSafely(rawProfile) : defaults[PROFILE_KEY],
    [SOUND_ENABLED_KEY]: safeLocalStorageGetItem(SOUND_ENABLED_KEY) ?? defaults[SOUND_ENABLED_KEY],
    [VEHICLE_DESIGN_KEY]:
      safeLocalStorageGetItem(VEHICLE_DESIGN_KEY) ?? defaults[VEHICLE_DESIGN_KEY],
  };
}

function writeLocalStorageFallback(profile: DomRacerProfile): void {
  safeLocalStorageSetItem(PROFILE_KEY, JSON.stringify(profile));
  safeLocalStorageSetItem(SOUND_ENABLED_KEY, String(profile.soundEnabled));
  safeLocalStorageSetItem(VEHICLE_DESIGN_KEY, profile.vehicleDesign);
}

function safeLocalStorageGetItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSetItem(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage write failures in restricted contexts.
  }
}

function getExtensionRuntimeLastErrorMessage(): string | null {
  const maybeChrome = globalThis as typeof globalThis & { chrome?: ExtensionChrome };
  return maybeChrome.chrome?.runtime?.lastError?.message ?? null;
}

function normalizeVehicleDesign(value: unknown): VehicleDesign {
  if (value === 'buggy' || value === 'truck') {
    return value;
  }

  return 'coupe';
}

function normalizeLegacyBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return fallback;
}

function normalizeProfile(
  value: unknown,
  fallbacks: { soundEnabled: boolean; vehicleDesign: VehicleDesign },
): DomRacerProfile {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const rawLifetime =
    raw.lifetime && typeof raw.lifetime === 'object'
      ? (raw.lifetime as Record<string, unknown>)
      : {};
  const rawPages =
    raw.pages && typeof raw.pages === 'object' ? (raw.pages as Record<string, unknown>) : {};
  const pages: Record<string, DomRacerPageStats> = {};

  for (const [key, pageValue] of Object.entries(rawPages)) {
    pages[key] = normalizePageStats(key, pageValue);
  }

  return {
    version: PROFILE_VERSION,
    soundEnabled: typeof raw.soundEnabled === 'boolean' ? raw.soundEnabled : fallbacks.soundEnabled,
    vehicleDesign: normalizeVehicleDesign(raw.vehicleDesign ?? fallbacks.vehicleDesign),
    lifetime: {
      bestScore: toNumber(rawLifetime.bestScore),
      totalScore: toNumber(rawLifetime.totalScore),
      totalRuns: toNumber(rawLifetime.totalRuns),
      runsStarted: toNumber(rawLifetime.runsStarted),
      updatedAt: toNumber(rawLifetime.updatedAt),
    },
    pages,
  };
}

function normalizePageStats(key: string, value: unknown): DomRacerPageStats {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    key,
    url: typeof raw.url === 'string' ? raw.url : key,
    title: typeof raw.title === 'string' ? raw.title : '',
    highScore: toNumber(raw.highScore),
    lastScore: toNumber(raw.lastScore),
    totalScore: toNumber(raw.totalScore),
    runs: toNumber(raw.runs),
    bestElapsedMs:
      typeof raw.bestElapsedMs === 'number' && Number.isFinite(raw.bestElapsedMs)
        ? raw.bestElapsedMs
        : null,
    lastReason: normalizeRunReason(raw.lastReason),
    updatedAt: toNumber(raw.updatedAt),
  };
}

function createEmptyPageStats(key: string, url: string, title: string): DomRacerPageStats {
  return {
    key,
    url,
    title,
    highScore: 0,
    lastScore: 0,
    totalScore: 0,
    runs: 0,
    bestElapsedMs: null,
    lastReason: 'quit',
    updatedAt: 0,
  };
}

function buildPageKey(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url;
  }
}

function normalizeRunReason(value: unknown): 'manual' | 'deadSpot' | 'caught' | 'quit' {
  if (value === 'manual' || value === 'deadSpot' || value === 'caught') {
    return value;
  }

  return 'quit';
}

function toNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function parseJsonSafely(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
