import type { Rect, ScannedElement, ScannedKind, ViewportSize } from '../shared/types';

const MAX_RESULTS = 220;
const MAX_PICKUPS = 56;
const MIN_DIMENSION = 12;
const SKIP_TAGS = new Set([
  'html',
  'body',
  'script',
  'style',
  'link',
  'meta',
  'noscript',
  'path',
]);

export function scanVisibleDom(overlayRoot: HTMLElement | null): ScannedElement[] {
  if (!document.body) {
    return [];
  }

  const viewport = getViewport();
  const results: ScannedElement[] = [];

  for (const element of document.body.querySelectorAll<HTMLElement>('*')) {
    if (results.length >= MAX_RESULTS) {
      break;
    }

    if (shouldSkipElement(element, overlayRoot)) {
      continue;
    }

    const style = window.getComputedStyle(element);
    const rect = normalizeRect(element.getBoundingClientRect(), viewport);
    if (!rect) {
      continue;
    }

    const scannedElements = classifyElement(element, style, rect, viewport);
    if (scannedElements.length === 0) {
      continue;
    }

    for (const scannedElement of scannedElements) {
      if (results.length >= MAX_RESULTS) {
        break;
      }

      results.push(scannedElement);
    }
  }

  return capPickups(pruneOverlaps(results));
}

function getViewport(): ViewportSize {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

function shouldSkipElement(element: HTMLElement, overlayRoot: HTMLElement | null): boolean {
  if (SKIP_TAGS.has(element.tagName.toLowerCase())) {
    return true;
  }

  if (overlayRoot && element.closest(`#${overlayRoot.id}`)) {
    return true;
  }

  if (element.hasAttribute('data-dom-racer-ignore')) {
    return true;
  }

  return false;
}

function normalizeRect(domRect: DOMRect, viewport: ViewportSize): Rect | null {
  const left = Math.max(0, domRect.left);
  const top = Math.max(0, domRect.top);
  const right = Math.min(viewport.width, domRect.right);
  const bottom = Math.min(viewport.height, domRect.bottom);
  const width = Math.round(right - left);
  const height = Math.round(bottom - top);

  if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
    return null;
  }

  if (right <= 0 || bottom <= 0 || left >= viewport.width || top >= viewport.height) {
    return null;
  }

  return {
    x: Math.round(left),
    y: Math.round(top),
    width,
    height,
  };
}

function classifyElement(
  element: HTMLElement,
  style: CSSStyleDeclaration,
  rect: Rect,
  viewport: ViewportSize,
): ScannedElement[] {
  if (style.display === 'none' || style.visibility === 'hidden') {
    return [];
  }

  const opacity = Number(style.opacity);
  if (!Number.isNaN(opacity) && opacity < 0.08) {
    return [];
  }

  const area = rect.width * rect.height;
  const viewportArea = viewport.width * viewport.height;
  const tag = element.tagName.toLowerCase();
  const fixed = style.position === 'fixed' || style.position === 'sticky';
  const nearEdge =
    rect.x <= 24 ||
    rect.y <= 24 ||
    rect.x + rect.width >= viewport.width - 24 ||
    rect.y + rect.height >= viewport.height - 24;

  if (fixed && nearEdge && (rect.width > viewport.width * 0.3 || rect.height > 48)) {
    return [toScannedElement('barrier', element, rect, fixed)];
  }

  if (isPickupLink(element, rect, viewportArea, fixed)) {
    return [toScannedElement('pickup', element, rect, fixed)];
  }

  if (isPickupButton(element, rect, viewportArea, fixed)) {
    return [toScannedElement('pickup', element, rect, fixed)];
  }

  if (['img', 'picture', 'video', 'canvas', 'svg'].includes(tag)) {
    return area >= 400 ? [toScannedElement('boost', element, rect, fixed)] : [];
  }

  const results: ScannedElement[] = [];
  const reactiveSurfaceRect = getReactiveSurfaceRect(style, rect, viewportArea, fixed);
  if (reactiveSurfaceRect) {
    results.push(toScannedElement('boost', element, reactiveSurfaceRect, fixed, 'surface'));
  }

  const textRects = getVisibleTextRects(element, style, rect, viewport, viewportArea, fixed);
  if (textRects.length > 0) {
    results.push(
      ...textRects.map((textRect, index) =>
        toScannedElement('wall', element, textRect, fixed, `text-${index}`),
      ),
    );
  }

  return results;
}

