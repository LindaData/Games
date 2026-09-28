import type { AdvClass, PartyKind, RoomTypeId, SpeciesId, Stats, TraitId, Zone } from './types';

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D';
export const GRADE_MULT: Record<Grade, number> = { S: 1.3, A: 1.15, B: 1, C: 0.85, D: 0.7 };

export interface SpeciesDef {
  id: SpeciesId;
  name: string;
  job: string;
  department: string;
  blurb: string;
  base: Stats;
  salary: number;
  unlock: number;
  tags: ('undead' | 'beast' | 'arcane' | 'construct' | 'boss')[];
  ability: string;
  color: string;
  suit: Partial<Record<RoomTypeId, Grade>>;
}

export const SPECIES: Record<SpeciesId, SpeciesDef> = {
  slime: {
    id: 'slime',
    name: 'Slime',
    job: 'Unpaid Intern',
    department: 'Internships',
    blurb: 'Absorbs blame, damage, and the occasional stapler. Paid in exposure.',
    base: { hp: 52, atk: 4, def: 5, spd: 4, int: 2 },
    salary: 4,
    unlock: 1,
    tags: ['beast'],
    ability: 'Takes the Blame: adventurers prefer to hit the intern.',
    color: '#6fcf7a',
    suit: { hallway: 'A', guardpost: 'B', trap: 'D', vault: 'C', breakroom: 'A', training: 'B', cafeteria: 'C', lab: 'D', hroffice: 'D', medical: 'C', accounting: 'D', ambush: 'C' },
  },
  goblin: {
    id: 'goblin',
    name: 'Goblin',
    job: 'Janitor',
    department: 'Facilities',
    blurb: 'Mops floors, resets traps, steals office supplies. Fast and cheap.',
    base: { hp: 30, atk: 7, def: 3, spd: 14, int: 9 },
    salary: 7,
    unlock: 1,
    tags: ['beast'],
    ability: 'Maintenance Crew: excellent trap technician and cafeteria cook.',
    color: '#8fbf3f',
    suit: { trap: 'S', cafeteria: 'A', hallway: 'B', ambush: 'A', guardpost: 'C', vault: 'C', accounting: 'B', lab: 'C', medical: 'C', hroffice: 'C' },
  },
  skeleton: {
    id: 'skeleton',
    name: 'Skeleton',
    job: 'Security Guard',
    department: 'Security',
    blurb: 'Never sleeps, never eats, never stops asking about the dental plan.',
    base: { hp: 42, atk: 9, def: 7, spd: 9, int: 5 },
    salary: 11,
    unlock: 1,
    tags: ['undead'],
    ability: 'Reassembly: 30% chance to pull itself together once per shift.',
    color: '#e6dcc5',
    suit: { guardpost: 'S', hallway: 'A', vault: 'B', trap: 'C', ambush: 'B', training: 'B', medical: 'D', cafeteria: 'D', lab: 'C', hroffice: 'C', accounting: 'B' },
  },
  orc: {
    id: 'orc',
    name: 'Orc',
    job: 'Heavy Security',
    department: 'Security',
    blurb: 'Big. Loud. Thinks "synergy" is a type of axe.',
    base: { hp: 88, atk: 15, def: 8, spd: 7, int: 3 },
    salary: 22,
    unlock: 2,
    tags: ['beast'],
    ability: 'Frontline: hits hard, soaks harder.',
    color: '#5f8a4a',
    suit: { guardpost: 'A', hallway: 'A', vault: 'A', ambush: 'B', trap: 'D', lair: 'B', cafeteria: 'B', lab: 'D', hroffice: 'D', accounting: 'D', medical: 'D', training: 'A' },
  },
  mimic: {
    id: 'mimic',
    name: 'Mimic',
    job: 'Asset Protection',
    department: 'Loss Prevention',
    blurb: 'Poses as treasure. Loves its job. Has eaten three auditors.',
    base: { hp: 62, atk: 16, def: 10, spd: 8, int: 6 },
    salary: 28,
    unlock: 3,
    tags: ['construct'],
    ability: 'Disguise: ambushes the first adventurer for massive damage (Rogues may spot it).',
    color: '#b07a3c',
    suit: { vault: 'S', ambush: 'A', hallway: 'B', guardpost: 'C', trap: 'B', accounting: 'A', lab: 'C', hroffice: 'D', medical: 'D', cafeteria: 'D' },
  },
  witch: {
    id: 'witch',
    name: 'Witch',
    job: 'R&D Researcher',
    department: 'Research & Development',
    blurb: 'PhD in Hexology. Refuses to attend all-hands meetings.',
    base: { hp: 38, atk: 13, def: 4, spd: 10, int: 18 },
    salary: 26,
    unlock: 4,
    tags: ['arcane'],
    ability: 'Hex: curses adventurers, reducing their damage. Excellent researcher and medic.',
    color: '#9b6be0',
    suit: { lab: 'S', medical: 'A', trap: 'A', hroffice: 'B', hallway: 'B', guardpost: 'C', vault: 'B', ambush: 'B', accounting: 'A', cafeteria: 'B', training: 'B' },
  },
  vampire: {
    id: 'vampire',
    name: 'Vampire',
    job: 'Night Shift Manager',
    department: 'Night Operations',
    blurb: 'Excellent people skills. Will literally drain your team.',
    base: { hp: 92, atk: 20, def: 11, spd: 14, int: 14 },
    salary: 55,
    unlock: 5,
    tags: ['undead'],
    ability: 'Lifesteal: heals from damage dealt. +30% on night shifts.',
    color: '#c0392b',
    suit: { ambush: 'S', vault: 'A', guardpost: 'A', hallway: 'A', lair: 'A', hroffice: 'A', trap: 'C', lab: 'B', accounting: 'B', medical: 'C', cafeteria: 'D' },
  },
  dragon: {
    id: 'dragon',
    name: 'Dragon',
    job: 'Chief Executive Wyrm',
    department: 'C-Suite',
    blurb: 'Enormous salary. Enormous ego. Enormous fire breath. Golden parachute included.',
    base: { hp: 320, atk: 36, def: 20, spd: 10, int: 16 },
    salary: 170,
    unlock: 7,
    tags: ['boss'],
    ability: 'Fire Breath: scorches the entire party every other turn.',
    color: '#d9a441',
    suit: { lair: 'S', vault: 'A', guardpost: 'B', hallway: 'C', ambush: 'D', hroffice: 'B', accounting: 'A', lab: 'C', trap: 'D', medical: 'D', cafeteria: 'D' },
  },
};

