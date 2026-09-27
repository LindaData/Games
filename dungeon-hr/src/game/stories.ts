/**
 * Extra HR memo types: relationship feuds, poaching, birthdays, the suggestion
 * box, retirement, and one-off story beats (merger offer, audit prep).
 */
import { isBossWeek } from './adventurers';
import { headcountLimit, hrRep, roomStaff } from './dungeon';
import { canPromote, generateEmployee, powerRating, title, unlockedSpecies } from './employees';
import { addMorale, allMorale, empById, promote, removeEmployee } from './hr';
import { adjustRel, randomRivalPairInRoom } from './relations';
import { chance, pick, type Rng } from './rng';
import type { GameState, HrEvent, HrOption } from './types';

type NewEvent = Omit<HrEvent, 'id'>;

export const SUGGESTIONS = [
  { title: 'Install slides between floors', body: 'Faster commutes and "a sense of whimsy". Cost: 40 gold.', cost: 40 },
  { title: 'Replace torches with mood lighting', body: 'Research suggests ambience improves thinking. The research was done by the person suggesting it. Cost: 30 gold.', cost: 30 },
  { title: 'Bring Your Pet to Work Day', body: 'Everyone brings a pet. Free. What could go wrong?', cost: 0 },
  { title: 'Standing desks for the skeletons', body: 'They have excellent posture already, but they want to feel included. Cost: 25 gold.', cost: 25 },
  { title: 'A company newsletter', body: '"The Dungeon Digest": staff spotlights, recipes, obituaries. Cost: 15 gold.', cost: 15 },
];

function once(state: GameState, flag: string): boolean {
  if (state.flags.includes(flag)) return false;
  state.flags.push(flag);
  return true;
}

/**
 * Candidate story memos. `forced` always lands in the inbox; `optional` competes
 * with the regular memos for the limited inbox space.
 */
export function storyCandidates(state: GameState, rng: Rng, used: Set<string>): { forced: NewEvent[]; optional: NewEvent[] } {
  const forced: NewEvent[] = [];
  const optional: NewEvent[] = [];
  const free = state.employees.filter((e) => !used.has(e.id));

  // Next week is the Quarterly Audit: always give the player a say in how to prepare.
  if (isBossWeek(state.week + 1)) {
    forced.push({
      kind: 'auditprep',
      from: 'Office of the Board',
      title: 'The Quarterly Audit is next week',
      body: 'A heavily armed audit team arrives next week. The Board would like to know how you intend to "demonstrate value". Whatever you choose applies to next week\'s invasion only.',
    });
  }

  if (state.dungeonLevel >= 3 && state.week >= 10 && !state.flags.includes('merger') && chance(rng, 0.35) && once(state, 'merger')) {
    forced.push({
      kind: 'merger',
      from: 'Lich Consolidated Holdings',
      title: 'Merger offer from Lich Consolidated',
      body: 'Our undead competitor down the valley proposes a "merger of equals" (it is not). They offer 100 gold and two of their employees, in exchange for "synergies". Our staff are nervous.',
    });
  }

  const feud = randomRivalPairInRoom(state, rng);
  if (feud && !used.has(feud[0].id) && !used.has(feud[1].id) && chance(rng, 0.6)) {
    const [a, b] = feud;
    optional.push({
      kind: 'feud',
      empId: a.id,
      empId2: b.id,
      from: 'Floor Supervisor',
      title: `Feud escalating: ${a.name} vs ${b.name}`,
      body: `${a.name} and ${b.name} work in the same room and can't stand each other. Productivity is down; passive-aggressive sticky notes are up. Rivals in the same room fight 8% worse each.`,
    });
  }

  const star = [...free].filter((e) => e.level >= 3).sort((x, y) => powerRating(y) - powerRating(x))[0];
  if (star && state.week >= 6 && chance(rng, 0.12)) {
    optional.push({
      kind: 'poach',
      empId: star.id,
      from: 'Anonymous Tip Box',
      title: `A rival dungeon is poaching ${star.name}`,
      body: `The Crypt of Eternal Synergy has offered ${star.name} a corner coffin and 30% more pay. They haven't said yes. Yet.`,
    });
  }

  if (free.length && chance(rng, 0.15)) {
    const e = pick(rng, free);
    optional.push({
      kind: 'birthday',
      empId: e.id,
      from: 'Social Committee',
      title: `It's ${e.name}'s birthday`,
      body: `${e.name} is turning ${e.species === 'dragon' || e.species === 'vampire' ? 'several hundred' : e.species === 'skeleton' ? '"undisclosed"' : 'another year older'} this week. The Social Committee asks whether there is a cake budget.`,
    });
  }

  if (chance(rng, 0.12)) {
    const idx = Math.floor(rng() * SUGGESTIONS.length);
    const sg = SUGGESTIONS[idx];
    optional.push({ kind: 'suggestion', amount: idx, from: 'Suggestion Box', title: `Suggestion: ${sg.title}`, body: sg.body });
  }

  const veteran = free.find((e) => e.weeksWorked >= 12 && e.level >= 5);
  if (veteran && chance(rng, 0.2)) {
    optional.push({
      kind: 'retirement',
      empId: veteran.id,
      amount: veteran.salary * 6,
      from: veteran.name,
      title: `${veteran.name} is thinking about retiring`,
      body: `After ${veteran.weeksWorked} weeks of service, ${veteran.name} (${title(veteran)}) would like to retire to a quiet swamp. They have hinted that a generous send-off would be appreciated.`,
    });
  }
  return { forced, optional };
}

