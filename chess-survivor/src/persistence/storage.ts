/** localStorage persistence for meta progression and the in-progress run. */
import { defaultMeta, THEMES, type MetaState } from '../game/meta';
import type { RunState } from '../game/run';

const META_KEY = 'chess-survivor:meta:v1';
const RUN_KEY = 'chess-survivor:run:v1';

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — play on without saving */
  }
}

export function loadMeta(): MetaState {
  const m = read<MetaState>(META_KEY);
  if (!m || m.version !== 1) return defaultMeta();
  const d = defaultMeta();
  const merged = { ...d, ...m, stats: { ...d.stats, ...m.stats }, settings: { ...d.settings, ...m.settings } };
  if (!(merged.theme in THEMES)) merged.theme = 'classic';
  merged.themes = merged.themes.filter((t) => t in THEMES);
  return merged;
}

export function saveMeta(meta: MetaState): void {
  write(META_KEY, meta);
}

export function loadRun(): RunState | null {
  const r = read<RunState>(RUN_KEY);
  return r && r.version === 1 ? r : null;
}

export function saveRun(run: RunState | null): void {
  write(RUN_KEY, run);
}