function getVisibleTextRects(
  element: HTMLElement,
  style: CSSStyleDeclaration,
  rect: Rect,
  viewport: ViewportSize,
  viewportArea: number,
  fixed: boolean,
): Rect[] {
  if (fixed) {
    return [];
  }

  const tag = element.tagName.toLowerCase();
  const textTags = new Set([
    'p',
    'li',
    'blockquote',
    'pre',
    'code',
    'figcaption',
    'dd',
    'dt',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
  ]);

  if (!textTags.has(tag)) {
    return [];
  }

  if (style.display === 'inline' || style.display === 'contents') {
    return [];
  }

  if (
    element.closest(
      'header, nav, footer, aside, form, [role="navigation"], [role="tablist"], [role="menu"]',
    )
  ) {
    return [];
  }

  const area = rect.width * rect.height;
  if (area < 120 || area > viewportArea * 0.22) {
    return [];
  }

  const text = (element.innerText || element.textContent || '').replaceAll(/\s+/g, ' ').trim();
  if (text.length < 18) {
    return [];
  }

  const range = document.createRange();
  range.selectNodeContents(element);
  const textRects: Rect[] = [];

  for (const clientRect of Array.from(range.getClientRects()).slice(0, 24)) {
    const normalized = normalizeRect(clientRect, viewport);
    if (!normalized) {
      continue;
    }

    if (normalized.width < 12 || normalized.height < 10) {
      continue;
    }

    textRects.push(normalized);
  }

  return textRects;
}

function getReactiveSurfaceRect(
  style: CSSStyleDeclaration,
  rect: Rect,
  viewportArea: number,
  fixed: boolean,
): Rect | null {
  if (fixed) {
    return null;
  }

  const area = rect.width * rect.height;
  if (area < 520 || area > viewportArea * 0.16) {
    return null;
  }

  const hasGradient = style.backgroundImage.includes('gradient');
  const background = parseCssColor(style.backgroundColor);
  if (!hasGradient && (!background || background.alpha < 0.12)) {
    return null;
  }

  const hsl = background ? rgbToHsl(background.r, background.g, background.b) : { lightness: 0.55, saturation: 0.72 };
  if (!hasGradient && hsl.saturation < 0.36) {
    return null;
  }

  const inset = Math.max(3, Math.min(10, Math.round(Math.min(rect.width, rect.height) * 0.08)));
  return {
    x: rect.x + inset,
    y: rect.y + inset,
    width: Math.max(10, rect.width - inset * 2),
    height: Math.max(10, rect.height - inset * 2),
  };
}

function parseCssColor(value: string): { r: number; g: number; b: number; alpha: number } | null {
  const match = value.match(/rgba?\(([^)]+)\)/i);
  if (!match) {
    return null;
  }

  const parts = match[1].split(',').map((part) => Number.parseFloat(part.trim()));
  if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) {
    return null;
  }

  return {
    r: parts[0],
    g: parts[1],
    b: parts[2],
    alpha: parts[3] ?? 1,
  };
}

function rgbToHsl(r: number, g: number, b: number): { lightness: number; saturation: number } {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;

  if (max === min) {
    return { lightness, saturation: 0 };
  }

  const delta = max - min;
  const saturation =
    lightness > 0.5 ? delta / (2 - max - min) : delta / Math.max(0.0001, max + min);
  return { lightness, saturation };
}

function toScannedElement(
  kind: ScannedKind,
  element: HTMLElement,
  rect: Rect,
  fixed: boolean,
  suffix = '',
): ScannedElement {
  return {
    id: buildStableId(kind, element, rect, suffix),
    kind,
    rect,
    tagName: element.tagName.toLowerCase(),
    fixed,
  };
}

