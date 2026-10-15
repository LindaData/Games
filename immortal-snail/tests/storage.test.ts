import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyWhiteMove, newGame, parseUci, whiteMoves, type GameState } from '../src/game/engine';
import { emptyStats, loadGame, loadRulesSeen, loadStats, recordResult, saveGame, saveRulesSeen, saveStats } from '../src/storage';

/** A Map-backed stand-in for window.localStorage. */
function fakeStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
  };
}

let store: ReturnType<typeof fakeStorage>;

beforeEach(() => {
  store = fakeStorage();
  vi.stubGlobal('window', { localStorage: store });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const isFresh = (s: GameState) => s.history.length === 0 && s.turn === 1 && s.snail === 'a8' && s.phase === 'white';

describe('rules-seen flag', () => {
  it('is false on the first visit and remembered once the card is closed', () => {
    expect(loadRulesSeen()).toBe(false);
    saveRulesSeen();
    expect(store.data.get('immortal-snail:rules-seen')).toBe('1');
    expect(loadRulesSeen()).toBe(true);
  });

  it('works (as "not seen") when storage is blocked', () => {
    vi.stubGlobal('window', {
      get localStorage(): Storage {
        throw new Error('blocked');
      },
    });
    expect(() => saveRulesSeen()).not.toThrow();
    expect(loadRulesSeen()).toBe(false);
  });
});

describe('saved game', () => {
  it('round-trips through storage under the new key', () => {
    let s = newGame();
    s = applyWhiteMove(s, parseUci('e2e4'));
    saveGame(s);
    expect([...store.data.keys()]).toEqual(['immortal-snail:game:v2']);
    const restored = loadGame();
    expect({ ...restored }).toEqual({ ...s });
    expect(whiteMoves(restored)).toEqual(whiteMoves(s));
  });

  it('starts a fresh game when there is no save, a corrupt save, or only an old-version save', () => {
    expect(isFresh(loadGame())).toBe(true);
    store.data.set('immortal-snail:game:v2', '{not json');
    expect(isFresh(loadGame())).toBe(true);
    store.data.set('immortal-snail:game:v2', JSON.stringify({ v: 2, moves: ['e2e5'], snail: 'a8', turn: 1 }));
    expect(isFresh(loadGame())).toBe(true);
    store.data.clear();
    store.data.set('immortal-snail:game', JSON.stringify({ v: 1, difficulty: 'hard', moves: ['e2e4'], snail: 'a8', turn: 1 }));
    expect(isFresh(loadGame())).toBe(true);
  });
});

describe('record', () => {
  it('counts wins, losses and draws in one record', () => {
    let st = emptyStats();
    st = recordResult(st, 'win');
    st = recordResult(st, 'loss');
    st = recordResult(st, 'loss');
    st = recordResult(st, 'draw');
    expect(st).toEqual({ w: 1, l: 2, d: 1 });
    saveStats(st);
    expect(loadStats()).toEqual({ w: 1, l: 2, d: 1 });
  });

  it('ignores corrupt data and the old per-difficulty record', () => {
    store.data.set('immortal-snail:stats', JSON.stringify({ easy: { w: 3, l: 0, d: 0 } }));
    expect(loadStats()).toEqual({ w: 0, l: 0, d: 0 });
    store.data.set('immortal-snail:stats:v2', '{oops');
    expect(loadStats()).toEqual({ w: 0, l: 0, d: 0 });
    store.data.set('immortal-snail:stats:v2', JSON.stringify({ w: -1, l: 'x', d: 2.7 }));
    expect(loadStats()).toEqual({ w: 0, l: 0, d: 2 });
  });
});
