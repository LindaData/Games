import { describe, expect, it } from 'vitest';
import { Chess, type Square } from 'chess.js';
import {
  IllegalMoveError,
  applyBlackMove,
  applyBlackReply,
  applyWhiteMove,
  blackMoves,
  canSacrifice,
  checkedKing,
  crawlSnails,
  describeComputerMove,
  eatMessage,
  focalKing,
  kingSquare,
  newGame,
  parseUci,
  pieceAt,
  previousCrawl,
  restoreGame,
  serializeGame,
  snailDistances,
  snailPreview,
  startSacrifice,
  toSaved,
  whiteMoves,
  type GameState,
} from '../src/game/engine';
import { chooseMove } from '../src/ai/search';
import { MODES } from '../src/game/settings';
import { turnsUntilCrawl } from '../src/game/snail';

const has = (s: GameState, uci: string) => whiteMoves(s).some((m) => `${m.from}${m.to}` === uci);
const blackHas = (s: GameState, uci: string) => blackMoves(s).some((m) => `${m.from}${m.to}` === uci);
const castling = (s: GameState) => s.fen.split(' ')[2];
const enPassant = (s: GameState) => s.fen.split(' ')[3];

/** Play alternating UCI moves (White, Black, White, ...), crawling the snails when due. */
function play(s: GameState, ucis: string[]): GameState {
  for (const u of ucis) {
    if (s.phase === 'white') s = applyWhiteMove(s, parseUci(u));
    else if (s.phase === 'black') s = applyBlackReply(s, parseUci(u));
    else throw new Error(`cannot play ${u} in phase ${s.phase}`);
  }
  return s;
}

describe('new game', () => {
  it('starts Ghost and Hungry games from the standard position with your snail on h1 and theirs on a8', () => {
    for (const mode of ['ghost', 'hungry'] as const) {
      const s = newGame(mode);
      expect(s.mode).toBe(mode);
      expect(s.fen).toBe(new Chess().fen());
      expect(s.snails).toEqual({ w: 'h1', b: 'a8' });
      expect(s.turn).toBe(1);
      expect(s.phase).toBe('white');
      expect(whiteMoves(s)).toHaveLength(20);
      expect(snailDistances(s)).toEqual({ w: 7, b: 7 });
      expect(snailPreview(s)).toEqual({ w: 'g2', b: 'b7' });
    }
  });
});

