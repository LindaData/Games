/**
 * Pure game state for Immortal Snail Chess.
 *
 * A turn = one White (player) move followed by Black's (computer) reply. After Black's reply
 * the snail may crawl one square toward the white king (see snail.ts). The snail is not part
 * of the chess.js position: it is an overlay square tracked here.
 *
 * Phases:
 *   white -> (player moves) -> black -> (computer replies) -> snail? -> white ...
 *   any of them -> over
 *
 * States are immutable. Each one owns a chess.js instance in a private WeakMap cache so
 * transitions don't have to replay the whole game; a state without a cached instance just
 * replays its move list.
 */
import { Chess, validateFen, type Color, type PieceSymbol, type Square } from 'chess.js';
import { FastBoard, sqFrom0x88 } from '../chess/fast';
import { SNAIL_START, chebyshev, fileOf, isSquare, nextSnailStep, snailMovesAfterTurn } from './snail';

export type Phase = 'white' | 'black' | 'snail' | 'over';
export type Outcome = 'win' | 'loss' | 'draw';
export type Cause =
  | 'checkmate'
  | 'checkmated'
  | 'snail'
  | 'cornered'
  | 'stalemate'
  | 'threefold'
  | 'fifty-move'
  | 'insufficient';

export interface GameResult {
  outcome: Outcome;
  cause: Cause;
  title: string;
  reason: string;
}

export interface MoveInput {
  from: Square;
  to: Square;
  promotion?: string;
}

export interface LegalMove {
  from: Square;
  to: Square;
  piece: PieceSymbol;
  captured?: PieceSymbol;
  promotion?: PieceSymbol;
}

export interface LastMove {
  from: Square;
  to: Square;
  color: Color;
  piece: PieceSymbol;
  captured?: PieceSymbol;
  promotion?: PieceSymbol;
}

export const PIECE_NAMES: Record<PieceSymbol, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
};

/** A non-standard starting point (used by tests; normal games start from the usual position). */
export interface GameSetup {
  /** Starting FEN. Defaults to the standard initial position. */
  fen?: string;
  /** Starting snail square. Defaults to a8. */
  snail?: Square;
}

export interface GameState {
  /** Custom starting point, or null for a standard game. */
  readonly setup: GameSetup | null;
  /** Every half-move so far in UCI form (e2e4, e7e8q), both colours. */
  readonly history: readonly string[];
  readonly fen: string;
  readonly snail: Square;
  /** The turn being played (1-based). Incremented once the turn (and any snail crawl) is done. */
  readonly turn: number;
  readonly phase: Phase;
  readonly result: GameResult | null;
  readonly lastMove: LastMove | null;
  /** The most recent snail crawl, if any. */
  readonly lastSnailStep: { from: Square; to: Square } | null;
}

export class IllegalMoveError extends Error {}

// ---------------------------------------------------------------------------
// chess.js instance cache

const chessCache = new WeakMap<GameState, Chess>();

function replay(setup: GameSetup | null, history: readonly string[]): Chess {
  const chess = setup?.fen ? new Chess(setup.fen) : new Chess();
  for (const uci of history) chess.move(parseUci(uci));
  return chess;
}

/** A chess.js instance for this state. Do not mutate it. */
function chessOf(state: GameState): Chess {
  let c = chessCache.get(state);
  if (!c) {
    c = replay(state.setup, state.history);
    chessCache.set(state, c);
  }
  return c;
}

/** Take ownership of a state's chess.js instance so it can be mutated for the next state. */
function takeChess(state: GameState): Chess {
  const c = chessOf(state);
  chessCache.delete(state);
  return c;
}

/** A new state from `state` + `patch`, handing over (or setting) its chess.js instance. */
function derive(state: GameState, patch: Partial<GameState>, chess?: Chess): GameState {
  const c = chess ?? takeChess(state);
  const next: GameState = { ...state, ...patch };
  chessCache.set(next, c);
  return next;
}

export function parseUci(uci: string): MoveInput {
  return { from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square, promotion: uci[4] || undefined };
}

function toUci(m: { from: string; to: string; promotion?: string }): string {
  return `${m.from}${m.to}${m.promotion ?? ''}`;
}

// ---------------------------------------------------------------------------
// results

