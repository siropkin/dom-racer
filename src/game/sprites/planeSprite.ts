import { drawBorderedRect } from './spriteHelpers';

export interface PlaneSpritePose {
  x: number;
  y: number;
  angle: number;
}

export interface PlaneSpriteTuning {
  bodyLength: number;
  bodyWidth: number;
  wingSpan: number;
  wingWidth: number;
  wingAccentSpan: number;
  wingAccentWidth: number;
  tailWidth: number;
  tailHeight: number;
  propellerRadius: number;
}

interface PlaneSpriteRenderOptions {
  wobbleRadians?: number;
  scale?: number;
  tuning?: Partial<PlaneSpriteTuning>;
  snapToPixel?: boolean;
}

export const DEFAULT_PLANE_SPRITE_TUNING: PlaneSpriteTuning = {
  bodyLength: 32,
  bodyWidth: 10,
  wingSpan: 36,
  wingWidth: 7,
  wingAccentSpan: 30,
  wingAccentWidth: 4.2,
  tailWidth: 10,
  tailHeight: 8,
  propellerRadius: 6.4,
};
let runtimePlaneSpriteTuning: PlaneSpriteTuning = { ...DEFAULT_PLANE_SPRITE_TUNING };

export function getPlaneSpriteTuning(): PlaneSpriteTuning {
  return { ...runtimePlaneSpriteTuning };
}

export function setPlaneSpriteTuning(update: Partial<PlaneSpriteTuning>): PlaneSpriteTuning {
  runtimePlaneSpriteTuning = {
    ...runtimePlaneSpriteTuning,
    ...update,
  };
  return { ...runtimePlaneSpriteTuning };
}

export function resetPlaneSpriteTuning(): PlaneSpriteTuning {
  runtimePlaneSpriteTuning = { ...DEFAULT_PLANE_SPRITE_TUNING };
  return { ...runtimePlaneSpriteTuning };
}

