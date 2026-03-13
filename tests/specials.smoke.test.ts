import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { World } from '../src/shared/types';
import {
  applyMagnetPullToPickups,
  resolveSpecialEffectActivation,
} from '../src/game/gameEffectsRuntime';
import { JACKPOT } from '../src/game/gameConfig';
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
    playObjectiveChime(): void {}
    playNearMissWhoosh(): void {}
    async resume(): Promise<void> {}
  }
  return { AudioManager: MockAudioManager };
});

import { Game } from '../src/game/Game';

describe('special effects, jackpot, blur, oil_slick, reverse, mystery smoke invariants', () => {
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

  it('pulls special pickups while magnet effect is active', () => {
    (game as any).beginRun('manual');
    const runtimeWorld = (game as any).world as World;
    const player = (game as any).player;
    expect(player).toBeTruthy();
    runtimeWorld.pickups = [
      {
        id: 'special:bonus:pull',
        rect: { x: 520, y: 560, width: 20, height: 20 },
        value: 25,
        kind: 'special',
        effect: 'bonus',
        accentColor: '#f9a8d4',
        label: 'BON',
      },
    ];
    const before = { ...runtimeWorld.pickups[0].rect };

    (game as any).magnetTimerMs = 3000;
    (game as any).applyMagnet(0.5);

    const after = runtimeWorld.pickups[0].rect;
    const playerBounds = player.getBounds();
    const playerCenter = {
      x: playerBounds.x + playerBounds.width / 2,
      y: playerBounds.y + playerBounds.height / 2,
    };
    const beforeCenter = {
      x: before.x + before.width / 2,
      y: before.y + before.height / 2,
    };
    const afterCenter = {
      x: after.x + after.width / 2,
      y: after.y + after.height / 2,
    };
    const beforeDistance = Math.hypot(
      playerCenter.x - beforeCenter.x,
      playerCenter.y - beforeCenter.y,
    );
    const afterDistance = Math.hypot(
      playerCenter.x - afterCenter.x,
      playerCenter.y - afterCenter.y,
    );

    expect(afterDistance).toBeLessThan(beforeDistance);
  });

  it('keeps extracted magnet pull helper behavior unchanged', () => {
    const pickups: World['pickups'] = [
      {
        id: 'coin:near',
        sourceId: 'coin:near',
        rect: { x: 530, y: 300, width: 16, height: 16 },
        value: 10,
        kind: 'coin',
      },
      {
        id: 'special:near',
        rect: { x: 470, y: 230, width: 20, height: 20 },
        value: 25,
        kind: 'special',
        effect: 'magnet',
        accentColor: '#67e8f9',
        label: 'MAG',
      },
      {
        id: 'coin:far',
        sourceId: 'coin:far',
        rect: { x: 860, y: 520, width: 16, height: 16 },
        value: 10,
        kind: 'coin',
      },
    ];
    const playerCenter = { x: 600, y: 340 };
    const before = pickups.map((pickup) => ({
      id: pickup.id,
      centerX: pickup.rect.x + pickup.rect.width / 2,
      centerY: pickup.rect.y + pickup.rect.height / 2,
      distance: Math.hypot(
        playerCenter.x - (pickup.rect.x + pickup.rect.width / 2),
        playerCenter.y - (pickup.rect.y + pickup.rect.height / 2),
      ),
    }));

    applyMagnetPullToPickups(pickups, playerCenter, 0.5);

    const after = pickups.map((pickup) => ({
      id: pickup.id,
      centerX: pickup.rect.x + pickup.rect.width / 2,
      centerY: pickup.rect.y + pickup.rect.height / 2,
      distance: Math.hypot(
        playerCenter.x - (pickup.rect.x + pickup.rect.width / 2),
        playerCenter.y - (pickup.rect.y + pickup.rect.height / 2),
      ),
    }));

    const nearCoinBefore = before.find((entry) => entry.id === 'coin:near');
    const nearCoinAfter = after.find((entry) => entry.id === 'coin:near');
    const nearSpecialBefore = before.find((entry) => entry.id === 'special:near');
    const nearSpecialAfter = after.find((entry) => entry.id === 'special:near');
    const farCoinBefore = before.find((entry) => entry.id === 'coin:far');
    const farCoinAfter = after.find((entry) => entry.id === 'coin:far');
    expect(nearCoinAfter?.distance).toBeLessThan(
      nearCoinBefore?.distance ?? Number.POSITIVE_INFINITY,
    );
    expect(nearSpecialAfter?.distance).toBeLessThan(
      nearSpecialBefore?.distance ?? Number.POSITIVE_INFINITY,
    );
    expect(farCoinAfter?.centerX).toBe(farCoinBefore?.centerX);
    expect(farCoinAfter?.centerY).toBe(farCoinBefore?.centerY);
  });

  it('surfaces blur active flavor text', () => {
    const text = getFlavorText({
      score: 80,
      airborne: false,
      boostActive: false,
      magnetActive: false,
      ghostActive: false,
      invertActive: false,
      blurActive: true,
      oilSlickActive: false,
      reverseActive: false,
      nearMissCount: 0,
      objectivesCompleted: 0,
      planeActive: false,
      planeWarningActive: false,
      policeActive: false,
      policeWarningActive: false,
      policeDelayActive: false,
    });

    expect(text).toContain('Vision hazy');
  });

  it('keeps extracted special-effect activation resolution unchanged', () => {
    const brightSurface = { lightness: 0.7, saturation: 0.2, hasGradient: false };

    const bonus = resolveSpecialEffectActivation('bonus', brightSurface);
    expect(bonus.resolvedEffect).toBe('bonus');
    expect(bonus.scoreBonus).toBe(40);
    expect(bonus.timerMs).toBe(0);
    expect(bonus.setInverted).toBe(false);
    expect(bonus.setBlur).toBe(false);
    expect(bonus.messageText).toContain('BON');

    const magnet = resolveSpecialEffectActivation('magnet', brightSurface);
    expect(magnet.resolvedEffect).toBe('magnet');
    expect(magnet.scoreBonus).toBe(0);
    expect(magnet.timerMs).toBeGreaterThan(0);
    expect(magnet.setInverted).toBe(false);
    expect(magnet.setBlur).toBe(false);

    const invert = resolveSpecialEffectActivation('invert', brightSurface);
    expect(invert.resolvedEffect).toBe('invert');
    expect(invert.timerMs).toBeGreaterThan(0);
    expect(invert.setInverted).toBe(true);
    expect(invert.setBlur).toBe(false);

    const ghost = resolveSpecialEffectActivation('ghost', brightSurface);
    expect(ghost.resolvedEffect).toBe('ghost');
    expect(ghost.timerMs).toBeGreaterThan(0);
    expect(ghost.setInverted).toBe(false);
    expect(ghost.setBlur).toBe(false);

    const blur = resolveSpecialEffectActivation('blur', brightSurface);
    expect(blur.resolvedEffect).toBe('blur');
    expect(blur.timerMs).toBeGreaterThan(0);
    expect(blur.setInverted).toBe(false);
    expect(blur.setBlur).toBe(true);
  });

  it('resolves oil_slick activation with timer and no visual side effects', () => {
    const surface = { lightness: 0.6, saturation: 0.2, hasGradient: false };
    const oilSlick = resolveSpecialEffectActivation('oil_slick', surface);
    expect(oilSlick.resolvedEffect).toBe('oil_slick');
    expect(oilSlick.scoreBonus).toBe(0);
    expect(oilSlick.timerMs).toBe(3500);
    expect(oilSlick.setInverted).toBe(false);
    expect(oilSlick.setBlur).toBe(false);
    expect(oilSlick.messageText).toContain('OIL');
  });

  it('resolves reverse activation with timer', () => {
    const surface = { lightness: 0.6, saturation: 0.2, hasGradient: false };
    const reverse = resolveSpecialEffectActivation('reverse', surface);
    expect(reverse.resolvedEffect).toBe('reverse');
    expect(reverse.scoreBonus).toBe(0);
    expect(reverse.timerMs).toBe(3500);
    expect(reverse.setInverted).toBe(false);
    expect(reverse.setBlur).toBe(false);
    expect(reverse.messageText).toContain('REV');
  });

  it('resolves mystery activation as a random other effect', () => {
    const surface = { lightness: 0.6, saturation: 0.2, hasGradient: false };
    const mystery = resolveSpecialEffectActivation('mystery', surface);
    expect(mystery.messageText).toBe('MYSTERY');
    expect(['bonus', 'magnet', 'invert', 'ghost', 'blur', 'oil_slick', 'reverse']).toContain(
      mystery.resolvedEffect,
    );
  });

  it('activates blur timer when blur special is collected', () => {
    (game as any).beginRun('manual');
    expect((game as any).blurTimerMs).toBe(0);

    (game as any).activateSpecialEffect('blur');

    expect((game as any).blurTimerMs).toBe(4500);
    expect((game as any).score).toBe(0);
  });

  it('activates oil_slick timer when oil_slick special is collected', () => {
    (game as any).beginRun('manual');
    expect((game as any).oilSlickTimerMs).toBe(0);

    (game as any).activateSpecialEffect('oil_slick');

    expect((game as any).oilSlickTimerMs).toBe(3500);
    expect((game as any).score).toBe(0);
  });

  it('activates reverse timer when reverse special is collected', () => {
    (game as any).beginRun('manual');
    expect((game as any).reverseTimerMs).toBe(0);

    (game as any).activateSpecialEffect('reverse');

    expect((game as any).reverseTimerMs).toBe(3500);
    expect((game as any).score).toBe(0);
  });

  it('resolves jackpot activation with large score bonus and no timer', () => {
    const surface = { lightness: 0.6, saturation: 0.2, hasGradient: false };
    const jackpot = resolveSpecialEffectActivation('jackpot', surface);
    expect(jackpot.resolvedEffect).toBe('jackpot');
    expect(jackpot.scoreBonus).toBeGreaterThanOrEqual(JACKPOT.SCORE_MIN);
    expect(jackpot.scoreBonus).toBeLessThanOrEqual(JACKPOT.SCORE_MAX);
    expect(jackpot.timerMs).toBe(0);
    expect(jackpot.setInverted).toBe(false);
    expect(jackpot.setBlur).toBe(false);
    expect(jackpot.messageText).toBe('JACKPOT!');
  });

  it('uses jackpot spawn chance constant within expected range', () => {
    expect(JACKPOT.SPAWN_CHANCE).toBeGreaterThan(0);
    expect(JACKPOT.SPAWN_CHANCE).toBeLessThanOrEqual(0.1);
  });

  it('uses a larger pickup size for jackpot than regular specials', () => {
    expect(JACKPOT.PICKUP_SIZE).toBeGreaterThan(20);
  });

  it('spawns jackpot pickup when jackpot roll succeeds', () => {
    (game as any).beginRun('manual');
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.02);
    const spawned = (game as any).spawnSpecialPickup() as boolean;
    randomSpy.mockRestore();

    expect(spawned).toBe(true);
    const runtimeWorld = (game as any).world as World;
    const jackpots = runtimeWorld.pickups.filter(
      (pickup) => pickup.kind === 'special' && pickup.effect === 'jackpot',
    );
    expect(jackpots.length).toBe(1);
    expect(jackpots[0].rect.width).toBe(JACKPOT.PICKUP_SIZE);
    expect(jackpots[0].rect.height).toBe(JACKPOT.PICKUP_SIZE);
    expect(jackpots[0].label).toBe('JKP');
  });

  it('spawns regular special when jackpot roll fails', () => {
    (game as any).beginRun('manual');
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const spawned = (game as any).spawnSpecialPickup() as boolean;
    randomSpy.mockRestore();

    expect(spawned).toBe(true);
    const runtimeWorld = (game as any).world as World;
    const jackpots = runtimeWorld.pickups.filter(
      (pickup) => pickup.kind === 'special' && pickup.effect === 'jackpot',
    );
    expect(jackpots.length).toBe(0);
    const specials = runtimeWorld.pickups.filter((pickup) => pickup.kind === 'special');
    expect(specials.length).toBeGreaterThan(0);
    expect(specials[0].rect.width).toBe(20);
  });

  it('activates jackpot effect with large score bonus in Game', () => {
    (game as any).beginRun('manual');
    expect((game as any).score).toBe(0);

    (game as any).activateSpecialEffect('jackpot');

    expect((game as any).score).toBeGreaterThanOrEqual(JACKPOT.SCORE_MIN);
    expect((game as any).score).toBeLessThanOrEqual(JACKPOT.SCORE_MAX);
  });
});