export function storyOptions(state: GameState, ev: HrEvent): HrOption[] {
  const e = empById(state, ev.empId);
  const b = empById(state, ev.empId2);
  const rep = hrRep(state);
  switch (ev.kind) {
    case 'feud':
      return [
        { id: 'transfer', label: `Move ${b?.name ?? 'one of them'} to the bench`, desc: 'Separates them. You can reassign them on the floor plan.' },
        { id: 'retreat', label: 'Team-building retreat (40g)', desc: 'Relationship +35, both +5 morale.', disabled: state.gold < 40 },
        { id: 'ignore', label: 'Let them sort it out', desc: 'Both −8 morale and the feud gets worse.' },
      ];
    case 'poach':
      return [
        { id: 'match', label: `Match the offer (+${e ? Math.round(e.salary * 0.3) : '?'}g/wk)`, desc: '+30% salary, +15 morale.' },
        { id: 'promote', label: 'Counter with a promotion', desc: e && canPromote(e) ? 'New title, +8% stats, +20% salary, +25 morale.' : 'Not eligible for promotion yet.', disabled: !e || !canPromote(e) },
        { id: 'nda', label: 'Remind them about the (cursed) NDA', desc: '60%: they stay, −15 morale. 40%: they leave anyway.' },
        { id: 'release', label: 'Wish them well', desc: 'They leave. Frees a headcount slot.' },
      ];
    case 'birthday':
      return [
        { id: 'cake', label: 'Cake for the whole room (10g)', desc: 'Birthday employee +12 morale; roommates +6 and bond with them.', disabled: state.gold < 10 },
        { id: 'card', label: 'A card signed by everyone', desc: '+5 morale. Free.' },
        { id: 'ignore', label: 'Forget about it', desc: '−12 morale. They noticed.' },
      ];
    case 'suggestion': {
      const sg = SUGGESTIONS[ev.amount ?? 0];
      return [
        { id: 'implement', label: sg.cost ? `Implement (${sg.cost}g)` : 'Implement', desc: 'See what happens.', disabled: state.gold < sg.cost },
        { id: 'decline', label: 'Thank them and decline', desc: 'Nothing happens. The box stays hungry.' },
      ];
    }
    case 'merger':
      return [
        { id: 'accept', label: 'Accept the merger', desc: '+100g and two new employees (if headcount allows), but −10 morale for everyone ("culture clash").' },
        { id: 'negotiate', label: 'Negotiate a cash buyout', desc: rep ? `${rep.name} handles it: +200g, no new staff, no culture clash.` : 'Requires a staffed HR Office.', disabled: !rep },
        { id: 'reject', label: 'Reject: "We are a family"', desc: '+8 morale for everyone.' },
      ];
    case 'auditprep':
      return [
        { id: 'overtime', label: 'Mandatory overtime', desc: 'Next invasion: +12% attack. Everyone gains 20 fatigue.' },
        { id: 'consultants', label: 'Hire security consultants (60g)', desc: 'Next invasion: +15% defense, +5% attack.', disabled: state.gold < 60 },
        { id: 'speech', label: 'Give a motivational speech', desc: 'Free. +6 morale for everyone. There is a slideshow.' },
      ];
    case 'retirement':
      return [
        { id: 'parachute', label: `Golden parachute (${ev.amount}g)`, desc: 'They retire happily. Everyone +8 morale.', disabled: state.gold < (ev.amount ?? 0) },
        { id: 'stay', label: 'Beg them to stay', desc: '+20% salary, +15 morale.' },
        { id: 'myth', label: '"Retirement is a myth"', desc: '−20 morale. They stay (for now).' },
      ];
    default:
      return [{ id: 'ok', label: 'Acknowledge', desc: 'Filed.' }];
  }
}

