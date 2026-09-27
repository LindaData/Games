/**
 * The Hunter: an alpha-beta search that plays the enemy army.
 *
 * Why not Stockfish? Stockfish optimises for checkmating a king. In Chess Survivor the
 * enemy's real goal is to hunt down a single piece (which usually is not a king), deny
 * it objectives and keep its own king safe. So the engine searches real chess.js move
 * trees with a custom evaluation: material, how many safe squares the player has left,
 * how tightly the army is closing in, and objective-specific terms.
 */
import type { Square } from 'chess.js';
import { BITS, FastBoard, type RawMove } from '../chess/fast';
import { to0x88, from0x88 } from '../chess/squares';
import { ARMOR_MAX_RANK } from '../chess/rules';
import { createRng, gaussian } from '../core/rng';
import type { AiProfile } from './profiles';

export type GoalHint =
  | { type: 'none' }
  | { type: 'targets'; squares: Square[]; pawnRace?: boolean }
  | { type: 'protect' }
  | { type: 'kingStay' };

export interface AiRequest {
  fen: string;
  playerSq: Square;
  playerIsKing: boolean;
  allySq: Square | null;
  immortalSq: Square | null;
  armor: boolean;
  goal: GoalHint;
  profile: AiProfile;
  seed: number;
}

export interface AiResult {
  from: Square;
  to: Square;
  promotion?: string;
  score: number;
  depth: number;
  nodes: number;
  ms: number;
}

const VALUE: Record<string, number> = { p: 100, n: 300, b: 320, r: 500, q: 900, k: 0 };
const WIN = 100000;
const STALEMATE = 4000;
const INF = 1e9;

class Timeout extends Error {}

function cheb(a: number, b: number): number {
  return Math.max(Math.abs((a & 15) - (b & 15)), Math.abs((a >> 4) - (b >> 4)));
}
const isDark0x88 = (i: number) => ((i & 15) + (8 - (i >> 4))) % 2 === 1;

export class Hunter {
  private fb: FastBoard;
  private player: number;
  private ally: number;
  private immortal: number;
  private readonly targets: number[];
  private nodes = 0;
  private deadline = 0;

  constructor(private readonly req: AiRequest) {
    this.fb = new FastBoard(req.fen);
    this.player = to0x88(req.playerSq);
    this.ally = req.allySq ? to0x88(req.allySq) : -1;
    this.immortal = req.immortalSq ? to0x88(req.immortalSq) : -1;
    this.targets = req.goal.type === 'targets' ? req.goal.squares.map(to0x88) : [];
  }

  // ---- move generation with Chess Survivor rule mods ----------------------

  /** Reinforced Armor only protects on the player's own half (ranks 1–4). */
  private armorOn(): boolean {
    return this.req.armor && 8 - (this.player >> 4) <= ARMOR_MAX_RANK;
  }

  private blackMoves(): RawMove[] {
    const ms = this.fb.moves(true);
    const out: RawMove[] = [];
    for (const m of ms) {
      if (m.piece === 'p' && m.to === this.player && this.armorOn()) continue;
      if (m.promotion && m.promotion !== 'q' && m.promotion !== 'n') continue;
      out.push(m);
    }
    return out;
  }

  private whiteMoves(legal: boolean): RawMove[] {
    const ms = this.fb.movesFrom(this.player, legal || this.req.playerIsKing);
    const out: RawMove[] = [];
    for (const m of ms) {
      if (m.captured === 'k') continue;
      if (m.promotion && m.promotion !== 'q') continue;
      if (m.to === this.immortal && !isDark0x88(m.to)) continue;
      out.push(m);
    }
    return out;
  }

