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
  bodyLength: 28,
  bodyWidth: 12,
  wingSpan: 28,
  wingWidth: 7,
  wingAccentSpan: 22,
  wingAccentWidth: 4.2,
  tailWidth: 8,
  tailHeight: 8,
  propellerRadius: 5.6,
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

  const cabinWidth = Math.max(4.4, tuning.bodyWidth * 0.46);
  const cabinHeight = Math.max(6.4, tuning.bodyWidth * 0.68);
  const wingOffsetX = tuning.bodyLength * 0.03;

  // Slightly stronger shadow/keyline for readability on bright pages.
  ctx.fillStyle = 'rgba(15, 23, 42, 0.18)';
  ctx.beginPath();
  ctx.ellipse(-1.0, 6.1, tuning.bodyLength * 0.29, 2.1, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
  ctx.beginPath();
  ctx.roundRect(
    -tuning.bodyLength / 2 - 0.8,
    -tuning.bodyWidth / 2 - 0.8,
    tuning.bodyLength + 1.6,
    tuning.bodyWidth + 1.6,
    3.5,
  );
  ctx.fill();

  ctx.fillStyle = '#e2e8f0';
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(
    -tuning.bodyLength / 2,
    -tuning.bodyWidth / 2,
    tuning.bodyLength,
    tuning.bodyWidth,
    3,
  );
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(-cabinWidth / 2, -cabinHeight / 2, cabinWidth, cabinHeight);

  ctx.fillStyle = '#93c5fd';
  ctx.fillRect(
    wingOffsetX - tuning.wingWidth / 2,
    -tuning.wingSpan / 2,
    tuning.wingWidth,
    tuning.wingSpan,
  );
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(
    wingOffsetX - tuning.wingWidth / 2,
    -tuning.wingSpan / 2,
    tuning.wingWidth,
    tuning.wingSpan,
  );
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(
    wingOffsetX - tuning.wingAccentWidth / 2,
    -tuning.wingAccentSpan / 2,
    tuning.wingAccentWidth,
    tuning.wingAccentSpan,
  );

  ctx.fillStyle = '#334155';
  ctx.fillRect(
    -tuning.bodyLength / 2 + 2.2,
    -tuning.tailHeight / 2,
    tuning.tailWidth,
    tuning.tailHeight,
  );
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 1.0;
  ctx.strokeRect(
    -tuning.bodyLength / 2 + 2.2,
    -tuning.tailHeight / 2,
    tuning.tailWidth,
    tuning.tailHeight,
  );

  const noseX = tuning.bodyLength / 2 + 2.4;
  ctx.fillStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.moveTo(tuning.bodyLength / 2 - 1.2, -tuning.bodyWidth / 2 + 1.1);
  ctx.lineTo(noseX, 0);
  ctx.lineTo(tuning.bodyLength / 2 - 1.2, tuning.bodyWidth / 2 - 1.1);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(tuning.bodyLength / 2 - 1.3, -0.9, 2.1, 1.8);

  ctx.fillStyle = 'rgba(249, 168, 212, 0.58)';
  ctx.beginPath();
  ctx.arc(noseX, 0, tuning.propellerRadius, 0, Math.PI * 2);
  ctx.fill();

  const propPulse = 0.9 + 0.1 * Math.sin(now / 64);
  ctx.strokeStyle = 'rgba(249, 168, 212, 0.72)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(noseX, 0, tuning.propellerRadius * propPulse, 0, Math.PI * 2);
  ctx.stroke();

  // Add light rotating blades so the propeller reads as motion, not only a circle.
  const bladeAngle = now / 48;
  const bladeRadius = tuning.propellerRadius * 0.92;
  ctx.strokeStyle = 'rgba(251, 207, 232, 0.86)';
  ctx.lineCap = 'round';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(noseX - Math.cos(bladeAngle) * bladeRadius, -Math.sin(bladeAngle) * bladeRadius);
  ctx.lineTo(noseX + Math.cos(bladeAngle) * bladeRadius, Math.sin(bladeAngle) * bladeRadius);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(
    noseX - Math.cos(bladeAngle + Math.PI / 2) * (bladeRadius * 0.78),
    -Math.sin(bladeAngle + Math.PI / 2) * (bladeRadius * 0.78),
  );
  ctx.lineTo(
    noseX + Math.cos(bladeAngle + Math.PI / 2) * (bladeRadius * 0.78),
    Math.sin(bladeAngle + Math.PI / 2) * (bladeRadius * 0.78),
  );
  ctx.stroke();
  ctx.lineCap = 'butt';

  ctx.fillStyle = '#fbcfe8';
  ctx.beginPath();
  ctx.arc(noseX, 0, 1.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