export function resolveStory(state: GameState, ev: HrEvent, option: string, rng: Rng): string {
  const e = empById(state, ev.empId);
  const b = empById(state, ev.empId2);
  switch (ev.kind) {
    case 'feud':
      if (!e || !b) return 'One of them already left. Problem solved.';
      if (option === 'transfer') {
        b.roomId = null;
        adjustRel(state, e.id, b.id, 5);
        return `${b.name} has been moved to the bench. ${e.name} claims the good chair.`;
      }
      if (option === 'retreat') {
        state.gold -= 40;
        adjustRel(state, e.id, b.id, 35);
        addMorale(e, 5);
        addMorale(b, 5);
        return 'Two days of rope courses and trust exercises in a swamp. They came back… tolerating each other.';
      }
      adjustRel(state, e.id, b.id, -10);
      addMorale(e, -8);
      addMorale(b, -8);
      return 'The sticky-note war escalates to a sticky-note arms race.';
    case 'poach':
      if (!e) return 'They already left.';
      if (option === 'match') {
        e.salary = Math.round(e.salary * 1.3);
        e.lastRaiseWeek = state.week;
        addMorale(e, 15);
        return `${e.name} stays, now earning ${e.salary}g/wk. The Crypt of Eternal Synergy sends a passive-aggressive fruit basket.`;
      }
      if (option === 'promote' && canPromote(e)) {
        promote(e);
        addMorale(e, 25);
        return `${e.name} accepts a promotion to ${title(e)} and turns the other dungeon down.`;
      }
      if (option === 'nda') {
        if (chance(rng, 0.6)) {
          addMorale(e, -15);
          return `${e.name} reads clause 47(b) ("…or be cursed for a thousand years") and decides to stay.`;
        }
        removeEmployee(state, e.id, 'resigned', 'Poached by a rival dungeon');
        return `${e.name} leaves anyway. Turns out the curse was not legally binding.`;
      }
      removeEmployee(state, e.id, 'resigned', 'Poached by a rival dungeon');
      return `${e.name} leaves for greener caves. They promise to stay in touch (they won't).`;
    case 'birthday':
      if (!e) return 'Moot.';
      if (option === 'cake') {
        state.gold -= 10;
        addMorale(e, 12);
        if (e.roomId) {
          for (const o of roomStaff(state, e.roomId)) {
            if (o.id === e.id) continue;
            addMorale(o, 6);
            adjustRel(state, e.id, o.id, 12);
          }
        }
        return `Cake! ${e.name} blows out the candles. The goblins eat the candles.`;
      }
      if (option === 'card') {
        addMorale(e, 5);
        return `The card says "Happy birthday!" and, in smaller writing, "who is this?"`;
      }
      addMorale(e, -12);
      return `${e.name} spends their birthday alone in the break room. The microwave beeps sadly.`;
    case 'suggestion': {
      const idx = ev.amount ?? 0;
      if (option === 'decline') return 'The suggester nods politely. They will be suggesting again.';
      state.gold -= SUGGESTIONS[idx].cost;
      switch (idx) {
        case 0:
          allMorale(state, 6);
          return 'The slides are a hit. Commute times are down 40%; injuries are up 12%.';
        case 1:
          state.research += 8;
          return 'The mood lighting inspires a breakthrough in the lab. +8 R&D points.';
        case 2:
          if (chance(rng, 0.5) || !state.employees.length) {
            allMorale(state, 8);
            return 'Pet day is adorable. Someone brought a hellhound puppy. +8 morale for all.';
          } else {
            const victim = pick(rng, state.employees);
            victim.status = 'injured';
            victim.statusWeeks = 1;
            return `Someone brought a gelatinous cube. ${victim.name} is on medical leave next week.`;
          }
        case 3: {
          const skels = state.employees.filter((x) => x.species === 'skeleton');
          for (const x of skels) addMorale(x, 12);
          return skels.length ? 'The skeletons stand at their desks with quiet dignity. +12 morale for skeletons.' : 'You have no skeletons. The standing desks are now very expensive shelves.';
        }
        default:
          allMorale(state, 3);
          return 'The first issue of "The Dungeon Digest" features a recipe for Mystery Stew. +3 morale for all.';
      }
    }
    case 'merger':
      if (option === 'accept') {
        state.gold += 100;
        allMorale(state, -10);
        state.unionUnrest += 1;
        const species = unlockedSpecies(state).filter((sp) => sp !== 'dragon');
        const hired: string[] = [];
        for (let i = 0; i < 2 && state.employees.length < headcountLimit(state); i++) {
          const newbie = generateEmployee(state, pick(rng, species), rng, { level: 2 + Math.floor(state.dungeonLevel / 2) });
          newbie.morale = 45;
          state.employees.push(newbie);
          state.stats.hired += 1;
          hired.push(newbie.name);
        }
        return hired.length
          ? `The merger closes. ${hired.join(' and ')} join from Lich Consolidated (they're on the bench). The office smells faintly of formaldehyde.`
          : 'The merger closes, but there is no headcount for their staff. They are "reassigned". +100 gold.';
      }
      if (option === 'negotiate') {
        state.gold += 200;
        return 'Your HR rep walks out with a briefcase of gold and a signed non-compete. +200 gold.';
      }
      allMorale(state, 8);
      return 'You tear up the offer in front of the whole staff. Somebody starts a slow clap.';
    case 'auditprep':
      if (option === 'overtime') {
        state.weeklyBuff = { label: 'Mandatory overtime', atk: 1.12, def: 1 };
        for (const x of state.employees) x.fatigue = Math.min(100, x.fatigue + 20);
        return 'Everyone is working late. The coffee machine has filed for workers\' comp.';
      }
      if (option === 'consultants') {
        state.gold -= 60;
        state.weeklyBuff = { label: 'Security consultants', atk: 1.05, def: 1.15 };
        return 'The consultants rearrange the furniture into "defensive synergy formations". It actually helps.';
      }
      allMorale(state, 6);
      return 'Your speech ("Adventurers Are Just Customers Who Haven\'t Died Yet") gets a standing ovation.';
    case 'retirement':
      if (!e) return 'They already left.';
      if (option === 'parachute') {
        state.gold -= ev.amount ?? 0;
        removeEmployee(state, e.id, 'retired', 'Retired with a golden parachute');
        allMorale(state, 8);
        return `${e.name} retires to a lovely swamp. Everyone signs the card. There is a surprisingly emotional speech.`;
      }
      if (option === 'stay') {
        e.salary = Math.round(e.salary * 1.2);
        e.lastRaiseWeek = state.week;
        addMorale(e, 15);
        return `${e.name} agrees to "one more quarter". Everyone knows how that goes.`;
      }
      addMorale(e, -20);
      return `${e.name} stares into the middle distance for a long time.`;
    default:
      return 'Filed.';
  }
}

