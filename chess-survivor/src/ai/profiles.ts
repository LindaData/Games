/**
 * Difficulty ladder. Elo numbers are approximate targets: strength is controlled by
 * search depth (plies), evaluation noise (centipawn standard deviation) and a blunder
 * rate (probability of playing a random legal move).
 */
export interface AiProfile {
  elo: number;
  depth: number;
  noise: number;
  blunder: number;
  timeMs: number;
}

const LADDER: AiProfile[] = [
  { elo: 800, depth: 1, noise: 120, blunder: 0.2, timeMs: 400 },
  { elo: 900, depth: 2, noise: 90, blunder: 0.14, timeMs: 500 },
  { elo: 1000, depth: 2, noise: 60, blunder: 0.1, timeMs: 600 },
  { elo: 1100, depth: 3, noise: 45, blunder: 0.07, timeMs: 700 },
  { elo: 1200, depth: 3, noise: 30, blunder: 0.05, timeMs: 800 },
  { elo: 1300, depth: 3, noise: 20, blunder: 0.03, timeMs: 900 },
  { elo: 1400, depth: 4, noise: 15, blunder: 0.02, timeMs: 1100 },
  { elo: 1600, depth: 4, noise: 8, blunder: 0.01, timeMs: 1300 },
  { elo: 1800, depth: 5, noise: 5, blunder: 0, timeMs: 1600 },
  { elo: 2000, depth: 5, noise: 2, blunder: 0, timeMs: 2000 },
  { elo: 2200, depth: 6, noise: 0, blunder: 0, timeMs: 2600 },
  { elo: 2500, depth: 7, noise: 0, blunder: 0, timeMs: 3200 },
];

export function profileForElo(elo: number): AiProfile {
  let chosen = LADDER[0];
  for (const p of LADDER) if (elo >= p.elo) chosen = p;
  return { ...chosen, elo };
}

export function eloLabel(elo: number): string {
  if (elo < 1000) return 'Novice';
  if (elo < 1300) return 'Club Player';
  if (elo < 1600) return 'Tournament';
  if (elo < 1900) return 'Expert';
  if (elo < 2200) return 'Master';
  return 'Grandmaster';
}
