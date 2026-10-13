import { DIFFICULTY } from '../game/difficulty';
import { checkedKing, describeComputerMove, snailDistance, snailJustCrawled, type GameState } from '../game/engine';
import { turnsUntilSnailMoves } from '../game/snail';

export function Status({ game, crawling }: { game: GameState; crawling: boolean }) {
  const over = game.phase === 'over';
  let headline: string;
  let mood: 'you' | 'cpu' | 'snail' | 'over';
  if (over && !crawling) {
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
  const n = turnsUntilSnailMoves(game.turn, game.difficulty);
  // Screen readers can't see the last-move highlight or the snail's glide, so say them.
  const computerMove = describeComputerMove(game);
  const crawled = snailJustCrawled(game);

  // Phones (below sm): the headline gets the whole first row and the details always take two
  // lines, so the panel keeps the same height from turn to turn and the controls below don't jump.
  return (
    <div className="status panel" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2 text-base font-bold">
          <span className={`mood mood-${mood}`} aria-hidden="true" />
          {headline}
        </p>
        <span className="chip shrink-0 max-sm:hidden">
          Turn {game.turn} · {DIFFICULTY[game.difficulty].label}
        </span>
      </div>
      {over && !crawling ? (
        <p className="mt-1 text-sm text-muted">{game.result?.reason}</p>
      ) : (
        <p className="mt-1 text-sm text-muted">
          <span className={`max-sm:block ${dist <= 1 ? 'font-semibold text-danger' : ''}`}>
            Snail is {dist} square{dist === 1 ? '' : 's'} from your king
          </span>
          <span className="max-sm:hidden" aria-hidden="true">
            {' · '}
          </span>
          <span className="max-sm:flex max-sm:items-center max-sm:justify-between max-sm:gap-2">
            <span>{n === 1 ? 'Snail moves after this turn' : `Snail moves in ${n} turns`}</span>
            <span className="chip shrink-0 leading-4 sm:hidden">Turn {game.turn}</span>
          </span>
        </p>
      )}
      <p className="sr-only">
        {computerMove && <span>{computerMove}</span>}
        {crawled && <span> The snail crawled to {game.snail}.</span>}
      </p>
    </div>
  );
}
