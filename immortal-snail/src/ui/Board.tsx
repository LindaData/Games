import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { Square } from 'chess.js';
import {
  PIECE_NAMES,
  checkedKing,
  kingSquare,
  pieceAt,
  snailPreview,
  type GameState,
  type LegalMove,
} from '../game/engine';
import { chebyshev, fileOf, mirrorSquare, otherColor, rankOf, toSquare, type Snails } from '../game/snail';
import { PieceIcon } from './PieceIcon';
import { Snail } from './Snail';

const FILES = 'abcdefgh';
const COLOR_NAME = { w: 'white', b: 'black' } as const;
const SNAIL_NAME = { w: 'your snail', b: 'their snail' } as const;
const OWNERS = ['b', 'w'] as const; // draw order: yours on top

/** Position an overlay (snail, chomp) on a square: each is 1/8 of the board. */
const placeAt = (sq: Square) => ({ transform: `translate(${fileOf(sq) * 100}%, ${(7 - rankOf(sq)) * 100}%)` });

/** The board clips its edges: a chomp on rank 8 or the a/h file keeps its "Chomp!" label inside. */
const chompEdges = (sq: Square) =>
  [rankOf(sq) === 7 ? 'edge-top' : '', fileOf(sq) === 0 ? 'edge-left' : fileOf(sq) === 7 ? 'edge-right' : ''].join(' ');

interface BoardProps {
  game: GameState;
  /** Changes on every new game. The board remounts its squares and snails so nothing animates back. */
  gameId: number;
  selected: Square | null;
  /** Legal moves of the selected piece. */
  targets: LegalMove[];
  /** True while the snails are gliding to their new squares. */
  crawling: boolean;
  /** Sacrifice setup: the piece picked to give up (your snail starts there), or null. */
  pick: Square | null;
  onSquare: (sq: Square) => void;
  /** The game-over card, drawn over the board. */
  children?: ReactNode;
}

