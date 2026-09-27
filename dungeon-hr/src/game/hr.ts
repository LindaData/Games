import { SPECIES } from './data';
import { hasRoom, hrRep } from './dungeon';
import { canPromote, coreStats, hasTrait, maxHp, nextId, title } from './employees';
import { chance, clamp, pick, randInt, shuffle, type Rng } from './rng';
import type { Employee, GameState, HrEvent, HrOption, MemorialEntry } from './types';

const UNION_DEMANDS = [
  { what: 'a dental plan', who: 'The skeletons have been very vocal.' },
  { what: 'torches that are not actively on fire', who: 'Three staff members have lost eyebrows.' },
  { what: 'a second microwave in the break room', who: 'The lunch-hour queue has resulted in two duels.' },
  { what: 'hazard pay for "adventurer season"', who: 'Which is all seasons.' },
  { what: 'ergonomic spikes', who: 'Apparently the old ones cause back pain.' },
  { what: 'a formal policy against being eaten by the mimic', who: 'The mimic abstained from the vote.' },
  { what: 'paid bereavement leave', who: 'Given the turnover rate, this is a big ask.' },
  { what: 'a coffin-to-work cycling scheme', who: 'The vampires insist it is about sustainability.' },
];

const DISPUTE_TOPICS = [
  'who keeps eating labelled lunches from the fridge',
  'the thermostat (one of them is cold-blooded)',
  'credit for last week\'s adventurer kill',
  'whether a hot dog is a sandwich',
  'loud chewing during the invasion briefing',
  'a stapler of disputed ownership',
  'reply-all etiquette',
];

const VIOLATIONS = [
  'an open pit with no guard rail (the entire point of the pit)',
  'expired fire extinguishers in the dragon\'s office',
  'bones on the floor constituting a tripping hazard (they are employees)',
  'insufficient signage indicating "certain death"',
  'the cafeteria stew achieving sentience',
];

const NEWS = [
  { title: 'Adventurers\' Guild Review', body: '★★☆☆☆ "Too many skeletons. Treasure was mid. Would raid again." — Chad, Level 4' },
  { title: 'Industry Newsletter', body: 'Dungeon Weekly ranks us #47 on its "Most Lethal Workplaces" list. Marketing wants to put it on a banner.' },
  { title: 'Memo from Legal', body: 'Reminder: the phrase "meat shield" is no longer permitted in job postings. Use "frontline engagement specialist".' },
  { title: 'Facilities Update', body: 'The coffee machine has been possessed again. Please do not make eye contact with it.' },
  { title: 'Board of Directors', body: 'The Board has noticed our results and would like a 12-slide deck explaining them. The Board has not specified whether this is praise.' },
  { title: 'Lost & Found', body: 'Found: one (1) +3 sword, one (1) adventurer hand still attached. Please claim by Friday.' },
];

export function empById(state: GameState, id?: string): Employee | undefined {
  return state.employees.find((e) => e.id === id);
}

function makeEvent(state: GameState, e: Omit<HrEvent, 'id'>): HrEvent {
  return { ...e, id: nextId(state, 'hr') };
}

