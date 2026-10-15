import { useEffect, useRef, type PointerEvent, type ReactNode, type RefObject } from 'react';
import { SNAIL_STRIKES, type GameState } from '../game/engine';
import { MODES, type Mode } from '../game/settings';
import type { Stats } from '../storage';
import { PieceIcon } from './PieceIcon';
import { Snail } from './Snail';
import { MODE_INFO, MOVE_HINT, RULES, recordText } from './text';

/**
 * A button that got focus from script (when a dialog opens) shows the keyboard focus ring, and a
 * tap would keep that ring and hand it on to whatever gets focus when the dialog closes. Letting
 * go of focus on pointer-down makes the tap refocus the button as a pointer focus, with no ring.
 */
const dropScriptFocus = (e: PointerEvent<HTMLElement>) => e.currentTarget.blur();

/** Both snails, facing each other: theirs (bronze) and yours (green). */
export function SnailPair({ className }: { className?: string }) {
  return (
    <span className={`snail-pair ${className ?? ''}`} aria-hidden="true">
      <Snail owner="b" />
      <Snail owner="w" facing="left" />
    </span>
  );
}

/** "Your snail" (green) and "Their snail" (bronze), side by side, and what the dotted squares mean. */
function SnailLegend({ className }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-5 gap-y-1 text-sm font-bold ${className ?? ''}`}>
      <span className="inline-flex items-center gap-1.5">
        <Snail owner="w" className="h-8 w-8" /> Your snail
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Snail owner="b" className="h-8 w-8" /> Their snail
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="legend-next" aria-hidden="true" /> Where each snail crawls next
      </span>
    </div>
  );
}

/**
 * A modal dialog over the dimmed page. Focus moves in (to `initialFocus`, or else to the card
 * itself, which shows no ring), Tab cycles inside, and focus goes back to whatever had it (or the
 * board) on close. When `onClose` is given, Esc and a tap outside the card close it.
 */
function Modal({
  labelledBy,
  describedBy,
  initialFocus,
  onClose,
  className,
  children,
}: {
  labelledBy: string;
  describedBy?: string;
  initialFocus?: RefObject<HTMLElement>;
  onClose?: () => void;
  className?: string;
  children: ReactNode;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const returnTo = document.activeElement;
    (initialFocus?.current ?? cardRef.current)?.focus({ preventScroll: true });
    return () => {
      const target =
        returnTo instanceof HTMLElement && returnTo !== document.body && returnTo.isConnected
          ? returnTo
          : document.querySelector<HTMLElement>('.board .sq[tabindex="0"]');
      target?.focus({ preventScroll: true });
    };
    // Only on open and close.
  }, []);

  // Listened for on the whole page, so they still work after a click on the card's text has
  // dropped focus to <body>.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Tab') {
        const items = Array.from(cardRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? []);
        if (items.length === 0) return;
        e.preventDefault();
        const i = items.indexOf(document.activeElement as HTMLElement);
        const step = e.shiftKey ? -1 : 1;
        const next = i === -1 ? (e.shiftKey ? items.length - 1 : 0) : (i + step + items.length) % items.length;
        items[next].focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    // tabIndex -1: a tap outside the card takes focus as a pointer focus, so closing by tap hands
    // no keyboard focus ring on to the board.
    <div className="modal" tabIndex={-1} onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div
        ref={cardRef}
        tabIndex={-1}
        className={`modal-card ${className ?? ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
      >
        {children}
      </div>
    </div>
  );
}

/** A tiny picture of what a mode's snail does to a piece (the differences are drawn in CSS). */
function ModeArt({ mode }: { mode: Mode }) {
  return (
    <span className={`mode-art art-${mode}`} aria-hidden="true">
      <PieceIcon type="n" color={mode === 'sacrifice' ? 'w' : 'b'} className="art-piece" />
      {mode === 'sacrifice' && <span className="art-arrow">→</span>}
      <Snail owner="w" className="art-snail" />
    </span>
  );
}

/**
 * The start screen: three big cards, one per mode, then the shared rules. On a first visit it
 * must be answered; from New game it can be closed to keep playing (`onClose`). Opened from New
 * game, focus starts on the current mode's card. Opened by itself on load, nothing has been
 * tapped yet, so a focused card would show a ring and look already chosen: the dialog takes focus.
 */
