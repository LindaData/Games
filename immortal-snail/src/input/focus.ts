/**
 * Applies controller moves to the page: which part of the page is active (the open dialog or
 * game-over card, else the page with the board), what in it can take focus, and where focus goes.
 */
import { pickNext, type Direction } from './spatial';

const FOCUSABLE = 'button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])';

const visible = (el: Element) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';

/** The open dialog (the last one, they stack in page order), or the whole page. */
export function activeScope(): HTMLElement {
  const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).filter(visible);
  return dialogs.at(-1) ?? document.body;
}

/** What the controller can move between: buttons, plus every board square on the page itself. */
export function focusables(scope: HTMLElement): HTMLElement[] {
  const items = new Set(scope.querySelectorAll<HTMLElement>(FOCUSABLE));
  if (scope === document.body) for (const sq of scope.querySelectorAll<HTMLElement>('.board .sq')) items.add(sq);
  return Array.from(items).filter(visible);
}

/** The board's current square: where arrow keys and the D-pad pick up on the board. */
export const boardSquare = () => document.querySelector<HTMLElement>('.board .sq[tabindex="0"]');

/** Where focus starts in a scope: its marked default, the board's current square, or the first item. */
export function defaultFocus(scope: HTMLElement): HTMLElement | null {
  return (
    scope.querySelector<HTMLElement>('[data-pad-default]') ??
    (scope === document.body ? boardSquare() : null) ??
    focusables(scope)[0] ??
    null
  );
}

/** The focused element if the controller can act on it in the active scope, else null. */
export function currentFocus(): HTMLElement | null {
  const el = document.activeElement;
  return el instanceof HTMLElement && focusables(activeScope()).includes(el) ? el : null;
}

/** D-pad: move focus that way (or, if nothing usable has focus yet, to the scope's default). */
export function moveFocus(dir: Direction): void {
  const scope = activeScope();
  const items = focusables(scope);
  const current = currentFocus();
  if (!current) {
    defaultFocus(scope)?.focus();
    return;
  }
  const rect = (el: HTMLElement) => el.getBoundingClientRect();
  const others = items.filter((el) => el !== current);
  const i = pickNext(rect(current), others.map(rect), dir);
  if (i >= 0) others[i].focus();
}
