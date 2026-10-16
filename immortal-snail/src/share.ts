/**
 * Sharing: the system share sheet (navigator.share) where there is one, otherwise the link is
 * copied to the clipboard ("Link copied"). The texts are short and always end with the game's
 * public address (src/site.json).
 */
import { turnsPlayed, type GameState } from './game/engine';
import { SITE } from './site';
import { MODE_INFO } from './ui/text';

export interface ShareData {
  title: string;
  text: string;
  url: string;
}

export type ShareMethod = 'native' | 'copy';
export type ShareOutcome = { ok: true; method: ShareMethod } | { ok: false; reason: 'cancelled' | 'failed' };

export const LINK_TEXT = 'A snail is hunting my king 🐌♟️ Can you win?';

/** The Share button: the game's link with a one-line invitation. */
export function linkShare(): ShareData {
  return { title: SITE.name, text: LINK_TEXT, url: SITE.url };
}

/** One line about how a finished game went, e.g. "I beat the snail in 23 turns (Hungry Snails) 🐌♟️". */
export function resultText(game: GameState): string | null {
  const result = game.result;
  if (!result) return null;
  const n = turnsPlayed(game);
  const turns = `${n} ${n === 1 ? 'turn' : 'turns'}`;
  const mode = `(${MODE_INFO[game.mode].name}) 🐌♟️`;
  switch (result.cause) {
    case 'snail-win':
    case 'trapped-win':
      return `My snail got their king in ${turns} ${mode}`;
    case 'checkmate':
    case 'open':
      return `I beat the snail in ${turns} ${mode}`;
    case 'snail-loss':
    case 'trapped-loss':
      return `The snail got me in ${turns}… ${mode}`;
    case 'checkmated':
      return `Checkmated in ${turns}… ${mode}`;
    default:
      return `A draw after ${turns} ${mode}`;
  }
}

/** The end card's Share result. */
export function resultShare(game: GameState): ShareData | null {
  const text = resultText(game);
  return text ? { title: SITE.name, text, url: SITE.url } : null;
}

/** What gets copied when there is no share sheet: the text, then the link. */
export const clipboardText = (data: ShareData) => `${data.text} ${data.url}`;

/** execCommand('copy') with the text put on the clipboard by a copy handler: no selection or focus change. */
function copyWithEvent(text: string): boolean {
  let done = false;
  const onCopy = (e: ClipboardEvent) => {
    if (!e.clipboardData) return;
    e.clipboardData.setData('text/plain', text);
    e.preventDefault();
    done = true;
  };
  document.addEventListener('copy', onCopy);
  try {
    return document.execCommand('copy') && done;
  } catch {
    return false;
  } finally {
    document.removeEventListener('copy', onCopy);
  }
}

/** execCommand('copy') from a hidden textarea (older iOS Safari), handing focus back afterwards. */
function copyWithTextarea(text: string): boolean {
  const active = document.activeElement;
  const area = document.createElement('textarea');
  try {
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, text.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    area.remove();
    if (active instanceof HTMLElement) active.focus({ preventScroll: true });
  }
}

/**
 * Copy text: the async Clipboard API, else execCommand (browsers or hosts that deny the Clipboard
 * API, like the desktop app, which grants web pages no permissions).
 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* denied or unavailable: try the old ways */
  }
  return copyWithEvent(text) || copyWithTextarea(text);
}

/** Share sheet first; if there is none (or it fails), copy. A cancelled share sheet is not a failure. */
export async function shareOrCopy(data: ShareData): Promise<ShareOutcome> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (typeof nav.share === 'function' && (!nav.canShare || nav.canShare(data))) {
    try {
      await nav.share(data);
      return { ok: true, method: 'native' };
    } catch (e) {
      if ((e as { name?: unknown } | null)?.name === 'AbortError') return { ok: false, reason: 'cancelled' };
      // NotAllowedError and friends: fall back to copying.
    }
  }
  return (await copyText(clipboardText(data))) ? { ok: true, method: 'copy' } : { ok: false, reason: 'failed' };
}
