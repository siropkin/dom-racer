import overlayCss from '../styles/overlay.css?inline';
import { Game } from '../game/Game';
import type { VehicleDesign } from '../shared/types';
import {
  checkAndMarkMilestones,
  incrementRunCount,
  loadScoreSummary,
  loadSoundEnabledSetting,
  loadVehicleDesignSetting,
  recordPageRun,
  saveSoundEnabledSetting,
  saveVehicleDesignSetting,
} from '../shared/settings';
import { VEHICLES } from '../game/gameConfig';
import { debounce } from '../shared/utils';
import { parseCssColor, rgbToHsl } from '../shared/color';
import { scanVisibleDom } from './domScanner';
import { ensureOverlay, setOverlayActive } from './overlay';
import { buildWorld } from './worldBuilder';

const STYLE_ID = 'dom-racer-style';

injectStyles();

const overlay = ensureOverlay();
let game: Game | null = null;
let active = false;
let previousUserSelect = '';
let previousWebkitUserSelect = '';
let previousBodyOverflow = '';
let previousDocumentOverscrollBehavior = '';
let previousBodyOverscrollBehavior = '';
let unsupportedPageDismissListener: ((event: KeyboardEvent) => void) | null = null;
let soundEnabled = true;
let vehicleDesign: VehicleDesign = 'coupe';
let pageBestScore = 0;
let lifetimeBestScore = 0;
let lifetimeTotalScore = 0;
let lifetimeRunsStarted = 0;
let lastMagnetUiUpdateAt = 0;
const magnetizedElements = new Set<HTMLElement>();

void loadSoundEnabledSetting()
  .then((value) => {
    soundEnabled = value;
    game?.setSoundEnabled(value);
  })
  .catch(() => undefined);

void loadVehicleDesignSetting()
  .then((value) => {
    vehicleDesign = value;
    game?.setVehicleDesign(value);
  })
  .catch(() => undefined);

void loadScoreSummary(window.location.href)
  .then((summary) => {
    pageBestScore = summary.pageBestScore;
    lifetimeBestScore = summary.lifetimeBestScore;
    lifetimeTotalScore = summary.lifetimeTotalScore;
    lifetimeRunsStarted = summary.lifetimeRunsStarted;
  })
  .catch(() => undefined);

const rescanWhileActive = debounce(() => {
  if (!active || !game) {
    return;
  }

  game.applyWorld(createWorld());
}, 140);

window.addEventListener(
  'keydown',
  (event) => {
    if (event.repeat) {
      return;
    }

    const altGPressed = event.altKey && event.code === 'KeyG';
    const shiftBacktickPressed = event.shiftKey && event.code === 'Backquote';
    const togglePressed = altGPressed || shiftBacktickPressed;
    if (!togglePressed && isTypingTarget(event.target)) {
      return;
    }

    if (togglePressed) {
      event.stopImmediatePropagation();
      event.preventDefault();
      toggleGame();
    }
  },
  true,
);

window.addEventListener('resize', () => {
  if (!active || !game) {
    return;
  }

  game.resize();
  rescanWhileActive();
});

function toggleGame(): void {
  if (active) {
    deactivate();
    return;
  }

  void activate();
}

async function activate(): Promise<void> {
  if (active) {
    return;
  }

  active = true;

  try {
    soundEnabled = await loadSoundEnabledSetting();
  } catch {
    /* keep current */
  }
  try {
    vehicleDesign = await loadVehicleDesignSetting();
  } catch {
    /* keep current */
  }

  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement) {
    activeElement.blur();
  }

  previousUserSelect = document.documentElement.style.userSelect;
  previousWebkitUserSelect = document.documentElement.style.webkitUserSelect;
  previousBodyOverflow = document.body.style.overflow;
  previousDocumentOverscrollBehavior = document.documentElement.style.overscrollBehavior;
  previousBodyOverscrollBehavior = document.body.style.overscrollBehavior;
  document.documentElement.style.userSelect = 'none';
  document.documentElement.style.webkitUserSelect = 'none';
  document.documentElement.style.overscrollBehavior = 'none';
  document.body.style.overflow = 'hidden';
  document.body.style.overscrollBehavior = 'none';
  window.addEventListener('wheel', preventScrollWhileActive, { capture: true, passive: false });
  window.addEventListener('touchmove', preventScrollWhileActive, { capture: true, passive: false });
  setOverlayActive(overlay, true);

  const world = createWorld();
  if (!isWorldViable(world)) {
    drawUnsupportedPageScreen(overlay.canvas);
    unsupportedPageDismissListener = (event: KeyboardEvent) => {
      const isEsc = event.code === 'Escape';
      const isToggle = (event.altKey && event.code === 'KeyG') || (event.shiftKey && event.code === 'Backquote');
      if (isEsc || isToggle) {
        event.stopImmediatePropagation();
        event.preventDefault();
        deactivate();
      }
    };
    window.addEventListener('keydown', unsupportedPageDismissListener, true);
    return;
  }

  game = new Game({
    canvas: overlay.canvas,
    createWorld,
    getPageTitle: () => document.title,
    sampleSurfaceAt,
    setPageInverted,
    setPageBlur,
    setMagnetUiState,
    onQuit: deactivate,
    initialSoundEnabled: soundEnabled,
    onSoundEnabledChange: handleSoundEnabledChange,
    initialVehicleDesign: vehicleDesign,
    onVehicleDesignChange: handleVehicleDesignChange,
    initialPageBestScore: pageBestScore,
    initialLifetimeBestScore: lifetimeBestScore,
    initialLifetimeTotalScore: lifetimeTotalScore,
    initialRunCount: lifetimeRunsStarted,
    onRunStarted: handleRunStarted,
    onRunFinished: handleRunFinished,
    getPageTintColor,
  });
  game.start();
}