const RESULTS: Record<Cause, GameResult> = {
  checkmate: {
    outcome: 'win',
    cause: 'checkmate',
    title: 'You win!',
    reason: 'You beat the computer before the snail got you!',
  },
  checkmated: { outcome: 'loss', cause: 'checkmated', title: 'Checkmate — you lose', reason: 'The computer checkmated your king.' },
  snail: { outcome: 'loss', cause: 'snail', title: 'The snail got you!', reason: 'It touched your king.' },
  cornered: {
    outcome: 'loss',
    cause: 'cornered',
    title: 'The snail trapped your king',
    reason: 'Your only moves were onto the snail.',
  },
  stalemate: {
    outcome: 'draw',
    cause: 'stalemate',
    title: 'Draw',
    reason: 'The computer can’t move, but it isn’t in check (stalemate).',
  },
  threefold: { outcome: 'draw', cause: 'threefold', title: 'Draw', reason: 'The same position came up three times.' },
  'fifty-move': { outcome: 'draw', cause: 'fifty-move', title: 'Draw', reason: '50 moves without a capture or pawn move.' },
  insufficient: { outcome: 'draw', cause: 'insufficient', title: 'Draw', reason: 'Not enough pieces left to checkmate.' },
};

/** RESULTS.stalemate is the computer being stuck; this is the player. */
const PLAYER_STALEMATED: GameResult = { ...RESULTS.stalemate, reason: 'You can’t move, but you aren’t in check (stalemate).' };

/** The chess.js verdict for the side to move, or null if the game goes on. */
function chessVerdict(chess: Chess): GameResult | null {
  if (chess.isCheckmate()) return RESULTS[chess.turn() === 'b' ? 'checkmate' : 'checkmated'];
  if (chess.isStalemate()) return chess.turn() === 'b' ? RESULTS.stalemate : PLAYER_STALEMATED;
  if (chess.isInsufficientMaterial()) return RESULTS.insufficient;
  if (chess.isThreefoldRepetition()) return RESULTS.threefold;
  if (chess.isDrawByFiftyMoves()) return RESULTS['fifty-move'];
  return null;
}

// ---------------------------------------------------------------------------
// queries

function rawLegal(chess: Chess): LegalMove[] {
  return new FastBoard(chess).moves().map((m) => ({
    from: sqFrom0x88(m.from),
    to: sqFrom0x88(m.to),
    piece: m.piece,
    captured: m.captured,
    promotion: m.promotion,
  }));
}

/** Filter out the white king stepping onto the snail; collapse promotions to queen only. */
function filterWhite(moves: LegalMove[], snail: Square): LegalMove[] {
  return moves.filter((m) => !(m.piece === 'k' && m.to === snail) && (!m.promotion || m.promotion === 'q'));
}

const whiteMovesCache = new WeakMap<GameState, LegalMove[]>();

/** The player's legal moves (empty unless it is White's turn). Promotions are queen-only. */
export function whiteMoves(state: GameState): LegalMove[] {
  if (state.phase !== 'white') return [];
  let ms = whiteMovesCache.get(state);
  if (!ms) {
    ms = filterWhite(rawLegal(chessOf(state)), state.snail);
    whiteMovesCache.set(state, ms);
  }
  return ms;
}

/** The computer's legal moves (empty unless it is Black's turn). */
export function blackMoves(state: GameState): LegalMove[] {
  if (state.phase !== 'black') return [];
  return rawLegal(chessOf(state));
}

export function kingSquare(state: GameState, color: Color): Square {
  return sqFrom0x88(new FastBoard(chessOf(state)).kingSquare(color));
}

/** The king currently in check (side to move), if any. */
export function checkedKing(state: GameState): Square | null {
  const chess = chessOf(state);
  return chess.inCheck() ? kingSquare(state, chess.turn()) : null;
}

export function pieceAt(state: GameState, sq: Square): { type: PieceSymbol; color: Color } | null {
  return chessOf(state).get(sq) ?? null;
}

/** Chebyshev distance from the snail to the white king. */
export function snailDistance(state: GameState): number {
  return chebyshev(state.snail, kingSquare(state, 'w'));
}

