import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { MIN_THINK_MS } from '../src/ai/client';
import type { Square } from 'chess.js';
import { MATE, chooseMove, createRng, type AiRequest } from '../src/ai/search';
import { AI_SETTINGS, SNAILS_EVERY } from '../src/game/settings';
import { SNAIL_STARTS, chebyshev, toSquare } from '../src/game/snail';

const CONFIGS: [string, Omit<AiRequest, 'fen'>][] = [
  ['the game’s AI', AI_SETTINGS],
  ['depth 1', { depth: 1 }],
  ['depth 2', { depth: 2, quiescence: true }],
  ['depth 3', { depth: 3, quiescence: true }],
];

const MATES_IN_ONE = [
  // Fool's mate: ...Qh4#
  'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2',
  // Back-rank: ...Rd1#
  '3r2k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1',
  // White to move: Qxf7# (scholar's mate pattern)
  'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
];

function isLegal(fen: string, m: { from: string; to: string; promotion?: string }): boolean {
  return new Chess(fen).moves({ verbose: true }).some(
    (x) => x.from === m.from && x.to === m.to && (x.promotion ?? undefined) === (m.promotion ?? undefined),
  );
}

describe('fixed settings', () => {
  it('your snail starts on h1, theirs on a8, and both crawl every 3rd turn', () => {
    expect(SNAIL_STARTS).toEqual({ w: 'h1', b: 'a8' });
    expect(SNAILS_EVERY).toBe(3);
  });

  it('the computer is friendly: depth 1, random within 80 centipawns, at least 400 ms per move', () => {
    expect(AI_SETTINGS).toEqual({ depth: 1, randomWindow: 80, quiescence: false });
    expect(MIN_THINK_MS).toBe(400);
  });
});

