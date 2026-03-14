import { applyAdaptiveShadow, clearAdaptiveShadow, drawBorderedRect } from './spriteHelpers';

export interface HelicopterPose {
  x: number;
  y: number;
  angle: number;
}

export interface HelicopterRenderOptions {
  chasing: boolean;
  /** Player position for searchlight direction — decorative only. */
  playerX?: number;
  playerY?: number;
}

const BODY_W = 34;
const BODY_H = 18;
const TAIL_LENGTH = 18;
const TAIL_WIDTH = 6;
const ROTOR_RADIUS = 19;

export function renderHelicopterSprite(
  ctx: CanvasRenderingContext2D,
  pose: HelicopterPose,
  now: number,
  options: HelicopterRenderOptions = { chasing: false },
): void {
  const cx = pose.x + BODY_W / 2;
  const cy = pose.y + BODY_H / 2;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(pose.angle);

  // --- ground shadow ---
  ctx.fillStyle = 'rgba(15, 23, 42, 0.18)';
  ctx.beginPath();
  ctx.ellipse(0, 5, BODY_W * 0.38, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();

  applyAdaptiveShadow(ctx);

  // --- searchlight cone (decorative, toward player) ---
  if (options.chasing && options.playerX !== undefined && options.playerY !== undefined) {
    drawSearchlight(ctx, cx, cy, pose.angle, options.playerX, options.playerY);
  }

  // --- tail boom ---
  const halfBody = BODY_W / 2;
  drawBorderedRect(
    ctx,
    -halfBody - TAIL_LENGTH + 2,
    -TAIL_WIDTH / 2,
    TAIL_LENGTH,
    TAIL_WIDTH,
    1.6,
    '#475569',
    '#f8fafc',
    0.9,
  );

  // --- tail rotor (small spinning disc) ---
  const tailRotorX = -halfBody - TAIL_LENGTH + 3;
  const tailBladeAngle = now / 18;
  const tailR = 5;
  ctx.fillStyle = 'rgba(148, 163, 184, 0.28)';
  ctx.beginPath();
  ctx.arc(tailRotorX, 0, tailR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.7)';
  ctx.lineWidth = 1.0;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(
    tailRotorX + Math.cos(tailBladeAngle) * tailR * 0.9,
    Math.sin(tailBladeAngle) * tailR * 0.9,
  );
  ctx.lineTo(
    tailRotorX - Math.cos(tailBladeAngle) * tailR * 0.9,
    -Math.sin(tailBladeAngle) * tailR * 0.9,
  );
  ctx.stroke();
  ctx.lineCap = 'butt';

  // --- siren flash state ---
  const sirenPhase = Math.floor(now / 120) % 2 === 0;
  const pulse = Math.sin(now / 110) > 0;

  // --- siren glow (under fuselage, visible when chasing) ---
  if (options.chasing) {
    const glowColor = sirenPhase ? 'rgba(59, 130, 246, 0.22)' : 'rgba(239, 68, 68, 0.22)';
    ctx.fillStyle = glowColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, halfBody + 6, BODY_H / 2 + 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- fuselage outline ---
  ctx.fillStyle = 'rgba(15, 23, 42, 0.62)';
  ctx.beginPath();
  ctx.ellipse(0, 0, halfBody + 1.2, BODY_H / 2 + 1.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // --- fuselage body (oval) — flashes red/blue when chasing ---
  const bodyColor = options.chasing
    ? (sirenPhase ? '#93c5fd' : '#fca5a5')
    : '#cbd5e1';
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.ellipse(0, 0, halfBody, BODY_H / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // --- fuselage accent stripe ---
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(-halfBody + 5, -1.2, BODY_W - 10, 2.4);

  // --- cockpit windshield ---
  ctx.fillStyle = '#1e3a8a';
  ctx.beginPath();
  ctx.ellipse(halfBody * 0.35, 0, 5, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(147, 197, 253, 0.5)';
  ctx.beginPath();
  ctx.ellipse(halfBody * 0.35 + 1, -1, 2.2, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // --- police light bar (larger, matching car proportions) ---
  const barWidth = 12;
  const barHeight = 5;
  drawBorderedRect(ctx, -barWidth / 2, -barHeight / 2 - 0.5, barWidth, barHeight, 1.6, '#0f172a');
  ctx.fillStyle = pulse ? '#93c5fd' : '#1d4ed8';
  ctx.fillRect(-barWidth / 2 + 0.8, -barHeight / 2 + 0.3, barWidth / 2 - 1, barHeight - 1.2);
  ctx.fillStyle = pulse ? '#991b1b' : '#f87171';
  ctx.fillRect(0.4, -barHeight / 2 + 0.3, barWidth / 2 - 1, barHeight - 1.2);

  // --- skids (landing struts) ---
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1.4;
  for (const side of [-1, 1]) {
    const skidY = side * (BODY_H / 2 + 2);
    ctx.beginPath();
    ctx.moveTo(-halfBody * 0.4, skidY);
    ctx.lineTo(halfBody * 0.4, skidY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-halfBody * 0.25, side * (BODY_H / 2 - 1));
    ctx.lineTo(-halfBody * 0.25, skidY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(halfBody * 0.25, side * (BODY_H / 2 - 1));
    ctx.lineTo(halfBody * 0.25, skidY);
    ctx.stroke();
  }

  clearAdaptiveShadow(ctx);

  // --- main rotor disc (semi-transparent spinning) ---
  ctx.fillStyle = 'rgba(148, 163, 184, 0.14)';
  ctx.beginPath();
  ctx.arc(0, 0, ROTOR_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  const rotorPulse = 0.9 + 0.1 * Math.sin(now / 32);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(0, 0, ROTOR_RADIUS * rotorPulse, 0, Math.PI * 2);
  ctx.stroke();

  // --- rotor blades (3 blades, faster spin than plane's now/36) ---
  const bladeAngle = now / 20;
  const bladeR = ROTOR_RADIUS * 0.95;
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.78)';
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.8;
  for (let i = 0; i < 3; i++) {
    const a = bladeAngle + (i * Math.PI * 2) / 3;
    ctx.beginPath();
    ctx.moveTo(-Math.cos(a) * bladeR, -Math.sin(a) * bladeR);
    ctx.lineTo(Math.cos(a) * bladeR, Math.sin(a) * bladeR);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';

  // --- rotor hub ---
  ctx.fillStyle = '#94a3b8';
  ctx.beginPath();
  ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 0.7;
  ctx.stroke();

  ctx.restore();
}

function drawSearchlight(
  ctx: CanvasRenderingContext2D,
  heliWorldX: number,
  heliWorldY: number,
  heliAngle: number,
  playerX: number,
  playerY: number,
): void {
  const dx = playerX - heliWorldX;
  const dy = playerY - heliWorldY;
  const angleToPlayer = Math.atan2(dy, dx) - heliAngle;
  const dist = Math.min(60, Math.sqrt(dx * dx + dy * dy) * 0.5);

  const coneX = Math.cos(angleToPlayer) * dist;
  const coneY = Math.sin(angleToPlayer) * dist;

  const gradient = ctx.createRadialGradient(0, 0, 3, coneX, coneY, 32);
  gradient.addColorStop(0, 'rgba(251, 191, 36, 0.12)');
  gradient.addColorStop(0.5, 'rgba(251, 191, 36, 0.06)');
  gradient.addColorStop(1, 'rgba(251, 191, 36, 0)');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(coneX, coneY, 32, 0, Math.PI * 2);
  ctx.fill();
}
