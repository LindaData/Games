import { it } from 'vitest';
import type { PieceSymbol } from 'chess.js';
import { createRng } from '../src/core/rng';
import { chooseEnemyMove } from '../src/ai/search';
import { buildAiRequest, createCombat, enemyAct, forcedEnemyAction, getTargets, playerAct } from '../src/game/combat';
import { generateEncounter } from '../src/game/encounters';
import { nextCooldowns } from '../src/game/run';
import type { UpgradeId } from '../src/game/upgrades';

function stretch(piece: PieceSymbol, owned: Partial<Record<UpgradeId, number>>, seed: number) {
  let cooldowns: Partial<Record<UpgradeId, number>> = {};
  let hits = 0;
  for (let tier = 0; tier < 6; tier++) {
    const rng = createRng(seed * 97 + tier);
    const enc = generateEncounter({ rng, piece, kind: 'battle', tier, act: 1 + Math.floor(tier / 3), loop: 0, swift: !!owned.swift });
    let c = createCombat({ enc, piece, hp: 50, maxHp: 50, owned, runCharges: {}, cooldowns });
    let g = 0;
    while ((c.phase === 'player' || c.phase === 'enemy') && g++ < 200) {
      if (c.phase === 'player') {
        const t = getTargets(c);
        const safe = t.filter((x) => !x.danger);
        const pool = safe.length ? safe : t;
        c = playerAct(c, pool[Math.floor(rng() * pool.length)].to, 'q');
      } else {
        const f = forcedEnemyAction(c, rng);
        const ai = f ? null : chooseEnemyMove({ ...buildAiRequest(c, Math.floor(rng() * 1e9)) });
        c = enemyAct(c, ai, f, rng);
      }
    }
    hits += c.hitsTaken;
    cooldowns = nextCooldowns({ owned, cooldowns } as never, c);
  }
  return hits;
}

it.skipIf(!(globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.BALANCE)('edge', () => {
  const kit = { knights_instinct: 1, parry: 1, reinforced_armor: 1, swift: 1 } as const;
  for (const piece of ['n', 'r'] as PieceSymbol[]) {
    let base = 0, withKit = 0;
    for (let s = 1; s <= 4; s++) { base += stretch(piece, {}, s); withKit += stretch(piece, kit, s); }
    console.log(`${piece}: hits per 6 battles — none ${(base / 4).toFixed(2)}, defensive kit ${(withKit / 4).toFixed(2)}`);
  }
}, 900000);
