/**
 * localStorage helpers. Every access is wrapped in try/catch: storage can be missing, blocked
 * or full (private windows, embedded viewers), and the game must work fine without it.
 */
import { DIFFICULTIES, isDifficulty, type Difficulty } from './game/difficulty';
import type { Outcome } from './game/engine';

const PREFIX = 'immortal-snail:';

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

export function loadSavedGame(): string | null {
  return read('game');
}

export function saveGame(json: string): void {
  write('game', json);
}

// ---- difficulty preference --------------------------------------------------

export function loadDifficulty(): Difficulty | null {
  const d = read('difficulty');
  return isDifficulty(d) ? d : null;
}

export function saveDifficulty(d: Difficulty): void {
  write('difficulty', d);
}

// ---- stats ------------------------------------------------------------------

export interface Record3 {
  w: number;
  l: number;
  d: number;
}
export type Stats = Record<Difficulty, Record3>;

export function emptyStats(): Stats {
  return { easy: { w: 0, l: 0, d: 0 }, normal: { w: 0, l: 0, d: 0 }, hard: { w: 0, l: 0, d: 0 } };
}

const count = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0);

export function loadStats(): Stats {
  const stats = emptyStats();
  try {
    const raw = read('stats');
    if (!raw) return stats;
    const data = JSON.parse(raw) as Partial<Record<Difficulty, Partial<Record3>>>;
    for (const d of DIFFICULTIES) {
      const r = data?.[d];
      if (r && typeof r === 'object') stats[d] = { w: count(r.w), l: count(r.l), d: count(r.d) };
    }
  } catch {
    /* corrupt: start fresh */
  }
  return stats;
}

export function saveStats(stats: Stats): void {
  write('stats', JSON.stringify(stats));
}

export function recordResult(stats: Stats, difficulty: Difficulty, outcome: Outcome): Stats {
  const r = { ...stats[difficulty] };
  if (outcome === 'win') r.w++;
  else if (outcome === 'loss') r.l++;
  else r.d++;
  return { ...stats, [difficulty]: r };
}
