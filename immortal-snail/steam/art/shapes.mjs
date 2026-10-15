/**
 * SVG building blocks for the Steam art, drawn from the game's own artwork:
 * the snail (src/ui/Snail.tsx) and the piece silhouettes (src/ui/PieceIcon.tsx), both 100x100.
 * Two snails: green = yours, bronze = theirs.
 */

export const SNAIL_COLORS = {
  bronze: {
    shell: ['#f6d28e', '#c98a3c', '#7a4a1b'],
    body: ['#e2b673', '#a8732f'],
    line: '#5a3814',
    eye: '#f3d9a4',
    cheek: '#e9967a',
    shine: '#fff3d6',
  },
  // The game's own colours (src/ui/Snail.tsx PALETTES.w): green shell, light body.
  green: {
    shell: ['#dcf5a6', '#72b83d', '#2f6a1c'],
    body: ['#f7f1d6', '#d7cf9f'],
    line: '#2c4a17',
    eye: '#fbf7e4',
    cheek: '#f09a8a',
    shine: '#f4ffe0',
  },
};

const SPIRAL = 'M47 54 A3 3 0 0 1 53 54 A6 6 0 0 1 41 54 A9 9 0 0 1 59 54 A12 12 0 0 1 35 54 A15 15 0 0 1 65 54 A18 18 0 0 1 29 54';

/** Gradient defs for both snails; include once per <svg>. */
export function snailDefs() {
  return Object.entries(SNAIL_COLORS)
    .map(
      ([name, c]) => `
    <radialGradient id="shell-${name}" cx="38%" cy="32%" r="75%">
      <stop offset="0" stop-color="${c.shell[0]}"/><stop offset="0.45" stop-color="${c.shell[1]}"/><stop offset="1" stop-color="${c.shell[2]}"/>
    </radialGradient>
    <linearGradient id="body-${name}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${c.body[0]}"/><stop offset="1" stop-color="${c.body[1]}"/>
    </linearGradient>`,
    )
    .join('');
}

/**
 * The snail, 100x100 units, facing right (or left). `bold` thickens the outlines for tiny icons
 * and drops the smallest details.
 */
export function snail(color = 'bronze', { facing = 'right', bold = false, shadow = true } = {}) {
  const c = SNAIL_COLORS[color];
  const w = (n) => (bold ? n * 1.9 : n);
  const flip = facing === 'left' ? ' transform="translate(100 0) scale(-1 1)"' : '';
  return `<g${flip}>
    ${shadow ? '<ellipse cx="50" cy="90" rx="42" ry="5" fill="rgba(0,0,0,0.25)"/>' : ''}
    <path d="M81 44 L76 21" stroke="${c.line}" stroke-width="${w(3.4)}" stroke-linecap="round"/>
    <path d="M89 44 L93 22" stroke="${c.line}" stroke-width="${w(3.4)}" stroke-linecap="round"/>
    <path d="M6 86 C10 79 20 77 30 77 L70 77 C74 77 76 73 76 67 L76 51 C76 39 94 39 94 51 L94 75 C94 84 88 88 79 88 L14 88 C10 88 6 88 6 86 Z"
      fill="url(#body-${color})" stroke="${c.line}" stroke-width="${w(2.6)}" stroke-linejoin="round"/>
    <circle cx="76" cy="20" r="${bold ? 6 : 5}" fill="${c.eye}" stroke="${c.line}" stroke-width="${w(2.2)}"/>
    <circle cx="93" cy="21" r="${bold ? 6 : 5}" fill="${c.eye}" stroke="${c.line}" stroke-width="${w(2.2)}"/>
    <circle cx="77.4" cy="20.4" r="${bold ? 2.8 : 2.3}" fill="#24160a"/>
    <circle cx="94.4" cy="21.4" r="${bold ? 2.8 : 2.3}" fill="#24160a"/>
    ${bold ? '' : `<path d="M84 61 Q88 65 92 61" fill="none" stroke="${c.line}" stroke-width="2.2" stroke-linecap="round"/>`}
    ${bold ? '' : `<ellipse cx="85" cy="68" rx="3" ry="1.8" fill="${c.cheek}" opacity="0.7"/>`}
    <circle cx="47" cy="54" r="28" fill="url(#shell-${color})" stroke="${c.line}" stroke-width="${w(2.8)}"/>
    <path d="${bold ? 'M47 54 A4 4 0 0 1 55 54 A8 8 0 0 1 39 54 A12 12 0 0 1 63 54 A16 16 0 0 1 31 54' : SPIRAL}" fill="none" stroke="${c.line}" stroke-width="${w(2.6)}" stroke-linecap="round"/>
    <path d="M30 40 C34 33 41 29 48 29" fill="none" stroke="${c.shine}" stroke-width="${w(3)}" stroke-linecap="round" opacity="0.55"/>
  </g>`;
}

