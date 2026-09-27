import { roomStaff } from './dungeon';
import { chance, clamp, pick, type Rng } from './rng';
import type { Employee, GameState, Relation } from './types';

export const FRIEND = 40;
export const RIVAL = -40;

export type Bond = 'friend' | 'rival' | 'neutral';

function find(state: GameState, a: string, b: string): Relation | undefined {
  return state.relations.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));
}

export function relScore(state: GameState, a: string, b: string): number {
  return find(state, a, b)?.score ?? 0;
}

export function bond(state: GameState, a: string, b: string): Bond {
  const s = relScore(state, a, b);
  return s >= FRIEND ? 'friend' : s <= RIVAL ? 'rival' : 'neutral';
}

/** Adjusts a relationship. Returns the bond change, if the pair crossed a threshold. */
export function adjustRel(state: GameState, a: string, b: string, delta: number): { from: Bond; to: Bond } | null {
  if (a === b) return null;
  const before = bond(state, a, b);
  let r = find(state, a, b);
  if (!r) {
    r = { a, b, score: 0 };
    state.relations.push(r);
  }
  r.score = clamp(r.score + delta, -100, 100);
  const after = bond(state, a, b);
  return before !== after ? { from: before, to: after } : null;
}

export function relationsOf(state: GameState, id: string): { other: Employee; score: number; bond: Bond }[] {
  const out: { other: Employee; score: number; bond: Bond }[] = [];
  for (const r of state.relations) {
    if (r.a !== id && r.b !== id) continue;
    const otherId = r.a === id ? r.b : r.a;
    const other = state.employees.find((e) => e.id === otherId);
    if (!other) continue;
    out.push({ other, score: r.score, bond: bond(state, id, otherId) });
  }
  return out.sort((x, y) => Math.abs(y.score) - Math.abs(x.score));
}

/** Drops relations that reference employees who have left. */
export function pruneRelations(state: GameState) {
  const ids = new Set(state.employees.map((e) => e.id));
  state.relations = state.relations.filter((r) => ids.has(r.a) && ids.has(r.b));
}

/** Combat multiplier from friends and rivals sharing the same room. */
export function chemistry(state: GameState, e: Employee, roommates: Employee[]): { mult: number; friends: number; rivals: number } {
  let friends = 0;
  let rivals = 0;
  for (const o of roommates) {
    const b = bond(state, e.id, o.id);
    if (b === 'friend') friends += 1;
    if (b === 'rival') rivals += 1;
  }
  const mult = 1 + Math.min(2, friends) * 0.08 - Math.min(2, rivals) * 0.08;
  return { mult, friends, rivals };
}

/**
 * Weekly relationship drift. Roommates bond, gossip sows discord, and a win
 * together helps. Returns human-readable notes for new friendships and rivalries.
 */
export function weeklyRelations(state: GameState, rng: Rng, foughtTogether: Set<string>, defended: boolean): string[] {
  const notes: string[] = [];
  const noteChange = (a: Employee, b: Employee, change: { from: Bond; to: Bond } | null) => {
    if (!change) return;
    if (change.to === 'friend') notes.push(`${a.name} and ${b.name} are now friends. They've started a group chat.`);
    if (change.to === 'rival') notes.push(`${a.name} and ${b.name} are now rivals. Things have been said.`);
  };
  const roomIds = new Set(state.employees.map((e) => e.roomId).filter(Boolean) as string[]);
  for (const roomId of roomIds) {
    const staff = roomStaff(state, roomId);
    for (let i = 0; i < staff.length; i++) {
      for (let j = i + 1; j < staff.length; j++) {
        const a = staff[i];
        const b = staff[j];
        let d = 5;
        if (a.traits.includes('teamplayer') || b.traits.includes('teamplayer')) d += 4;
        if (a.traits.includes('loner') || b.traits.includes('loner')) d -= 7;
        if (a.species === b.species) d += 2;
        if (foughtTogether.has(a.id) && foughtTogether.has(b.id)) d += defended ? 5 : -2;
        if ((a.traits.includes('gossip') || b.traits.includes('gossip')) && chance(rng, 0.35)) d -= 14;
        if (chance(rng, 0.05)) d -= 12; // Someone microwaved fish.
        noteChange(a, b, adjustRel(state, a.id, b.id, d));
      }
    }
  }
  // Relationships slowly fade for people who never work together.
  for (const r of state.relations) {
    const a = state.employees.find((e) => e.id === r.a);
    const b = state.employees.find((e) => e.id === r.b);
    if (a && b && a.roomId !== b.roomId) r.score -= Math.sign(r.score) * Math.min(Math.abs(r.score), 2);
  }
  state.relations = state.relations.filter((r) => r.score !== 0);
  return notes;
}

/** Morale fallout when an employee leaves the company for any reason. */
export function departureFallout(state: GameState, gone: Employee, fatal: boolean, notes: string[]) {
  for (const { other, bond: b } of relationsOf(state, gone.id)) {
    if (b === 'friend') {
      other.morale = clamp(other.morale - (fatal ? 15 : 8), 0, 100);
      if (fatal) notes.push(`${other.name} is grieving ${gone.name}. They've taped a photo to their locker.`);
    } else if (b === 'rival' && fatal) {
      other.morale = clamp(other.morale + 5, 0, 100);
      notes.push(`${other.name} seems oddly chipper about ${gone.name}'s passing. HR is not investigating.`);
    }
  }
}

export function randomRivalPairInRoom(state: GameState, rng: Rng): [Employee, Employee] | null {
  const pairs: [Employee, Employee][] = [];
  for (const r of state.relations) {
    if (r.score > RIVAL) continue;
    const a = state.employees.find((e) => e.id === r.a);
    const b = state.employees.find((e) => e.id === r.b);
    if (a && b && a.roomId && a.roomId === b.roomId) pairs.push([a, b]);
  }
  return pairs.length ? pick(rng, pairs) : null;
}
