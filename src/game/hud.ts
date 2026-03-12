import type { HudState, ViewportSize } from '../shared/types';
import { formatElapsed } from '../shared/utils';

export function drawHud(
  ctx: CanvasRenderingContext2D,
  viewport: ViewportSize,
  state: HudState,
): void {
  ctx.save();
  ctx.font = '12px "SFMono-Regular", "JetBrains Mono", monospace';
  ctx.textBaseline = 'top';

  ctx.fillStyle = 'rgba(2, 6, 23, 0.84)';
  ctx.fillRect(16, 16, 150, 48);
  ctx.fillStyle = 'rgba(34, 211, 238, 0.88)';
  ctx.fillRect(16, 16, 150, 2);

  ctx.fillStyle = '#f8fafc';
  ctx.fillText(`TIME  ${formatElapsed(state.elapsedMs)}`, 28, 28);
  ctx.fillText(`SCORE ${state.score.toString().padStart(4, '0')}`, 28, 46);

  ctx.fillStyle = 'rgba(2, 6, 23, 0.9)';
  const hintWidth = 250;
  const hintX = viewport.width - hintWidth - 16;
  const hintY = viewport.height - 72;
  ctx.fillRect(hintX, hintY, hintWidth, 56);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.44)';
  ctx.lineWidth = 1;
  ctx.strokeRect(hintX + 0.5, hintY + 0.5, hintWidth - 1, 55);
  ctx.fillStyle = 'rgba(168, 85, 247, 0.82)';
  ctx.fillRect(hintX, hintY, hintWidth, 2);
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText('V CAR  |  M SOUND', hintX + 12, hintY + 10);
  drawSoundStateChip(ctx, hintX + 152, hintY + 8, state.soundEnabled);
  ctx.fillText('ARROWS DRIVE  |  ESC QUIT', hintX + 12, hintY + 30);

  if (state.activeEffects.length > 0) {
    drawActiveEffects(ctx, viewport, state);
  }

  if (state.pageBestScore > 0 || state.lifetimeBestScore > 0) {
    drawScoreMemory(ctx, viewport, state);
  }

  ctx.restore();
}

function drawSoundStateChip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  soundEnabled: boolean,
): void {
  const label = soundEnabled ? 'ON' : 'OFF';
  const border = soundEnabled ? '#67e8f9' : '#fca5a5';
  const fill = soundEnabled ? 'rgba(8, 145, 178, 0.26)' : 'rgba(185, 28, 28, 0.26)';
  const text = soundEnabled ? '#a5f3fc' : '#fecaca';
  const width = 46;
  const height = 16;

  ctx.fillStyle = fill;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
  ctx.fillStyle = text;
  ctx.fillText(label, x + 14, y + 3);
}

function drawActiveEffects(ctx: CanvasRenderingContext2D, viewport: ViewportSize, state: HudState): void {
  const panelWidth = 164;
  const rowHeight = 28;
  const panelHeight = 20 + state.activeEffects.length * rowHeight;
  const panelX = viewport.width - panelWidth - 16;
  const panelY = 16;

  ctx.fillStyle = 'rgba(2, 6, 23, 0.86)';
  ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
  ctx.fillStyle = 'rgba(248, 250, 252, 0.78)';
  ctx.fillRect(panelX, panelY, panelWidth, 2);

  ctx.fillStyle = '#cbd5e1';
  ctx.fillText('POWER', panelX + 12, panelY + 8);

  state.activeEffects.forEach((effect, index) => {
    const rowY = panelY + 22 + index * rowHeight;
    const remainingSeconds = Math.max(0, effect.remainingMs) / 1000;
    const progress = Math.max(0, Math.min(1, effect.remainingMs / Math.max(1, effect.durationMs)));

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(panelX + 10, rowY, panelWidth - 20, 18);
    ctx.fillStyle = effect.color;
    ctx.fillRect(panelX + 10, rowY, Math.max(10, (panelWidth - 20) * progress), 18);

    ctx.fillStyle = effect.effect === 'blackout' ? '#f8fafc' : '#020617';
    ctx.fillText(effect.label, panelX + 16, rowY + 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${remainingSeconds.toFixed(1)}s`, panelX + panelWidth - 48, rowY + 4);
  });
}

function drawScoreMemory(ctx: CanvasRenderingContext2D, viewport: ViewportSize, state: HudState): void {
  const panelWidth = 210;
  const panelHeight = 52;
  const panelX = 16;
  const panelY = viewport.height - 68;

  ctx.fillStyle = 'rgba(2, 6, 23, 0.82)';
  ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
  ctx.fillStyle = 'rgba(34, 211, 238, 0.84)';
  ctx.fillRect(panelX, panelY, panelWidth, 2);
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText(`PAGE BEST ${state.pageBestScore.toString().padStart(4, '0')}`, panelX + 12, panelY + 10);
  ctx.fillText(`LIFE BEST ${state.lifetimeBestScore.toString().padStart(4, '0')}`, panelX + 12, panelY + 28);
}
