/**
 * The trailer's title cards and captions as HTML pages (1920x1080), drawn with the same pieces
 * as the store art (art/scenes.mjs): the felt, the wood board, the two snails, the title lockup.
 * make-trailer.mjs screenshots each one.
 */
import { COLORS, dropShadowFilter, feltSvg, landscape, page, titleSvg } from '../art/scenes.mjs';
import { piece, snail, snailDefs } from '../art/shapes.mjs';

export const W = 1920;
export const H = 1080;

const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** One line of chunky outlined text (the logo's style) filling the given box. */
function lineSvg({ text, left, top, width, height, fill = 'url(#t-cream)', stroke = 12 }) {
  return `<svg class="fit title" data-pad="${stroke + 4}" preserveAspectRatio="xMidYMid meet"
      style="left:${left}px; top:${top}px; width:${width}px; height:${height}px" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="t-gold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff0b0"/><stop offset="0.55" stop-color="#f2be55"/><stop offset="1" stop-color="#c98a2c"/>
      </linearGradient>
      <linearGradient id="t-cream" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffffff"/><stop offset="0.6" stop-color="#fff2d2"/><stop offset="1" stop-color="#ecd29a"/>
      </linearGradient>
    </defs>
    <g class="fit-content">
      <text x="0" y="${stroke * 0.55}" font-size="100" fill="#0b0602" stroke="#0b0602" stroke-width="${stroke * 2}" opacity="0.55">${xml(text)}</text>
      <text x="0" y="0" font-size="100" fill="${fill}" stroke="${COLORS.ink}" stroke-width="${stroke * 2}">${xml(text)}</text>
    </g>
  </svg>`;
}

/**
 * A strip of board squares with sprites on it: the hunt, drawn flat. `items` are
 * { at: index, art } (art in the 100-unit box); `trail` marks squares the snail has slimed.
 */
function stripSvg({ left, top, cell, count, items, trail = [], trailColor }) {
  const squares = Array.from({ length: count }, (_, i) => {
    const light = i % 2 === 0;
    return `<rect x="${i * 100}" y="0" width="100" height="100" fill="${light ? COLORS.sqLight : COLORS.sqDark}"/>`;
  }).join('');
  const slime = trail
    .map((i) => `<rect x="${i * 100 + 12}" y="12" width="76" height="76" rx="18" fill="${trailColor}"/>`)
    .join('');
  const dots = items.length === 2
    ? Array.from({ length: Math.abs(items[1].at - items[0].at) - 1 }, (_, k) => {
        const i = Math.min(items[0].at, items[1].at) + k + 1;
        return trail.includes(i) ? '' : `<circle cx="${i * 100 + 50}" cy="50" r="7" fill="rgba(58,36,16,0.45)"/>`;
      }).join('')
    : '';
  const sprites = items.map((it) => `<g transform="translate(${it.at * 100} 0)">${it.art}</g>`).join('');
  return `<svg style="position:absolute; left:${left}px; top:${top}px; width:${cell * count}px; height:${cell}px; overflow:visible;
      filter: drop-shadow(0 10px 14px rgba(0,0,0,0.45))" viewBox="0 0 ${count * 100} 100" xmlns="http://www.w3.org/2000/svg">
    <defs>${snailDefs()}</defs>
    <rect x="-8" y="-8" width="${count * 100 + 16}" height="116" rx="10" fill="${COLORS.frame}" stroke="${COLORS.frameEdge}" stroke-width="3"/>
    ${squares}${slime}${dots}${sprites}
  </svg>`;
}

/** Card 1: the key art (the main capsule's board scene) with the title. Also the thumbnail. */
export function openingCard() {
  return landscape({
    width: W,
    height: H,
    cam: { eye: [0, 6.8, 8.4], target: [0, 0, 0.3], fov: 40, shift: [0, 262] },
    snailScale: 1.5,
    title: { left: 310, top: 30, width: 1300, height: 400 },
  });
}

/** Card 2: the idea in one picture. Your snail hunts their king; theirs hunts yours. */
export function huntCard() {
  const cell = 150;
  const count = 6;
  const stripLeft = (W - cell * count) / 2;
  const body = `${feltSvg(W, H, { spot: [0.5, 0.45] })}
    ${lineSvg({ text: 'Your snail hunts their king.', left: 160, top: 70, width: 1600, height: 170 })}
    ${stripSvg({
      left: stripLeft,
      top: 280,
      cell,
      count,
      items: [
        { at: 1, art: snail('green', { facing: 'right' }) },
        { at: 5, art: piece('k', 'b') },
      ],
      trail: [0],
      trailColor: 'rgba(120, 200, 60, 0.5)',
    })}
    ${lineSvg({ text: 'Theirs hunts yours.', left: 460, top: 540, width: 1000, height: 150, fill: 'url(#t-gold)' })}
    ${stripSvg({
      left: stripLeft,
      top: 740,
      cell,
      count,
      items: [
        { at: 0, art: piece('k', 'w') },
        { at: 4, art: snail('bronze', { facing: 'left' }) },
      ],
      trail: [5],
      trailColor: 'rgba(214, 150, 60, 0.55)',
    })}`;
  return page({ width: W, height: H, body });
}

/** Last card: the logo with both snails, and "Wishlist now". */
export function endCard() {
  const body = `${dropShadowFilter}${feltSvg(W, H, { spot: [0.5, 0.4], glow: 1.2, seed: 11 })}
    ${titleSvg({ left: 260, top: 110, width: 1400, height: 560, stroke: 15, snails: true })}
    <div style="position:absolute; left:0; right:0; top:760px; display:flex; justify-content:center">
      <div style="font-family:'Lilita One', sans-serif; font-size:104px; line-height:1; color:${COLORS.ink};
        padding:34px 84px 38px; border-radius:999px; border:8px solid ${COLORS.ink};
        background:linear-gradient(#fff0b0, #f2be55 55%, #d99a36);
        box-shadow:0 14px 0 rgba(0,0,0,0.35), 0 0 60px rgba(255,217,138,0.35)">Wishlist now</div>
    </div>`;
  return page({ width: W, height: H, body });
}

/**
 * A caption for a gameplay clip (transparent page): the mode's name and its one rule, on a felt
 * panel that sits in the empty part of the game's right-hand column. `box` is that free area in
 * video pixels.
 */
export function captionCard({ title, line, box }) {
  const body = `<div style="position:absolute; left:${box.left}px; top:${box.top}px; width:${box.width}px;
      box-sizing:border-box; padding:34px 40px 40px; border-radius:28px; overflow:hidden;
      border:6px solid ${COLORS.frame}; box-shadow:0 18px 40px rgba(0,0,0,0.35);
      background:radial-gradient(120% 140% at 30% 20%, ${COLORS.feltLight}, ${COLORS.feltMid} 55%, ${COLORS.feltDark})">
      <div style="position:relative; height:120px">${lineSvg({ text: title, left: 0, top: 0, width: box.width - 92, height: 120, fill: 'url(#t-gold)', stroke: 10 })}</div>
      <div class="tag" style="position:relative; margin-top:18px; font-size:44px; line-height:1.2; text-wrap:balance">${xml(line)}</div>
    </div>`;
  return page({ width: W, height: H, body, transparent: true });
}
