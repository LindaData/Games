import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyWhiteMove, newGame, parseUci, turnsPlayed, type GameState } from '../src/game/engine';
import { LINK_TEXT, clipboardText, linkShare, resultShare, resultText, shareOrCopy } from '../src/share';
import { SITE } from '../src/site';

/** Plays White's moves (no replies needed for the counts) and fakes the end of the game. */
function finished(mode: GameState['mode'], cause: NonNullable<GameState['result']>['cause'], plies: number): GameState {
  const g = newGame(mode);
  const outcome = cause.includes('win') || cause === 'checkmate' || cause === 'open' ? 'win' : /loss|checkmated/.test(cause) ? 'loss' : 'draw';
  return {
    ...g,
    history: Array.from({ length: plies }, () => 'e2e4'),
    phase: 'over',
    result: { outcome, cause, title: '', reason: '' },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('share texts', () => {
  it('shares the public address from site.json with a short invitation', () => {
    expect(linkShare()).toEqual({ title: SITE.name, text: 'A snail is hunting my king 🐌♟️ Can you win?', url: SITE.url });
    expect(SITE.url).toMatch(/^https:\/\/[^/]+$/); // no trailing slash
    expect(clipboardText(linkShare())).toBe(`${LINK_TEXT} ${SITE.url}`);
  });

  it('counts turns as your moves', () => {
    const g = applyWhiteMove(newGame('ghost'), parseUci('e2e4'));
    expect(turnsPlayed(newGame('ghost'))).toBe(0);
    expect(turnsPlayed(g)).toBe(1);
    expect(turnsPlayed({ ...g, history: ['e2e4', 'e7e5', 'g1f3'] })).toBe(2);
  });

  it('says how each kind of ending went, with the mode', () => {
    expect(resultText(finished('hungry', 'checkmate', 45))).toBe('I beat the snail in 23 turns (Hungry Snails) 🐌♟️');
    expect(resultText(finished('ghost', 'snail-win', 30))).toBe('My snail got their king in 15 turns (Ghost Snails) 🐌♟️');
    expect(resultText(finished('ghost', 'trapped-win', 30))).toBe('My snail got their king in 15 turns (Ghost Snails) 🐌♟️');
    expect(resultText(finished('ghost', 'open', 13))).toBe('I beat the snail in 7 turns (Ghost Snails) 🐌♟️');
    expect(resultText(finished('sacrifice', 'snail-loss', 28))).toBe('The snail got me in 14 turns… (Sacrifice Snails) 🐌♟️');
    expect(resultText(finished('ghost', 'trapped-loss', 28))).toBe('The snail got me in 14 turns… (Ghost Snails) 🐌♟️');
    expect(resultText(finished('hungry', 'checkmated', 20))).toBe('Checkmated in 10 turns… (Hungry Snails) 🐌♟️');
    expect(resultText(finished('ghost', 'snail-draw', 2))).toBe('A draw after 1 turn (Ghost Snails) 🐌♟️');
    expect(resultText(finished('ghost', 'threefold', 40))).toBe('A draw after 20 turns (Ghost Snails) 🐌♟️');
  });

  it('has nothing to share before the game is over', () => {
    expect(resultText(newGame('ghost'))).toBeNull();
    expect(resultShare(newGame('ghost'))).toBeNull();
    expect(resultShare(finished('ghost', 'checkmate', 1))).toEqual({ title: SITE.name, text: expect.stringContaining('I beat the snail'), url: SITE.url });
  });
});

describe('share sheet or copy', () => {
  const data = linkShare();

  it('uses the share sheet when there is one', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();
    vi.stubGlobal('navigator', { share, canShare: () => true, clipboard: { writeText } });
    expect(await shareOrCopy(data)).toEqual({ ok: true, method: 'native' });
    expect(share).toHaveBeenCalledWith(data);
    expect(writeText).not.toHaveBeenCalled();
  });

  it('treats closing the share sheet as cancelled, not as a failure (and copies nothing)', async () => {
    const writeText = vi.fn();
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' })), clipboard: { writeText } });
    expect(await shareOrCopy(data)).toEqual({ ok: false, reason: 'cancelled' });
    expect(writeText).not.toHaveBeenCalled();
  });

  it('copies the text and link when the share sheet refuses', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'NotAllowedError' })), clipboard: { writeText } });
    expect(await shareOrCopy(data)).toEqual({ ok: true, method: 'copy' });
    expect(writeText).toHaveBeenCalledWith(`${data.text} ${data.url}`);
  });

  it('copies when there is no share sheet (desktop browsers, the desktop app)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    expect(await shareOrCopy(data)).toEqual({ ok: true, method: 'copy' });
    expect(writeText).toHaveBeenCalledOnce();
  });

  it('skips a share sheet that says it cannot share this', async () => {
    const share = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share, canShare: () => false, clipboard: { writeText } });
    expect(await shareOrCopy(data)).toEqual({ ok: true, method: 'copy' });
    expect(share).not.toHaveBeenCalled();
  });

  it('falls back to execCommand("copy") when the Clipboard API is denied, without moving focus', async () => {
    const listeners = new Map<string, (e: unknown) => void>();
    const setData = vi.fn();
    const preventDefault = vi.fn();
    const execCommand = vi.fn(() => {
      listeners.get('copy')?.({ clipboardData: { setData }, preventDefault });
      return true;
    });
    const createElement = vi.fn();
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    vi.stubGlobal('document', {
      addEventListener: (type: string, fn: (e: unknown) => void) => listeners.set(type, fn),
      removeEventListener: (type: string) => listeners.delete(type),
      execCommand,
      createElement,
    });
    expect(await shareOrCopy(data)).toEqual({ ok: true, method: 'copy' });
    expect(setData).toHaveBeenCalledWith('text/plain', `${data.text} ${data.url}`);
    expect(preventDefault).toHaveBeenCalled();
    expect(createElement).not.toHaveBeenCalled(); // no textarea, so focus stays put
    expect(listeners.size).toBe(0);
  });

  it('tries a hidden textarea last, and reports a total failure', async () => {
    const area = { value: '', style: { cssText: '' }, setAttribute: vi.fn(), select: vi.fn(), setSelectionRange: vi.fn(), remove: vi.fn() };
    const execCommand = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('HTMLElement', class {});
    vi.stubGlobal('document', {
      activeElement: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      createElement: () => area,
      body: { appendChild: vi.fn() },
      execCommand,
    });
    expect(await shareOrCopy(data)).toEqual({ ok: true, method: 'copy' });
    expect(area.value).toBe(`${data.text} ${data.url}`);
    expect(area.remove).toHaveBeenCalled();

    execCommand.mockReturnValue(false);
    expect(await shareOrCopy(data)).toEqual({ ok: false, reason: 'failed' });
  });
});
