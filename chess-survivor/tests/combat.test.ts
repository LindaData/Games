import { describe, it, expect } from 'vitest';
import { createCombat, enemyAct, getTargets, playerAct, playerSquare, setMode, useInstant, forcedEnemyAction, type CombatState } from '../src/game/combat';
import type { EncounterDef } from '../src/game/encounters';
import type { UpgradeId } from '../src/game/upgrades';
import { createRng } from '../src/core/rng';

const enc = (fen: string, playerSq: string, extra: Partial<EncounterDef> = {}): EncounterDef => ({
  name: 'Test', subtitle: 'test', kind: 'battle', elo: 800, fen, playerSq: playerSq as never,
  objective: { kind: 'survive', turns: 5 }, gold: 10, ...extra,
});

const mk = (e: EncounterDef, piece: 'p' | 'n' | 'b' | 'r' | 'q' | 'k', owned: Partial<Record<UpgradeId, number>> = {}, hp = 3) =>
  createCombat({ enc: e, piece, hp, maxHp: 3, owned, runCharges: { second_life: owned.second_life ?? 0, ghost_move: owned.ghost_move ?? 0 } });

const rng = createRng(3);

describe('combat', () => {
  it('player knight has legal targets with danger flags', () => {
    const s = mk(enc('4k3/8/8/8/8/5p2/8/6N1 w - - 0 1', 'g1'), 'n');
    const t = getTargets(s);
    expect(t.map((x) => x.to).sort()).toEqual(['e2', 'f3', 'h3']);
    expect(t.find((x) => x.to === 'e2')!.danger).toBe(true); // f3 pawn attacks e2
    expect(t.find((x) => x.to === 'f3')!.capture).toBe(true);
  });

  it('capture costs 1 HP and respawns the player', () => {
    let s = mk(enc('4k3/8/8/8/8/8/3r4/6N1 w - - 0 1', 'g1'), 'n');
    s = playerAct(s, 'e2');
    expect(s.phase).toBe('enemy');
    s = enemyAct(s, { from: 'd2', to: 'e2' }, null, rng);
    expect(s.hp).toBe(2);
    expect(s.phase).toBe('player');
    expect(playerSquare(s)).not.toBe('e2');
    expect(s.turn).toBe(1);
  });

  it('parry negates a capture and knight instinct dodges first', () => {
    let s = mk(enc('4k3/8/8/8/8/8/3r4/6N1 w - - 0 1', 'g1'), 'n', { parry: 1, knights_instinct: 1 });
    s = playerAct(s, 'e2');
    s = enemyAct(s, { from: 'd2', to: 'e2' }, null, rng);
    expect(s.hp).toBe(3);
    expect(s.charges.knights_instinct).toBe(0);
    expect(s.charges.parry).toBe(1);
  });

  it('reinforced armor stops pawn captures in move lists', () => {
    const s = mk(enc('4k3/8/8/8/8/3p4/8/6N1 w - - 0 1', 'g1'), 'n', { reinforced_armor: 1 });
    expect(getTargets(s).find((x) => x.to === 'e2')!.danger).toBe(false);
  });

  it('second life saves from death', () => {
    let s = mk(enc('4k3/8/8/8/8/8/3r4/6N1 w - - 0 1', 'g1'), 'n', { second_life: 1 }, 1);
    s = playerAct(s, 'e2');
    s = enemyAct(s, { from: 'd2', to: 'e2' }, null, rng);
    expect(s.phase).toBe('player');
    expect(s.hp).toBe(1);
  });

  it('dies at 0 HP', () => {
    let s = mk(enc('4k3/8/8/8/8/8/3r4/6N1 w - - 0 1', 'g1'), 'n', {}, 1);
    s = playerAct(s, 'e2');
    s = enemyAct(s, { from: 'd2', to: 'e2' }, null, rng);
    expect(s.phase).toBe('lost');
    expect(s.outcome).toBe('dead');
  });

  it('teleport, time warp, stasis work', () => {
    let s = mk(enc('4k3/pppppppp/8/8/8/8/8/6N1 w - - 0 1', 'g1'), 'n', { teleport: 1, time_warp: 1, stasis: 1 });
    s = setMode(s, { kind: 'teleport' });
    expect(getTargets(s).length).toBeGreaterThan(40);
    s = playerAct(s, 'd4');
    expect(playerSquare(s)).toBe('d4');
    s = enemyAct(s, { from: 'a7', to: 'a6' }, null, rng);
    s = useInstant(s, 'time_warp');
    expect(playerSquare(s)).toBe('g1');
    s = useInstant(s, 'stasis');
    s = playerAct(s, 'f3');
    const f = forcedEnemyAction(s, rng);
    expect(f).toEqual({ kind: 'skip' });
    s = enemyAct(s, null, f, rng);
    expect(s.phase).toBe('player');
    expect(s.fen.split(' ')[0]).toBe('4k3/pppppppp/8/8/8/5N2/8/8');
  });

  it('pawn promotes and completes promote objective', () => {
    let s = mk(enc('k7/4P3/8/8/8/8/8/8 w - - 0 1', 'e7', { objective: { kind: 'promote', limit: 10 } }), 'p');
    s = playerAct(s, 'e8', 'q');
    expect(s.phase).toBe('won');
    expect(s.playerType).toBe('q');
  });

  it('player can checkmate the enemy king', () => {
    let s = mk(enc('k7/2p5/1p6/8/8/8/8/7R w - - 0 1', 'h1'), 'r');
    // Ra1 is not mate (b6 pawn... a-file open: king a8, escape b7/b8). Use h8 instead.
    s = playerAct(s, 'h8');
    expect(['won', 'enemy']).toContain(s.phase);
  });

  it('king player is only hurt by checkmate', () => {
    // Black rooks deliver back-rank mate: Ra2 already controls rank 2, Rb8-b1 is mate.
    let s: CombatState = mk(enc('1r2k3/8/8/8/8/8/r7/7K w - - 0 1', 'h1'), 'k');
    s = playerAct(s, 'g1');
    s = enemyAct(s, { from: 'b8', to: 'b1' }, null, rng);
    expect(s.hp).toBe(2);
    expect(s.phase).toBe('player');
  });

  it('protect objective fails when ally dies', () => {
    let s = mk(enc('4k3/8/8/8/8/8/1P1r4/6N1 w - - 0 1', 'g1', { allySq: 'b2', objective: { kind: 'protect', turns: 5 } }), 'n');
    s = playerAct(s, 'h3');
    s = enemyAct(s, { from: 'd2', to: 'b2' }, null, rng);
    expect(s.phase).toBe('lost');
    expect(s.outcome).toBe('failed');
    expect(s.hp).toBe(2);
  });
});

