/** Difficulty settings: how often the snail crawls and how hard the computer plays. */

export type Difficulty = 'easy' | 'normal' | 'hard';

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];

export interface DifficultySettings {
  label: string;
  /** The snail crawls after every Nth turn (turn 1 is the first turn). */
  snailEvery: number;
  /** AI search depth in plies. */
  aiDepth: number;
  /** When > 0 the AI picks randomly among moves within this many centipawns of the best. */
  randomWindow: number;
  /** Extend leaf nodes with a capture-only search (stops the AI hanging pieces at the horizon). */
  quiescence: boolean;
  blurb: string;
}

export const DIFFICULTY: Record<Difficulty, DifficultySettings> = {
  easy: {
    label: 'Easy',
    snailEvery: 3,
    aiDepth: 1,
    randomWindow: 80,
    quiescence: false,
    blurb: 'Snail crawls every 3rd turn. The computer plays loosely.',
  },
  normal: {
    label: 'Normal',
    snailEvery: 2,
    aiDepth: 2,
    randomWindow: 0,
    quiescence: true,
    blurb: 'Snail crawls every 2nd turn. The computer looks 2 moves ahead.',
  },
  hard: {
    label: 'Hard',
    snailEvery: 1,
    aiDepth: 3,
    randomWindow: 0,
    quiescence: true,
    blurb: 'Snail crawls every turn. The computer looks 3 moves ahead.',
  },
};

export const DEFAULT_DIFFICULTY: Difficulty = 'normal';

export function isDifficulty(x: unknown): x is Difficulty {
  return x === 'easy' || x === 'normal' || x === 'hard';
}
