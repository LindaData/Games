import { mulberry32 } from './rng';
import { simulateInvasion } from './sim';
import type { GameState } from './types';

export interface Forecast {
  winChance: number;
  label: string;
  tone: 'good' | 'ok' | 'bad';
}

/**
 * Estimates the chance of stopping next week's party by simulating the
 * invasion many times with the current staffing. Pure: does not touch state.
 */
export function forecast(state: GameState, runs = 40): Forecast {
  let wins = 0;
  const seedBase = state.week * 7919 + state.nextId;
  for (let i = 0; i < runs; i++) {
    const sim = simulateInvasion(state, state.nextParty, mulberry32(seedBase + i * 104729));
    if (sim.outcome === 'defended') wins += 1;
  }
  const winChance = wins / runs;
  if (winChance >= 0.8) return { winChance, label: 'Likely win', tone: 'good' };
  if (winChance >= 0.5) return { winChance, label: 'Could go either way', tone: 'ok' };
  return { winChance, label: 'Likely breach', tone: 'bad' };
}
