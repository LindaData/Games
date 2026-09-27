/**
 * Upgrade catalogue. Upgrades are pure data; their effects are implemented where the
 * relevant rule lives (combat.ts for battle effects, run.ts for economy effects).
 *
 * Scope:
 *  - 'run'        : charges are consumed and never refilled during the run
 *  - 'encounter'  : one charge per battle; if `recharge` is set, after it is used the
 *                   upgrade sits out the next `recharge - 1` battles
 *  - 'passive'    : always on
 *
 * Tuning goal: every upgrade is a slight edge, never a get-out-of-jail card.
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
  /** Usable at most once every N battles. */
  recharge?: number;
}

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  second_life: {
    id: 'second_life', name: 'Second Life', icon: 'heart-pulse', rarity: 'rare', scope: 'run', active: false, stackable: false, unlockCost: 0,
    desc: 'The first time a capture would drop you to 0 HP, survive with 1 HP instead. Consumed on use.',
  },
  ghost_move: {
    id: 'ghost_move', name: 'Ghost Move', icon: 'ghost', rarity: 'uncommon', scope: 'run', active: true, stackable: true, unlockCost: 0,
    desc: 'Once per run: slide up to 3 squares through occupied squares (leapers: up to 2). Must land on an empty square.',
  },
  knights_instinct: {
    id: 'knights_instinct', name: "Knight's Instinct", icon: 'zap', rarity: 'rare', scope: 'encounter', active: false, stackable: false, unlockCost: 0, recharge: 3,
    desc: 'Once every 3 battles: the first capture against you is dodged — you leap to a safe square.',
  },
  reinforced_armor: {
    id: 'reinforced_armor', name: 'Reinforced Armor', icon: 'shield', rarity: 'uncommon', scope: 'passive', active: false, stackable: false, unlockCost: 0,
    desc: 'Enemy pawns cannot capture you while you stand on your own half of the board (ranks 1–4).',
  },
  time_warp: {
    id: 'time_warp', name: 'Time Warp', icon: 'rewind', rarity: 'rare', scope: 'encounter', active: true, stackable: false, unlockCost: 60, recharge: 3,
    desc: 'Once every 3 battles: rewind one full turn — your last move and the enemy reply are undone.',
  },
  promotion: {
    id: 'promotion', name: 'Borrowed Crown', icon: 'crown', rarity: 'uncommon', scope: 'encounter', active: true, stackable: false, unlockCost: 0, recharge: 2,
    desc: 'Once every 2 battles: for one move, move as a Knight, Bishop or Rook.',
  },
  teleport: {
    id: 'teleport', name: 'Teleport', icon: 'sparkles', rarity: 'rare', scope: 'encounter', active: true, stackable: false, unlockCost: 0, recharge: 3,
    desc: 'Once every 3 battles: jump to any empty square within 3 squares of you.',
  },
  parry: {
    id: 'parry', name: 'Parry', icon: 'swords', rarity: 'uncommon', scope: 'encounter', active: false, stackable: false, unlockCost: 0, recharge: 2,
    desc: 'Once every 2 battles: survive a capture. The attacker is knocked back and loses its turn.',
  },
  riposte: {
    id: 'riposte', name: 'Riposte', icon: 'sword', rarity: 'rare', scope: 'passive', active: false, stackable: false, unlockCost: 90,
    desc: 'When you Parry or dodge, an attacking pawn, knight or bishop is destroyed.',
  },
  iron_heart: {
    id: 'iron_heart', name: 'Iron Heart', icon: 'heart', rarity: 'common', scope: 'passive', active: false, stackable: true, unlockCost: 0,
    desc: '+1 max HP (no heal).',
  },
  stasis: {
    id: 'stasis', name: 'Stasis', icon: 'snowflake', rarity: 'uncommon', scope: 'encounter', active: true, stackable: false, unlockCost: 40, recharge: 2,
    desc: 'Once every 2 battles: the enemy skips its next turn. (Not while the enemy king is in check.)',
  },
  smoke_bomb: {
    id: 'smoke_bomb', name: 'Smoke Bomb', icon: 'cloud-fog', rarity: 'common', scope: 'encounter', active: true, stackable: false, unlockCost: 30,
    desc: "Once per battle: the enemy's next move is chosen at random (it can still capture you).",
  },
  bloodlust: {
    id: 'bloodlust', name: 'Bloodlust', icon: 'droplet', rarity: 'uncommon', scope: 'encounter', active: false, stackable: false, unlockCost: 50,
    desc: 'Once per battle: capturing a Rook or Queen heals 1 HP.',
  },
  bounty: {
    id: 'bounty', name: 'Bounty Hunter', icon: 'coins', rarity: 'common', scope: 'passive', active: false, stackable: true, unlockCost: 0,
    desc: '+4 gold for every enemy piece you capture.',
  },
  swift: {
    id: 'swift', name: 'Swift Feet', icon: 'footprints', rarity: 'common', scope: 'passive', active: false, stackable: false, unlockCost: 0,
    desc: 'Survival objectives require 1 fewer turn.',
  },
  scholar: {
    id: 'scholar', name: 'Opening Theory', icon: 'book-open', rarity: 'common', scope: 'passive', active: false, stackable: false, unlockCost: 0,
    desc: '+20% gold from battles.',
  },
};

export const ACTIVE_ORDER: UpgradeId[] = ['teleport', 'ghost_move', 'promotion', 'time_warp', 'stasis', 'smoke_bomb'];

export const RARITY_WEIGHT: Record<Rarity, number> = { common: 55, uncommon: 32, rare: 13 };
export const RARITY_PRICE: Record<Rarity, number> = { common: 45, uncommon: 75, rare: 120 };
