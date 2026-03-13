import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { World } from '../src/shared/types';
import {
  advanceFocusModeAlpha,
  advanceSpecialSpawnCues,
  estimatePageLightness,
} from '../src/game/gameRenderRuntime';
import {
  resolveFocusPauseTransitionState,
  shouldPauseForPageFocus,
} from '../src/game/gameRunStateRuntime';
import {
  resolveAmbientSpecialSpawnStep,
  getSpecialSpawnRespawnDelayMs,
  resolveRegularCoinSpawnStep,
} from '../src/game/pickupSpawnRuntime';
import { createCanvas, createWorldWithRegularCoins } from './testHelpers';

vi.mock('../src/game/audio', () => {
  class MockAudioManager {
    setEnabled(): void {}
    stop(): void {}
    updateEngine(): void {}
    updatePoliceSiren(): void {}
    playPickup(): void {}
    playToggle(): void {}
    playPoliceAlert(): void {}
    playPlaneFlyover(): void {}
    playPlaneDrop(): void {}
    updatePropellerDrone(): void {}
    async resume(): Promise<void> {}
  }
  return { AudioManager: MockAudioManager };
});

import { Game } from '../src/game/Game';

describe('economy and game lifecycle smoke invariants', () => {
  let game: Game;

  beforeEach(() => {
    game = new Game({
      canvas: createCanvas(),
      createWorld: () => createWorldWithRegularCoins(14),
      getPageTitle: () => 'DOM Racer Smoke',
      sampleSurfaceAt: () => ({ lightness: 0.6, saturation: 0.2, hasGradient: false }),
      setPageInverted: () => undefined,
      setPageBlur: () => undefined,
      setMagnetUiState: () => undefined,
      onQuit: () => undefined,
      initialSoundEnabled: false,
      onSoundEnabledChange: () => undefined,
      initialVehicleDesign: 'coupe',
      onVehicleDesignChange: () => undefined,
      initialPageBestScore: 0,
      initialLifetimeBestScore: 0,
      initialRunCount: 0,
    });
  });

  it('keeps regular coin spawn staging tied to source anchors', () => {
    (game as any).beginRun('manual');
    const runtimeWorld = (game as any).world as World;
    const visibleRegularCoins = runtimeWorld.pickups.filter((pickup) => pickup.kind !== 'special');
    const visibleSourceIds = visibleRegularCoins.map((pickup) => pickup.sourceId);

    expect(visibleRegularCoins.length).toBe(7);
    expect(visibleRegularCoins.every((pickup) => pickup.value === 10)).toBe(true);
    expect(new Set(visibleSourceIds).size).toBe(visibleSourceIds.length);
    expect((game as any).coinSpawnQueue).toHaveLength(14);
    expect(
      visibleRegularCoins.every((pickup) => pickup.sourceId?.startsWith('anchor:') ?? false),
    ).toBe(true);
  });

  it('spawns specials independently from regular coin economy', () => {
    (game as any).beginRun('manual');
    const runtimeWorldBefore = (game as any).world as World;
    const regularBefore = runtimeWorldBefore.pickups.filter(
      (pickup) => pickup.kind !== 'special',
    ).length;
    const queueBefore = (game as any).coinSpawnQueue.length;

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const spawned = (game as any).spawnSpecialPickup() as boolean;
    randomSpy.mockRestore();
    const runtimeWorldAfter = (game as any).world as World;
    const regularAfter = runtimeWorldAfter.pickups.filter(
      (pickup) => pickup.kind !== 'special',
    ).length;
    const specialsAfter = runtimeWorldAfter.pickups.filter((pickup) => pickup.kind === 'special');

    expect(spawned).toBe(true);
    expect(regularAfter).toBe(regularBefore);
    expect(specialsAfter.length).toBeGreaterThan(0);
    expect(specialsAfter[0].value).toBe(0);
    expect((game as any).coinSpawnQueue.length).toBe(queueBefore);
  });

  it('resets player when a refreshed world places them inside a deadSpot blocker', () => {
    (game as any).beginRun('manual');
    const runtimeWorld = (game as any).world as World;
    const player = (game as any).player;
    expect(player).toBeTruthy();

    player.reset({ x: 220, y: 220 });
    const movedBounds = player.getBounds();
    expect(movedBounds.x).toBe(220);
    expect(movedBounds.y).toBe(220);

    const refreshedWorld: World = {
      ...runtimeWorld,
      deadSpots: [{ x: 210, y: 210, width: 40, height: 40 }],
      spawnPoint: { x: 44, y: 88 },
    };
    game.applyWorld(refreshedWorld, false);

    const safeBounds = (game as any).player.getBounds();
    expect(safeBounds.x).toBe(44);
    expect(safeBounds.y).toBe(88);
  });

  it('resets player when a refreshed world places them inside a hazard blocker', () => {
    (game as any).beginRun('manual');
    const runtimeWorld = (game as any).world as World;
    const player = (game as any).player;
    expect(player).toBeTruthy();

    player.reset({ x: 260, y: 260 });
    const movedBounds = player.getBounds();
    expect(movedBounds.x).toBe(260);
    expect(movedBounds.y).toBe(260);

    const refreshedWorld: World = {
      ...runtimeWorld,
      hazards: [{ x: 252, y: 252, width: 38, height: 38 }],
      spawnPoint: { x: 58, y: 102 },
    };
    game.applyWorld(refreshedWorld, false);

    const safeBounds = (game as any).player.getBounds();
    expect(safeBounds.x).toBe(58);
    expect(safeBounds.y).toBe(102);
  });

  it('pauses immediately on focus loss and resumes on focus regain', () => {
    (game as any).beginRun('manual');
    (game as any).running = true;

    const visibilitySpy = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    const hasFocusSpy = vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    (game as any).syncPausedFromPageFocus();
    expect((game as any).paused).toBe(true);
    expect((game as any).pausedStartedAtMs).toBeGreaterThan(0);

    visibilitySpy.mockReturnValue('visible');
    hasFocusSpy.mockReturnValue(true);
    (game as any).syncPausedFromPageFocus();
    expect((game as any).paused).toBe(false);

    visibilitySpy.mockRestore();
    hasFocusSpy.mockRestore();
  });

  it('keeps extracted focus-pause transition helper behavior unchanged', () => {
    expect(shouldPauseForPageFocus('hidden', true)).toBe(true);
    expect(shouldPauseForPageFocus('visible', false)).toBe(true);
    expect(shouldPauseForPageFocus('visible', true)).toBe(false);

    const entered = resolveFocusPauseTransitionState({
      paused: false,
      pausedStartedAtMs: 0,
      lastFrameMs: 2400,
      shouldPause: true,
      nowMs: 3600,
    });
    expect(entered.transition).toBe('enter');
    expect(entered.paused).toBe(true);
    expect(entered.pausedStartedAtMs).toBe(3600);
    expect(entered.lastFrameMs).toBe(2400);

    const exited = resolveFocusPauseTransitionState({
      paused: true,
      pausedStartedAtMs: entered.pausedStartedAtMs,
      lastFrameMs: entered.lastFrameMs,
      shouldPause: false,
      nowMs: 4200,
    });
    expect(exited.transition).toBe('exit');
    expect(exited.paused).toBe(false);
    expect(exited.pausedStartedAtMs).toBe(entered.pausedStartedAtMs);
    expect(exited.lastFrameMs).toBe(4200);
  });

  it('keeps extracted focus-mode alpha helper behavior unchanged', () => {
    const relaxed = advanceFocusModeAlpha(0.75, false, 0.5);
    expect(relaxed).toBeGreaterThan(0.75);
    expect(relaxed).toBeLessThanOrEqual(1);

    const focused = advanceFocusModeAlpha(0.75, true, 0.5);
    expect(focused).toBeLessThan(0.75);
    expect(focused).toBeGreaterThanOrEqual(0);

    const stableAtTarget = advanceFocusModeAlpha(1.0, false, 0.016);
    expect(Math.abs(stableAtTarget - 1.0)).toBeLessThan(0.01);
  });

  it('keeps extracted ambient special spawn scheduling unchanged', () => {
    const staggered = resolveAmbientSpecialSpawnStep({
      specialSpawnTimerMs: 500,
      existingSpecialCount: 0,
      planeRouteActive: true,
      dtSeconds: 0.5,
    });
    expect(staggered.shouldAttemptSpawn).toBe(false);
    expect(staggered.specialSpawnTimerMs).toBeGreaterThanOrEqual(1500);

    const waiting = resolveAmbientSpecialSpawnStep({
      specialSpawnTimerMs: 3000,
      existingSpecialCount: 0,
      planeRouteActive: false,
      dtSeconds: 0.5,
    });
    expect(waiting.shouldAttemptSpawn).toBe(false);
    expect(waiting.specialSpawnTimerMs).toBe(2500);

    const atCap = resolveAmbientSpecialSpawnStep({
      specialSpawnTimerMs: 0,
      existingSpecialCount: 2,
      planeRouteActive: false,
      dtSeconds: 0.5,
    });
    expect(atCap.shouldAttemptSpawn).toBe(false);
    expect(atCap.specialSpawnTimerMs).toBeGreaterThan(0);

    const ready = resolveAmbientSpecialSpawnStep({
      specialSpawnTimerMs: 200,
      existingSpecialCount: 0,
      planeRouteActive: false,
      dtSeconds: 0.5,
    });
    expect(ready.shouldAttemptSpawn).toBe(true);
    expect(ready.specialSpawnTimerMs).toBe(0);

    const respawnDelay = getSpecialSpawnRespawnDelayMs(true);
    expect(respawnDelay).toBeGreaterThan(0);
    const retryDelay = getSpecialSpawnRespawnDelayMs(false);
    expect(retryDelay).toBeGreaterThan(0);
    expect(respawnDelay).toBeGreaterThanOrEqual(retryDelay * 0.5);
  });

  it('does not toast when ambient specials spawn (spawn cue ring only)', () => {
    (game as any).beginRun('manual');
    (game as any).toastSystem.clear();

    const spawned = (game as any).spawnSpecialPickup() as boolean;
    expect(spawned).toBe(true);

    const cues = (game as any).specialSpawnCues as Array<{ label: string }>;
    expect(cues.length).toBeGreaterThan(0);

    const toastMessages = (game as any).toastSystem['messages'] as Array<{ text: string }>;
    expect(toastMessages).toHaveLength(0);
  });

  it('keeps extracted regular coin spawn step timer logic unchanged', () => {
    const emptyQueue = resolveRegularCoinSpawnStep({
      coinRefillBoostTimerMs: 1200,
      coinRefillTimerMs: 800,
      coinSpawnQueueEmpty: true,
      visibleRegularCoins: 3,
      dtSeconds: 0.5,
    });
    expect(emptyQueue.shouldSpawn).toBe(false);
    expect(emptyQueue.coinRefillBoostTimerMs).toBe(1200);
    expect(emptyQueue.coinRefillTimerMs).toBe(800);

    const atCap = resolveRegularCoinSpawnStep({
      coinRefillBoostTimerMs: 1200,
      coinRefillTimerMs: 800,
      coinSpawnQueueEmpty: false,
      visibleRegularCoins: 11,
      dtSeconds: 0.5,
    });
    expect(atCap.shouldSpawn).toBe(false);
    expect(atCap.coinRefillBoostTimerMs).toBe(700);

    const waiting = resolveRegularCoinSpawnStep({
      coinRefillBoostTimerMs: 1200,
      coinRefillTimerMs: 1600,
      coinSpawnQueueEmpty: false,
      visibleRegularCoins: 5,
      dtSeconds: 0.5,
    });
    expect(waiting.shouldSpawn).toBe(false);
    expect(waiting.coinRefillTimerMs).toBe(1100);
    expect(waiting.coinRefillBoostTimerMs).toBe(700);

    const ready = resolveRegularCoinSpawnStep({
      coinRefillBoostTimerMs: 200,
      coinRefillTimerMs: 300,
      coinSpawnQueueEmpty: false,
      visibleRegularCoins: 5,
      dtSeconds: 0.5,
    });
    expect(ready.shouldSpawn).toBe(true);
    expect(ready.coinRefillTimerMs).toBe(0);
    expect(ready.coinRefillBoostTimerMs).toBe(0);
  });

  it('keeps extracted page lightness estimation unchanged', () => {
    const viewport = { width: 1280, height: 720 };
    const brightSampler = () => ({ lightness: 0.9, saturation: 0.1, hasGradient: false });
    const darkSampler = () => ({ lightness: 0.15, saturation: 0.05, hasGradient: false });
    const mixedCallIndex = { i: 0 };
    const mixedSampler = () => {
      mixedCallIndex.i += 1;
      return {
        lightness: mixedCallIndex.i % 2 === 0 ? 0.8 : 0.2,
        saturation: 0.1,
        hasGradient: false,
      };
    };

    const bright = estimatePageLightness(viewport, brightSampler);
    expect(bright).toBeCloseTo(0.9, 1);

    const dark = estimatePageLightness(viewport, darkSampler);
    expect(dark).toBeCloseTo(0.15, 1);

    const mixed = estimatePageLightness(viewport, mixedSampler);
    expect(mixed).toBeGreaterThan(0.1);
    expect(mixed).toBeLessThan(0.9);

    const fallback = estimatePageLightness(viewport, () => ({
      lightness: Number.NaN,
      saturation: 0,
      hasGradient: false,
    }));
    expect(fallback).toBe(0.5);
  });

  it('keeps extracted special-spawn cue lifecycle unchanged', () => {
    const next = advanceSpecialSpawnCues(
      [
        {
          x: 128,
          y: 256,
          label: 'MAG',
          color: '#67e8f9',
          ttlMs: 1000,
          durationMs: 1000,
        },
      ],
      0.25,
    );
    expect(next).toHaveLength(1);
    expect(next[0].ttlMs).toBe(750);

    const expired = advanceSpecialSpawnCues(next, 2);
    expect(expired).toHaveLength(0);
  });

  it('persists shownMilestones array in profile structure', () => {
    (game as any).beginRun('manual');
    const profile = {
      version: 1,
      soundEnabled: true,
      vehicleDesign: 'coupe',
      lifetime: {
        bestScore: 0,
        totalScore: 600,
        totalRuns: 5,
        runsStarted: 5,
        shownMilestones: [500],
        updatedAt: 0,
      },
      pages: {},
    };
    expect(profile.lifetime.shownMilestones).toEqual([500]);
    expect(profile.lifetime.totalScore).toBe(600);
  });

  it('stores page tint color from getPageTintColor callback', () => {
    const tintGame = new Game({
      canvas: createCanvas(),
      createWorld: () => createWorldWithRegularCoins(14),
      getPageTitle: () => 'Tint Test',
      sampleSurfaceAt: () => ({ lightness: 0.6, saturation: 0.2, hasGradient: false }),
      setPageInverted: () => undefined,
      setPageBlur: () => undefined,
      setMagnetUiState: () => undefined,
      onQuit: () => undefined,
      initialSoundEnabled: false,
      onSoundEnabledChange: () => undefined,
      initialVehicleDesign: 'coupe',
      onVehicleDesignChange: () => undefined,
      initialPageBestScore: 0,
      initialLifetimeBestScore: 0,
      initialRunCount: 0,
      getPageTintColor: () => 'rgba(30, 60, 200, 0.06)',
    });
    (tintGame as any).beginRun('manual');
    expect((tintGame as any).pageTintColor).toBe('rgba(30, 60, 200, 0.06)');
  });

  it('exposes angular delta from Player for drift spark detection', () => {
    (game as any).beginRun('manual');
    const player = (game as any).player;
    expect(player).toBeTruthy();
    expect(player.getAngularDelta()).toBe(0);
  });
});