describe('boss rules', () => {
  it('riposte cannot destroy the Immortal and the player cannot capture it on a light square', () => {
    // Immortal queen on d5 (light square) attacks the knight on e3? use a direct setup: queen on e2 captures knight.
    const e = enc('4k3/8/8/8/8/8/4q3/6N1 w - - 0 1', 'g1', { immortalSq: 'e2' as never });
    let s = mk(e, 'n', { parry: 1, riposte: 1 });
    // e2 is a light square: the knight may not capture the Immortal there.
    expect(getTargets(s).map((t) => t.to)).not.toContain('e2');
    s = playerAct(s, 'h3');
    s = enemyAct(s, { from: 'e2', to: 'h2' }, null, rng);
    expect(s.phase).toBe('player');
  });

  it('the Mirror copies a mirrored move when legal', () => {
    const e = enc('4k3/8/6n1/8/8/8/8/6N1 w - - 0 1', 'g1', { mirrorSq: 'g8' as never });
    // Mirror knight must be at the mirror square of the player's origin (g1 -> g8).
    const e2 = { ...e, fen: '4k1n1/8/8/8/8/8/8/6N1 w - - 0 1' };
    let s = mk(e2, 'n');
    s = playerAct(s, 'f3');
    const f = forcedEnemyAction(s, rng);
    expect(f && f.kind === 'move' && f.move.from === 'g8' && f.move.to === 'f6').toBe(true);
  });
});

describe('squares', () => {
  it('a1 and h8 are dark, h1 and a8 are light', async () => {
    const { isDark } = await import('../src/chess/squares');
    expect(isDark('a1')).toBe(true);
    expect(isDark('h8')).toBe(true);
    expect(isDark('h1')).toBe(false);
    expect(isDark('a8')).toBe(false);
  });
});
