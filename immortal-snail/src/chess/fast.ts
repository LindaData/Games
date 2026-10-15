/**
 * Thin typed adapter over chess.js 1.4.0 internals for hot paths (AI search, legal-move
 * lists). The public chess.js API builds SAN plus two FEN strings for every verbose move,
 * which is far too slow inside a search tree. All legality rules still come from chess.js
 * itself; we only skip its string formatting. chess.js is pinned to exactly 1.4.0 because
 * these internals are not public API.
 */
import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js';

export const BITS = {
  NORMAL: 1,
  CAPTURE: 2,
  BIG_PAWN: 4,
  EP_CAPTURE: 8,
  PROMOTION: 16,
  KSIDE_CASTLE: 32,
  QSIDE_CASTLE: 64,
} as const;

/** chess.js internal move: squares are 0x88 indexes (a8 = 0, h1 = 119). */
export interface RawMove {
  color: Color;
  from: number;
  to: number;
  piece: PieceSymbol;
  captured?: PieceSymbol;
  promotion?: PieceSymbol;
  flags: number;
}

interface ChessInternals {
  _board: ({ type: PieceSymbol; color: Color } | undefined)[];
  _turn: Color;
  _kings: Record<Color, number>;
  _moves(opts?: { legal?: boolean; square?: string; piece?: string }): RawMove[];
  _makeMove(m: RawMove): void;
  _undoMove(): unknown;
  _isKingAttacked(color: Color): boolean;
}

export function sqFrom0x88(i: number): Square {
  return `${'abcdefgh'[i & 15]}${8 - (i >> 4)}` as Square;
}

export function sqTo0x88(sq: Square): number {
  return (56 - sq.charCodeAt(1)) * 16 + (sq.charCodeAt(0) - 97);
}

export class FastBoard {
  readonly chess: Chess;
  private readonly c: ChessInternals;

  constructor(source: string | Chess) {
    this.chess = typeof source === 'string' ? new Chess(source) : source;
    this.c = this.chess as unknown as ChessInternals;
  }

  get turn(): Color {
    return this.c._turn;
  }

  /** The raw 0x88 board array (read-only use). */
  get board(): ChessInternals['_board'] {
    return this.c._board;
  }

  /** 0x88 index of `color`'s king. */
  kingSquare(color: Color): number {
    return this.c._kings[color];
  }

  /** Legal moves for the side to move. */
  moves(): RawMove[] {
    return this.c._moves({ legal: true });
  }

  /** Pseudo-legal moves (may leave the mover's king in check); filter with kingAttacked after make. */
  pseudoMoves(): RawMove[] {
    return this.c._moves({ legal: false });
  }

  make(m: RawMove): void {
    this.c._makeMove(m);
  }

  undo(): void {
    this.c._undoMove();
  }

  /** Is the side to move in check? */
  inCheck(): boolean {
    return this.c._isKingAttacked(this.c._turn);
  }

  /** Is `color`'s king attacked? */
  kingAttacked(color: Color): boolean {
    return this.c._isKingAttacked(color);
  }
}
