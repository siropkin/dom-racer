import type { SpecialEffect, VehicleDesign, ViewportSize, WorldPickup } from '../shared/types';
import {
  SHOWCASE_THEMES,
  SHOWCASE_TOAST_MESSAGES,
  getSpecialColor,
  getSpecialLabel,
} from './gameRuntime';
import { drawOvergrowthNodes } from './gameRenderRuntime';
import type { OvergrowthNode } from './overgrowthRuntime';
import {
  renderPlaneSprite,
  POLICE_CAR_SIZE,
  renderEdgeWarningIndicator,
  renderPoliceCarSprite,
  renderPoliceWarningIndicator,
  renderPlayerSprite,
  drawRegularCoinSprite,
  drawSpecialPickupSprite,
} from './sprites';

interface DrawSpriteShowcaseOptions {
  ctx: CanvasRenderingContext2D;
  viewport: ViewportSize;
  nowMs: number;
  themeIndex: number;
  pageLightness: number;
}

interface DrawCaughtGameOverOptions {
  ctx: CanvasRenderingContext2D;
  viewport: ViewportSize;
  nowMs: number;
  startedAtMs: number;
  score: number;
}

interface DrawPausedOverlayOptions {
  ctx: CanvasRenderingContext2D;
  viewport: ViewportSize;
  nowMs: number;
  startedAtMs: number;
}

