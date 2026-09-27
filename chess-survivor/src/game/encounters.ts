/** Encounter generation: enemy armies, player start squares, objectives and bosses. */
import type { PieceSymbol, Square } from 'chess.js';
import { buildFen, capturersOf, isInCheck, NO_MODS, type Placement } from '../chess/rules';
import { ALL_SQUARES, FILES, isDark, mirrorSquare, rankOf } from '../chess/squares';
import { pick, randInt, shuffle, weightedPick, type Rng } from '../core/rng';
import { CHARACTERS } from './pieces';

export type Objective =
  | { kind: 'survive'; turns: number }
  | { kind: 'reach'; squares: Square[]; limit: number }
  | { kind: 'escape'; squares: Square[]; limit: number }
  | { kind: 'capture'; count: number; limit: number }
  | { kind: 'protect'; turns: number }
  | { kind: 'promote'; limit: number }
  | { kind: 'kingMove'; limit: number };

export type BossId = 'horde' | 'mirror' | 'immortal' | 'grandmaster';
export type BattleKind = 'battle' | 'elite' | 'boss';

export interface EncounterDef {
  name: string;
  subtitle: string;
  kind: BattleKind;
  boss?: BossId;
  elo: number;
  fen: string;
  playerSq: Square;
  allySq?: Square;
  immortalSq?: Square;
  mirrorSq?: Square;
  objective: Objective;
  gold: number;
}

export const BOSSES: Record<BossId, { name: string; subtitle: string; desc: string }> = {
  horde: {
    name: 'The Horde',
    subtitle: 'Sixteen pawns and not one of them afraid',
    desc: 'A wall of pawns advances. Survive 12 turns.',
  },
  mirror: {
    name: 'The Mirror',
    subtitle: 'It moves when you move',
    desc: 'A shadow copy of you mirrors every move you make — even your abilities. Survive 12 turns.',
  },
  immortal: {
    name: 'The Immortal',
    subtitle: 'A queen who cannot die in the light',
    desc: 'The Immortal Queen can only be captured while standing on a dark square. Slay her or survive 12 turns.',
  },
  grandmaster: {
    name: 'The Grandmaster',
    subtitle: 'A full army. A perfect mind.',
    desc: 'A complete chess army commanded at full strength. Survive 10 turns.',
  },
};

export function objectiveText(o: Objective): string {
  switch (o.kind) {
    case 'survive':
      return `Survive ${o.turns} turns`;
    case 'reach':
      return `Reach ${o.squares.join(' or ')} within ${o.limit} turns`;
    case 'escape':
      return `Escape through a portal (${o.squares.join(', ')}) within ${o.limit} turns`;
    case 'capture':
      return `Capture ${o.count} enemy pieces within ${o.limit} turns`;
    case 'protect':
      return `Keep your ally alive for ${o.turns} turns`;
    case 'promote':
      return `Reach the 8th rank and promote within ${o.limit} turns`;
    case 'kingMove':
      return `Force the enemy king to move within ${o.limit} turns`;
  }
}

interface GenParams {
  rng: Rng;
  piece: PieceSymbol;
  kind: BattleKind;
  boss?: BossId;
  /** Number of battles already won this run. */
  tier: number;
  act: number;
  loop: number;
  swift: boolean;
}

const HOME: Record<string, Square[]> = { n: ['b8', 'g8'], b: ['c8', 'f8'], r: ['a8', 'h8'], q: ['d8'] };
const COST: Record<string, number> = { n: 3, b: 3, r: 5, q: 9 };

function buildArmy(rng: Rng, budget: number, pawns: number, advanced: number): Placement[] {
  const army: Placement[] = [{ sq: 'e8', type: 'k', color: 'b' }];
  const taken = new Set<string>(['e8']);
  const files = shuffle(rng, FILES.split('')).slice(0, pawns);
  files.forEach((f, i) => {
    const sq = `${f}${i < advanced ? randInt(rng, 5, 6) : 7}` as Square;
    army.push({ sq, type: 'p', color: 'b' });
    taken.add(sq);
  });
  let left = budget;
  let guard = 0;
  while (left >= 3 && guard++ < 40) {
    const options = (['n', 'b', 'r', 'q'] as const).filter((t) => COST[t] <= left);
    const type = weightedPick(rng, options.map((t) => ({ item: t, weight: t === 'q' ? 1 : t === 'r' ? 2 : 3 })));
    let sq = HOME[type].find((s) => !taken.has(s));
    if (!sq) {
      const free = ALL_SQUARES.filter((s) => rankOf(s) >= 6 && !taken.has(s));
      if (!free.length) break;
      sq = pick(rng, free);
    }
    army.push({ sq, type, color: 'b' });
    taken.add(sq);
    left -= COST[type];
  }
  return army;
}