function deactivate(): void {
  active = false;
  if (unsupportedPageDismissListener) {
    window.removeEventListener('keydown', unsupportedPageDismissListener, true);
    unsupportedPageDismissListener = null;
  }
  game?.stop();
  game = null;
  document.documentElement.style.userSelect = previousUserSelect;
  document.documentElement.style.webkitUserSelect = previousWebkitUserSelect;
  document.documentElement.style.overscrollBehavior = previousDocumentOverscrollBehavior;
  document.body.style.overflow = previousBodyOverflow;
  document.body.style.overscrollBehavior = previousBodyOverscrollBehavior;
  document.body.classList.remove('dom-racer-invert');
  document.body.classList.remove('dom-racer-blur');
  clearMagnetizedUi();
  window.removeEventListener('wheel', preventScrollWhileActive, true);
  window.removeEventListener('touchmove', preventScrollWhileActive, true);
  setOverlayActive(overlay, false);
}

function createWorld() {
  return buildWorld(scanVisibleDom(overlay.root), {
    width: window.innerWidth,
    height: window.innerHeight,
  });
}

function handleSoundEnabledChange(enabled: boolean): void {
  soundEnabled = enabled;
  void saveSoundEnabledSetting(enabled).catch(() => undefined);
}

function handleVehicleDesignChange(design: VehicleDesign): void {
  vehicleDesign = design;
  void saveVehicleDesignSetting(design).catch(() => undefined);
}

function handleRunStarted(runNumber: number): void {
  lifetimeRunsStarted = runNumber;
  void incrementRunCount().catch(() => undefined);
}

function handleRunFinished(run: {
  score: number;
  elapsedMs: number;
  reason: 'manual' | 'deadSpot' | 'caught' | 'quit';
}): void {
  const prevTotal = lifetimeTotalScore;
  pageBestScore = Math.max(pageBestScore, run.score);
  lifetimeBestScore = Math.max(lifetimeBestScore, run.score);
  lifetimeTotalScore += run.score;
  if (
    prevTotal < VEHICLES.BUGGY_UNLOCK_SCORE &&
    lifetimeTotalScore >= VEHICLES.BUGGY_UNLOCK_SCORE
  ) {
    game?.showVehicleUnlockToast('BUGGY');
  }
  if (
    prevTotal < VEHICLES.TRUCK_UNLOCK_SCORE &&
    lifetimeTotalScore >= VEHICLES.TRUCK_UNLOCK_SCORE
  ) {
    game?.showVehicleUnlockToast('TRUCK');
  }
  void recordPageRun({
    url: window.location.href,
    title: document.title,
    score: run.score,
    elapsedMs: run.elapsedMs,
    reason: run.reason,
  })
    .then(() => checkAndMarkMilestones())
    .then((milestones) => {
      for (const m of milestones) {
        game?.showMilestoneToast(m);
      }
    })
    .catch(() => undefined);
}

function preventScrollWhileActive(event: Event): void {
  if (!active) {
    return;
  }

  event.preventDefault();
}

function setPageInverted(inverted: boolean): void {
  document.body.classList.toggle('dom-racer-invert', inverted);
}

function setPageBlur(active: boolean): void {
  document.body.classList.toggle('dom-racer-blur', active);
}

