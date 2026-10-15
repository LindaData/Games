/**
 * The computer opponent: negamax with alpha-beta pruning over chess.js moves.
 *
 * - Evaluation: material + simple piece-square tables (Michniewski's "simplified evaluation").
 * - Move ordering: captures by MVV-LVA first, then promotions and checks.
 * - Checkmate is scored by distance (MATE - ply) so faster mates are preferred.
 * - Optional capture-only quiescence search at the leaves.
 * - Optionally scores every root move exactly and picks randomly within a centipawn window.
 *
 * The snails (when given) shape it with a few cheap rules: a king never steps onto the enemy
 * snail (the game forbids it, so neither side does it anywhere in the tree, and a king with no
 * other move is lost); a snail near a king costs that king's side; and when the snails crawl
 * right after this move, a snail landing on a king decides the game and, in Hungry games, a
 * piece on a snail's next square is as good as gone.
 *
 * It only ever plays moves chess.js generated as legal, minus king steps onto the enemy snail.
 */
import type { Color, PieceSymbol, Square } from 'chess.js';
import { BITS, FastBoard, sqFrom0x88, sqTo0x88, type RawMove } from '../chess/fast';
import type { Mode } from '../game/settings';
import { nextSnailSteps, otherColor, type Snails } from '../game/snail';

export interface AiRequest {
  fen: string;
  depth: number;
  /** > 0: pick randomly among root moves scoring within this many centipawns of the best. */
  randomWindow?: number;
  quiescence?: boolean;
  /** Seed for tie-shuffling and the random pick (randomWindow). */
  seed?: number;
  /** Both snails, keyed by owner (`w` hunts the black king, `b` the white king). Omit for plain chess. */
  snails?: Snails;
  mode?: Mode;
  /** Turns until the snails crawl: 1 = right after this move. */
  crawlIn?: number;
}

export interface AiResult {
  from: Square;
  to: Square;
  promotion?: PieceSymbol;
  /** Score from the mover's point of view, in centipawns (± MATE - plies for mates). */
  score: number;
  depth: number;
  nodes: number;
  ms: number;
}

export const MATE = 100000;
const INF = 1e9;
const Q_MAX_PLIES = 6;

const VALUE: Record<PieceSymbol, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

// Tables are from White's point of view, rank 8 first (index = row * 8 + file, row 0 = rank 8).
// prettier-ignore
const PST: Record<Exclude<PieceSymbol, 'k'>, number[]> = {
  p: [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0,
  ],
  n: [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50,
  ],
  b: [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5, 10, 10,  5,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -20,-10,-10,-10,-10,-10,-10,-20,
  ],
  r: [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0,
  ],
  q: [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5,  5,  5,  5,  0,-10,
     -5,  0,  5,  5,  5,  5,  0, -5,
      0,  0,  5,  5,  5,  5,  0, -5,
    -10,  5,  5,  5,  5,  5,  0,-10,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20,
  ],
};
// prettier-ignore
const KING_MID = [
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -20,-30,-30,-40,-40,-30,-30,-20,
  -10,-20,-20,-20,-20,-20,-20,-10,
   20, 20,  0,  0,  0,  0, 20, 20,
   20, 30, 10,  0,  0, 10, 30, 20,
];
// prettier-ignore
const KING_END = [
  -50,-40,-30,-20,-20,-30,-40,-50,
  -30,-20,-10,  0,  0,-10,-20,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-10, 30, 40, 40, 30,-10,-30,
  -30,-10, 30, 40, 40, 30,-10,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-30,  0,  0,  0,  0,-30,-30,
  -50,-30,-30,-30,-30,-30,-30,-50,
];

/** Total non-pawn material (both sides) at or below which kings use the endgame table. */
const ENDGAME_MATERIAL = 1300;

/** What an enemy snail 0, 1, 2 or 3 king-steps from a king costs that king's side. */
const SNAIL_NEAR = [300, 300, 120, 40];
/** A snail landing on a king in the crawl right after this move: the game is decided. */
const SNAIL_STRIKE = 20000;

/** King-step distance between two 0x88 squares. */
const dist0x88 = (a: number, b: number) => Math.max(Math.abs((a & 15) - (b & 15)), Math.abs((a >> 4) - (b >> 4)));
const snailNear = (d: number) => (d < SNAIL_NEAR.length ? SNAIL_NEAR[d] : 0);

