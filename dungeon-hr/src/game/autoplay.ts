/**
 * Headless auto-player used by tests and balance checks. It plays the full
 * management loop through the same reducer the UI uses.
 */
import { ARMOR_TIERS, ROOMS, SPECIES, TECHS, WEAPON_TIERS, OFFICE_ROOMS, ROUTE_ROOMS } from './data';
import { headcountLimit, roomAt, roomCapacity, routeOrder, buildCost } from './dungeon';
import { hireCost, payroll, powerRating, canPromote } from './employees';
import { hrOptions } from './hr';
import { simulateInvasion } from './sim';
import { newGame, reducer, setReducerRng, type Action } from './state';
import { defaultRng } from './rng';
import type { Rng } from './rng';
import type { GameState, RoomTypeId } from './types';

export interface AutoplayResult {
  weeks: number;
  gameOver: boolean;
  defenses: number;
  breaches: number;
  fatalities: number;
  finalLevel: number;
  finalGold: number;
  staff: number;
  history: { week: number; outcome: string; gold: number; staff: number; level: number; party: string }[];
}

export let debugHook: ((s: GameState, sim: ReturnType<typeof simulateInvasion>) => void) | null = null;
export function setDebugHook(h: typeof debugHook) {
  debugHook = h;
}

export function autoplay(maxWeeks: number, rng: Rng, strategy: 'smart' | 'idle' = 'smart'): AutoplayResult {
  setReducerRng(rng);
  let s = newGame('Autoplay Inc.', rng);
  const d = (a: Action) => {
    s = reducer(s, a);
  };
  const history: AutoplayResult['history'] = [];
  // `s` is reassigned inside `d`, so read the phase through a function to avoid stale narrowing.
  const over = () => s.phase === 'gameover';
  while (s.week <= maxWeeks && !over()) {
    if (strategy === 'smart') manage(s, d, () => s);
    d({ type: 'START_INVASION' });
    const sim = simulateInvasion(s, s.nextParty, rng);
    if (debugHook) debugHook(s, sim);
    const partyName = s.nextParty.name;
    d({ type: 'APPLY_INVASION', sim });
    history.push({ week: s.lastSummary!.week, outcome: sim.outcome, gold: s.gold, staff: s.employees.length, level: s.dungeonLevel, party: partyName });
    if (over()) break;
    // Resolve HR inbox
    if (strategy === 'smart' && s.hrInbox.length) {
      d({ type: 'HR_AUTO' });
      d({ type: 'HR_NEXT' });
    }
    let guard = 0;
    while (s.hrInbox.length && guard++ < 20) {
      const ev = s.hrInbox[0];
      const opts = hrOptions(s, ev).filter((o) => !o.disabled);
      const pick =
        strategy === 'idle'
          ? opts[opts.length - 1]
          : opts.find((o) => ['approve', 'counter', 'promote', 'mediate', 'plaque', 'coach', 'pay', 'force', 'ok', 'negotiate', 'speech', 'retreat', 'cake', 'match', 'reject', 'stay', 'decline'].includes(o.id)) ?? opts[0];
      d({ type: 'HR_RESOLVE', eventId: ev.id, option: pick.id });
      d({ type: 'HR_NEXT' });
    }
    if (s.phase !== 'manage') d({ type: 'GO', phase: 'manage' });
  }
  setReducerRng(defaultRng);
  return {
    weeks: s.week - 1,
    gameOver: over(),
    defenses: s.stats.defenses,
    breaches: s.stats.breaches,
    fatalities: s.stats.fatalities,
    finalLevel: s.dungeonLevel,
    finalGold: s.gold,
    staff: s.employees.length,
    history,
  };
}

function manage(s0: GameState, d: (a: Action) => void, get: () => GameState) {
  let s = s0;
  const refresh = () => (s = get());
  // Research whatever is affordable.
  for (const t of TECHS) {
    refresh();
    if (!s.tech.includes(t.id) && t.unlock <= s.dungeonLevel && (!t.requires || s.tech.includes(t.requires)) && s.research >= t.cost) d({ type: 'RESEARCH', techId: t.id });
  }
  refresh();
  // Build rooms.
  const routePlan: RoomTypeId[] = ['guardpost', 'trap', 'guardpost', 'ambush', 'guardpost', 'lair', 'hallway'];
  const officePlan: RoomTypeId[] = ['medical', 'barracks', 'breakroom', 'barracks', 'hroffice', 'lab', 'cafeteria', 'barracks'];
  for (let i = 0; i < s.routeSlots; i++) {
    refresh();
    if (roomAt(s, 'route', i)) continue;
    const want = routePlan.find((t) => ROOMS[t].unlock <= s.dungeonLevel && ROUTE_ROOMS.includes(t) && !(t === 'lair' && !s.employees.some((e) => e.species === 'dragon'))) ?? 'hallway';
    const type = s.rooms.filter((r) => r.zone === 'route' && r.type === want).length >= 2 ? 'guardpost' : want;
    const positions = routeOrder(s).reduce((n, r) => n + roomCapacity(r), 0);
    if (s.employees.length < positions - 1) break;
    if (s.gold > buildCost(type) + payroll(s) * 0.5) d({ type: 'BUILD', zone: 'route', slot: i, roomType: type });
  }
  // Hire best value applicants.
  for (let k = 0; k < 4; k++) {
    refresh();
    if (s.employees.length >= headcountLimit(s)) break;
    const positions = routeOrder(s).reduce((n, r) => n + roomCapacity(r), 0) + 2;
    if (s.employees.length >= positions) break;
    const best = [...s.applicants]
      .filter((a) => !a.traits.includes('nepo'))
      .sort((a, b) => powerRating(b) / (b.salary + 25) - powerRating(a) / (a.salary + 25))[0];
    if (!best) break;
    if (s.gold < hireCost(best) + (payroll(s) + best.salary) * 0.5) break;
    d({ type: 'HIRE', id: best.id });
  }
  for (let i = 0; i < s.officeSlots; i++) {
    refresh();
    if (roomAt(s, 'office', i)) continue;
    const have = s.rooms.map((r) => r.type);
    const want = officePlan.find((t) => ROOMS[t].unlock <= s.dungeonLevel && OFFICE_ROOMS.includes(t) && (t === 'barracks' ? have.filter((x) => x === 'barracks').length < 2 : !have.includes(t)));
    if (want && s.gold > buildCost(want) + payroll(s) * 0.5) d({ type: 'BUILD', zone: 'office', slot: i, roomType: want });
  }
  // Upgrade vault and route rooms when rich.
  refresh();
  for (const r of routeOrder(s)) {
    refresh();
    if (r.level < ROOMS[r.type].maxLevel && s.gold > 500 + payroll(s) * 2) d({ type: 'UPGRADE', roomId: r.id });
  }
  // Equipment.
  refresh();
  if (s.weapons < WEAPON_TIERS.length - 1 && s.gold > WEAPON_TIERS[s.weapons + 1].cost + payroll(s) * 2 + 60) d({ type: 'BUY_EQUIP', kind: 'weapons' });
  refresh();
  if (s.armor < ARMOR_TIERS.length - 1 && s.gold > ARMOR_TIERS[s.armor + 1].cost + payroll(s) * 2 + 60) d({ type: 'BUY_EQUIP', kind: 'armor' });
  // Promotions.
  for (const e of get().employees) if (canPromote(e) && get().gold > 200) d({ type: 'PROMOTE', empId: e.id });
  // Staff everyone the way the in-game Auto-assign button does.
  d({ type: 'AUTO_ASSIGN' });
  void SPECIES;
}