describe('AI', () => {
  for (const [name, cfg] of CONFIGS) {
    it(`finds a mate in one (${name})`, () => {
      for (const fen of MATES_IN_ONE) {
        for (const seed of [1, 2, 3]) {
          const r = chooseMove({ fen, ...cfg, seed });
          const c = new Chess(fen);
          c.move({ from: r.from, to: r.to, promotion: r.promotion });
          expect(c.isCheckmate(), `${name} ${fen} played ${r.from}${r.to}`).toBe(true);
          expect(r.score).toBe(MATE - 1);
        }
      }
    });
  }

  it('prefers a faster mate', () => {
    // Black can mate now with ...Rd1#, or dawdle; the score says mate in 1 ply.
    const r = chooseMove({ fen: '3r2k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1', depth: 3, quiescence: true });
    expect(`${r.from}${r.to}`).toBe('d8d1');
  });

  it('handles positions with a single legal move', () => {
    const fen = 'k7/8/8/8/8/8/8/1R4K1 b - - 0 1'; // only Ka7
    expect(new Chess(fen).moves()).toEqual(['Ka7']);
    for (const [, cfg] of CONFIGS) {
      const r = chooseMove({ fen, ...cfg });
      expect(`${r.from}${r.to}`).toBe('a8a7');
    }
    // In check from the rook with exactly one way out: Kh7.
    const forced = 'R6k/6p1/8/8/8/8/8/K7 b - - 0 1';
    expect(new Chess(forced).moves()).toEqual(['Kh7']);
    for (const [, cfg] of CONFIGS) {
      const r = chooseMove({ fen: forced, ...cfg });
      expect(`${r.from}${r.to}`).toBe('h8h7');
    }
  });

  it('throws when there is no legal move', () => {
    expect(() => chooseMove({ fen: 'k7/2Q5/8/8/8/8/8/K7 b - - 0 1', depth: 2 })).toThrow();
  });

  it('grabs a hanging queen', () => {
    const r = chooseMove({ fen: '4k3/8/8/3Q4/8/2n5/8/4K3 b - - 0 1', depth: 2, quiescence: true });
    expect(`${r.from}${r.to}`).toBe('c3d5');
  });

  it('never returns an illegal move over many random positions', () => {
    const rng = createRng(12345);
    let checked = 0;
    for (let g = 0; g < 60; g++) {
      const c = new Chess();
      const plies = Math.floor(rng() * 80);
      for (let i = 0; i < plies && !c.isGameOver(); i++) {
        const ms = c.moves();
        c.move(ms[Math.floor(rng() * ms.length)]);
      }
      if (c.isGameOver()) continue;
      const fen = c.fen();
      const cfg = CONFIGS[g % CONFIGS.length][1];
      const r = chooseMove({ fen, ...cfg, seed: g });
      expect(isLegal(fen, r), `${fen} -> ${r.from}${r.to}${r.promotion ?? ''}`).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThan(30);
  });

  it('never returns an illegal move or a king step onto the enemy snail, over many random positions', () => {
    const rng = createRng(777);
    const sq = () => toSquare(Math.floor(rng() * 8), Math.floor(rng() * 8))!;
    let checked = 0;
    for (let g = 0; g < 60; g++) {
      const c = new Chess();
      const plies = Math.floor(rng() * 80);
      for (let i = 0; i < plies && !c.isGameOver(); i++) {
        const ms = c.moves();
        c.move(ms[Math.floor(rng() * ms.length)]);
      }
      if (c.isGameOver()) continue;
      const fen = c.fen();
      const us = c.turn();
      // Put the enemy snail right next to our king, so the filter often matters.
      const king = c.findPiece({ type: 'k', color: us })[0];
      const near = toSquare(king.charCodeAt(0) - 97 + (rng() < 0.5 ? 1 : -1), king.charCodeAt(1) - 49) ?? sq();
      const snails = us === 'w' ? { w: sq(), b: near } : { w: near, b: sq() };
      const enemy = us === 'w' ? snails.b : snails.w;
      const cfg = CONFIGS[g % CONFIGS.length][1];
      const allowed = c.moves({ verbose: true }).filter((m) => !(m.piece === 'k' && m.to === enemy));
      if (allowed.length === 0) {
        expect(() => chooseMove({ fen, ...cfg, snails, mode: 'hungry', crawlIn: 1 + (g % 3) })).toThrow();
        continue;
      }
      const r = chooseMove({ fen, ...cfg, seed: g, snails, mode: g % 2 ? 'hungry' : 'ghost', crawlIn: 1 + (g % 3) });
      expect(isLegal(fen, r), `${fen} -> ${r.from}${r.to}`).toBe(true);
      expect(allowed.some((m) => m.from === r.from && m.to === r.to), `${fen} snail ${enemy} -> ${r.from}${r.to}`).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThan(30);
  });

  it('the game’s AI varies its play with the seed but stays legal', () => {
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 3 3';
    const picks = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      const r = chooseMove({ fen, ...AI_SETTINGS, seed });
      expect(isLegal(fen, r)).toBe(true);
      picks.add(`${r.from}${r.to}`);
    }
    expect(picks.size).toBeGreaterThan(1);
  });
});

describe('AI and the snails', () => {
  const seeds = Array.from({ length: 25 }, (_, i) => i);
  const play = (req: AiRequest) => {
    const r = chooseMove(req);
    return `${r.from}${r.to}`;
  };

  it('never takes with its king onto your snail, even a free queen', () => {
    // Kxd7 wins the queen, but d7 is your snail's square: only Kf8 is allowed.
    const fen = '4k3/3Q4/8/8/8/8/8/K7 b - - 0 1';
    for (const [, cfg] of CONFIGS) {
      for (const seed of [1, 2, 3]) expect(play({ fen, ...cfg, seed, snails: { w: 'd7', b: 'a8' } })).toBe('e8f8');
    }
    // Without the snail it grabs the queen.
    expect(play({ fen, depth: 2, quiescence: true })).toBe('e8d7');
  });

  it('has no move when its king is trapped by your snail', () => {
    // In check from the queen; the only escape, Kxe7, is onto your snail.
    expect(() => chooseMove({ fen: '4k3/4Q3/8/8/8/8/8/K7 b - - 0 1', depth: 1, snails: { w: 'e7', b: 'a8' } })).toThrow();
  });

  it('keeps its king from stepping next to your snail when it can', () => {
    // Black Ke5; your snail on g4 makes f4 and f5 the squares next to it.
    const fen = '8/8/8/4k3/8/8/8/K7 b - - 0 1';
    for (const seed of seeds) {
      const to = play({ fen, ...AI_SETTINGS, seed, snails: { w: 'g4', b: 'a8' }, mode: 'ghost', crawlIn: 3 }).slice(2) as Square;
      expect(chebyshev(to, 'g4'), `seed ${seed}: ${to}`).toBeGreaterThan(1);
    }
  });

  it('won’t end its move next to your snail right before a crawl, even to win a piece', () => {
    // Kxd4 wins a knight but ends next to your snail on e3.
    const fen = '8/8/8/4k3/3N4/8/8/K7 b - - 0 1';
    for (const seed of seeds) {
      const to = play({ fen, ...AI_SETTINGS, seed, snails: { w: 'e3', b: 'a8' }, crawlIn: 1 }).slice(2) as Square;
      expect(chebyshev(to, 'e3'), `seed ${seed}: ${to}`).toBeGreaterThan(1);
    }
    // With the crawl further off, the knight is worth the risk.
    expect(play({ fen, ...AI_SETTINGS, seed: 1, snails: { w: 'e3', b: 'a8' }, crawlIn: 2 })).toBe('e5d4');
  });

  it('in Hungry games, moves a piece off your snail’s next square before the crawl', () => {
    // Your snail c4 crawls onto the black knight on d5 right after this move.
    const fen = '4k3/8/8/3n4/8/8/8/K7 b - - 0 1';
    for (const seed of seeds) {
      expect(play({ fen, ...AI_SETTINGS, seed, snails: { w: 'c4', b: 'a8' }, mode: 'hungry', crawlIn: 1 }).slice(0, 2)).toBe('d5');
    }
  });
});
