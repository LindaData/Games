/** A small snail with a spiral shell and eye stalks (100x100 viewBox). Yours is green, theirs bronze. */
import { useId } from 'react';
import type { Color } from 'chess.js';

const SPIRAL = 'M47 54 A3 3 0 0 1 53 54 A6 6 0 0 1 41 54 A9 9 0 0 1 59 54 A12 12 0 0 1 35 54 A15 15 0 0 1 65 54 A18 18 0 0 1 29 54';

/** Colours by owner: `w` = your snail (green shell, light body), `b` = their snail (bronze). */
const PALETTES = {
  w: {
    shell: ['#dcf5a6', '#72b83d', '#2f6a1c'],
    body: ['#f7f1d6', '#d7cf9f'],
    line: '#2c4a17',
    eye: '#fbf7e4',
    highlight: '#f4ffe0',
  },
  b: {
    shell: ['#f6d28e', '#c98a3c', '#7a4a1b'],
    body: ['#e2b673', '#a8732f'],
    line: '#5a3814',
    eye: '#f3d9a4',
    highlight: '#fff3d6',
  },
} as const;

export function Snail({ owner, className, facing = 'right' }: { owner: Color; className?: string; facing?: 'left' | 'right' }) {
  const uid = useId().replace(/:/g, '');
  const shell = `snail-shell-${uid}`;
  const body = `snail-body-${uid}`;
  const p = PALETTES[owner];
  return (
    <svg viewBox="0 0 100 100" className={`snail-svg ${className ?? ''}`} aria-hidden="true">
      <defs>
        <radialGradient id={shell} cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor={p.shell[0]} />
          <stop offset="0.45" stopColor={p.shell[1]} />
          <stop offset="1" stopColor={p.shell[2]} />
        </radialGradient>
        <linearGradient id={body} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.body[0]} />
          <stop offset="1" stopColor={p.body[1]} />
        </linearGradient>
      </defs>
      <g transform={facing === 'left' ? 'translate(100 0) scale(-1 1)' : undefined}>
        <ellipse cx="50" cy="90" rx="42" ry="5" fill="rgba(0,0,0,0.22)" />
        {/* eye stalks (behind the head) */}
        <path d="M81 44 L76 21" stroke={p.line} strokeWidth="3.4" strokeLinecap="round" />
        <path d="M89 44 L93 22" stroke={p.line} strokeWidth="3.4" strokeLinecap="round" />
        {/* foot + head */}
        <path
          d="M6 86 C10 79 20 77 30 77 L70 77 C74 77 76 73 76 67 L76 51 C76 39 94 39 94 51 L94 75 C94 84 88 88 79 88 L14 88 C10 88 6 88 6 86 Z"
          fill={`url(#${body})`}
          stroke={p.line}
          strokeWidth="2.6"
          strokeLinejoin="round"
        />
        {/* eyes */}
        <circle cx="76" cy="20" r="5" fill={p.eye} stroke={p.line} strokeWidth="2.2" />
        <circle cx="93" cy="21" r="5" fill={p.eye} stroke={p.line} strokeWidth="2.2" />
        <circle cx="77.4" cy="20.4" r="2.3" fill="#24160a" />
        <circle cx="94.4" cy="21.4" r="2.3" fill="#24160a" />
        {/* face */}
        <path d="M84 61 Q88 65 92 61" fill="none" stroke={p.line} strokeWidth="2.2" strokeLinecap="round" />
        <ellipse cx="85" cy="68" rx="3" ry="1.8" fill="#e9967a" opacity="0.7" />
        {/* shell */}
        <circle cx="47" cy="54" r="28" fill={`url(#${shell})`} stroke={p.line} strokeWidth="2.8" />
        <path d={SPIRAL} fill="none" stroke={p.line} strokeWidth="2.6" strokeLinecap="round" />
        <path d="M30 40 C34 33 41 29 48 29" fill="none" stroke={p.highlight} strokeWidth="3" strokeLinecap="round" opacity="0.55" />
      </g>
    </svg>
  );
}
