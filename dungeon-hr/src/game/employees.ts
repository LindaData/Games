import {
  ARMOR_TIERS,
  FIRST_NAMES,
  GRADE_MULT,
  RANKS,
  ROOMS,
  SPECIES,
  SPECIES_ORDER,
  TRAIT_WEIGHTS,
  WEAPON_TIERS,
  type Grade,
} from './data';
import { roomStaff, getRoom, roomLevelSum, hasRoom } from './dungeon';
import { chemistry } from './relations';
import { clamp, pick, randInt, vary, weightedPick, type Rng } from './rng';
import type { Employee, GameState, Room, RoomTypeId, SpeciesId, Stats, TraitId } from './types';

export function nextId(state: GameState, prefix: string): string {
  state.nextId += 1;
  return `${prefix}${state.nextId}`;
}

export function suitability(species: SpeciesId, room: RoomTypeId): Grade {
  if (room === 'barracks') return 'B';
  return SPECIES[species].suit[room] ?? 'C';
}

export function hasTrait(e: Employee, t: TraitId): boolean {
  return e.traits.includes(t);
}

export function title(e: Employee): string {
  return `${RANKS[e.rank] ?? ''}${SPECIES[e.species].job}`;
}

export function xpToNext(level: number): number {
  return 40 + level * 30;
}

export function canPromote(e: Employee): boolean {
  return e.rank < RANKS.length - 1 && e.level >= 2 + e.rank * 2;
}

export function hireCost(e: Employee): number {
  return Math.round(e.salary * 3 + (e.level - 1) * 12);
}

export function weeklySalary(e: Employee, state: GameState): number {
  const mult = state.policies.includes('perfpay') ? 0.8 : 1;
  return Math.max(1, Math.round(e.salary * mult));
}

export function payroll(state: GameState): number {
  return state.employees.reduce((s, e) => s + weeklySalary(e, state), 0);
}

export function moraleMult(morale: number): number {
  return 0.8 + clamp(morale, 0, 100) * 0.004;
}

export function fatigueMult(fatigue: number): number {
  return fatigue > 60 ? 1 - (fatigue - 60) / 100 : 1;
}

export function moraleLabel(m: number): { label: string; tone: 'good' | 'ok' | 'bad' | 'crit' } {
  if (m >= 80) return { label: 'Thriving', tone: 'good' };
  if (m >= 55) return { label: 'Content', tone: 'good' };
  if (m >= 35) return { label: 'Meh', tone: 'ok' };
  if (m >= 20) return { label: 'Disgruntled', tone: 'bad' };
  return { label: 'Updating Résumé', tone: 'crit' };
}

/** Stats from species, level, rank, training and personal traits. No situational modifiers. */
export function coreStats(e: Employee): Stats {
  const lvl = 1 + 0.1 * (e.level - 1);
  const rank = 1 + 0.08 * e.rank;
  const m = lvl * rank * e.bonus;
  const s: Stats = {
    hp: e.base.hp * m,
    atk: e.base.atk * m,
    def: e.base.def * m,
    spd: e.base.spd * (1 + 0.03 * (e.level - 1)),
    int: e.base.int * m,
  };
  if (hasTrait(e, 'golddigger')) mulAll(s, 1.15);
  if (hasTrait(e, 'nepo')) mulAll(s, 0.75);
  if (hasTrait(e, 'glasscannon')) {
    s.hp *= 0.7;
    s.atk *= 1.4;
  }
  if (hasTrait(e, 'bloodthirsty')) s.atk *= 1.2;
  if (hasTrait(e, 'thickskin')) s.def *= 1.3;
  if (hasTrait(e, 'lazy')) s.spd *= 0.8;
  if (hasTrait(e, 'overachiever')) s.spd *= 1.25;
  return s;
}

function mulAll(s: Stats, m: number) {
  s.hp *= m;
  s.atk *= m;
  s.def *= m;
  s.int *= m;
}

export function maxHp(e: Employee, state: GameState): number {
  const cafe = hasRoom(state, 'cafeteria');
  let mult = 1;
  if (cafe) {
    const cook = roomStaff(state, cafe.id).find((c) => c.status === 'active');
    mult += 0.05 * cafe.level * (cook ? 1 + GRADE_MULT[suitability(cook.species, 'cafeteria')] : 1);
  }
  return Math.round(coreStats(e).hp * mult);
}

export interface CombatProfile {
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  int: number;
  notes: string[];
}

