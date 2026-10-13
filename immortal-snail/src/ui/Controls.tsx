import { useEffect, useState } from 'react';
import { DIFFICULTIES, DIFFICULTY, type Difficulty } from '../game/difficulty';

const ARM_MS = 3000;

/**
 * "New game". While a game is in progress the first tap arms it ("Tap again to restart");
 * a second tap within 3 s restarts. It disarms on timeout or blur. No confirm() dialogs.
 */
export function NewGameButton({ inProgress, onNewGame }: { inProgress: boolean; onNewGame: () => void }) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), ARM_MS);
    return () => clearTimeout(t);
  }, [armed]);

  useEffect(() => {
    if (!inProgress) setArmed(false);
  }, [inProgress]);

  return (
    <button
      type="button"
      className={`btn ${armed ? 'btn-warn' : 'btn-primary'} w-full`}
      onClick={() => {
        if (!inProgress || armed) {
          setArmed(false);
          onNewGame();
        } else {
          setArmed(true);
        }
      }}
      onBlur={() => setArmed(false)}
    >
      {armed ? 'Tap again to restart' : 'New game'}
    </button>
  );
}

export function DifficultyPicker({
  value,
  current,
  inProgress,
  onChange,
}: {
  /** The selected difficulty (applies to the next game when changed mid-game). */
  value: Difficulty;
  /** The difficulty of the game on the board. */
  current: Difficulty;
  inProgress: boolean;
  onChange: (d: Difficulty) => void;
}) {
  const pending = inProgress && value !== current;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span id="difficulty-label" className="text-sm font-semibold">
          Difficulty
        </span>
        {pending && <span className="text-xs text-muted">applies next game</span>}
      </div>
      <div className="segmented" role="radiogroup" aria-labelledby="difficulty-label">
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={value === d}
            onClick={() => onChange(d)}
            onKeyDown={(e) => {
              const i = DIFFICULTIES.indexOf(d);
              const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
              if (!step) return;
              e.preventDefault();
              const next = DIFFICULTIES[(i + step + DIFFICULTIES.length) % DIFFICULTIES.length];
              onChange(next);
              const group = e.currentTarget.parentElement;
              (group?.children[DIFFICULTIES.indexOf(next)] as HTMLElement | undefined)?.focus();
            }}
            tabIndex={value === d ? 0 : -1}
          >
            {DIFFICULTY[d].label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-muted">{DIFFICULTY[value].blurb}</p>
    </div>
  );
}
