import { useEffect, useRef } from 'react';
import type { GameState } from '../game/engine';
import { SNAIL_EVERY } from '../game/settings';
import type { Stats } from '../storage';
import { Snail } from './Snail';

/** The whole rulebook. */
export const RULES = [
  'You are White. Checkmate the computer to win.',
  `Every ${SNAIL_EVERY} turns, the snail crawls 1 square toward your king. Nothing can stop it.`,
  'If the snail touches your king, you lose.',
];

export const MOVE_HINT = 'Tap a piece, then tap a dot.';

const recordText = (s: Stats) => `Wins ${s.w} · Losses ${s.l} · Draws ${s.d}`;

/**
 * The rules card, drawn over the board. It opens by itself on the first visit and from the
 * Rules button after that. Esc, the button or a tap outside closes it; the game is untouched.
 */
export function RulesCard({ buttonLabel, onClose }: { buttonLabel: string; onClose: () => void }) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Focus moves into the card, then back to whatever had it (or the board) when the card closes.
  useEffect(() => {
    const returnTo = document.activeElement;
    buttonRef.current?.focus();
    return () => {
      const target =
        returnTo instanceof HTMLElement && returnTo !== document.body && returnTo.isConnected
          ? returnTo
          : document.querySelector<HTMLElement>('.board .sq[tabindex="0"]');
      target?.focus({ preventScroll: true });
    };
  }, []);

  // Listened for on the whole page, so they still work after a click on the card's text has
  // dropped focus to <body>.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Tab') {
        // The button is the card's only control, so Tab always lands on it (never on the board).
        e.preventDefault();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      {/* tabIndex -1: a tap here takes focus as a pointer focus, so (like the button's onPointerDown
          below) closing by tap hands no keyboard focus ring on to the board. */}
      <div className="rules-backdrop" tabIndex={-1} onClick={onClose} aria-hidden="true" />
      <div className="rules-wrap">
        <div className="rules-card" role="dialog" aria-modal="true" aria-labelledby="rules-title" aria-describedby="rules-list">
          <div className="flex items-center gap-3">
            <Snail className="h-12 w-12 shrink-0" />
            <h2 id="rules-title" className="text-lg font-extrabold leading-tight sm:text-xl">
              Immortal Snail Chess
            </h2>
          </div>
          <ol id="rules-list" className="rules-list">
            {RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ol>
          <p className="mt-3 text-sm text-muted">{MOVE_HINT}</p>
          <button
            ref={buttonRef}
            type="button"
            className="btn btn-primary btn-big mt-4 w-full"
            // The button got focus from script on open, which shows the keyboard focus ring, and a tap
            // keeps that ring and hands it on to the board square focused on close. Letting go of
            // focus here makes the tap refocus the button as a pointer focus, with no ring to pass on.
            onPointerDown={(e) => e.currentTarget.blur()}
            onClick={onClose}
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </>
  );
}

export function StatsLine({ stats }: { stats: Stats }) {
  return <p className="stats text-sm text-muted">{recordText(stats)}</p>;
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
  /** Which half of the board the card sits in: away from the king the result is about (see focalKing). */
  placement: 'top' | 'bottom';
  onPlayAgain: () => void;
  onHide: () => void;
}) {
  const playRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    playRef.current?.focus({ preventScroll: true });
  }, []);
  const result = game.result;
  if (!result) return null;
  return (
    <div className={`overlay card-${placement} ${result.cause === 'snail' ? 'late' : ''}`}>
      <div className={`result-card outcome-${result.outcome}`} role="dialog" aria-labelledby="result-title" aria-describedby="result-reason">
        <h2 id="result-title" className="text-xl font-extrabold">
          {result.title}
        </h2>
        <p id="result-reason" className="mt-1 text-sm">
          {result.reason}
        </p>
        <p className="mt-2 text-xs text-muted">{recordText(stats)}</p>
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
