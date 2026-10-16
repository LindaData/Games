/**
 * Polls the Gamepad API while a pad is connected and calls `onAction` for each press (directions
 * repeat while held). Costs nothing without a controller: a cheap check twice a second, and the
 * per-frame loop only runs while a pad is connected. Touch, mouse and keyboard are untouched.
 */
import { useEffect, useRef } from 'react';
import { heldActions, stepPad, type PadAction, type RepeatState } from './gamepad';

const CHECK_MS = 500;

function readPads(): (Gamepad | null)[] {
  try {
    return typeof navigator.getGamepads === 'function' ? Array.from(navigator.getGamepads()) : [];
  } catch {
    return []; // blocked by a permissions policy
  }
}

export function useGamepad(onAction: (action: PadAction) => void): void {
  const handler = useRef(onAction);
  handler.current = onAction;

  useEffect(() => {
    let frame = 0;
    let held = new Set<PadAction>();
    let repeat: RepeatState = new Map();

    const loop = () => {
      const pads = readPads();
      if (!pads.some((p) => p?.connected)) {
        frame = 0;
        held = new Set();
        repeat = new Map();
        return;
      }
      held = heldActions(pads, held);
      const step = stepPad(repeat, held, performance.now());
      repeat = step.state;
      // Only while the game's window is the one in front.
      if (document.visibilityState === 'visible') for (const action of step.fire) handler.current(action);
      frame = requestAnimationFrame(loop);
    };
    const start = () => {
      if (!frame && readPads().some((p) => p?.connected)) frame = requestAnimationFrame(loop);
    };

    window.addEventListener('gamepadconnected', start);
    const timer = window.setInterval(start, CHECK_MS);
    start();
    return () => {
      window.removeEventListener('gamepadconnected', start);
      window.clearInterval(timer);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
}