/** Build this week's HR inbox. Mutates state only for ID allocation. */
export function generateHrEvents(state: GameState, rng: Rng, ctx: { mvpId?: string; worstId?: string; defended: boolean }): HrEvent[] {
  const out: HrEvent[] = [];
  const emps = shuffle(rng, state.employees);
  const used = new Set<string>();
  const push = (e: Omit<HrEvent, 'id'>) => {
    out.push(makeEvent(state, e));
    if (e.empId) used.add(e.empId);
    if (e.empId2) used.add(e.empId2);
  };

  // Resignation letters come first: they're urgent.
  for (const e of emps) {
    if (e.morale < 20 && chance(rng, 0.65)) {
      push({ kind: 'resignation', empId: e.id, from: e.name, title: `Resignation letter: ${e.name}`, body: `"Dear Management, after ${Math.max(1, state.week - e.hiredWeek)} weeks of service I have decided to pursue opportunities in a dungeon that values me. Please forward my final paycheck to my cave." — ${e.name}, ${title(e)} (morale ${Math.round(e.morale)})` });
    }
  }

  const candidates: (() => void)[] = [];
  const unionMembers = state.employees.filter((e) => hasTrait(e, 'union'));
  if (unionMembers.length && chance(rng, (0.25 + state.unionUnrest * 0.1) * (state.tech.includes('dental') ? 0.5 : 1))) {
    const organizer = pick(rng, unionMembers);
    const d = pick(rng, UNION_DEMANDS);
    const cost = 20 + state.employees.length * 6;
    candidates.push(() => push({ kind: 'union', empId: organizer.id, amount: cost, from: `${organizer.name} (Union Rep)`, title: `Union demand: ${d.what}`, body: `The Dungeon Workers' Union, led by ${organizer.name}, formally demands ${d.what}. ${d.who} Estimated cost: ${cost} gold.` }));
  }

  for (const e of emps) {
    if (used.has(e.id)) continue;
    const weeksSince = state.week - e.lastRaiseWeek;
    let raiseChance = hasTrait(e, 'golddigger') ? 0.35 : hasTrait(e, 'lazy') ? 0.04 : 0.1;
    if (e.morale < 50) raiseChance *= 1.5;
    if (weeksSince >= 3 && chance(rng, raiseChance)) {
      const pct = randInt(rng, 2, 5) * 5;
      candidates.push(() => push({ kind: 'raise', empId: e.id, amount: pct, from: e.name, title: `${e.name} wants a ${pct}% raise`, body: `${e.name} (${title(e)}, level ${e.level}) has requested a ${pct}% salary increase, citing "${pick(rng, ['inflation', 'market rates for monsters', 'three near-death experiences this month', 'a competing offer from the lich down the road', 'emotional damages', 'being really good at stabbing'])}". Current salary: ${e.salary}g/wk.` }));
      continue;
    }
    if (e.fatigue > 70 && hasTrait(e, 'overachiever') && chance(rng, 0.6)) {
      candidates.push(() => push({ kind: 'burnout', empId: e.id, from: 'Wellness Committee', title: `${e.name} is burning out`, body: `${e.name} has logged 97 hours this week and was found alphabetizing the bone pile at 3 AM. Fatigue: ${Math.round(e.fatigue)}%.` }));
      continue;
    }
    if (e.fatigue > 55 && chance(rng, 0.35)) {
      candidates.push(() => push({ kind: 'vacation', empId: e.id, from: e.name, title: `Vacation request: ${e.name}`, body: `${e.name} requests one week off to "${pick(rng, ['visit family in the Underdark', 'find themselves', 'attend a cousin\'s haunting', 'go to a spa (a swamp)', 'stare at a wall somewhere else'])}". Fatigue: ${Math.round(e.fatigue)}%.` }));
      continue;
    }
    if (hasTrait(e, 'hypochondriac') && chance(rng, hasRoom(state, 'medical') ? 0.15 : 0.35)) {
      candidates.push(() => push({ kind: 'sick', empId: e.id, from: e.name, title: `Sick leave: ${e.name}`, body: `${e.name} reports symptoms of "${pick(rng, ['dragon pox', 'a vague sense of doom', 'terminal Mondays', 'bone spurs (they are all bone)', 'lycanthropy, probably'])}" and requests a week of sick leave.` }));
      continue;
    }
    if (canPromote(e) && chance(rng, 0.25)) {
      candidates.push(() => push({ kind: 'promotion', empId: e.id, from: 'Talent Committee', title: `${e.name} is up for promotion`, body: `${e.name} (level ${e.level}) is eligible for promotion from ${title(e)}. Promotion: +8% stats, +20% salary, +20 morale.` }));
    }
  }

  const pairs = state.employees.filter((e) => !used.has(e.id));
  const gossip = pairs.find((e) => hasTrait(e, 'gossip'));
  if (pairs.length >= 2 && chance(rng, gossip ? 0.45 : 0.15)) {
    const a = gossip ?? pick(rng, pairs);
    const b = pick(rng, pairs.filter((x) => x.id !== a.id));
    const topic = pick(rng, DISPUTE_TOPICS);
    candidates.push(() => push({ kind: 'dispute', empId: a.id, empId2: b.id, from: 'Anonymous Tip Box', title: `Workplace dispute: ${a.name} vs ${b.name}`, body: `${a.name} and ${b.name} are feuding over ${topic}. Productivity in the surrounding area has dropped. Someone keyed a sarcophagus.` }));
  }

  if (ctx.defended && ctx.mvpId && !used.has(ctx.mvpId) && chance(rng, 0.45)) {
    const e = empById(state, ctx.mvpId)!;
    if (e) candidates.push(() => push({ kind: 'review', empId: e.id, from: 'Performance Management', title: `Performance review: ${e.name}`, body: `${e.name} was this week's top performer with ${e.kills} lifetime kills. How should we recognize their contribution?` }));
  }
  if (ctx.worstId && !used.has(ctx.worstId) && chance(rng, 0.3)) {
    const e = empById(state, ctx.worstId);
    if (e) candidates.push(() => push({ kind: 'pip', empId: e.id, from: 'Performance Management', title: `Underperformer: ${e.name}`, body: `${e.name} dealt almost no damage this week. Their manager describes them as "present, technically".` }));
  }
  if (state.week >= 3 && chance(rng, 0.12)) {
    const v = pick(rng, VIOLATIONS);
    const fine = 30 + state.week * 5;
    candidates.push(() => push({ kind: 'inspection', amount: fine, from: 'Dept. of Dungeon Health & Safety', title: 'Health & Safety inspection', body: `An inspector has cited us for ${v}. The fine is ${fine} gold.` }));
  }
  if (chance(rng, 0.25)) {
    const n = pick(rng, NEWS);
    candidates.push(() => push({ kind: 'news', from: n.title, title: n.title, body: n.body }));
  }

  // Keep the inbox manageable: resignations plus up to three other memos.
  for (const c of shuffle(rng, candidates).slice(0, Math.max(1, 3 - out.length))) c();
  return out;
}

