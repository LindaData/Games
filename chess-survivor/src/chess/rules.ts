/**
 * Chess rules layer. Every normal move is generated and validated by chess.js.
 * Upgrade effects that explicitly bend the rules (teleport, ghost move, borrowed
 * movement, respawn) are expressed as position edits that produce a new FEN which
 * chess.js then continues from.
 */
import { Chess, type PieceSymbol, type Square } from 'chess.js';
import { FastBoard } from './fast';
import { ALL_SQUARES, fileOf, rankOf, to0x88, toSquare, isDark } from './squares';

export type Color = 'w' | 'b';

export interface Placement {
  sq: Square;
  type: PieceSymbol;
  color: Color;
}

export interface GameMove {
  from: Square;
  to: Square;
  promotion?: PieceSymbol;
  captured?: PieceSymbol;
  /** chess.js flag letters: n b e c p k q */
  flags?: string;
  piece?: PieceSymbol;
  color?: Color;
  san?: string;
}

/** Rule modifications currently in force (from upgrades or bosses). */
export interface RuleMods {
  /** Reinforced Armor: enemy pawns cannot capture the player on ranks 1–4. */
  armor: boolean;
  /** The Immortal boss piece: can only be captured while standing on a dark square. */
  immortalSq: Square | null;
}

export const NO_MODS: RuleMods = { armor: false, immortalSq: null };

/** Highest rank on which Reinforced Armor still protects the player. */
export const ARMOR_MAX_RANK = 4;

/** Does Reinforced Armor stop enemy pawns capturing the player on `sq`? */
export function armorProtects(mods: RuleMods, sq: Square | null): boolean {
  return mods.armor && !!sq && rankOf(sq) <= ARMOR_MAX_RANK;
}

export function makeChess(fen: string): Chess {
  return new Chess(fen, { skipValidation: true });
}

export function boardFromFen(fen: string): Placement[] {
  const chess = makeChess(fen);
  const out: Placement[] = [];
  for (const row of chess.board()) for (const p of row) if (p) out.push({ sq: p.square, type: p.type, color: p.color });
  return out;
}

export function pieceAt(fen: string, sq: Square): Placement | null {
  const p = makeChess(fen).get(sq);
  return p ? { sq, type: p.type, color: p.color } : null;
}

function castlingFor(pieces: Placement[], allowed: string): string {
  const at = (sq: string, type: PieceSymbol, color: Color) => pieces.some((p) => p.sq === sq && p.type === type && p.color === color);
  let s = '';
  if (allowed.includes('K') && at('e1', 'k', 'w') && at('h1', 'r', 'w')) s += 'K';
  if (allowed.includes('Q') && at('e1', 'k', 'w') && at('a1', 'r', 'w')) s += 'Q';
  if (allowed.includes('k') && at('e8', 'k', 'b') && at('h8', 'r', 'b')) s += 'k';
  if (allowed.includes('q') && at('e8', 'k', 'b') && at('a8', 'r', 'b')) s += 'q';
  return s || '-';
}

export function buildFen(
  pieces: Placement[],
  turn: Color,
  opts: { castling?: string; halfmove?: number; fullmove?: number } = {},
): string {
  const grid: (Placement | undefined)[][] = Array.from({ length: 8 }, () => Array(8).fill(undefined));
  for (const p of pieces) grid[8 - rankOf(p.sq)][fileOf(p.sq)] = p;
  const rows = grid.map((row) => {
    let s = '';
    let empty = 0;
    for (const p of row) {
      if (!p) {
        empty++;
        continue;
      }
      if (empty) s += empty;
      empty = 0;
      s += p.color === 'w' ? p.type.toUpperCase() : p.type;
    }
    return s + (empty ? empty : '');
  });
  const castling = castlingFor(pieces, opts.castling ?? 'KQkq');
  return `${rows.join('/')} ${turn} ${castling} - ${opts.halfmove ?? 0} ${opts.fullmove ?? 1}`;
}

function fenFields(fen: string) {
  const [, , castling, , half, full] = fen.split(' ');
  return { castling, halfmove: Number(half) || 0, fullmove: Number(full) || 1 };
}

/** Rebuild a FEN after editing the placement list, keeping castling/clock info. */
export function editFen(fen: string, edit: (pieces: Placement[]) => Placement[], turn: Color): string {
  const f = fenFields(fen);
  const pieces = edit(boardFromFen(fen));
  return buildFen(pieces, turn, { castling: f.castling === '-' ? '' : f.castling, halfmove: f.halfmove, fullmove: f.fullmove });
}

export function setTurn(fen: string, turn: Color): string {
  return editFen(fen, (p) => p, turn);
}

export function turnOf(fen: string): Color {
  return fen.split(' ')[1] as Color;
}

