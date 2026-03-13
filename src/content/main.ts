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
let previousDocumentOverflow = '';
let previousBodyOverflow = '';
let previousDocumentOverscrollBehavior = '';
let previousBodyOverscrollBehavior = '';
let previousBodyPaddingRight = '';
let soundEnabled = true;
let vehicleDesign: VehicleDesign = 'coupe';
let pageBestScore = 0;
let lifetimeBestScore = 0;
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

    const togglePressed = event.shiftKey && (event.code === 'KeyR' || event.code === 'Backquote');
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

  activate();
}

function activate(): void {
  if (active) {
    return;
  }

  active = true;
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement) {
    activeElement.blur();
  }

  previousUserSelect = document.documentElement.style.userSelect;
  previousWebkitUserSelect = document.documentElement.style.webkitUserSelect;
  previousDocumentOverflow = document.documentElement.style.overflow;
  previousBodyOverflow = document.body.style.overflow;
  previousDocumentOverscrollBehavior = document.documentElement.style.overscrollBehavior;
  previousBodyOverscrollBehavior = document.body.style.overscrollBehavior;
  previousBodyPaddingRight = document.body.style.paddingRight;
  const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
  if (scrollbarWidth > 0) {
    const computedPaddingRight =
      Number.parseFloat(window.getComputedStyle(document.body).paddingRight) || 0;
    document.body.style.paddingRight = `${computedPaddingRight + scrollbarWidth}px`;
  }
  document.documentElement.style.userSelect = 'none';
  document.documentElement.style.webkitUserSelect = 'none';
  document.documentElement.style.overflow = 'hidden';
  document.documentElement.style.overscrollBehavior = 'none';
  document.body.style.overflow = 'hidden';
  document.body.style.overscrollBehavior = 'none';
  window.addEventListener('wheel', preventScrollWhileActive, { capture: true, passive: false });
  window.addEventListener('touchmove', preventScrollWhileActive, { capture: true, passive: false });
  setOverlayActive(overlay, true);

  game = new Game({
    canvas: overlay.canvas,
    createWorld,
    getPageTitle: () => document.title,
    sampleSurfaceAt,
    setPageInverted,
    setPageBlackout,
    setMagnetUiState,
    onQuit: deactivate,
    initialSoundEnabled: soundEnabled,
    onSoundEnabledChange: handleSoundEnabledChange,
    initialVehicleDesign: vehicleDesign,
    onVehicleDesignChange: handleVehicleDesignChange,
    initialPageBestScore: pageBestScore,
    initialLifetimeBestScore: lifetimeBestScore,
    initialRunCount: lifetimeRunsStarted,
    onRunStarted: handleRunStarted,
    onRunFinished: handleRunFinished,
    getPageTintColor,
  });
  game.start();
}

function deactivate(): void {
  active = false;
  game?.stop();
  game = null;
  document.documentElement.style.userSelect = previousUserSelect;
  document.documentElement.style.webkitUserSelect = previousWebkitUserSelect;
  document.documentElement.style.overflow = previousDocumentOverflow;
  document.documentElement.style.overscrollBehavior = previousDocumentOverscrollBehavior;
  document.body.style.overflow = previousBodyOverflow;
  document.body.style.overscrollBehavior = previousBodyOverscrollBehavior;
  document.body.style.paddingRight = previousBodyPaddingRight;
  document.body.classList.remove('dom-racer-invert');
  document.body.classList.remove('dom-racer-blackout');
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
  pageBestScore = Math.max(pageBestScore, run.score);
  lifetimeBestScore = Math.max(lifetimeBestScore, run.score);
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

function setPageBlackout(active: boolean): void {
  document.body.classList.toggle('dom-racer-blackout', active);
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