export function hrOptions(state: GameState, ev: HrEvent): HrOption[] {
  const e = empById(state, ev.empId);
  const rep = hrRep(state);
  switch (ev.kind) {
    case 'raise': {
      const inc = e ? Math.max(1, Math.round((e.salary * (ev.amount ?? 10)) / 100)) : 0;
      return [
        { id: 'approve', label: 'Approve', desc: `+${inc}g/wk salary. +20 morale.` },
        { id: 'deny', label: 'Deny', desc: '−20 morale. They may start browsing job boards.' },
        { id: 'promote', label: 'Offer promotion instead', desc: e && canPromote(e) ? 'New title, +8% stats, +20% salary, +30 morale.' : `Requires level ${e ? 2 + e.rank * 2 : '?'}.`, disabled: !e || !canPromote(e) },
        { id: 'replace', label: 'Replace employee', desc: 'Terminate. −5 morale for everyone.' },
      ];
    }
    case 'union':
      return [
        { id: 'approve', label: `Approve (${ev.amount}g)`, desc: '+12 morale for everyone. Union placated.', disabled: state.gold < (ev.amount ?? 0) },
        { id: 'negotiate', label: `Negotiate (${Math.round((ev.amount ?? 0) / 2)}g)`, desc: rep ? `HR rep ${rep.name} leads talks: likely success.` : 'No HR rep on staff: 50/50 outcome.', disabled: state.gold < Math.round((ev.amount ?? 0) / 2) },
        { id: 'deny', label: 'Deny', desc: 'Union members may strike next week. −8 morale for everyone.' },
      ];
    case 'vacation':
      return [
        { id: 'approve', label: 'Approve', desc: 'Out for 1 week. Fatigue reset. +15 morale.' },
        { id: 'comp', label: 'Offer a spa voucher (15g)', desc: 'Stays on duty. −30 fatigue, +5 morale.', disabled: state.gold < 15 },
        { id: 'deny', label: 'Deny', desc: '−12 morale.' },
      ];
    case 'burnout':
      return [
        { id: 'force', label: 'Mandate vacation', desc: 'Out for 1 week. Fatigue reset. −5 morale ("but the KPIs!").' },
        { id: 'allow', label: 'Let them keep going', desc: '+10 morale, but fatigue keeps climbing.' },
      ];
    case 'sick':
      return [
        { id: 'approve', label: 'Approve sick leave', desc: 'Out for 1 week. +10 morale.' },
        { id: 'deny', label: '"Walk it off"', desc: '−10 morale. 25% chance they really were sick (injured).' },
      ];
    case 'resignation':
      return [
        { id: 'counter', label: 'Counter-offer', desc: e ? `+25% salary (+${Math.round(e.salary * 0.25)}g/wk). +35 morale.` : '' },
        { id: 'family', label: '"We\'re a family here"', desc: '50%: they stay (+10 morale). Otherwise they leave and everyone loses 5 morale.' },
        { id: 'accept', label: 'Accept resignation', desc: 'They leave. Frees a headcount slot.' },
      ];
    case 'dispute': {
      const b = empById(state, ev.empId2);
      return [
        { id: 'sideA', label: `Side with ${e?.name ?? '?'}`, desc: `${e?.name}: +10 morale. ${b?.name}: −15 morale.` },
        { id: 'sideB', label: `Side with ${b?.name ?? '?'}`, desc: `${b?.name}: +10 morale. ${e?.name}: −15 morale.` },
        { id: 'mediate', label: 'Mediation session', desc: rep ? `${rep.name} mediates: both +8 morale.` : 'No HR rep: 50% both +5, else both −8.' },
        { id: 'desk', label: 'Make them share a desk', desc: '−10 morale each. 40% they become Team Players.' },
      ];
    }
    case 'review':
      return [
        { id: 'plaque', label: 'Employee of the Week plaque', desc: '+15 morale. Free!' },
        { id: 'bonus', label: `Cash bonus (${30 + (e?.level ?? 1) * 10}g)`, desc: '+30 morale. +40 XP.', disabled: state.gold < 30 + (e?.level ?? 1) * 10 },
        { id: 'pizza', label: 'Pizza for the whole team (25g)', desc: '+6 morale for everyone.', disabled: state.gold < 25 },
      ];
    case 'pip':
      return [
        { id: 'pip', label: 'Performance Improvement Plan', desc: '+60 XP from "motivation". −15 morale.' },
        { id: 'coach', label: 'Pay for coaching (40g)', desc: '+80 XP. +5 morale.', disabled: state.gold < 40 },
        { id: 'fire', label: 'Let them go', desc: 'Terminate. −5 morale for everyone.' },
        { id: 'ignore', label: 'They\'re doing their best', desc: '+5 morale. Nothing changes.' },
      ];
    case 'promotion':
      return [
        { id: 'promote', label: 'Promote', desc: '+8% stats, +20% salary, +20 morale.' },
        { id: 'wait', label: 'Not this cycle', desc: '−8 morale.' },
      ];
    case 'inspection': {
      const hasMimic = state.employees.some((x) => x.species === 'mimic' && x.status === 'active');
      return [
        { id: 'pay', label: `Pay fine (${ev.amount}g)`, desc: 'Compliance achieved.' },
        { id: 'bribe', label: `"Consulting fee" (${Math.round((ev.amount ?? 0) * 0.5)}g)`, desc: '70% he looks the other way, 30% the fine doubles.' },
        { id: 'mimic', label: 'Show him the "treasure chest"', desc: hasMimic ? '60% the problem goes away. 40% lawsuit (fine ×2). Mimic +10 morale.' : 'Requires a Mimic on staff.', disabled: !hasMimic },
      ];
    }
    case 'news':
      return [{ id: 'ok', label: 'Acknowledge', desc: 'File under "Noted".' }];
  }
}