// Piece silhouettes from src/ui/PieceIcon.tsx. `detail` strokes are lines, `eye` the knight's eye.
const SHAPES = {
  p: `<circle cx="50" cy="30" r="12"/><path d="M39 44 H61 L58 51 H42 Z"/><path d="M41 51 C42 62 38 71 31 79 H69 C62 71 58 62 59 51 Z"/><rect x="24" y="78" width="52" height="10" rx="3"/>`,
  r: `<path d="M27 16 H38 V24 H45 V16 H55 V24 H62 V16 H73 V37 H27 Z"/><rect x="30" y="36" width="40" height="8" rx="2"/><path d="M34 44 H66 L69 78 H31 Z"/><rect x="23" y="77" width="54" height="11" rx="3"/>`,
  b: `<circle cx="50" cy="12" r="4.5"/><path d="M50 16 C64 27 67 41 58 52 H42 C33 41 36 27 50 16 Z"/><path class="detail" d="M55 27 L46 39"/><rect x="37" y="51" width="26" height="7" rx="3"/><path d="M42 58 H58 C60 66 62 72 65 79 H35 C38 72 40 66 42 58 Z"/><rect x="24" y="78" width="52" height="10" rx="3"/>`,
  n: `<path d="M33 79 C31 66 37 58 47 51 C40 54 33 56 27 52 C21 48 21 42 25 37 L43 21 C45 15 49 11 54 11 L56 17 C69 20 78 35 76 56 C75 65 72 73 70 79 Z"/><circle class="eye" cx="49" cy="28" r="2.6"/><path class="detail" d="M60 21 C69 31 71 45 69 62"/><rect x="24" y="78" width="52" height="10" rx="3"/>`,
  q: `<circle cx="23" cy="25" r="4.5"/><circle cx="41" cy="17" r="4.5"/><circle cx="59" cy="17" r="4.5"/><circle cx="77" cy="25" r="4.5"/><path d="M23 28 L34 52 H66 L77 28 L64 40 L59 21 L50 38 L41 21 L36 40 Z"/><rect x="33" y="51" width="34" height="7" rx="3"/><path d="M36 58 H64 L68 79 H32 Z"/><rect x="22" y="78" width="56" height="10" rx="3"/>`,
  k: `<rect x="47" y="6" width="6" height="20" rx="1"/><rect x="41" y="12" width="18" height="6" rx="1"/><path d="M30 37 C30 27 42 24 50 32 C58 24 70 27 70 37 C70 44 65 48 63 50 H37 C35 48 30 44 30 37 Z"/><rect x="33" y="49" width="34" height="7" rx="3"/><path d="M36 56 H64 L68 79 H32 Z"/><rect x="22" y="78" width="56" height="10" rx="3"/>`,
};

/** CSS for pieces; include once per page. Same colours as the game. */
export const PIECE_CSS = `
  .pc > * { stroke-width: 3.2; stroke-linejoin: round; }
  .pc .detail { fill: none !important; }
  .pc-w > * { fill: #fbf6ea; stroke: #2b241b; }
  .pc-w .eye { fill: #2b241b !important; }
  .pc-b > * { fill: #2c2722; stroke: #0f0d0b; }
  .pc-b .detail { stroke: #776b5f !important; }
  .pc-b .eye { fill: #b0a596 !important; stroke: none !important; }
`;

/** A piece, 100x100 units; type is p r b n q k, color w or b. */
export function piece(type, color, { shadow = true, tilt = 0 } = {}) {
  const t = tilt ? ` transform="rotate(${tilt} 50 88)"` : '';
  return `<g${t}>${shadow ? '<ellipse cx="50" cy="88" rx="30" ry="5" fill="rgba(0,0,0,0.28)"/>' : ''}<g class="pc pc-${color}">${SHAPES[type]}</g></g>`;
}
