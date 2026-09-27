/** Random map events: short narrative choices with mechanical consequences. */
import { pick, type Rng } from '../core/rng';
import type { RunState } from './run';
import { addUpgrade, offerUpgrades } from './run';
import { UPGRADES } from './upgrades';

export interface EventOption {
  label: string;
  hint: string;
  available?: (run: RunState) => boolean;
  apply: (run: RunState, rng: Rng) => { run: RunState; result: string };
}

export interface EventDef {
  id: string;
  title: string;
  text: string;
  options: EventOption[];
}

const leave: EventOption = { label: 'Walk away', hint: 'Nothing happens.', apply: (run) => ({ run, result: 'You move on.' }) };

export const EVENTS: EventDef[] = [
  {
    id: 'bishop',
    title: 'The Wandering Bishop',
    text: 'A bishop in a tattered mitre sits on a light square, humming. "Coin for a blessing, traveller?"',
    options: [
      {
        label: 'Pay 30 gold',
        hint: 'Heal 2 HP.',
        available: (r) => r.gold >= 30,
        apply: (run) => ({ run: { ...run, gold: run.gold - 30, hp: Math.min(run.maxHp, run.hp + 2) }, result: 'Warm light fills you. +2 HP.' }),
      },
      {
        label: 'Ask for wisdom',
        hint: 'Gain 25 gold worth of advice… or a book.',
        apply: (run) =>
          run.owned.scholar
            ? { run: { ...run, gold: run.gold + 25 }, result: '"You already know the theory." He tosses you 25 gold.' }
            : { run: addUpgrade(run, 'scholar'), result: 'He hands you a battered copy of Opening Theory.' },
      },
      leave,
    ],
  },
  {
    id: 'altar',
    title: 'The Cursed Altar',
    text: 'A black altar stands where the e4 square should be. It hums with power that wants something back.',
    options: [
      {
        label: 'Make an offering',
        hint: 'Lose 1 max HP. Gain a random rare upgrade.',
        available: (r) => r.maxHp > 1,
        apply: (run, rng) => {
          const [id] = offerUpgrades(run, rng, 1, 'rare');
          const next = { ...run, maxHp: run.maxHp - 1, hp: Math.min(run.hp, run.maxHp - 1) };
          return id ? { run: addUpgrade(next, id), result: `The altar takes a piece of you. You gain ${UPGRADES[id].name}.` } : { run: next, result: 'The altar takes, and gives nothing.' };
        },
      },
      leave,
    ],
  },
  {
    id: 'gambit',
    title: 'A Gambit',
    text: 'A grinning pawn offers you a wager: "Double or nothing. Fifty-fifty. You in?"',
    options: [
      {
        label: 'Accept the gambit',
        hint: '50%: +60 gold. 50%: lose 1 HP.',
        available: (r) => r.hp > 1,
        apply: (run, rng) =>
          rng() < 0.5
            ? { run: { ...run, gold: run.gold + 60 }, result: 'The gambit pays off! +60 gold.' }
            : { run: { ...run, hp: run.hp - 1 }, result: 'Refuted. You take a hit. -1 HP.' },
      },
      { ...leave, label: 'Decline' },
    ],
  },
  {
    id: 'fountain',
    title: 'Fountain of Promotion',
    text: 'Water pours from a carved crown on the eighth rank. It smells like ambition.',
    options: [
      { label: 'Drink deeply', hint: '+1 max HP.', apply: (run) => ({ run: { ...run, maxHp: run.maxHp + 1, hp: run.hp + 1 }, result: 'You feel sturdier. +1 max HP.' }) },
      { label: 'Fill your pockets', hint: '+40 gold.', apply: (run) => ({ run: { ...run, gold: run.gold + 40 }, result: 'Coins glitter at the bottom. +40 gold.' }) },
    ],
  },
  {
    id: 'smith',
    title: 'The Rook Smith',
    text: 'A rook has converted its tower into a forge. "I can plate you, or sharpen your reflexes."',
    options: [
      {
        label: 'Reinforce (50 gold)',
        hint: 'Gain Reinforced Armor.',
        available: (r) => r.gold >= 50 && !r.owned.reinforced_armor,
        apply: (run) => ({ run: addUpgrade({ ...run, gold: run.gold - 50 }, 'reinforced_armor'), result: 'Pawns will bounce off you now.' }),
      },
      {
        label: 'Sharpen (40 gold)',
        hint: 'Gain Parry.',
        available: (r) => r.gold >= 40 && !r.owned.parry,
        apply: (run) => ({ run: addUpgrade({ ...run, gold: run.gold - 40 }, 'parry'), result: 'Your guard is quicker. Parry gained.' }),
      },
      leave,
    ],
  },
  {
    id: 'fallen',
    title: 'The Fallen Pawn',
    text: 'A dying pawn lies on the h-file. "Take what is left of me," it whispers, "and live twice."',
    options: [
      {
        label: 'Accept its gift',
        hint: 'Gain Second Life. Lose 20 gold.',
        available: (r) => !r.owned.second_life,
        apply: (run) => ({ run: addUpgrade({ ...run, gold: Math.max(0, run.gold - 20) }, 'second_life'), result: 'Its courage becomes yours. Second Life gained.' }),
      },
      { label: 'Bury it with honour', hint: 'Heal 1 HP.', apply: (run) => ({ run: { ...run, hp: Math.min(run.maxHp, run.hp + 1) }, result: 'You feel at peace. +1 HP.' }) },
    ],
  },
  {
    id: 'library',
    title: 'The Endgame Library',
    text: 'Dusty tablebases line the walls. Somewhere in here is a trick you have never seen.',
    options: [
      {
        label: 'Study (lose 1 HP)',
        hint: 'Gain a random uncommon upgrade.',
        available: (r) => r.hp > 1,
        apply: (run, rng) => {
          const [id] = offerUpgrades(run, rng, 1, 'uncommon');
          const next = { ...run, hp: run.hp - 1 };
          return id ? { run: addUpgrade(next, id), result: `Hours of study pay off: ${UPGRADES[id].name}.` } : { run: next, result: 'Nothing new to learn.' };
        },
      },
      leave,
    ],
  },
];

export function randomEvent(rng: Rng): EventDef {
  return pick(rng, EVENTS);
}

export function eventById(id: string): EventDef {
  return EVENTS.find((e) => e.id === id) ?? EVENTS[0];
}