function addMorale(e: Employee | undefined, d: number) {
  if (e) e.morale = clamp(e.morale + d, 0, 100);
}

function allMorale(state: GameState, d: number) {
  for (const e of state.employees) addMorale(e, d);
}

export function removeEmployee(state: GameState, id: string, kind: MemorialEntry['kind'], cause: string) {
  const e = empById(state, id);
  if (!e) return;
  state.employees = state.employees.filter((x) => x.id !== id);
  state.memorial.unshift({ name: e.name, species: e.species, week: state.week, cause, kind });
  if (state.memorial.length > 60) state.memorial.length = 60;
}

export function terminate(state: GameState, id: string): string {
  const e = empById(state, id);
  if (!e) return '';
  removeEmployee(state, id, 'terminated', 'Terminated by management');
  const hit = hasTrait(e, 'nepo') ? 15 : 5;
  allMorale(state, -hit);
  return hasTrait(e, 'nepo')
    ? `${e.name} has been let go. Their uncle is furious. Everyone loses ${hit} morale.`
    : `${e.name} has been escorted out by security (who are also monsters). −${hit} morale for all.`;
}

export function promote(e: Employee) {
  e.rank += 1;
  e.bonus *= 1.08;
  e.salary = Math.round(e.salary * 1.2);
  e.lastRaiseWeek = Math.max(e.lastRaiseWeek, 0);
}

function xp(e: Employee | undefined, amount: number) {
  if (!e) return;
  e.xp += amount;
}

