import { describe, expect, it } from 'vitest';
import {
  updateVfxParticles,
  spawnCoinBurstParticles,
  spawnDriftSparkParticles,
  spawnTireDustParticles,
  type VfxParticle,
} from '../src/game/vfxRuntime';
import { setPageLightnessForSprites } from '../src/game/sprites/spriteHelpers';

describe('VFX particle smoke invariants', () => {
  it('removes expired VFX particles and keeps live ones', () => {
    const particles: VfxParticle[] = [
      {
        x: 100,
        y: 100,
        dx: 10,
        dy: -10,
        alpha: 1,
        maxAlpha: 1,
        lifetimeMs: 50,
        maxLifetimeMs: 200,
        radius: 2,
        color: '#fde047',
      },
      {
        x: 200,
        y: 200,
        dx: 5,
        dy: 5,
        alpha: 0.4,
        maxAlpha: 0.4,
        lifetimeMs: 250,
        maxLifetimeMs: 300,
        radius: 1.5,
        color: '#94a3b8',
      },
    ];

    updateVfxParticles(particles, 0.1);

    expect(particles).toHaveLength(1);
    expect(particles[0].color).toBe('#94a3b8');
    expect(particles[0].lifetimeMs).toBe(150);
    expect(particles[0].alpha).toBeCloseTo(0.4 * (150 / 300), 2);
  });

  it('spawns coin burst particles at the given position', () => {
    const particles: VfxParticle[] = [];
    spawnCoinBurstParticles(particles, 300, 400);

    expect(particles.length).toBeGreaterThanOrEqual(4);
    expect(particles.length).toBeLessThanOrEqual(6);
    expect(particles.every((p) => p.color === '#fde047')).toBe(true);
    expect(particles.every((p) => p.radius === 2)).toBe(true);
    expect(particles.every((p) => p.maxLifetimeMs >= 200 && p.maxLifetimeMs <= 300)).toBe(true);
  });

  it('spawns tire dust particles with surface-appropriate color', () => {
    const particles: VfxParticle[] = [];
    spawnTireDustParticles(particles, 100, 100, 0, 'normal');
    const normalColors = particles.map((p) => p.color);
    expect(normalColors.every((c) => c === '#94a3b8')).toBe(true);

    particles.length = 0;
    spawnTireDustParticles(particles, 100, 100, 0, 'ice');
    expect(particles.every((p) => p.color === '#e2e8f0')).toBe(true);

    particles.length = 0;
    spawnTireDustParticles(particles, 100, 100, 0, 'boost');
    expect(particles.every((p) => p.color === '#86efac')).toBe(true);
  });

  it('spawns drift spark particles with short lifetime', () => {
    const particles: VfxParticle[] = [];
    spawnDriftSparkParticles(particles, 200, 300, Math.PI / 4);

    expect(particles.length).toBeGreaterThanOrEqual(2);
    expect(particles.length).toBeLessThanOrEqual(3);
    expect(particles.every((p) => p.maxLifetimeMs === 150)).toBe(true);
    expect(particles.every((p) => p.color === '#fde047' || p.color === '#f8fafc')).toBe(true);
  });
});

describe('Adaptive sprite contrast', () => {
  it('setPageLightnessForSprites accepts values in [0, 1] without throwing', () => {
    expect(() => setPageLightnessForSprites(0)).not.toThrow();
    expect(() => setPageLightnessForSprites(0.5)).not.toThrow();
    expect(() => setPageLightnessForSprites(1)).not.toThrow();
  });
});
