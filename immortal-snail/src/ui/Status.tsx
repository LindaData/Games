import { checkedKing, describeComputerMove, snailDistance, snailJustCrawled, type GameState } from '../game/engine';
import { turnsUntilSnailMoves } from '../game/snail';
import { MOVE_HINT } from './Panels';

/** At most two short lines: whose move it is, then the snail (or the move hint, or a warning). */
export function Status({ game, crawling }: { game: GameState; crawling: boolean }) {
  const over = game.phase === 'over' && !crawling;
  let headline: string;
  let mood: 'you' | 'cpu' | 'snail' | 'over';
  if (over) {
    headline = game.result?.title ?? 'Game over';
    mood = 'over';
  } else if (game.phase === 'snail' || crawling) {
    headline = 'The snail crawls…';
    mood = 'snail';
  } else if (game.phase === 'black') {
    headline = 'Computer is thinking…';
    mood = 'cpu';
  } else {
    headline = checkedKing(game) ? 'Your move — you’re in check!' : 'Your move';
    mood = 'you';
  }

  const dist = snailDistance(game);
  const n = turnsUntilSnailMoves(game.turn);
  let detail: string;
  let warn = false;
  if (over) {
    detail = game.result?.reason ?? '';
  } else if (dist <= 1) {
    detail = 'Watch out! The snail is next to your king.';
    warn = true;
  } else if (game.history.length === 0 && game.phase === 'white') {
    detail = MOVE_HINT;
  } else {
    const when = n === 1 ? 'Snail crawls after this turn' : `Snail crawls in ${n} turns`;
    detail = `${when} · ${dist} square${dist === 1 ? '' : 's'} away`;
  }

  // Screen readers can't see the last-move highlight or the snail's glide, so say them.
  const computerMove = describeComputerMove(game);
  const crawled = snailJustCrawled(game);

  return (
    <div className="status panel" aria-live="polite">
      <p className="flex min-w-0 items-center gap-2 text-base font-bold">
        <span className={`mood mood-${mood}`} aria-hidden="true" />
        {headline}
      </p>
      {/* On phones line 2 fits on one line on some turns and wraps on others, so it always keeps room
          for two lines there: the controls below don't jump every turn. */}
      <p className={`mt-1 min-h-[2.5rem] text-sm sm:min-h-0 ${warn ? 'font-semibold text-danger' : 'text-muted'}`}>{detail}</p>
      <p className="sr-only">
        {computerMove && <span>{computerMove}</span>}
        {crawled && <span> The snail crawled to {game.snail}.</span>}
      </p>
    </div>
  );
}
