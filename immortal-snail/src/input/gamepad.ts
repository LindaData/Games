/**
 * Controller input (Steam Deck, Xbox / PlayStation pads) as plain functions, so the mapping can be
 * unit tested without a browser. useGamepad.ts polls the Gamepad API and feeds them.
 *
 * Mapping (the W3C "standard" layout every common pad reports):
 *   D-pad or left stick  move          A  select / move / press
 *   B  back (deselect, close a card)  X  rules
 *   Y or Start  new game (two presses while a game is on, like the button)
 */

export type PadAction = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'x' | 'y' | 'start';

export const DIRECTIONS: readonly PadAction[] = ['up', 'down', 'left', 'right'];

/** Standard-mapping button index -> action. */
export const BUTTON_ACTIONS: ReadonlyArray<readonly [number, PadAction]> = [
  [0, 'a'],
  [1, 'b'],
  [2, 'x'],
  [3, 'y'],
  [9, 'start'],
  [12, 'up'],
  [13, 'down'],
  [14, 'left'],
  [15, 'right'],
];

/** The left stick counts as a direction past this far; once held, until it falls back under RELEASE. */
export const STICK_PRESS = 0.5;
export const STICK_RELEASE = 0.35;
/** A held direction repeats: first after REPEAT_DELAY_MS, then every REPEAT_MS. Buttons never repeat. */
export const REPEAT_DELAY_MS = 380;
export const REPEAT_MS = 140;

/** The parts of a Gamepad this needs (a real Gamepad fits). */
export interface PadLike {
  readonly buttons: ReadonlyArray<{ readonly pressed: boolean; readonly value?: number }>;
  readonly axes: ReadonlyArray<number>;
  readonly connected?: boolean;
}

/**
 * Which actions are held right now, on any connected pad. `before` (what was held last time)
 * gives the stick its hysteresis, so a stick resting near the threshold doesn't flicker.
 * The stick gives one direction at a time: the axis pushed further.
 */
export function heldActions(pads: ReadonlyArray<PadLike | null | undefined>, before: ReadonlySet<PadAction> = new Set()): Set<PadAction> {
  const held = new Set<PadAction>();
  for (const pad of pads) {
    if (!pad || pad.connected === false) continue;
    for (const [index, action] of BUTTON_ACTIONS) {
      const b = pad.buttons[index];
      if (b && (b.pressed || (b.value ?? 0) > 0.5)) held.add(action);
    }
    const x = pad.axes[0] ?? 0;
    const y = pad.axes[1] ?? 0;
    const horizontal = Math.abs(x) >= Math.abs(y);
    const dir: PadAction = horizontal ? (x < 0 ? 'left' : 'right') : y < 0 ? 'up' : 'down';
    const amount = Math.abs(horizontal ? x : y);
    if (amount >= (before.has(dir) ? STICK_RELEASE : STICK_PRESS)) held.add(dir);
  }
  return held;
}

/** For each held action: when it fires next (directions repeat; buttons wait to be let go). */
export type RepeatState = ReadonlyMap<PadAction, number>;

/**
 * The actions that fire at time `now`, given what is held and the previous state. A newly
 * pressed action fires at once; a held direction fires again on the repeat schedule.
 */
export function stepPad(state: RepeatState, held: ReadonlySet<PadAction>, now: number): { fire: PadAction[]; state: RepeatState } {
  const fire: PadAction[] = [];
  const next = new Map<PadAction, number>();
  for (const action of held) {
    const due = state.get(action);
    const repeats = DIRECTIONS.includes(action);
    if (due === undefined) {
      fire.push(action);
      next.set(action, repeats ? now + REPEAT_DELAY_MS : Infinity);
    } else if (now >= due) {
      fire.push(action);
      next.set(action, now + REPEAT_MS);
    } else {
      next.set(action, due);
    }
  }
  return { fire, state: next };
}
