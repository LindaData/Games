/** Headless full-run simulations: a simple bot plays whole runs to shake out crashes. */
import { describe, it, expect } from 'vitest';
import type { PieceSymbol } from 'chess.js';
import { createRng } from '../src/core/rng';
import { chooseEnemyMove } from '../src/ai/search';
import { buildAiRequest, enemyAct, forcedEnemyAction, getTargets, playerAct, setMode, useInstant, canUse, type CombatState } from '../src/game/combat';
import { defaultMeta } from '../src/game/meta';
import { reachableNodes } from '../src/game/map';
import { buyItem, claimReward, enterNode, eventChoose, finishCombat, forgePick, leaveNode, newRun, restAction, takeTreasure, type RunState } from '../src/game/run';
import { eventById } from '../src/game/events';
import { UPGRADES, type UpgradeId } from '../src/game/upgrades';
import { boardFromFen } from '../src/chess/rules';

function botTurn(c: CombatState, rng: () => number): CombatState {
  // Occasionally use abilities to exercise them.
  for (const id of ['teleport', 'ghost_move', 'promotion', 'time_warp', 'stasis', 'smoke_bomb'] as UpgradeId[]) {
    if (canUse(c, id) && rng() < 0.15) {
      if (id === 'teleport') c = setMode(c, { kind: 'teleport' });
      else if (id === 'ghost_move') c = setMode(c, { kind: 'ghost' });
      else if (id === 'promotion') c = setMode(c, { kind: 'borrow', as: 'n' });
      else return useInstant(c, id);
      break;
    }
  }
  let targets = getTargets(c);
  if (!targets.length) {
    c = setMode(c, { kind: 'normal' });
    targets = getTargets(c);
  }
  const safe = targets.filter((t) => !t.danger);
  const pool = safe.length ? safe : targets;
  const caps = pool.filter((t) => t.capture);
  const t = (caps.length && rng() < 0.6 ? caps : pool)[Math.floor(rng() * (caps.length && rng() < 0.6 ? caps : pool).length)] ?? pool[0];
  return playerAct(c, t.to, 'q');
}

function playCombat(c: CombatState, rng: () => number): CombatState {
  let guard = 0;
  while ((c.phase === 'player' || c.phase === 'enemy') && guard++ < 400) {
    const before = c;
    if (c.phase === 'player') c = botTurn(c, rng);
    else {
      const forced = forcedEnemyAction(c, rng);
      let ai = null;
      if (!forced) {
        const req = buildAiRequest(c, Math.floor(rng() * 1e9));
        req.profile = { ...req.profile, timeMs: 40 };
        ai = chooseEnemyMove(req);
      }
      c = enemyAct(c, ai, forced, rng);
    }
    // board invariants
    const pieces = boardFromFen(c.fen);
    expect(pieces.filter((p) => p.type === 'k' && p.color === 'b').length).toBe(1);
    expect(Object.keys(c.ids).length).toBe(pieces.length);
    if (c === before && c.phase === 'player') c = setMode(c, { kind: 'normal' });
  }
  expect(['won', 'lost']).toContain(c.phase);
  return c;
}

function simulateRun(piece: PieceSymbol, seed: number, mode: 'standard' | 'endless' = 'standard'): RunState {
  const meta = defaultMeta();
  meta.upgrades = Object.keys(UPGRADES) as UpgradeId[];
  let run = newRun(piece, mode, meta, seed);
  run.hp = run.maxHp = 30; // let the bot go deep
  const rng = createRng(seed);
  let guard = 0;
  while (run.screen !== 'gameover' && run.screen !== 'victory' && guard++ < 200) {
    switch (run.screen) {
      case 'map': {
        const opts = reachableNodes(run.map, run.nodeId);
        expect(opts.length).toBeGreaterThan(0);
        run = enterNode(run, opts[Math.floor(rng() * opts.length)].id);
        break;
      }
      case 'combat':
        run = finishCombat({ ...run, combat: playCombat(run.combat!, rng) });
        break;
      case 'reward':
        run = claimReward(run, run.reward!.choices[0] ?? null);
        break;
      case 'shop':
        run = leaveNode(buyItem(run, 0));
        break;
      case 'event': {
        const ev = eventById(run.event!.id);
        const idx = ev.options.findIndex((o) => !o.available || o.available(run));
        run = eventChoose(run, idx);
        if (run.screen === 'event') run = leaveNode(run);
        break;
      }
      case 'rest':
        run = leaveNode(restAction(run, 'heal'));
        break;
      case 'treasure':
        run = takeTreasure(run);
        break;
      case 'forge':
        run = forgePick(run, run.forge?.[0] ?? null);
        break;
    }
    if (mode === 'endless' && run.act > 4) break;
  }
  return run;
}

describe('full run simulation', () => {
  for (const piece of ['p', 'n', 'b', 'r', 'q', 'k'] as PieceSymbol[]) {
    it(`completes a run as ${piece}`, () => {
      const run = simulateRun(piece, 1000 + piece.charCodeAt(0));
      expect(['gameover', 'victory']).toContain(run.screen);
      expect(run.stats.battlesWon).toBeGreaterThan(0);
      console.log(piece, run.screen, 'act', run.act, 'battles', run.stats.battlesWon, 'turns', run.stats.turns, 'hp', run.hp, 'insight', run.insightEarned);
    });
  }
  it('endless mode keeps going past act 3', () => {
    const run = simulateRun('q', 77, 'endless');
    expect(run.act).toBeGreaterThan(3);
  });
});