function setMagnetUiState(state: {
  active: boolean;
  point: { x: number; y: number } | null;
  strength: number;
}): void {
  if (!state.active || !state.point) {
    clearMagnetizedUi();
    return;
  }

  const now = performance.now();
  if (now - lastMagnetUiUpdateAt < 70) {
    return;
  }
  lastMagnetUiUpdateAt = now;

  const nextElements = new Set<HTMLElement>();
  const sampleRadius = 130;
  const sampleOffsets = [
    { x: 0, y: 0 },
    { x: -sampleRadius, y: 0 },
    { x: sampleRadius, y: 0 },
    { x: 0, y: -sampleRadius },
    { x: 0, y: sampleRadius },
    { x: -sampleRadius * 0.7, y: -sampleRadius * 0.7 },
    { x: sampleRadius * 0.7, y: -sampleRadius * 0.7 },
    { x: -sampleRadius * 0.7, y: sampleRadius * 0.7 },
    { x: sampleRadius * 0.7, y: sampleRadius * 0.7 },
  ];

  for (const offset of sampleOffsets) {
    const sampleX = clampToViewport(state.point.x + offset.x, window.innerWidth);
    const sampleY = clampToViewport(state.point.y + offset.y, window.innerHeight);
    const stack = document.elementsFromPoint(sampleX, sampleY);

    for (const candidate of stack) {
      if (!(candidate instanceof HTMLElement) || !isMagnetizableElement(candidate)) {
        continue;
      }

      const rect = candidate.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = state.point.x - centerX;
      const dy = state.point.y - centerY;
      const distance = Math.hypot(dx, dy);
      if (distance > 190 || distance < 1) {
        continue;
      }

      const pull = Math.min(8, (1 - distance / 190) * 10 * state.strength);
      const moveX = (dx / distance) * pull;
      const moveY = (dy / distance) * pull;

      candidate.classList.add('dom-racer-magnetized');
      candidate.style.setProperty('--dom-racer-magnet-x', `${moveX.toFixed(1)}px`);
      candidate.style.setProperty('--dom-racer-magnet-y', `${moveY.toFixed(1)}px`);
      candidate.style.setProperty(
        '--dom-racer-magnet-alpha',
        `${(0.2 + state.strength * 0.45).toFixed(2)}`,
      );
      nextElements.add(candidate);
      if (nextElements.size >= 8) {
        break;
      }
    }

    if (nextElements.size >= 8) {
      break;
    }
  }

  for (const element of magnetizedElements) {
    if (!nextElements.has(element)) {
      resetMagnetizedElement(element);
    }
  }

  magnetizedElements.clear();
  for (const element of nextElements) {
    magnetizedElements.add(element);
  }
}

function sampleSurfaceAt(point: { x: number; y: number }): {
  lightness: number;
  saturation: number;
  hasGradient: boolean;
} {
  const stack = document.elementsFromPoint(point.x, point.y);

  for (const element of stack) {
    if (!(element instanceof HTMLElement)) {
      continue;
    }

    if (element === overlay.root || overlay.root.contains(element)) {
      continue;
    }

    const style = window.getComputedStyle(element);
    const hasGradient = style.backgroundImage.includes('gradient');
    const parsed = parseCssColor(style.backgroundColor);
    if (hasGradient) {
      return {
        lightness: parsed ? rgbToHsl(parsed.r, parsed.g, parsed.b).lightness : 0.55,
        saturation: parsed ? rgbToHsl(parsed.r, parsed.g, parsed.b).saturation : 0.72,
        hasGradient: true,
      };
    }

    if (parsed && parsed.alpha > 0.08) {
      const hsl = rgbToHsl(parsed.r, parsed.g, parsed.b);
      return {
        lightness: hsl.lightness,
        saturation: hsl.saturation,
        hasGradient: false,
      };
    }
  }

  return {
    lightness: 1,
    saturation: 0,
    hasGradient: false,
  };
}

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = overlayCss;
  document.head.appendChild(style);
}

function clearMagnetizedUi(): void {
  for (const element of magnetizedElements) {
    resetMagnetizedElement(element);
  }
  magnetizedElements.clear();
  lastMagnetUiUpdateAt = 0;
}

function resetMagnetizedElement(element: HTMLElement): void {
  element.classList.remove('dom-racer-magnetized');
  element.style.removeProperty('--dom-racer-magnet-x');
  element.style.removeProperty('--dom-racer-magnet-y');
  element.style.removeProperty('--dom-racer-magnet-alpha');
}

function isMagnetizableElement(element: HTMLElement): boolean {
  if (
    element === document.body ||
    element === document.documentElement ||
    element === overlay.root ||
    overlay.root.contains(element) ||
    element.hasAttribute('data-dom-racer-ignore')
  ) {
    return false;
  }

  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) < 0.08) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  const area = rect.width * rect.height;
  if (
    rect.width < 14 ||
    rect.height < 14 ||
    area < 180 ||
    area > window.innerWidth * window.innerHeight * 0.18
  ) {
    return false;
  }

  return true;
}

function clampToViewport(value: number, max: number): number {
  return Math.max(1, Math.min(max - 1, value));
}