/** Full combat stats for an employee working in a given room, including every modifier. */
export function combatProfile(e: Employee, state: GameState, room: Room | undefined, night: boolean): CombatProfile {
  const s = coreStats(e);
  const notes: string[] = [];
  let eff = moraleMult(e.morale) * fatigueMult(e.fatigue);
  if (e.fatigue > 60) notes.push('Burnt out');
  let atkMult = WEAPON_TIERS[state.weapons].mult;
  let defMult = ARMOR_TIERS[state.armor].mult;
  let spdMult = 1;
  if (room) {
    const g = suitability(e.species, room.type);
    eff *= GRADE_MULT[g];
    const roommates = roomStaff(state, room.id).filter((o) => o.id !== e.id && o.status === 'active');
    if (hasTrait(e, 'loner')) eff *= roommates.length === 0 ? 1.3 : 0.85;
    if (roommates.some((o) => hasTrait(o, 'teamplayer')) || hasTrait(e, 'teamplayer')) atkMult *= 1.1;
    if (state.policies.includes('openplan') && roommates.length >= 2) atkMult *= 1.15;
    const chem = chemistry(state, e, roommates);
    eff *= chem.mult;
    if (chem.friends) notes.push(`Working with ${chem.friends} friend${chem.friends > 1 ? 's' : ''}`);
    if (chem.rivals) notes.push(`Stuck with ${chem.rivals} rival${chem.rivals > 1 ? 's' : ''}`);
    if (room.type === 'guardpost') defMult *= 1 + 0.1 + room.level * 0.1;
    if (room.type === 'lair') eff *= 1 + 0.15 + room.level * 0.15;
    if (room.type === 'vault') eff *= 1.2;
    if (room.zone === 'route' && state.tech.includes('alarm')) spdMult *= 1.12;
  }
  if (night) {
    if (e.species === 'vampire') {
      eff *= 1.3;
      notes.push('Night shift bonus');
    }
    if (hasTrait(e, 'nightowl')) eff *= 1.3;
  } else if (hasTrait(e, 'nightowl')) eff *= 0.9;
  if (state.policies.includes('casual')) defMult *= 0.95;
  if (state.policies.includes('dresscode')) defMult *= 1.1;
  if (state.policies.includes('perfpay')) atkMult *= 1.1;
  if (state.policies.includes('hostile')) atkMult *= 1.2;
  if (state.weeklyBuff) {
    atkMult *= state.weeklyBuff.atk;
    defMult *= state.weeklyBuff.def;
  }
  if (state.policies.includes('fourday')) spdMult *= 0.9;
  return {
    maxHp: maxHp(e, state),
    atk: s.atk * atkMult * eff,
    def: s.def * defMult * Math.sqrt(eff),
    spd: s.spd * spdMult * Math.sqrt(eff),
    int: s.int * eff,
    notes,
  };
}

/** A rough single-number rating for UI comparison. */
export function powerRating(e: Employee): number {
  const s = coreStats(e);
  return Math.round((s.hp / 4 + s.atk * 2 + s.def * 1.5 + s.spd + s.int * 0.5) / 2);
}

function rollTraits(rng: Rng, species: SpeciesId, nepotism: boolean): TraitId[] {
  const traits: TraitId[] = [];
  const count = rng() < 0.35 ? 2 : rng() < 0.9 ? 1 : 0;
  const pool = Object.entries(TRAIT_WEIGHTS).map(([id, w]) => ({
    item: id as TraitId,
    weight: id === 'nepo' && nepotism ? w * 4 : id === 'disguise' && species === 'mimic' ? 0 : w,
  }));
  let guard = 0;
  while (traits.length < count && guard++ < 20) {
    const t = weightedPick(rng, pool);
    if (traits.includes(t)) continue;
    if ((t === 'lazy' && traits.includes('overachiever')) || (t === 'overachiever' && traits.includes('lazy'))) continue;
    if ((t === 'loner' && traits.includes('teamplayer')) || (t === 'teamplayer' && traits.includes('loner'))) continue;
    traits.push(t);
  }
  return traits;
}

export function generateEmployee(
  state: GameState,
  species: SpeciesId,
  rng: Rng,
  opts: { level?: number; traits?: TraitId[]; name?: string } = {},
): Employee {
  const def = SPECIES[species];
  const level = opts.level ?? 1;
  const traits = opts.traits ?? rollTraits(rng, species, state.policies.includes('nepotism'));
  const base: Stats = {
    hp: Math.round(vary(rng, def.base.hp, 0.15)),
    atk: +vary(rng, def.base.atk, 0.15).toFixed(1),
    def: +vary(rng, def.base.def, 0.15).toFixed(1),
    spd: +vary(rng, def.base.spd, 0.15).toFixed(1),
    int: +vary(rng, def.base.int, 0.2).toFixed(1),
  };
  let salary = def.salary * (1 + 0.15 * (level - 1));
  if (traits.includes('golddigger')) salary *= 1.4;
  if (traits.includes('nepo')) salary *= 1.3;
  salary = Math.max(1, Math.round(vary(rng, salary, 0.1)));
  let name = opts.name ?? pick(rng, FIRST_NAMES[species]);
  if (!opts.name && species === 'skeleton' && name.startsWith('Skeleton #')) name = `Skeleton #${randInt(rng, 2, 99)}`;
  const emp: Employee = {
    id: nextId(state, 'e'),
    name,
    species,
    traits,
    base,
    hp: 0,
    morale: randInt(rng, 55, 75),
    fatigue: 0,
    salary,
    level,
    xp: 0,
    rank: level >= 4 ? 1 : 0,
    hue: randInt(rng, -25, 25),
    roomId: null,
    status: 'active',
    statusWeeks: 0,
    hiredWeek: state.week,
    kills: 0,
    weeksWorked: 0,
    bonus: 1,
    lastRaiseWeek: state.week,
  };
  emp.hp = Math.round(coreStats(emp).hp);
  return emp;
}

