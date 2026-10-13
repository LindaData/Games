/**
 * Times the AI on a few middlegame positions at every difficulty.
 * Run with: npm run bench
 */
import { Chess } from 'chess.js';
import { chooseMove, createRng } from '../src/ai/search';
import { DIFFICULTIES, DIFFICULTY } from '../src/game/difficulty';

const POSITIONS: [string, string][] = [
  ['Italian, move 6', 'r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 b - - 0 6'],
  ['Queen’s Gambit middlegame', 'r2q1rk1/pp1nbppp/2p1pn2/3p4/2PP4/2NBPN2/PP3PPP/R2Q1RK1 b - - 0 10'],
  ['Open Sicilian', 'r1b1kb1r/1pqp1ppp/p1n1pn2/8/3NP3/2N1B3/PPP1BPPP/R2QK2R b KQkq - 0 8'],
  ['Tactical melee', 'r3k2r/ppp2ppp/2n1bq2/3pp3/1b1PP3/2N1BN2/PPPQ1PPP/R3KB1R b KQkq - 0 9'],
  ['Kiwipete (busy)', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R b KQkq - 0 1'],
];

for (const d of DIFFICULTIES) {
  const s = DIFFICULTY[d];
  const times: number[] = [];
  for (const [name, fen] of POSITIONS) {
    const r = chooseMove({ fen, depth: s.aiDepth, randomWindow: s.randomWindow, quiescence: s.quiescence, seed: 7 });
    times.push(r.ms);
    console.log(`${s.label.padEnd(6)} ${name.padEnd(26)} ${r.from}${r.to}${r.promotion ?? ''}  ${String(r.ms).padStart(5)} ms  ${r.nodes} nodes  score ${r.score}`);
  }
  const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  console.log(`${s.label}: avg ${avg} ms, max ${Math.max(...times)} ms\n`);
}

// Broader sample: middlegames reached by the Normal AI playing itself from varied openings.
const rng = createRng(2026);
const samples: number[] = [];
for (let g = 0; g < 40; g++) {
  const c = new Chess();
  // A few random opening plies for variety, then Normal-strength self-play into the middlegame.
  for (let i = 0; i < 4; i++) {
    const ms = c.moves();
    c.move(ms[Math.floor(rng() * ms.length)]);
  }
  const target = 16 + Math.floor(rng() * 20);
  while (c.history().length < target && !c.isGameOver()) {
    const r = chooseMove({ fen: c.fen(), depth: 2, quiescence: true, seed: g * 100 + c.history().length });
    c.move({ from: r.from, to: r.to, promotion: r.promotion });
  }
  if (c.isGameOver()) continue;
  const s = DIFFICULTY.hard;
  const r = chooseMove({ fen: c.fen(), depth: s.aiDepth, quiescence: s.quiescence, seed: g });
  samples.push(r.ms);
}
samples.sort((a, b) => a - b);
const pct = (p: number) => samples[Math.min(samples.length - 1, Math.floor((p / 100) * samples.length))];
console.log(
  `Hard on ${samples.length} self-play middlegames: median ${pct(50)} ms, p90 ${pct(90)} ms, max ${samples[samples.length - 1]} ms, avg ${Math.round(samples.reduce((a, b) => a + b, 0) / samples.length)} ms`,
);
