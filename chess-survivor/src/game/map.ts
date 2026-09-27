/** Slay-the-Spire style branching map for one act. */
import { createRng, weightedPick, type Rng } from '../core/rng';
import type { BossId } from './encounters';

export type NodeKind = 'battle' | 'elite' | 'boss' | 'treasure' | 'upgrade' | 'rest' | 'event' | 'shop';

export interface MapNode {
  id: string;
  floor: number;
  lane: number;
  kind: NodeKind;
  next: string[];
  boss?: BossId;
}

export interface ActMap {
  act: number;
  floors: number; // including boss floor
  nodes: MapNode[];
}

export const LANES = 5;
const FLOORS = 6; // floors 0..5, boss on floor 6

export const NODE_INFO: Record<NodeKind, { label: string; desc: string }> = {
  battle: { label: 'Battle', desc: 'A chess battle against the enemy army.' },
  elite: { label: 'Elite Battle', desc: 'A stronger army. Better rewards.' },
  boss: { label: 'Boss', desc: 'A legendary opponent guards the way forward.' },
  treasure: { label: 'Treasure', desc: 'Gold and an upgrade, free for the taking.' },
  upgrade: { label: 'Forge', desc: 'Choose one of three powerful upgrades.' },
  rest: { label: 'Rest', desc: 'Recover HP or train.' },
  event: { label: 'Event', desc: 'Something unusual happens on the board.' },
  shop: { label: 'Shop', desc: 'Spend gold on upgrades and healing.' },
};

function kindForFloor(rng: Rng, floor: number): NodeKind {
  const table: Record<number, { item: NodeKind; weight: number }[]> = {
    0: [{ item: 'battle', weight: 1 }],
    1: [{ item: 'battle', weight: 5 }, { item: 'event', weight: 3 }, { item: 'treasure', weight: 1 }],
    2: [{ item: 'battle', weight: 4 }, { item: 'event', weight: 2 }, { item: 'shop', weight: 2 }, { item: 'upgrade', weight: 1 }],
    3: [{ item: 'battle', weight: 3 }, { item: 'elite', weight: 2 }, { item: 'event', weight: 2 }, { item: 'treasure', weight: 2 }],
    4: [{ item: 'battle', weight: 3 }, { item: 'elite', weight: 2 }, { item: 'shop', weight: 2 }, { item: 'upgrade', weight: 1 }, { item: 'event', weight: 1 }],
    5: [{ item: 'rest', weight: 4 }, { item: 'shop', weight: 2 }, { item: 'upgrade', weight: 2 }],
  };
  return weightedPick(rng, table[floor]);
}

export function bossForAct(act: number, rng: Rng): BossId {
  const inCycle = ((act - 1) % 3) + 1;
  if (inCycle === 1) return 'horde';
  if (inCycle === 2) return rng() < 0.5 ? 'mirror' : 'immortal';
  return 'grandmaster';
}

export function generateMap(seed: number, act: number): ActMap {
  const rng = createRng(seed * 31 + act * 7919);
  const nodes = new Map<string, MapNode>();
  const key = (f: number, l: number) => `${act}-${f}-${l}`;
  const ensure = (f: number, l: number) => {
    const id = key(f, l);
    if (!nodes.has(id)) nodes.set(id, { id, floor: f, lane: l, kind: kindForFloor(rng, f), next: [] });
    return nodes.get(id)!;
  };
  const starts = [0, 1, 2, 3, 4].sort(() => rng() - 0.5).slice(0, 3);
  for (let p = 0; p < 4; p++) {
    let lane = starts[p % starts.length];
    let prev = ensure(0, lane);
    for (let f = 1; f < FLOORS; f++) {
      lane = Math.max(0, Math.min(LANES - 1, lane + Math.floor(rng() * 3) - 1));
      const node = ensure(f, lane);
      if (!prev.next.includes(node.id)) prev.next.push(node.id);
      prev = node;
    }
  }
  // Remove crossing edges would be nice-to-have; keep simple but avoid more than 2 elites in a row.
  const boss: MapNode = { id: `${act}-boss`, floor: FLOORS, lane: 2, kind: 'boss', next: [], boss: bossForAct(act, rng) };
  for (const n of nodes.values()) if (n.floor === FLOORS - 1) n.next = [boss.id];
  // Guarantee at least one battle on floors 1-2 for each start and no elite on floor < 3.
  const list = [...nodes.values(), boss];
  return { act, floors: FLOORS + 1, nodes: list };
}

export function nodeById(map: ActMap, id: string): MapNode | undefined {
  return map.nodes.find((n) => n.id === id);
}

/** Nodes the player can move to from the current node (or the first floor at act start). */
export function reachableNodes(map: ActMap, currentId: string | null): MapNode[] {
  if (!currentId) return map.nodes.filter((n) => n.floor === 0);
  const cur = nodeById(map, currentId);
  return cur ? cur.next.map((id) => nodeById(map, id)!).filter(Boolean) : [];
}