function placePlayer(rng: Rng, army: Placement[], piece: PieceSymbol, extra: Placement[] = []): Square | null {
  const taken = new Set([...army, ...extra].map((p) => p.sq));
  const preferred = CHARACTERS[piece].startSquares;
  const backup = shuffle(
    rng,
    ALL_SQUARES.filter((s) => rankOf(s) <= 2 && !(piece === 'p' && rankOf(s) === 1)),
  );
  for (const sq of [...shuffle(rng, preferred), ...backup]) {
    if (taken.has(sq)) continue;
    const fen = buildFen([...army, ...extra, { sq, type: piece, color: 'w' }], 'b');
    if (isInCheck(fen, 'b')) continue;
    const safe = piece === 'k' ? !isInCheck(fen, 'w') : capturersOf(fen, sq, NO_MODS).length === 0;
    if (safe) return sq;
  }
  return null;
}

function targetSquares(rng: Rng, army: Placement[], piece: PieceSymbol, playerSq: Square, ranks: number[], count: number): Square[] {
  const taken = new Set(army.filter((p) => p.type === 'k').map((p) => p.sq));
  let cands = ALL_SQUARES.filter((s) => ranks.includes(rankOf(s)) && !taken.has(s));
  if (piece === 'b') cands = cands.filter((s) => isDark(s) === isDark(playerSq));
  return shuffle(rng, cands).slice(0, count);
}

function pickObjective(rng: Rng, p: GenParams, army: Placement[], playerSq: Square): Objective {
  const s = p.swift ? 2 : 0;
  if (p.kind === 'elite') {
    return pick(rng, [
      { kind: 'survive', turns: 11 - s } as Objective,
      { kind: 'capture', count: p.piece === 'p' ? 2 : 3, limit: 18 } as Objective,
    ]);
  }
  const pool: { item: string; weight: number }[] = [
    { item: 'survive', weight: 4 },
    { item: 'capture', weight: p.piece === 'p' ? 1 : 2 },
    { item: 'kingMove', weight: p.piece === 'k' ? 1 : 2 },
  ];
  if (p.piece === 'p') pool.push({ item: 'promote', weight: 3 });
  if (p.piece !== 'p' && p.piece !== 'k') pool.push({ item: 'reach', weight: 2 }, { item: 'escape', weight: 2 });
  if (p.tier >= 1) pool.push({ item: 'protect', weight: 2 });
  const kind = weightedPick(rng, pool);
  switch (kind) {
    case 'capture':
      return { kind: 'capture', count: p.tier < 4 || p.piece === 'p' ? 2 : 3, limit: p.tier < 4 ? 14 : 18 };
    case 'kingMove':
      return { kind: 'kingMove', limit: 18 };
    case 'promote':
      return { kind: 'promote', limit: 14 };
    case 'reach':
      return { kind: 'reach', squares: targetSquares(rng, army, p.piece, playerSq, [6, 7], 1), limit: 12 };
    case 'escape':
      return { kind: 'escape', squares: targetSquares(rng, army, p.piece, playerSq, [8], 2), limit: 14 };
    case 'protect':
      return { kind: 'protect', turns: 8 - s };
    default:
      return { kind: 'survive', turns: Math.min(8 + Math.floor(p.tier / 3), 11) - s };
  }
}

const BATTLE_NAMES = [
  ['Skirmish at the Ford', 'A scouting party blocks the road'],
  ['The Open File', 'Rooks patrol the long corridors'],
  ['Fianchetto Watch', 'Bishops sleep with one eye open'],
  ['Pawn Wall', 'The front line holds'],
  ['Outpost', 'A knight has claimed the center'],
  ["Gambit's Edge", 'They will sacrifice to catch you'],
  ['Zugzwang Pass', 'Every move costs something'],
  ['The Long Diagonal', 'Nowhere to hide from the bishops'],
];

export function battleElo(p: { kind: BattleKind; tier: number; act: number; loop: number; boss?: BossId }): number {
  const loopBonus = p.loop * 300;
  if (p.kind === 'boss') {
    const base = { horde: 1150, mirror: 1450, immortal: 1350, grandmaster: 2200 }[p.boss ?? 'horde'];
    return base + loopBonus;
  }
  const base = 800 + p.tier * 90 + (p.act - 1) * 120 + loopBonus;
  return p.kind === 'elite' ? base + 250 : base;
}

