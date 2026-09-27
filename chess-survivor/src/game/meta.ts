/** Meta progression: permanent unlocks bought with Insight earned from runs. */
import type { PieceSymbol } from 'chess.js';
import { UPGRADES, type UpgradeId } from './upgrades';

export type ThemeId = 'classic' | 'midnight' | 'marble' | 'emerald' | 'ember' | 'slate';
export type ModeId = 'standard' | 'hardcore' | 'endless';

export const THEMES: Record<ThemeId, { name: string; light: string; dark: string; accent: string; cost: number }> = {
  classic: { name: 'Walnut', light: '#e9d8b8', dark: '#a9825a', accent: '#f5c451', cost: 0 },
  midnight: { name: 'Midnight', light: '#8a9bb8', dark: '#3f4d6a', accent: '#7dd3fc', cost: 25 },
  marble: { name: 'Marble', light: '#eceff1', dark: '#9aa5b1', accent: '#f472b6', cost: 40 },
  emerald: { name: 'Emerald', light: '#dfe8cf', dark: '#5f8a5a', accent: '#fde047', cost: 50 },
  ember: { name: 'Ember', light: '#e8c9a8', dark: '#8c3b2e', accent: '#fb923c', cost: 70 },
  slate: { name: 'Ivory & Slate', light: '#f1ede4', dark: '#6f7a8c', accent: '#22d3ee', cost: 100 },
};

export const MODES: Record<ModeId, { name: string; desc: string; cost: number }> = {
  standard: { name: 'Standard', desc: 'Three acts. Beat the Grandmaster to win.', cost: 0 },
  hardcore: { name: 'Hardcore', desc: 'Start with 1 max HP. Double Insight.', cost: 60 },
  endless: { name: 'Endless', desc: 'The acts never end. Enemies keep getting stronger.', cost: 120 },
};

export interface MetaState {
  version: 1;
  insight: number;
  pieces: PieceSymbol[];
  upgrades: UpgradeId[];
  themes: ThemeId[];
  modes: ModeId[];
  theme: ThemeId;
  stats: { runs: number; wins: number; bestBattles: number; bestAct: number; totalCaptures: number };
  settings: { dangerOverlay: boolean; animations: boolean };
}

export function defaultMeta(): MetaState {
  return {
    version: 1,
    insight: 0,
    pieces: ['p', 'n'],
    upgrades: (Object.keys(UPGRADES) as UpgradeId[]).filter((id) => UPGRADES[id].unlockCost === 0),
    themes: ['classic'],
    modes: ['standard'],
    theme: 'classic',
    stats: { runs: 0, wins: 0, bestBattles: 0, bestAct: 0, totalCaptures: 0 },
    settings: { dangerOverlay: true, animations: true },
  };
}

export type Unlockable =
  | { kind: 'piece'; id: PieceSymbol }
  | { kind: 'upgrade'; id: UpgradeId }
  | { kind: 'theme'; id: ThemeId }
  | { kind: 'mode'; id: ModeId };

export function isUnlocked(meta: MetaState, u: Unlockable): boolean {
  switch (u.kind) {
    case 'piece':
      return meta.pieces.includes(u.id);
    case 'upgrade':
      return meta.upgrades.includes(u.id);
    case 'theme':
      return meta.themes.includes(u.id);
    case 'mode':
      return meta.modes.includes(u.id);
  }
}

export function unlock(meta: MetaState, u: Unlockable, cost: number): MetaState {
  if (isUnlocked(meta, u) || meta.insight < cost) return meta;
  const m: MetaState = { ...meta, insight: meta.insight - cost };
  if (u.kind === 'piece') m.pieces = [...meta.pieces, u.id];
  if (u.kind === 'upgrade') m.upgrades = [...meta.upgrades, u.id];
  if (u.kind === 'theme') m.themes = [...meta.themes, u.id];
  if (u.kind === 'mode') m.modes = [...meta.modes, u.id];
  return m;
}
