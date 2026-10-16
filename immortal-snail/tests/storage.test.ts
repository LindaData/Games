import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyWhiteMove, newGame, parseUci, startSacrifice, whiteMoves } from '../src/game/engine';
import {
  emptyStats,
  loadAllStats,
  loadGame,
  loadInstallHintDismissed,
  loadMode,
  loadStats,
  recordResult,
  saveGame,
  saveInstallHintDismissed,
  saveMode,
  saveStats,
} from '../src/storage';

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

const blockStorage = () =>
  vi.stubGlobal('window', {
    get localStorage(): Storage {
      throw new Error('blocked');
    },
  });

describe('saved game', () => {
  it('round-trips through storage under the v3 key, in every mode', () => {
    const games = [
      applyWhiteMove(newGame('ghost'), parseUci('e2e4')),
      applyWhiteMove(newGame('hungry'), parseUci('d2d4')),
      applyWhiteMove(startSacrifice(newGame('sacrifice'), 'g1'), parseUci('e2e4')),
      newGame('sacrifice'), // still picking a piece
    ];
    for (const s of games) {
      saveGame(s);
      expect([...store.data.keys()]).toEqual(['immortal-snail:game:v3']);
      const restored = loadGame();
      expect({ ...restored! }).toEqual({ ...s });
      expect(whiteMoves(restored!)).toEqual(whiteMoves(s));
    }
  });

  it('is null (the start screen opens) with no save, a corrupt save, or only an older version’s save', () => {
    expect(loadGame()).toBeNull();
    store.data.set('immortal-snail:game:v3', '{not json');
    expect(loadGame()).toBeNull();
    store.data.clear();
    store.data.set('immortal-snail:game:v2', JSON.stringify({ v: 2, moves: ['e2e4'], snail: 'a8', turn: 1 }));
    expect(loadGame()).toBeNull();
  });

  it('works (as no save) when storage is blocked', () => {
    blockStorage();
    expect(() => saveGame(newGame('ghost'))).not.toThrow();
    expect(loadGame()).toBeNull();
  });
});

describe('last mode', () => {
  it('defaults to Ghost and remembers the mode picked', () => {
    expect(loadMode()).toBe('ghost');
    saveMode('hungry');
    expect(store.data.get('immortal-snail:mode')).toBe('hungry');
    expect(loadMode()).toBe('hungry');
    store.data.set('immortal-snail:mode', 'turbo');
    expect(loadMode()).toBe('ghost');
    blockStorage();
    expect(() => saveMode('sacrifice')).not.toThrow();
    expect(loadMode()).toBe('ghost');
  });
});

describe('record', () => {
  it('keeps one record of wins, losses and draws per mode', () => {
    let st = emptyStats();
    st = recordResult(st, 'win');
    st = recordResult(st, 'loss');
    st = recordResult(st, 'loss');
    st = recordResult(st, 'draw');
    expect(st).toEqual({ w: 1, l: 2, d: 1 });
    saveStats('hungry', st);
    expect(store.data.get('immortal-snail:stats:hungry')).toBe(JSON.stringify(st));
    expect(loadStats('hungry')).toEqual({ w: 1, l: 2, d: 1 });
    expect(loadAllStats()).toEqual({ ghost: emptyStats(), hungry: { w: 1, l: 2, d: 1 }, sacrifice: emptyStats() });
  });

  it('ignores corrupt data and the old single record', () => {
    store.data.set('immortal-snail:stats:v2', JSON.stringify({ w: 3, l: 0, d: 0 }));
    expect(loadAllStats()).toEqual({ ghost: emptyStats(), hungry: emptyStats(), sacrifice: emptyStats() });
    store.data.set('immortal-snail:stats:ghost', '{oops');
    expect(loadStats('ghost')).toEqual({ w: 0, l: 0, d: 0 });
    store.data.set('immortal-snail:stats:ghost', JSON.stringify({ w: -1, l: 'x', d: 2.7 }));
    expect(loadStats('ghost')).toEqual({ w: 0, l: 0, d: 2 });
  });
});

describe('Add to Home Screen hint', () => {
  it('remembers that it was closed, under the old immortal-snail: prefix', () => {
    expect(loadInstallHintDismissed()).toBe(false);
    saveInstallHintDismissed();
    expect(store.data.get('immortal-snail:install-hint')).toBe('dismissed');
    expect(loadInstallHintDismissed()).toBe(true);
  });

  it('shows again (no crash) when storage is blocked', () => {
    blockStorage();
    expect(loadInstallHintDismissed()).toBe(false);
    expect(() => saveInstallHintDismissed()).not.toThrow();
  });
});