/** Small, fast seeded RNG (mulberry32). */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(xs: T[], rng: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

class Searcher {
  nodes = 0;
  /** Snail squares (0x88) by owner, or null for plain chess. */
  private readonly snails: Record<Color, number> | null;

  constructor(
    private readonly fb: FastBoard,
    private readonly quiescence: boolean,
    snails: Snails | undefined,
  ) {
    this.snails = snails ? { w: sqTo0x88(snails.w), b: sqTo0x88(snails.b) } : null;
  }

  /** Is this the side to move's king stepping onto the enemy snail? */
  private ontoSnail(m: RawMove): boolean {
    return this.snails !== null && m.piece === 'k' && m.to === this.snails[otherColor(m.color)];
  }

  /** Legal moves for the side to move, minus king steps onto the enemy snail. */
  legalMoves(raw: RawMove[] = this.fb.moves()): RawMove[] {
    return this.snails ? raw.filter((m) => !this.ontoSnail(m)) : raw;
  }

  /** Static evaluation from the side to move's point of view. */
  evaluate(): number {
    const board = this.fb.board;
    let score = 0;
    let nonPawn = 0;
    let wk = 0;
    let bk = 0;
    for (let i = 0; i < 120; i++) {
      if (i & 0x88) {
        i += 7;
        continue;
      }
      const p = board[i];
      if (!p) continue;
      const idx = (i >> 4) * 8 + (i & 7);
      if (p.type === 'k') {
        if (p.color === 'w') wk = idx;
        else bk = idx;
        continue;
      }
      if (p.type !== 'p') nonPawn += VALUE[p.type];
      if (p.color === 'w') score += VALUE[p.type] + PST[p.type][idx];
      else score -= VALUE[p.type] + PST[p.type][idx ^ 56];
    }
    const kt = nonPawn <= ENDGAME_MATERIAL ? KING_END : KING_MID;
    score += kt[wk] - kt[bk ^ 56];
    if (this.snails) {
      score += snailNear(dist0x88(this.snails.w, this.fb.kingSquare('b')));
      score -= snailNear(dist0x88(this.snails.b, this.fb.kingSquare('w')));
    }
    return this.fb.turn === 'w' ? score : -score;
  }

  /** Captures (MVV-LVA) first, then promotions, then checks (only when `checks`). */
  order(moves: RawMove[], checks: boolean): RawMove[] {
    const fb = this.fb;
    const them = fb.turn === 'w' ? 'b' : 'w';
    const scored = moves.map((m) => {
      let s = 0;
      if (m.captured) s += 100000 + VALUE[m.captured] * 10 - VALUE[m.piece];
      if (m.promotion) s += 50000 + VALUE[m.promotion];
      if (checks && !s) {
        fb.make(m);
        if (fb.kingAttacked(them)) s += 20000;
        fb.undo();
      }
      return { m, s };
    });
    scored.sort((a, b) => b.s - a.s);
    return scored.map((x) => x.m);
  }

  negamax(depth: number, alpha: number, beta: number, ply: number): number {
    this.nodes++;
    const fb = this.fb;
    const inCheck = fb.inCheck();
    if (depth <= 0 && !inCheck) return this.quiescence ? this.quiesce(alpha, beta, 0) : this.evaluate();
    const raw = fb.moves();
    const moves = this.legalMoves(raw);
    // No moves: checkmate, stalemate, or a king trapped by the enemy snail (a loss).
    if (moves.length === 0) return inCheck || raw.length > 0 ? -(MATE - ply) : 0;
    if (depth <= 0) return this.evaluate(); // in check at the horizon, but not mated
    let best = -INF;
    for (const m of this.order(moves, depth >= 2)) {
      fb.make(m);
      const s = -this.negamax(depth - 1, -beta, -alpha, ply + 1);
      fb.undo();
      if (s > best) best = s;
      if (s > alpha) alpha = s;
      if (alpha >= beta) break;
    }
    return best;
  }

  /** Capture-only search so the horizon doesn't hide an obvious recapture. */
  quiesce(alpha: number, beta: number, qply: number): number {
    this.nodes++;
    const stand = this.evaluate();
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    if (qply >= Q_MAX_PLIES) return stand;
    const fb = this.fb;
    const us = fb.turn;
    const captures = fb
      .pseudoMoves()
      .filter((m) => (m.captured || m.promotion === 'q') && !this.ontoSnail(m))
      .map((m) => ({ m, s: (m.captured ? VALUE[m.captured] * 10 - VALUE[m.piece] : 0) + (m.promotion ? 8000 : 0) }))
      .sort((a, b) => b.s - a.s);
    for (const { m } of captures) {
      // Delta pruning: even winning this piece cleanly can't lift us to alpha.
      const gain = (m.captured ? VALUE[m.captured] : 0) + (m.promotion ? VALUE.q - VALUE.p : 0);
      if (stand + gain + 200 < alpha) continue;
      fb.make(m);
      if (fb.kingAttacked(us)) {
        fb.undo();
        continue;
      }
      const s = -this.quiesce(-beta, -alpha, qply + 1);
      fb.undo();
      if (s >= beta) return s;
      if (s > alpha) alpha = s;
    }
    return alpha;
  }
}

function toResult(m: RawMove, score: number, depth: number, nodes: number, start: number): AiResult {
  const r: AiResult = { from: sqFrom0x88(m.from), to: sqFrom0x88(m.to), score, depth, nodes, ms: Math.round(now() - start) };
  if (m.flags & BITS.PROMOTION && m.promotion) r.promotion = m.promotion;
  return r;
}

/**
 * The crawl right after a root move, from the mover's point of view: a snail landing on a king
 * decides the game, and in Hungry games a piece on an enemy snail's next square gets eaten.
 * Call it with the root move made.
 */
function crawlTerm(fb: FastBoard, snails: Snails, mode: Mode | undefined): number {
  const them = fb.turn; // the root move is made: the opponent is to move
  const us = otherColor(them);
  const kings = { w: sqFrom0x88(fb.kingSquare('w')), b: sqFrom0x88(fb.kingSquare('b')) };
  const next = nextSnailSteps(snails, kings);
  let term = 0;
  if (next[us] === kings[them]) term += SNAIL_STRIKE;
  if (next[them] === kings[us]) term -= SNAIL_STRIKE;
  if (mode === 'hungry') {
    const meal = (owner: Color) => {
      const p = fb.board[sqTo0x88(next[owner])];
      return p && p.color !== owner && p.type !== 'k' ? VALUE[p.type] : 0;
    };
    term += meal(us) - meal(them);
  }
  return term;
}

/** Pick a move for the side to move in `req.fen`. Throws if there are no legal moves. */
export function chooseMove(req: AiRequest): AiResult {
  const start = now();
  const fb = new FastBoard(req.fen);
  const searcher = new Searcher(fb, req.quiescence ?? false, req.snails);
  const legal = searcher.legalMoves();
  if (legal.length === 0) throw new Error('No legal moves');
  if (legal.length === 1) return toResult(legal[0], 0, 0, 1, start);

  const depth = Math.max(1, Math.floor(req.depth));
  const rng = createRng(req.seed ?? 0x5eed);
  const crawlNext = req.snails && req.crawlIn === 1 ? req.snails : null;
  // Shuffle before the (stable) ordering sort so equally good moves vary from game to game.
  const ordered = searcher.order(shuffle(legal, rng), true);

  /** A root move's score. The crawl term is added outside the search, so it needs a full window. */
  const scoreRoot = (m: RawMove, alpha: number): number => {
    fb.make(m);
    let s = -searcher.negamax(depth - 1, -INF, crawlNext ? INF : -alpha, 1);
    // No crawl if the move ends the game (mate or stalemate).
    if (crawlNext && fb.moves().length > 0) s += crawlTerm(fb, crawlNext, req.mode);
    fb.undo();
    return s;
  };

  if ((req.randomWindow ?? 0) > 0) {
    // Exact score for every root move, then a random pick among the near-best.
    const scored = ordered.map((m) => ({ m, s: scoreRoot(m, -INF) }));
    const best = Math.max(...scored.map((x) => x.s));
    const pool = scored.filter((x) => x.s >= best - (req.randomWindow ?? 0));
    const pick = pool[Math.floor(rng() * pool.length)];
    return toResult(pick.m, pick.s, depth, searcher.nodes, start);
  }

  let alpha = -INF;
  let bestMove = ordered[0];
  for (const m of ordered) {
    const s = scoreRoot(m, alpha);
    if (s > alpha) {
      alpha = s;
      bestMove = m;
    }
  }
  return toResult(bestMove, alpha, depth, searcher.nodes, start);
}
