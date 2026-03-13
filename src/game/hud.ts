import type { HudState, ViewportSize } from '../shared/types';
import { formatElapsed } from '../shared/utils';

const HUD_FONT = '12px "SFMono-Regular", "JetBrains Mono", monospace';
const HUD_FONT_SMALL = 'bold 10px "SFMono-Regular", "JetBrains Mono", monospace';
const HUD_MARGIN = 16;
const HUD_PANEL_BG = 'rgba(2, 6, 23, 0.84)';
const HUD_ACCENT_HEIGHT = 2;
const HUD_TEXT_COLOR = '#f8fafc';
const HUD_TEXT_DIM = '#e2e8f0';
const HUD_TEXT_MUTED = '#cbd5e1';

export function drawHud(
  ctx: CanvasRenderingContext2D,
  viewport: ViewportSize,
  state: HudState,
): void {
  ctx.save();
  ctx.textBaseline = 'top';

  drawScorePanel(ctx, state);

  drawControlsHint(ctx, viewport, state);

  if (state.activeEffects.length > 0) {
    drawActiveEffects(ctx, viewport, state);
  }

  if (state.objectiveText) {
    drawObjectivePanel(ctx, viewport, state);
  }

  if (state.pageBestScore > 0 || state.lifetimeBestScore > 0) {
    drawScoreMemory(ctx, viewport, state);
  }

  ctx.restore();
}

function drawScorePanel(ctx: CanvasRenderingContext2D, state: HudState): void {
  const w = 150;
  const h = 48;
  ctx.fillStyle = HUD_PANEL_BG;
  ctx.fillRect(HUD_MARGIN, HUD_MARGIN, w, h);
  ctx.fillStyle = 'rgba(34, 211, 238, 0.88)';
  ctx.fillRect(HUD_MARGIN, HUD_MARGIN, w, HUD_ACCENT_HEIGHT);

  ctx.font = HUD_FONT;
  ctx.fillStyle = HUD_TEXT_COLOR;
  ctx.fillText(`TIME  ${formatElapsed(state.elapsedMs)}`, HUD_MARGIN + 12, HUD_MARGIN + 12);
  ctx.fillText(
    `SCORE ${state.score.toString().padStart(4, '0')}`,
    HUD_MARGIN + 12,
    HUD_MARGIN + 30,
  );
}

function drawControlsHint(
  ctx: CanvasRenderingContext2D,
  viewport: ViewportSize,
  state: HudState,
): void {
  const w = 250;
  const h = 56;
  const x = viewport.width - w - HUD_MARGIN;
  const y = viewport.height - h - HUD_MARGIN;

  ctx.fillStyle = 'rgba(2, 6, 23, 0.9)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.44)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.fillStyle = 'rgba(168, 85, 247, 0.82)';
  ctx.fillRect(x, y, w, HUD_ACCENT_HEIGHT);

  ctx.font = HUD_FONT;
  ctx.fillStyle = HUD_TEXT_DIM;
  ctx.fillText('V CAR  |  M SOUND', x + 12, y + 10);
  drawSoundStateChip(ctx, x + 152, y + 8, state.soundEnabled);
  ctx.font = HUD_FONT;
  ctx.fillText('ARROWS DRIVE  |  ESC QUIT', x + 12, y + 30);
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
  ctx.font = HUD_FONT;
  ctx.fillStyle = text;
  ctx.fillText(label, x + 14, y + 3);
}

function drawActiveEffects(
  ctx: CanvasRenderingContext2D,
  viewport: ViewportSize,
  state: HudState,
): void {
  const panelWidth = 164;
  const rowHeight = 28;
  const panelHeight = 20 + state.activeEffects.length * rowHeight;
  const panelX = viewport.width - panelWidth - HUD_MARGIN;
  const panelY = HUD_MARGIN;

  ctx.fillStyle = 'rgba(2, 6, 23, 0.86)';
  ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
  ctx.fillStyle = 'rgba(248, 250, 252, 0.78)';
  ctx.fillRect(panelX, panelY, panelWidth, HUD_ACCENT_HEIGHT);

  ctx.font = HUD_FONT;
  ctx.fillStyle = HUD_TEXT_MUTED;
  ctx.fillText('POWER', panelX + 12, panelY + 8);

  state.activeEffects.forEach((effect, index) => {
    const rowY = panelY + 22 + index * rowHeight;
    const remainingSeconds = Math.max(0, effect.remainingMs) / 1000;
    const progress = Math.max(0, Math.min(1, effect.remainingMs / Math.max(1, effect.durationMs)));

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(panelX + 10, rowY, panelWidth - 20, 18);
    ctx.fillStyle = effect.color;
    ctx.fillRect(panelX + 10, rowY, Math.max(10, (panelWidth - 20) * progress), 18);

    ctx.font = HUD_FONT;
    ctx.fillStyle = effect.effect === 'blackout' ? '#f8fafc' : '#020617';
    ctx.fillText(effect.label, panelX + 16, rowY + 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${remainingSeconds.toFixed(1)}s`, panelX + panelWidth - 48, rowY + 4);
  });
}

function drawObjectivePanel(
  ctx: CanvasRenderingContext2D,
  viewport: ViewportSize,
  state: HudState,
): void {
  if (!state.objectiveText) {
    return;
  }

  const panelWidth = 220;
  const panelHeight = 32;
  const panelX = Math.round(viewport.width / 2 - panelWidth / 2);
  const panelY = viewport.height - panelHeight - HUD_MARGIN;

  ctx.fillStyle = HUD_PANEL_BG;
  ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
  ctx.fillStyle = 'rgba(167, 139, 250, 0.82)';
  ctx.fillRect(panelX, panelY, panelWidth, HUD_ACCENT_HEIGHT);

  ctx.font = HUD_FONT_SMALL;
  ctx.fillStyle = HUD_TEXT_DIM;
  ctx.fillText(`GOAL  ${state.objectiveText}`, panelX + 10, panelY + 8);

  const barX = panelX + 10;
  const barY = panelY + 24;
  const barWidth = panelWidth - 20;
  const barHeight = 3;
  ctx.fillStyle = 'rgba(100, 116, 139, 0.3)';
  ctx.fillRect(barX, barY, barWidth, barHeight);
  ctx.fillStyle = '#a78bfa';
  ctx.fillRect(barX, barY, Math.max(2, barWidth * Math.min(1, state.objectiveProgress)), barHeight);
}

function drawScoreMemory(
  ctx: CanvasRenderingContext2D,
  viewport: ViewportSize,
  state: HudState,
): void {
  const panelWidth = 180;
  const panelHeight = 48;
  const panelX = HUD_MARGIN;
  const panelY = viewport.height - panelHeight - HUD_MARGIN;

  ctx.fillStyle = HUD_PANEL_BG;
  ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
  ctx.fillStyle = 'rgba(34, 211, 238, 0.84)';
  ctx.fillRect(panelX, panelY, panelWidth, HUD_ACCENT_HEIGHT);

  ctx.font = HUD_FONT;
  ctx.fillStyle = HUD_TEXT_DIM;
  ctx.fillText(
    `PAGE BEST ${state.pageBestScore.toString().padStart(4, '0')}`,
    panelX + 12,
    panelY + 10,
  );
  ctx.fillText(
    `LIFE BEST ${state.lifetimeBestScore.toString().padStart(4, '0')}`,
    panelX + 12,
    panelY + 28,
  );
}