/** Renders the full-screen sprite showcase debug overlay (Shift+D). */
export function drawSpriteShowcaseOverlay({
  ctx,
  viewport,
  nowMs,
  themeIndex,
  pageLightness,
}: DrawSpriteShowcaseOptions): void {
  const { width, height } = viewport;
  const theme = SHOWCASE_THEMES[themeIndex];

  ctx.save();
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = theme.grid;
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(width, y + 0.5);
    ctx.stroke();
  }

  ctx.fillStyle = theme.title;
  ctx.font = 'bold 14px "SFMono-Regular", "JetBrains Mono", monospace';
  ctx.fillText('SPRITE SHOWCASE', 20, 20);
  ctx.fillStyle = theme.subtitle;
  ctx.font = '11px "SFMono-Regular", "JetBrains Mono", monospace';
  ctx.fillText('SHIFT+D TO EXIT + RESTART', 20, 38);
  ctx.fillText(`ARROWS THEME: ${theme.name}`, 20, 54);
  ctx.fillText(`AUTO PAGE LUMA: ${Math.round(pageLightness * 100)}%`, 20, 70);

  const carsBaseY = 102;
  const carXs = [80, 130, 180] as const;
  const designs: VehicleDesign[] = ['coupe', 'buggy', 'truck'];
  carXs.forEach((x, index) => {
    renderPlayerSprite(ctx, {
      centerX: x,
      centerY: carsBaseY,
      angle: -0.24,
      design: designs[index],
      boostActive: index === 2,
      magnetActive: false,
      opacity: 1,
      nowMs,
    });
    renderPlayerSprite(ctx, {
      centerX: x,
      centerY: carsBaseY + 36,
      angle: -0.24,
      design: designs[index],
      boostActive: false,
      magnetActive: false,
      opacity: 0.46,
      nowMs,
    });
    renderPlayerSprite(ctx, {
      centerX: x,
      centerY: carsBaseY + 72,
      angle: -0.24,
      design: designs[index],
      boostActive: false,
      magnetActive: true,
      opacity: 1,
      nowMs,
    });
  });

  renderPlaneSprite(ctx, { x: width * 0.52, y: carsBaseY - 6, angle: 0.48 }, nowMs, {
    wobbleRadians: Math.sin(nowMs / 220) * 0.022,
    scale: 1.08,
    snapToPixel: true,
  });

  renderPoliceCarSprite(
    ctx,
    {
      x: width * 0.68,
      y: carsBaseY - POLICE_CAR_SIZE.height / 2,
      angle: 0.38,
    },
    nowMs,
  );

  renderPoliceWarningIndicator(
    ctx,
    viewport,
    { edge: 'right', remainingMs: 600, durationMs: 1100 },
    nowMs,
  );

  renderEdgeWarningIndicator(ctx, viewport, nowMs, {
    edge: 'left',
    label: 'NYOOM',
    colorOn: '#f9a8d4',
    colorOff: '#be185d',
    flashPeriodMs: 82,
    padding: 18,
  });
  const pickupsY = Math.max(176, Math.min(height - 72, carsBaseY + 112));
  const coinRadius = 9;
  const coinSpinA = Math.abs(Math.sin(nowMs / 180));
  const coinSpinB = Math.abs(Math.sin(nowMs / 180 + 0.75));
  drawRegularCoinSprite(ctx, {
    centerX: 70,
    centerY: pickupsY,
    radius: coinRadius,
    width: Math.max(3.5, coinRadius * (0.3 + coinSpinA * 0.7)),
    isFlowCoin: false,
  });
  drawRegularCoinSprite(ctx, {
    centerX: 102,
    centerY: pickupsY,
    radius: coinRadius,
    width: Math.max(3.5, coinRadius * (0.3 + coinSpinB * 0.7)),
    isFlowCoin: true,
  });

  const specialEffects: SpecialEffect[] = [
    'bonus',
    'magnet',
    'invert',
    'ghost',
    'blackout',
    'cooldown',
    'lure',
    'jackpot',
  ];
  specialEffects.forEach((effect, index) => {
    const pickup: WorldPickup = {
      id: `showcase:${effect}:${index}`,
      rect: { x: 0, y: 0, width: 18, height: 18 },
      value: 0,
      kind: 'special',
      effect,
      accentColor: getSpecialColor(effect),
      label: getSpecialLabel(effect),
    };
    drawSpecialPickupSprite(ctx, pickup, {
      centerX: 154 + index * 30,
      centerY: pickupsY,
      radius: 9,
      spin: Math.abs(Math.sin(nowMs / 180 + index * 0.75)),
      nowMs,
    });
  });

  const overgrowthY = pickupsY + 32;
  ctx.fillStyle = theme.subtitle;
  ctx.font = 'bold 9px "SFMono-Regular", "JetBrains Mono", monospace';
  ctx.fillText('OVERGROWTH', 70, overgrowthY - 8);
  const showcaseOvergrowthNodes: OvergrowthNode[] = [
    {
      id: 'showcase:bush:small',
      kind: 'bush',
      rect: { x: 62, y: overgrowthY, width: 28, height: 10 },
      anchorRect: { x: 50, y: overgrowthY + 10, width: 60, height: 20 },
      anchorEdge: 'top',
      stage: 'small',
      growthMs: 3000,
      spawnedAtRunMs: 35000,
    },
    {
      id: 'showcase:bush:medium',
      kind: 'bush',
      rect: { x: 104, y: overgrowthY - 5, width: 32, height: 20 },
      anchorRect: { x: 90, y: overgrowthY + 15, width: 60, height: 20 },
      anchorEdge: 'top',
      stage: 'medium',
      growthMs: 4000,
      spawnedAtRunMs: 36000,
    },
    {
      id: 'showcase:bush:large',
      kind: 'bush',
      rect: { x: 150, y: overgrowthY - 8, width: 36, height: 32 },
      anchorRect: { x: 136, y: overgrowthY + 24, width: 60, height: 20 },
      anchorEdge: 'top',
      stage: 'large',
      growthMs: 6000,
      spawnedAtRunMs: 37000,
    },
    {
      id: 'showcase:tree:small',
      kind: 'tree',
      rect: { x: 206, y: overgrowthY, width: 28, height: 10 },
      anchorRect: { x: 196, y: overgrowthY + 10, width: 60, height: 20 },
      anchorEdge: 'top',
      stage: 'small',
      growthMs: 3000,
      spawnedAtRunMs: 35000,
    },
    {
      id: 'showcase:tree:medium',
      kind: 'tree',
      rect: { x: 248, y: overgrowthY - 5, width: 32, height: 20 },
      anchorRect: { x: 236, y: overgrowthY + 15, width: 60, height: 20 },
      anchorEdge: 'top',
      stage: 'medium',
      growthMs: 4000,
      spawnedAtRunMs: 36000,
    },
    {
      id: 'showcase:tree:large',
      kind: 'tree',
      rect: { x: 294, y: overgrowthY - 8, width: 36, height: 32 },
      anchorRect: { x: 280, y: overgrowthY + 24, width: 60, height: 20 },
      anchorEdge: 'top',
      stage: 'large',
      growthMs: 6000,
      spawnedAtRunMs: 37000,
    },
  ];
  drawOvergrowthNodes(ctx, showcaseOvergrowthNodes, nowMs);

  const toastCols = 3;
  const toastWidth = 66;
  const toastHeight = 16;
  const toastGap = 6;
  const toastPanelX = width - (toastCols * toastWidth + (toastCols - 1) * toastGap) - 18;
  const toastPanelY = pickupsY - 56;
  ctx.fillStyle = theme.toastPanel;
  ctx.fillRect(
    toastPanelX - 8,
    toastPanelY - 22,
    toastCols * toastWidth + (toastCols - 1) * toastGap + 16,
    Math.ceil(SHOWCASE_TOAST_MESSAGES.length / toastCols) * (toastHeight + toastGap) + 32,
  );
  ctx.fillStyle = theme.subtitle;
  ctx.font = 'bold 10px "SFMono-Regular", "JetBrains Mono", monospace';
  ctx.fillText('TOASTS', toastPanelX - 2, toastPanelY - 8);

  SHOWCASE_TOAST_MESSAGES.forEach((text, index) => {
    const col = index % toastCols;
    const row = Math.floor(index / toastCols);
    const x = toastPanelX + col * (toastWidth + toastGap);
    const y = toastPanelY + row * (toastHeight + toastGap);
    ctx.fillStyle = theme.toastCard;
    ctx.fillRect(x, y, toastWidth, toastHeight);
    ctx.strokeStyle = theme.toastStroke;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, toastWidth - 1, toastHeight - 1);
    ctx.fillStyle = theme.toastText;
    ctx.font = 'bold 9px "SFMono-Regular", "JetBrains Mono", monospace';
    ctx.fillText(text, x + 4, y + 11);
  });

  ctx.restore();
}

