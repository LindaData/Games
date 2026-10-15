/**
 * Pure snail maths. The snails are not chess pieces: each is an overlay token with its own
 * square that crawls one king-step at a time toward the enemy king.
 */
import type { Color, Square } from 'chess.js';
import { SNAILS_EVERY } from './settings';

/** Both snails, keyed by owner: `w` is yours (it hunts the black king), `b` is theirs (it hunts yours). */
export interface Snails {
  readonly w: Square;
  readonly b: Square;
}

/** Where the snails start in Ghost and Hungry games: point-symmetric, 7 steps from the enemy king. */
export const SNAIL_STARTS: Snails = { w: 'h1', b: 'a8' };

const FILES = 'abcdefgh';

export const otherColor = (c: Color): Color => (c === 'w' ? 'b' : 'w');

/** 0 = a-file … 7 = h-file. */
export function fileOf(sq: Square): number {
  return sq.charCodeAt(0) - 97;
}

/** 0 = rank 1 … 7 = rank 8. */
export function rankOf(sq: Square): number {
  return sq.charCodeAt(1) - 49;
}

export function toSquare(file: number, rank: number): Square | null {
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  return `${FILES[file]}${rank + 1}` as Square;
}

export function isSquare(x: unknown): x is Square {
  return typeof x === 'string' && /^[a-h][1-8]$/.test(x);
}

/** The same file on the other side of the board: b1 ↔ b8, e2 ↔ e7. */
export function mirrorSquare(sq: Square): Square {
  return toSquare(fileOf(sq), 7 - rankOf(sq))!;
}

/** King-move distance between two squares. */
export function chebyshev(a: Square, b: Square): number {
  return Math.max(Math.abs(fileOf(a) - fileOf(b)), Math.abs(rankOf(a) - rankOf(b)));
}

/** Squared Euclidean distance between two squares (used to break Chebyshev ties). */
export function euclid2(a: Square, b: Square): number {
  const df = fileOf(a) - fileOf(b);
  const dr = rankOf(a) - rankOf(b);
  return df * df + dr * dr;
}

/**
 * Fixed direction order used as the final tie-break, as [fileDelta, rankDelta]:
 * N, NE, E, SE, S, SW, W, NW.
 */
export const DIRECTIONS: readonly (readonly [number, number])[] = [
  [0, 1],
  [1, 1],
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, -1],
  [-1, 0],
  [-1, 1],
];

/**
 * The square a snail crawls to next: the neighbouring square that minimises Chebyshev
 * distance to the target, then squared Euclidean distance, then the fixed direction order.
 * Returns the snail's own square when it is already on the target.
 */
export function nextSnailStep(snail: Square, target: Square): Square {
  if (snail === target) return snail;
  let best: Square = snail;
  let bestKey: [number, number, number] | null = null;
  DIRECTIONS.forEach(([df, dr], i) => {
    const sq = toSquare(fileOf(snail) + df, rankOf(snail) + dr);
    if (!sq) return;
    const key: [number, number, number] = [chebyshev(sq, target), euclid2(sq, target), i];
    if (
      !bestKey ||
      key[0] < bestKey[0] ||
      (key[0] === bestKey[0] && (key[1] < bestKey[1] || (key[1] === bestKey[1] && key[2] < bestKey[2])))
    ) {
      bestKey = key;
      best = sq;
    }
  });
  return best;
}

/** Where both snails crawl next, given both kings. Computed from where they are now. */
export function nextSnailSteps(snails: Snails, kings: Record<Color, Square>): Snails {
  return { w: nextSnailStep(snails.w, kings.b), b: nextSnailStep(snails.b, kings.w) };
}

/** Do the snails crawl after (the computer's reply in) this turn? Turn 1 is the first turn. */
export function snailsCrawlAfterTurn(turn: number): boolean {
  return turn % SNAILS_EVERY === 0;
}

/**
 * How many turns (counting the current one) until the snails crawl:
 * 1 = "after this turn", 2 = after the next turn, and so on.
 */
export function turnsUntilCrawl(turn: number): number {
  const r = turn % SNAILS_EVERY;
  return r === 0 ? 1 : SNAILS_EVERY - r + 1;
}
