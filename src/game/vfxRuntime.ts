// ---------------------------------------------------------------------------
// VFX Particles (coin burst, tire dust, drift sparks, NEW BEST burst, speed lines)
// ---------------------------------------------------------------------------

export interface VfxParticle {
  x: number;
  y: number;
  dx: number;
  dy: number;
  alpha: number;
  maxAlpha: number;
  lifetimeMs: number;
  maxLifetimeMs: number;
  radius: number;
  color: string;
}

export const VFX_PARTICLE_CAP = 120;

/** Advances all particles forward and removes expired ones in-place. */
export function updateVfxParticles(particles: VfxParticle[], dtSeconds: number): void {
  const dtMs = dtSeconds * 1000;
  let w = 0;
  for (let i = 0; i < particles.length; i += 1) {
    const p = particles[i];
    p.lifetimeMs -= dtMs;
    if (p.lifetimeMs <= 0) continue;
    p.x += p.dx * dtSeconds;
    p.y += p.dy * dtSeconds;
    p.alpha = p.maxAlpha * (p.lifetimeMs / p.maxLifetimeMs);
    particles[w] = p;
    w += 1;
  }
  particles.length = w;
}

/** Draws all active VFX particles as small filled circles. */
export function drawVfxParticles(ctx: CanvasRenderingContext2D, particles: VfxParticle[]): void {
  if (particles.length === 0) return;
  ctx.save();
  for (const p of particles) {
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Spawns 4-6 tiny yellow sparkle particles bursting outward from a collection point. */
export function spawnCoinBurstParticles(particles: VfxParticle[], x: number, y: number): void {
  const count = 4 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const speed = 40 + Math.random() * 60;
    const lifetime = 200 + Math.random() * 100;
    particles.push({
      x,
      y,
      dx: Math.cos(angle) * speed,
      dy: Math.sin(angle) * speed,
      alpha: 1,
      maxAlpha: 1,
      lifetimeMs: lifetime,
      maxLifetimeMs: lifetime,
      radius: 2,
      color: '#fde047',
    });
  }
  if (particles.length > VFX_PARTICLE_CAP) {
    particles.splice(0, particles.length - VFX_PARTICLE_CAP);
  }
}

/** Spawns 6-8 violet sparkle particles for objective completion celebration. */
export function spawnCelebrationParticles(
  particles: VfxParticle[],
  x: number,
  y: number,
): void {
  const count = 6 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const speed = 50 + Math.random() * 80;
    const lifetime = 300 + Math.random() * 150;
    particles.push({
      x,
      y,
      dx: Math.cos(angle) * speed,
      dy: Math.sin(angle) * speed,
      alpha: 1,
      maxAlpha: 1,
      lifetimeMs: lifetime,
      maxLifetimeMs: lifetime,
      radius: 2.5,
      color: '#c4b5fd',
    });
  }
  if (particles.length > VFX_PARTICLE_CAP) {
    particles.splice(0, particles.length - VFX_PARTICLE_CAP);
  }
}

/** Spawns 8-10 gold sparkle particles for the "NEW BEST!" celebration. */
export function spawnNewBestBurstParticles(particles: VfxParticle[], x: number, y: number): void {
  const count = 8 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const speed = 50 + Math.random() * 70;
    const lifetime = 350 + Math.random() * 200;
    particles.push({
      x,
      y,
      dx: Math.cos(angle) * speed,
      dy: Math.sin(angle) * speed,
      alpha: 1,
      maxAlpha: 1,
      lifetimeMs: lifetime,
      maxLifetimeMs: lifetime,
      radius: 2.5,
      color: '#facc15',
    });
  }
  if (particles.length > VFX_PARTICLE_CAP) {
    particles.splice(0, particles.length - VFX_PARTICLE_CAP);
  }
}

/** Spawns 1-2 fading dust particles behind the car, colored by surface type. */
export function spawnTireDustParticles(
  particles: VfxParticle[],
  cx: number,
  cy: number,
  angle: number,
  surface: 'normal' | 'ice' | 'boost',
): void {
  const count = 1 + Math.floor(Math.random() * 2);
  const color = surface === 'ice' ? '#e2e8f0' : surface === 'boost' ? '#86efac' : '#94a3b8';
  for (let i = 0; i < count; i += 1) {
    const backAngle = angle + Math.PI + (Math.random() - 0.5) * 0.8;
    const dist = 8 + Math.random() * 4;
    particles.push({
      x: cx + Math.cos(backAngle) * dist + (Math.random() - 0.5) * 4,
      y: cy + Math.sin(backAngle) * dist + (Math.random() - 0.5) * 4,
      dx: (Math.random() - 0.5) * 10,
      dy: (Math.random() - 0.5) * 10,
      alpha: 0.4,
      maxAlpha: 0.4,
      lifetimeMs: 300,
      maxLifetimeMs: 300,
      radius: 1.5 + Math.random(),
      color,
    });
  }
  if (particles.length > VFX_PARTICLE_CAP) {
    particles.splice(0, particles.length - VFX_PARTICLE_CAP);
  }
}

/** Spawns 2-3 tiny white/yellow spark particles at the car's rear on sharp turns over boost. */
export function spawnDriftSparkParticles(
  particles: VfxParticle[],
  cx: number,
  cy: number,
  angle: number,
): void {
  const count = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < count; i += 1) {
    const side = Math.random() > 0.5 ? 1 : -1;
    const sideAngle = angle + Math.PI + side * (0.6 + Math.random() * 0.6);
    const speed = 30 + Math.random() * 40;
    particles.push({
      x: cx + Math.cos(angle + Math.PI) * 8,
      y: cy + Math.sin(angle + Math.PI) * 8,
      dx: Math.cos(sideAngle) * speed,
      dy: Math.sin(sideAngle) * speed,
      alpha: 0.9,
      maxAlpha: 0.9,
      lifetimeMs: 150,
      maxLifetimeMs: 150,
      radius: 1.2 + Math.random() * 0.6,
      color: Math.random() > 0.5 ? '#fde047' : '#f8fafc',
    });
  }
  if (particles.length > VFX_PARTICLE_CAP) {
    particles.splice(0, particles.length - VFX_PARTICLE_CAP);
  }
}

// ---------------------------------------------------------------------------
// Speed lines
// ---------------------------------------------------------------------------

/** Draws 3-5 thin motion-blur streaks around the car at high speed. */
export function drawSpeedLines(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  angle: number,
  speed: number,
  maxSpeed: number,
): void {
  if (speed < maxSpeed * 0.7) return;

  const count = 3 + Math.floor(Math.random() * 3);
  const oppositeAngle = angle + Math.PI;
  ctx.save();
  ctx.lineWidth = 1;
  for (let i = 0; i < count; i += 1) {
    const spread = (Math.random() - 0.5) * 1.4;
    const lineAngle = oppositeAngle + spread;
    const dist = 10 + Math.random() * 50;
    const sx = cx + Math.cos(lineAngle + Math.PI / 2) * (Math.random() - 0.5) * 60;
    const sy = cy + Math.sin(lineAngle + Math.PI / 2) * (Math.random() - 0.5) * 60;
    const len = 40 + Math.random() * 40;
    ctx.globalAlpha = 0.15 + Math.random() * 0.1;
    ctx.strokeStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(sx + Math.cos(lineAngle) * dist, sy + Math.sin(lineAngle) * dist);
    ctx.lineTo(sx + Math.cos(lineAngle) * (dist + len), sy + Math.sin(lineAngle) * (dist + len));
    ctx.stroke();
  }
  ctx.restore();
}