/** Renders the "BUSTED BY POLICE — GAME OVER" screen with score and restart prompt. */
export function drawCaughtGameOverOverlay({
  ctx,
  viewport,
  nowMs,
  startedAtMs,
  score,
}: DrawCaughtGameOverOptions): void {
  const { width, height } = viewport;
  const flash = Math.sin((nowMs - startedAtMs) / 240) > 0 ? 1 : 0.72;

  ctx.save();
  ctx.fillStyle = 'rgba(2, 6, 23, 0.94)';
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = 'bold 18px "SFMono-Regular", "JetBrains Mono", monospace';
  ctx.fillStyle = '#f87171';
  ctx.fillText('BUSTED BY POLICE', width / 2, height / 2 - 82);

  ctx.font = 'bold 48px "SFMono-Regular", "JetBrains Mono", monospace';
  ctx.fillStyle = 'rgba(96, 165, 250, 0.72)';
  ctx.fillText('GAME OVER', width / 2 + 3, height / 2 - 16);
  ctx.fillStyle = 'rgba(251, 113, 133, 0.78)';
  ctx.fillText('GAME OVER', width / 2 - 3, height / 2 - 16);
  ctx.fillStyle = '#f8fafc';
  ctx.fillText('GAME OVER', width / 2, height / 2 - 18);

  ctx.font = 'bold 16px "SFMono-Regular", "JetBrains Mono", monospace';
  ctx.fillStyle = '#fde68a';
  ctx.fillText(`SCORE ${score.toString().padStart(4, '0')}`, width / 2, height / 2 + 32);

  ctx.font = 'bold 14px "SFMono-Regular", "JetBrains Mono", monospace';
  ctx.fillStyle = `rgba(226, 232, 240, ${flash})`;
  ctx.fillText('PRESS SPACE TO RESTART', width / 2, height / 2 + 84);
  ctx.fillStyle = 'rgba(148, 163, 184, 0.9)';
  ctx.fillText('ESC TO QUIT', width / 2, height / 2 + 108);
  ctx.restore();
}

/** Renders the "PAUSED" overlay shown when the page loses focus. */
export function drawPausedOverlay({
  ctx,
  viewport,
  nowMs,
  startedAtMs,
}: DrawPausedOverlayOptions): void {
  const { width, height } = viewport;
  const pulse = 0.72 + Math.sin((nowMs - startedAtMs) / 360) * 0.2;

  ctx.save();
  ctx.fillStyle = 'rgba(2, 6, 23, 0.86)';
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = 'bold 44px "SFMono-Regular", "JetBrains Mono", monospace';
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText('PAUSED', width / 2, height / 2 - 14);

  ctx.font = 'bold 13px "SFMono-Regular", "JetBrains Mono", monospace';
  ctx.fillStyle = '#93c5fd';
  ctx.fillText('PAGE NOT IN FOCUS', width / 2, height / 2 + 24);

  ctx.font = 'bold 12px "SFMono-Regular", "JetBrains Mono", monospace';
  ctx.fillStyle = `rgba(226, 232, 240, ${pulse})`;
  ctx.fillText('RETURN TO THE TAB TO RESUME', width / 2, height / 2 + 50);

  ctx.restore();
}
