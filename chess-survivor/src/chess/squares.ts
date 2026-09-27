import type { Square } from 'chess.js';

export const FILES = 'abcdefgh';

export const ALL_SQUARES: Square[] = (() => {
  const out: Square[] = [];
  for (let r = 8; r >= 1; r--) for (const f of FILES) out.push(`${f}${r}` as Square);
  return out;
})();

export function fileOf(sq: Square): number {
  return FILES.indexOf(sq[0]);
}
export function rankOf(sq: Square): number {
  return Number(sq[1]);
}
export function toSquare(file: number, rank: number): Square | null {
  if (file < 0 || file > 7 || rank < 1 || rank > 8) return null;
  return `${FILES[file]}${rank}` as Square;
}
export function isDark(sq: Square): boolean {
  return (fileOf(sq) + rankOf(sq)) % 2 === 1; // a1 is dark
}
export function chebyshev(a: Square, b: Square): number {
  return Math.max(Math.abs(fileOf(a) - fileOf(b)), Math.abs(rankOf(a) - rankOf(b)));
}
/** Reflect a square across the board's horizontal midline (e2 <-> e7). */
export function mirrorSquare(sq: Square): Square {
  return `${sq[0]}${9 - rankOf(sq)}` as Square;
}

/** 0x88 index used internally by chess.js. */
export function to0x88(sq: Square): number {
  return (8 - rankOf(sq)) * 16 + fileOf(sq);
}
export function from0x88(i: number): Square {
  return `${FILES[i & 15]}${8 - (i >> 4)}` as Square;
}
