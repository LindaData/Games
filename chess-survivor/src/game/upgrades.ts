/**
 * Upgrade catalogue. Upgrades are pure data; their effects are implemented where the
 * relevant rule lives (combat.ts for battle effects, run.ts for economy effects).
 *
 * Scope:
 *  - 'run'        : charges are consumed and never refilled during the run
 *  - 'encounter'  : charges refill at the start of every battle
 *  - 'passive'    : always on
 */
import type { PieceSymbol } from 'chess.js';

export type UpgradeId =
  | 'second_life'
  | 'ghost_move'
  | 'knights_instinct'
  | 'reinforced_armor'
  | 'time_warp'
  | 'promotion'
  | 'teleport'
  | 'parry'
  | 'riposte'
  | 'iron_heart'
  | 'stasis'
  | 'smoke_bomb'
  | 'bloodlust'
  | 'bounty'
  | 'swift'
  | 'scholar';

export type Rarity = 'common' | 'uncommon' | 'rare';
export type Scope = 'run' | 'encounter' | 'passive';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  desc: string;
  rarity: Rarity;
  scope: Scope;
  /** Active upgrades are triggered by the player from the ability bar. */
  active: boolean;
  /** Needs a meta-progression unlock before it can appear in runs. */
  unlockCost: number;
  icon: string;
  /** Restrict which pieces can be offered this upgrade. */
  pieces?: PieceSymbol[];
  /** Can be picked more than once (adds charges / stacks). */
  stackable: boolean;
}

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  second_life: {
    id: 'second_life', name: 'Second Life', icon: 'heart-pulse', rarity: 'rare', scope: 'run', active: false, stackable: true, unlockCost: 0,
    desc: 'The first time a capture would drop you to 0 HP, survive with 1 HP instead. Consumed on use.',
  },
  ghost_move: {
    id: 'ghost_move', name: 'Ghost Move', icon: 'ghost', rarity: 'uncommon', scope: 'run', active: true, stackable: true, unlockCost: 0,
    desc: 'Once per run: move through occupied squares. Sliders ignore blockers; others may step up to 2 squares in any direction.',
  },
  knights_instinct: {
    id: 'knights_instinct', name: "Knight's Instinct", icon: 'zap', rarity: 'rare', scope: 'encounter', active: false, stackable: false, unlockCost: 0,
    desc: 'The first capture against you in each battle is dodged automatically — you leap to a safe square.',
  },
  reinforced_armor: {
    id: 'reinforced_armor', name: 'Reinforced Armor', icon: 'shield', rarity: 'uncommon', scope: 'passive', active: false, stackable: false, unlockCost: 0,
    desc: 'Enemy pawns cannot capture you.',
  },
  time_warp: {
    id: 'time_warp', name: 'Time Warp', icon: 'rewind', rarity: 'rare', scope: 'encounter', active: true, stackable: false, unlockCost: 60,
    desc: 'Once per battle: rewind time one full turn — your last move and the enemy reply are undone.',
  },
  promotion: {
    id: 'promotion', name: 'Borrowed Crown', icon: 'crown', rarity: 'uncommon', scope: 'encounter', active: true, stackable: true, unlockCost: 0,
    desc: "Once per battle: for one move, move as a Knight, Bishop, Rook or Queen. A pawn's dream come true.",
  },
  teleport: {
    id: 'teleport', name: 'Teleport', icon: 'sparkles', rarity: 'rare', scope: 'encounter', active: true, stackable: false, unlockCost: 0,
    desc: 'Once per battle: move to any empty square on the board.',
  },
  parry: {
    id: 'parry', name: 'Parry', icon: 'swords', rarity: 'uncommon', scope: 'encounter', active: false, stackable: true, unlockCost: 0,
    desc: 'Once per battle: survive an otherwise fatal capture. The attacker is knocked back and loses its turn.',
  },
  riposte: {
    id: 'riposte', name: 'Riposte', icon: 'sword', rarity: 'rare', scope: 'passive', active: false, stackable: false, unlockCost: 90,
    desc: 'When you Parry or dodge, the attacking piece is destroyed (kings excepted).',
  },
  iron_heart: {
    id: 'iron_heart', name: 'Iron Heart', icon: 'heart', rarity: 'common', scope: 'passive', active: false, stackable: true, unlockCost: 0,
    desc: '+1 max HP and heal 1.',
  },
  stasis: {
    id: 'stasis', name: 'Stasis', icon: 'snowflake', rarity: 'uncommon', scope: 'encounter', active: true, stackable: false, unlockCost: 40,
    desc: 'Once per battle: freeze the board — the enemy skips its next turn. (Not while the enemy king is in check.)',
  },
  smoke_bomb: {
    id: 'smoke_bomb', name: 'Smoke Bomb', icon: 'cloud-fog', rarity: 'common', scope: 'encounter', active: true, stackable: false, unlockCost: 30,
    desc: 'Once per battle: blind the enemy — its next move is chosen at random.',
  },
  bloodlust: {
    id: 'bloodlust', name: 'Bloodlust', icon: 'droplet', rarity: 'uncommon', scope: 'encounter', active: false, stackable: false, unlockCost: 50,
    desc: 'Your first capture each battle heals 1 HP.',
  },
  bounty: {
    id: 'bounty', name: 'Bounty Hunter', icon: 'coins', rarity: 'common', scope: 'passive', active: false, stackable: true, unlockCost: 0,
    desc: '+8 gold for every enemy piece you capture.',
  },
  swift: {
    id: 'swift', name: 'Swift Feet', icon: 'footprints', rarity: 'common', scope: 'passive', active: false, stackable: false, unlockCost: 0,
    desc: 'Survival objectives require 2 fewer turns.',
  },
  scholar: {
    id: 'scholar', name: 'Opening Theory', icon: 'book-open', rarity: 'common', scope: 'passive', active: false, stackable: false, unlockCost: 0,
    desc: '+50% gold from battles.',
  },
};

export const ACTIVE_ORDER: UpgradeId[] = ['teleport', 'ghost_move', 'promotion', 'time_warp', 'stasis', 'smoke_bomb'];

export const RARITY_WEIGHT: Record<Rarity, number> = { common: 55, uncommon: 32, rare: 13 };
export const RARITY_PRICE: Record<Rarity, number> = { common: 45, uncommon: 75, rare: 120 };
