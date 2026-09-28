import { hrOptions } from './hr';
import { payroll } from './employees';
import type { GameState, HrEvent, HrKind } from './types';

/** Preferred choices per memo type, best first. The first one that's available wins. */
const PREFERENCES: Record<HrKind, string[]> = {
  raise: ['approve', 'deny'],
  union: ['approve', 'negotiate', 'deny'],
  vacation: ['approve', 'comp'],
  burnout: ['force'],
  sick: ['approve'],
  resignation: ['counter', 'family'],
  dispute: ['mediate'],
  review: ['plaque'],
  pip: ['coach', 'ignore'],
  promotion: ['promote'],
  inspection: ['pay', 'bribe'],
  news: ['ok'],
  feud: ['retreat', 'transfer'],
  poach: ['promote', 'match'],
  birthday: ['cake', 'card'],
  suggestion: ['decline'],
  merger: ['negotiate', 'reject'],
  auditprep: ['consultants', 'speech'],
  retirement: ['stay', 'parachute'],
};

/** The option a sensible HR manager would pick, considering the budget. */
export function recommendedOption(state: GameState, ev: HrEvent): string {
  const opts = hrOptions(state, ev).filter((o) => !o.disabled);
  if (!opts.length) return hrOptions(state, ev)[0]?.id ?? 'ok';
  const tight = state.gold < payroll(state) * 2;
  let prefs = PREFERENCES[ev.kind] ?? [];
  // When money is tight, prefer the free choices.
  if (tight && ev.kind === 'raise') prefs = ['deny'];
  if (tight && ev.kind === 'union') prefs = ['negotiate', 'deny'];
  if (tight && ev.kind === 'birthday') prefs = ['card'];
  if (tight && ev.kind === 'feud') prefs = ['transfer'];
  if (tight && ev.kind === 'auditprep') prefs = ['speech'];
  if (ev.kind === 'vacation') {
    // A vacation resets fatigue fully, so grant it unless the team is too small to spare anyone.
    const worker = state.employees.find((e) => e.id === ev.empId);
    const fighters = state.employees.filter((e) => e.status === 'active' && e.roomId).length;
    prefs = fighters >= 5 || (worker?.fatigue ?? 0) > 80 ? ['approve', 'comp'] : ['comp', 'approve'];
  }
  for (const id of prefs) if (opts.some((o) => o.id === id)) return id;
  return opts[0].id;
}