export function generateEncounter(p: GenParams): EncounterDef {
  const { rng } = p;
  const elo = battleElo(p);
  for (let attempt = 0; attempt < 30; attempt++) {
    let army: Placement[];
    let objective: Objective;
    let name: string;
    let subtitle: string;
    let allySq: Square | undefined;
    let immortalSq: Square | undefined;
    let mirrorSq: Square | undefined;
    const extra: Placement[] = [];
    const strength = p.tier + (p.act - 1) * 2 + p.loop * 4;

    if (p.kind === 'boss') {
      const boss = p.boss ?? 'horde';
      ({ name, subtitle } = BOSSES[boss]);
      if (boss === 'horde') {
        army = [{ sq: 'e8', type: 'k', color: 'b' }];
        for (const f of FILES) army.push({ sq: `${f}6` as Square, type: 'p', color: 'b' }, { sq: `${f}5` as Square, type: 'p', color: 'b' });
        army.push({ sq: 'b8', type: 'n', color: 'b' }, { sq: 'g8', type: 'n', color: 'b' }, { sq: 'c8', type: 'b', color: 'b' }, { sq: 'f8', type: 'b', color: 'b' });
        if (p.loop > 0) army.push({ sq: 'd8', type: 'q', color: 'b' });
        objective = { kind: 'survive', turns: 12 - (p.swift ? 2 : 0) };
      } else if (boss === 'grandmaster') {
        army = [];
        const back = 'rnbqkbnr';
        for (let i = 0; i < 8; i++) {
          army.push({ sq: `${FILES[i]}8` as Square, type: back[i] as PieceSymbol, color: 'b' });
          army.push({ sq: `${FILES[i]}7` as Square, type: 'p', color: 'b' });
        }
        objective = { kind: 'survive', turns: 10 - (p.swift ? 2 : 0) };
      } else if (boss === 'immortal') {
        army = buildArmy(rng, 8 + p.loop * 4, 5, 0).filter((x) => x.type !== 'q');
        army = army.filter((x) => x.sq !== 'd8');
        army.push({ sq: 'd8', type: 'q', color: 'b' });
        immortalSq = 'd8';
        objective = { kind: 'survive', turns: 12 - (p.swift ? 2 : 0) };
      } else {
        army = buildArmy(rng, 14 + p.loop * 4, 6, 1);
        objective = { kind: 'survive', turns: 12 - (p.swift ? 2 : 0) };
      }
    } else {
      const budget = 4 + strength * 2 + (p.kind === 'elite' ? 7 : 0);
      const pawns = Math.min(3 + Math.floor(strength / 2) + (p.kind === 'elite' ? 1 : 0), 8);
      const advanced = Math.min(Math.floor(strength / 3), 3);
      army = buildArmy(rng, budget, pawns, advanced);
      [name, subtitle] = pick(rng, BATTLE_NAMES);
      if (p.kind === 'elite') {
        name = pick(rng, ['The Iron Guard', 'Black Cavalry', "The Bishop's Council", 'The Queen’s Hand']);
        subtitle = 'An elite formation — stronger, smarter, richer';
      }
      objective = { kind: 'survive', turns: 8 }; // placeholder, picked after placement
    }

    const playerSq = placePlayer(rng, army, p.piece);
    if (!playerSq) continue;
    if (p.kind === 'boss' && p.boss === 'mirror') {
      const ms = mirrorSquare(playerSq);
      if (p.piece === 'k') mirrorSq = 'e8';
      else {
        army = army.filter((x) => x.sq !== ms || x.type === 'k');
        if (army.some((x) => x.sq === ms)) continue;
        army.push({ sq: ms, type: p.piece, color: 'b' });
        mirrorSq = ms;
      }
    }
    if (p.kind !== 'boss') objective = pickObjective(rng, p, army, playerSq);
    if (objective.kind === 'protect') {
      const spots = shuffle(rng, ALL_SQUARES.filter((s) => rankOf(s) === 2 && s !== playerSq));
      for (const s of spots) {
        const trial = buildFen([...army, { sq: s, type: 'p', color: 'w' }, { sq: playerSq, type: p.piece, color: 'w' }], 'b');
        if (capturersOf(trial, s, NO_MODS).length === 0 && !isInCheck(trial, 'b')) {
          allySq = s;
          break;
        }
      }
      if (!allySq) continue;
      extra.push({ sq: allySq, type: 'p', color: 'w' });
    }
    if ((objective.kind === 'reach' || objective.kind === 'escape') && objective.squares.length === 0) continue;

    const all = [...army, ...extra, { sq: playerSq, type: p.piece, color: 'w' as const }];
    const fen = buildFen(all, 'w', { castling: 'kq' });
    if (isInCheck(fen, 'b')) continue;
    const gold = p.kind === 'boss' ? 90 : p.kind === 'elite' ? 45 : 18 + p.tier * 2;
    return { name, subtitle, kind: p.kind, boss: p.boss, elo, fen, playerSq, allySq, immortalSq, mirrorSq, objective, gold };
  }
  throw new Error('Failed to generate encounter');
}
