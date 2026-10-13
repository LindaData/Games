import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import {
  IllegalMoveError,
  advanceSnail,
  applyBlackMove,
  applyBlackReply,
  applyWhiteMove,
  describeComputerMove,
  focalKing,
  kingSquare,
  newGame,
  parseUci,
  pieceAt,
  restoreGame,
  serializeGame,
  snailJustCrawled,
  snailPreview,
  toSaved,
  whiteMoves,
  type GameState,
} from '../src/game/engine';
import { chooseMove } from '../src/ai/search';

const has = (s: GameState, uci: string) => whiteMoves(s).some((m) => `${m.from}${m.to}` === uci);

/** Play alternating UCI moves (White, Black, White, ...), crawling the snail when due. */
function play(s: GameState, ucis: string[]): GameState {
  for (const u of ucis) {
    if (s.phase === 'white') s = applyWhiteMove(s, parseUci(u));
    else if (s.phase === 'black') s = applyBlackReply(s, parseUci(u));
    else throw new Error(`cannot play ${u} in phase ${s.phase}`);
  }
  return s;
}

describe('new game', () => {
  it('starts from the standard position with the snail on a8', () => {
    const s = newGame('normal');
    expect(s.fen).toBe(new Chess().fen());
    expect(s.snail).toBe('a8');
    expect(s.turn).toBe(1);
    expect(s.phase).toBe('white');
    expect(whiteMoves(s)).toHaveLength(20);
  });
});

