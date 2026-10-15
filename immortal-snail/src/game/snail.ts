/**
 * Pure snail maths. The Immortal Snail is not a chess piece: it is an overlay token with
 * its own square that crawls one king-step at a time toward the white king.
 */
import type { Square } from 'chess.js';
import { SNAIL_EVERY } from './settings';

export const SNAIL_START: Square = 'a8';

const FILES = 'abcdefgh';

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
 * The square the snail crawls to next: the neighbouring square that minimises Chebyshev
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

/** Does the snail crawl after (Black's reply in) this turn? Turn 1 is the first turn. */
export function snailMovesAfterTurn(turn: number): boolean {
  return turn % SNAIL_EVERY === 0;
}

/**
 * How many turns (counting the current one) until the snail crawls:
 * 1 = "after this turn", 2 = after the next turn, and so on.
 */
export function turnsUntilSnailMoves(turn: number): number {
  const r = turn % SNAIL_EVERY;
  return r === 0 ? 1 : SNAIL_EVERY - r + 1;
}
