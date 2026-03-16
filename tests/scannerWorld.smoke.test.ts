import { describe, expect, it } from 'vitest';
import { scanVisibleDom } from '../src/content/domScanner';
import { buildWorld } from '../src/content/worldBuilder';
import type { Rect } from '../src/shared/types';

function setRect(element: HTMLElement, rect: Rect): void {
  const domRect = {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    top: rect.y,
    left: rect.x,
    right: rect.x + rect.width,
    bottom: rect.y + rect.height,
    toJSON: () => rect,
  };

  Object.defineProperty(element, 'getBoundingClientRect', {
    value: () => domRect,
    configurable: true,
  });
}

describe('scanner -> world smoke', () => {
  it('produces a sane world from visible pickup and surface sources', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });

    const header = document.createElement('div');
    header.style.position = 'fixed';
    header.style.opacity = '1';
    header.style.background = 'rgb(30, 41, 59)';
    setRect(header, { x: 0, y: 0, width: 1200, height: 64 });
    document.body.appendChild(header);

    const link = document.createElement('a');
    link.href = '#docs';
    link.textContent = 'Docs';
    link.style.opacity = '1';
    setRect(link, { x: 120, y: 220, width: 120, height: 28 });
    document.body.appendChild(link);

    const button = document.createElement('button');
    button.textContent = 'Start';
    button.style.opacity = '1';
    setRect(button, { x: 300, y: 260, width: 130, height: 36 });
    document.body.appendChild(button);

    const image = document.createElement('img');
    image.style.opacity = '1';
    setRect(image, { x: 540, y: 190, width: 120, height: 90 });
    document.body.appendChild(image);

    const reactive = document.createElement('div');
    reactive.style.backgroundImage = 'linear-gradient(to right, #22d3ee, #f472b6)';
    reactive.style.opacity = '1';
    setRect(reactive, { x: 720, y: 260, width: 220, height: 120 });
    document.body.appendChild(reactive);

    const scanned = scanVisibleDom(null);
    const world = buildWorld(scanned, { width: 1200, height: 800 });
    const allowedKinds = new Set(['wall', 'pickup', 'boost', 'ice', 'barrier']);

    expect(scanned.length).toBeGreaterThan(0);
    expect(scanned.every((entry) => allowedKinds.has(entry.kind))).toBe(true);
    expect(scanned.filter((entry) => entry.kind === 'pickup').length).toBeGreaterThanOrEqual(2);
    expect(scanned.some((entry) => entry.kind === 'ice')).toBe(true);
    expect(scanned.some((entry) => entry.kind === 'boost')).toBe(true);

    expect(world.pickups.length).toBeGreaterThanOrEqual(2);
    expect(world.pickups.every((pickup) => pickup.kind === 'coin')).toBe(true);
    expect(world.pickups.every((pickup) => pickup.sourceId)).toBe(true);
    expect(world.iceZones.length).toBeGreaterThan(0);
    expect(world.boosts.length).toBeGreaterThan(0);
    expect(world.hazards).toHaveLength(0);
    expect(world.deadSpots).toHaveLength(0);
    expect(world.spawnPoint.x).toBeGreaterThanOrEqual(0);
    expect(world.spawnPoint.y).toBeGreaterThanOrEqual(0);
  });

  it('classifies video elements as ice (consistent with img/picture)', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });

    const video = document.createElement('video');
    video.style.opacity = '1';
    setRect(video, { x: 200, y: 200, width: 320, height: 180 });
    document.body.appendChild(video);

    const canvas = document.createElement('canvas');
    canvas.style.opacity = '1';
    setRect(canvas, { x: 600, y: 200, width: 300, height: 200 });
    document.body.appendChild(canvas);

    const scanned = scanVisibleDom(null);
    const videoElements = scanned.filter((entry) => entry.tagName === 'video');
    const canvasElements = scanned.filter((entry) => entry.tagName === 'canvas');

    expect(videoElements.length).toBeGreaterThanOrEqual(1);
    expect(videoElements.every((entry) => entry.kind === 'ice')).toBe(true);
    expect(canvasElements.length).toBeGreaterThanOrEqual(1);
    expect(canvasElements.every((entry) => entry.kind === 'ice')).toBe(true);

    const world = buildWorld(scanned, { width: 1200, height: 800 });
    expect(world.iceZones.length).toBeGreaterThan(0);
  });

  it('classifies form controls as wall (slowZones) for overgrowth anchoring', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });

    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.style.opacity = '1';
    setRect(textInput, { x: 100, y: 200, width: 200, height: 32 });
    document.body.appendChild(textInput);

    const textarea = document.createElement('textarea');
    textarea.style.opacity = '1';
    setRect(textarea, { x: 100, y: 300, width: 300, height: 80 });
    document.body.appendChild(textarea);

    const select = document.createElement('select');
    select.style.opacity = '1';
    setRect(select, { x: 100, y: 420, width: 180, height: 32 });
    document.body.appendChild(select);

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.style.opacity = '1';
    setRect(checkbox, { x: 100, y: 500, width: 20, height: 20 });
    document.body.appendChild(checkbox);

    const disabledInput = document.createElement('input');
    disabledInput.type = 'text';
    disabledInput.disabled = true;
    disabledInput.style.opacity = '1';
    setRect(disabledInput, { x: 400, y: 200, width: 200, height: 32 });
    document.body.appendChild(disabledInput);

    const scanned = scanVisibleDom(null);

    const textInputScanned = scanned.filter(
      (e) => e.tagName === 'input' && e.rect.x === 100 && e.rect.y === 200,
    );
    expect(textInputScanned).toHaveLength(1);
    expect(textInputScanned[0].kind).toBe('wall');

    const textareaScanned = scanned.filter((e) => e.tagName === 'textarea');
    expect(textareaScanned).toHaveLength(1);
    expect(textareaScanned[0].kind).toBe('wall');

    const selectScanned = scanned.filter((e) => e.tagName === 'select');
    expect(selectScanned).toHaveLength(1);
    expect(selectScanned[0].kind).toBe('wall');

    const checkboxScanned = scanned.filter(
      (e) => e.tagName === 'input' && e.rect.x === 100 && e.rect.y === 500,
    );
    expect(checkboxScanned).toHaveLength(1);
    expect(checkboxScanned[0].kind).toBe('wall');

    const disabledScanned = scanned.filter((e) => e.tagName === 'input' && e.rect.x === 400);
    expect(disabledScanned).toHaveLength(0);

    const world = buildWorld(scanned, { width: 1200, height: 800 });
    // slowZones still populated for overgrowth anchoring, but no speed effect
    expect(world.slowZones.length).toBeGreaterThanOrEqual(2);
  });
});
