import type { InputState } from '../shared/types';
import { isModifierKey } from './gameRuntime';

export interface KeyDownDispatchContext {
  gameOverActive: boolean;
  spriteShowcaseActive: boolean;
}

export interface KeyDownKeyState {
  code: string;
  shiftKey: boolean;
  repeat: boolean;
}

export type KeyDownAction =
  | { kind: 'none' }
  | { kind: 'quit' }
  | { kind: 'game-over-restart' }
  | { kind: 'toggle-showcase' }
  | { kind: 'cycle-showcase-theme'; direction: -1 | 1 }
  | { kind: 'restart-run' }
  | { kind: 'toggle-sound' }
  | { kind: 'cycle-vehicle' }
  | { kind: 'apply-input'; consumed: boolean };

/** Maps a keydown event to a game action based on current game mode and key state. */
export function resolveKeyDownAction(
  context: KeyDownDispatchContext,
  keyState: KeyDownKeyState,
  input: InputState,
): KeyDownAction {
  if (context.gameOverActive) {
    if (keyState.code === 'Escape') {
      return { kind: 'quit' };
    }

    if (keyState.repeat || isModifierKey(keyState.code) || keyState.code !== 'Space') {
      return { kind: 'none' };
    }

    return { kind: 'game-over-restart' };
  }

  if (keyState.code === 'Escape') {
    return { kind: 'quit' };
  }

  if (keyState.code === 'KeyD' && keyState.shiftKey && !keyState.repeat) {
    return { kind: 'toggle-showcase' };
  }

  if (context.spriteShowcaseActive && !keyState.repeat) {
    if (keyState.code === 'ArrowLeft') {
      return { kind: 'cycle-showcase-theme', direction: -1 };
    }
    if (keyState.code === 'ArrowRight') {
      return { kind: 'cycle-showcase-theme', direction: 1 };
    }
  }

  if (keyState.code === 'KeyR' && !keyState.shiftKey && !keyState.repeat) {
    return { kind: 'restart-run' };
  }

  if (keyState.code === 'KeyM' && !keyState.repeat) {
    return { kind: 'toggle-sound' };
  }

  if (keyState.code === 'KeyV' && !keyState.repeat) {
    return { kind: 'cycle-vehicle' };
  }

  return { kind: 'apply-input', consumed: setInputFlag(input, keyState.code, true) };
}

export function resolveKeyUpConsumed(
  input: InputState,
  keyState: { code: string; gameOverActive: boolean },
): boolean {
  if (keyState.gameOverActive) {
    return false;
  }

  return setInputFlag(input, keyState.code, false);
}

export function resetInputState(input: InputState): void {
  input.up = false;
  input.down = false;
  input.left = false;
  input.right = false;
  input.nitro = false;
}

export function cloneInputState(input: InputState): InputState {
  return {
    up: input.up,
    down: input.down,
    left: input.left,
    right: input.right,
    nitro: input.nitro,
  };
}

function setInputFlag(input: InputState, code: string, value: boolean): boolean {
  switch (code) {
    case 'ArrowUp':
    case 'KeyW':
      input.up = value;
      return true;
    case 'ArrowDown':
    case 'KeyS':
      input.down = value;
      return true;
    case 'ArrowLeft':
    case 'KeyA':
      input.left = value;
      return true;
    case 'ArrowRight':
    case 'KeyD':
      input.right = value;
      return true;
    case 'Space':
      input.nitro = value;
      return true;
    default:
      return false;
  }
}