function toGameMove(m: { from: string; to: string; promotion?: string; captured?: string; flags: string; piece: string; color: string; san: string }): GameMove {
  return {
    from: m.from as Square,
    to: m.to as Square,
    promotion: m.promotion as PieceSymbol | undefined,
    captured: m.captured as PieceSymbol | undefined,
    flags: m.flags,
    piece: m.piece as PieceSymbol,
    color: m.color as Color,
    san: m.san,
  };
}

/** Can the player capture the piece standing on `target`? (Immortal rule, never kings.) */
export function playerMayCapture(fen: string, target: Square, mods: RuleMods): boolean {
  const p = pieceAt(fen, target);
  if (!p || p.color !== 'b') return true;
  if (p.type === 'k') return false;
  if (mods.immortalSq === target && !isDark(target)) return false;
  return true;
}

/** Legal chess moves of the player's piece (white to move). */
export function playerMoves(fen: string, playerSq: Square, mods: RuleMods): GameMove[] {
  const chess = makeChess(fen);
  if (chess.turn() !== 'w') return [];
  return chess
    .moves({ square: playerSq, verbose: true })
    .map(toGameMove)
    .filter((m) => m.captured !== 'k' && (!m.captured || playerMayCapture(fen, m.to, mods)));
}

/** Legal enemy moves, with rule mods applied (e.g. armor removes pawn captures on the player). */
export function enemyMoves(fen: string, playerSq: Square | null, mods: RuleMods): GameMove[] {
  const chess = makeChess(fen);
  if (chess.turn() !== 'b') return [];
  return chess
    .moves({ verbose: true })
    .map(toGameMove)
    .filter((m) => !(armorProtects(mods, playerSq) && m.piece === 'p' && m.to === playerSq));
}

export interface ApplyResult {
  fen: string;
  move: GameMove;
}

export function applyMove(fen: string, move: { from: Square; to: Square; promotion?: PieceSymbol }): ApplyResult {
  const chess = makeChess(fen);
  const m = chess.move({ from: move.from, to: move.to, promotion: move.promotion ?? 'q' });
  return { fen: chess.fen(), move: toGameMove(m) };
}

/** Squares from which an enemy can legally capture the player right now (black to move). */
export function capturersOf(fen: string, playerSq: Square, mods: RuleMods): Square[] {
  const fb = new FastBoard(fen);
  const target = to0x88(playerSq);
  const out = new Set<Square>();
  fb.withTurn('b', () => {
    for (const m of fb.moves(true)) {
      if (m.to !== target) continue;
      if (armorProtects(mods, playerSq) && m.piece === 'p') continue;
      out.add(sqName(m.from));
    }
  });
  return [...out];
}

/** Is the player in immediate danger if it's the enemy's turn? For a player king: is it in check. */
export function isPlayerThreatened(fen: string, playerSq: Square, mods: RuleMods, playerIsKing: boolean): boolean {
  if (playerIsKing) return new FastBoard(fen).attacked('b', to0x88(playerSq));
  return capturersOf(fen, playerSq, mods).length > 0;
}

/** Every square currently attacked by the enemy army (for the danger heat-map). */
export function enemyAttackMap(fen: string, mods: RuleMods): Set<Square> {
  const fb = new FastBoard(fen);
  const out = new Set<Square>();
  for (const sq of ALL_SQUARES) {
    const i = to0x88(sq);
    if (!fb.attacked('b', i)) continue;
    if (armorProtects(mods, sq)) {
      const attackers = fb.attackers('b', i);
      if (attackers.every((a) => fb.pieceAt(to0x88(a as Square))?.type === 'p')) continue;
    }
    out.add(sq);
  }
  return out;
}

/** Would the player be capturable after making this (already-computed) move? */
export function landingIsDangerous(resultFen: string, landing: Square, mods: RuleMods, playerIsKing: boolean): boolean {
  if (playerIsKing) return false; // chess.js never allows a king to move into check
  return capturersOf(resultFen, landing, mods).length > 0;
}

function sqName(i: number): Square {
  return `${'abcdefgh'[i & 15]}${8 - (i >> 4)}` as Square;
}

// ---------------------------------------------------------------------------
// Rule-bending moves (only reachable through upgrades)
// ---------------------------------------------------------------------------

const DIRS: Record<string, [number, number][]> = {
  r: [[1, 0], [-1, 0], [0, 1], [0, -1]],
  b: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
  q: [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]],
};

function validLanding(fen: string, sq: Square, type: PieceSymbol, mods: RuleMods): boolean {
  const p = pieceAt(fen, sq);
  if (p && p.color === 'w') return false;
  if (p && !playerMayCapture(fen, sq, mods)) return false;
  if (type === 'p' && (rankOf(sq) === 1)) return false;
  return true;
}

export const GHOST_SLIDE_RANGE = 3;
export const TELEPORT_RANGE = 3;