/** Applies an HR decision. Returns an outcome message. */
export function resolveHr(state: GameState, ev: HrEvent, option: string, rng: Rng): string {
  const e = empById(state, ev.empId);
  const rep = hrRep(state);
  switch (ev.kind) {
    case 'raise':
      if (!e) return 'The employee is no longer with us. Problem solved, technically.';
      if (option === 'approve') {
        const inc = Math.max(1, Math.round((e.salary * (ev.amount ?? 10)) / 100));
        e.salary += inc;
        e.lastRaiseWeek = state.week;
        addMorale(e, 20);
        return `${e.name}'s salary is now ${e.salary}g/wk. They celebrate by buying a slightly nicer loincloth.`;
      }
      if (option === 'deny') {
        addMorale(e, -20);
        e.lastRaiseWeek = state.week;
        return `${e.name} says "that's fine" in the tone that means it is not fine. −20 morale.`;
      }
      if (option === 'promote') {
        promote(e);
        e.lastRaiseWeek = state.week;
        addMorale(e, 30);
        return `${e.name} is now a ${title(e)}! They've already updated their LinkedIn.`;
      }
      return terminate(state, e.id);
    case 'union': {
      const cost = ev.amount ?? 0;
      if (option === 'approve') {
        state.gold -= cost;
        allMorale(state, 12);
        state.unionUnrest = 0;
        return 'The union declares victory. Morale soars. Someone makes a banner.';
      }
      if (option === 'negotiate') {
        state.gold -= Math.round(cost / 2);
        const ok = rep ? chance(rng, 0.85) : chance(rng, 0.5);
        if (ok) {
          allMorale(state, 7);
          state.unionUnrest = Math.max(0, state.unionUnrest - 1);
          return `After 14 hours of talks${rep ? ` led by ${rep.name}` : ''}, a compromise is reached. +7 morale for all.`;
        }
        allMorale(state, -4);
        state.unionUnrest += 1;
        return 'Talks collapse over the shape of the negotiating table. −4 morale for all.';
      }
      allMorale(state, -8);
      state.unionUnrest += 1;
      const members = state.employees.filter((x) => hasTrait(x, 'union'));
      const strikers: string[] = [];
      for (const m of members) {
        if (m.status === 'active' && chance(rng, 0.6)) {
          m.status = 'strike';
          m.statusWeeks = 1;
          strikers.push(m.name);
        }
      }
      return strikers.length
        ? `Demand denied. ${strikers.join(', ')} ${strikers.length > 1 ? 'are' : 'is'} on strike next week. Picket signs read "NO SPIKES WITHOUT RIGHTS".`
        : 'Demand denied. The union grumbles but shows up. −8 morale for all.';
    }
    case 'vacation':
      if (!e) return 'Moot.';
      if (option === 'approve') {
        e.status = 'vacation';
        e.statusWeeks = 1;
        e.fatigue = 0;
        addMorale(e, 15);
        return `${e.name} is out of office. Their auto-reply is just a skull emoji.`;
      }
      if (option === 'comp') {
        state.gold -= 15;
        e.fatigue = Math.max(0, e.fatigue - 30);
        addMorale(e, 5);
        return `${e.name} enjoys a mud bath (it was just the swamp). Feels refreshed.`;
      }
      addMorale(e, -12);
      return `${e.name} cancels their plans and quietly updates their résumé.`;
    case 'burnout':
      if (!e) return 'Moot.';
      if (option === 'force') {
        e.status = 'vacation';
        e.statusWeeks = 1;
        e.fatigue = 0;
        addMorale(e, -5);
        return `${e.name} is escorted off the premises for mandatory relaxation. They bring a laptop anyway.`;
      }
      addMorale(e, 10);
      e.fatigue = clamp(e.fatigue + 10, 0, 100);
      return `${e.name} is thrilled. Their eye has started twitching.`;
    case 'sick':
      if (!e) return 'Moot.';
      if (option === 'approve') {
        e.status = 'sick';
        e.statusWeeks = 1;
        addMorale(e, 10);
        return `${e.name} goes home to rest. Their doctor is also a hypochondriac.`;
      }
      addMorale(e, -10);
      if (chance(rng, 0.25)) {
        e.status = 'injured';
        e.statusWeeks = 1;
        e.hp = Math.max(1, Math.round(maxHp(e, state) * 0.4));
        return `Turns out ${e.name} really was sick. They collapse during stand-up. Out for a week.`;
      }
      return `${e.name} walks it off, sniffling dramatically.`;
    case 'resignation':
      if (!e) return 'They already left.';
      if (option === 'counter') {
        e.salary = Math.round(e.salary * 1.25);
        e.lastRaiseWeek = state.week;
        addMorale(e, 35);
        return `${e.name} accepts the counter-offer. They'll be back in this inbox in six weeks.`;
      }
      if (option === 'family') {
        if (chance(rng, 0.5)) {
          addMorale(e, 10);
          return `${e.name} tears up. "Nobody's ever called me family before." They stay.`;
        }
        removeEmployee(state, e.id, 'resigned', 'Did not feel like family');
        allMorale(state, -5);
        return `${e.name}: "Families don't make you fight paladins." They leave. −5 morale for all.`;
      }
      removeEmployee(state, e.id, 'resigned', 'Resigned (morale)');
      return `${e.name} hands in their badge and leaves a 1-star review on Dungeondoor.`;
    case 'dispute': {
      const b = empById(state, ev.empId2);
      if (option === 'sideA') {
        addMorale(e, 10);
        addMorale(b, -15);
        return `${e?.name ?? 'They'} gloat${e ? 's' : ''}. ${b?.name ?? 'The other one'} starts a passive-aggressive sticky note campaign.`;
      }
      if (option === 'sideB') {
        addMorale(b, 10);
        addMorale(e, -15);
        return `${b?.name ?? 'They'} wins. ${e?.name ?? 'The other one'} "forgets" to invite them to the next skull-toast.`;
      }
      if (option === 'mediate') {
        if (rep || chance(rng, 0.5)) {
          addMorale(e, rep ? 8 : 5);
          addMorale(b, rep ? 8 : 5);
          return `A trust-fall exercise resolves the dispute. Nobody was dropped (on purpose).`;
        }
        addMorale(e, -8);
        addMorale(b, -8);
        return 'The mediation session becomes a second, larger dispute.';
      }
      addMorale(e, -10);
      addMorale(b, -10);
      if (chance(rng, 0.4)) {
        for (const x of [e, b]) {
          if (x && !x.traits.includes('teamplayer') && !x.traits.includes('loner')) x.traits.push('teamplayer');
        }
        return 'Forced proximity works! They are now inseparable. Both gain Team Player.';
      }
      return 'They build a wall of ledgers down the middle of the desk.';
    }
    case 'review':
      if (!e) return 'Moot.';
      if (option === 'plaque') {
        addMorale(e, 15);
        return `${e.name} hangs the plaque above their bunk. It says "Employee of the Week" and nothing else. Perfect.`;
      }
      if (option === 'bonus') {
        state.gold -= 30 + e.level * 10;
        addMorale(e, 30);
        xp(e, 40);
        return `${e.name} receives a sack of gold and immediately spends it on sharpening stones.`;
      }
      state.gold -= 25;
      allMorale(state, 6);
      return 'Pizza party! The skeletons can\'t eat, but they appreciate the gesture.';
    case 'pip':
      if (!e) return 'Moot.';
      if (option === 'pip') {
        addMorale(e, -15);
        xp(e, 60);
        return `${e.name} signs the PIP with a trembling claw. They are very motivated now.`;
      }
      if (option === 'coach') {
        state.gold -= 40;
        addMorale(e, 5);
        xp(e, 80);
        return `${e.name} attends "Stabbing With Purpose: A Masterclass". Notes were taken.`;
      }
      if (option === 'fire') return terminate(state, e.id);
      addMorale(e, 5);
      return `${e.name} is grateful for your patience.`;
    case 'promotion':
      if (!e) return 'Moot.';
      if (option === 'promote') {
        promote(e);
        addMorale(e, 20);
        return `Congratulations to ${e.name}, our new ${title(e)}! Cake is in the break room (it's a trap).`;
      }
      addMorale(e, -8);
      return `${e.name} is told "next cycle". They've heard that before.`;
    case 'inspection': {
      const fine = ev.amount ?? 0;
      if (option === 'pay') {
        state.gold -= fine;
        return 'Fine paid. The inspector puts a sticker on the pit. It now says "Caution: Pit".';
      }
      if (option === 'bribe') {
        state.gold -= Math.round(fine * 0.5);
        if (chance(rng, 0.7)) return 'The inspector pockets the "consulting fee" and notes "Exemplary".';
        state.gold -= fine * 2;
        return `The inspector was wearing a wire. Fine doubled: −${fine * 2}g more.`;
      }
      const mimic = state.employees.find((x) => x.species === 'mimic' && x.status === 'active');
      addMorale(mimic, 10);
      if (chance(rng, 0.6)) return `The inspector opens the chest. ${mimic?.name ?? 'The mimic'} has a lovely lunch. Inspection closed.`;
      state.gold -= fine * 2;
      return `The inspector escapes with a limp and a lawyer. −${fine * 2}g.`;
    }
    case 'news':
      return 'Filed.';
  }
}

export function speciesLabel(e: Employee): string {
  return SPECIES[e.species].name;
}

export { coreStats };
