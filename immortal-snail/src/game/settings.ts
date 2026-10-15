/** The game's fixed settings. There is one mode and nothing to configure. */

/** The snail crawls after every Nth turn (turn 1 is the first turn): after turns 2, 4, 6, … */
export const SNAIL_EVERY = 2;

/**
 * The computer: a friendly opponent that looks one move ahead and picks randomly among moves
 * within 80 centipawns of its best, so it plays loosely and varies from game to game.
 */
export const AI_SETTINGS = { depth: 1, randomWindow: 80, quiescence: false } as const;
