import { generateParty } from './adventurers';
import { ARMOR_TIERS, POLICIES, ROOMS, TECHS, WEAPON_TIERS, officeSlotsFor, routeSlotsFor } from './data';
import { buildCost, getRoom, headcountLimit, policySlots, roomAt, roomCapacity, roomStaff, upgradeCost } from './dungeon';
import { canPromote, generateApplicants, generateEmployee, hireCost, maxHp, nextId, trainingCost, gainXp } from './employees';
import { promote, resolveHr, terminate } from './hr';
import { defaultRng, type Rng } from './rng';
import type { SimResult } from './sim';
import type { GameState, Party, RoomTypeId, Zone } from './types';
import { applyInvasion } from './week';

export const SAVE_VERSION = 1;
const SAVE_KEY = 'dungeon-hr-save-v1';

export function newGame(company = 'Dungeon Corp.', rng: Rng = defaultRng): GameState {
  const state: GameState = {
    version: SAVE_VERSION,
    phase: 'manage',
    company,
    week: 1,
    gold: 260,
    research: 0,
    dungeonLevel: 1,
    dungeonXp: 0,
    board: 3,
    defenseStreak: 0,
    employees: [],
    applicants: [],
    rooms: [],
    routeSlots: routeSlotsFor(1),
    officeSlots: officeSlotsFor(1),
    tech: [],
    weapons: 0,
    armor: 0,
    policies: [],
    hrInbox: [],
    hrOutcome: null,
    nextParty: null as unknown as Party,
    lastSummary: null,
    memorial: [],
    stats: { defenses: 0, breaches: 0, slain: 0, hired: 0, fatalities: 0, goldEarned: 0 },
    nextId: 0,
    unionUnrest: 0,
    tutorialDone: false,
    gameOverReason: null,
    ipoShown: false,
    toast: null,
  };
  const hall = { id: nextId(state, 'r'), type: 'hallway' as const, level: 1, zone: 'route' as const, slot: 0 };
  state.rooms.push(hall);
  state.rooms.push({ id: nextId(state, 'r'), type: 'vault', level: 1, zone: 'route', slot: 99 });
  state.rooms.push({ id: nextId(state, 'r'), type: 'barracks', level: 1, zone: 'office', slot: 0 });
  const skel = generateEmployee(state, 'skeleton', rng, { traits: ['union'], name: 'Skeleton #14' });
  const gob = generateEmployee(state, 'goblin', rng, { traits: ['lazy'], name: 'Gribble' });
  const slime = generateEmployee(state, 'slime', rng, { traits: ['quicklearner'], name: 'Blorp' });
  skel.roomId = hall.id;
  gob.roomId = hall.id;
  state.employees.push(skel, gob, slime);
  state.applicants = generateApplicants(state, rng, 5);
  state.nextParty = generateParty(state, rng);
  return state;
}

export type Action =
  | { type: 'NEW_GAME'; company: string }
  | { type: 'LOAD'; state: GameState }
  | { type: 'TO_TITLE' }
  | { type: 'HIRE'; id: string }
  | { type: 'REFRESH_APPLICANTS' }
  | { type: 'ASSIGN'; empId: string; roomId: string | null }
  | { type: 'BUILD'; zone: Zone; slot: number; roomType: RoomTypeId }
  | { type: 'UPGRADE'; roomId: string }
  | { type: 'DEMOLISH'; roomId: string }
  | { type: 'FIRE'; empId: string }
  | { type: 'TRAIN'; empId: string }
  | { type: 'VACATION'; empId: string }
  | { type: 'PROMOTE'; empId: string }
  | { type: 'RAISE'; empId: string }
  | { type: 'RESEARCH'; techId: string }
  | { type: 'BUY_EQUIP'; kind: 'weapons' | 'armor' }
  | { type: 'TOGGLE_POLICY'; id: string }
  | { type: 'START_INVASION' }
  | { type: 'APPLY_INVASION'; sim: SimResult }
  | { type: 'GO'; phase: GameState['phase'] }
  | { type: 'HR_RESOLVE'; eventId: string; option: string }
  | { type: 'HR_NEXT' }
  | { type: 'DISMISS_TUTORIAL' }
  | { type: 'ACK_IPO' };

function toast(state: GameState, text: string, tone: 'good' | 'bad') {
  state.toast = { id: (state.toast?.id ?? 0) + 1, text, tone };
}

function fail(state: GameState, text: string): GameState {
  return { ...state, toast: { id: (state.toast?.id ?? 0) + 1, text, tone: 'bad' } };
}