export const SPECIES_ORDER: SpeciesId[] = ['slime', 'goblin', 'skeleton', 'orc', 'mimic', 'witch', 'vampire', 'dragon'];

export interface TraitDef {
  id: TraitId;
  name: string;
  desc: string;
  tone: 'good' | 'bad' | 'mixed';
}

export const TRAITS: Record<TraitId, TraitDef> = {
  lazy: { id: 'lazy', name: 'Lazy', desc: '−20% speed. Happier (+3 morale/wk) and asks for fewer raises. Loves the break room.', tone: 'mixed' },
  bloodthirsty: { id: 'bloodthirsty', name: 'Bloodthirsty', desc: '+20% damage. Loses morale when stuck in back-office jobs.', tone: 'mixed' },
  union: { id: 'union', name: 'Union Organizer', desc: 'Periodically demands better working conditions for everyone. Denying them has consequences.', tone: 'mixed' },
  coward: { id: 'coward', name: 'Coward', desc: 'May flee combat at low HP — survives, but abandons the post.', tone: 'mixed' },
  overachiever: { id: 'overachiever', name: 'Overachiever', desc: '+25% speed and +25% XP, but gains fatigue twice as fast. Burns out.', tone: 'mixed' },
  nightowl: { id: 'nightowl', name: 'Night Owl', desc: '+30% effectiveness on night shifts, −10% during the day.', tone: 'mixed' },
  disguise: { id: 'disguise', name: 'Master of Disguise', desc: 'Poses as treasure: ambushes the first adventurer in the room.', tone: 'good' },
  teamplayer: { id: 'teamplayer', name: 'Team Player', desc: '+10% damage for everyone in the same room.', tone: 'good' },
  loner: { id: 'loner', name: 'Lone Wolf', desc: '+30% effectiveness when alone in a room, −15% otherwise.', tone: 'mixed' },
  golddigger: { id: 'golddigger', name: 'Gold Digger', desc: '+15% all stats, +40% salary. Demands raises often.', tone: 'mixed' },
  thickskin: { id: 'thickskin', name: 'Thick-Skinned', desc: '+30% defense. Immune to passive-aggressive memos.', tone: 'good' },
  glasscannon: { id: 'glasscannon', name: 'Glass Cannon', desc: '+40% damage, −30% HP.', tone: 'mixed' },
  quicklearner: { id: 'quicklearner', name: 'Quick Learner', desc: '+50% XP from all sources.', tone: 'good' },
  gossip: { id: 'gossip', name: 'Office Gossip', desc: 'Spreads their mood: roommates drift toward their morale. Starts disputes.', tone: 'bad' },
  hypochondriac: { id: 'hypochondriac', name: 'Hypochondriac', desc: 'Frequently requests sick leave. A Medical Bay calms them down.', tone: 'bad' },
  nepo: { id: 'nepo', name: "Boss's Nephew", desc: '−25% all stats. Firing him costs 15 morale for everyone.', tone: 'bad' },
};

