/** Run state and roguelike progression: map travel, rewards, shops, rests, events, acts. */
import type { PieceSymbol } from 'chess.js';
import { createRng, randInt, shuffle, weightedPick, type Rng } from '../core/rng';
import { createCombat, runChargesAfter, type CombatState, type Outcome } from './combat';
import { generateEncounter } from './encounters';
import { eventById, randomEvent } from './events';
import { generateMap, nodeById, type ActMap } from './map';
import type { MetaState, ModeId } from './meta';
import { CHARACTERS } from './pieces';
import { RARITY_PRICE, RARITY_WEIGHT, UPGRADES, type Rarity, type UpgradeId } from './upgrades';

export type Screen = 'map' | 'combat' | 'reward' | 'shop' | 'event' | 'rest' | 'treasure' | 'forge' | 'gameover' | 'victory';

export interface RewardState {
  title: string;
  outcome: Outcome;
  gold: number;
  heal: number;
  choices: UpgradeId[];
  bossCleared: boolean;
  lines: string[];
}

export type ShopItem = { kind: 'upgrade'; id: UpgradeId; price: number; sold: boolean } | { kind: 'heal'; price: number; sold: boolean };

export interface RunState {
  version: 1;
  seed: number;
  step: number;
  piece: PieceSymbol;
  mode: ModeId;
  act: number;
  map: ActMap;
  nodeId: string | null;
  visited: string[];
  hp: number;
  maxHp: number;
  gold: number;
  owned: Partial<Record<UpgradeId, number>>;
  runCharges: Partial<Record<UpgradeId, number>>;
  unlocked: UpgradeId[];
  stats: { battlesWon: number; elitesWon: number; bossesWon: number; turns: number; captures: number; checkmates: number };
  screen: Screen;
  combat?: CombatState;
  reward?: RewardState;
  shop?: ShopItem[];
  event?: { id: string; result?: string };
  forge?: UpgradeId[];
  treasure?: { gold: number; upgrade: UpgradeId | null };
  restDone?: string;
  startedAt: number;
  endedAt?: number;
  insightEarned?: number;
}

export const ACTS_TO_WIN = 3;

export function rngFor(run: RunState, salt: number): Rng {
  return createRng((run.seed ^ (run.step * 2654435761) ^ (salt * 40503)) >>> 0);
}

function bump(run: RunState): RunState {
  return { ...run, step: run.step + 1 };
}

export function newRun(piece: PieceSymbol, mode: ModeId, meta: MetaState, seed: number): RunState {
  const maxHp = mode === 'hardcore' ? 1 : CHARACTERS[piece].maxHp;
  const run: RunState = {
    version: 1,
    seed,
    step: 0,
    piece,
    mode,
    act: 1,
    map: generateMap(seed, 1),
    nodeId: null,
    visited: [],
    hp: maxHp,
    maxHp,
    gold: 0,
    owned: {},
    runCharges: {},
    unlocked: [...meta.upgrades],
    stats: { battlesWon: 0, elitesWon: 0, bossesWon: 0, turns: 0, captures: 0, checkmates: 0 },
    screen: 'map',
    startedAt: Date.now(),
  };
  const sig = CHARACTERS[piece].signature;
  return sig ? addUpgrade(run, sig) : run;
}

// ---------------------------------------------------------------------------
// Upgrades
// ---------------------------------------------------------------------------

const RARITY_RANK: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2 };

export function offerUpgrades(run: RunState, rng: Rng, count: number, minRarity: Rarity = 'common'): UpgradeId[] {
  const pool = run.unlocked.filter((id) => {
    const d = UPGRADES[id];
    if (!d) return false;
    if (!d.stackable && run.owned[id]) return false;
    if (d.pieces && !d.pieces.includes(run.piece)) return false;
    if (RARITY_RANK[d.rarity] < RARITY_RANK[minRarity]) return false;
    return true;
  });
  const out: UpgradeId[] = [];
  let candidates = shuffle(rng, pool);
  while (out.length < count && candidates.length) {
    const id = weightedPick(rng, candidates.map((c) => ({ item: c, weight: RARITY_WEIGHT[UPGRADES[c].rarity] })));
    out.push(id);
    candidates = candidates.filter((c) => c !== id);
  }
  return out;
}

export function addUpgrade(run: RunState, id: UpgradeId): RunState {
  const d = UPGRADES[id];
  const next: RunState = { ...run, owned: { ...run.owned, [id]: (run.owned[id] ?? 0) + 1 }, runCharges: { ...run.runCharges } };
  if (id === 'iron_heart') {
    next.maxHp += 1;
    next.hp = Math.min(next.maxHp, next.hp + 1);
  }
  if (d.scope === 'run') next.runCharges[id] = (next.runCharges[id] ?? 0) + 1;
  return next;
}

// ---------------------------------------------------------------------------
// Map travel
// ---------------------------------------------------------------------------

export function loopOf(act: number): number {
  return Math.floor((act - 1) / ACTS_TO_WIN);
}

