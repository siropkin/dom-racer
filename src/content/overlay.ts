export const OVERLAY_ROOT_ID = 'dom-racer-root';

export interface OverlayElements {
  root: HTMLDivElement;
  canvas: HTMLCanvasElement;
}

export function ensureOverlay(): OverlayElements {
  let root = document.getElementById(OVERLAY_ROOT_ID) as HTMLDivElement | null;
  let canvas = root?.querySelector('canvas') ?? null;

  if (!root) {
    root = document.createElement('div');
    root.id = OVERLAY_ROOT_ID;
    root.dataset.active = 'false';
    root.setAttribute('aria-hidden', 'true');
    root.setAttribute('data-dom-racer-ignore', 'true');

    canvas = document.createElement('canvas');
    canvas.className = 'dom-racer-canvas';
    canvas.tabIndex = -1;
    canvas.setAttribute('data-dom-racer-ignore', 'true');

    root.appendChild(canvas);
    document.documentElement.appendChild(root);
  }

  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('DOM Racer overlay canvas was not created correctly.');
  }

  return { root, canvas };
}

export function setOverlayActive(overlay: OverlayElements, active: boolean): void {
  overlay.root.dataset.active = active ? 'true' : 'false';
  overlay.canvas.style.pointerEvents = active ? 'auto' : 'none';
}