export const TRAIT_WEIGHTS: Record<TraitId, number> = {
  lazy: 10, bloodthirsty: 9, union: 7, coward: 8, overachiever: 8, nightowl: 8, disguise: 4, teamplayer: 8,
  loner: 6, golddigger: 6, thickskin: 8, glasscannon: 6, quicklearner: 7, gossip: 6, hypochondriac: 5, nepo: 3,
};

export interface RoomDef {
  id: RoomTypeId;
  name: string;
  zone: Zone;
  desc: string;
  cost: number;
  unlock: number;
  maxLevel: number;
  capacity: (level: number) => number;
  effect: (level: number) => string;
  color: string;
  buildable: boolean;
}

export const ROOMS: Record<RoomTypeId, RoomDef> = {
  hallway: {
    id: 'hallway', name: 'Hallway', zone: 'route', cost: 40, unlock: 1, maxLevel: 3, color: '#6b6478', buildable: true,
    desc: 'A corridor with torches and a strongly worded sign. Staff here intercept visitors.',
    capacity: (l) => 1 + l, effect: (l) => `${1 + l} security positions.`,
  },
  guardpost: {
    id: 'guardpost', name: 'Guard Post', zone: 'route', cost: 90, unlock: 1, maxLevel: 3, color: '#5a7fa8', buildable: true,
    desc: 'Fortified checkpoint. Staff enjoy cover and a laminated badge.',
    capacity: (l) => 1 + l,
    effect: (l) => `+${10 + l * 10}% defense for staff.`,
  },
  trap: {
    id: 'trap', name: 'Trap Corridor', zone: 'route', cost: 80, unlock: 1, maxLevel: 3, color: '#a8643a', buildable: true,
    desc: 'Spikes, pits, and a suspiciously loose floor tile. Needs a technician to reset between victims.',
    capacity: () => 1,
    effect: (l) => `Hits every visitor for ~${12 + l * 10} dmg. Technician INT boosts damage.`,
  },
  ambush: {
    id: 'ambush', name: 'Ambush Den', zone: 'route', cost: 140, unlock: 3, maxLevel: 3, color: '#6a4a8a', buildable: true,
    desc: 'Dark alcoves perfect for surprise meetings. Staff act first with bonus damage.',
    capacity: (l) => 1 + l, effect: (l) => `Staff get a free opening strike at +${20 + l * 15}% damage.`,
  },
  lair: {
    id: 'lair', name: 'Executive Suite', zone: 'route', cost: 400, unlock: 7, maxLevel: 3, color: '#b8862e', buildable: true,
    desc: 'Corner office with a lava view. Executives fight at their best here.',
    capacity: () => 1, effect: (l) => `+${15 + l * 15}% all stats for the executive.`,
  },
  vault: {
    id: 'vault', name: 'Treasure Vault', zone: 'route', cost: 0, unlock: 1, maxLevel: 4, color: '#d9a441', buildable: false,
    desc: 'The company treasury. Staff here fight harder (+20%) to protect the quarterly profits. If visitors clear it, they walk off with the gold.',
    capacity: (l) => 1 + l, effect: (l) => `${1 + l} positions. Breaches steal ${Math.max(10, 30 - (l - 1) * 5)}% of gold.`,
  },
  barracks: {
    id: 'barracks', name: 'Barracks', zone: 'office', cost: 60, unlock: 1, maxLevel: 3, color: '#7a6a55', buildable: true,
    desc: 'Bunk beds, lockers, one working shower. Needed to house staff.',
    capacity: () => 0, effect: (l) => `+${3 * l} headcount.`,
  },
  breakroom: {
    id: 'breakroom', name: 'Break Room', zone: 'office', cost: 70, unlock: 1, maxLevel: 3, color: '#4a8a7a', buildable: true,
    desc: 'A sad microwave and a sadder coffee machine. Staff assigned here rest instead of fighting.',
    capacity: (l) => l, effect: (l) => `+${2 + l * 2} morale/wk for everyone. Resting staff recover fatigue.`,
  },
  training: {
    id: 'training', name: 'Training Room', zone: 'office', cost: 90, unlock: 1, maxLevel: 3, color: '#8a5a4a', buildable: true,
    desc: 'Mandatory compliance seminars and a training dummy named Gary.',
    capacity: (l) => 1 + l, effect: (l) => `Trainees gain ${30 + l * 20} XP per week.`,
  },
  medical: {
    id: 'medical', name: 'Medical Bay', zone: 'office', cost: 100, unlock: 1, maxLevel: 3, color: '#c05a5a', buildable: true,
    desc: 'Bandages, potions, and a first-aid poster from 300 years ago.',
    capacity: () => 1, effect: (l) => `+${10 + l * 7}% survival for knocked-out staff. Injured staff return to duty immediately. Full heals between shifts.`,
  },
  cafeteria: {
    id: 'cafeteria', name: 'Cafeteria', zone: 'office', cost: 110, unlock: 2, maxLevel: 3, color: '#b88a3a', buildable: true,
    desc: 'Today\'s special: mystery stew (do not ask about the mystery).',
    capacity: () => 1, effect: (l) => `+${5 * l}% max HP for all staff, +2 morale/wk. A cook doubles the HP bonus.`,
  },
  hroffice: {
    id: 'hroffice', name: 'HR Office', zone: 'office', cost: 150, unlock: 3, maxLevel: 3, color: '#5a6ab8', buildable: true,
    desc: 'Where complaints go to be filed. Forever.',
    capacity: () => 1, effect: (l) => `+${l} policy slot${l > 1 ? 's' : ''}. A staffed HR rep improves negotiations.`,
  },
  lab: {
    id: 'lab', name: 'Research Lab', zone: 'office', cost: 160, unlock: 4, maxLevel: 3, color: '#3a8ab8', buildable: true,
    desc: 'Bubbling beakers. Grant applications. More bubbling beakers.',
    capacity: (l) => 1 + l, effect: (l) => `Researchers generate R&D points (x${(1 + (l - 1) * 0.3).toFixed(1)}).`,
  },
  accounting: {
    id: 'accounting', name: 'Accounting', zone: 'office', cost: 130, unlock: 4, maxLevel: 3, color: '#4a9a5a', buildable: true,
    desc: 'Creative bookkeeping since the Third Age.',
    capacity: () => 1, effect: (l) => `+${5 + l * 5}% gold income. An accountant adds more.`,
  },
};

