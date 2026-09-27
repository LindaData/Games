/**
 * Combat state machine for one encounter. Pure functions: every action takes a
 * CombatState and returns a new one. React only renders the state and forwards input.
 */
import type { PieceSymbol, Square } from 'chess.js';
import {
  applyMove,
  borrowedMoves,
  boardFromFen,
  capturersOf,
  editFen,
  enemyMoves,
  findRespawnSquare,
  ghostTargets,
  isInCheck,
  landingIsDangerous,
  playerMoves,
  relocate,
  setTurn,
  teleportTargets,
  type GameMove,
  type RuleMods,
} from '../chess/rules';
import { mirrorSquare, rankOf, to0x88 } from '../chess/squares';
import { FastBoard } from '../chess/fast';
import type { AiRequest, GoalHint } from '../ai/search';
import { profileForElo } from '../ai/profiles';
import type { EncounterDef } from './encounters';
import { UPGRADES, type UpgradeId } from './upgrades';
import { PIECE_NAMES } from './pieces';

export type ActionMode =
  | { kind: 'normal' }
  | { kind: 'ghost' }
  | { kind: 'teleport' }
  | { kind: 'borrow'; as: PieceSymbol };

export type FxKind =
  | 'capture'
  | 'hit'
  | 'dodge'
  | 'parry'
  | 'respawn'
  | 'teleport'
  | 'promote'
  | 'heal'
  | 'freeze'
  | 'smoke'
  | 'rewind'
  | 'ghost'
  | 'mirror'
  | 'objective'
  | 'check';

export interface Fx {
  id: number;
  kind: FxKind;
  sq?: Square;
  text?: string;
  tone: 'good' | 'bad' | 'info';
}

export interface LogEntry {
  id: number;
  text: string;
  tone: 'good' | 'bad' | 'info' | 'enemy';
}

export type Outcome = 'objective' | 'checkmate' | 'stalemate' | 'slain' | 'failed' | 'dead';

interface Snapshot {
  fen: string;
  ids: Record<string, number>;
  turn: number;
  captures: number;
  playerType: PieceSymbol;
  lastMove: { from: Square; to: Square } | null;
}

export interface CombatState {
  enc: EncounterDef;
  fen: string;
  /** square -> stable piece id (for animation and tracking special pieces) */
  ids: Record<string, number>;
  nextId: number;
  playerId: number;
  allyId: number | null;
  immortalId: number | null;
  mirrorId: number | null;
  playerType: PieceSymbol;
  baseType: PieceSymbol;
  turn: number;
  captures: number;
  phase: 'player' | 'enemy' | 'won' | 'lost';
  outcome?: Outcome;
  hp: number;
  maxHp: number;
  /** remaining uses of charge-based upgrades (encounter- and run-scoped) */
  charges: Partial<Record<UpgradeId, number>>;
  owned: Partial<Record<UpgradeId, number>>;
  mode: ActionMode;
  history: Snapshot[];
  lastMove: { from: Square; to: Square } | null;
  lastPlayerMove: { from: Square; to: Square; special: boolean } | null;
  pendingEnemy: 'stasis' | 'smoke' | null;
  hitsTaken: number;
  kingHome: Square | null;
  fx: Fx[];
  log: LogEntry[];
  seq: number;
}