function getPageTintColor(): string | null {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const stack = document.elementsFromPoint(cx, cy);
  for (const el of stack) {
    if (!(el instanceof HTMLElement)) continue;
    if (el === overlay.root || overlay.root.contains(el)) continue;
    const style = window.getComputedStyle(el);
    const parsed = parseCssColor(style.backgroundColor);
    if (parsed && parsed.alpha > 0.08) {
      return `rgba(${Math.round(parsed.r)}, ${Math.round(parsed.g)}, ${Math.round(parsed.b)}, 0.06)`;
    }
  }
  return null;
}

const MIN_PICKUPS_FOR_VIABLE_WORLD = 2;
const MIN_GEOMETRY_FOR_VIABLE_WORLD = 1;

function isWorldViable(world: ReturnType<typeof createWorld>): boolean {
  const totalGeometry =
    world.obstacles.length + world.slowZones.length + world.iceZones.length + world.boosts.length;
  return (
    world.pickups.length >= MIN_PICKUPS_FOR_VIABLE_WORLD &&
    totalGeometry >= MIN_GEOMETRY_FOR_VIABLE_WORLD
  );
}

function drawUnsupportedPageScreen(canvas: HTMLCanvasElement): void {
  const width = canvas.clientWidth || window.innerWidth;
  const height = canvas.clientHeight || window.innerHeight;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;

  ctx.save();
  ctx.fillStyle = 'rgba(2, 6, 23, 0.72)';
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  const cx = width / 2;
  const cy = height / 2;

  drawSleepingCar(ctx, cx, cy - 64);

  ctx.font = 'bold 22px "SFMono-Regular", "JetBrains Mono", monospace';
  unsupportedStrokeFill(ctx, '#f8fafc', 'NOT ENOUGH TO RACE ON', cx, cy + 8);

  ctx.font = '13px "SFMono-Regular", "JetBrains Mono", monospace';
  unsupportedStrokeFill(
    ctx,
    '#94a3b8',
    'This page doesn\u2019t have enough links and text',
    cx,
    cy + 40,
  );
  unsupportedStrokeFill(ctx, '#94a3b8', 'blocks for a track.', cx, cy + 58);

  ctx.font = '12px "SFMono-Regular", "JetBrains Mono", monospace';
  unsupportedStrokeFill(
    ctx,
    '#64748b',
    'Try a content-rich page like Wikipedia, GitHub, or a blog.',
    cx,
    cy + 86,
  );

  ctx.font = 'bold 11px "SFMono-Regular", "JetBrains Mono", monospace';
  unsupportedStrokeFill(ctx, '#475569', 'Press Esc or Alt+G to close', cx, cy + 116);

  ctx.restore();
}

function drawSleepingCar(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
  ctx.fillRect(-16, -8, 32, 16);

  ctx.fillStyle = '#334155';
  for (const [wx, wy] of [
    [-8, -16],
    [8, -16],
    [-8, 16],
    [8, 16],
  ] as const) {
    ctx.fillRect(wx - 3, wy - 2, 6, 4);
  }

  ctx.fillStyle = '#1e40af';
  const r = 5;
  ctx.beginPath();
  ctx.moveTo(-18 + r, -12);
  ctx.lineTo(18 - r, -12);
  ctx.quadraticCurveTo(18, -12, 18, -12 + r);
  ctx.lineTo(18, 12 - r);
  ctx.quadraticCurveTo(18, 12, 18 - r, 12);
  ctx.lineTo(-18 + r, 12);
  ctx.quadraticCurveTo(-18, 12, -18, 12 - r);
  ctx.lineTo(-18, -12 + r);
  ctx.quadraticCurveTo(-18, -12, -18 + r, -12);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  ctx.fillStyle = '#1d4ed8';
  ctx.fillRect(-10, -16, 18, 32);

  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(-10, -2, 18, 4);

  ctx.fillStyle = '#dbeafe';
  ctx.fillRect(-2, -9, 7, 18);

  ctx.fillStyle = '#111827';
  ctx.fillRect(16, -5, 3, 3);
  ctx.fillRect(16, 2, 3, 3);
  ctx.fillStyle = '#7f1d1d';
  ctx.fillRect(-19, -5, 3, 3);
  ctx.fillRect(-19, 2, 3, 3);

  ctx.font = 'bold 16px "SFMono-Regular", "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('z', 28, -18);
  ctx.font = 'bold 13px "SFMono-Regular", "JetBrains Mono", monospace';
  ctx.fillText('z', 38, -30);
  ctx.font = 'bold 10px "SFMono-Regular", "JetBrains Mono", monospace';
  ctx.fillText('z', 46, -40);

  ctx.restore();
}

function unsupportedStrokeFill(
  ctx: CanvasRenderingContext2D,
  color: string,
  text: string,
  x: number,
  y: number,
): void {
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}