/** Ghost Move: slide up to 3 squares through pieces (sliders) or step up to two squares (leapers); empty landings only. */
export function ghostTargets(fen: string, playerSq: Square, type: PieceSymbol, mods: RuleMods): Square[] {
  const f = fileOf(playerSq);
  const r = rankOf(playerSq);
  const out = new Set<Square>();
  const empty = (s: Square) => !pieceAt(fen, s) && validLanding(fen, s, type, mods);
  if (type === 'r' || type === 'b' || type === 'q') {
    for (const [df, dr] of DIRS[type]) {
      for (let k = 1; k <= GHOST_SLIDE_RANGE; k++) {
        const s = toSquare(f + df * k, r + dr * k);
        if (!s) break;
        if (empty(s)) out.add(s);
      }
    }
  } else if (type === 'p') {
    for (const k of [1, 2]) {
      const s = toSquare(f, r + k);
      if (s && !pieceAt(fen, s)) out.add(s);
    }
  } else {
    for (let df = -2; df <= 2; df++)
      for (let dr = -2; dr <= 2; dr++) {
        if (!df && !dr) continue;
        const s = toSquare(f + df, r + dr);
        if (s && empty(s)) out.add(s);
      }
  }
  return filterKingSafe(fen, playerSq, type, [...out]);
}

/** Teleport: any empty square within 3 squares (a pawn may not land on the first or last rank). */
export function teleportTargets(fen: string, playerSq: Square, type: PieceSymbol): Square[] {
  const occupied = new Set(boardFromFen(fen).map((p) => p.sq));
  const near = (s: Square) => Math.max(Math.abs(fileOf(s) - fileOf(playerSq)), Math.abs(rankOf(s) - rankOf(playerSq))) <= TELEPORT_RANGE;
  const out = ALL_SQUARES.filter((s) => near(s) && !occupied.has(s) && !(type === 'p' && (rankOf(s) === 1 || rankOf(s) === 8)));
  return filterKingSafe(fen, playerSq, type, out);
}

/** Borrowed movement: legal chess moves as if your piece were `asType` for one move. */
export function borrowedMoves(fen: string, playerSq: Square, baseType: PieceSymbol, asType: PieceSymbol, mods: RuleMods): Square[] {
  const swapped = editFen(fen, (ps) => ps.map((p) => (p.sq === playerSq ? { ...p, type: asType } : p)), 'w');
  return playerMoves(swapped, playerSq, mods)
    .filter((m) => !(baseType === 'p' && rankOf(m.to) === 1))
    .map((m) => m.to)
    .filter((v, i, a) => a.indexOf(v) === i);
}

function filterKingSafe(fen: string, playerSq: Square, type: PieceSymbol, targets: Square[]): Square[] {
  if (type !== 'k') return targets;
  return targets.filter((t) => {
    const next = relocate(fen, playerSq, t, 'k', 'b');
    return !new FastBoard(next).attacked('b', to0x88(t));
  });
}

/**
 * Move the player's piece from `from` to `to` by rule-bending means, capturing anything
 * standing there. A pawn reaching the last rank promotes to a queen.
 */
export function relocate(fen: string, from: Square, to: Square, type: PieceSymbol, turnAfter: Color): string {
  const finalType: PieceSymbol = type === 'p' && rankOf(to) === 8 ? 'q' : type;
  return editFen(
    fen,
    (ps) => [...ps.filter((p) => p.sq !== from && p.sq !== to), { sq: to, type: finalType, color: 'w' }],
    turnAfter,
  );
}

/** Put the player back on the board after being captured. Picks the safest empty square. */
export function findRespawnSquare(fen: string, type: PieceSymbol, mods: RuleMods, rng: () => number): Square | null {
  const pieces = boardFromFen(fen);
  const occupied = new Set(pieces.map((p) => p.sq));
  const enemies = pieces.filter((p) => p.color === 'b');
  const candidates = ALL_SQUARES.filter((s) => !occupied.has(s) && !(type === 'p' && (rankOf(s) === 1 || rankOf(s) >= 7)));
  let best: Square | null = null;
  let bestScore = -Infinity;
  for (const s of candidates) {
    const trial = editFen(fen, (ps) => [...ps, { sq: s, type, color: 'w' }], 'b');
    const fb = new FastBoard(trial);
    if (type === 'k') {
      if (fb.attacked('b', to0x88(s))) continue;
    } else if (capturersOf(trial, s, mods).length > 0) continue;
    // Prefer squares far from the enemy, with room to run, close to your own back ranks.
    const minDist = Math.min(...enemies.map((e) => Math.max(Math.abs(fileOf(e.sq) - fileOf(s)), Math.abs(rankOf(e.sq) - rankOf(s)))), 8);
    const escapes = fb.withTurn('w', () => fb.movesFrom(to0x88(s), type === 'k').filter((m) => !fb.attacked('b', m.to)).length);
    const score = minDist * 2 + Math.min(escapes, 6) * 1.5 - rankOf(s) * 0.5 + rng() * 1.5;
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best;
}

export function isInCheck(fen: string, color: Color): boolean {
  return new FastBoard(fen).inCheck(color);
}
