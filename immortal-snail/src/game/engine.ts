/**
 * Pure game state for Immortal Snail Chess.
 *
 * A turn = one White (player) move followed by Black's (computer) reply. After the reply on
 * every third turn both snails crawl one square, at the same time, toward the enemy king: yours
 * (White's) hunts the black king, theirs (Black's) hunts yours (see snail.ts). The snails are
 * not part of the chess.js position: they are overlay squares tracked here.
 *
 * Phases:
 *   setup (Sacrifice only: pick a piece to give up) -> white
 *   white -> (player moves) -> black -> (computer replies) -> crawl? -> white ...
 *   any of them -> over
 *
 * Modes differ only in what a snail does to the pieces it crawls onto: Ghost and Sacrifice
 * snails slide over them, Hungry snails eat enemy pieces (never kings). Sacrifice games start
 * with one piece of each side swapped for that side's snail.
 *
 * States are immutable. Each one owns a chess.js instance in a private WeakMap cache so
 * transitions don't have to replay the whole game; a state without a cached instance replays
 * its moves from its base position.
 */
import { Chess, validateFen, type Color, type PieceSymbol, type Square } from 'chess.js';
import { FastBoard, sqFrom0x88 } from '../chess/fast';
import { isMode, type Mode } from './settings';
import {
  SNAIL_STARTS,
  chebyshev,
  fileOf,
  isSquare,
  mirrorSquare,
  nextSnailSteps,
  otherColor,
  snailsCrawlAfterTurn,
  type Snails,
} from './snail';

export type Phase = 'setup' | 'white' | 'black' | 'crawl' | 'over';
export type Outcome = 'win' | 'loss' | 'draw';
export type Cause =
  | 'checkmate'
  | 'checkmated'
  | 'snail-win'
  | 'snail-loss'
  | 'snail-draw'
  | 'trapped-win'
  | 'trapped-loss'
  | 'open'
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

/** A piece a Hungry snail ate. `by` is the snail's owner; the piece belonged to the other side. */
export interface Eat {
  by: Color;
  square: Square;
  piece: PieceSymbol;
}

/** One crawl of both snails, after the computer's reply in `turn`. */
export interface Crawl {
  turn: number;
  from: Snails;
  to: Snails;
  eats: Eat[];
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
  /** Starting snail squares (Ghost and Hungry). Default: yours h1, theirs a8. */
  snails?: Partial<Snails>;
  /** Starting turn number. Defaults to 1. */
  turn?: number;
}

export interface GameState {
  readonly mode: Mode;
  /** Custom starting point, or null for a standard game. */
  readonly setup: GameSetup | null;
  /** Sacrifice games: the square of the piece you gave up. Null until Start, and in the other modes. */
  readonly sacrifice: Square | null;
  /**
   * Where the chess.js position last (re)started: its FEN and how many moves of `history` came
   * before it. It restarts whenever pieces leave the board outside a move (a sacrifice, a snail
   * eating), so repetition counting starts fresh: earlier positions can never come back.
   */
  readonly base: { readonly fen: string; readonly ply: number };
  /** Every half-move so far in UCI form (e2e4, e7e8q), both colours. */
  readonly history: readonly string[];
  readonly fen: string;
  /** Both snails. Null only while picking a piece to give up (Sacrifice). */
  readonly snails: Snails | null;
  /** The turn being played (1-based). Incremented once the turn (and any crawl) is done. */
  readonly turn: number;
  readonly phase: Phase;
  readonly result: GameResult | null;
  readonly lastMove: LastMove | null;
  /** The most recent crawl, if any. */
  readonly lastCrawl: Crawl | null;
}

export class IllegalMoveError extends Error {}

// ---------------------------------------------------------------------------
// chess.js instance cache

const chessCache = new WeakMap<GameState, Chess>();

function replay(state: GameState): Chess {
  const chess = new Chess(state.base.fen);
  for (const uci of state.history.slice(state.base.ply)) chess.move(parseUci(uci));
  return chess;
}

