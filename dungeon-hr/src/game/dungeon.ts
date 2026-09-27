import { ROOMS, officeSlotsFor, routeSlotsFor } from './data';
import type { Employee, GameState, Room, RoomTypeId, Zone } from './types';

export function getRoom(state: GameState, id: string | null): Room | undefined {
  if (!id) return undefined;
  return state.rooms.find((r) => r.id === id);
}

export function vaultRoom(state: GameState): Room {
  return state.rooms.find((r) => r.type === 'vault')!;
}

/** Route rooms in the order adventurers traverse them, ending with the vault. */
export function routeOrder(state: GameState): Room[] {
  const route = state.rooms
    .filter((r) => r.zone === 'route' && r.type !== 'vault')
    .sort((a, b) => a.slot - b.slot);
  return [...route, vaultRoom(state)];
}

export function roomAt(state: GameState, zone: Zone, slot: number): Room | undefined {
  return state.rooms.find((r) => r.zone === zone && r.slot === slot && r.type !== 'vault');
}

export function roomStaff(state: GameState, roomId: string): Employee[] {
  return state.employees.filter((e) => e.roomId === roomId);
}

export function roomCapacity(room: Room): number {
  return ROOMS[room.type].capacity(room.level);
}

export function hasRoom(state: GameState, type: RoomTypeId): Room | undefined {
  return state.rooms
    .filter((r) => r.type === type)
    .sort((a, b) => b.level - a.level)[0];
}

export function roomLevelSum(state: GameState, type: RoomTypeId): number {
  return state.rooms.filter((r) => r.type === type).reduce((s, r) => s + r.level, 0);
}

export function headcountLimit(state: GameState): number {
  return 4 + roomLevelSum(state, 'barracks') * 3;
}

export function policySlots(state: GameState): number {
  return 2 + Math.min(3, roomLevelSum(state, 'hroffice'));
}

export function buildCost(type: RoomTypeId): number {
  return ROOMS[type].cost;
}

export function upgradeCost(room: Room): number {
  const base = room.type === 'vault' ? 150 : ROOMS[room.type].cost;
  return Math.round(base * (room.level + 0.5) * 1.2);
}

export function refreshSlots(state: GameState) {
  state.routeSlots = routeSlotsFor(state.dungeonLevel);
  state.officeSlots = officeSlotsFor(state.dungeonLevel);
}

/** Staff with at least one available HR person in the HR office. */
export function hrRep(state: GameState): Employee | undefined {
  const office = hasRoom(state, 'hroffice');
  if (!office) return undefined;
  return roomStaff(state, office.id).find((e) => e.status === 'active');
}
