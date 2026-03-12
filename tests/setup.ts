import { afterEach, beforeEach, vi } from 'vitest';

beforeEach(() => {
  document.body.innerHTML = '';
  Object.defineProperty(window, 'scrollY', {
    value: 0,
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