export const ROUTE_ROOMS: RoomTypeId[] = ['hallway', 'guardpost', 'trap', 'ambush', 'lair'];
export const OFFICE_ROOMS: RoomTypeId[] = ['barracks', 'breakroom', 'training', 'medical', 'cafeteria', 'hroffice', 'lab', 'accounting'];

export interface ClassDef {
  id: AdvClass;
  name: string;
  base: { hp: number; atk: number; def: number; spd: number };
  strength: string;
  weakness: string;
  color: string;
  gear: string[];
}

export const CLASSES: Record<AdvClass, ClassDef> = {
  fighter: { id: 'fighter', name: 'Fighter', base: { hp: 62, atk: 11, def: 8, spd: 10 }, strength: 'Balanced and durable.', weakness: 'No tricks. Traps work fine.', color: '#8a9bb0', gear: ['a +1 longsword', 'a +2 sword', 'a dented shield', 'an heirloom blade', 'a sword named "Kevin"'] },
  rogue: { id: 'rogue', name: 'Rogue', base: { hp: 42, atk: 10, def: 4, spd: 16 }, strength: 'Disarms traps, spots mimics, lands crits.', weakness: 'Fragile.', color: '#5a5a6a', gear: ['twin daggers', 'a lockpick set', 'a poisoned stiletto', 'suspiciously many pockets'] },
  wizard: { id: 'wizard', name: 'Wizard', base: { hp: 34, atk: 14, def: 2, spd: 9 }, strength: 'Fireball hits every employee in the room.', weakness: 'Paper-thin defenses.', color: '#4a6ad0', gear: ['a staff of fireballs', 'a spellbook (overdue)', 'a pointy hat', 'a wand of Magic Missile'] },
  cleric: { id: 'cleric', name: 'Cleric', base: { hp: 50, atk: 7, def: 7, spd: 8 }, strength: 'Heals the party. Smites undead.', weakness: 'Low damage.', color: '#e0d080', gear: ['a holy symbol', 'a mace of mild disapproval', 'healing potions', 'a pamphlet'] },
  paladin: { id: 'paladin', name: 'Paladin', base: { hp: 72, atk: 10, def: 12, spd: 6 }, strength: 'Heavily armored. Devastating vs undead.', weakness: 'Slow.', color: '#d0d0e0', gear: ['a holy avenger', 'full plate', 'an oath (legally binding)', 'a shiny warhammer'] },
  ranger: { id: 'ranger', name: 'Ranger', base: { hp: 46, atk: 12, def: 5, spd: 13 }, strength: 'Fast. +30% vs beasts (goblins, orcs, slimes).', weakness: 'Light armor.', color: '#4a8a4a', gear: ['a longbow', 'a hawk named Steve', 'trail mix', 'monster-hunting guide'] },
  barbarian: { id: 'barbarian', name: 'Barbarian', base: { hp: 84, atk: 14, def: 3, spd: 9 }, strength: 'Huge HP. Rages below half health.', weakness: 'Almost no armor.', color: '#b05a3a', gear: ['a greataxe', 'no shirt', 'a very large club', 'raw enthusiasm'] },
  bard: { id: 'bard', name: 'Bard', base: { hp: 40, atk: 6, def: 4, spd: 11 }, strength: 'Buffs party damage with inspiring songs.', weakness: 'Weak in a fight.', color: '#c05ab0', gear: ['a lute', 'a mixtape', 'unsolicited opinions', 'a tambourine'] },
};

