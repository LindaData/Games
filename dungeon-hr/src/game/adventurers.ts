import { ADV_EPITHETS, ADV_NAMES, AUDIT_TEMPLATE, CLASSES, PARTY_TEMPLATES, type PartyTemplate } from './data';
import { nextId } from './employees';
import { chance, pick, randInt, vary, weightedPick, type Rng } from './rng';
import type { AdvClass, Adventurer, GameState, Party } from './types';

export function isBossWeek(week: number): boolean {
  return week % 8 === 0;
}

export function isNightWeek(week: number): boolean {
  return week % 3 === 0;
}

export function partyLevel(week: number, dungeonLevel: number): number {
  const w = week - 1;
  return 1 + w * 0.16 + w * w * 0.011 + (dungeonLevel - 1) * 0.3;
}

function makeAdventurer(state: GameState, cls: AdvClass, level: number, rng: Rng): Adventurer {
  const def = CLASSES[cls];
  const l = Math.max(1, level);
  const name = `${pick(rng, ADV_NAMES)} ${chance(rng, 0.55) ? pick(rng, ADV_EPITHETS) : ''}`.trim();
  const plus = Math.min(5, Math.floor((l - 1) / 3));
  let gear = pick(rng, def.gear);
  if (plus > 0 && gear.startsWith('a ') && !gear.includes('+')) gear = `a +${plus} ${gear.slice(2)}`;
  return {
    id: nextId(state, 'a'),
    name,
    cls,
    level: l,
    maxHp: Math.round(vary(rng, def.base.hp, 0.1) * 0.5 * (1 + 0.26 * (l - 1))),
    atk: +(vary(rng, def.base.atk, 0.1) * 0.52 * (1 + 0.2 * (l - 1))).toFixed(1),
    def: +(vary(rng, def.base.def, 0.1) * (1 + 0.12 * (l - 1))).toFixed(1),
    spd: +(vary(rng, def.base.spd, 0.1) * (1 + 0.02 * (l - 1))).toFixed(1),
    gear,
    loot: Math.round(8 + l * 6),
    hue: randInt(rng, -20, 20),
  };
}

export function generateParty(state: GameState, rng: Rng): Party {
  const week = state.week;
  const boss = isBossWeek(week);
  const night = isNightWeek(week);
  const hasExec = state.employees.some((e) => e.species === 'dragon' || e.species === 'vampire');
  let tpl: PartyTemplate;
  if (boss) tpl = AUDIT_TEMPLATE;
  else {
    const eligible = PARTY_TEMPLATES.filter((t) => t.minWeek <= week);
    tpl = weightedPick(
      rng,
      eligible.map((t) => ({
        item: t,
        weight:
          t.kind === 'beginner'
            ? Math.max(0.4, 6 - week)
            : t.kind === 'bosshunters'
              ? hasExec ? 4 : 1
              : 3,
      })),
    );
  }
  const comp = [...pick(rng, tpl.comp)];
  // The first audit is a gentler introduction to boss waves.
  if (boss && week <= 8) comp.pop();
  const extra = week >= 34 ? 4 : week >= 26 ? 3 : week >= 18 ? 2 : week >= 10 ? 1 : 0;
  const pool: AdvClass[] = ['fighter', 'rogue', 'wizard', 'cleric', 'paladin', 'ranger', 'barbarian', 'bard'];
  for (let i = 0; i < extra && comp.length < 8; i++) comp.push(pick(rng, pool));
  const baseLevel = partyLevel(week, state.dungeonLevel) + (boss && week > 8 ? 0.5 : 0);
  const members = comp.map((cls) => makeAdventurer(state, cls, Math.round(vary(rng, baseLevel, 0.15)), rng));
  const bounty = Math.round((50 + week * 10) * tpl.bountyMult * (night ? 1.15 : 1));
  return {
    name: pick(rng, tpl.names),
    kind: tpl.kind,
    members,
    night,
    bounty,
    flavor: pick(rng, tpl.flavor),
    boss,
  };
}