export function enterNode(prev: RunState, nodeId: string): RunState {
  const node = nodeById(prev.map, nodeId);
  if (!node) return prev;
  let run: RunState = bump({ ...prev, nodeId, visited: [...prev.visited, nodeId], restDone: undefined, event: undefined });
  const rng = rngFor(run, node.floor * 17 + node.lane);
  switch (node.kind) {
    case 'battle':
    case 'elite':
    case 'boss': {
      const enc = generateEncounter({
        rng,
        piece: run.piece,
        kind: node.kind,
        boss: node.boss,
        tier: run.stats.battlesWon,
        act: run.act,
        loop: loopOf(run.act),
        swift: !!run.owned.swift,
      });
      const combat = createCombat({ enc, piece: run.piece, hp: run.hp, maxHp: run.maxHp, owned: run.owned, runCharges: run.runCharges });
      return { ...run, screen: 'combat', combat };
    }
    case 'event':
      return { ...run, screen: 'event', event: { id: randomEvent(rng).id } };
    case 'shop': {
      const ups = offerUpgrades(run, rng, 3);
      const items: ShopItem[] = ups.map((id) => ({ kind: 'upgrade', id, price: RARITY_PRICE[UPGRADES[id].rarity] + randInt(rng, -5, 10), sold: false }));
      items.push({ kind: 'heal', price: 35, sold: false });
      return { ...run, screen: 'shop', shop: items };
    }
    case 'rest':
      return { ...run, screen: 'rest' };
    case 'treasure': {
      const [upgrade] = offerUpgrades(run, rng, 1, 'uncommon');
      return { ...run, screen: 'treasure', treasure: { gold: randInt(rng, 30, 55), upgrade: upgrade ?? null } };
    }
    case 'upgrade':
      return { ...run, screen: 'forge', forge: offerUpgrades(run, rng, 3, 'uncommon') };
  }
  run = { ...run, screen: 'map' };
  return run;
}

// ---------------------------------------------------------------------------
// Combat results
// ---------------------------------------------------------------------------

export function syncCombat(run: RunState, combat: CombatState): RunState {
  return { ...run, combat };
}

export function finishCombat(prev: RunState): RunState {
  const c = prev.combat;
  if (!c || (c.phase !== 'won' && c.phase !== 'lost')) return prev;
  let run: RunState = bump({
    ...prev,
    hp: Math.max(0, c.hp),
    runCharges: { ...prev.runCharges, ...runChargesAfter(c) },
    stats: {
      ...prev.stats,
      turns: prev.stats.turns + c.turn,
      captures: prev.stats.captures + c.captures,
      checkmates: prev.stats.checkmates + (c.outcome === 'checkmate' ? 1 : 0),
    },
  });
  if (c.outcome === 'dead' || run.hp <= 0) return endRun({ ...run, hp: 0 }, false);

  const enc = c.enc;
  if (c.phase === 'lost') {
    run.reward = { title: 'Objective Failed', outcome: c.outcome!, gold: 0, heal: 0, choices: [], bossCleared: false, lines: ['You escape the board, bruised. -1 HP.', 'No spoils this time.'] };
    if (enc.kind === 'boss') {
      // Failing a boss objective: the boss must still be beaten — retry it.
      run.reward.lines = ['The boss still bars the way. You must face it again.'];
    }
    return { ...run, screen: 'reward', combat: undefined };
  }

  const rng = rngFor(run, 991);
  const lines: string[] = [];
  let gold = enc.gold;
  if (c.outcome === 'stalemate') {
    gold = Math.floor(gold / 2);
    lines.push('Stalemate: half gold.');
  }
  if (c.outcome === 'checkmate') {
    gold += 40;
    lines.push('Checkmate bonus: +40 gold.');
  }
  if (c.outcome === 'slain') {
    gold += 60;
    lines.push('You slew the Immortal: +60 gold.');
  }
  if (run.owned.scholar) gold = Math.floor(gold * 1.5);
  if (run.owned.bounty && c.captures) {
    const b = c.captures * 8 * (run.owned.bounty ?? 1);
    gold += b;
    lines.push(`Bounty: +${b} gold.`);
  }
  if (c.hitsTaken === 0) {
    gold += 10;
    lines.push('Flawless: +10 gold.');
  }
  const heal = enc.kind === 'boss' ? 2 : 0;
  const minRarity: Rarity = enc.kind === 'boss' ? 'rare' : enc.kind === 'elite' ? 'uncommon' : 'common';
  const choices = offerUpgrades(run, rng, 3, minRarity);
  run = {
    ...run,
    gold: run.gold + gold,
    hp: Math.min(run.maxHp, run.hp + heal),
    stats: {
      ...run.stats,
      battlesWon: run.stats.battlesWon + 1,
      elitesWon: run.stats.elitesWon + (enc.kind === 'elite' ? 1 : 0),
      bossesWon: run.stats.bossesWon + (enc.kind === 'boss' ? 1 : 0),
    },
  };
  const title = c.outcome === 'checkmate' ? 'Checkmate!' : c.outcome === 'stalemate' ? 'Draw — You Escaped' : c.outcome === 'slain' ? 'The Immortal Falls' : 'Victory';
  return { ...run, screen: 'reward', combat: undefined, reward: { title, outcome: c.outcome!, gold, heal, choices, bossCleared: enc.kind === 'boss', lines } };
}