export interface PartyTemplate {
  kind: PartyKind;
  names: string[];
  minWeek: number;
  comp: AdvClass[][];
  flavor: string[];
  bountyMult: number;
}

export const PARTY_TEMPLATES: PartyTemplate[] = [
  { kind: 'beginner', minWeek: 1, bountyMult: 1, names: ['The Fresh Recruits', 'Level One Legends', 'Tavern Volunteers', 'The Gap Year Crew'], comp: [['fighter', 'rogue'], ['fighter', 'cleric'], ['fighter', 'ranger', 'bard'], ['fighter', 'rogue', 'cleric']], flavor: ['Just finished the tutorial.', 'Heard there was treasure. That is the whole plan.', 'Their mom packed them lunches.'] },
  { kind: 'goblinhunters', minWeek: 4, bountyMult: 1.15, names: ['Goblin Hunters Local 12', 'The Pest Control Guild', 'Greenskin Removal LLC'], comp: [['ranger', 'ranger', 'fighter'], ['ranger', 'barbarian', 'cleric'], ['ranger', 'ranger', 'rogue', 'cleric']], flavor: ['Specialists in beast removal. Bad news for your goblins and orcs.', 'Their business card is a goblin ear. Ew.'] },
  { kind: 'rogues', minWeek: 5, bountyMult: 1.15, names: ['The Sticky Fingers', 'Thieves Guild (Accredited)', 'Lockpick & Associates'], comp: [['rogue', 'rogue', 'fighter'], ['rogue', 'rogue', 'bard'], ['rogue', 'rogue', 'rogue', 'cleric']], flavor: ['They disarm traps and spot mimics. Put muscle in the halls.', 'Their LinkedIn says "acquisitions specialists".'] },
  { kind: 'experienced', minWeek: 6, bountyMult: 1.3, names: ['The Seasoned Blades', 'Veterans of the Nine Dungeons', 'Mid-Career Adventurers'], comp: [['fighter', 'rogue', 'wizard', 'cleric'], ['barbarian', 'ranger', 'cleric', 'bard'], ['fighter', 'barbarian', 'wizard', 'cleric']], flavor: ['A well-rounded party. They have done this before.', 'They have a group chat and it is organized.'] },
  { kind: 'wizards', minWeek: 7, bountyMult: 1.3, names: ['The Arcane Collective', 'Wizards Without Borders', 'The Tenured Faculty'], comp: [['wizard', 'wizard', 'fighter'], ['wizard', 'wizard', 'cleric', 'bard'], ['wizard', 'wizard', 'wizard', 'paladin']], flavor: ['Fireballs hit everyone in a room. Spread your staff out.', 'They will explain magic theory at you. At length.'] },
  { kind: 'paladins', minWeek: 8, bountyMult: 1.4, names: ['Order of the Radiant Audit', 'The Holy Compliance Squad', 'Knights of Mild Righteousness'], comp: [['paladin', 'paladin', 'cleric'], ['paladin', 'paladin', 'cleric', 'bard'], ['paladin', 'paladin', 'paladin', 'cleric']], flavor: ['Devastating against undead. Your skeletons should take a personal day.', 'They filed a formal complaint about your hiring practices.'] },
  { kind: 'bosshunters', minWeek: 10, bountyMult: 1.7, names: ['The Dragonslayers', 'Executive Headhunters', 'Boss Rush Inc.'], comp: [['barbarian', 'paladin', 'wizard', 'cleric', 'rogue'], ['fighter', 'ranger', 'wizard', 'cleric', 'bard'], ['barbarian', 'barbarian', 'wizard', 'cleric', 'ranger']], flavor: ['Elite party. They are here for your most expensive employees.', 'They have a spreadsheet of executive weaknesses.'] },
];