function buildStableId(kind: ScannedKind, element: HTMLElement, rect: Rect, suffix = ''): string {
  const label =
    element.getAttribute('aria-label') ||
    element.textContent?.trim().slice(0, 24) ||
    element.tagName.toLowerCase();

  return [
    kind,
    element.tagName.toLowerCase(),
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    label.replaceAll(/\s+/g, '-').toLowerCase(),
    suffix,
  ].join(':');
}

function pruneOverlaps(elements: ScannedElement[]): ScannedElement[] {
  const kept: ScannedElement[] = [];
  const sorted = [...elements].sort((left, right) => area(right.rect) - area(left.rect));

  for (const element of sorted) {
    const duplicate = kept.some(
      (existing) =>
        existing.kind === element.kind &&
        overlapRatio(existing.rect, element.rect) > 0.9 &&
        existing.fixed === element.fixed,
    );

    if (!duplicate) {
      kept.push(element);
    }
  }

  return kept.sort((left, right) => area(left.rect) - area(right.rect));
}

function overlapRatio(left: Rect, right: Rect): number {
  const xOverlap = Math.max(
    0,
    Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x),
  );
  const yOverlap = Math.max(
    0,
    Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y),
  );

  if (xOverlap === 0 || yOverlap === 0) {
    return 0;
  }

  const overlapArea = xOverlap * yOverlap;
  return overlapArea / Math.min(area(left), area(right));
}

function area(rect: Rect): number {
  return rect.width * rect.height;
}

function isPickupLink(
  element: HTMLElement,
  rect: Rect,
  viewportArea: number,
  fixed: boolean,
): boolean {
  if (!(element instanceof HTMLAnchorElement)) {
    return false;
  }

  const area = rect.width * rect.height;
  if (area < 120 || area > viewportArea * 0.03) {
    return false;
  }

  if (fixed || rect.y < 52) {
    return false;
  }

  if (
    element.closest('header, nav, footer, form, summary, [role="navigation"], [role="tablist"], [role="menu"]')
  ) {
    return false;
  }

  const label = element.getAttribute('aria-label') || element.textContent?.trim() || '';
  if (label.length === 0) {
    return false;
  }

  return true;
}

function isPickupButton(
  element: HTMLElement,
  rect: Rect,
  viewportArea: number,
  fixed: boolean,
): boolean {
  const tag = element.tagName.toLowerCase();
  const isButtonLike =
    element instanceof HTMLButtonElement ||
    (element instanceof HTMLInputElement &&
      ['button', 'submit', 'reset'].includes(element.type.toLowerCase())) ||
    element.getAttribute('role') === 'button' ||
    tag === 'button';

  if (!isButtonLike) {
    return false;
  }

  const area = rect.width * rect.height;
  if (area < 90 || area > viewportArea * 0.022) {
    return false;
  }

  if (fixed || rect.y < 52) {
    return false;
  }

  if (
    element.closest('header, nav, footer, summary, [role="navigation"], [role="tablist"], [role="menu"]')
  ) {
    return false;
  }

  if (
    (element instanceof HTMLButtonElement || element instanceof HTMLInputElement) &&
    element.disabled
  ) {
    return false;
  }

  const label =
    element.getAttribute('aria-label') ||
    (element instanceof HTMLInputElement ? element.value : element.textContent?.trim()) ||
    '';
  return label.trim().length > 0;
}

function capPickups(elements: ScannedElement[]): ScannedElement[] {
  const pickups = elements.filter((element) => element.kind === 'pickup');
  if (pickups.length <= MAX_PICKUPS) {
    return elements;
  }

  const keptPickupIds = new Set(
    [...pickups]
      .sort((left, right) => {
        const leftScore = left.rect.y * 2 + Math.abs(left.rect.x - window.innerWidth / 2);
        const rightScore = right.rect.y * 2 + Math.abs(right.rect.x - window.innerWidth / 2);
        return leftScore - rightScore;
      })
      .slice(0, MAX_PICKUPS)
      .map((pickup) => pickup.id),
  );

  return elements.filter((element) => element.kind !== 'pickup' || keptPickupIds.has(element.id));
}