describe('the king and the snail', () => {
  it('the white king can never step onto the snail', () => {
    const s = newGame('normal', { fen: '4k3/8/8/8/8/8/P7/4K3 w - - 0 1', snail: 'd2' });
    expect(has(s, 'e1d2')).toBe(false);
    expect(has(s, 'e1d1')).toBe(true);
    expect(has(s, 'e1f2')).toBe(true);
    expect(() => applyWhiteMove(s, { from: 'e1', to: 'd2' })).toThrow(IllegalMoveError);
  });

  it('blocks castling whose king destination is the snail square', () => {
    const fen = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1';
    const free = newGame('normal', { fen, snail: 'a8' });
    expect(has(free, 'e1g1')).toBe(true);
    expect(has(free, 'e1c1')).toBe(true);

    const s = newGame('normal', { fen, snail: 'g1' });
    expect(has(s, 'e1g1')).toBe(false);
    expect(has(s, 'e1c1')).toBe(true);
    // Other pieces may move onto the snail's square.
    expect(has(s, 'h1g1')).toBe(true);

    const q = newGame('normal', { fen, snail: 'c1' });
    expect(has(q, 'e1c1')).toBe(false);
    expect(has(q, 'e1g1')).toBe(true);
  });

  it('lets any other piece share the snail square', () => {
    const s = newGame('normal', { fen: '4k3/8/8/8/8/8/P7/4K2N w - - 0 1', snail: 'g3' });
    expect(has(s, 'h1g3')).toBe(true);
    const after = applyWhiteMove(s, { from: 'h1', to: 'g3' });
    expect(pieceAt(after, 'g3')).toEqual({ type: 'n', color: 'w' });
    expect(after.snail).toBe('g3');
  });

  it('loses when the snail crawls onto the king', () => {
    let s = newGame('hard', { fen: '4k3/8/8/8/8/8/P7/4K3 w - - 0 1', snail: 'e2' });
    s = applyWhiteMove(s, { from: 'a2', to: 'a3' });
    s = applyBlackMove(s, { from: 'e8', to: 'd8' });
    expect(s.phase).toBe('snail');
    expect(snailPreview(s)).toBe('e1');
    s = advanceSnail(s);
    expect(s.phase).toBe('over');
    expect(s.snail).toBe('e1');
    expect(s.lastSnailStep).toEqual({ from: 'e2', to: 'e1' });
    expect(s.result).toMatchObject({ outcome: 'loss', cause: 'snail', title: 'The snail got you' });
  });

  it('does not crawl when Black’s reply checkmates', () => {
    let s = newGame('hard', { fen: 'r5k1/5ppp/8/8/8/8/1P4PP/7K w - - 0 1', snail: 'f3' });
    s = applyWhiteMove(s, { from: 'b2', to: 'b3' });
    s = applyBlackMove(s, { from: 'a8', to: 'a1' });
    expect(s.phase).toBe('over');
    expect(s.result).toMatchObject({ outcome: 'loss', cause: 'checkmated', title: 'Checkmate' });
    expect(s.snail).toBe('f3');
    expect(s.lastSnailStep).toBeNull();
  });

  it('does not crawl when Black’s reply draws by threefold repetition', () => {
    const s = play(newGame('normal'), ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8']);
    expect(s.phase).toBe('over');
    expect(s.result).toMatchObject({ outcome: 'draw', cause: 'threefold' });
    // Normal crawls after turns 2 and 4; turn 4's crawl is cancelled by the draw.
    expect(s.snail).toBe('b7');
    expect(s.turn).toBe(4);
  });

  it('loses when the snail corners the king (no legal moves left after the snail filter)', () => {
    // White: Ka1, a2 (blocked), h2. Black: Ka8, a3 (covers b2), h4.
    let s = newGame('hard', { fen: 'k7/8/8/8/7p/p7/P6P/K7 w - - 0 1', snail: 'c2' });
    expect(s.phase).toBe('white');
    s = applyWhiteMove(s, { from: 'h2', to: 'h3' }); // now blocked by h4
    s = applyBlackReply(s, { from: 'a8', to: 'b8' }); // snail c2 -> b1
    expect(s.snail).toBe('b1');
    expect(new Chess(s.fen).moves()).toEqual(['Kb1']); // chess.js still has a move...
    expect(s.phase).toBe('over'); // ...but it's onto the snail
    expect(s.result).toMatchObject({ outcome: 'loss', cause: 'cornered', title: 'The snail cornered you' });
  });

  it('crawls on schedule: Normal after turns 2 and 4', () => {
    let s = play(newGame('normal'), ['e2e4', 'e7e5']);
    expect(s.snail).toBe('a8');
    expect(s.turn).toBe(2);
    s = play(s, ['g1f3', 'b8c6']);
    expect(s.snail).toBe('b7');
    expect(s.turn).toBe(3);
    s = play(s, ['f1c4', 'g8f6']);
    expect(s.snail).toBe('b7');
    s = play(s, ['d2d3', 'f8c5']);
    expect(s.snail).toBe('c6');
    expect(s.turn).toBe(5);
  });

  it('follows the king when it moves', () => {
    let s = newGame('hard', { fen: '4k3/8/8/8/8/8/P7/4K3 w - - 0 1', snail: 'e4' });
    s = applyWhiteMove(s, { from: 'e1', to: 'f1' });
    s = applyBlackReply(s, { from: 'e8', to: 'd8' });
    expect(kingSquare(s, 'w')).toBe('f1');
    expect(s.snail).toBe('f3');
  });
});

describe('results', () => {
  it('wins by checkmating the computer', () => {
    let s = newGame('normal', { fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1' });
    s = applyWhiteMove(s, { from: 'a1', to: 'a8' });
    expect(s.phase).toBe('over');
    expect(s.result).toMatchObject({
      outcome: 'win',
      cause: 'checkmate',
      reason: 'You beat the computer before the snail got you!',
    });
  });

  it('draws when the player stalemates the computer', () => {
    let s = newGame('normal', { fen: 'k7/8/8/1Q6/8/8/8/K7 w - - 0 1' });
    s = applyWhiteMove(s, { from: 'b5', to: 'b6' });
    expect(s.phase).toBe('over');
    expect(s.result).toMatchObject({ outcome: 'draw', cause: 'stalemate' });
  });

  it('draws on insufficient material', () => {
    let s = newGame('normal', { fen: '4k3/8/8/8/8/8/3n4/4KB2 w - - 0 1' });
    s = applyWhiteMove(s, { from: 'e1', to: 'd2' });
    expect(s.result).toMatchObject({ outcome: 'draw', cause: 'insufficient' });
  });

  it('draws when the computer stalemates the player (not a snail loss)', () => {
    // After ...Qb3 the white king on a1 has no moves and is not in check.
    let s = newGame('hard', { fen: 'k7/8/8/8/8/8/2q5/K7 b - - 0 1', snail: 'h8' });
    s = applyBlackMove(s, { from: 'c2', to: 'b3' });
    expect(s.phase).toBe('over');
    expect(s.result).toMatchObject({ outcome: 'draw', cause: 'stalemate' });
    expect(s.snail).toBe('h8');
  });

  it('auto-queens the player’s promotions', () => {
    const s = newGame('normal', { fen: '8/P6k/8/8/8/8/8/K7 w - - 0 1' });
    const promos = whiteMoves(s).filter((m) => m.from === 'a7');
    expect(promos).toHaveLength(1);
    expect(promos[0].promotion).toBe('q');
    const after = applyWhiteMove(s, { from: 'a7', to: 'a8', promotion: 'n' });
    expect(pieceAt(after, 'a8')).toEqual({ type: 'q', color: 'w' });
    expect(after.history.at(-1)).toBe('a7a8q');
  });

  it('rejects moves out of turn', () => {
    const s = newGame('normal');
    expect(() => applyBlackMove(s, { from: 'e7', to: 'e5' })).toThrow(IllegalMoveError);
    expect(() => advanceSnail(s)).toThrow(IllegalMoveError);
  });
});

describe('what the UI shows about a position', () => {
  it('finds both kings', () => {
    const s = newGame('normal', { fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1' });
    expect(kingSquare(s, 'w')).toBe('g1');
    expect(kingSquare(s, 'b')).toBe('g8');
  });

  it('focuses the mated black king on a win and the white king otherwise', () => {
    let win = newGame('normal', { fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1' });
    expect(focalKing(win)).toBe('g1');
    win = applyWhiteMove(win, { from: 'd1', to: 'd8' });
    expect(win.result?.outcome).toBe('win');
    expect(focalKing(win)).toBe('g8');

    let loss = newGame('hard', { fen: 'r5k1/5ppp/8/8/8/8/1P4PP/7K w - - 0 1', snail: 'f3' });
    loss = play(loss, ['b2b3', 'a8a1']);
    expect(loss.result?.outcome).toBe('loss');
    expect(focalKing(loss)).toBe('h1');
  });

  it('describes the computer’s last move in words', () => {
    let s = play(newGame('normal'), ['e2e4']);
    expect(describeComputerMove(s)).toBeNull(); // White moved last
    s = play(s, ['g8f6']);
    expect(s.lastMove).toEqual({ from: 'g8', to: 'f6', color: 'b', piece: 'n' });
    expect(describeComputerMove(s)).toBe('Computer played knight g8 to f6.');
    s = play(s, ['e4e5', 'd7d5', 'e5f6']); // white pawn takes the knight
    expect(s.lastMove).toEqual({ from: 'e5', to: 'f6', color: 'w', piece: 'p', captured: 'n' });
    s = play(s, ['e7f6']);
    expect(describeComputerMove(s)).toBe('Computer played pawn e7 to f6, taking your pawn.');

    const castle = newGame('normal', { fen: 'r3k2r/8/8/8/8/8/8/4K3 b kq - 0 1' });
    expect(describeComputerMove(applyBlackMove(castle, { from: 'e8', to: 'g8' }))).toBe(
      'Computer played king e8 to g8, castling.',
    );
    const promo = newGame('normal', { fen: '7k/8/8/8/8/8/p7/7K b - - 0 1' });
    expect(describeComputerMove(applyBlackMove(promo, { from: 'a2', to: 'a1', promotion: 'q' }))).toBe(
      'Computer played pawn a2 to a1, promoting to a queen.',
    );
  });

  it('knows when the snail has just crawled', () => {
    let s = play(newGame('normal'), ['e2e4', 'e7e5']); // turn 1: no crawl on Normal
    expect(s.turn).toBe(2);
    expect(snailJustCrawled(s)).toBe(false);
    s = play(s, ['g1f3', 'b8c6']); // turn 2: crawl
    expect(s.snail).toBe('b7');
    expect(snailJustCrawled(s)).toBe(true);
    s = play(s, ['f1c4']);
    expect(snailJustCrawled(s)).toBe(false); // computer's turn
    s = play(s, ['g8f6']); // turn 3: no crawl
    expect(snailJustCrawled(s)).toBe(false);

    const hard = play(newGame('hard'), ['e2e4', 'e7e5']);
    expect(hard.snail).toBe('b7');
    expect(snailJustCrawled(hard)).toBe(true);
  });
});

describe('save and resume', () => {
  /** A real game: the player plays seeded random moves, the computer answers at depth 1. */
  function sampleGame(difficulty: 'easy' | 'normal' | 'hard', plies: number, seed = 3): GameState {
    let s = newGame(difficulty);
    let r = seed;
    const rand = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = 0; i < plies && s.phase !== 'over'; i++) {
      if (s.phase === 'white') {
        const ms = whiteMoves(s);
        const m = ms[Math.floor(rand() * ms.length)];
        s = applyWhiteMove(s, m);
      } else if (s.phase === 'black') {
        const ai = chooseMove({ fen: s.fen, depth: 1, seed: i });
        s = applyBlackReply(s, ai);
      }
    }
    return s;
  }

  const comparable = (s: GameState) => ({ ...s });

  it('round-trips a game in progress', () => {
    for (const d of ['easy', 'normal', 'hard'] as const) {
      const s = sampleGame(d, 24);
      const restored = restoreGame(serializeGame(s));
      expect(restored).not.toBeNull();
      expect(comparable(restored!)).toEqual(comparable(s));
      expect(whiteMoves(restored!)).toEqual(whiteMoves(s));
    }
  });

  it('round-trips while waiting for the computer and between reply and crawl', () => {
    let s = play(newGame('normal'), ['e2e4', 'e7e5', 'd2d4']);
    expect(s.phase).toBe('black');
    expect(comparable(restoreGame(serializeGame(s))!)).toEqual(comparable(s));

    s = applyBlackMove(s, { from: 'e5', to: 'd4' });
    expect(s.phase).toBe('snail');
    const pending = restoreGame(serializeGame(s))!;
    expect(comparable(pending)).toEqual(comparable(s));
    const crawled = advanceSnail(s);
    expect(comparable(restoreGame(serializeGame(crawled))!)).toEqual(comparable(crawled));
  });

  it('round-trips finished games, including a snail loss', () => {
    let s = newGame('hard', { fen: '4k3/8/8/8/8/8/P7/4K3 w - - 0 1', snail: 'e2' });
    s = play(s, ['a2a3', 'e8d8']);
    expect(s.result?.cause).toBe('snail');
    const restored = restoreGame(serializeGame(s))!;
    expect(comparable(restored)).toEqual(comparable(s));
  });

  it('returns null for missing or corrupt data', () => {
    const good = toSaved(play(newGame('normal'), ['e2e4', 'e7e5']));
    expect(restoreGame(null)).toBeNull();
    expect(restoreGame('')).toBeNull();
    expect(restoreGame('{not json')).toBeNull();
    expect(restoreGame('null')).toBeNull();
    expect(restoreGame(JSON.stringify({ ...good, v: 2 }))).toBeNull();
    expect(restoreGame(JSON.stringify({ ...good, difficulty: 'insane' }))).toBeNull();
    expect(restoreGame(JSON.stringify({ ...good, moves: ['e2e5'] }))).toBeNull();
    expect(restoreGame(JSON.stringify({ ...good, moves: 'e2e4' }))).toBeNull();
    expect(restoreGame(JSON.stringify({ ...good, snail: 'z9' }))).toBeNull();
    expect(restoreGame(JSON.stringify({ ...good, snail: 'c3' }))).toBeNull();
    expect(restoreGame(JSON.stringify({ ...good, turn: 7 }))).toBeNull();
    expect(restoreGame(JSON.stringify({ ...good, setup: { fen: 'garbage' } }))).toBeNull();
    expect(restoreGame(JSON.stringify(good))).not.toBeNull();
  });
});