/** Where the snail would crawl if it moved now. */
export function snailPreview(state: GameState): Square {
  return nextSnailStep(state.snail, kingSquare(state, 'w'));
}

/**
 * The king the result is about: the mated black king when you win, otherwise your own king.
 * The game-over card sits in the other half of the board so this king stays visible.
 */
export function focalKing(state: GameState): Square {
  return kingSquare(state, state.result?.outcome === 'win' ? 'b' : 'w');
}

/** The computer's most recent move in words (for screen readers), or null if White moved last. */
export function describeComputerMove(state: GameState): string | null {
  const m = state.lastMove;
  if (!m || m.color !== 'b') return null;
  let text = `Computer played ${PIECE_NAMES[m.piece]} ${m.from} to ${m.to}`;
  if (m.piece === 'k' && Math.abs(fileOf(m.from) - fileOf(m.to)) === 2) text += ', castling';
  if (m.captured) text += `, taking your ${PIECE_NAMES[m.captured]}`;
  if (m.promotion) text += `, promoting to a ${PIECE_NAMES[m.promotion]}`;
  return `${text}.`;
}

/** True when it is White's move and the snail crawled at the end of the turn just played. */
export function snailJustCrawled(state: GameState): boolean {
  return (
    state.phase === 'white' &&
    state.lastSnailStep !== null &&
    state.turn > 1 &&
    snailMovesAfterTurn(state.turn - 1)
  );
}

// ---------------------------------------------------------------------------
// transitions

export function newGame(setup: GameSetup | null = null): GameState {
  const custom = setup && (setup.fen || setup.snail) ? { ...setup } : null;
  const chess = replay(custom, []);
  const state: GameState = {
    setup: custom,
    history: [],
    fen: chess.fen(),
    snail: custom?.snail ?? SNAIL_START,
    turn: 1,
    phase: chess.turn() === 'w' ? 'white' : 'black',
    result: null,
    lastMove: null,
    lastSnailStep: null,
  };
  chessCache.set(state, chess);
  if (!custom) return state;
  // A custom position might already be finished.
  const verdict = chessVerdict(chess);
  if (verdict) return derive(state, { phase: 'over', result: verdict });
  if (state.phase === 'white' && chess.get(state.snail)?.type === 'k' && chess.get(state.snail)?.color === 'w') {
    return derive(state, { phase: 'over', result: RESULTS.snail });
  }
  if (state.phase === 'white' && whiteMoves(state).length === 0) {
    return derive(state, { phase: 'over', result: RESULTS.cornered });
  }
  return state;
}

function findMove(moves: LegalMove[], input: MoveInput, autoQueen: boolean): LegalMove | undefined {
  return moves.find(
    (m) =>
      m.from === input.from &&
      m.to === input.to &&
      (!m.promotion || m.promotion === (autoQueen ? 'q' : (input.promotion ?? 'q'))),
  );
}

function lastMoveOf(move: LegalMove, color: Color): LastMove {
  const last: LastMove = { from: move.from, to: move.to, color, piece: move.piece };
  if (move.captured) last.captured = move.captured;
  if (move.promotion) last.promotion = move.promotion;
  return last;
}

/** The player's move. Promotions always become a queen. Throws IllegalMoveError. */
export function applyWhiteMove(state: GameState, input: MoveInput): GameState {
  if (state.phase !== 'white') throw new IllegalMoveError('Not your turn');
  const move = findMove(whiteMoves(state), input, true);
  if (!move) throw new IllegalMoveError(`Illegal move ${input.from}${input.to}`);
  const chess = takeChess(state);
  chess.move({ from: move.from, to: move.to, promotion: move.promotion });
  const verdict = chessVerdict(chess);
  return derive(
    state,
    {
      history: [...state.history, toUci(move)],
      fen: chess.fen(),
      phase: verdict ? 'over' : 'black',
      result: verdict,
      lastMove: lastMoveOf(move, 'w'),
    },
    chess,
  );
}

/** Start White's next turn: bump the counter and check whether the snail has cornered the king. */
function startNextTurn(state: GameState): GameState {
  const next = derive(state, { turn: state.turn + 1, phase: 'white' });
  // chess.js said the game goes on, so White has legal moves; if none survive the snail filter
  // the king is cornered.
  if (whiteMoves(next).length === 0) return derive(next, { phase: 'over', result: RESULTS.cornered });
  return next;
}

