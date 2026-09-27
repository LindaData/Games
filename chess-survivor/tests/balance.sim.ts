/**
 * Balance harness (skipped by default). A naive bot — random safe move, grabs safe captures —
 * plays battles against the real AI budgets. Run with: npm run balance
 */
import { it } from 'vitest';
import type { PieceSymbol } from 'chess.js';
import { createRng } from '../src/core/rng';
import { chooseEnemyMove } from '../src/ai/search';
import { buildAiRequest, createCombat, enemyAct, forcedEnemyAction, getTargets, playerAct } from '../src/game/combat';
import { CHARACTERS } from '../src/game/pieces';
import { generateEncounter, type BattleKind, type BossId } from '../src/game/encounters';

function battle(piece: PieceSymbol, tier: number, act: number, kind: BattleKind, seed: number, boss?: BossId) {
  const rng = createRng(seed);
  const enc = generateEncounter({ rng, piece, kind, boss, tier, act, loop: 0, swift: false });
  let c = createCombat({ enc, piece, hp: 20, maxHp: 20, owned: CHARACTERS[piece].signature ? { [CHARACTERS[piece].signature!]: 1 } : {}, runCharges: CHARACTERS[piece].signature === 'ghost_move' ? { ghost_move: 1 } : {} });
  let g = 0;
  while ((c.phase === 'player' || c.phase === 'enemy') && g++ < 200) {
    if (c.phase === 'player') {
      const t = getTargets(c);
      const safe = t.filter((x) => !x.danger);
      const pool = safe.length ? safe : t;
      const caps = pool.filter((x) => x.capture);
      const pick = caps.length ? caps[0] : pool[Math.floor(rng() * pool.length)];
      c = playerAct(c, pick.to, 'q');
    } else {
      const f = forcedEnemyAction(c, rng);
      const ai = f ? null : chooseEnemyMove(buildAiRequest(c, Math.floor(rng() * 1e9)));
      c = enemyAct(c, ai, f, rng);
    }
  }
  return { hits: c.hitsTaken, outcome: c.outcome, turns: c.turn, elo: enc.elo, obj: enc.objective.kind };
}

it.skipIf(!(globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.BALANCE)('balance', () => {
  const rows: string[] = [];
  for (const piece of ['p', 'n', 'b', 'r', 'q', 'k'] as PieceSymbol[]) {
    for (const [tier, act, kind, boss] of [[0, 1, 'battle'], [3, 1, 'elite'], [3, 1, 'boss', 'horde'], [5, 2, 'battle'], [6, 2, 'boss', 'immortal'], [6, 2, 'boss', 'mirror'], [8, 3, 'battle'], [9, 3, 'boss', 'grandmaster']] as [number, number, BattleKind, BossId?][]) {
      let hits = 0; const outs: string[] = [];
      for (let s = 0; s < 3; s++) { const r = battle(piece, tier, act, kind, s * 101 + tier, boss); hits += r.hits; outs.push(`${r.obj}:${r.outcome}/${r.turns}`); }
      rows.push(`${piece} ${kind}${boss ? '(' + boss + ')' : ''} t${tier} hits/battle=${(hits / 3).toFixed(1)} ${outs.join(' ')}`);
    }
  }
  console.log(rows.join('\n'));
}, 900000);
