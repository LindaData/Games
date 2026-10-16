import { describe, expect, it } from 'vitest';
import {
  REPEAT_DELAY_MS,
  REPEAT_MS,
  heldActions,
  stepPad,
  type PadAction,
  type PadLike,
  type RepeatState,
} from '../src/input/gamepad';
import { pickNext, type Box } from '../src/input/spatial';

/** A standard-mapping pad (17 buttons, 4 axes) with the given buttons pressed and stick position. */
function pad(pressed: number[] = [], axes: number[] = [0, 0, 0, 0], extra: Partial<PadLike> = {}): PadLike {
  return {
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 })),
    axes,
    connected: true,
    ...extra,
  };
}

const sorted = (s: Set<PadAction>) => [...s].sort();

describe('controller mapping', () => {
  it('maps the standard buttons: A B X Y Start and the D-pad', () => {
    expect(sorted(heldActions([pad([0])]))).toEqual(['a']);
    expect(sorted(heldActions([pad([1])]))).toEqual(['b']);
    expect(sorted(heldActions([pad([2])]))).toEqual(['x']);
    expect(sorted(heldActions([pad([3])]))).toEqual(['y']);
    expect(sorted(heldActions([pad([9])]))).toEqual(['start']);
    expect(sorted(heldActions([pad([12, 13, 14, 15])]))).toEqual(['down', 'left', 'right', 'up']);
  });

  it('ignores the other buttons (bumpers, triggers, Back, sticks, Home)', () => {
    expect(heldActions([pad([4, 5, 6, 7, 8, 10, 11, 16])]).size).toBe(0);
  });

  it('counts an analogue button pushed past halfway even if not reported as pressed', () => {
    const p = pad();
    const buttons = p.buttons.map((b, i) => (i === 0 ? { pressed: false, value: 0.8 } : b));
    expect(sorted(heldActions([{ ...p, buttons }]))).toEqual(['a']);
  });

  it('turns the left stick into one direction, the axis pushed further', () => {
    expect(sorted(heldActions([pad([], [-0.9, 0.1])]))).toEqual(['left']);
    expect(sorted(heldActions([pad([], [0.7, 0])]))).toEqual(['right']);
    expect(sorted(heldActions([pad([], [0.2, -0.8])]))).toEqual(['up']);
    expect(sorted(heldActions([pad([], [0.6, 0.75])]))).toEqual(['down']);
    expect(heldActions([pad([], [0.3, 0.3])]).size).toBe(0); // dead zone
  });

  it('keeps a stick direction held down to the release threshold (no flicker)', () => {
    const held = heldActions([pad([], [0.55, 0])]);
    expect(sorted(held)).toEqual(['right']);
    expect(sorted(heldActions([pad([], [0.4, 0])]))).toEqual([]); // fresh: not far enough
    expect(sorted(heldActions([pad([], [0.4, 0])], held))).toEqual(['right']); // already held: still held
    expect(sorted(heldActions([pad([], [0.3, 0])], held))).toEqual([]); // let go
  });

  it('merges every connected pad and skips empty or disconnected slots', () => {
    const pads = [null, pad([0]), undefined, pad([1], [0, 0], { connected: false }), pad([14])];
    expect(sorted(heldActions(pads))).toEqual(['a', 'left']);
  });

  it('copes with pads that report fewer buttons or axes', () => {
    expect(sorted(heldActions([{ buttons: [{ pressed: true }], axes: [] }]))).toEqual(['a']);
  });
});

