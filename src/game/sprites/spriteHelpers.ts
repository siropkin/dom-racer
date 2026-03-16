/**
 * Reusable canvas drawing primitives shared across sprite renderers.
 * Extracted from playerSprite, policeSprite, planeSprite, and pickupSprites
 * to eliminate duplicated rounded-rect, wheel, contour, and star patterns.
 */

/**
 * Rounded rectangle with fill and optional stroke.
 * Covers the most common sprite pattern: body panels, cabins, windows, shadows.
 */
export function drawBorderedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rx: number,
  fill: string,
  stroke?: string,
  strokeWidth?: number,
): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, rx);
  ctx.fill();
  if (stroke !== undefined && strokeWidth !== undefined) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }
}

/**
 * Standard game wheel — dark rounded rect with light border.
 * Player wheels use halfHeight 1.75, police wheels use 1.8.
 */
export function drawWheel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  halfHeight = 1.75,
): void {
  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.roundRect(x - 3.5, y - halfHeight, 7, halfHeight * 2, 1.4);
  ctx.fill();
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 1.1;
  ctx.stroke();
}

/**
 * Stroke-only rounded rect for dark contour/keyline readability borders.
 * Used on coupe and truck bodies to ensure visibility on bright pages.
 */
export function drawContourOutline(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rx: number,
  color: string,
  lineWidth: number,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, rx);
  ctx.stroke();
}

/**
 * Traces a multi-pointed star path on the canvas context without filling or stroking.
 * Caller is responsible for fill/stroke after this call.
 */
export function traceStarPath(
  ctx: CanvasRenderingContext2D,
  points: number,
  outerR: number,
  innerR: number,
): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const rad = i % 2 === 0 ? outerR : innerR;
    if (i === 0) {
      ctx.moveTo(Math.cos(angle) * rad, Math.sin(angle) * rad);
    } else {
      ctx.lineTo(Math.cos(angle) * rad, Math.sin(angle) * rad);
    }
  }
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// Adaptive sprite contrast — page-lightness-aware outline / glow
// ---------------------------------------------------------------------------

let _pageLightness = 0.5;

export function setPageLightnessForSprites(lightness: number): void {
  _pageLightness = lightness;
}

export function getPageLightness(): number {
  return _pageLightness;
}

/**
 * Sets canvas shadow to provide adaptive contrast against the page surface.
 * Bright pages get a dark outline; dark pages get a light glow.
 * Strength scales with how far the lightness deviates from neutral (0.5).
 */
export function applyAdaptiveShadow(ctx: CanvasRenderingContext2D): void {
  const deviation = Math.abs(_pageLightness - 0.5) * 2;
  const alpha = 0.3 + deviation * 0.3;
  const blur = 2.5 + deviation * 1.5;

  ctx.shadowColor =
    _pageLightness > 0.5 ? `rgba(15, 23, 42, ${alpha})` : `rgba(248, 250, 252, ${alpha})`;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

export function clearAdaptiveShadow(ctx: CanvasRenderingContext2D): void {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
}