export function unlockedSpecies(state: GameState): SpeciesId[] {
  return SPECIES_ORDER.filter((s) => SPECIES[s].unlock <= state.dungeonLevel);
}

export function generateApplicants(state: GameState, rng: Rng, count = 5): Employee[] {
  const species = unlockedSpecies(state);
  const out: Employee[] = [];
  const nepo = state.policies.includes('nepotism');
  for (let i = 0; i < count; i++) {
    const sp = weightedPick(
      rng,
      species.map((s) => ({ item: s, weight: s === 'dragon' ? 0.6 : 10 / Math.sqrt(SPECIES[s].salary) + (SPECIES[s].unlock === state.dungeonLevel ? 2 : 0) })),
    );
    const maxLvl = 1 + Math.floor((state.dungeonLevel - 1) / 2) + (nepo ? 2 : 0);
    const minLvl = nepo ? 2 : 1;
    const level = randInt(rng, minLvl, Math.max(minLvl, maxLvl));
    out.push(generateEmployee(state, sp, rng, { level }));
  }
  // Guarantee at least one newly unlocked species shows up.
  const newest = species[species.length - 1];
  if (!out.some((e) => e.species === newest) && newest !== 'dragon') {
    out[out.length - 1] = generateEmployee(state, newest, rng, { level: 1 });
  }
  return out;
}

export function gainXp(e: Employee, amount: number, state: GameState): string[] {
  let mult = 1;
  if (hasTrait(e, 'quicklearner')) mult *= 1.5;
  if (hasTrait(e, 'overachiever')) mult *= 1.25;
  if (state.policies.includes('synergy')) mult *= 1.5;
  if (state.tech.includes('mentorship')) mult *= 1.3;
  e.xp += Math.round(amount * mult);
  const ups: string[] = [];
  while (e.xp >= xpToNext(e.level)) {
    e.xp -= xpToNext(e.level);
    e.level += 1;
    ups.push(`${e.name} reached level ${e.level}.`);
  }
  return ups;
}

export function isWorking(e: Employee, state: GameState): boolean {
  if (e.status !== 'active') return false;
  const room = getRoom(state, e.roomId);
  return !!room && room.zone === 'route';
}

export function trainingCost(e: Employee): number {
  return 25 + e.level * 20;
}

export function medicalSaveChance(state: GameState): number {
  // Most knockouts are injuries; the Medical Bay and tech make deaths rarer still.
  const med = hasRoom(state, 'medical');
  let p = 0.82;
  if (med) {
    p += 0.1 + med.level * 0.07;
    const medic = roomStaff(state, med.id).find((m) => m.status === 'active');
    if (medic) p += 0.05 * GRADE_MULT[suitability(medic.species, 'medical')] + coreStats(medic).int / 300;
  }
  if (state.tech.includes('teleport')) p += 0.15;
  if (state.policies.includes('rehire')) p += 0.2;
  return clamp(p, 0, 0.95);
}

export function researchPerWeek(state: GameState): number {
  let rp = 2;
  for (const lab of state.rooms.filter((r) => r.type === 'lab')) {
    const mult = 1 + (lab.level - 1) * 0.3;
    for (const r of roomStaff(state, lab.id)) {
      if (r.status !== 'active') continue;
      rp += (coreStats(r).int / 4) * GRADE_MULT[suitability(r.species, 'lab')] * moraleMult(r.morale) * mult;
    }
  }
  return Math.round(rp);
}

export function accountingBonus(state: GameState): number {
  const acc = hasRoom(state, 'accounting');
  if (!acc) return 0;
  let b = 0.05 + acc.level * 0.05;
  const staff = roomStaff(state, acc.id).find((a) => a.status === 'active');
  if (staff) b += 0.04 * GRADE_MULT[suitability(staff.species, 'accounting')] + coreStats(staff).int / 250;
  return b;
}

export function weeklyMoraleBase(state: GameState): number {
  let m = 0;
  m += roomLevelSum(state, 'breakroom') > 0 ? 2 + 2 * (hasRoom(state, 'breakroom')?.level ?? 0) : 0;
  if (hasRoom(state, 'cafeteria')) m += 2;
  if (state.tech.includes('posters')) m += 4;
  if (state.tech.includes('dental')) m += 3;
  return m;
}

export function roomDescForEmployee(e: Employee, state: GameState): string {
  const room = getRoom(state, e.roomId);
  if (!room) return 'Unassigned';
  return ROOMS[room.type].name;
}
