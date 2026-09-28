/**
 * Automatic staffing: puts every employee where they help most, so players
 * don't have to micro-manage the floor plan.
 */
import { GRADE_MULT, ROOMS } from './data';
import { roomCapacity, roomStaff, routeOrder } from './dungeon';
import { powerRating, suitability } from './employees';
import { bond } from './relations';
import type { Employee, GameState, Room } from './types';

function value(state: GameState, e: Employee, room: Room): number {
  let v = powerRating(e) * GRADE_MULT[suitability(e.species, room.type)];
  if (room.type === 'vault') v *= 1.15; // the last line of defense matters most
  if (room.type === 'lair' && e.species === 'dragon') v *= 1.5;
  for (const o of roomStaff(state, room.id)) {
    const b = bond(state, e.id, o.id);
    if (b === 'friend') v *= 1.08;
    if (b === 'rival') v *= 0.85;
  }
  return v;
}

const OFFICE_JOBS: Room['type'][] = ['medical', 'lab', 'hroffice', 'accounting', 'cafeteria', 'training', 'breakroom'];

/** Reassigns everyone. Mutates state. Returns how many employees changed rooms. */
export function autoAssign(state: GameState): number {
  const before = new Map(state.employees.map((e) => [e.id, e.roomId]));
  for (const e of state.employees) e.roomId = null;

  const route = routeOrder(state);
  const free = (r: Room) => roomCapacity(r) - roomStaff(state, r.id).length;
  const place = (pool: Employee[], rooms: Room[]) => {
    const left = [...pool];
    while (left.length) {
      let best: { e: Employee; r: Room; v: number } | null = null;
      for (const e of left) {
        for (const r of rooms) {
          if (free(r) <= 0) continue;
          const v = value(state, e, r);
          if (!best || v > best.v) best = { e, r, v };
        }
      }
      if (!best) break;
      best.e.roomId = best.r.id;
      left.splice(left.indexOf(best.e), 1);
    }
    return left;
  };

  const active = state.employees.filter((e) => e.status === 'active');
  const away = state.employees.filter((e) => e.status !== 'active');
  let leftover = place(active, route);

  // Surplus staff take back-office jobs they're good at (S or A), then any open job.
  const office = state.rooms.filter((r) => r.zone === 'office' && OFFICE_JOBS.includes(r.type));
  for (const pass of ['good', 'any'] as const) {
    for (const e of [...leftover]) {
      const options = office
        .filter((r) => free(r) > 0)
        .filter((r) => r.type !== 'breakroom' || e.fatigue > 50)
        .filter((r) => pass === 'any' || GRADE_MULT[suitability(e.species, r.type)] >= 1.15)
        .sort((a, b) => GRADE_MULT[suitability(e.species, b.type)] - GRADE_MULT[suitability(e.species, a.type)]);
      if (options[0]) {
        e.roomId = options[0].id;
        leftover = leftover.filter((x) => x.id !== e.id);
      }
    }
  }
  // Staff who are away this week hold a route slot for next week if one is free.
  place(away, route);

  return state.employees.filter((e) => before.get(e.id) !== e.roomId).length;
}

/** Places one new employee in the best free position without moving anyone else. */
export function placeNewHire(state: GameState, e: Employee): string | null {
  const route = routeOrder(state).filter((r) => roomCapacity(r) - roomStaff(state, r.id).length > 0);
  const best = route.sort((a, b) => value(state, e, b) - value(state, e, a))[0];
  if (best) {
    e.roomId = best.id;
    return ROOMS[best.type].name;
  }
  return null;
}
