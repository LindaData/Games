import { describe, expect, it } from 'vitest';
import type { Square } from 'chess.js';
import {
  SNAIL_START,
  chebyshev,
  euclid2,
  fileOf,
  nextSnailStep,
  rankOf,
  snailMovesAfterTurn,
  toSquare,
  turnsUntilSnailMoves,
} from '../src/game/snail';

const ALL: Square[] = [];
for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) ALL.push(toSquare(f, r)!);

describe('snail geometry', () => {
  it('measures Chebyshev and squared Euclidean distance', () => {
    expect(chebyshev('a8', 'e1')).toBe(7);
    expect(chebyshev('d4', 'e5')).toBe(1);
    expect(chebyshev('c3', 'c3')).toBe(0);
    expect(euclid2('a8', 'e1')).toBe(16 + 49);
    expect(fileOf('h3')).toBe(7);
    expect(rankOf('h3')).toBe(2);
    expect(SNAIL_START).toBe('a8');
  });
});

describe('nextSnailStep', () => {
  it('crawls straight along a file or rank', () => {
    expect(nextSnailStep('a8', 'a1')).toBe('a7');
    expect(nextSnailStep('d4', 'h4')).toBe('e4');
    expect(nextSnailStep('h5', 'b5')).toBe('g5');
    expect(nextSnailStep('e2', 'e1')).toBe('e1');
  });

  it('crawls diagonally when the king is on a diagonal', () => {
    expect(nextSnailStep('a8', 'h1')).toBe('b7');
    expect(nextSnailStep('c3', 'f6')).toBe('d4');
    expect(nextSnailStep('g7', 'e5')).toBe('f6');
  });

  it('breaks Chebyshev ties by Euclidean distance', () => {
    // From a8 toward e1, both a7 and b7 are 6 king-steps away; b7 is closer as the crow flies.
    expect(chebyshev('a7', 'e1')).toBe(chebyshev('b7', 'e1'));
    expect(nextSnailStep('a8', 'e1')).toBe('b7');
    // From a8 toward b1: a7 and b7 tie at 6 steps; b7 is directly above b1.
    expect(chebyshev('a7', 'b1')).toBe(chebyshev('b7', 'b1'));
    expect(nextSnailStep('a8', 'b1')).toBe('b7');
    // Knight-shaped offset: d5/e5 tie on Chebyshev, e5 wins on Euclid.
    expect(nextSnailStep('d4', 'f7')).toBe('e5');
  });

  it('stays put only when already on the target', () => {
    expect(nextSnailStep('e4', 'e4')).toBe('e4');
  });

  it('always moves exactly one king-step and gets one step closer, from every square to every target', () => {
    for (const from of ALL) {
      for (const target of ALL) {
        if (from === target) continue;
        const to = nextSnailStep(from, target);
        expect(chebyshev(from, to)).toBe(1);
        expect(chebyshev(to, target)).toBe(chebyshev(from, target) - 1);
        // Deterministic: same inputs, same answer.
        expect(nextSnailStep(from, target)).toBe(to);
      }
    }
  });

  it('chases a king along a whole path', () => {
    const path: Square[] = [];
    let s: Square = 'a8';
    while (s !== 'e1') {
      s = nextSnailStep(s, 'e1');
      path.push(s);
    }
    expect(path).toEqual(['b7', 'c6', 'd5', 'e4', 'e3', 'e2', 'e1']);
  });
});

describe('snail schedule', () => {
  it('Easy crawls every 3rd turn', () => {
    const turns = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((t) => snailMovesAfterTurn(t, 'easy'));
    expect(turns).toEqual([3, 6, 9]);
  });

  it('Normal crawls every 2nd turn', () => {
    const turns = [1, 2, 3, 4, 5, 6].filter((t) => snailMovesAfterTurn(t, 'normal'));
    expect(turns).toEqual([2, 4, 6]);
  });

  it('Hard crawls every turn', () => {
    expect([1, 2, 3, 4].every((t) => snailMovesAfterTurn(t, 'hard'))).toBe(true);
  });

  it('counts turns until the next crawl (1 = after this turn)', () => {
    expect([1, 2, 3, 4].map((t) => turnsUntilSnailMoves(t, 'easy'))).toEqual([3, 2, 1, 3]);
    expect([1, 2, 3, 4].map((t) => turnsUntilSnailMoves(t, 'normal'))).toEqual([2, 1, 2, 1]);
    expect([1, 2, 3].map((t) => turnsUntilSnailMoves(t, 'hard'))).toEqual([1, 1, 1]);
  });
});
