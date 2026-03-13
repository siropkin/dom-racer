import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { World } from '../src/shared/types';
import {
  applyLurePullToPickups,
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
    async resume(): Promise<void> {}
  }
  return { AudioManager: MockAudioManager };
});

import { Game } from '../src/game/Game';

describe('special effects, jackpot, cooldown, lure smoke invariants', () => {
  let game: Game;

  beforeEach(() => {
    game = new Game({
      canvas: createCanvas(),
      createWorld: () => createWorldWithRegularCoins(14),
      getPageTitle: () => 'DOM Racer Smoke',
      sampleSurfaceAt: () => ({ lightness: 0.6, saturation: 0.2, hasGradient: false }),
      setPageInverted: () => undefined,
      setPageBlackout: () => undefined,
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

  it('surfaces lure active flavor text', () => {
    const text = getFlavorText({
      score: 80,
      airborne: false,
      boostActive: false,
      magnetActive: false,
      ghostActive: false,
      invertActive: false,
      blackoutActive: false,
      lureActive: true,
      nearMissCount: 0,
      objectivesCompleted: 0,
      planeActive: false,
      planeWarningActive: false,
      policeActive: false,
      policeWarningActive: false,
      policeDelayActive: false,
    });

    expect(text).toContain('Loose change incoming');
  });

  it('keeps extracted special-effect activation resolution unchanged', () => {
    const brightSurface = { lightness: 0.7, saturation: 0.2, hasGradient: false };
    const darkSurface = { lightness: 0.2, saturation: 0.1, hasGradient: false };

    const bonus = resolveSpecialEffectActivation('bonus', brightSurface);
    expect(bonus.resolvedEffect).toBe('bonus');
    expect(bonus.scoreBonus).toBe(40);
    expect(bonus.timerMs).toBe(0);
    expect(bonus.policeDelayMs).toBe(0);
    expect(bonus.setInverted).toBe(false);
    expect(bonus.setBlackout).toBe(false);
    expect(bonus.messageText).toContain('BON');

    const magnet = resolveSpecialEffectActivation('magnet', brightSurface);
    expect(magnet.resolvedEffect).toBe('magnet');
    expect(magnet.scoreBonus).toBe(0);
    expect(magnet.timerMs).toBeGreaterThan(0);
    expect(magnet.policeDelayMs).toBe(0);
    expect(magnet.setInverted).toBe(false);
    expect(magnet.setBlackout).toBe(false);

    const invert = resolveSpecialEffectActivation('invert', brightSurface);
    expect(invert.resolvedEffect).toBe('invert');
    expect(invert.timerMs).toBeGreaterThan(0);
    expect(invert.setInverted).toBe(true);
    expect(invert.setBlackout).toBe(false);

    const ghost = resolveSpecialEffectActivation('ghost', brightSurface);
    expect(ghost.resolvedEffect).toBe('ghost');
    expect(ghost.timerMs).toBeGreaterThan(0);
    expect(ghost.setInverted).toBe(false);
    expect(ghost.setBlackout).toBe(false);

    const blackout = resolveSpecialEffectActivation('blackout', brightSurface);
    expect(blackout.resolvedEffect).toBe('blackout');
    expect(blackout.timerMs).toBeGreaterThan(0);
    expect(blackout.setInverted).toBe(false);
    expect(blackout.setBlackout).toBe(true);

    const blackoutOnDark = resolveSpecialEffectActivation('blackout', darkSurface);
    expect(blackoutOnDark.resolvedEffect).toBe('invert');
    expect(blackoutOnDark.setInverted).toBe(true);
    expect(blackoutOnDark.setBlackout).toBe(false);
  });

  it('resolves cooldown activation with score bonus and police delay', () => {
    const surface = { lightness: 0.6, saturation: 0.2, hasGradient: false };
    const cooldown = resolveSpecialEffectActivation('cooldown', surface);
    expect(cooldown.resolvedEffect).toBe('cooldown');
    expect(cooldown.scoreBonus).toBe(15);
    expect(cooldown.timerMs).toBe(0);
    expect(cooldown.policeDelayMs).toBeGreaterThanOrEqual(5400);
    expect(cooldown.policeDelayMs).toBeLessThanOrEqual(8200);
    expect(cooldown.setInverted).toBe(false);
    expect(cooldown.setBlackout).toBe(false);
    expect(cooldown.messageText).toContain('CDN');
  });

  it('resolves lure activation with timer and no visual side effects', () => {
    const surface = { lightness: 0.6, saturation: 0.2, hasGradient: false };
    const lure = resolveSpecialEffectActivation('lure', surface);
    expect(lure.resolvedEffect).toBe('lure');
    expect(lure.scoreBonus).toBe(0);
    expect(lure.timerMs).toBe(5400);
    expect(lure.policeDelayMs).toBe(0);
    expect(lure.setInverted).toBe(false);
    expect(lure.setBlackout).toBe(false);
    expect(lure.messageText).toContain('LUR');
  });

  it('uses lure pull to attract distant coins but not specials', () => {
    const pickups: World['pickups'] = [
      {
        id: 'coin:near',
        sourceId: 'coin:near',
        rect: { x: 460, y: 260, width: 16, height: 16 },
        value: 10,
        kind: 'coin',
      },
      {
        id: 'coin:far',
        sourceId: 'coin:far',
        rect: { x: 360, y: 180, width: 16, height: 16 },
        value: 10,
        kind: 'coin',
      },
      {
        id: 'coin:out-of-range',
        sourceId: 'coin:out-of-range',
        rect: { x: 860, y: 520, width: 16, height: 16 },
        value: 10,
        kind: 'coin',
      },
      {
        id: 'special:magnet:lure-test',
        rect: { x: 480, y: 240, width: 20, height: 20 },
        value: 25,
        kind: 'special',
        effect: 'magnet',
        accentColor: '#67e8f9',
        label: 'MAG',
      },
    ];
    const playerCenter = { x: 500, y: 300 };
    const nearBefore = { ...pickups[0].rect };
    const farBefore = { ...pickups[1].rect };
    const outOfRangeBefore = { ...pickups[2].rect };
    const specialBefore = { ...pickups[3].rect };

    applyLurePullToPickups(pickups, playerCenter, 0.5);

    const nearDistance = Math.hypot(
      playerCenter.x - (pickups[0].rect.x + 8),
      playerCenter.y - (pickups[0].rect.y + 8),
    );
    const nearBeforeDistance = Math.hypot(
      playerCenter.x - (nearBefore.x + 8),
      playerCenter.y - (nearBefore.y + 8),
    );
    expect(nearDistance).toBeLessThan(nearBeforeDistance);

    const farDistance = Math.hypot(
      playerCenter.x - (pickups[1].rect.x + 8),
      playerCenter.y - (pickups[1].rect.y + 8),
    );
    const farBeforeDistance = Math.hypot(
      playerCenter.x - (farBefore.x + 8),
      playerCenter.y - (farBefore.y + 8),
    );
    expect(farDistance).toBeLessThan(farBeforeDistance);

    expect(pickups[2].rect.x).toBe(outOfRangeBefore.x);
    expect(pickups[2].rect.y).toBe(outOfRangeBefore.y);

    expect(pickups[3].rect.x).toBe(specialBefore.x);
    expect(pickups[3].rect.y).toBe(specialBefore.y);
  });

  it('uses cooldown to push police timer and show delay cue', () => {
    (game as any).beginRun('manual');
    const spawnTimerBefore = 2000;
    (game as any).policeSpawnTimerMs = spawnTimerBefore;

    (game as any).activateSpecialEffect('cooldown');

    expect((game as any).policeSpawnTimerMs).toBeGreaterThan(spawnTimerBefore + 5000);
    expect((game as any).policeDelayCueTimerMs).toBeGreaterThan(5000);
    expect((game as any).policeDelayCueDurationMs).toBe((game as any).policeDelayCueTimerMs);
    expect((game as any).score).toBe(15);
    expect((game as any).policeWarning).toBeNull();
  });

  it('activates lure timer when lure special is collected', () => {
    (game as any).beginRun('manual');
    expect((game as any).lureTimerMs).toBe(0);

    (game as any).activateSpecialEffect('lure');

    expect((game as any).lureTimerMs).toBe(5400);
    expect((game as any).score).toBe(0);
  });

  it('resolves jackpot activation with large score bonus and no timer', () => {
    const surface = { lightness: 0.6, saturation: 0.2, hasGradient: false };
    const jackpot = resolveSpecialEffectActivation('jackpot', surface);
    expect(jackpot.resolvedEffect).toBe('jackpot');
    expect(jackpot.scoreBonus).toBeGreaterThanOrEqual(JACKPOT.SCORE_MIN);
    expect(jackpot.scoreBonus).toBeLessThanOrEqual(JACKPOT.SCORE_MAX);
    expect(jackpot.timerMs).toBe(0);
    expect(jackpot.policeDelayMs).toBe(0);
    expect(jackpot.setInverted).toBe(false);
    expect(jackpot.setBlackout).toBe(false);
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
