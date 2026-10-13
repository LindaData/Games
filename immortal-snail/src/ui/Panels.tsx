import { useEffect, useRef } from 'react';
import { DIFFICULTIES, DIFFICULTY } from '../game/difficulty';
import type { GameState } from '../game/engine';
import type { Stats } from '../storage';

export function HowToPlay() {
  return (
    <details className="panel how">
      <summary>How to play</summary>
      <ul>
        <li>You are White. Tap a piece, then tap a dot to move it. Pawns promote to queens automatically.</li>
        <li>
          The bronze snail hunts your king. It can’t be captured or blocked, and crawls one square toward your
          king every few turns (Easy 3, Normal 2, Hard 1).
        </li>
        <li>If the snail touches your king, you lose. Your king can never step onto the snail.</li>
        <li>Checkmate the computer to win. The dotted outline shows where the snail crawls next.</li>
      </ul>
    </details>
  );
}

export function StatsLine({ stats }: { stats: Stats }) {
  return (
    <p className="stats text-xs text-muted">
      <span className="font-semibold">Record (W–L–D):</span>{' '}
      {DIFFICULTIES.map((d, i) => (
        <span key={d}>
          {i > 0 && ' · '}
          <span className="whitespace-nowrap">
            {DIFFICULTY[d].label} {stats[d].w}–{stats[d].l}–{stats[d].d}
          </span>
        </span>
      ))}
    </p>
  );
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
  const rec = stats[game.difficulty];
  const turns = Math.ceil(game.history.length / 2);
  return (
    <div className={`overlay card-${placement} ${result.cause === 'snail' ? 'late' : ''}`}>
      <div className={`result-card outcome-${result.outcome}`} role="dialog" aria-labelledby="result-title" aria-describedby="result-reason">
        <h2 id="result-title" className="text-xl font-extrabold">
          {result.title}
        </h2>
        <p id="result-reason" className="mt-1 text-sm">
          {result.reason}
        </p>
        <p className="mt-2 text-xs text-muted">
          {DIFFICULTY[game.difficulty].label} · {turns} turn{turns === 1 ? '' : 's'} · Record {rec.w}–{rec.l}–{rec.d}
        </p>
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
