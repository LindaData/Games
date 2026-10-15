/**
 * localStorage helpers. Every access is wrapped in try/catch: storage can be missing, blocked
 * or full (private windows, embedded viewers), and the game must work fine without it.
 * Keys from older versions (`game:v2`, `stats:v2`, `rules-seen`, …) are ignored.
 */
import { restoreGame, serializeGame, type GameState, type Outcome } from './game/engine';
import { MODES, isMode, type Mode } from './game/settings';

const PREFIX = 'immortal-snail:';
const GAME_KEY = 'game:v3';
const MODE_KEY = 'mode';
const statsKey = (mode: Mode) => `stats:${mode}`;

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(PREFIX + key, value);
  } catch {
    /* storage unavailable: ignore */
  }
}

// ---- saved game -------------------------------------------------------------

/** The saved game, or null when there is none or it is corrupt or from an older version. */
export function loadGame(): GameState | null {
  return restoreGame(read(GAME_KEY));
}

export function saveGame(game: GameState): void {
  write(GAME_KEY, serializeGame(game));
}

// ---- last mode --------------------------------------------------------------

/** The mode played last (Ghost on a first visit). */
export function loadMode(): Mode {
  const mode = read(MODE_KEY);
  return isMode(mode) ? mode : 'ghost';
}

export function saveMode(mode: Mode): void {
  write(MODE_KEY, mode);
}

// ---- stats (one record per mode) ---------------------------------------------

export interface Stats {
  w: number;
  l: number;
  d: number;
}

export type AllStats = Record<Mode, Stats>;

export function emptyStats(): Stats {
  return { w: 0, l: 0, d: 0 };
}

const count = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0);

export function loadStats(mode: Mode): Stats {
  try {
    const data = JSON.parse(read(statsKey(mode)) ?? 'null') as Partial<Stats> | null;
    if (data && typeof data === 'object') return { w: count(data.w), l: count(data.l), d: count(data.d) };
  } catch {
    /* corrupt: start fresh */
  }
  return emptyStats();
}

export function loadAllStats(): AllStats {
  return Object.fromEntries(MODES.map((m) => [m, loadStats(m)])) as AllStats;
}

export function saveStats(mode: Mode, stats: Stats): void {
  write(statsKey(mode), JSON.stringify(stats));
}

export function recordResult(stats: Stats, outcome: Outcome): Stats {
  const key = outcome === 'win' ? 'w' : outcome === 'loss' ? 'l' : 'd';
  return { ...stats, [key]: stats[key] + 1 };
}
