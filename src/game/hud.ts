import type { HudState, ViewportSize } from '../shared/types';
import { formatElapsed } from '../shared/utils';

const HUD_FONT = '12px "SFMono-Regular", "JetBrains Mono", monospace';
const HUD_MARGIN = 16;
const HUD_PANEL_BG = 'rgba(2, 6, 23, 0.84)';
const HUD_ACCENT_HEIGHT = 2;
const HUD_TEXT_COLOR = '#f8fafc';
const HUD_TEXT_DIM = '#e2e8f0';
const HUD_TEXT_MUTED = '#cbd5e1';

const BAR_TEXT_ON_FILL = '#020617';
const BAR_TEXT_ON_EMPTY = '#e2e8f0';

/**
 * Draws text that splits color at a bar's fill edge.
 * Over the filled portion: dark color. Over the empty portion: light color.
 */
function drawBarText(
  ctx: CanvasRenderingContext2D,
  text: string,
  textX: number,
  textY: number,
  barX: number,
  barY: number,
  barWidth: number,
  barHeight: number,
  fillWidth: number,
  colorOnFill: string,
  colorOnEmpty: string,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(barX, barY, fillWidth, barHeight);
  ctx.clip();
  ctx.fillStyle = colorOnFill;
  ctx.fillText(text, textX, textY);
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.rect(barX + fillWidth, barY, barWidth - fillWidth, barHeight);
  ctx.clip();
  ctx.fillStyle = colorOnEmpty;
  ctx.fillText(text, textX, textY);
  ctx.restore();
}

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

  const goalRows = buildGoalRows(state);
  if (goalRows.length > 0) {
    drawGoalPanel(ctx, viewport, goalRows);
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

    const bx = panelX + 10;
    const bw = panelWidth - 20;
    const bh = 18;
    const fillW = bw * progress;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(bx, rowY, bw, bh);
    if (fillW > 0) {
      ctx.fillStyle = effect.color;
      ctx.fillRect(bx, rowY, fillW, bh);
    }

    ctx.font = HUD_FONT;
    const labelColorOnFill = effect.effect === 'blackout' ? '#f8fafc' : BAR_TEXT_ON_FILL;
    drawBarText(
      ctx,
      effect.label,
      bx + 6,
      rowY + 4,
      bx,
      rowY,
      bw,
      bh,
      fillW,
      labelColorOnFill,
      BAR_TEXT_ON_EMPTY,
    );
    drawBarText(
      ctx,
      `${remainingSeconds.toFixed(1)}s`,
      bx + bw - 38,
      rowY + 4,
      bx,
      rowY,
      bw,
      bh,
      fillW,
      '#ffffff',
      BAR_TEXT_ON_EMPTY,
    );
  });
}

interface GoalBarRow {
  text: string;
  color: string;
  timeRemainingMs: number;
  timeLimitMs: number;
}

function buildGoalRows(state: HudState): GoalBarRow[] {
  const rows: GoalBarRow[] = [];

  if (state.policeChaseRemainingMs !== null && state.policeChaseDurationMs !== null) {
    rows.push({
      text: 'POLICE - ESCAPE!',
      color: '#f87171',
      timeRemainingMs: state.policeChaseRemainingMs,
      timeLimitMs: state.policeChaseDurationMs,
    });
  }

  if (state.objectiveText) {
    const mult = state.objectiveMultiplierLabel ?? '';
    rows.push({
      text: `${state.objectiveText} ${mult}`,
      color: '#a78bfa',
      timeRemainingMs: state.objectiveTimeRemainingMs ?? 0,
      timeLimitMs: state.objectiveTimeLimitMs ?? 1,
    });
  }

  return rows;
}

function drawGoalPanel(
  ctx: CanvasRenderingContext2D,
  viewport: ViewportSize,
  rows: GoalBarRow[],
): void {
  const panelWidth = 210;
  const rowHeight = 28;
  const panelHeight = 20 + rows.length * rowHeight;
  const panelX = Math.round(viewport.width / 2 - panelWidth / 2);
  const panelY = viewport.height - panelHeight - HUD_MARGIN;

  ctx.fillStyle = HUD_PANEL_BG;
  ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
  ctx.fillStyle = 'rgba(167, 139, 250, 0.82)';
  ctx.fillRect(panelX, panelY, panelWidth, HUD_ACCENT_HEIGHT);

  ctx.font = HUD_FONT;
  ctx.fillStyle = HUD_TEXT_MUTED;
  ctx.fillText('GOAL', panelX + 12, panelY + 8);

  rows.forEach((row, index) => {
    const ry = panelY + 22 + index * rowHeight;
    const bx = panelX + 10;
    const bw = panelWidth - 20;
    const bh = 18;
    const timeFill = Math.max(0, Math.min(1, row.timeRemainingMs / Math.max(1, row.timeLimitMs)));
    const fillW = bw * timeFill;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(bx, ry, bw, bh);
    if (fillW > 0) {
      ctx.fillStyle = row.color;
      ctx.fillRect(bx, ry, fillW, bh);
    }

    ctx.font = HUD_FONT;
    drawBarText(
      ctx,
      row.text,
      bx + 6,
      ry + 4,
      bx,
      ry,
      bw,
      bh,
      fillW,
      BAR_TEXT_ON_FILL,
      BAR_TEXT_ON_EMPTY,
    );

    const sec = Math.max(0, row.timeRemainingMs) / 1000;
    drawBarText(
      ctx,
      `${sec.toFixed(0)}s`,
      bx + bw - 30,
      ry + 4,
      bx,
      ry,
      bw,
      bh,
      fillW,
      '#ffffff',
      BAR_TEXT_ON_EMPTY,
    );
  });
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
