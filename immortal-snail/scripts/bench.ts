/**
 * Times the game's AI (AI_SETTINGS) on a few middlegame positions.
 * Run with: npm run bench
 */
import { chooseMove } from '../src/ai/search';
import { AI_SETTINGS } from '../src/game/settings';

const POSITIONS: [string, string][] = [
  ['Italian, move 6', 'r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 b - - 0 6'],
  ['Queen’s Gambit middlegame', 'r2q1rk1/pp1nbppp/2p1pn2/3p4/2PP4/2NBPN2/PP3PPP/R2Q1RK1 b - - 0 10'],
  ['Open Sicilian', 'r1b1kb1r/1pqp1ppp/p1n1pn2/8/3NP3/2N1B3/PPP1BPPP/R2QK2R b KQkq - 0 8'],
  ['Tactical melee', 'r3k2r/ppp2ppp/2n1bq2/3pp3/1b1PP3/2N1BN2/PPPQ1PPP/R3KB1R b KQkq - 0 9'],
  ['Kiwipete (busy)', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R b KQkq - 0 1'],
];

const times: number[] = [];
for (const [name, fen] of POSITIONS) {
  const r = chooseMove({ fen, ...AI_SETTINGS, seed: 7 });
  times.push(r.ms);
  console.log(`${name.padEnd(26)} ${r.from}${r.to}${r.promotion ?? ''}  ${String(r.ms).padStart(5)} ms  ${r.nodes} nodes  score ${r.score}`);
}
const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
console.log(`avg ${avg} ms, max ${Math.max(...times)} ms`);