export function ModePicker({ current, onPick, onClose }: { current: Mode; onPick: (mode: Mode) => void; onClose?: () => void }) {
  const currentRef = useRef<HTMLButtonElement>(null);
  return (
    <Modal labelledBy="picker-title" initialFocus={onClose ? currentRef : undefined} onClose={onClose} className="picker-card">
      <div className="flex items-center gap-3">
        <SnailPair className="h-9 shrink-0 sm:h-11" />
        <div className="min-w-0 flex-1">
          <h2 id="picker-title" className="text-lg font-extrabold leading-tight sm:text-xl">
            Immortal Snail Chess
          </h2>
          <p className="text-sm text-muted">Pick a game</p>
        </div>
        {onClose && (
          <button type="button" className="close-btn" aria-label="Close" onPointerDown={dropScriptFocus} onClick={onClose}>
            ×
          </button>
        )}
      </div>
      <div className="mt-4 flex flex-col gap-2.5">
        {MODES.map((mode) => (
          <button
            key={mode}
            ref={mode === current ? currentRef : undefined}
            type="button"
            className="mode-card"
            onPointerDown={dropScriptFocus}
            onClick={() => onPick(mode)}
          >
            <ModeArt mode={mode} />
            <span className="min-w-0">
              <span className="block text-base font-extrabold leading-tight">{MODE_INFO[mode].name}</span>
              <span className="mt-0.5 block text-sm leading-snug text-muted">{MODE_INFO[mode].rule}</span>
            </span>
          </button>
        ))}
      </div>
      <SnailLegend className="mt-4" />
      <ol className="rules-list rules-compact">
        {RULES.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ol>
      <p className="mt-3 text-sm text-muted">{MOVE_HINT}</p>
    </Modal>
  );
}

/** The rules card for the current mode: the shared rules, then the mode's own rule (highlighted). */
export function RulesCard({ mode, onClose }: { mode: Mode; onClose: () => void }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  return (
    <Modal labelledBy="rules-title" describedBy="rules-list" initialFocus={buttonRef} onClose={onClose}>
      <div className="flex items-center gap-3">
        <SnailPair className="h-9 shrink-0 sm:h-11" />
        <div className="min-w-0">
          <h2 id="rules-title" className="text-lg font-extrabold leading-tight sm:text-xl">
            {MODE_INFO[mode].name}
          </h2>
          <p className="text-sm text-muted">Immortal Snail Chess</p>
        </div>
      </div>
      <SnailLegend className="mt-4" />
      <ol id="rules-list" className="rules-list">
        {RULES.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
        <li className="mode-rule">{MODE_INFO[mode].rule}</li>
      </ol>
      <p className="mt-3 text-sm text-muted">{MOVE_HINT}</p>
      <button ref={buttonRef} type="button" className="btn btn-primary btn-big mt-4 w-full" onPointerDown={dropScriptFocus} onClick={onClose}>
        Close
      </button>
    </Modal>
  );
}

export function StatsLine({ mode, stats }: { mode: Mode; stats: Stats }) {
  return <p className="stats text-sm text-muted">{recordText(mode, stats)}</p>;
}

export function GameOverCard({
  game,
  stats,
  placement,
  onPlayAgain,
  onHide,
}: {
  game: GameState;
  stats: Stats;
  /** Where the card sits: away from the king the result is about (see focalKing), or in the middle. */
  placement: 'top' | 'middle' | 'bottom';
  onPlayAgain: () => void;
  onHide: () => void;
}) {
  const playRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    playRef.current?.focus({ preventScroll: true });
  }, []);
  const result = game.result;
  if (!result) return null;
  // A snail strike waits a moment so the knocked-over king is seen first.
  const late = SNAIL_STRIKES.includes(result.cause);
  return (
    <div className={`overlay card-${placement} ${late ? 'late' : ''}`}>
      <div className={`result-card outcome-${result.outcome}`} role="dialog" aria-labelledby="result-title" aria-describedby="result-reason">
        <h2 id="result-title" className="text-xl font-extrabold">
          {result.title}
        </h2>
        <p id="result-reason" className="mt-1 text-sm">
          {result.reason}
        </p>
        <p className="mt-2 text-xs text-muted">{recordText(game.mode, stats)}</p>
        <div className="mt-3 flex flex-col items-center gap-1.5">
          <button ref={playRef} type="button" className="btn btn-primary w-full" onClick={onPlayAgain}>
            Play again
          </button>
          <button type="button" className="link-btn text-xs" onClick={onHide}>
            View board
          </button>
        </div>
      </div>
    </div>
  );
}
