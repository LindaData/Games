import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { MATE, chooseMove, createRng, type AiRequest } from '../src/ai/search';
import { DIFFICULTIES, DIFFICULTY } from '../src/game/difficulty';

const CONFIGS: [string, Omit<AiRequest, 'fen'>][] = [
  ['depth 1', { depth: 1 }],
  ['depth 2', { depth: 2, quiescence: true }],
  ['depth 3', { depth: 3, quiescence: true }],
  ...DIFFICULTIES.map(
    (d): [string, Omit<AiRequest, 'fen'>] => [
      DIFFICULTY[d].label,
      { depth: DIFFICULTY[d].aiDepth, randomWindow: DIFFICULTY[d].randomWindow, quiescence: DIFFICULTY[d].quiescence },
    ],
  ),
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

  it('Easy mode varies its play with the seed but stays legal', () => {
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 3 3';
    const picks = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      const r = chooseMove({ fen, depth: 1, randomWindow: 80, seed });
      expect(isLegal(fen, r)).toBe(true);
      picks.add(`${r.from}${r.to}`);
    }
    expect(picks.size).toBeGreaterThan(1);
  });
});