describe('the crawl', () => {
  it('happens after turns 3, 6 and 9 only, both snails at once', () => {
    const turns: [string, string][] = [
      ['e2e4', 'e7e5'],
      ['g1f3', 'b8c6'],
      ['f1c4', 'g8f6'],
      ['d2d3', 'f8c5'],
      ['b1c3', 'd7d6'],
      ['c1g5', 'c8g4'],
      ['h2h3', 'h7h6'],
      ['a2a3', 'a7a6'],
      ['d1d2', 'd8d7'],
    ];
    const seen: string[] = [];
    let s = newGame('ghost');
    turns.forEach(([white, black], i) => {
      const turn = i + 1;
      expect(s.turn).toBe(turn);
      s = applyWhiteMove(s, parseUci(white));
      s = applyBlackMove(s, parseUci(black));
      expect(s.phase, `turn ${turn}`).toBe(turn % 3 === 0 ? 'crawl' : 'white');
      if (s.phase === 'crawl') {
        expect(() => applyWhiteMove(s, parseUci('a3a4'))).toThrow(IllegalMoveError);
        s = crawlSnails(s);
        expect(s.lastCrawl?.turn).toBe(turn);
      }
      seen.push(`${s.snails!.w}/${s.snails!.b}`);
    });
    expect(seen).toEqual([
      'h1/a8',
      'h1/a8',
      'g2/b7',
      'g2/b7',
      'g2/b7',
      'f3/c6',
      'f3/c6',
      'f3/c6',
      'e4/d5',
    ]);
    expect(s.turn).toBe(10);
    expect(turnsUntilCrawl(s.turn)).toBe(3);
  });

  it('records both snails’ moves and when they happened', () => {
    let s = newGame('ghost', { turn: 3 });
    s = play(s, ['e2e4', 'e7e5']);
    expect(s.lastCrawl).toEqual({ turn: 3, from: { w: 'h1', b: 'a8' }, to: { w: 'g2', b: 'b7' }, eats: [] });
    expect(previousCrawl(s)).toBe(s.lastCrawl);
    s = play(s, ['g1f3', 'b8c6']);
    expect(previousCrawl(s)).toBeNull(); // news lasts one turn
  });

  it('follows each king when it moves', () => {
    let s = newGame('ghost', { fen: '4k3/8/8/8/8/8/P7/4K3 w - - 0 1', snails: { w: 'e4', b: 'e5' }, turn: 3 });
    s = applyWhiteMove(s, { from: 'e1', to: 'f1' });
    s = applyBlackReply(s, { from: 'e8', to: 'd8' });
    expect(kingSquare(s, 'w')).toBe('f1');
    expect(s.snails).toEqual({ w: 'd5', b: 'f4' });
  });

  it('does not happen when the computer’s reply checkmates', () => {
    let s = newGame('ghost', { fen: 'r5k1/5ppp/8/8/8/8/1P4PP/7K w - - 0 1', snails: { b: 'f3' }, turn: 3 });
    s = applyWhiteMove(s, { from: 'b2', to: 'b3' });
    s = applyBlackMove(s, { from: 'a8', to: 'a1' });
    expect(s.phase).toBe('over');
    expect(s.result).toMatchObject({ outcome: 'loss', cause: 'checkmated', title: 'Checkmate — you lose' });
    expect(s.snails).toEqual({ w: 'h1', b: 'f3' });
    expect(s.lastCrawl).toBeNull();
  });

  it('does not happen when the reply draws by threefold repetition', () => {
    const s = play(newGame('ghost'), ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8']);
    expect(s.phase).toBe('over');
    expect(s.result).toMatchObject({ outcome: 'draw', cause: 'threefold' });
    expect(s.snails).toEqual({ w: 'g2', b: 'b7' }); // crawled after turn 3 only
    expect(s.turn).toBe(4);
  });
});

describe('touch = death, both ways', () => {
  const FEN = '4k3/p7/8/8/8/8/P7/4K3 w - - 0 1';

  it('you win when your snail lands on their king', () => {
    let s = newGame('ghost', { fen: FEN, snails: { w: 'e7', b: 'a8' }, turn: 3 });
    s = play(s, ['a2a3', 'a7a6']);
    expect(s.phase).toBe('over');
    expect(s.snails!.w).toBe('e8');
    expect(s.result).toMatchObject({ outcome: 'win', cause: 'snail-win', title: 'You win!', reason: 'Your snail got their king.' });
    expect(focalKing(s)).toBe('e8');
    expect(s.turn).toBe(3);
  });

  it('you lose when their snail lands on your king', () => {
    let s = newGame('ghost', { fen: FEN, snails: { w: 'h1', b: 'e2' }, turn: 3 });
    s = play(s, ['a2a3', 'a7a6']);
    expect(s.snails!.b).toBe('e1');
    expect(s.result).toMatchObject({ outcome: 'loss', cause: 'snail-loss', title: 'The snail got you!' });
    expect(focalKing(s)).toBe('e1');
  });

  it('is a draw when both snails strike in the same crawl', () => {
    let s = newGame('ghost', { fen: FEN, snails: { w: 'e7', b: 'e2' }, turn: 3 });
    s = play(s, ['a2a3', 'a7a6']);
    expect(s.snails).toEqual({ w: 'e8', b: 'e1' });
    expect(s.result).toMatchObject({ outcome: 'draw', cause: 'snail-draw', title: 'Draw', reason: 'Both snails struck at once.' });
  });

  it('lets snails share squares with any piece and with each other', () => {
    let s = newGame('ghost', { fen: '4k3/8/8/8/8/8/P7/4K2N w - - 0 1', snails: { w: 'g3', b: 'g3' } });
    expect(has(s, 'h1g3')).toBe(true);
    s = applyWhiteMove(s, { from: 'h1', to: 'g3' });
    expect(pieceAt(s, 'g3')).toEqual({ type: 'n', color: 'w' });
    expect(s.snails).toEqual({ w: 'g3', b: 'g3' });
  });
});

describe('kings and the enemy snail', () => {
  it('your king can never step onto their snail, but may share a square with yours', () => {
    const fen = '4k3/8/8/8/8/8/P7/4K3 w - - 0 1';
    const s = newGame('ghost', { fen, snails: { b: 'd2' } });
    expect(has(s, 'e1d2')).toBe(false);
    expect(has(s, 'e1f2')).toBe(true);
    expect(() => applyWhiteMove(s, { from: 'e1', to: 'd2' })).toThrow(IllegalMoveError);
    const own = newGame('ghost', { fen, snails: { w: 'd2', b: 'a8' } });
    expect(has(own, 'e1d2')).toBe(true);
  });

  it('blocks castling onto their snail', () => {
    const fen = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1';
    expect(has(newGame('ghost', { fen }), 'e1g1')).toBe(true);
    const s = newGame('ghost', { fen, snails: { b: 'g1' } });
    expect(has(s, 'e1g1')).toBe(false);
    expect(has(s, 'e1c1')).toBe(true);
    expect(has(s, 'h1g1')).toBe(true); // other pieces may move onto it
    const q = newGame('ghost', { fen, snails: { b: 'c1' } });
    expect(has(q, 'e1c1')).toBe(false);
    expect(has(q, 'e1g1')).toBe(true);
    expect(has(newGame('ghost', { fen, snails: { w: 'g1' } }), 'e1g1')).toBe(true); // your own snail
  });

  it('the computer’s king can never step or castle onto your snail', () => {
    const fen = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R b KQkq - 0 1';
    expect(blackHas(newGame('ghost', { fen }), 'e8g8')).toBe(true);
    const s = newGame('ghost', { fen, snails: { w: 'g8' } });
    expect(blackHas(s, 'e8g8')).toBe(false);
    expect(blackHas(s, 'e8c8')).toBe(true);
    expect(() => applyBlackMove(s, { from: 'e8', to: 'g8' })).toThrow(IllegalMoveError);
    const f = newGame('ghost', { fen, snails: { w: 'f8' } });
    expect(blackHas(f, 'e8f8')).toBe(false);
    expect(blackHas(f, 'e8d8')).toBe(true);
  });

  it('you lose when their snail traps your king (every move left is onto it)', () => {
    // White: Ka1, a2 (blocked), h2. Black: Ka8, a3 (covers b2), h5. Their snail crawls c2 -> b1.
    let s = newGame('ghost', { fen: 'k7/8/8/7p/8/p7/P6P/K7 w - - 0 1', snails: { b: 'c2' }, turn: 2 });
    s = play(s, ['h2h3', 'a8b8']);
    expect(s.snails!.b).toBe('c2');
    s = play(s, ['h3h4', 'b8a8']); // the h-pawn is now blocked; turn 3: crawl c2 -> b1
    expect(s.snails!.b).toBe('b1');
    expect(new Chess(s.fen).moves()).toEqual(['Kb1']); // chess.js still has a move...
    expect(s.phase).toBe('over'); // ...but it's onto their snail
    expect(s.result).toMatchObject({ outcome: 'loss', cause: 'trapped-loss', title: 'The snail trapped your king' });
  });

  it('you win when your snail traps their king', () => {
    // Black: Kh8, a7 and h7 blocked; g7 is covered by the h6 pawn. Its only move, Kg8, is onto your snail.
    let s = newGame('ghost', { fen: '7k/p6p/P6P/8/8/8/8/4K3 w - - 0 1', snails: { w: 'g8' } });
    s = applyWhiteMove(s, { from: 'e1', to: 'e2' });
    expect(new Chess(s.fen).moves()).toEqual(['Kg8']);
    expect(s.phase).toBe('over');
    expect(s.result).toMatchObject({ outcome: 'win', cause: 'trapped-win', title: 'You win!', reason: 'Your snail trapped their king.' });
  });
});

describe('Hungry snails', () => {
  // Your snail c4 crawls onto the black knight on d5; their snail c3 crawls onto the black knight on d2.
  const FEN = '4k3/8/8/3n4/8/8/P2n4/4K3 w - - 0 1';
  const SNAILS = { w: 'c4', b: 'c3' } as const;

  it('eat enemy pieces they crawl onto, never their own side’s', () => {
    let s = newGame('hungry', { fen: FEN, snails: SNAILS, turn: 3 });
    s = play(s, ['a2a3', 'e8d8']);
    expect(s.snails).toEqual({ w: 'd5', b: 'd2' });
    expect(pieceAt(s, 'd5')).toBeNull(); // eaten by your snail
    expect(pieceAt(s, 'd2')).toEqual({ type: 'n', color: 'b' }); // their own knight: shared, not eaten
    expect(s.lastCrawl?.eats).toEqual([{ by: 'w', square: 'd5', piece: 'n' }]);
    expect(s.phase).toBe('white');
    expect(s.fen.split(' ')[4]).toBe('0'); // eating counts as a capture for the 50-move rule
  });

  it('say what they ate for one turn', () => {
    let s = newGame('hungry', { fen: FEN, snails: SNAILS, turn: 3 });
    s = play(s, ['a2a3', 'e8d8']);
    expect(previousCrawl(s)!.eats.map(eatMessage)).toEqual(['Your snail ate their knight!']);
    s = play(s, ['a3a4', 'd8e8']);
    expect(previousCrawl(s)).toBeNull();
    expect(eatMessage({ by: 'b', square: 'c1', piece: 'b' })).toBe('Their snail ate your bishop!');
  });

  it('eat your pieces too', () => {
    // Their snail c3 crawls onto your bishop on d2.
    let s = newGame('hungry', { fen: '4k3/8/8/8/8/8/P2B4/4K3 w - - 0 1', snails: { w: 'h1', b: 'c3' }, turn: 3 });
    s = play(s, ['a2a3', 'e8d8']);
    expect(s.snails!.b).toBe('d2');
    expect(pieceAt(s, 'd2')).toBeNull();
    expect(previousCrawl(s)!.eats.map(eatMessage)).toEqual(['Their snail ate your bishop!']);
  });

  it('never eat a king (their own king just shares the square)', () => {
    // Their snail c5 heads for your king on e1 via d4, where the black king stands.
    let s = newGame('hungry', { fen: '8/8/8/8/3k4/8/P6p/4K3 w - - 0 1', snails: { w: 'a8', b: 'c5' }, turn: 3 });
    s = play(s, ['a2a3', 'h2h1q']);
    expect(s.snails!.b).toBe('d4');
    expect(pieceAt(s, 'd4')).toEqual({ type: 'k', color: 'b' });
    expect(s.lastCrawl?.eats).toEqual([]);
  });

  it('Ghost and Sacrifice snails never eat anything', () => {
    let ghost = newGame('ghost', { fen: FEN, snails: SNAILS, turn: 3 });
    ghost = play(ghost, ['a2a3', 'e8d8']);
    expect(ghost.snails).toEqual({ w: 'd5', b: 'd2' });
    expect(pieceAt(ghost, 'd5')).toEqual({ type: 'n', color: 'b' });
    expect(ghost.lastCrawl?.eats).toEqual([]);

    // Give up the b1 knight: your snail starts on b1 and crawls onto the black pawn on c2.
    let sac = newGame('sacrifice', { fen: '1n2k3/8/8/8/8/8/2p5/1N2K3 w - - 0 1', turn: 3 });
    sac = startSacrifice(sac, 'b1');
    sac = play(sac, ['e1f2', 'e8f8']);
    expect(sac.snails!.w).toBe('c2');
    expect(pieceAt(sac, 'c2')).toEqual({ type: 'p', color: 'b' });
  });

  it('clear an en-passant chance that no longer applies', () => {
    // Black plays d7-d5 next to your e5 pawn; e5xd6 en passant is on...
    const fen = '4k3/3p4/8/4P3/8/8/8/4K3 w - - 0 1';
    let ghost = newGame('ghost', { fen, snails: { w: 'c4', b: 'a8' }, turn: 3 });
    ghost = play(ghost, ['e1f1', 'd7d5']);
    expect(enPassant(ghost)).toBe('d6');
    expect(has(ghost, 'e5d6')).toBe(true);
    // ...unless your snail eats the d5 pawn on the way...
    let ate = newGame('hungry', { fen, snails: { w: 'c4', b: 'a8' }, turn: 3 });
    ate = play(ate, ['e1f1', 'd7d5']);
    expect(ate.lastCrawl?.eats).toEqual([{ by: 'w', square: 'd5', piece: 'p' }]);
    expect(enPassant(ate)).toBe('-');
    expect(has(ate, 'e5d6')).toBe(false);
    // ...or their snail eats your only pawn that could take it.
    let gone = newGame('hungry', { fen, snails: { w: 'h1', b: 'd6' }, turn: 3 });
    gone = play(gone, ['e1f1', 'd7d5']);
    expect(gone.lastCrawl?.eats).toEqual([{ by: 'b', square: 'e5', piece: 'p' }]);
    expect(enPassant(gone)).toBe('-');
  });

  it('keep an en-passant chance when the snail eats something unrelated', () => {
    // Your snail eats the far-away knight on b4 in the same crawl that follows d7-d5.
    const fen = '4k3/3p4/8/4P3/1n6/8/8/4K3 w - - 0 1';
    let s = newGame('hungry', { fen, snails: { w: 'a3', b: 'h8' }, turn: 3 });
    s = play(s, ['e1f1', 'd7d5']);
    expect(s.lastCrawl?.eats).toEqual([{ by: 'w', square: 'b4', piece: 'n' }]);
    expect(enPassant(s)).toBe('d6');
    expect(has(s, 'e5d6')).toBe(true);
    // Their snail eats your other pawn on c5: the e5 pawn can still take en passant.
    let t = newGame('hungry', { fen: '4k3/3p4/8/2P1P3/8/8/8/4K3 w - - 0 1', snails: { w: 'h1', b: 'b6' }, turn: 3 });
    t = play(t, ['e1f1', 'd7d5']);
    expect(t.lastCrawl?.eats).toEqual([{ by: 'b', square: 'c5', piece: 'p' }]);
    expect(enPassant(t)).toBe('d6');
    expect(has(t, 'e5d6')).toBe(true);
  });

  it('keep castling rights consistent: a rook that still has one is never on a snail’s path', () => {
    // A snail only eats on its way to that side's king, so it never lands on a1/h1/a8/h8 while the
    // king is still on e1/e8 (see snail.test.ts). Rights for rooks elsewhere are untouched.
    let s = newGame('hungry', { fen: 'r3k2r/8/8/8/1n6/8/8/R3K2R w KQkq - 0 1', snails: { w: 'a3', b: 'a8' }, turn: 3 });
    s = play(s, ['a1a2', 'e8d8']); // White's queenside rook moved: Q is gone
    expect(s.lastCrawl?.eats).toEqual([{ by: 'w', square: 'b4', piece: 'n' }]);
    expect(castling(s)).toBe('K');
  });

  it('you win when eating leaves their king open on your move', () => {
    // The pinned black knight on e6 shields its king from your rook; your snail eats it.
    let s = newGame('hungry', { fen: '4k3/7p/4n3/8/8/8/8/K3R3 w - - 0 1', snails: { w: 'e5', b: 'h8' }, turn: 3 });
    s = play(s, ['a1b1', 'h7h6']);
    expect(s.lastCrawl?.eats).toEqual([{ by: 'w', square: 'e6', piece: 'n' }]);
    expect(s.phase).toBe('over');
    expect(s.result).toMatchObject({ outcome: 'win', cause: 'open', title: 'You win!', reason: 'Their king was left open.' });
  });

  it('leave you in check (not lost) when eating opens a line to your king', () => {
    // Their snail eats your pinned knight on e4: the black rook now checks your king.
    let s = newGame('hungry', { fen: 'k3r3/8/8/8/4N3/8/P7/4K3 w - - 0 1', snails: { w: 'h1', b: 'e5' }, turn: 3 });
    s = play(s, ['a2a3', 'a8b8']);
    expect(s.lastCrawl?.eats).toEqual([{ by: 'b', square: 'e4', piece: 'n' }]);
    expect(s.phase).toBe('white');
    expect(checkedKing(s)).toBe('e1');
    expect(whiteMoves(s).every((m) => m.piece === 'k')).toBe(true);
  });
});

describe('Sacrifice snails', () => {
  it('start with a pick step: no snails, no moves, and Start needs one of your pieces (not the king)', () => {
    const s = newGame('sacrifice');
    expect(s.phase).toBe('setup');
    expect(s.snails).toBeNull();
    expect(whiteMoves(s)).toEqual([]);
    expect(() => applyWhiteMove(s, parseUci('e2e4'))).toThrow(IllegalMoveError);
    expect(canSacrifice(s, null)).toBe(false);
    expect(canSacrifice(s, 'e1')).toBe(false); // your king
    expect(canSacrifice(s, 'e7')).toBe(false); // theirs
    expect(canSacrifice(s, 'e4')).toBe(false); // empty
    expect(canSacrifice(s, 'b1')).toBe(true);
    expect(() => startSacrifice(s, 'e1')).toThrow(IllegalMoveError);
    expect(() => startSacrifice(s, 'd8')).toThrow(IllegalMoveError);
  });

  it('remove your piece and the mirrored one, and put each snail in its place', () => {
    const s = startSacrifice(newGame('sacrifice'), 'b1');
    expect(s.phase).toBe('white');
    expect(s.sacrifice).toBe('b1');
    expect(pieceAt(s, 'b1')).toBeNull();
    expect(pieceAt(s, 'b8')).toBeNull();
    expect(s.snails).toEqual({ w: 'b1', b: 'b8' });
    expect(castling(s)).toBe('KQkq');
    expect(s.fen).toBe('r1bqkbnr/pppppppp/8/8/8/8/PPPPPPPP/R1BQKBNR w KQkq - 0 1');

    const pawn = startSacrifice(newGame('sacrifice'), 'e2');
    expect(pawn.snails).toEqual({ w: 'e2', b: 'e7' });
    expect(pieceAt(pawn, 'e2')).toBeNull();
    expect(pieceAt(pawn, 'e7')).toBeNull();
    expect(snailDistances(pawn)).toEqual({ w: 6, b: 6 });
  });

  it('drop castling with a given-up rook on both sides', () => {
    expect(castling(startSacrifice(newGame('sacrifice'), 'h1'))).toBe('Qq');
    expect(castling(startSacrifice(newGame('sacrifice'), 'a1'))).toBe('Kk');
  });

  it('then play like Ghost snails, crawling after turn 3', () => {
    let s = startSacrifice(newGame('sacrifice'), 'd1');
    s = play(s, ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6']);
    expect(s.lastCrawl?.to).toEqual({ w: 'e2', b: 'e7' });
    expect(s.lastCrawl?.eats).toEqual([]);
  });
});

describe('results', () => {
  it('wins by checkmating the computer', () => {
    let s = newGame('ghost', { fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1' });
    s = applyWhiteMove(s, { from: 'a1', to: 'a8' });
    expect(s.result).toMatchObject({ outcome: 'win', cause: 'checkmate', title: 'You win!', reason: 'Checkmate.' });
    expect(focalKing(s)).toBe('g8');
  });

  it('draws when the player stalemates the computer', () => {
    let s = newGame('ghost', { fen: 'k7/8/8/1Q6/8/8/8/K7 w - - 0 1', snails: { w: 'h1', b: 'h8' } });
    s = applyWhiteMove(s, { from: 'b5', to: 'b6' });
    expect(s.result).toMatchObject({ outcome: 'draw', cause: 'stalemate', reason: 'The computer can’t move, but it isn’t in check (stalemate).' });
  });

  it('draws on insufficient material', () => {
    let s = newGame('ghost', { fen: '4k3/8/8/8/8/8/3n4/4KB2 w - - 0 1' });
    s = applyWhiteMove(s, { from: 'e1', to: 'd2' });
    expect(s.result).toMatchObject({ outcome: 'draw', cause: 'insufficient' });
  });

  it('draws when the computer stalemates the player (not a snail loss)', () => {
    let s = newGame('ghost', { fen: 'k7/8/8/8/8/8/2q5/K7 b - - 0 1', snails: { w: 'h1', b: 'h8' } });
    s = applyBlackMove(s, { from: 'c2', to: 'b3' });
    expect(s.result).toMatchObject({ outcome: 'draw', cause: 'stalemate', reason: 'You can’t move, but you aren’t in check (stalemate).' });
  });

  it('auto-queens the player’s promotions', () => {
    const s = newGame('ghost', { fen: '8/P6k/8/8/8/8/8/K7 w - - 0 1' });
    const promos = whiteMoves(s).filter((m) => m.from === 'a7');
    expect(promos).toHaveLength(1);
    expect(promos[0].promotion).toBe('q');
    const after = applyWhiteMove(s, { from: 'a7', to: 'a8', promotion: 'n' });
    expect(pieceAt(after, 'a8')).toEqual({ type: 'q', color: 'w' });
    expect(after.history.at(-1)).toBe('a7a8q');
  });

  it('rejects moves out of turn', () => {
    const s = newGame('ghost');
    expect(() => applyBlackMove(s, { from: 'e7', to: 'e5' })).toThrow(IllegalMoveError);
    expect(() => crawlSnails(s)).toThrow(IllegalMoveError);
  });
});

describe('what the UI shows', () => {
  it('describes the computer’s last move in words', () => {
    let s = play(newGame('ghost'), ['e2e4']);
    expect(describeComputerMove(s)).toBeNull();
    s = play(s, ['g8f6']);
    expect(describeComputerMove(s)).toBe('Computer played knight g8 to f6.');
    s = play(s, ['e4e5', 'd7d5', 'e5f6', 'e7f6']);
    expect(describeComputerMove(s)).toBe('Computer played pawn e7 to f6, taking your pawn.');
    const castle = newGame('ghost', { fen: 'r3k2r/8/8/8/8/8/8/4K3 b kq - 0 1' });
    expect(describeComputerMove(applyBlackMove(castle, { from: 'e8', to: 'g8' }))).toBe('Computer played king e8 to g8, castling.');
  });
});

describe('save and resume', () => {
  /** A real game: the player plays seeded random moves, the computer answers like in the app. */
  function sampleGame(mode: (typeof MODES)[number], plies: number, seed: number): GameState {
    let s = newGame(mode);
    let r = seed;
    const rand = () => (r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    if (s.phase === 'setup') {
      const picks = (['a1', 'b1', 'c1', 'd1', 'f1', 'g1', 'h1', 'a2', 'd2', 'e2', 'h2'] as Square[]);
      s = startSacrifice(s, picks[Math.floor(rand() * picks.length)]);
    }
    for (let i = 0; i < plies && s.phase !== 'over'; i++) {
      if (s.phase === 'white') {
        const ms = whiteMoves(s);
        s = applyWhiteMove(s, ms[Math.floor(rand() * ms.length)]);
      } else if (s.phase === 'black') {
        const ai = chooseMove({ fen: s.fen, depth: 1, seed: i, snails: s.snails!, mode: s.mode, crawlIn: turnsUntilCrawl(s.turn) });
        s = applyBlackReply(s, ai);
      }
    }
    return s;
  }

  const roundTrip = (s: GameState) => restoreGame(serializeGame(s));

  it('round-trips games in progress in every mode', () => {
    for (const mode of MODES) {
      for (const seed of [3, 7, 11]) {
        const s = sampleGame(mode, 40, seed);
        const restored = roundTrip(s);
        expect(restored, `${mode} ${seed}`).not.toBeNull();
        expect({ ...restored! }).toEqual({ ...s });
        expect(whiteMoves(restored!)).toEqual(whiteMoves(s));
      }
    }
  });

  it('round-trips a Hungry game after an eat, and the Sacrifice pick step', () => {
    let s = newGame('hungry', { fen: '4k3/8/8/3n4/8/8/P2n4/4K3 w - - 0 1', snails: { w: 'c4', b: 'c3' }, turn: 3 });
    s = play(s, ['a2a3', 'e8d8', 'a3a4']);
    expect({ ...roundTrip(s)! }).toEqual({ ...s });

    const pick = newGame('sacrifice');
    expect(toSaved(pick)).toEqual({ v: 3, mode: 'sacrifice', moves: [], turn: 1 });
    expect({ ...roundTrip(pick)! }).toEqual({ ...pick });
  });

  it('round-trips while waiting for the computer and between reply and crawl', () => {
    let s = play(newGame('hungry'), ['e2e4', 'e7e5', 'd2d4', 'd7d5', 'g1f3']);
    expect(s.phase).toBe('black');
    expect({ ...roundTrip(s)! }).toEqual({ ...s });
    s = applyBlackMove(s, { from: 'b8', to: 'c6' });
    expect(s.phase).toBe('crawl');
    expect({ ...roundTrip(s)! }).toEqual({ ...s });
    const crawled = crawlSnails(s);
    expect({ ...roundTrip(crawled)! }).toEqual({ ...crawled });
  });

  it('round-trips finished games, including snail strikes', () => {
    const fen = '4k3/p7/8/8/8/8/P7/4K3 w - - 0 1';
    for (const snails of [{ w: 'e7', b: 'a8' }, { w: 'h1', b: 'e2' }, { w: 'e7', b: 'e2' }] as const) {
      const s = play(newGame('ghost', { fen, snails, turn: 3 }), ['a2a3', 'a7a6']);
      expect(s.phase).toBe('over');
      expect({ ...roundTrip(s)! }).toEqual({ ...s });
    }
  });

  it('returns null for missing, corrupt, old or inconsistent data', () => {
    const good = toSaved(play(newGame('ghost'), ['e2e4', 'e7e5']));
    const sac = toSaved(startSacrifice(newGame('sacrifice'), 'b1'));
    const bad = (x: unknown) => restoreGame(JSON.stringify(x));
    expect(restoreGame(null)).toBeNull();
    expect(restoreGame('')).toBeNull();
    expect(restoreGame('{not json')).toBeNull();
    expect(restoreGame('null')).toBeNull();
    // The one-snail version's save.
    expect(bad({ v: 2, moves: ['e2e4', 'e7e5'], snail: 'a8', turn: 2 })).toBeNull();
    expect(bad({ ...good, v: 2 })).toBeNull();
    expect(bad({ ...good, mode: 'turbo' })).toBeNull();
    expect(bad({ ...good, moves: ['e2e5'] })).toBeNull();
    expect(bad({ ...good, moves: 'e2e4' })).toBeNull();
    expect(bad({ ...good, snails: { w: 'z9', b: 'a8' } })).toBeNull();
    expect(bad({ ...good, snails: { w: 'h1', b: 'c3' } })).toBeNull();
    expect(bad({ ...good, turn: 7 })).toBeNull();
    expect(bad({ ...good, setup: { fen: 'garbage' } })).toBeNull();
    expect(bad({ ...good, sacrifice: 'b1' })).toBeNull(); // not a Sacrifice game
    expect(bad({ ...sac, sacrifice: 'e1' })).toBeNull(); // can't give up the king
    expect(bad({ v: 3, mode: 'sacrifice', moves: ['e2e4'], turn: 1 })).toBeNull(); // moves before a pick
    expect(bad(good)).not.toBeNull();
    expect(bad(sac)).not.toBeNull();
  });
});