/**
 * The computer's reply. If it ends the game the snail stays put. Otherwise the phase becomes
 * 'snail' when the snail is due to crawl this turn, or the next White turn starts.
 */
export function applyBlackMove(state: GameState, input: MoveInput): GameState {
  if (state.phase !== 'black') throw new IllegalMoveError('Not the computer’s turn');
  const move = findMove(blackMoves(state), input, false);
  if (!move) throw new IllegalMoveError(`Illegal move ${input.from}${input.to}`);
  const chess = takeChess(state);
  chess.move({ from: move.from, to: move.to, promotion: move.promotion });
  const verdict = chessVerdict(chess);
  const next = derive(
    state,
    {
      history: [...state.history, toUci(move)],
      fen: chess.fen(),
      phase: verdict ? 'over' : 'snail',
      result: verdict,
      lastMove: lastMoveOf(move, 'b'),
    },
    chess,
  );
  if (verdict) return next;
  if (snailMovesAfterTurn(state.turn)) return next;
  return startNextTurn(next);
}

/** The snail crawls one square toward the white king. Touching the king ends the game. */
export function advanceSnail(state: GameState): GameState {
  if (state.phase !== 'snail') throw new IllegalMoveError('The snail is not due');
  const king = kingSquare(state, 'w');
  const to = nextSnailStep(state.snail, king);
  const next = derive(state, { snail: to, lastSnailStep: { from: state.snail, to } });
  if (to === king) return derive(next, { phase: 'over', result: RESULTS.snail });
  return startNextTurn(next);
}

/** Black's reply followed by the snail crawl, if due (handy for tests and simulations). */
export function applyBlackReply(state: GameState, input: MoveInput): GameState {
  const s = applyBlackMove(state, input);
  return s.phase === 'snail' ? advanceSnail(s) : s;
}

// ---------------------------------------------------------------------------
// save / restore

export interface SavedGame {
  v: 2;
  setup?: GameSetup;
  moves: string[];
  snail: Square;
  turn: number;
}

export function toSaved(state: GameState): SavedGame {
  const saved: SavedGame = { v: 2, moves: [...state.history], snail: state.snail, turn: state.turn };
  if (state.setup) saved.setup = { ...state.setup };
  return saved;
}

export function serializeGame(state: GameState): string {
  return JSON.stringify(toSaved(state));
}

const UCI_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

/**
 * Rebuild a game from saved data by replaying it through the real transitions, then check the
 * saved snail square and turn counter agree. Anything missing, corrupt or inconsistent → null.
 */
export function restoreGame(raw: string | null | undefined): GameState | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<SavedGame> | null;
    if (!data || typeof data !== 'object' || data.v !== 2 || !isSquare(data.snail)) return null;
    if (!Array.isArray(data.moves) || !data.moves.every((m) => typeof m === 'string' && UCI_RE.test(m))) return null;
    if (typeof data.turn !== 'number' || !Number.isInteger(data.turn) || data.turn < 1) return null;
    let setup: GameSetup | null = null;
    if (data.setup !== undefined) {
      const { fen, snail } = data.setup ?? {};
      if (!data.setup || typeof data.setup !== 'object') return null;
      if (fen !== undefined && (typeof fen !== 'string' || !validateFen(fen).ok)) return null;
      if (snail !== undefined && !isSquare(snail)) return null;
      setup = { fen, snail };
    }

    let s = newGame(setup);
    for (const uci of data.moves) {
      if (s.phase === 'snail') s = advanceSnail(s);
      if (s.phase === 'white') s = applyWhiteMove(s, parseUci(uci));
      else if (s.phase === 'black') s = applyBlackMove(s, parseUci(uci));
      else return null; // moves after the game ended
    }
    // Saved after Black's reply: the snail may or may not have crawled yet. A crawl always
    // changes its square, so the saved square tells us which.
    if (s.phase === 'snail' && data.snail !== s.snail) s = advanceSnail(s);
    if (s.snail !== data.snail || s.turn !== data.turn) return null;
    return s;
  } catch {
    return null;
  }
}
