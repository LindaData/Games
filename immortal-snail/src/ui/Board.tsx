import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { Square } from 'chess.js';
import { PIECE_NAMES, checkedKing, kingSquare, pieceAt, snailPreview, type GameState, type LegalMove } from '../game/engine';
import { chebyshev, fileOf, rankOf, toSquare } from '../game/snail';
import { PieceIcon } from './PieceIcon';
import { Snail } from './Snail';

const FILES = 'abcdefgh';
const COLOR_NAME = { w: 'white', b: 'black' } as const;

interface BoardProps {
  game: GameState;
  /** Changes on every new game. The board remounts its squares and snail so nothing animates back. */
  gameId: number;
  selected: Square | null;
  /** Legal moves of the selected piece. */
  targets: LegalMove[];
  /** True while the snail is gliding to its new square. */
  crawling: boolean;
  onSquare: (sq: Square) => void;
  /** The game-over card, drawn over the board. */
  children?: ReactNode;
}

export function Board({ game, gameId, selected, targets, crawling, onSquare, children }: BoardProps) {
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
  const whiteKing = kingSquare(game, 'w');
  const inCheck = checkedKing(game);
  const preview = over ? null : snailPreview(game);
  // Like the status warning, the red tint lasts until the snail's last glide ends: during that glide
  // the game is already over and the snail is on (or, if it trapped the king, next to) the king.
  const danger = (!over || crawling) && chebyshev(game.snail, whiteKing) <= 1;
  const snailGotYou = game.result?.cause === 'snail';
  const kingFallen = snailGotYou && !crawling;
  const snailShared = pieceAt(game, game.snail) !== null;
  const facing = fileOf(whiteKing) < fileOf(game.snail) ? 'left' : 'right';

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
      const classes = [
        'sq',
        (f + r) % 2 === 1 ? 'light' : 'dark',
        isLast ? 'last' : '',
        selected === sq ? 'selected' : '',
        inCheck === sq ? 'check' : '',
        danger && sq === whiteKing ? 'danger' : '',
        preview === sq ? 'slime' : '',
      ];

      const label = [sq, piece ? `${COLOR_NAME[piece.color]} ${PIECE_NAMES[piece.type]}` : 'empty'];
      if (isLast) label.push('last move');
      if (game.snail === sq) label.push('snail');
      if (inCheck === sq) label.push('in check');
      if (selected === sq) label.push('selected');
      if (target) label.push(target.captured ? 'capture' : 'move here');
      if (preview === sq) label.push('snail crawls here next');

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
              className={kingFallen && piece.type === 'k' && piece.color === 'w' ? 'fallen' : undefined}
            />
          )}
          {target && (
            <span
              className={target.captured ? 'hint ring' : `hint dot ${game.snail === sq ? 'on-snail' : ''}`}
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
        <div
          key={`snail-${gameId}`}
          className={`snail-token ${snailShared ? 'shared' : 'alone'} ${kingFallen ? 'victory' : ''}`}
          style={{ transform: `translate(${fileOf(game.snail) * 100}%, ${(7 - rankOf(game.snail)) * 100}%)` }}
          aria-hidden="true"
        >
          <div className="snail-inner">
            <Snail facing={facing} />
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
