import { generateParty, isBossWeek } from './adventurers';
import { LEVEL_UNLOCKS, POLICIES, ROOMS, dungeonXpToNext } from './data';
import { getRoom, hasRoom, refreshSlots, roomStaff, vaultRoom } from './dungeon';
import {
  accountingBonus,
  gainXp,
  generateApplicants,
  hasTrait,
  maxHp,
  researchPerWeek,
  weeklyMoraleBase,
  weeklySalary,
} from './employees';
import { generateHrEvents, removeEmployee } from './hr';
import { clamp, type Rng } from './rng';
import type { SimResult } from './sim';
import type { GameState, Party, WeekSummary } from './types';

export const PROBATION_WEEKS = 4;

/**
 * Applies the results of an invasion and advances the calendar by one week.
 * Mutates `state` (callers pass a clone) and returns the weekly report.
 */
export function applyInvasion(state: GameState, party: Party, sim: SimResult, rng: Rng): WeekSummary {
  const defended = sim.outcome === 'defended';
  const notes: string[] = [];
  const levelUps: string[] = [];
  const departures: string[] = [];
  const performance: WeekSummary['performance'] = [];

  // 1. Status timers from last week tick down (those employees sat this invasion out).
  for (const e of state.employees) {
    if (e.status !== 'active') {
      e.statusWeeks -= 1;
      if (e.statusWeeks <= 0) {
        if (e.status === 'injured') e.hp = maxHp(e, state);
        e.status = 'active';
        e.statusWeeks = 0;
      }
    }
  }

  // 2. Combat outcomes.
  const deadRooms = new Set<string>();
  for (const [id, r] of Object.entries(sim.emp)) {
    const e = state.employees.find((x) => x.id === id);
    if (!e) continue;
    const xpGain = r.fought ? 20 + r.kills * 20 + Math.round(r.damage / 5) : 10;
    const ups = gainXp(e, xpGain, state);
    levelUps.push(...ups);
    e.kills += r.kills;
    if (r.fought) e.weeksWorked += 1;
    performance.push({
      id: e.id,
      name: e.name,
      species: e.species,
      damage: r.damage,
      kills: r.kills,
      xp: xpGain,
      outcome: r.died ? 'Deceased' : r.injured ? 'Injured' : r.fled ? 'Fled' : r.fought ? 'On duty' : 'Standby',
    });
    if (r.died) {
      if (e.roomId) deadRooms.add(e.roomId);
      removeEmployee(state, e.id, 'fatality', sim.incidents.find((i) => i.employee === e.name && i.fatal)?.cause ?? 'Adventurers');
      state.stats.fatalities += 1;
      continue;
    }
    e.hp = Math.max(1, r.hp);
    if (r.injured) {
      e.morale -= 8;
      if (hasRoom(state, 'medical')) {
        notes.push(`${e.name} was patched up in the Medical Bay and is cleared for duty.`);
      } else if (rng() < 0.5) {
        e.status = 'injured';
        e.statusWeeks = 1;
        notes.push(`${e.name} is on medical leave next week. (A Medical Bay would have them back on shift immediately.)`);
      } else {
        e.hp = Math.max(1, Math.round(maxHp(e, state) * 0.2));
        notes.push(`${e.name} insists on walking it off. They'll start next week bruised.`);
      }
    }
    if (r.fled) e.morale -= 4;
  }
  const deaths = sim.incidents.filter((i) => i.fatal).length;
  if (deaths) notes.push(`${deaths} workplace fatalit${deaths > 1 ? 'ies' : 'y'} this week. Grief counselling is available (it's a goblin with a pamphlet).`);

  // 3. Weekly upkeep for everyone: fatigue, training, healing.
  const medical = hasRoom(state, 'medical');
  for (const e of state.employees) {
    const room = getRoom(state, e.roomId);
    const fought = sim.emp[e.id]?.fought;
    let fatigueGain = 0;
    if (e.status === 'vacation') e.fatigue = 0;
    else if (room?.type === 'breakroom') fatigueGain = -45;
    else if (fought) fatigueGain = 14;
    else if (room?.zone === 'route') fatigueGain = 6;
    else if (room?.type === 'training') fatigueGain = 6;
    else if (room) fatigueGain = 4;
    else fatigueGain = -25;
    if (fatigueGain > 0) {
      if (hasTrait(e, 'overachiever')) fatigueGain *= 2;
      if (state.tech.includes('ergonomic')) fatigueGain *= 0.65;
      if (state.policies.includes('fourday')) fatigueGain *= 0.5;
      if (state.policies.includes('fun')) fatigueGain += 5;
    }
    e.fatigue = clamp(e.fatigue + fatigueGain, 0, 100);

    if (room?.type === 'training' && e.status === 'active') {
      levelUps.push(...gainXp(e, 30 + room.level * 20, state));
    }
    const mhp = maxHp(e, state);
    e.hp = medical ? mhp : Math.min(mhp, e.hp + Math.round(mhp * 0.6));
  }

  // 4. Morale.
  const base = weeklyMoraleBase(state);
  const policyMorale = state.policies.reduce((s, id) => s + (POLICIES.find((p) => p.id === id)?.morale ?? 0), 0);
  for (const e of state.employees) {
    const room = getRoom(state, e.roomId);
    let d = base + (defended ? 2 : -6);
    if (state.policies.includes('fun') && (hasTrait(e, 'loner') || hasTrait(e, 'lazy'))) d += policyMorale - 20;
    else d += policyMorale;
    if (hasTrait(e, 'lazy')) d += 3;
    if (hasTrait(e, 'bloodthirsty') && room?.zone === 'office') d -= 6;
    if (room?.type === 'breakroom') d += 8;
    if (e.fatigue > 70) d -= 6;
    if (!room) d -= 2;
    if (deaths) d -= 3 * Math.min(3, deaths);
    if (e.roomId && deadRooms.has(e.roomId)) d -= 8;
    // Gentle drift toward neutral keeps things from pinning at extremes.
    d += (50 - e.morale) * 0.1;
    e.morale = clamp(e.morale + d, 0, 100);
  }
  // Gossip spreads mood to roommates.
  for (const g of state.employees.filter((e) => hasTrait(e, 'gossip') && e.roomId)) {
    for (const o of roomStaff(state, g.roomId!)) {
      if (o.id !== g.id) o.morale = clamp(o.morale + (g.morale - o.morale) * 0.25, 0, 100);
    }
  }

  // 5. Finances.
  const bounty = defended ? party.bounty : 0;
  const lootGold = sim.loot;
  const accPct = accountingBonus(state);
  const accountingGold = Math.round((bounty + lootGold) * accPct);
  state.gold += bounty + lootGold + accountingGold;
  state.stats.goldEarned += bounty + lootGold + accountingGold;

  let policyCost = 0;
  if (state.policies.includes('pizza')) policyCost += 4 * state.employees.length;
  if (state.policies.includes('rehire')) policyCost += 30 * sim.revivals;
  state.gold -= policyCost;

  let payrollTotal = 0;
  let unpaid = 0;
  for (const e of [...state.employees].sort((a, b) => a.salary - b.salary)) {
    const s = weeklySalary(e, state);
    if (state.gold >= s) {
      state.gold -= s;
      payrollTotal += s;
    } else {
      unpaid += 1;
      e.morale = clamp(e.morale - 25, 0, 100);
    }
  }
  if (unpaid) {
    notes.push(`${unpaid} employee${unpaid > 1 ? 's were' : ' was'} not paid this week. The union has been notified (by them).`);
    state.unionUnrest += 1;
  }

  // Thieves take a cut of whatever is left after payroll.
  let stolen = 0;
  if (!defended) {
    const vault = vaultRoom(state);
    const pct = Math.max(10, 30 - (vault.level - 1) * 5) / 100;
    stolen = Math.max(0, Math.min(state.gold, Math.max(20, Math.round(state.gold * pct))));
    state.gold -= stolen;
  }

  const researchGained = researchPerWeek(state);
  state.research += researchGained;

  // 6. Immediate resignations (rock-bottom morale).
  for (const e of [...state.employees]) {
    if (e.morale <= 5) {
      removeEmployee(state, e.id, 'resigned', 'Walked out (morale 0)');
      departures.push(`${e.name} walked out mid-shift, taking a stapler and three torches.`);
    }
  }

  // 7. Dungeon progression.
  const xpGained = defended ? 12 + sim.slain * 3 + (party.boss ? 15 : 0) : 4;
  state.dungeonXp += xpGained;
  let dungeonLevelUp: number | null = null;
  while (state.dungeonXp >= dungeonXpToNext(state.dungeonLevel)) {
    state.dungeonXp -= dungeonXpToNext(state.dungeonLevel);
    state.dungeonLevel += 1;
    dungeonLevelUp = state.dungeonLevel;
  }
  if (dungeonLevelUp) refreshSlots(state);

  // 8. Board confidence.
  if (defended) {
    state.stats.defenses += 1;
    state.defenseStreak += 1;
    if (state.defenseStreak >= 2 && state.board < 3) {
      state.board += 1;
      state.defenseStreak = 0;
      notes.push('Two clean weeks in a row: the Board regains some confidence.');
    }
  } else {
    state.stats.breaches += 1;
    state.defenseStreak = 0;
    if (state.week <= PROBATION_WEEKS) {
      notes.push(`Probationary period: the Board is overlooking this breach (${PROBATION_WEEKS - state.week} forgiving week${PROBATION_WEEKS - state.week === 1 ? '' : 's'} left).`);
    } else {
      state.board -= 1;
      notes.push(`The Board is displeased. Board confidence: ${Math.max(0, state.board)}/3.`);
    }
  }
  state.stats.slain += sim.slain;
  if (party.boss && defended) notes.push('Quarterly Audit survived! The Board sends a fruit basket (it is mostly skulls).');

  const worked = performance.filter((p) => p.outcome !== 'Standby');
  const mvpP = [...worked].filter((p) => p.outcome !== 'Deceased').sort((a, b) => b.kills * 40 + b.damage - (a.kills * 40 + a.damage))[0];
  const worstP = [...worked].filter((p) => p.outcome === 'On duty').sort((a, b) => a.damage - b.damage)[0];

  const summary: WeekSummary = {
    week: state.week,
    outcome: sim.outcome,
    partyName: party.name,
    night: party.night,
    bounty,
    loot: lootGold,
    stolen,
    payroll: payrollTotal,
    unpaid,
    policyCost,
    accountingBonus: accountingGold,
    researchGained,
    xpGained,
    slain: sim.slain,
    partySize: party.members.length,
    incidents: sim.incidents,
    levelUps,
    departures,
    notes,
    mvp: mvpP && (mvpP.damage > 0 || mvpP.kills > 0) ? { name: mvpP.name, kills: mvpP.kills, damage: mvpP.damage } : null,
    dungeonLevelUp,
    performance,
  };

  if (state.board <= 0) {
    state.gameOverReason = 'After repeated treasury breaches, the Board of Directors has approved a hostile takeover. You have been offered a lateral move to "Pit Supervisor".';
    state.phase = 'gameover';
    state.lastSummary = summary;
    return summary;
  }

  // 9. HR inbox, next week.
  state.hrInbox = generateHrEvents(state, rng, {
    mvpId: mvpP && mvpP.outcome !== 'Deceased' ? mvpP.id : undefined,
    worstId: worstP && worstP.damage < 8 ? worstP.id : undefined,
    defended,
  });
  state.week += 1;
  state.applicants = generateApplicants(state, rng, 5);
  state.nextParty = generateParty(state, rng);
  state.lastSummary = summary;
  state.phase = 'report';
  if (dungeonLevelUp) {
    const unlocks = Object.entries(LEVEL_UNLOCKS)
      .filter(([lvl]) => Number(lvl) <= dungeonLevelUp! && Number(lvl) > dungeonLevelUp! - 1)
      .flatMap(([, u]) => u);
    if (unlocks.length) notes.push(`Unlocked: ${unlocks.join(', ')}.`);
  }
  if (isBossWeek(state.week)) notes.push('Heads up: next week is the Quarterly Audit (boss wave).');
  return summary;
}

export function roomNameOf(state: GameState, id: string | null): string {
  const r = getRoom(state, id);
  return r ? ROOMS[r.type].name : 'Unassigned';
}
