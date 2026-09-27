export type SpeciesId =
  | 'slime'
  | 'goblin'
  | 'skeleton'
  | 'orc'
  | 'mimic'
  | 'witch'
  | 'vampire'
  | 'dragon';

export type TraitId =
  | 'lazy'
  | 'bloodthirsty'
  | 'union'
  | 'coward'
  | 'overachiever'
  | 'nightowl'
  | 'disguise'
  | 'teamplayer'
  | 'loner'
  | 'golddigger'
  | 'thickskin'
  | 'glasscannon'
  | 'quicklearner'
  | 'gossip'
  | 'hypochondriac'
  | 'nepo';

export type RoomTypeId =
  | 'hallway'
  | 'guardpost'
  | 'trap'
  | 'ambush'
  | 'lair'
  | 'vault'
  | 'barracks'
  | 'breakroom'
  | 'training'
  | 'medical'
  | 'cafeteria'
  | 'hroffice'
  | 'lab'
  | 'accounting';

export type Zone = 'route' | 'office';

export type AdvClass =
  | 'fighter'
  | 'rogue'
  | 'wizard'
  | 'cleric'
  | 'paladin'
  | 'ranger'
  | 'barbarian'
  | 'bard';

export type PartyKind =
  | 'beginner'
  | 'goblinhunters'
  | 'experienced'
  | 'wizards'
  | 'paladins'
  | 'rogues'
  | 'bosshunters'
  | 'audit';

export interface Stats {
  hp: number;
  atk: number;
  def: number;
  spd: number;
  int: number;
}

export type EmployeeStatus = 'active' | 'injured' | 'vacation' | 'strike' | 'sick';

export interface Employee {
  id: string;
  name: string;
  species: SpeciesId;
  traits: TraitId[];
  /** Level-1 stats including personal variance. */
  base: Stats;
  /** Current HP (persists between invasions). */
  hp: number;
  morale: number;
  fatigue: number;
  salary: number;
  level: number;
  xp: number;
  rank: number;
  hue: number;
  roomId: string | null;
  status: EmployeeStatus;
  statusWeeks: number;
  hiredWeek: number;
  kills: number;
  weeksWorked: number;
  /** Extra permanent stat multiplier from training and promotions. */
  bonus: number;
  lastRaiseWeek: number;
}

export interface Room {
  id: string;
  type: RoomTypeId;
  level: number;
  zone: Zone;
  slot: number;
}

export interface Adventurer {
  id: string;
  name: string;
  cls: AdvClass;
  level: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  gear: string;
  loot: number;
  hue: number;
}

export interface Party {
  name: string;
  kind: PartyKind;
  members: Adventurer[];
  night: boolean;
  bounty: number;
  flavor: string;
  boss: boolean;
}

export interface HrOption {
  id: string;
  label: string;
  desc: string;
  disabled?: boolean;
}

export type HrKind =
  | 'raise'
  | 'union'
  | 'vacation'
  | 'dispute'
  | 'resignation'
  | 'review'
  | 'pip'
  | 'inspection'
  | 'sick'
  | 'burnout'
  | 'promotion'
  | 'news';

export interface HrEvent {
  id: string;
  kind: HrKind;
  title: string;
  body: string;
  empId?: string;
  empId2?: string;
  amount?: number;
  from: string;
}

export interface IncidentReport {
  employee: string;
  species: SpeciesId;
  department: string;
  incident: string;
  cause: string;
  action: string;
  fatal: boolean;
}

export interface MemorialEntry {
  name: string;
  species: SpeciesId;
  week: number;
  cause: string;
  kind: 'fatality' | 'resigned' | 'terminated';
}

export interface WeekSummary {
  week: number;
  outcome: 'defended' | 'breach';
  partyName: string;
  night: boolean;
  bounty: number;
  loot: number;
  stolen: number;
  payroll: number;
  unpaid: number;
  policyCost: number;
  accountingBonus: number;
  researchGained: number;
  xpGained: number;
  slain: number;
  partySize: number;
  incidents: IncidentReport[];
  levelUps: string[];
  departures: string[];
  notes: string[];
  mvp: { name: string; kills: number; damage: number } | null;
  dungeonLevelUp: number | null;
  performance: { id: string; name: string; species: SpeciesId; damage: number; kills: number; xp: number; outcome: string }[];
}

export type Phase = 'title' | 'manage' | 'invasion' | 'report' | 'hr' | 'gameover';

export interface GameStats {
  defenses: number;
  breaches: number;
  slain: number;
  hired: number;
  fatalities: number;
  goldEarned: number;
}

export interface GameState {
  version: number;
  phase: Phase;
  company: string;
  week: number;
  gold: number;
  research: number;
  dungeonLevel: number;
  dungeonXp: number;
  board: number;
  defenseStreak: number;
  employees: Employee[];
  applicants: Employee[];
  rooms: Room[];
  routeSlots: number;
  officeSlots: number;
  tech: string[];
  weapons: number;
  armor: number;
  policies: string[];
  hrInbox: HrEvent[];
  hrOutcome: { title: string; text: string } | null;
  nextParty: Party;
  lastSummary: WeekSummary | null;
  memorial: MemorialEntry[];
  stats: GameStats;
  nextId: number;
  unionUnrest: number;
  tutorialDone: boolean;
  gameOverReason: string | null;
  ipoShown: boolean;
  toast: Toast | null;
}

export interface Toast {
  id: number;
  text: string;
  tone: 'good' | 'bad';
}
