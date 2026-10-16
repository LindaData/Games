/**
 * Moving focus with a D-pad: from the focused element, the nearest one in the pressed direction.
 * Works the same for board squares (the next square over), the buttons under the board and the
 * cards in a dialog. Pure geometry; focus.ts applies it to the page.
 */

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

const span = (b: Box, horizontal: boolean): [number, number] =>
  horizontal ? [b.left, b.left + b.width] : [b.top, b.top + b.height];
const mid = ([a, b]: [number, number]) => (a + b) / 2;

/**
 * Index of the box to move to from `from` in direction `dir`, or -1 when there is none.
 * Only boxes whose centre lies that way count, and a box off to the side (not overlapping `from`
 * across the direction of travel) only once it lies past `from`'s far edge: Down from a button
 * beside the board's top row never lands on a square level with it. Boxes in line with `from` win
 * over boxes off to the side; then the smallest gap wins, and being off to the side costs twice as
 * much as distance.
 */
export function pickNext(from: Box, boxes: readonly Box[], dir: Direction): number {
  const horizontal = dir === 'left' || dir === 'right';
  const sign = dir === 'right' || dir === 'down' ? 1 : -1;
  const along = span(from, horizontal);
  const across = span(from, !horizontal);
  let best = -1;
  let bestScore = Infinity;
  let bestDist = Infinity;
  boxes.forEach((box, i) => {
    const a = span(box, horizontal);
    const c = span(box, !horizontal);
    const ahead = sign * (mid(a) - mid(along));
    if (ahead < 1) return;
    const edgeGap = sign > 0 ? a[0] - along[1] : along[0] - a[1];
    const inLine = Math.min(c[1], across[1]) - Math.max(c[0], across[0]) > 1;
    if (!inLine && edgeGap < -1) return;
    const aside = inLine ? 0 : Math.abs(mid(c) - mid(across));
    const score = Math.max(0, edgeGap) + 2 * aside;
    const dist = Math.hypot(ahead, mid(c) - mid(across));
    if (score < bestScore || (score === bestScore && dist < bestDist)) {
      best = i;
      bestScore = score;
      bestDist = dist;
    }
  });
  return best;
}
