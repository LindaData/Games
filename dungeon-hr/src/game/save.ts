import type { GameState } from './types';

export const SAVE_VERSION = 3;
export const SLOTS = [1, 2, 3] as const;
export type Slot = (typeof SLOTS)[number];

const LEGACY_KEY = 'dungeon-hr-save-v1';
const slotKey = (slot: Slot) => `dungeon-hr-slot-${slot}`;

export interface SlotInfo {
  slot: Slot;
  company: string;
  week: number;
  level: number;
  gold: number;
  board: number;
  staff: number;
  savedAt: number;
}

interface Stored {
  savedAt: number;
  state: GameState;
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Upgrades older saves to the current shape. Returns null for anything unrecognisable. */
export function migrate(raw: unknown): GameState | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Partial<GameState> & { version?: number };
  if (typeof s.version !== 'number' || !Array.isArray(s.employees) || !Array.isArray(s.rooms) || typeof s.week !== 'number') return null;
  if (s.version > SAVE_VERSION) return null;
  if (s.version < 2) {
    s.relations = [];
    s.flags = [];
    s.weeklyBuff = null;
    s.tipsSeen = s.tutorialDone ? ['invasion', 'report', 'hr', 'coach'] : [];
    s.version = 2;
  }
  if (s.version < 3) {
    // v3 raised Board confidence from 3 to 5 hearts; existing runs get the extra two.
    s.board = Math.min(5, (s.board ?? 3) + 2);
    s.version = 3;
  }
  const state = s as GameState;
  if (state.phase === 'invasion' || state.phase === 'title') state.phase = 'manage';
  state.toast = null;
  return state;
}

function read(key: string): Stored | null {
  const ls = storage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored | GameState;
    // Legacy saves stored the bare state.
    const stored: Stored = 'state' in parsed ? parsed : { savedAt: 0, state: parsed as GameState };
    const state = migrate(stored.state);
    return state ? { savedAt: stored.savedAt, state } : null;
  } catch {
    return null;
  }
}

/** Moves a v1 single-slot save into slot 1 the first time the new code runs. */
function migrateLegacy() {
  const ls = storage();
  if (!ls) return;
  try {
    const legacy = ls.getItem(LEGACY_KEY);
    if (!legacy) return;
    if (!ls.getItem(slotKey(1))) {
      const stored = read(LEGACY_KEY);
      if (stored) ls.setItem(slotKey(1), JSON.stringify(stored));
    }
    ls.removeItem(LEGACY_KEY);
  } catch {
    // ignore
  }
}

export function saveToSlot(state: GameState, slot: Slot) {
  const ls = storage();
  if (!ls) return;
  try {
    if (state.phase === 'title') return;
    if (state.phase === 'gameover') {
      // A finished run is not resumable.
      ls.removeItem(slotKey(slot));
      return;
    }
    const toSave: GameState = { ...state, phase: state.phase === 'invasion' ? 'manage' : state.phase, toast: null };
    ls.setItem(slotKey(slot), JSON.stringify({ savedAt: Date.now(), state: toSave } satisfies Stored));
  } catch {
    // Storage may be full or unavailable; the game still works without saves.
  }
}

export function loadSlot(slot: Slot): GameState | null {
  migrateLegacy();
  return read(slotKey(slot))?.state ?? null;
}

export function deleteSlot(slot: Slot) {
  try {
    storage()?.removeItem(slotKey(slot));
  } catch {
    // ignore
  }
}

export function listSlots(): Record<Slot, SlotInfo | null> {
  migrateLegacy();
  const out = {} as Record<Slot, SlotInfo | null>;
  for (const slot of SLOTS) {
    const stored = read(slotKey(slot));
    out[slot] = stored
      ? {
          slot,
          company: stored.state.company,
          week: stored.state.week,
          level: stored.state.dungeonLevel,
          gold: stored.state.gold,
          board: stored.state.board,
          staff: stored.state.employees.length,
          savedAt: stored.savedAt,
        }
      : null;
  }
  return out;
}

export function exportSave(state: GameState): string {
  return JSON.stringify({ format: 'dungeon-hr-save', savedAt: Date.now(), state: { ...state, toast: null } }, null, 1);
}

/** Parses an exported save file. Throws with a readable message when the file is not a save. */
export function importSave(text: string): GameState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  const candidate = parsed && typeof parsed === 'object' && 'state' in parsed ? (parsed as { state: unknown }).state : parsed;
  const state = migrate(candidate);
  if (!state) throw new Error('That file is not a Dungeon HR save (or was made by a newer version).');
  return state;
}