export interface PlayerTarget {
  to: Square;
  capture: boolean;
  danger: boolean;
  promotion: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function squareOfId(s: CombatState, id: number | null): Square | null {
  if (id === null) return null;
  for (const [sq, v] of Object.entries(s.ids)) if (v === id) return sq as Square;
  return null;
}

export function maybePlayerSquare(s: CombatState): Square | null {
  return squareOfId(s, s.playerId);
}

export function playerSquare(s: CombatState): Square {
  const sq = squareOfId(s, s.playerId);
  if (!sq) throw new Error('Player missing from board');
  return sq;
}

export function ruleMods(s: CombatState): RuleMods {
  return { armor: !!s.owned.reinforced_armor, immortalSq: squareOfId(s, s.immortalId) };
}

function has(s: CombatState, id: UpgradeId): boolean {
  return (s.owned[id] ?? 0) > 0;
}

function pushFx(s: CombatState, kind: FxKind, tone: Fx['tone'], sq?: Square, text?: string): void {
  s.seq++;
  s.fx = [...s.fx.slice(-12), { id: s.seq, kind, sq, text, tone }];
}

function log(s: CombatState, text: string, tone: LogEntry['tone'] = 'info'): void {
  s.seq++;
  s.log = [...s.log.slice(-40), { id: s.seq, text, tone }];
}

function clone(s: CombatState): CombatState {
  return { ...s, ids: { ...s.ids }, charges: { ...s.charges }, fx: s.fx, log: s.log };
}

function moveIds(ids: Record<string, number>, m: GameMove): { ids: Record<string, number>; capturedId: number | null; capturedSq: Square | null } {
  const next = { ...ids };
  let capturedId: number | null = null;
  let capturedSq: Square | null = null;
  const flags = m.flags ?? '';
  if (flags.includes('e')) {
    capturedSq = `${m.to[0]}${m.from[1]}` as Square;
    capturedId = next[capturedSq] ?? null;
    delete next[capturedSq];
  } else if (next[m.to] !== undefined) {
    capturedId = next[m.to];
    capturedSq = m.to;
  }
  next[m.to] = next[m.from];
  delete next[m.from];
  const r = m.from[1];
  if (flags.includes('k')) {
    next[`f${r}`] = next[`h${r}`];
    delete next[`h${r}`];
  }
  if (flags.includes('q')) {
    next[`d${r}`] = next[`a${r}`];
    delete next[`a${r}`];
  }
  return { ids: next, capturedId, capturedSq };
}

function relocateIds(ids: Record<string, number>, from: Square, to: Square): { ids: Record<string, number>; capturedId: number | null } {
  const next = { ...ids };
  const capturedId = next[to] ?? null;
  next[to] = next[from];
  delete next[from];
  return { ids: next, capturedId };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

export interface CombatInit {
  enc: EncounterDef;
  piece: PieceSymbol;
  hp: number;
  maxHp: number;
  owned: Partial<Record<UpgradeId, number>>;
  runCharges: Partial<Record<UpgradeId, number>>;
}

export function createCombat(init: CombatInit): CombatState {
  const { enc } = init;
  const ids: Record<string, number> = {};
  let nextId = 1;
  for (const p of boardFromFen(enc.fen)) ids[p.sq] = nextId++;
  const charges: Partial<Record<UpgradeId, number>> = {};
  for (const [id, count] of Object.entries(init.owned) as [UpgradeId, number][]) {
    const def = UPGRADES[id];
    if (def.scope === 'encounter') charges[id] = def.stackable ? count : 1;
  }
  for (const [id, count] of Object.entries(init.runCharges) as [UpgradeId, number][]) charges[id] = count;
  const kingSq = boardFromFen(enc.fen).find((p) => p.type === 'k' && p.color === 'b')?.sq ?? null;
  const s: CombatState = {
    enc,
    fen: enc.fen,
    ids,
    nextId,
    playerId: ids[enc.playerSq],
    allyId: enc.allySq ? ids[enc.allySq] : null,
    immortalId: enc.immortalSq ? ids[enc.immortalSq] : null,
    mirrorId: enc.mirrorSq ? ids[enc.mirrorSq] : null,
    playerType: init.piece,
    baseType: init.piece,
    turn: 0,
    captures: 0,
    phase: 'player',
    hp: init.hp,
    maxHp: init.maxHp,
    charges,
    owned: { ...init.owned },
    mode: { kind: 'normal' },
    history: [],
    lastMove: null,
    lastPlayerMove: null,
    pendingEnemy: null,
    hitsTaken: 0,
    kingHome: kingSq,
    fx: [],
    log: [],
    seq: 0,
  };
  log(s, `${enc.name}: ${enc.subtitle}.`, 'info');
  return s;
}

// ---------------------------------------------------------------------------
// Player phase
// ---------------------------------------------------------------------------

export function canUse(s: CombatState, id: UpgradeId): boolean {
  if (s.phase !== 'player') return false;
  if ((s.charges[id] ?? 0) <= 0) return false;
  if (id === 'time_warp') return s.history.length > 0;
  if (id === 'stasis') return !isInCheck(s.fen, 'b');
  return true;
}

export function setMode(s: CombatState, mode: ActionMode): CombatState {
  return { ...s, mode };
}

/** Everything the player can click this turn, with danger/safety flags. */
export function getTargets(s: CombatState): PlayerTarget[] {
  if (s.phase !== 'player') return [];
  const from = playerSquare(s);
  const mods = ruleMods(s);
  const isKing = s.playerType === 'k';
  const mode = s.mode;
  if (mode.kind === 'normal') {
    const moves = playerMoves(s.fen, from, mods);
    const seen = new Map<Square, PlayerTarget>();
    for (const m of moves) {
      if (seen.has(m.to)) continue;
      const after = applyMove(s.fen, m).fen;
      seen.set(m.to, { to: m.to, capture: !!m.captured, promotion: !!m.promotion, danger: landingIsDangerous(after, m.to, mods, isKing) });
    }
    return [...seen.values()];
  }
  let squares: Square[];
  let type = s.playerType;
  if (mode.kind === 'ghost') squares = ghostTargets(s.fen, from, s.playerType, mods);
  else if (mode.kind === 'teleport') squares = teleportTargets(s.fen, from, s.playerType);
  else {
    squares = borrowedMoves(s.fen, from, s.playerType, mode.as, mods);
    type = s.playerType;
  }
  const occupied = new Set(Object.keys(s.ids));
  return squares.map((to) => {
    const after = relocate(s.fen, from, to, type, 'b');
    return {
      to,
      capture: occupied.has(to),
      promotion: false,
      danger: landingIsDangerous(after, to, mods, isKing),
    };
  });
}

function snapshot(s: CombatState): Snapshot {
  return { fen: s.fen, ids: s.ids, turn: s.turn, captures: s.captures, playerType: s.playerType, lastMove: s.lastMove };
}

function onPlayerCapture(s: CombatState, capturedId: number | null, sq: Square): void {
  if (capturedId === null) return;
  s.captures++;
  pushFx(s, 'capture', 'good', sq);
  if (capturedId === s.immortalId) {
    log(s, 'The Immortal falls!', 'good');
    s.phase = 'won';
    s.outcome = 'slain';
    return;
  }
  if (capturedId === s.mirrorId) {
    s.mirrorId = null;
    log(s, 'You shatter your reflection.', 'good');
  }
  if (has(s, 'bloodlust') && (s.charges.bloodlust ?? 0) > 0 && s.hp < s.maxHp) {
    s.charges.bloodlust = 0;
    s.hp++;
    pushFx(s, 'heal', 'good', sq, '+1 HP');
    log(s, 'Bloodlust: you heal 1 HP.', 'good');
  }
}

/** Execute the player's move to `to` in the current mode. */
export function playerAct(prev: CombatState, to: Square, promotion: PieceSymbol = 'q'): CombatState {
  if (prev.phase !== 'player') return prev;
  const targets = getTargets(prev);
  if (!targets.some((t) => t.to === to)) return prev;
  const s = clone(prev);
  s.history = [...prev.history.slice(-5), snapshot(prev)];
  const from = playerSquare(prev);
  const mode = prev.mode;
  s.mode = { kind: 'normal' };

  if (mode.kind === 'normal') {
    const { fen, move } = applyMove(prev.fen, { from, to, promotion });
    const moved = moveIds(prev.ids, move);
    s.fen = fen;
    s.ids = moved.ids;
    s.lastMove = { from, to };
    s.lastPlayerMove = { from, to, special: false };
    if (move.promotion) {
      s.playerType = move.promotion;
      pushFx(s, 'promote', 'good', to, PIECE_NAMES[move.promotion]);
      log(s, `Promotion! You are now a ${PIECE_NAMES[move.promotion]} for this battle.`, 'good');
    }
    if (moved.capturedId !== null) log(s, `You capture the ${PIECE_NAMES[move.captured ?? 'p']} on ${moved.capturedSq}.`, 'good');
    onPlayerCapture(s, moved.capturedId, to);
  } else {
    const type = s.playerType;
    const promoted = type === 'p' && rankOf(to) === 8;
    const capturedPiece = boardFromFen(prev.fen).find((p) => p.sq === to);
    s.fen = relocate(prev.fen, from, to, type, 'b');
    const moved = relocateIds(prev.ids, from, to);
    s.ids = moved.ids;
    s.lastMove = { from, to };
    s.lastPlayerMove = { from, to, special: true };
    const key: UpgradeId = mode.kind === 'ghost' ? 'ghost_move' : mode.kind === 'teleport' ? 'teleport' : 'promotion';
    s.charges[key] = Math.max(0, (s.charges[key] ?? 0) - 1);
    pushFx(s, mode.kind === 'teleport' ? 'teleport' : 'ghost', 'info', to);
    log(s, `${UPGRADES[key].name}: ${from} → ${to}.`, 'good');
    if (promoted) {
      s.playerType = 'q';
      pushFx(s, 'promote', 'good', to, 'Queen');
    }
    if (capturedPiece) log(s, `You capture the ${PIECE_NAMES[capturedPiece.type]} on ${to}.`, 'good');
    onPlayerCapture(s, moved.capturedId, to);
  }
  if (s.phase === 'won') return s;

  // Objective checks after the player's move.
  const o = s.enc.objective;
  const psq = playerSquare(s);
  if ((o.kind === 'reach' || o.kind === 'escape') && o.squares.includes(psq)) return win(s, 'objective');
  if (o.kind === 'promote' && s.baseType === 'p' && s.playerType !== 'p') return win(s, 'objective');
  if (o.kind === 'capture' && s.captures >= o.count) return win(s, 'objective');

  // Can the enemy move at all?
  if (enemyMoves(s.fen, psq, ruleMods(s)).length === 0) {
    if (isInCheck(s.fen, 'b')) {
      log(s, 'Checkmate! The enemy army collapses.', 'good');
      return win(s, 'checkmate');
    }
    log(s, 'Stalemate — the enemy cannot move. You slip away.', 'good');
    return win(s, 'stalemate');
  }
  if (isInCheck(s.fen, 'b')) {
    pushFx(s, 'check', 'good', undefined, 'CHECK');
    log(s, 'Check! The enemy must answer.', 'good');
  }
  s.phase = 'enemy';
  return s;
}

/** Activate a non-movement ability (time warp, stasis, smoke bomb). */
export function useInstant(prev: CombatState, id: UpgradeId): CombatState {
  if (!canUse(prev, id)) return prev;
  const s = clone(prev);
  s.charges[id] = (s.charges[id] ?? 1) - 1;
  if (id === 'time_warp') {
    const snap = s.history[s.history.length - 1];
    s.history = s.history.slice(0, -1);
    s.fen = snap.fen;
    s.ids = snap.ids;
    s.turn = snap.turn;
    s.captures = snap.captures;
    s.playerType = snap.playerType;
    s.lastMove = snap.lastMove;
    s.mode = { kind: 'normal' };
    pushFx(s, 'rewind', 'info', undefined, 'REWIND');
    log(s, 'Time Warp: the last turn never happened.', 'good');
  } else if (id === 'stasis') {
    s.pendingEnemy = 'stasis';
    pushFx(s, 'freeze', 'info', undefined, 'STASIS');
    log(s, 'Stasis primed: the enemy will lose its next turn.', 'good');
  } else if (id === 'smoke_bomb') {
    s.pendingEnemy = 'smoke';
    pushFx(s, 'smoke', 'info', undefined, 'SMOKE');
    log(s, 'Smoke Bomb primed: the enemy will move blindly.', 'good');
  }
  return s;
}

function win(s: CombatState, outcome: Outcome): CombatState {
  s.phase = 'won';
  s.outcome = outcome;
  if (outcome === 'objective') {
    pushFx(s, 'objective', 'good', undefined, 'OBJECTIVE COMPLETE');
    log(s, 'Objective complete!', 'good');
  }
  return s;
}

// ---------------------------------------------------------------------------
// Enemy phase
// ---------------------------------------------------------------------------

export function goalHint(s: CombatState): GoalHint {
  const o = s.enc.objective;
  if (o.kind === 'reach' || o.kind === 'escape') return { type: 'targets', squares: o.squares };
  if (o.kind === 'promote') {
    const f = playerSquare(s)[0];
    return { type: 'targets', squares: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((x) => `${x}8` as Square).filter((x) => Math.abs(x.charCodeAt(0) - f.charCodeAt(0)) <= 1), pawnRace: true };
  }
  if (o.kind === 'protect') return { type: 'protect' };
  if (o.kind === 'kingMove') return { type: 'kingStay' };
  return { type: 'none' };
}

export function buildAiRequest(s: CombatState, seed: number): AiRequest {
  const mods = ruleMods(s);
  return {
    fen: s.fen,
    playerSq: playerSquare(s),
    playerIsKing: s.playerType === 'k',
    allySq: squareOfId(s, s.allyId),
    immortalSq: mods.immortalSq,
    armor: mods.armor,
    goal: goalHint(s),
    profile: profileForElo(s.enc.elo),
    seed,
  };
}

export type ForcedEnemy = { kind: 'skip' } | { kind: 'move'; move: GameMove; reason: 'smoke' | 'mirror' } | { kind: 'mirrorJump'; from: Square; to: Square } | null;

/** Decide whether this enemy turn is dictated by an ability or boss rule instead of the AI. */
export function forcedEnemyAction(s: CombatState, rng: () => number): ForcedEnemy {
  if (s.pendingEnemy === 'stasis') return { kind: 'skip' };
  const psq = playerSquare(s);
  const legal = enemyMoves(s.fen, psq, ruleMods(s));
  if (s.pendingEnemy === 'smoke') return { kind: 'move', move: legal[Math.floor(rng() * legal.length)], reason: 'smoke' };
  const mirrorSq = squareOfId(s, s.mirrorId);
  if (mirrorSq && s.lastPlayerMove && !isInCheck(s.fen, 'b')) {
    const mf = mirrorSquare(s.lastPlayerMove.from);
    const mt = mirrorSquare(s.lastPlayerMove.to);
    if (mf === mirrorSq) {
      if (s.lastPlayerMove.special) {
        const mirrorIsKing = boardFromFen(s.fen).some((p) => p.sq === mf && p.type === 'k');
        if (!mirrorIsKing && !s.ids[mt] && !(s.playerType === 'p' && rankOf(mt) === 1)) return { kind: 'mirrorJump', from: mf, to: mt };
      } else {
        const m = legal.find((x) => x.from === mf && x.to === mt && (!x.promotion || x.promotion === 'q'));
        if (m) return { kind: 'move', move: m, reason: 'mirror' };
      }
    }
  }
  return null;
}

function respawnPlayer(s: CombatState, rng: () => number): boolean {
  const mods = ruleMods(s);
  const without = editFen(s.fen, (ps) => ps.filter((p) => !(p.color === 'w' && s.ids[p.sq] === s.playerId)), 'w');
  const sq = findRespawnSquare(without, s.playerType, mods, rng);
  if (!sq) return false;
  s.fen = editFen(without, (ps) => [...ps, { sq, type: s.playerType, color: 'w' }], 'w');
  const ids = { ...s.ids };
  for (const [k, v] of Object.entries(ids)) if (v === s.playerId) delete ids[k];
  ids[sq] = s.playerId;
  s.ids = ids;
  pushFx(s, 'respawn', 'info', sq);
  return true;
}

function removeAttacker(s: CombatState, sq: Square): void {
  const piece = boardFromFen(s.fen).find((p) => p.sq === sq);
  if (!piece || piece.type === 'k') return;
  // The Immortal shrugs off ripostes.
  if (s.ids[sq] === s.immortalId) return;
  s.fen = editFen(s.fen, (ps) => ps.filter((p) => p.sq !== sq), 'w');
  const ids = { ...s.ids };
  if (ids[sq] === s.mirrorId) s.mirrorId = null;
  delete ids[sq];
  s.ids = ids;
  pushFx(s, 'capture', 'good', sq);
  log(s, `Riposte! The attacking ${PIECE_NAMES[piece.type]} is destroyed.`, 'good');
}

/**
 * Damage pipeline when the player would be captured (or checkmated as a King):
 * Knight's Instinct dodge → Parry → lose 1 HP → Second Life → death.
 * Returns true if the capture was fully prevented (enemy move cancelled).
 */
function defend(
  s: CombatState,
  attackerSq: Square,
  rng: () => number,
  restore?: { fen: string; ids: Record<string, number> },
): 'dodged' | 'parried' | null {
  if ((s.charges.knights_instinct ?? 0) > 0) {
    s.charges.knights_instinct = 0;
    const from = playerSquare(s);
    s.fen = setTurn(s.fen, 'w');
    if (has(s, 'riposte')) removeAttacker(s, attackerSq);
    // Leap to a safe square.
    const mods = ruleMods(s);
    const sq = findRespawnSquare(editFen(s.fen, (ps) => ps.filter((p) => p.sq !== from), 'w'), s.playerType, mods, rng);
    if (sq) {
      s.fen = relocate(s.fen, from, sq, s.playerType, 'w');
      s.ids = relocateIds(s.ids, from, sq).ids;
    }
    pushFx(s, 'dodge', 'good', sq ?? from, 'DODGE');
    log(s, "Knight's Instinct: you dodge the attack!", 'good');
    return 'dodged';
  }
  if ((s.charges.parry ?? 0) > 0) {
    s.charges.parry = (s.charges.parry ?? 1) - 1;
    if (restore) {
      s.ids = restore.ids;
      s.lastMove = null;
    }
    s.fen = setTurn(restore ? restore.fen : s.fen, 'w');
    pushFx(s, 'parry', 'good', playerSquare(s), 'PARRY');
    log(s, 'Parry! The attacker is knocked back.', 'good');
    if (has(s, 'riposte')) removeAttacker(s, attackerSq);
    return 'parried';
  }
  return null;
}

function takeHit(s: CombatState, sq: Square, rng: () => number): void {
  s.hp -= 1;
  s.hitsTaken++;
  pushFx(s, 'hit', 'bad', sq, '-1 HP');
  if (s.hp <= 0 && (s.charges.second_life ?? 0) > 0) {
    s.charges.second_life = (s.charges.second_life ?? 1) - 1;
    s.hp = 1;
    pushFx(s, 'heal', 'good', sq, 'SECOND LIFE');
    log(s, 'Second Life: you refuse to fall!', 'good');
  }
  if (s.hp <= 0) {
    s.phase = 'lost';
    s.outcome = 'dead';
    log(s, 'You have been captured for the last time.', 'bad');
    return;
  }
  if (!respawnPlayer(s, rng)) {
    s.phase = 'lost';
    s.outcome = 'dead';
    log(s, 'Nowhere left to stand.', 'bad');
    return;
  }
  log(s, `You are struck down (-1 HP) and reform on ${playerSquare(s)}.`, 'bad');
}

/**
 * Resolve the enemy's turn. `move` is the AI's choice, ignored when a forced action
 * (stasis, smoke, mirror) applies.
 */
export function enemyAct(prev: CombatState, aiMove: { from: Square; to: Square; promotion?: string } | null, forced: ForcedEnemy, rng: () => number): CombatState {
  if (prev.phase !== 'enemy') return prev;
  const s = clone(prev);
  s.pendingEnemy = null;
  const psq = playerSquare(prev);
  const isKing = prev.playerType === 'k';

  if (forced?.kind === 'skip') {
    s.fen = setTurn(prev.fen, 'w');
    log(s, 'The board is frozen. The enemy loses its turn.', 'info');
    return endEnemyTurn(s, rng);
  }
  if (forced?.kind === 'mirrorJump') {
    s.fen = relocate(prev.fen, forced.from, forced.to, s.baseType === 'k' ? 'k' : (boardFromFen(prev.fen).find((p) => p.sq === forced.from)?.type ?? 'p'), 'w');
    // relocate() paints the piece white — repaint it black.
    s.fen = editFen(s.fen, (ps) => ps.map((p) => (p.sq === forced.to ? { ...p, color: 'b' } : p)), 'w');
    s.ids = relocateIds(prev.ids, forced.from, forced.to).ids;
    s.lastMove = { from: forced.from, to: forced.to };
    pushFx(s, 'mirror', 'bad', forced.to, 'MIRRORED');
    log(s, `The Mirror copies your ability: ${forced.from} → ${forced.to}.`, 'enemy');
    return endEnemyTurn(s, rng);
  }

  let move = forced?.kind === 'move' ? forced.move : aiMove;
  if (!move) {
    const legal = enemyMoves(prev.fen, psq, ruleMods(prev));
    move = legal[Math.floor(rng() * legal.length)];
  }
  if (forced?.kind === 'move' && forced.reason === 'smoke') log(s, 'Blinded by smoke, the enemy stumbles.', 'info');
  if (forced?.kind === 'move' && forced.reason === 'mirror') {
    pushFx(s, 'mirror', 'bad', move.to);
    log(s, `The Mirror answers: ${move.from} → ${move.to}.`, 'enemy');
  }

  // Would this capture the player?
  if (!isKing && move.to === psq) {
    const d = defend(s, move.from, rng);
    if (d) return endEnemyTurn(s, rng);
  }

  const { fen, move: played } = applyMove(prev.fen, { from: move.from, to: move.to, promotion: (move.promotion ?? 'q') as PieceSymbol });
  const moved = moveIds(prev.ids, played);
  s.fen = fen;
  s.ids = moved.ids;
  s.lastMove = { from: played.from, to: played.to };
  const pieceName = PIECE_NAMES[played.piece ?? 'p'];
  if (moved.capturedId === s.playerId) {
    // The attacker now stands on the player's old square; the player id is off the board until respawn.
    log(s, `The ${pieceName} captures you on ${played.to}!`, 'bad');
    takeHit(s, played.to, rng);
    if (s.phase === 'lost') return s;
    return endEnemyTurn(s, rng);
  }
  if (moved.capturedId !== null && moved.capturedId === s.allyId) {
    log(s, `The ${pieceName} captures your ally on ${played.to}. Objective failed.`, 'bad');
    pushFx(s, 'capture', 'bad', played.to);
    return fail(s, rng);
  }
  if (played.promotion) log(s, `An enemy pawn promotes to a ${PIECE_NAMES[played.promotion]} on ${played.to}.`, 'enemy');
  else log(s, `${pieceName} ${played.from} → ${played.to}${played.captured ? ' (capture)' : ''}.`, 'enemy');

  // King player: checkmate is the only way to get hurt.
  if (isKing && playerMoves(s.fen, psq, ruleMods(s)).length === 0 && isInCheck(s.fen, 'w')) {
    // Parry against checkmate undoes the mating move.
    const d = defend(s, played.to, rng, { fen: prev.fen, ids: prev.ids });
    if (!d) {
      log(s, 'Checkmate! You are overwhelmed.', 'bad');
      takeHit(s, psq, rng);
      if (s.phase === 'lost') return s;
    }
    return endEnemyTurn(s, rng);
  }
  if (isKing && isInCheck(s.fen, 'w')) {
    pushFx(s, 'check', 'bad', psq, 'CHECK');
    log(s, 'You are in check!', 'bad');
  }

  if (s.enc.objective.kind === 'kingMove' && played.piece === 'k') {
    s.turn++;
    log(s, 'The enemy king has been forced to move!', 'good');
    return win(s, 'objective');
  }
  return endEnemyTurn(s, rng);
}

function fail(s: CombatState, rng: () => number): CombatState {
  s.phase = 'lost';
  s.outcome = 'failed';
  s.hp -= 1;
  s.hitsTaken++;
  if (s.hp <= 0 && (s.charges.second_life ?? 0) > 0) {
    s.charges.second_life = (s.charges.second_life ?? 1) - 1;
    s.hp = 1;
    log(s, 'Second Life: you refuse to fall!', 'good');
  }
  if (s.hp <= 0) s.outcome = 'dead';
  void rng;
  return s;
}

function endEnemyTurn(s: CombatState, rng: () => number): CombatState {
  s.turn++;
  const o = s.enc.objective;
  if ((o.kind === 'survive' || o.kind === 'protect') && s.turn >= o.turns) {
    log(s, `You survived ${s.turn} turns.`, 'good');
    return win(s, 'objective');
  }
  if ('limit' in o && s.turn >= o.limit) {
    log(s, 'Time is up. Objective failed (-1 HP).', 'bad');
    return fail(s, rng);
  }
  const psq = playerSquare(s);
  if (playerMoves(s.fen, psq, ruleMods(s)).length === 0) {
    log(s, 'You have no legal moves — stalemate. The battle ends in a draw.', 'info');
    return win(s, 'stalemate');
  }
  s.phase = 'player';
  return s;
}

/** Quick danger summary for the HUD. */
export function dangerInfo(s: CombatState): { attackers: Square[]; inDanger: boolean } {
  if (s.phase === 'won' || s.phase === 'lost') return { attackers: [], inDanger: false };
  const psq = playerSquare(s);
  const mods = ruleMods(s);
  if (s.playerType === 'k') {
    const attackers = new FastBoard(s.fen).attackers('b', to0x88(psq)) as Square[];
    return { attackers, inDanger: attackers.length > 0 };
  }
  const probe = s.fen.split(' ')[1] === 'b' ? s.fen : setTurn(s.fen, 'b');
  const attackers = capturersOf(probe, psq, mods);
  return { attackers, inDanger: attackers.length > 0 };
}

/** Values written back to the run when the battle ends. */
export function runChargesAfter(s: CombatState): Partial<Record<UpgradeId, number>> {
  const out: Partial<Record<UpgradeId, number>> = {};
  for (const id of Object.keys(s.charges) as UpgradeId[]) if (UPGRADES[id].scope === 'run') out[id] = s.charges[id];
  return out;
}
