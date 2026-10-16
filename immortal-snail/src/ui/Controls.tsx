import { useEffect, useState, type Ref } from 'react';

const ARM_MS = 3000;

/**
 * "New game". While a game is in progress the first tap arms it ("Sure? Tap again", short enough to
 * stay on one line on a 360px phone); a second tap within 3 s opens the mode picker. It disarms on
 * timeout or blur. No confirm() dialogs. A controller's Y / Start presses it the same way.
 */
export function NewGameButton({
  inProgress,
  onNewGame,
  buttonRef,
}: {
  inProgress: boolean;
  onNewGame: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
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
      ref={buttonRef}
      type="button"
      className={`btn ${armed ? 'btn-warn' : 'btn-primary'} flex-1`}
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
      {armed ? 'Sure? Tap again' : 'New game'}
    </button>
  );
}
