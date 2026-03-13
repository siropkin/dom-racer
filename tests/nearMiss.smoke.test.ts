import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isNearMiss,
  resolveNearMissStep,
  NEAR_MISS_COOLDOWN_MS,
  NEAR_MISS_THRESHOLD_PX,
} from '../src/game/nearMissRuntime';
import { getFlavorText } from '../src/game/gameRuntime';
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

describe('near-miss detection, scoring smoke invariants', () => {
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

  it('detects near-miss when player is within threshold of an obstacle', () => {
    const player = { x: 100, y: 100, width: 28, height: 16 };
    const obstacle = { x: 100, y: 100 + 16 + 3, width: 40, height: 20 };
    expect(isNearMiss(player, obstacle, NEAR_MISS_THRESHOLD_PX)).toBe(true);
  });

  it('does not detect near-miss when player is colliding', () => {
    const player = { x: 100, y: 100, width: 28, height: 16 };
    const obstacle = { x: 110, y: 108, width: 40, height: 20 };
    expect(isNearMiss(player, obstacle, NEAR_MISS_THRESHOLD_PX)).toBe(false);
  });

  it('does not detect near-miss when player is beyond threshold', () => {
    const player = { x: 100, y: 100, width: 28, height: 16 };
    const obstacle = { x: 100, y: 200, width: 40, height: 20 };
    expect(isNearMiss(player, obstacle, NEAR_MISS_THRESHOLD_PX)).toBe(false);
  });

  it('blocks near-miss triggers during cooldown', () => {
    const player = { x: 100, y: 100, width: 28, height: 16 };
    const obstacle = { x: 100, y: 119, width: 40, height: 20 };
    const step = resolveNearMissStep({
      playerBounds: player,
      obstacles: [obstacle],
      policeRect: null,
      cooldownMs: NEAR_MISS_COOLDOWN_MS,
      dtSeconds: 0.016,
      flavorIndex: 0,
    });
    expect(step.triggered).toBe(false);
    expect(step.cooldownMs).toBeGreaterThan(0);
    expect(step.cooldownMs).toBeLessThan(NEAR_MISS_COOLDOWN_MS);
  });

  it('triggers near-miss with score bonus when close to obstacle and off cooldown', () => {
    const player = { x: 100, y: 100, width: 28, height: 16 };
    const obstacle = { x: 100, y: 119, width: 40, height: 20 };
    const step = resolveNearMissStep({
      playerBounds: player,
      obstacles: [obstacle],
      policeRect: null,
      cooldownMs: 0,
      dtSeconds: 0.016,
      flavorIndex: 0,
    });
    expect(step.triggered).toBe(true);
    expect(step.scoreBonus).toBe(0);
    expect(step.cooldownMs).toBe(NEAR_MISS_COOLDOWN_MS);
    expect(step.messageText.length).toBeGreaterThan(0);
  });

  it('detects near-miss against police car rect', () => {
    const player = { x: 200, y: 200, width: 28, height: 16 };
    const policeRect = { x: 200, y: 200 + 16 + 4, width: 26, height: 18 };
    const step = resolveNearMissStep({
      playerBounds: player,
      obstacles: [],
      policeRect,
      cooldownMs: 0,
      dtSeconds: 0.016,
      flavorIndex: 0,
    });
    expect(step.triggered).toBe(true);
    expect(step.scoreBonus).toBe(0);
  });

  it('resets near-miss state on beginRun', () => {
    (game as any).beginRun('manual');
    (game as any).nearMissCooldownMs = 500;
    (game as any).nearMissCount = 6;
    (game as any).nearMissFlavorIndex = 4;

    (game as any).beginRun('manual');
    expect((game as any).nearMissCooldownMs).toBe(0);
    expect((game as any).nearMissCount).toBe(0);
    expect((game as any).nearMissFlavorIndex).toBe(0);
  });

  it('surfaces near-miss flavor text at threshold counts', () => {
    const base = {
      score: 80,
      airborne: false,
      boostActive: false,
      magnetActive: false,
      ghostActive: false,
      invertActive: false,
      blurActive: false,
      oilSlickActive: false,
      reverseActive: false,
      objectivesCompleted: 0,
      planeActive: false,
      planeWarningActive: false,
      policeActive: false,
      policeWarningActive: false,
      policeDelayActive: false,
    };

    const at4 = getFlavorText({ ...base, nearMissCount: 4 });
    expect(at4).toContain('Living on the edge');

    const at8 = getFlavorText({ ...base, nearMissCount: 8 });
    expect(at8).toContain('Thread the needle');

    const at0 = getFlavorText({ ...base, nearMissCount: 0 });
    expect(at0).not.toContain('needle');
    expect(at0).not.toContain('edge');
  });
});