export const AUDIT_TEMPLATE: PartyTemplate = {
  kind: 'audit', minWeek: 5, bountyMult: 2.2, names: ['The Quarterly Auditors', 'The Hostile Takeover', 'The Board-Appointed Consultants'],
  comp: [['fighter', 'paladin', 'wizard', 'cleric', 'rogue'], ['barbarian', 'fighter', 'wizard', 'cleric', 'bard'], ['paladin', 'ranger', 'wizard', 'cleric', 'rogue']],
  flavor: ['Quarterly boss wave. Big party, big bounty, big consequences.', 'End-of-quarter review. Survive and the Board will be pleased.'],
};

export interface TechDef {
  id: string;
  name: string;
  desc: string;
  cost: number;
  requires?: string;
  unlock: number;
}

export const TECHS: TechDef[] = [
  { id: 'posters', name: 'Motivational Posters', desc: '"Hang in there" — now with a cat hanging from a noose. +4 morale/wk for all staff.', cost: 6, unlock: 1 },
  { id: 'intel', name: 'Adventurer LinkedIn', desc: 'See full stats of incoming visitors in the briefing.', cost: 6, unlock: 1 },
  { id: 'spikes', name: 'Premium Spikes', desc: 'Trap damage +40%.', cost: 10, unlock: 1 },
  { id: 'ergonomic', name: 'Ergonomic Coffins', desc: 'Fatigue gain −35%.', cost: 12, unlock: 2 },
  { id: 'alarm', name: 'Alarm Bells', desc: '+12% speed for all route staff.', cost: 14, unlock: 2 },
  { id: 'poison', name: 'Poison Dart Subscription', desc: 'Trap damage +40% more. Traps hit rogues even when disarmed 30% of the time.', cost: 20, requires: 'spikes', unlock: 3 },
  { id: 'dental', name: 'Dental Plan', desc: 'Skeletons are thrilled. +3 morale/wk; union demands halved.', cost: 18, unlock: 2 },
  { id: 'autoreset', name: 'Self-Resetting Traps', desc: 'Traps operate at 70% without a technician.', cost: 18, requires: 'spikes', unlock: 3 },
  { id: 'wards', name: 'Anti-Magic Wards', desc: 'Wizard fireballs deal −40% damage.', cost: 22, unlock: 4 },
  { id: 'insulation', name: 'Holy Insulation', desc: 'Paladin/Cleric bonus vs undead halved.', cost: 24, unlock: 4 },
  { id: 'necro', name: 'Necromantic Benefits', desc: 'Skeleton reassembly chance 30% → 60%.', cost: 24, unlock: 3 },
  { id: 'mimicry', name: 'Advanced Mimicry', desc: 'Ambush damage +50%; rogues spot disguises half as often.', cost: 26, unlock: 4 },
  { id: 'bloodbank', name: 'Blood Bank', desc: 'Vampire lifesteal doubled.', cost: 26, unlock: 5 },
  { id: 'teleport', name: 'Emergency Teleporters', desc: '+15% survival chance for knocked-out staff.', cost: 32, unlock: 5 },
  { id: 'mentorship', name: 'Mentorship Program', desc: '+30% XP for all staff.', cost: 28, unlock: 4 },
  { id: 'dragonfuel', name: 'Premium Dragon Fuel', desc: 'Dragon fire breath +50%.', cost: 36, unlock: 7 },
];

