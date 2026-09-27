import { describe, it, expect } from 'vitest';
import { chooseEnemyMove, type AiRequest } from '../src/ai/search';
import { profileForElo } from '../src/ai/profiles';

const base = (fen: string, playerSq: string, elo = 1400): AiRequest => ({
  fen,
  playerSq: playerSq as never,
  playerIsKing: false,
  allySq: null,
  immortalSq: null,
  armor: false,
  goal: { type: 'none' },
  profile: { ...profileForElo(elo), blunder: 0, noise: 0 },
  seed: 1,
});

describe('Hunter AI', () => {
  it('captures a hanging player piece', () => {
    // Black knight on f6 can take the player's knight on e4.
    const r = chooseEnemyMove(base('4k3/8/5n2/8/4N3/8/8/8 b - - 0 1', 'e4'));
    expect(r.from).toBe('f6');
    expect(r.to).toBe('e4');
  });

  it('does not hang a piece to the player when it cannot trap it', () => {
    const r = chooseEnemyMove(base('4k3/8/8/3q4/8/8/8/N7 b - - 0 1', 'a1'));
    // Qd5 must not step onto squares attacked by the knight (b3, c2)
    expect(['b3', 'c2']).not.toContain(r.to);
  });

  it('finds a forced net against a rook within depth', () => {
    const r = chooseEnemyMove(base('4k3/8/8/8/8/8/1q6/R7 b - - 0 1', 'a1', 1600));
    // Queen on b2 attacks a1 directly.
    expect(r.to).toBe('a1');
  });

  it('respects Reinforced Armor (pawns cannot capture the player)', () => {
    const req = base('4k3/8/8/8/8/3p4/4N3/8 b - - 0 1', 'e2');
    req.armor = true;
    const r = chooseEnemyMove(req);
    expect(r.to).not.toBe('e2');
  });

  it('runs a full-army search within its time budget', () => {
    const req = base('rnbqkbnr/pppppppp/8/8/8/8/4N3/8 b kq - 0 1', 'e2', 2200);
    const r = chooseEnemyMove(req);
    expect(r.ms).toBeLessThan(req.profile.timeMs + 800);
    expect(r.depth).toBeGreaterThanOrEqual(2);
  });
});