/** A chess.js instance for this state. Do not mutate it. */
function chessOf(state: GameState): Chess {
  let c = chessCache.get(state);
  if (!c) {
    c = replay(state);
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
  checkmate: { outcome: 'win', cause: 'checkmate', title: 'You win!', reason: 'Checkmate.' },
  checkmated: { outcome: 'loss', cause: 'checkmated', title: 'Checkmate — you lose', reason: 'The computer checkmated your king.' },
  'snail-win': { outcome: 'win', cause: 'snail-win', title: 'You win!', reason: 'Your snail got their king.' },
  'snail-loss': { outcome: 'loss', cause: 'snail-loss', title: 'The snail got you!', reason: 'Their snail touched your king.' },
  'snail-draw': { outcome: 'draw', cause: 'snail-draw', title: 'Draw', reason: 'Both snails struck at once.' },
  'trapped-win': { outcome: 'win', cause: 'trapped-win', title: 'You win!', reason: 'Your snail trapped their king.' },
  'trapped-loss': {
    outcome: 'loss',
    cause: 'trapped-loss',
    title: 'The snail trapped your king',
    reason: 'Your only moves were onto their snail.',
  },
  open: { outcome: 'win', cause: 'open', title: 'You win!', reason: 'Their king was left open.' },
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

/** Snail strikes: the game ends the moment a snail lands on a king. */
export const SNAIL_STRIKES: readonly Cause[] = ['snail-win', 'snail-loss', 'snail-draw'];

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

const movesCache = new WeakMap<GameState, LegalMove[]>();

/**
 * The legal moves of the side to move: chess.js moves minus any king step (or castling) onto
 * the enemy snail. The player's promotions are queen-only.
 */
function sideMoves(state: GameState): LegalMove[] {
  let ms = movesCache.get(state);
  if (!ms) {
    const color: Color = state.phase === 'white' ? 'w' : 'b';
    const enemySnail = state.snails?.[otherColor(color)];
    ms = rawLegal(chessOf(state)).filter(
      (m) => !(m.piece === 'k' && m.to === enemySnail) && (color === 'b' || !m.promotion || m.promotion === 'q'),
    );
    movesCache.set(state, ms);
  }
  return ms;
}

/** The player's legal moves (empty unless it is White's turn). */
export function whiteMoves(state: GameState): LegalMove[] {
  return state.phase === 'white' ? sideMoves(state) : [];
}

/** The computer's legal moves (empty unless it is Black's turn). */
export function blackMoves(state: GameState): LegalMove[] {
  return state.phase === 'black' ? sideMoves(state) : [];
}

export function kingSquare(state: GameState, color: Color): Square {
  return sqFrom0x88(new FastBoard(chessOf(state)).kingSquare(color));
}

function kings(state: GameState): Record<Color, Square> {
  return { w: kingSquare(state, 'w'), b: kingSquare(state, 'b') };
}

/** The king currently in check (side to move), if any. */
export function checkedKing(state: GameState): Square | null {
  const chess = chessOf(state);
  return chess.inCheck() ? kingSquare(state, chess.turn()) : null;
}

export function pieceAt(state: GameState, sq: Square): { type: PieceSymbol; color: Color } | null {
  return chessOf(state).get(sq) ?? null;
}

/** How far each snail is from the king it hunts (null while picking a sacrifice). */
export function snailDistances(state: GameState): Record<Color, number> | null {
  if (!state.snails) return null;
  const k = kings(state);
  return { w: chebyshev(state.snails.w, k.b), b: chebyshev(state.snails.b, k.w) };
}

/** Where both snails would crawl if they moved now (null while picking a sacrifice). */
export function snailPreview(state: GameState): Snails | null {
  return state.snails && nextSnailSteps(state.snails, kings(state));
}

/**
 * The king the result is about: the black king when you win, otherwise your own king.
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

/** The crawl at the end of the previous turn: its news (what the snails ate) shows for one turn. */
export function previousCrawl(state: GameState): Crawl | null {
  const c = state.lastCrawl;
  return c && c.turn === state.turn - 1 ? c : null;
}

export function eatMessage(eat: Eat): string {
  const name = PIECE_NAMES[eat.piece];
  return eat.by === 'w' ? `Your snail ate their ${name}!` : `Their snail ate your ${name}!`;
}

// ---------------------------------------------------------------------------
// transitions

/** Drop undefined fields so a setup survives a JSON round trip unchanged. */
function cleanSetup(setup: GameSetup | null): GameSetup | null {
  if (!setup) return null;
  const out: GameSetup = {};
  if (setup.fen !== undefined) out.fen = setup.fen;
  if (setup.turn !== undefined) out.turn = setup.turn;
  if (setup.snails) {
    const snails: Partial<Snails> = {};
    if (setup.snails.w !== undefined) (snails as { w?: Square }).w = setup.snails.w;
    if (setup.snails.b !== undefined) (snails as { b?: Square }).b = setup.snails.b;
    if (Object.keys(snails).length) out.snails = snails;
  }
  return Object.keys(out).length ? out : null;
}

const phaseFor = (chess: Chess): Phase => (chess.turn() === 'w' ? 'white' : 'black');

/**
 * Ends the game if the side to move is already beaten: chess rules first (mate, stalemate,
 * draws), then a snail sitting on a king (custom setups only), then a king trapped by the
 * king-onto-snail filter (chess.js has moves for it, but every one steps onto the enemy snail).
 */
function settle(state: GameState): GameState {
  const verdict = chessVerdict(chessOf(state));
  if (verdict) return derive(state, { phase: 'over', result: verdict });
  if (state.snails) {
    const k = kings(state);
    const yours = state.snails.w === k.b;
    const theirs = state.snails.b === k.w;
    if (yours || theirs) return derive(state, { phase: 'over', result: strike(yours, theirs) });
  }
  if (sideMoves(state).length === 0) {
    return derive(state, { phase: 'over', result: RESULTS[state.phase === 'white' ? 'trapped-loss' : 'trapped-win'] });
  }
  return state;
}

function strike(yours: boolean, theirs: boolean): GameResult {
  return RESULTS[yours && theirs ? 'snail-draw' : yours ? 'snail-win' : 'snail-loss'];
}

/**
 * A new game. Sacrifice games start in the 'setup' phase (pick a piece, then startSacrifice);
 * the others start with the snails on h1 (yours) and a8 (theirs).
 */
export function newGame(mode: Mode = 'ghost', setup: GameSetup | null = null): GameState {
  const custom = cleanSetup(setup);
  const chess = custom?.fen ? new Chess(custom.fen) : new Chess();
  const fen = chess.fen();
  const state: GameState = {
    mode,
    setup: custom,
    sacrifice: null,
    base: { fen, ply: 0 },
    history: [],
    fen,
    snails: mode === 'sacrifice' ? null : { ...SNAIL_STARTS, ...custom?.snails },
    turn: custom?.turn ?? 1,
    phase: mode === 'sacrifice' ? 'setup' : phaseFor(chess),
    result: null,
    lastMove: null,
    lastCrawl: null,
  };
  chessCache.set(state, chess);
  // A custom position might already be decided.
  return custom && mode !== 'sacrifice' ? settle(state) : state;
}

/** Sacrifice setup: can the piece on `sq` be given up? (One of your pieces, never the king.) */
export function canSacrifice(state: GameState, sq: Square | null): sq is Square {
  if (state.phase !== 'setup' || !sq) return false;
  const piece = pieceAt(state, sq);
  return piece?.color === 'w' && piece.type !== 'k';
}

/**
 * Start a Sacrifice game: your piece on `sq` leaves the board and your snail starts on its
 * square; the computer gives up the mirrored piece (same file, other side, same type) and its
 * snail starts there. Castling rights with a given-up rook go too. Throws IllegalMoveError.
 */
export function startSacrifice(state: GameState, sq: Square): GameState {
  if (!canSacrifice(state, sq)) throw new IllegalMoveError(`Can’t give up ${sq}`);
  const chess = takeChess(state);
  const type = chess.get(sq)!.type;
  const mirror = mirrorSquare(sq);
  chess.remove(sq);
  const mirrored = chess.get(mirror);
  if (mirrored?.color === 'b' && mirrored.type === type) chess.remove(mirror);
  const fresh = new Chess(chess.fen());
  const fen = fresh.fen();
  return settle(
    derive(
      state,
      { sacrifice: sq, base: { fen, ply: 0 }, fen, snails: { w: sq, b: mirror }, phase: phaseFor(fresh) },
      fresh,
    ),
  );
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
  return settle(
    derive(
      state,
      { history: [...state.history, toUci(move)], fen: chess.fen(), phase: 'black', lastMove: lastMoveOf(move, 'w') },
      chess,
    ),
  );
}

/** Start White's next turn: bump the counter and check whether the player is beaten. */
function startNextTurn(state: GameState): GameState {
  return settle(derive(state, { turn: state.turn + 1, phase: 'white' }));
}

/**
 * The computer's reply. If it ends the game the snails stay put. Otherwise the phase becomes
 * 'crawl' when the snails are due this turn, or the next White turn starts.
 */
export function applyBlackMove(state: GameState, input: MoveInput): GameState {
  if (state.phase !== 'black') throw new IllegalMoveError('Not the computer’s turn');
  const move = findMove(blackMoves(state), input, false);
  if (!move) throw new IllegalMoveError(`Illegal move ${input.from}${input.to}`);
  const chess = takeChess(state);
  chess.move({ from: move.from, to: move.to, promotion: move.promotion });
  const next = derive(
    state,
    { history: [...state.history, toUci(move)], fen: chess.fen(), phase: 'crawl', lastMove: lastMoveOf(move, 'b') },
    chess,
  );
  const verdict = chessVerdict(chess);
  if (verdict) return derive(next, { phase: 'over', result: verdict });
  return snailsCrawlAfterTurn(state.turn) ? next : startNextTurn(next);
}

/**
 * After a Hungry eat: `ep` (the en-passant square from before it) still applies only if the pawn
 * that just double-stepped is still there and an enemy pawn still stands right next to it.
 */
function enPassantKept(chess: Chess, ep: string): string {
  if (!isSquare(ep)) return '-';
  const file = ep.charCodeAt(0);
  const rank = ep[1] === '6' ? '5' : '4'; // the double-stepped pawn's rank
  const mover: Color = ep[1] === '6' ? 'b' : 'w';
  const pawnAt = (f: number, color: Color) => {
    if (f < 97 || f > 104) return false;
    const p = chess.get(`${String.fromCharCode(f)}${rank}` as Square);
    return p?.type === 'p' && p.color === color;
  };
  const taker: Color = mover === 'w' ? 'b' : 'w';
  return pawnAt(file, mover) && (pawnAt(file - 1, taker) || pawnAt(file + 1, taker)) ? ep : '-';
}

/**
 * Both snails crawl one square toward the enemy king, at the same time (both destinations come
 * from where everything is now). In Hungry games a snail that lands on an enemy piece other than
 * the king eats it. A snail landing on the enemy king ends the game.
 */
export function crawlSnails(state: GameState): GameState {
  if (state.phase !== 'crawl' || !state.snails) throw new IllegalMoveError('The snails are not due');
  const k = kings(state);
  const from = state.snails;
  const to = nextSnailSteps(from, k);
  let chess = takeChess(state);
  // The raw en-passant square (even one whose capture is pinned), read before anything is eaten.
  const ep = chess.fen({ forceEnpassantSquare: true }).split(' ')[3];
  const eats: Eat[] = [];
  if (state.mode === 'hungry') {
    for (const by of ['w', 'b'] as const) {
      const piece = chess.get(to[by]);
      if (piece && piece.color !== by && piece.type !== 'k') {
        // remove() drops castling rights for an eaten rook. It also always clears the
        // en-passant square (a chess.js quirk), so that is put back below if it still applies.
        chess.remove(to[by]);
        eats.push({ by, square: to[by], piece: piece.type });
      }
    }
  }
  let base = state.base;
  if (eats.length) {
    // Restart chess.js from here. Eating counts as a capture for the 50-move rule.
    const fields = chess.fen().split(' ');
    fields[3] = enPassantKept(chess, ep);
    fields[4] = '0';
    // chess.js leaves the en-passant square out of fen() again if that capture is not legal.
    chess = new Chess(fields.join(' '));
    base = { fen: chess.fen(), ply: state.history.length };
  }
  const next = derive(state, { snails: to, fen: chess.fen(), base, lastCrawl: { turn: state.turn, from, to, eats } }, chess);
  const yours = to.w === k.b;
  const theirs = to.b === k.w;
  if (yours || theirs) return derive(next, { phase: 'over', result: strike(yours, theirs) });
  // A snail ate the piece shielding the black king and it is your move: you could take the king.
  if (eats.length && chess.isAttacked(k.b, 'w')) return derive(next, { phase: 'over', result: RESULTS.open });
  return startNextTurn(next);
}

/** Black's reply followed by the crawl, if due (handy for tests and simulations). */
export function applyBlackReply(state: GameState, input: MoveInput): GameState {
  const s = applyBlackMove(state, input);
  return s.phase === 'crawl' ? crawlSnails(s) : s;
}

// ---------------------------------------------------------------------------
// save / restore

export interface SavedGame {
  v: 3;
  mode: Mode;
  setup?: GameSetup;
  sacrifice?: Square;
  moves: string[];
  /** Consistency checks: replaying the moves must land on the same turn and snail squares. */
  turn: number;
  snails?: Snails;
}

export function toSaved(state: GameState): SavedGame {
  const saved: SavedGame = { v: 3, mode: state.mode, moves: [...state.history], turn: state.turn };
  if (state.setup) saved.setup = cleanSetup(state.setup)!;
  if (state.sacrifice) saved.sacrifice = state.sacrifice;
  if (state.snails) saved.snails = { ...state.snails };
  return saved;
}

export function serializeGame(state: GameState): string {
  return JSON.stringify(toSaved(state));
}

const UCI_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const isTurn = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 1;
const sameSnails = (a: Snails | null | undefined, b: Snails | null | undefined) =>
  a && b ? a.w === b.w && a.b === b.b : !a && !b;

/**
 * Rebuild a game from saved data by replaying it through the real transitions (snail paths and
 * Hungry eats are deterministic), then check the saved turn and snail squares agree. Anything
 * missing, corrupt, old or inconsistent → null.
 */
export function restoreGame(raw: string | null | undefined): GameState | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<SavedGame> | null;
    if (!data || typeof data !== 'object' || data.v !== 3 || !isMode(data.mode) || !isTurn(data.turn)) return null;
    if (!Array.isArray(data.moves) || !data.moves.every((m) => typeof m === 'string' && UCI_RE.test(m))) return null;
    if (data.sacrifice !== undefined && (data.mode !== 'sacrifice' || !isSquare(data.sacrifice))) return null;
    if (data.snails !== undefined && !(isSquare(data.snails?.w) && isSquare(data.snails?.b))) return null;
    let setup: GameSetup | null = null;
    if (data.setup !== undefined) {
      if (!data.setup || typeof data.setup !== 'object') return null;
      const { fen, snails, turn } = data.setup;
      if (fen !== undefined && (typeof fen !== 'string' || !validateFen(fen).ok)) return null;
      if (turn !== undefined && !isTurn(turn)) return null;
      if (snails !== undefined && (typeof snails !== 'object' || !snails)) return null;
      if (snails && [snails.w, snails.b].some((sq) => sq !== undefined && !isSquare(sq))) return null;
      setup = { fen, snails, turn };
    }

    let s = newGame(data.mode, setup);
    if (data.sacrifice) s = startSacrifice(s, data.sacrifice);
    for (const uci of data.moves) {
      if (s.phase === 'crawl') s = crawlSnails(s);
      if (s.phase === 'white') s = applyWhiteMove(s, parseUci(uci));
      else if (s.phase === 'black') s = applyBlackMove(s, parseUci(uci));
      else return null; // moves before a sacrifice was picked, or after the game ended
    }
    // Saved after the computer's reply: the snails may or may not have crawled yet. A crawl
    // always moves both, so the saved squares tell us which.
    if (s.phase === 'crawl' && !sameSnails(s.snails, data.snails)) s = crawlSnails(s);
    if (!sameSnails(s.snails, data.snails) || s.turn !== data.turn) return null;
    return s;
  } catch {
    return null;
  }
}