export const WEAPON_TIERS = [
  { name: 'Rusty Shivs', mult: 1, cost: 0 },
  { name: 'Iron Weapons', mult: 1.15, cost: 150 },
  { name: 'Steel Weapons', mult: 1.3, cost: 400 },
  { name: 'Enchanted Arms', mult: 1.5, cost: 900 },
  { name: 'Legendary Arsenal', mult: 1.75, cost: 1800 },
];

export const ARMOR_TIERS = [
  { name: 'Burlap Uniforms', mult: 1, cost: 0 },
  { name: 'Leather Uniforms', mult: 1.2, cost: 130 },
  { name: 'Chainmail', mult: 1.4, cost: 350 },
  { name: 'Plate Armor', mult: 1.65, cost: 800 },
  { name: 'Enchanted Plate', mult: 1.95, cost: 1600 },
];

export interface PolicyDef {
  id: string;
  name: string;
  desc: string;
  unlock: number;
  morale: number;
}

export const POLICIES: PolicyDef[] = [
  { id: 'casual', name: 'Casual Fridays', desc: '+6 morale/wk. Staff wear sweatpants into battle: −5% defense.', unlock: 1, morale: 6 },
  { id: 'pizza', name: 'Weekly Pizza Party', desc: '+9 morale/wk. Costs 4 gold per employee per week.', unlock: 1, morale: 9 },
  { id: 'pto', name: 'Unlimited PTO', desc: '+12 morale/wk. Each employee has a 12% chance to be on vacation during an invasion.', unlock: 2, morale: 12 },
  { id: 'openplan', name: 'Open-Plan Dungeon', desc: '+15% damage in rooms with 3+ staff. −4 morale/wk (nobody can focus).', unlock: 2, morale: -4 },
  { id: 'dresscode', name: 'Mandatory Formal Wear', desc: '+10% defense (starched collars). −5 morale/wk.', unlock: 3, morale: -5 },
  { id: 'perfpay', name: 'Performance-Based Pay', desc: 'Salaries −20%. +10% damage (hungry). −4 morale/wk.', unlock: 3, morale: -4 },
  { id: 'fun', name: 'Mandatory Fun', desc: '+10 morale/wk, but Lone Wolves and Lazy staff lose 10 instead. +5 fatigue/wk.', unlock: 3, morale: 10 },
  { id: 'hostile', name: 'Hostile Work Environment Initiative', desc: '+20% damage. −8 morale/wk. Legal says this name is "a problem".', unlock: 4, morale: -8 },
  { id: 'rehire', name: 'Posthumous Re-Hiring', desc: 'Knocked-out staff get +20% survival chance, but each revival costs 30 gold.', unlock: 4, morale: 0 },
  { id: 'fourday', name: 'Four-Day Work Week', desc: '+14 morale/wk, fatigue gain halved, −10% speed.', unlock: 5, morale: 14 },
  { id: 'synergy', name: 'Synergy Workshops', desc: '+50% XP. −5 morale/wk (the trust falls).', unlock: 5, morale: -5 },
  { id: 'nepotism', name: 'Referral Bonus Program', desc: 'Applicants arrive 1–2 levels higher. Applicants may be the Boss\'s Nephew more often.', unlock: 6, morale: 0 },
];