export function renderPlaneSprite(
  ctx: CanvasRenderingContext2D,
  pose: PlaneSpritePose,
  now: number,
  options: PlaneSpriteRenderOptions = {},
): void {
  const tuning: PlaneSpriteTuning = {
    ...runtimePlaneSpriteTuning,
    ...options.tuning,
  };
  const wobble = options.wobbleRadians ?? 0;
  const scale = options.scale ?? 1;
  const drawX = options.snapToPixel ? Math.round(pose.x) : pose.x;
  const drawY = options.snapToPixel ? Math.round(pose.y) : pose.y;

  ctx.save();
  ctx.translate(drawX, drawY);
  ctx.rotate(pose.angle + wobble);
  ctx.scale(scale, scale);

  const halfBody = tuning.bodyLength / 2;
  const halfWidth = tuning.bodyWidth / 2;
  const halfWingSpan = tuning.wingSpan / 2;
  const noseX = halfBody + 3;

  // --- shadow ---
  ctx.fillStyle = 'rgba(15, 23, 42, 0.16)';
  ctx.beginPath();
  ctx.ellipse(0, 5.5, tuning.bodyLength * 0.32, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // --- lower wing (behind fuselage) ---
  const lowerWingX = -1;
  drawBorderedRect(
    ctx,
    lowerWingX - tuning.wingWidth / 2,
    -halfWingSpan,
    tuning.wingWidth,
    tuning.wingSpan,
    1.4,
    '#7dd3fc',
    '#f8fafc',
    1.0,
  );
  ctx.fillStyle = '#0369a1';
  ctx.fillRect(
    lowerWingX - tuning.wingAccentWidth / 2,
    -tuning.wingAccentSpan / 2,
    tuning.wingAccentWidth,
    tuning.wingAccentSpan,
  );

  // --- fuselage contour (dark outline behind) ---
  drawBorderedRect(
    ctx,
    -halfBody - 1,
    -halfWidth - 1,
    tuning.bodyLength + 2,
    tuning.bodyWidth + 2,
    3.5,
    'rgba(15, 23, 42, 0.68)',
  );

  // --- fuselage body ---
  drawBorderedRect(
    ctx,
    -halfBody,
    -halfWidth,
    tuning.bodyLength,
    tuning.bodyWidth,
    3,
    '#e2e8f0',
    '#f8fafc',
    1.6,
  );

  // --- fuselage accent stripe ---
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(-halfBody + 4, -1, tuning.bodyLength - 10, 2);

  // --- cockpit (dark windshield) ---
  const cockpitW = Math.max(4, halfWidth * 0.9);
  const cockpitH = Math.max(5.6, tuning.bodyWidth * 0.58);
  ctx.fillStyle = '#1e3a8a';
  ctx.beginPath();
  ctx.roundRect(-cockpitW / 2 + 1, -cockpitH / 2, cockpitW, cockpitH, 1.6);
  ctx.fill();
  ctx.fillStyle = 'rgba(147, 197, 253, 0.5)';
  ctx.fillRect(-cockpitW / 2 + 1.6, -cockpitH / 2 + 1.2, cockpitW * 0.4, cockpitH - 2.4);

  // --- upper wing (in front of fuselage) ---
  const upperWingX = 1;
  drawBorderedRect(
    ctx,
    upperWingX - tuning.wingWidth / 2,
    -halfWingSpan,
    tuning.wingWidth,
    tuning.wingSpan,
    1.4,
    '#93c5fd',
    '#f8fafc',
    1.0,
  );
  ctx.fillStyle = '#1e40af';
  ctx.fillRect(
    upperWingX - tuning.wingAccentWidth / 2,
    -tuning.wingAccentSpan / 2,
    tuning.wingAccentWidth,
    tuning.wingAccentSpan,
  );

  // --- wing struts (connecting upper and lower wings) ---
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.2;
  const strutSpacing = halfWingSpan * 0.55;
  for (const side of [-1, 1]) {
    const sy = side * strutSpacing;
    ctx.beginPath();
    ctx.moveTo(lowerWingX, sy);
    ctx.lineTo(upperWingX, sy);
    ctx.stroke();
  }

  // --- horizontal stabilizer (tail wings) ---
  const tailX = -halfBody + 2;
  drawBorderedRect(
    ctx,
    tailX,
    -tuning.tailHeight / 2,
    tuning.tailWidth,
    tuning.tailHeight,
    1.2,
    '#475569',
    '#f8fafc',
    0.9,
  );

  // --- vertical stabilizer (tail fin) ---
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.moveTo(tailX, 0);
  ctx.lineTo(tailX - 4, -halfWidth * 0.6);
  ctx.lineTo(tailX + 3, -halfWidth * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // --- nose cone ---
  ctx.fillStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.moveTo(halfBody - 1.5, -halfWidth + 1.4);
  ctx.lineTo(noseX, 0);
  ctx.lineTo(halfBody - 1.5, halfWidth - 1.4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 0.9;
  ctx.stroke();

  // --- engine block ---
  ctx.fillStyle = '#64748b';
  ctx.fillRect(halfBody - 2, -2.6, 3, 5.2);
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 0.7;
  ctx.strokeRect(halfBody - 2, -2.6, 3, 5.2);

  // --- propeller disc (translucent spinning blur) ---
  const propR = tuning.propellerRadius;
  ctx.fillStyle = 'rgba(249, 168, 212, 0.42)';
  ctx.beginPath();
  ctx.arc(noseX, 0, propR, 0, Math.PI * 2);
  ctx.fill();

  const propPulse = 0.88 + 0.12 * Math.sin(now / 52);
  ctx.strokeStyle = 'rgba(249, 168, 212, 0.6)';
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  ctx.arc(noseX, 0, propR * propPulse, 0, Math.PI * 2);
  ctx.stroke();

  // --- propeller blades ---
  const bladeAngle = now / 36;
  const bladeR = propR * 0.94;
  ctx.strokeStyle = 'rgba(251, 207, 232, 0.92)';
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(noseX - Math.cos(bladeAngle) * bladeR, -Math.sin(bladeAngle) * bladeR);
  ctx.lineTo(noseX + Math.cos(bladeAngle) * bladeR, Math.sin(bladeAngle) * bladeR);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(
    noseX - Math.cos(bladeAngle + Math.PI / 2) * bladeR,
    -Math.sin(bladeAngle + Math.PI / 2) * bladeR,
  );
  ctx.lineTo(
    noseX + Math.cos(bladeAngle + Math.PI / 2) * bladeR,
    Math.sin(bladeAngle + Math.PI / 2) * bladeR,
  );
  ctx.stroke();
  ctx.lineCap = 'butt';

  // --- propeller hub ---
  ctx.fillStyle = '#f9a8d4';
  ctx.beginPath();
  ctx.arc(noseX, 0, 1.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