describe('press and repeat', () => {
  const run = (frames: [number, PadAction[]][]) => {
    let state: RepeatState = new Map();
    const fired: [number, PadAction[]][] = [];
    for (const [t, held] of frames) {
      const r = stepPad(state, new Set(held), t);
      state = r.state;
      if (r.fire.length) fired.push([t, r.fire]);
    }
    return fired;
  };

  it('fires a button once per press, however long it is held', () => {
    expect(run([[0, ['a']], [16, ['a']], [2000, ['a']], [2016, []], [2032, ['a']]])).toEqual([
      [0, ['a']],
      [2032, ['a']],
    ]);
  });

  it('repeats a held direction after a delay, then steadily', () => {
    const frames: [number, PadAction[]][] = [];
    for (let t = 0; t <= REPEAT_DELAY_MS + 2 * REPEAT_MS + 5; t += 5) frames.push([t, ['down']]);
    const times = run(frames).map(([t]) => t);
    expect(times).toEqual([0, REPEAT_DELAY_MS, REPEAT_DELAY_MS + REPEAT_MS, REPEAT_DELAY_MS + 2 * REPEAT_MS]);
  });

  it('starts over when a direction is let go', () => {
    expect(run([[0, ['left']], [100, []], [110, ['left']], [200, ['left']]])).toEqual([
      [0, ['left']],
      [110, ['left']],
    ]);
  });

  it('fires everything newly pressed in the same frame', () => {
    expect(run([[0, ['a', 'up']]])).toEqual([[0, ['a', 'up']]]);
  });
});

describe('moving focus in a direction', () => {
  /** An 8x8 board of 40px squares, row 0 at the top, plus a row of three buttons under it. */
  const squares: Box[] = [];
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) squares.push({ left: f * 40, top: r * 40, width: 40, height: 40 });
  const buttons: Box[] = [
    { left: 0, top: 340, width: 180, height: 44 },
    { left: 190, top: 340, width: 60, height: 44 },
    { left: 260, top: 340, width: 60, height: 44 },
  ];
  const all = [...squares, ...buttons];
  const at = (f: number, r: number) => r * 8 + f;

  it('steps to the neighbouring square', () => {
    const from = squares[at(3, 3)];
    expect(pickNext(from, all, 'right')).toBe(at(4, 3));
    expect(pickNext(from, all, 'left')).toBe(at(2, 3));
    expect(pickNext(from, all, 'up')).toBe(at(3, 2));
    expect(pickNext(from, all, 'down')).toBe(at(3, 4));
  });

  it('has nowhere to go past the edge', () => {
    expect(pickNext(squares[at(7, 3)], squares, 'right')).toBe(-1);
    expect(pickNext(squares[at(0, 0)], squares, 'up')).toBe(-1);
  });

  it('goes from the bottom row of the board to the button below, and back up', () => {
    expect(pickNext(squares[at(0, 7)], all, 'down')).toBe(64); // the wide button under a-file
    expect(pickNext(squares[at(7, 7)], all, 'down')).toBe(66);
    expect(pickNext(buttons[1], all, 'up')).toBe(at(5, 7));
  });

  it('moves along a row of buttons', () => {
    expect(pickNext(buttons[0], all, 'right')).toBe(65);
    expect(pickNext(buttons[2], all, 'left')).toBe(65);
  });

  it('from buttons beside the top row, Down skips the squares level with them', () => {
    // Big screens: New game / Rules / Share sit right of the board, centred a little above h8's centre.
    const side: Box[] = [
      { left: 340, top: 2, width: 80, height: 30 },
      { left: 430, top: 2, width: 60, height: 30 },
    ];
    expect(pickNext(side[1], [...squares, ...side], 'down')).toBe(at(7, 1)); // h7, the first square below
    expect(pickNext(side[1], [...squares, ...side], 'up')).toBe(-1);
    expect(pickNext(side[1], [...squares, ...side], 'left')).toBe(64);
    expect(pickNext(side[0], [...squares, ...side], 'left')).toBe(at(7, 0)); // in line: back to h8
  });

  it('follows a column of stacked cards', () => {
    const cards: Box[] = [0, 1, 2].map((i) => ({ left: 20, top: 100 + i * 90, width: 300, height: 80 }));
    expect(pickNext(cards[0], cards, 'down')).toBe(1);
    expect(pickNext(cards[2], cards, 'up')).toBe(1);
    expect(pickNext(cards[1], cards, 'right')).toBe(-1);
  });
});