export const RANKS = ['Junior ', '', 'Senior ', 'Principal ', 'Chief '];

/** Board confidence hearts. Each breach costs one; zero means game over. */
export const MAX_BOARD = 5;

/** Dungeon-level unlocks for display. */
export const LEVEL_UNLOCKS: Record<number, string[]> = {
  2: ['Orc (Heavy Security)', 'Cafeteria', 'Office slot', 'Unlimited PTO', 'Open-Plan Dungeon'],
  3: ['Mimic (Asset Protection)', 'Ambush Den', 'HR Office', 'Route slot'],
  4: ['Witch (R&D Researcher)', 'Research Lab', 'Accounting', 'Office slot'],
  5: ['Vampire (Night Shift Manager)', 'Route slot'],
  6: ['Office slot', 'Referral Bonus Program'],
  7: ['Dragon (Chief Executive Wyrm)', 'Executive Suite', 'Route slot'],
  8: ['Office slot'],
  9: ['Route slot'],
};

export function routeSlotsFor(level: number): number {
  return 3 + (level >= 3 ? 1 : 0) + (level >= 5 ? 1 : 0) + (level >= 7 ? 1 : 0) + (level >= 9 ? 1 : 0);
}

export function officeSlotsFor(level: number): number {
  return 3 + (level >= 2 ? 1 : 0) + (level >= 4 ? 1 : 0) + (level >= 6 ? 1 : 0) + (level >= 8 ? 1 : 0);
}

export function dungeonXpToNext(level: number): number {
  return 30 + level * 25;
}

export const FIRST_NAMES: Record<SpeciesId, string[]> = {
  slime: ['Blorp', 'Gloop', 'Squish', 'Oozwald', 'Jelly', 'Puddle', 'Globbert', 'Sludgy', 'Wobbles', 'Mucus Jr.'],
  goblin: ['Gribble', 'Snik', 'Mogz', 'Nubb', 'Grizzik', 'Pockets', 'Skreet', 'Dobbs', 'Fizzwick', 'Knack', 'Ratbag'],
  skeleton: ['Skeleton #14', 'Bonnie', 'Rattles', 'Sir Femur', 'Tibia', 'Clavicle Carl', 'Skeleton #7', 'Marrowin', 'Boney M.', 'Ribsy'],
  orc: ['Grog', 'Uzgash', 'Brakka', 'Thokk', 'Morgra', 'Dave', 'Gorbag', 'Skullsplitter', 'Nagrul', 'Big Tina'],
  mimic: ['Chesterfield', 'Lid', 'Coffer', 'Trunkard', 'Hinge', 'Latchley', 'Lootbox', 'Barrel?', 'Treasure (real)'],
  witch: ['Agatha', 'Morwenna', 'Hexandra', 'Griselda', 'Dr. Nettle', 'Belladonna', 'Hazel', 'Prof. Cauldron', 'Wanda'],
  vampire: ['Count Vladimir', 'Lady Nocturna', 'Desmond', 'Baron Von Bite', 'Lestat (not that one)', 'Carmilla', 'Nosferatu Jr.'],
  dragon: ['Ignatius Goldhoard', 'Vermithrax CFO', 'Smauggie', 'Ember Worthington III', 'Pyraxis', 'Scorchmore'],
};

export const ADV_NAMES = ['Aldric', 'Brienne', 'Cedric', 'Dara', 'Elowen', 'Finn', 'Gwen', 'Hector', 'Isolde', 'Jasper', 'Kael', 'Lyra', 'Magnus', 'Nyx', 'Orin', 'Pip', 'Quinn', 'Rowan', 'Sera', 'Thane', 'Ulric', 'Vex', 'Wren', 'Yara', 'Zed', 'Chad', 'Brad', 'Kyle', 'Tiffany', 'Gerald'];
export const ADV_EPITHETS = ['the Bold', 'the Brave', 'the Unpaid', 'the Overconfident', 'the Mediocre', 'of the North', 'the Loud', 'the Level-Headed', 'Who Skipped Leg Day', 'the Influencer', 'the Relentless'];