  private orderBlack(ms: RawMove[]): RawMove[] {
    const score = (m: RawMove) => {
      if (m.to === this.player) return 1e6;
      if (m.to === this.ally) return 5e5;
      let s = 0;
      if (m.captured) s += 10 * VALUE[m.captured] - VALUE[m.piece] / 10 + 1000;
      if (m.promotion) s += 800;
      s += 8 - cheb(m.to, this.player);
      return s;
    };
    return ms.map((m) => ({ m, s: score(m) })).sort((a, b) => b.s - a.s).map((x) => x.m);
  }

  // ---- search ---------------------------------------------------------------

  private search(depth: number, alpha: number, beta: number, ply: number): number {
    this.nodes++;
    if ((this.nodes & 511) === 0 && Date.now() > this.deadline) throw new Timeout();
    const fb = this.fb;

    if (fb.turn === 'b') {
      const moves = this.blackMoves();
      if (moves.length === 0) return fb.inCheck('b') ? -WIN + ply : -STALEMATE;
      if (depth <= 0) return this.evaluate(ply);
      let best = -INF;
      for (const m of this.orderBlack(moves)) {
        let s: number;
        const terminal = this.blackTerminal(m, ply);
        if (terminal !== null) s = terminal;
        else {
          const prevImm = this.immortal;
          if (m.from === this.immortal) this.immortal = m.to;
          fb.make(m);
          s = this.search(depth - 1, alpha, beta, ply + 1);
          fb.undo();
          this.immortal = prevImm;
        }
        if (s > best) best = s;
        if (best > alpha) alpha = best;
        if (alpha >= beta) break;
      }
      return best;
    }

    // White: only the player's piece moves.
    const moves = this.whiteMoves(true);
    if (moves.length === 0) {
      if (this.req.playerIsKing && fb.inCheck('w')) return WIN - ply;
      return -STALEMATE;
    }
    let best = INF;
    for (const m of moves) {
      if (this.targets.includes(m.to)) return -WIN / 2 + ply;
    }
    if (depth <= 0) return this.evaluate(ply);
    // Captures first, then moves away from danger — good enough ordering for small branching.
    moves.sort((a, b) => (b.captured ? VALUE[b.captured] : 0) - (a.captured ? VALUE[a.captured] : 0));
    for (const m of moves) {
      const prevPlayer = this.player;
      const prevImm = this.immortal;
      if (m.to === this.immortal) this.immortal = -1;
      fb.make(m);
      this.player = m.to;
      const s = this.search(depth - 1, alpha, beta, ply + 1);
      fb.undo();
      this.player = prevPlayer;
      this.immortal = prevImm;
      if (s < best) best = s;
      if (best < beta) beta = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  /** Scores for enemy moves that end the encounter immediately, else null. */
  private blackTerminal(m: RawMove, ply: number): number | null {
    if (m.to === this.player && !this.req.playerIsKing) return WIN - ply;
    if (m.to === this.ally && this.req.goal.type === 'protect') return WIN / 2 - ply;
    if (this.req.goal.type === 'kingStay' && m.piece === 'k') return -WIN / 2 + ply;
    if (this.req.goal.type === 'kingStay' && m.flags & (BITS.KSIDE_CASTLE | BITS.QSIDE_CASTLE)) return -WIN / 2 + ply;
    return null;
  }

  // ---- evaluation (from the enemy's point of view) --------------------------

  private evaluate(ply: number): number {
    const fb = this.fb;
    const p = this.player;
    let score = 0;
    let proximity = 0;
    fb.forEachPiece((sq, piece) => {
      if (sq === p) return;
      if (piece.color === 'b') {
        score += VALUE[piece.type];
        if (piece.type !== 'k') {
          const d = cheb(sq, p);
          proximity += (8 - d) * (piece.type === 'p' ? 2 : 5);
          if (this.ally >= 0) proximity += (8 - cheb(sq, this.ally)) * 2;
        }
      } else {
        score -= VALUE[piece.type];
      }
    });
    score += proximity;

    const kingPlayer = this.req.playerIsKing;
    const attackersOfPlayer = () => {
      const list = fb.attackers('b', p);
      return this.armorOn() ? list.filter((a) => fb.pieceAt(to0x88(a as Square))?.type !== 'p') : list;
    };

    if (fb.turn === 'b') {
      if (!kingPlayer && attackersOfPlayer().length > 0) return WIN / 4 - ply;
      if (this.ally >= 0 && this.req.goal.type === 'protect' && fb.attacked('b', this.ally)) score += 1500;
    } else {
      const attacked = attackersOfPlayer().length > 0;
      if (attacked) score += kingPlayer ? 120 : 60;
    }

    // Player mobility: how many safe squares can the hunted piece still reach?
    const wm = fb.withTurn('w', () => this.whiteMoves(false));
    let safe = 0;
    for (const m of wm) if (!fb.attacked('b', m.to)) safe++;
    score += (8 - Math.min(safe, 8)) * 18;
    if (safe === 0) score += fb.turn === 'w' && attackersOfPlayer().length > 0 ? WIN / 8 : 250;

    if (this.targets.length) {
      let dist = 99;
      for (const t of this.targets) {
        const d = this.req.goal.type === 'targets' && this.req.goal.pawnRace ? Math.abs((t >> 4) - (p >> 4)) : cheb(t, p);
        if (d < dist) dist = d;
      }
      score += dist * 45;
    }
    if (this.ally >= 0 && this.req.goal.type === 'protect') {
      if (fb.attacked('b', this.ally)) score += 300;
    }
    if (fb.inCheck('b')) score -= 40;
    return score;
  }

  // ---- root -----------------------------------------------------------------

  choose(): AiResult {
    const start = Date.now();
    const { profile } = this.req;
    this.deadline = start + profile.timeMs;
    const rng = createRng(this.req.seed);
    let rootMoves = this.orderBlack(this.blackMoves());
    if (rootMoves.length === 0) throw new Error('No legal enemy moves');

    let scores = new Map<RawMove, number>();
    let completedDepth = 0;
    for (let depth = 1; depth <= profile.depth; depth++) {
      const iter = new Map<RawMove, number>();
      try {
        for (const m of rootMoves) {
          let s = this.blackTerminal(m, 0);
          if (s === null) {
            const prevImm = this.immortal;
            if (m.from === this.immortal) this.immortal = m.to;
            this.fb.make(m);
            try {
              s = this.search(depth - 1, -INF, INF, 1);
            } finally {
              this.fb.undo();
              this.immortal = prevImm;
            }
          }
          iter.set(m, s);
        }
      } catch (e) {
        if (e instanceof Timeout) break;
        throw e;
      }
      scores = iter;
      completedDepth = depth;
      rootMoves = [...rootMoves].sort((a, b) => (iter.get(b) ?? 0) - (iter.get(a) ?? 0));
      if ((iter.get(rootMoves[0]) ?? 0) > WIN / 2) break; // forced win found
    }

    let chosen: RawMove;
    if (scores.size === 0) {
      chosen = rootMoves[0];
    } else if (rng() < profile.blunder) {
      // Blunders are careless, not suicidal: never throw away the encounter outright.
      const pool = rootMoves.filter((m) => (scores.get(m) ?? 0) > -WIN / 4);
      const from = pool.length ? pool : rootMoves;
      chosen = from[Math.floor(rng() * from.length)];
    } else {
      let bestVal = -INF;
      chosen = rootMoves[0];
      for (const m of rootMoves) {
        const v = (scores.get(m) ?? -INF) + gaussian(rng) * profile.noise;
        if (v > bestVal) {
          bestVal = v;
          chosen = m;
        }
      }
    }
    return {
      from: from0x88(chosen.from),
      to: from0x88(chosen.to),
      promotion: chosen.promotion,
      score: scores.get(chosen) ?? 0,
      depth: completedDepth,
      nodes: this.nodes,
      ms: Date.now() - start,
    };
  }
}

export function chooseEnemyMove(req: AiRequest): AiResult {
  return new Hunter(req).choose();
}
