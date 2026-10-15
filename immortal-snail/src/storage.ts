/**
 * localStorage helpers. Every access is wrapped in try/catch: storage can be missing, blocked
 * or full (private windows, embedded viewers), and the game must work fine without it.
 * Keys left by the old version with difficulty levels (`game`, `stats`, `difficulty`) are ignored.
 */
import { newGame, restoreGame, serializeGame, type GameState, type Outcome } from './game/engine';

const PREFIX = 'immortal-snail:';
const GAME_KEY = 'game:v2';
const STATS_KEY = 'stats:v2';
const RULES_KEY = 'rules-seen';

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

/** The saved game, or a fresh game when there is none or it is corrupt. */
export function loadGame(): GameState {
  return restoreGame(read(GAME_KEY)) ?? newGame();
}

export function saveGame(game: GameState): void {
  write(GAME_KEY, serializeGame(game));
}

// ---- rules card -------------------------------------------------------------

/** Has the player closed the rules card before? (It opens by itself only on the first visit.) */
export function loadRulesSeen(): boolean {
  return read(RULES_KEY) === '1';
}

export function saveRulesSeen(): void {
  write(RULES_KEY, '1');
}

// ---- stats ------------------------------------------------------------------

export interface Stats {
  w: number;
  l: number;
  d: number;
}

export function emptyStats(): Stats {
  return { w: 0, l: 0, d: 0 };
}

const count = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0);

export function loadStats(): Stats {
  try {
    const data = JSON.parse(read(STATS_KEY) ?? 'null') as Partial<Stats> | null;
    if (data && typeof data === 'object') return { w: count(data.w), l: count(data.l), d: count(data.d) };
  } catch {
    /* corrupt: start fresh */
  }
  return emptyStats();
}

export function saveStats(stats: Stats): void {
  write(STATS_KEY, JSON.stringify(stats));
}

export function recordResult(stats: Stats, outcome: Outcome): Stats {
  const key = outcome === 'win' ? 'w' : outcome === 'loss' ? 'l' : 'd';
  return { ...stats, [key]: stats[key] + 1 };
}