export function claimReward(prev: RunState, pick: UpgradeId | null): RunState {
  const r = prev.reward;
  if (!r) return prev;
  let run: RunState = { ...prev, reward: undefined };
  if (pick) run = addUpgrade(run, pick);
  if (r.bossCleared) return advanceAct(run);
  const node = prev.nodeId ? nodeById(prev.map, prev.nodeId) : undefined;
  if (node?.kind === 'boss' && r.outcome === 'failed') {
    // Retry the boss.
    return enterNode({ ...run, visited: run.visited.slice(0, -1) }, node.id);
  }
  return { ...run, screen: 'map' };
}

function advanceAct(run: RunState): RunState {
  const act = run.act + 1;
  if (act > ACTS_TO_WIN && run.mode !== 'endless') return endRun(run, true);
  return bump({ ...run, act, map: generateMap(run.seed, act), nodeId: null, visited: [], screen: 'map', hp: run.maxHp });
}

// ---------------------------------------------------------------------------
// Non-combat nodes
// ---------------------------------------------------------------------------

export function buyItem(run: RunState, index: number): RunState {
  const item = run.shop?.[index];
  if (!item || item.sold || run.gold < item.price) return run;
  if (item.kind === 'heal' && run.hp >= run.maxHp) return run;
  const shop = run.shop!.map((it, i) => (i === index ? { ...it, sold: true } : it));
  let next: RunState = { ...run, gold: run.gold - item.price, shop };
  if (item.kind === 'heal') next = { ...next, hp: Math.min(next.maxHp, next.hp + 1) };
  else next = addUpgrade(next, item.id);
  return next;
}

export function restAction(run: RunState, action: 'heal' | 'train'): RunState {
  if (run.restDone) return run;
  if (action === 'heal') {
    const amount = Math.max(2, Math.ceil(run.maxHp / 2));
    return { ...run, hp: Math.min(run.maxHp, run.hp + amount), restDone: `You rest by the fire. +${Math.min(amount, run.maxHp - run.hp)} HP.` };
  }
  const [id] = offerUpgrades(run, rngFor(run, 77), 1, 'common');
  if (!id) return { ...run, restDone: 'You drill your footwork, but learn nothing new.' };
  return { ...addUpgrade(run, id), restDone: `You train through the night and learn ${UPGRADES[id].name}.` };
}

export function takeTreasure(run: RunState): RunState {
  const t = run.treasure;
  if (!t) return { ...run, screen: 'map' };
  let next: RunState = { ...run, gold: run.gold + t.gold, treasure: undefined, screen: 'map' };
  if (t.upgrade) next = addUpgrade(next, t.upgrade);
  return next;
}

export function forgePick(run: RunState, id: UpgradeId | null): RunState {
  const next = id ? addUpgrade(run, id) : run;
  return { ...next, forge: undefined, screen: 'map' };
}

export function eventChoose(run: RunState, index: number): RunState {
  if (!run.event || run.event.result) return run;
  const ev = eventById(run.event.id);
  const opt = ev.options[index];
  if (!opt || (opt.available && !opt.available(run))) return run;
  const { run: after, result } = opt.apply(run, rngFor(run, 555));
  const next = { ...after, event: { id: ev.id, result } };
  if (next.hp <= 0) return endRun({ ...next, hp: 0 }, false);
  return next;
}

export function leaveNode(run: RunState): RunState {
  return { ...run, screen: 'map', event: undefined, shop: undefined, restDone: undefined };
}

// ---------------------------------------------------------------------------
// End of run
// ---------------------------------------------------------------------------

export function computeInsight(run: RunState, victory: boolean): number {
  const s = run.stats;
  let insight = s.battlesWon * 4 + s.elitesWon * 8 + s.bossesWon * 20 + Math.floor(s.turns / 4) + s.checkmates * 5 + (victory ? 40 : 0);
  if (run.mode === 'hardcore') insight *= 2;
  return insight;
}

function endRun(run: RunState, victory: boolean): RunState {
  return { ...run, screen: victory ? 'victory' : 'gameover', combat: run.combat, endedAt: Date.now(), insightEarned: computeInsight(run, victory) };
}

export function applyRunToMeta(meta: MetaState, run: RunState): MetaState {
  const victory = run.screen === 'victory';
  return {
    ...meta,
    insight: meta.insight + (run.insightEarned ?? 0),
    stats: {
      runs: meta.stats.runs + 1,
      wins: meta.stats.wins + (victory ? 1 : 0),
      bestBattles: Math.max(meta.stats.bestBattles, run.stats.battlesWon),
      bestAct: Math.max(meta.stats.bestAct, run.act),
      totalCaptures: meta.stats.totalCaptures + run.stats.captures,
    },
  };
}