export function Board({ game, gameId, selected, targets, crawling, pick, onSquare, children }: BoardProps) {
  const [focusSq, setFocusSq] = useState<Square>('e2');
  const refs = useRef(new Map<Square, HTMLButtonElement>());

  // When the game-over card closes (Play again / View board) the focused button goes with it and
  // focus would fall to <body>. Hand it back to the board's current square instead.
  const hasOverlay = Boolean(children);
  const hadOverlay = useRef(hasOverlay);
  useEffect(() => {
    const closed = hadOverlay.current && !hasOverlay;
    hadOverlay.current = hasOverlay;
    if (closed && (!document.activeElement || document.activeElement === document.body)) {
      refs.current.get(focusSq)?.focus({ preventScroll: true });
    }
  }, [hasOverlay, focusSq]);

  const over = game.phase === 'over';
  const setup = game.phase === 'setup';
  const kings = { w: kingSquare(game, 'w'), b: kingSquare(game, 'b') };
  const inCheck = checkedKing(game);
  const preview = over ? null : snailPreview(game);
  // While picking a piece to give up, show where both snails would start.
  const snails: Snails | null = game.snails ?? (pick ? { w: pick, b: mirrorSquare(pick) } : null);
  const leaving = setup && pick ? [pick, mirrorSquare(pick)] : [];
  // Like the status warning, the tints last until the last glide ends: during that glide the game
  // is already over and a snail is on (or, if it trapped the king, next to) a king.
  const live = !over || crawling;
  const danger = live && game.snails !== null && chebyshev(game.snails.b, kings.w) <= 1;
  const chance = live && game.snails !== null && chebyshev(game.snails.w, kings.b) <= 1;
  // Which snails struck a king (keyed by owner). Each one's victim falls over once the glide ends.
  const cause = game.result?.cause;
  const struck = {
    w: !crawling && (cause === 'snail-win' || cause === 'snail-draw'),
    b: !crawling && (cause === 'snail-loss' || cause === 'snail-draw'),
  };
  const chomps = crawling && game.lastCrawl ? game.lastCrawl.eats : [];

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const delta: Record<string, [number, number]> = {
      ArrowUp: [0, 1],
      ArrowDown: [0, -1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
    };
    const d = delta[e.key];
    // Only arrow keys pressed on a square move between squares (not keys from the game-over card).
    if (!d || !(e.target instanceof HTMLElement) || !e.target.classList.contains('sq')) return;
    e.preventDefault();
    const next = toSquare(fileOf(focusSq) + d[0], rankOf(focusSq) + d[1]);
    if (!next) return;
    setFocusSq(next);
    refs.current.get(next)?.focus();
  };

  const squares: JSX.Element[] = [];
  for (let r = 7; r >= 0; r--) {
    for (let f = 0; f < 8; f++) {
      const sq = toSquare(f, r)!;
      const piece = pieceAt(game, sq);
      const target = targets.find((t) => t.to === sq);
      const isLast = game.lastMove && (game.lastMove.from === sq || game.lastMove.to === sq);
      const isSelected = selected === sq || (setup && pick === sq);
      const classes = [
        'sq',
        (f + r) % 2 === 1 ? 'light' : 'dark',
        isLast ? 'last' : '',
        isSelected ? 'selected' : '',
        setup && pick && sq === leaving[1] ? 'given' : '',
        inCheck === sq ? 'check' : '',
        danger && sq === kings.w ? 'danger' : '',
        chance && sq === kings.b ? 'chance' : '',
      ];

      const label = [sq, piece ? `${COLOR_NAME[piece.color]} ${PIECE_NAMES[piece.type]}` : 'empty'];
      if (isLast) label.push('last move');
      for (const owner of OWNERS) if (game.snails?.[owner] === sq) label.push(SNAIL_NAME[owner]);
      if (inCheck === sq) label.push('in check');
      if (isSelected) label.push(setup ? 'given up, your snail starts here' : 'selected');
      if (setup && pick && sq === leaving[1]) label.push('the computer gives this up, its snail starts here');
      if (target) label.push(target.captured ? 'capture' : 'move here');
      for (const owner of OWNERS) if (preview?.[owner] === sq) label.push(`${SNAIL_NAME[owner]} crawls here next`);

      const fallen = piece?.type === 'k' && struck[otherColor(piece.color)];
      squares.push(
        <button
          key={sq}
          ref={(el) => {
            if (el) refs.current.set(sq, el);
            else refs.current.delete(sq);
          }}
          type="button"
          className={classes.filter(Boolean).join(' ')}
          aria-label={label.join(', ')}
          data-square={sq}
          tabIndex={focusSq === sq ? 0 : -1}
          onFocus={() => setFocusSq(sq)}
          onClick={() => {
            setFocusSq(sq);
            onSquare(sq);
          }}
        >
          {f === 0 && <span className="coord rank">{r + 1}</span>}
          {r === 0 && <span className="coord file">{FILES[f]}</span>}
          {piece && (
            <PieceIcon
              type={piece.type}
              color={piece.color}
              className={fallen ? 'fallen' : leaving.includes(sq) ? 'leaving' : undefined}
            />
          )}
          {preview?.w === sq && <span className="next next-w" aria-hidden="true" />}
          {preview?.b === sq && <span className={`next next-b ${preview.w === sq ? 'inner' : ''}`} aria-hidden="true" />}
          {target && (
            <span
              className={target.captured ? 'hint ring' : `hint dot ${game.snails?.w === sq || game.snails?.b === sq ? 'on-snail' : ''}`}
              aria-hidden="true"
            />
          )}
        </button>,
      );
    }
  }

  return (
    <div className="board-frame">
      <div className="board" role="group" aria-label="Chess board. Use the arrow keys to move between squares." onKeyDown={onKeyDown}>
        <div key={`grid-${gameId}`} className="board-grid">
          {squares}
        </div>
        {chomps.map((eat) => (
          <div
            key={`chomp-${gameId}-${game.lastCrawl?.turn}-${eat.square}`}
            className={`chomp ${chompEdges(eat.square)}`}
            style={placeAt(eat.square)}
            aria-hidden="true"
          >
            <PieceIcon type={eat.piece} color={otherColor(eat.by)} />
            <span className={`chomp-word chomp-${eat.by}`}>Chomp!</span>
          </div>
        ))}
        {snails &&
          OWNERS.map((owner) => {
            const sq = snails[owner];
            // Small, in a corner, when it shares its square with a piece or the other snail (or with
            // the piece it is eating, until the chomp is over). While picking a sacrifice the faded
            // piece being given up stays visible next to it.
            const shared = pieceAt(game, sq) !== null || snails[otherColor(owner)] === sq || chomps.some((e) => e.square === sq);
            const prey = kings[otherColor(owner)];
            return (
              <div
                key={`snail-${owner}-${gameId}`}
                className={`snail-token snail-${owner} ${shared ? 'shared' : 'alone'} ${struck[owner] ? 'victory' : ''} ${setup ? 'preview' : ''}`}
                style={placeAt(sq)}
                aria-hidden="true"
              >
                <div className="snail-inner">
                  <Snail owner={owner} facing={fileOf(prey) < fileOf(sq) ? 'left' : 'right'} />
                </div>
              </div>
            );
          })}
        {children}
      </div>
    </div>
  );
}
