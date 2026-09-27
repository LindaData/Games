/**
 * Thin typed adapter over chess.js internals used for performance-critical work
 * (AI search and danger analysis). The public chess.js API builds SAN strings for
 * every move, which is far too slow inside a search tree. All legality rules still
 * come from chess.js itself — we only skip its string formatting.
 */
import { Chess } from 'chess.js';

export const BITS = {
  NORMAL: 1,
  CAPTURE: 2,
  BIG_PAWN: 4,
  EP_CAPTURE: 8,
  PROMOTION: 16,
  KSIDE_CASTLE: 32,
  QSIDE_CASTLE: 64,
  NULL_MOVE: 128,
} as const;

export interface RawMove {
  color: 'w' | 'b';
  from: number; // 0x88
  to: number; // 0x88
  piece: string;
  captured?: string;
  promotion?: string;
  flags: number;
}

interface ChessInternals {
  _board: ({ type: string; color: 'w' | 'b' } | undefined)[];
  _turn: 'w' | 'b';
  _kings: { w: number; b: number };
  _epSquare: number;
  _moves(opts?: { legal?: boolean; square?: string; piece?: string }): RawMove[];
  _makeMove(m: RawMove): void;
  _undoMove(): unknown;
  _attacked(color: 'w' | 'b', square: number, verbose?: boolean): boolean | string[];
}

export class FastBoard {
  readonly chess: Chess;
  private readonly c: ChessInternals;

  constructor(fen: string) {
    this.chess = new Chess(fen, { skipValidation: true });
    this.c = this.chess as unknown as ChessInternals;
  }

  get turn(): 'w' | 'b' {
    return this.c._turn;
  }
  set turn(t: 'w' | 'b') {
    this.c._turn = t;
  }
  pieceAt(i: number) {
    return this.c._board[i];
  }
  kingSquare(color: 'w' | 'b'): number {
    return this.c._kings[color];
  }
  moves(legal = true): RawMove[] {
    return this.c._moves({ legal });
  }
  movesFrom(square: number, legal = true): RawMove[] {
    return this.c._moves({ legal, square: `${'abcdefgh'[square & 15]}${8 - (square >> 4)}` });
  }
  make(m: RawMove) {
    this.c._makeMove(m);
  }
  undo() {
    this.c._undoMove();
  }
  attacked(by: 'w' | 'b', sq: number): boolean {
    return this.c._attacked(by, sq) as boolean;
  }
  attackers(by: 'w' | 'b', sq: number): string[] {
    return this.c._attacked(by, sq, true) as string[];
  }
  inCheck(color: 'w' | 'b'): boolean {
    const k = this.c._kings[color];
    return k !== -1 && k !== undefined && this.attacked(color === 'w' ? 'b' : 'w', k);
  }
  /** Run fn with the side-to-move temporarily flipped (ep square cleared). */
  withTurn<T>(turn: 'w' | 'b', fn: () => T): T {
    const prevTurn = this.c._turn;
    const prevEp = this.c._epSquare;
    this.c._turn = turn;
    if (turn !== prevTurn) this.c._epSquare = -1;
    try {
      return fn();
    } finally {
      this.c._turn = prevTurn;
      this.c._epSquare = prevEp;
    }
  }
  /** Iterate over occupied 0x88 squares. */
  forEachPiece(fn: (sq: number, p: { type: string; color: 'w' | 'b' }) => void) {
    for (let i = 0; i < 128; i++) {
      if (i & 0x88) {
        i += 7;
        continue;
      }
      const p = this.c._board[i];
      if (p) fn(i, p);
    }
  }
}
