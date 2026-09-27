import type { Employee } from '../game/types';

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const BY_SPECIES: Record<Employee['species'], string[]> = {
  slime: ['I am very flexible. Literally.', 'Previous experience: floor.', 'I will absorb any task (and possibly the desk).', 'Looking for unpaid opportunities. Please.'],
  goblin: ['I have my own mop.', 'Five years of trap-adjacent experience.', 'References available (they are scared of me).', 'I can fit in vents. Is that a skill?'],
  skeleton: ['I work nights, days, and weekends. I do not sleep.', 'Very low maintenance. Occasionally need a femur reattached.', 'Looking for a role with a strong dental plan.', 'I bring a lot of backbone to any team.'],
  orc: ['ME STRONG. ME TEAM PLAYER.', 'Proficient in Microsoft Axe.', 'Previous role: "Big Guy". Left due to creative differences.', 'I have strong opinions about doors (they should not exist).'],
  mimic: ['I am definitely a treasure chest and not an applicant.', 'Strengths: patience, teeth.', 'I thrive in a quiet corner near valuables.', 'My last employer is inside me. Long story.'],
  witch: ['PhD, Hexology. Postdoc, Curses.', 'I bring my own cauldron (please ventilate).', 'I will need a lab, a budget, and no questions asked.', 'I can turn your KPIs into newts.'],
  vampire: ['Available for night shifts exclusively.', 'I bring centuries of management experience.', 'I require a windowless office. Non-negotiable.', 'I have a strong network. Mostly bats.'],
  dragon: ['My salary expectations are non-negotiable and enormous.', 'I will need the corner office. And the gold. All of it.', 'I bring decades of executive leadership and arson.', 'I will require a golden parachute. For tax reasons.'],
};

const BY_TRAIT: Partial<Record<Employee['traits'][number], string>> = {
  lazy: 'I believe in work-life balance (mostly the life part).',
  bloodthirsty: 'When do I get to hurt someone? Asking for me.',
  union: 'Before I sign: what is your stance on collective bargaining?',
  coward: 'Is this position… dangerous? Like, at all?',
  overachiever: 'I have already completed next quarter\'s goals.',
  nightowl: 'I do my best work after midnight.',
  golddigger: 'Let\'s talk compensation first.',
  nepo: 'My uncle said I should apply. He\'s on the Board.',
  gossip: 'Did you hear about the last dungeon manager? I did.',
  hypochondriac: 'Do you offer medical? I have several conditions (unconfirmed).',
  quicklearner: 'I learn fast. I already learned where the snacks are.',
  loner: 'I work best alone. Please do not perceive me.',
  teamplayer: 'There is no "I" in "dungeon"!',
};

export function coverLetter(e: Employee): string {
  const h = hash(e.id + e.name);
  const traitLine = e.traits.map((t) => BY_TRAIT[t]).find(Boolean);
  if (traitLine && h % 2 === 0) return traitLine;
  const lines = BY_SPECIES[e.species];
  return lines[h % lines.length];
}