let reducerRng: Rng = defaultRng;

/** Lets tests and the headless autoplayer make the reducer deterministic. */
export function setReducerRng(rng: Rng) {
  reducerRng = rng;
}

export function reducer(prev: GameState, action: Action): GameState {
  if (action.type === 'LOAD') return action.state;
  if (action.type === 'NEW_GAME') return newGame(action.company || 'Dungeon Corp.');
  const s: GameState = structuredClone(prev);
  const rng = reducerRng;
  switch (action.type) {
    case 'TO_TITLE':
      s.phase = 'title';
      return s;
    case 'HIRE': {
      const a = s.applicants.find((x) => x.id === action.id);
      if (!a) return prev;
      if (s.employees.length >= headcountLimit(s)) return fail(prev, 'Headcount limit reached. Build or upgrade Barracks.');
      const cost = hireCost(a);
      if (s.gold < cost) return fail(prev, `Recruiting fee is ${cost}g. Not enough gold.`);
      s.gold -= cost;
      a.hiredWeek = s.week;
      a.lastRaiseWeek = s.week;
      s.applicants = s.applicants.filter((x) => x.id !== a.id);
      s.employees.push(a);
      s.stats.hired += 1;
      toast(s, `${a.name} has signed the contract (in blood, as is customary).`, 'good');
      return s;
    }
    case 'REFRESH_APPLICANTS': {
      const cost = 15;
      if (s.gold < cost) return fail(prev, 'Posting a job ad costs 15g.');
      s.gold -= cost;
      s.applicants = generateApplicants(s, rng, 5);
      return s;
    }
    case 'ASSIGN': {
      const e = s.employees.find((x) => x.id === action.empId);
      if (!e) return prev;
      if (action.roomId) {
        const room = getRoom(s, action.roomId);
        if (!room) return prev;
        if (e.roomId === room.id) return prev;
        const staff = roomStaff(s, room.id);
        if (staff.length >= roomCapacity(room)) return fail(prev, `${ROOMS[room.type].name} is full.`);
        if (room.type === 'barracks') return fail(prev, 'Barracks house staff; they have no job positions.');
      }
      e.roomId = action.roomId;
      return s;
    }
    case 'BUILD': {
      const def = ROOMS[action.roomType];
      if (def.unlock > s.dungeonLevel) return fail(prev, 'Not unlocked yet.');
      const max = action.zone === 'route' ? s.routeSlots : s.officeSlots;
      if (action.slot >= max || roomAt(s, action.zone, action.slot)) return prev;
      const cost = buildCost(action.roomType);
      if (s.gold < cost) return fail(prev, `Construction costs ${cost}g.`);
      s.gold -= cost;
      s.rooms.push({ id: nextId(s, 'r'), type: action.roomType, level: 1, zone: action.zone, slot: action.slot });
      toast(s, `${def.name} constructed. Contractor was only three weeks late.`, 'good');
      return s;
    }
    case 'UPGRADE': {
      const room = getRoom(s, action.roomId);
      if (!room) return prev;
      if (room.level >= ROOMS[room.type].maxLevel) return fail(prev, 'Already at max level.');
      const cost = upgradeCost(room);
      if (s.gold < cost) return fail(prev, `Upgrade costs ${cost}g.`);
      s.gold -= cost;
      room.level += 1;
      toast(s, `${ROOMS[room.type].name} upgraded to level ${room.level}.`, 'good');
      return s;
    }
    case 'DEMOLISH': {
      const room = getRoom(s, action.roomId);
      if (!room || room.type === 'vault') return prev;
      if (room.type === 'barracks') {
        const after = headcountLimit(s) - room.level * 3;
        if (s.employees.length > after) return fail(prev, 'Staff would have nowhere to sleep. Reduce headcount first.');
      }
      for (const e of s.employees) if (e.roomId === room.id) e.roomId = null;
      s.gold += Math.round(buildCost(room.type) * 0.5);
      s.rooms = s.rooms.filter((r) => r.id !== room.id);
      return s;
    }
    case 'FIRE': {
      if (!s.employees.some((e) => e.id === action.empId)) return prev;
      toast(s, terminate(s, action.empId), 'bad');
      return s;
    }
    case 'TRAIN': {
      const e = s.employees.find((x) => x.id === action.empId);
      if (!e) return prev;
      const cost = trainingCost(e);
      if (s.gold < cost) return fail(prev, `Training costs ${cost}g.`);
      s.gold -= cost;
      const ups = gainXp(e, 60, s);
      e.morale = Math.min(100, e.morale + 3);
      e.hp = Math.min(e.hp, maxHp(e, s));
      toast(s, ups.length ? ups.join(' ') : `${e.name} completed "Advanced Lurking 201".`, 'good');
      return s;
    }
    case 'VACATION': {
      const e = s.employees.find((x) => x.id === action.empId);
      if (!e || e.status !== 'active') return prev;
      e.status = 'vacation';
      e.statusWeeks = 1;
      e.fatigue = 0;
      e.morale = Math.min(100, e.morale + 10);
      toast(s, `${e.name} will be on vacation for the next invasion.`, 'good');
      return s;
    }
    case 'PROMOTE': {
      const e = s.employees.find((x) => x.id === action.empId);
      if (!e || !canPromote(e)) return prev;
      promote(e);
      e.morale = Math.min(100, e.morale + 20);
      toast(s, `${e.name} promoted! New salary: ${e.salary}g/wk.`, 'good');
      return s;
    }
    case 'RAISE': {
      const e = s.employees.find((x) => x.id === action.empId);
      if (!e) return prev;
      e.salary = Math.round(e.salary * 1.1) + 1;
      e.morale = Math.min(100, e.morale + 15);
      e.lastRaiseWeek = s.week;
      toast(s, `${e.name} got a raise. Salary now ${e.salary}g/wk.`, 'good');
      return s;
    }
    case 'RESEARCH': {
      const t = TECHS.find((x) => x.id === action.techId);
      if (!t || s.tech.includes(t.id)) return prev;
      if (t.requires && !s.tech.includes(t.requires)) return fail(prev, 'Prerequisite missing.');
      if (t.unlock > s.dungeonLevel) return fail(prev, 'Not unlocked yet.');
      if (s.research < t.cost) return fail(prev, `Needs ${t.cost} R&D points.`);
      s.research -= t.cost;
      s.tech.push(t.id);
      toast(s, `R&D complete: ${t.name}.`, 'good');
      return s;
    }
    case 'BUY_EQUIP': {
      const tiers = action.kind === 'weapons' ? WEAPON_TIERS : ARMOR_TIERS;
      const cur = s[action.kind];
      if (cur >= tiers.length - 1) return prev;
      const next = tiers[cur + 1];
      if (s.gold < next.cost) return fail(prev, `${next.name} costs ${next.cost}g.`);
      s.gold -= next.cost;
      s[action.kind] = cur + 1;
      toast(s, `Procurement approved: ${next.name}.`, 'good');
      return s;
    }
    case 'TOGGLE_POLICY': {
      const p = POLICIES.find((x) => x.id === action.id);
      if (!p) return prev;
      if (s.policies.includes(p.id)) {
        s.policies = s.policies.filter((x) => x !== p.id);
        return s;
      }
      if (p.unlock > s.dungeonLevel) return fail(prev, 'Not unlocked yet.');
      if (s.policies.length >= policySlots(s)) return fail(prev, 'No free policy slots. Build/upgrade an HR Office.');
      s.policies.push(p.id);
      return s;
    }
    case 'START_INVASION':
      s.phase = 'invasion';
      s.tutorialDone = true;
      return s;
    case 'APPLY_INVASION':
      applyInvasion(s, s.nextParty, action.sim, rng);
      return s;
    case 'GO':
      if (action.phase === 'hr' && s.hrInbox.length === 0) s.phase = 'manage';
      else s.phase = action.phase;
      return s;
    case 'HR_RESOLVE': {
      const ev = s.hrInbox.find((x) => x.id === action.eventId);
      if (!ev) return prev;
      const text = resolveHr(s, ev, action.option, rng);
      s.hrInbox = s.hrInbox.filter((x) => x.id !== ev.id);
      s.hrOutcome = { title: ev.title, text };
      return s;
    }
    case 'HR_NEXT':
      s.hrOutcome = null;
      if (!s.hrInbox.length) s.phase = 'manage';
      return s;
    case 'DISMISS_TUTORIAL':
      s.tutorialDone = true;
      return s;
    case 'ACK_IPO':
      s.ipoShown = true;
      return s;
  }
}

export function saveGame(state: GameState) {
  try {
    if (state.phase === 'title') return;
    const toSave = state.phase === 'invasion' ? { ...state, phase: 'manage' as const } : state;
    localStorage.setItem(SAVE_KEY, JSON.stringify(toSave));
  } catch {
    // Storage may be unavailable (private mode); the game still works without saves.
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    if (s.version !== SAVE_VERSION) return null;
    if (s.phase === 'invasion') s.phase = 'manage';
    return s;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
