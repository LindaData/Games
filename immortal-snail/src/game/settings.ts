/** The game's fixed settings and its three modes. */

/** The three ways to play. They differ only in what a snail does to the pieces it crawls onto. */
export type Mode = 'ghost' | 'hungry' | 'sacrifice';

export const MODES: readonly Mode[] = ['ghost', 'hungry', 'sacrifice'];

export function isMode(x: unknown): x is Mode {
  return MODES.includes(x as Mode);
}

/** Both snails crawl after every Nth turn (turn 1 is the first turn): after turns 3, 6, 9, … */
export const SNAILS_EVERY = 3;

/**
 * The computer: a friendly opponent that looks one move ahead and picks randomly among moves
 * within 80 centipawns of its best, so it plays loosely and varies from game to game.
 */
export const AI_SETTINGS = { depth: 1, randomWindow: 80, quiescence: false } as const;
