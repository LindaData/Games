import type { PieceSymbol, Square } from 'chess.js';
import type { UpgradeId } from './upgrades';

export interface CharacterDef {
  type: PieceSymbol;
  name: string;
  title: string;
  maxHp: number;
  startSquares: Square[];
  blurb: string;
  perk: string;
  unlockCost: number;
  /** Signature upgrade the piece starts every run with. */
  signature: UpgradeId | null;
}

export const CHARACTERS: Record<PieceSymbol, CharacterDef> = {
  p: {
    type: 'p',
    name: 'Pawn',
    title: 'The Foot Soldier',
    maxHp: 4,
    startSquares: ['e2', 'd2'],
    blurb: 'Slow, stubborn and underestimated. Dreams of the eighth rank.',
    perk: "Starts with Reinforced Armor: enemy pawns can't capture you on your own half. Promotes on the last rank.",
    signature: 'reinforced_armor',
    unlockCost: 0,
  },
  n: {
    type: 'n',
    name: 'Knight',
    title: 'The Wanderer',
    maxHp: 4,
    startSquares: ['g1', 'b1'],
    blurb: 'Leaps over walls of pawns. Never where the enemy expects.',
    perk: "Starts with Knight's Instinct: dodges one capture every 3 battles.",
    signature: 'knights_instinct',
    unlockCost: 0,
  },
  b: {
    type: 'b',
    name: 'Bishop',
    title: 'The Zealot',
    maxHp: 4,
    startSquares: ['c1', 'f1'],
    blurb: 'Fast on the diagonals, blind to half the board.',
    perk: 'Starts with Ghost Move: once per run, slide up to 3 squares through pieces.',
    signature: 'ghost_move',
    unlockCost: 40,
  },
  r: {
    type: 'r',
    name: 'Rook',
    title: 'The Siege Tower',
    maxHp: 3,
    startSquares: ['a1', 'h1'],
    blurb: 'Straight lines, heavy strikes. Owns open files.',
    perk: 'Starts with Parry: shrug off one capture every 2 battles.',
    signature: 'parry',
    unlockCost: 80,
  },
  q: {
    type: 'q',
    name: 'Queen',
    title: 'The Tyrant',
    maxHp: 2,
    startSquares: ['d1'],
    blurb: 'Everything moves for her. Everything hunts her.',
    perk: 'Moves anywhere — but only 2 HP and no signature upgrade.',
    signature: null,
    unlockCost: 150,
  },
  k: {
    type: 'k',
    name: 'King',
    title: 'The Exile',
    maxHp: 3,
    startSquares: ['e1'],
    blurb: 'A deposed king alone on the board. Cannot be captured — only checkmated.',
    perk: 'Only checkmate hurts you. Starts with Time Warp (every 3 battles) to undo a mistake.',
    signature: 'time_warp',
    unlockCost: 220,
  },
};

export const PIECE_NAMES: Record<PieceSymbol, string> = {
  p: 'Pawn',
  n: 'Knight',
  b: 'Bishop',
  r: 'Rook',
  q: 'Queen',
  k: 'King',
};
