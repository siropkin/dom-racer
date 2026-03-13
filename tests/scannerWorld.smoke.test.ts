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
});
