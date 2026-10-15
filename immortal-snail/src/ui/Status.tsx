import type { Color, Square } from 'chess.js';
import {
  PIECE_NAMES,
  checkedKing,
  describeComputerMove,
  eatMessage,
  pieceAt,
  previousCrawl,
  snailDistances,
  type Eat,
  type GameState,
} from '../game/engine';
import { turnsUntilCrawl } from '../game/snail';
import { MOVE_HINT } from './text';

type Tone = 'muted' | 'good' | 'bad';
const TONE_CLASS: Record<Tone, string> = {
  muted: 'text-muted',
  good: 'font-semibold text-good',
  bad: 'font-semibold text-danger',
};

type Part = { text: string; tone: Tone };

/**
 * The warnings (a snail next to a king) and what the snails just ate. A snail that ate and is now
 * next to a king says both in one sentence. When both snails have news it is said more briefly,
 * so it still fits in about two lines on a phone.
 */
function snailNews(eats: Eat[], dist: Record<Color, number>): Part[] {
  const ate = { w: eats.find((e) => e.by === 'w'), b: eats.find((e) => e.by === 'b') };
  const build = (brief: boolean): Part[] => {
    const parts: Part[] = [];
    const nextTo = brief ? 'by' : 'and is next to';
    if (dist.b <= 1) {
      const text = ate.b ? `Watch out! Their snail ate your ${PIECE_NAMES[ate.b.piece]} ${nextTo} your king.` : 'Watch out! Their snail is next to your king.';
      parts.push({ text, tone: 'bad' });
    } else if (ate.b) {
      parts.push({ text: eatMessage(ate.b), tone: 'bad' });
    }
    const yours = brief && parts.length > 0 ? 'Yours' : 'Your snail';
    if (dist.w <= 1) {
      const text = ate.w ? `${yours} ate their ${PIECE_NAMES[ate.w.piece]} ${nextTo} their king!` : `${yours} is next to their king!`;
      parts.push({ text, tone: 'good' });
    } else if (ate.w) {
      parts.push({ text: `${yours} ate their ${PIECE_NAMES[ate.w.piece]}!`, tone: 'good' });
    }
    return parts;
  };
  const full = build(false);
  return full.map((p) => p.text).join(' ').length > 80 ? build(true) : full;
}

/** At most two short lines: whose move it is, then the snails (or news, a warning or the move hint). */
export function Status({ game, crawling }: { game: GameState; crawling: boolean }) {
  const over = game.phase === 'over' && !crawling;
  let headline: string;
  let mood: 'you' | 'cpu' | 'snail' | 'over';
  if (over) {
    headline = game.result?.title ?? 'Game over';
    mood = 'over';
  } else if (game.phase === 'crawl' || crawling) {
    headline = 'Snails crawl…';
    mood = 'snail';
  } else if (game.phase === 'black') {
    headline = 'Computer is thinking…';
    mood = 'cpu';
  } else {
    headline = checkedKing(game) ? 'Your move — you’re in check!' : 'Your move';
    mood = 'you';
  }

  const dist = snailDistances(game) ?? { w: 0, b: 0 };
  const eats = previousCrawl(game)?.eats ?? [];
  // Line 2, in parts that each keep their own colour: the warnings and the Hungry news (which
  // shows for the turn after the crawl), their snail first.
  const parts: Part[] = [];
  if (over) {
    parts.push({ text: game.result?.reason ?? '', tone: 'muted' });
  } else {
    parts.push(...snailNews(eats, dist));
    if (parts.length === 0) {
      let text: string;
      if (game.history.length === 0 && game.phase === 'white') {
        text = MOVE_HINT;
      } else {
        const n = turnsUntilCrawl(game.turn);
        const when = n === 1 ? 'Snails crawl after this turn' : `Snails crawl in ${n} turns`;
        text = `${when} · yours ${dist.w} away · theirs ${dist.b} away`;
      }
      parts.push({ text, tone: 'muted' });
    }
  }

  // Screen readers can't see the last-move highlight or the snails' glide, so say them.
  const computerMove = describeComputerMove(game);
  const crawl = game.phase === 'white' ? previousCrawl(game) : null;

  return (
    <div className="status panel" aria-live="polite">
      <p className="flex min-w-0 items-center gap-2 text-base font-bold">
        <span className={`mood mood-${mood}`} aria-hidden="true" />
        {headline}
      </p>
      {/* On phones line 2 fits on one line on some turns and wraps on others, so it always keeps room
          for two lines there: the controls below don't jump every turn. */}
      <p className="mt-1 min-h-[2.5rem] text-sm sm:min-h-0">
        {parts.map((part, i) => (
          <span key={i}>
            {i > 0 && ' '}
            <span className={TONE_CLASS[part.tone]}>{part.text}</span>
          </span>
        ))}
      </p>
      <p className="sr-only">
        {computerMove && <span>{computerMove}</span>}
        {crawl && (
          <span>
            {' '}
            The snails crawled: yours to {crawl.to.w}, theirs to {crawl.to.b}.
          </span>
        )}
      </p>
    </div>
  );
}

/**
 * Sacrifice setup: in place of the status, the prompt to pick a piece and the Start button
 * (disabled until a piece is picked).
 */
export function SacrificePanel({
  game,
  pick,
  kingTapped,
  onStart,
}: {
  game: GameState;
  pick: Square | null;
  /** The player just tapped their king, which can't be given up. */
  kingTapped: boolean;
  onStart: () => void;
}) {
  const piece = pick ? pieceAt(game, pick) : null;
  // A king tap after a pick keeps that pick (Start still gives it up), so it is still named.
  let detail = 'Tap one of your pieces (not the king).';
  if (pick && piece) detail = `Give up your ${PIECE_NAMES[piece.type]} (${pick})? The computer gives up its ${PIECE_NAMES[piece.type]} too.`;
  else if (kingTapped) detail = 'Tap another piece.';
  return (
    <div className="status panel flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1" aria-live="polite">
        <p className="flex min-w-0 items-center gap-2 text-base font-bold">
          <span className="mood mood-you" aria-hidden="true" />
          Pick a piece to give up
        </p>
        <p className="mt-1 min-h-[2.5rem] text-sm text-muted sm:min-h-0">
          {kingTapped && <span className="font-semibold text-danger">Not the king! </span>}
          {detail}
        </p>
      </div>
      <button type="button" className="btn btn-primary btn-big shrink-0 sm:w-36" disabled={!piece} onClick={onStart}>
        Start
      </button>
    </div>
  );
}
