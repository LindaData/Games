/** Hand-drawn minimalist chess piece silhouettes (100x100 viewBox). */
import type { PieceSymbol } from 'chess.js';

const SHAPES: Record<PieceSymbol, JSX.Element> = {
  p: (
    <>
      <circle cx="50" cy="30" r="12" />
      <path d="M39 44 H61 L58 51 H42 Z" />
      <path d="M41 51 C42 62 38 71 31 79 H69 C62 71 58 62 59 51 Z" />
      <rect x="24" y="78" width="52" height="10" rx="3" />
    </>
  ),
  r: (
    <>
      <path d="M27 16 H38 V24 H45 V16 H55 V24 H62 V16 H73 V37 H27 Z" />
      <rect x="30" y="36" width="40" height="8" rx="2" />
      <path d="M34 44 H66 L69 78 H31 Z" />
      <rect x="23" y="77" width="54" height="11" rx="3" />
    </>
  ),
  b: (
    <>
      <circle cx="50" cy="12" r="4.5" />
      <path d="M50 16 C64 27 67 41 58 52 H42 C33 41 36 27 50 16 Z" />
      <path className="detail" d="M55 27 L46 39" />
      <rect x="37" y="51" width="26" height="7" rx="3" />
      <path d="M42 58 H58 C60 66 62 72 65 79 H35 C38 72 40 66 42 58 Z" />
      <rect x="24" y="78" width="52" height="10" rx="3" />
    </>
  ),
  n: (
    <>
      <path d="M33 79 C31 66 37 58 47 51 C40 54 33 56 27 52 C21 48 21 42 25 37 L43 21 C45 15 49 11 54 11 L56 17 C69 20 78 35 76 56 C75 65 72 73 70 79 Z" />
      <circle className="eye" cx="49" cy="28" r="2.6" />
      <path className="detail" d="M60 21 C69 31 71 45 69 62" />
      <rect x="24" y="78" width="52" height="10" rx="3" />
    </>
  ),
  q: (
    <>
      <circle cx="23" cy="25" r="4.5" />
      <circle cx="41" cy="17" r="4.5" />
      <circle cx="59" cy="17" r="4.5" />
      <circle cx="77" cy="25" r="4.5" />
      <path d="M23 28 L34 52 H66 L77 28 L64 40 L59 21 L50 38 L41 21 L36 40 Z" />
      <rect x="33" y="51" width="34" height="7" rx="3" />
      <path d="M36 58 H64 L68 79 H32 Z" />
      <rect x="22" y="78" width="56" height="10" rx="3" />
    </>
  ),
  k: (
    <>
      <rect x="47" y="6" width="6" height="20" rx="1" />
      <rect x="41" y="12" width="18" height="6" rx="1" />
      <path d="M30 37 C30 27 42 24 50 32 C58 24 70 27 70 37 C70 44 65 48 63 50 H37 C35 48 30 44 30 37 Z" />
      <rect x="33" y="49" width="34" height="7" rx="3" />
      <path d="M36 56 H64 L68 79 H32 Z" />
      <rect x="22" y="78" width="56" height="10" rx="3" />
    </>
  ),
};

export type PieceSkin = 'white' | 'black' | 'player' | 'ally' | 'immortal' | 'mirror' | 'ghost';

export function PieceIcon({ type, skin, className }: { type: PieceSymbol; skin: PieceSkin; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={`piece-svg skin-${skin} ${className ?? ''}`} aria-hidden>
      <g className="piece-body">{SHAPES[type]}</g>
    </svg>
  );
}
