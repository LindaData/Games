/**
 * Page templates for every Steam graphic and icon. Each template returns a full HTML page whose
 * content is exactly width x height pixels; make-art.mjs screenshots it.
 *
 * The look: the game's warm wood board on green felt, the two snails (green = yours, bronze =
 * theirs) crossing the board toward the enemy kings, and the "Immortal Snail Chess" title in a
 * chunky outlined lockup.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PIECE_CSS, piece, snail, snailDefs } from './shapes.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const font = (file) => readFileSync(path.join(here, 'fonts', file)).toString('base64');
const FONT_CSS = `
  @font-face { font-family: 'Lilita One'; src: url(data:font/ttf;base64,${font('LilitaOne-Regular.ttf')}) format('truetype'); }
  @font-face { font-family: 'Fredoka'; font-weight: 300 700; src: url(data:font/ttf;base64,${font('Fredoka.ttf')}) format('truetype'); }
`;

const COLORS = {
  feltLight: '#3c7a49',
  feltMid: '#25573a',
  feltDark: '#0f2a1a',
  sqLight: '#edd6aa',
  sqDark: '#b7845a',
  frame: '#6e4524',
  frameEdge: '#4a2c14',
  ink: '#3a2410',
};

// ---------------------------------------------------------------------------- page shell

export function page({ width, height, body, transparent = false }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    ${FONT_CSS}
    ${PIECE_CSS}
    html, body { margin: 0; padding: 0; width: ${width}px; height: ${height}px; overflow: hidden;
      background: ${transparent ? 'transparent' : COLORS.feltDark}; }
    .stage { position: relative; width: ${width}px; height: ${height}px; overflow: hidden; }
    .layer { position: absolute; inset: 0; width: 100%; height: 100%; }
    svg.fit { position: absolute; overflow: visible; }
    .title text { font-family: 'Lilita One', sans-serif; text-anchor: middle; paint-order: stroke fill;
      stroke-linejoin: round; stroke-linecap: round; }
    .tag { position: absolute; font-family: 'Fredoka', sans-serif; font-weight: 600; color: #fff6df;
      text-align: center; text-shadow: 0 2px 0 rgba(0,0,0,0.45), 0 0 14px rgba(0,0,0,0.35); }
  </style></head><body><div class="stage">${body}</div></body></html>`;
}

/**
 * Run in the page after fonts load: size each svg.fit's viewBox to its content (plus padding for
 * strokes and shadows), so the lockup fills its box exactly.
 */
export function fitTitles() {
  for (const svg of document.querySelectorAll('svg.fit')) {
    const box = svg.querySelector('.fit-content').getBBox();
    const pad = Number(svg.dataset.pad || 0);
    svg.setAttribute('viewBox', `${box.x - pad} ${box.y - pad} ${box.width + 2 * pad} ${box.height + 2 * pad}`);
  }
}

// ---------------------------------------------------------------------------- backgrounds

function feltSvg(width, height, { spot = [0.5, 0.42], glow = 1, seed = 7 } = {}) {
  return `<svg class="layer" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="felt" cx="${spot[0]}" cy="${spot[1]}" r="0.85">
        <stop offset="0" stop-color="${COLORS.feltLight}"/>
        <stop offset="0.45" stop-color="${COLORS.feltMid}"/>
        <stop offset="1" stop-color="${COLORS.feltDark}"/>
      </radialGradient>
      <radialGradient id="warm" cx="${spot[0]}" cy="${spot[1] - 0.08}" r="0.55">
        <stop offset="0" stop-color="#ffd98a" stop-opacity="${0.22 * glow}"/>
        <stop offset="1" stop-color="#ffd98a" stop-opacity="0"/>
      </radialGradient>
      <filter id="grain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="${seed}"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.11 0"/>
      </filter>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#felt)"/>
    <rect width="${width}" height="${height}" filter="url(#grain)"/>
    <rect width="${width}" height="${height}" fill="url(#warm)"/>
  </svg>`;
}

// ---------------------------------------------------------------------------- 3D board

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => {
  const l = Math.hypot(...a);
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** A pinhole camera. `fov` is the vertical field of view in degrees. */
function camera({ width, height, eye, target, fov, shift = [0, 0] }) {
  const f = norm(sub(target, eye));
  const r = norm(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  const focal = height / 2 / Math.tan((fov * Math.PI) / 360);
  return {
    focal,
    project(p) {
      const d = sub(p, eye);
      const zc = dot(d, f);
      return { x: width / 2 + shift[0] + (focal * dot(d, r)) / zc, y: height / 2 + shift[1] - (focal * dot(d, u)) / zc, z: zc };
    },
  };
}

/**
 * World coordinates: the board lies on y = 0, 8 x 8 units centred on the origin, the camera sits
 * on +z. 'front' view: rank 1 nearest, files left to right. 'side' view: rank 1 on the left,
 * rank 8 on the right, file a at the back.
 */
function squareCenter(view, file, rank) {
  return view === 'side' ? [rank - 3.5, 0, file - 3.5] : [file - 3.5, 0, 3.5 - rank];
}

const FILES = 'abcdefgh';
/** "e4" -> [file, rank] (0-based); fractional positions are allowed as arrays. */
const at = (sq) => (Array.isArray(sq) ? sq : [FILES.indexOf(sq[0]), Number(sq[1]) - 1]);

const poly = (cam, pts) => pts.map((p) => cam.project(p)).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

/**
 * The board scene as an SVG layer.
 * sprites: [{ kind: 'snail', color, at, facing, scale } | { kind: 'piece', type, color, at, scale, tilt }]
 * trails: [{ color: 'green'|'bronze', squares: ['e4', ...] }]
 */
function boardSvg({ width, height, view = 'side', cam: camOpts, sprites = [], trails = [], glowSquares = [] }) {
  const cam = camera({ width, height, ...camOpts });
  const out = [];
  const B = 4.55; // frame half-size
  const T = 0.5; // frame thickness

  // Frame: top surface and the visible front face.
  out.push(`<polygon points="${poly(cam, [[-B, -T, B], [B, -T, B], [B, 0, B], [-B, 0, B]])}" fill="url(#frameFront)"/>`);
  out.push(`<polygon points="${poly(cam, [[-B, 0, -B], [B, 0, -B], [B, 0, B], [-B, 0, B]])}" fill="url(#frameTop)" stroke="${COLORS.frameEdge}" stroke-width="2"/>`);
  out.push(`<polygon points="${poly(cam, [[-4.08, 0, -4.08], [4.08, 0, -4.08], [4.08, 0, 4.08], [-4.08, 0, 4.08]])}" fill="${COLORS.frameEdge}"/>`);

  // Squares.
  for (let f = 0; f < 8; f++) {
    for (let r = 0; r < 8; r++) {
      const [cx, , cz] = squareCenter(view, f, r);
      const pts = [[cx - 0.5, 0, cz - 0.5], [cx + 0.5, 0, cz - 0.5], [cx + 0.5, 0, cz + 0.5], [cx - 0.5, 0, cz + 0.5]];
      const light = (f + r) % 2 === 1;
      out.push(`<polygon points="${poly(cam, pts)}" fill="${light ? COLORS.sqLight : COLORS.sqDark}"/>`);
    }
  }
  // Slime trails: the squares each snail has crawled over.
  const trailFill = { green: 'rgba(120, 200, 60, 0.42)', bronze: 'rgba(214, 150, 60, 0.45)' };
  for (const t of trails) {
    for (const s of t.squares) {
      const [f, r] = at(s);
      const [cx, , cz] = squareCenter(view, f, r);
      const k = 0.42;
      out.push(`<polygon points="${poly(cam, [[cx - k, 0, cz - k], [cx + k, 0, cz - k], [cx + k, 0, cz + k], [cx - k, 0, cz + k]])}" fill="${trailFill[t.color]}" stroke="${trailFill[t.color]}" stroke-width="3" stroke-linejoin="round"/>`);
    }
  }
  for (const g of glowSquares) {
    const [f, r] = at(g.at);
    const [cx, , cz] = squareCenter(view, f, r);
    out.push(`<polygon points="${poly(cam, [[cx - 0.5, 0, cz - 0.5], [cx + 0.5, 0, cz - 0.5], [cx + 0.5, 0, cz + 0.5], [cx - 0.5, 0, cz + 0.5]])}" fill="${g.fill}"/>`);
  }
  // Soft vignette over the board.
  out.push(`<polygon points="${poly(cam, [[-4.08, 0, -4.08], [4.08, 0, -4.08], [4.08, 0, 4.08], [-4.08, 0, 4.08]])}" fill="url(#boardShade)"/>`);

  // Sprites, far to near.
  const placed = sprites.map((s) => {
    const [f, r] = at(s.at);
    const [x, , z] = squareCenter(view, f, r);
    const base = cam.project([x, s.y ?? 0, z]);
    return { ...s, base };
  });
  placed.sort((a, b) => b.base.z - a.base.z);
  for (const s of placed) {
    const worldH = (s.kind === 'snail' ? 1.45 : 1.02) * (s.scale ?? 1);
    const px = (cam.focal * worldH) / s.base.z; // pixel size of the 100-unit sprite box
    const x = s.base.x - px * 0.5;
    const y = s.base.y - px * 0.88;
    const art = s.kind === 'snail' ? snail(s.color, { facing: s.facing }) : piece(s.type, s.color, { tilt: s.tilt ?? 0 });
    out.push(`<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${(px / 100).toFixed(4)})">${art}</g>`);
  }

  return `<svg class="layer" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      ${snailDefs()}
      <linearGradient id="frameTop" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#8a5a30"/><stop offset="0.5" stop-color="${COLORS.frame}"/><stop offset="1" stop-color="#5a3519"/>
      </linearGradient>
      <linearGradient id="frameFront" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#5e3a1c"/><stop offset="1" stop-color="#2e1a0a"/>
      </linearGradient>
      <radialGradient id="boardShade" cx="0.5" cy="0.45" r="0.75">
        <stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.28"/>
      </radialGradient>
    </defs>
    <g filter="url(#dropShadow)">${out.join('\n')}</g>
  </svg>`;
}

// ---------------------------------------------------------------------------- title lockup

/**
 * The title as an SVG that fills the given box (CSS pixels). layout 'stack' = "Immortal" over
 * "Snail Chess"; 'row' = one line.
 */
function titleSvg({ left, top, width, height, layout = 'stack', align = 'xMidYMid', stroke = 15, snails = false }) {
  const lines =
    layout === 'row'
      ? [{ text: 'Immortal Snail Chess', size: 150, y: 0, fill: 'url(#cream)' }]
      : [
          { text: 'Immortal', size: 104, y: 0, fill: 'url(#gold)' },
          { text: 'Snail Chess', size: 158, y: 138, fill: 'url(#cream)' },
        ];
  const texts = (extra) => lines.map((l) => `<text x="0" y="${l.y}" font-size="${l.size}" ${extra(l)}>${l.text}</text>`).join('');
  return `<svg class="fit title" data-pad="${stroke + 4}" preserveAspectRatio="${align} meet"
      style="left:${left}px; top:${top}px; width:${width}px; height:${height}px" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff0b0"/><stop offset="0.55" stop-color="#f2be55"/><stop offset="1" stop-color="#c98a2c"/>
      </linearGradient>
      <linearGradient id="cream" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffffff"/><stop offset="0.6" stop-color="#fff2d2"/><stop offset="1" stop-color="#ecd29a"/>
      </linearGradient>
    </defs>
    <g class="fit-content">
      ${
        snails
          ? `${snailDefs()}
        <g transform="translate(-404 -142) scale(1.62)">${snail('green', { facing: 'right' })}</g>
        <g transform="translate(242 -142) scale(1.62)">${snail('bronze', { facing: 'left' })}</g>`
          : ''
      }
      <g transform="translate(0 ${stroke * 0.55})" opacity="0.55">${texts(() => `fill="#0b0602" stroke="#0b0602" stroke-width="${stroke * 2}"`)}</g>
      ${texts((l) => `fill="${l.fill}" stroke="${COLORS.ink}" stroke-width="${stroke * 2}"`)}
      ${texts(() => `fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="2" transform="translate(0 -2)"`)}
    </g>
  </svg>`;
}

/** A single big snail (plus optional piece) as an absolutely placed SVG. */
function spriteSvg({ left, top, size, art }) {
  return `<svg style="position:absolute; left:${left}px; top:${top}px; width:${size}px; height:${size}px; overflow:visible" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <defs>${snailDefs()}</defs>${art}</svg>`;
}

// ---------------------------------------------------------------------------- the story on the board

/**
 * The same little story everywhere, true to the game: two crawls in, your green snail has left
 * h1 for g2 and f3 on its way to the black king, their bronze snail has left a8 for b7 and c6 on
 * its way to your white king (the game's step rule), each leaving a slime trail.
 * 'side' view: White on the left, Black on the right, near files at the front.
 * 'front' view: White at the bottom, Black at the top.
 */
const STORY = {
  side: {
    snails: [
      { color: 'green', at: [5.6, 2.35], facing: 'right' },
      { color: 'bronze', at: [2.3, 4.85], facing: 'left' },
    ],
    trails: [
      { color: 'green', squares: ['h1', 'g2'] },
      { color: 'bronze', squares: ['a8', 'b7'] },
    ],
    pieces: 'Ke1 Qd1 Ra1 Bc1 Nb1 Pa2 Pb2 Pc3 Pd4 Pe2 Pf2 ke8 qd8 ra8 bc8 nf6 pa7 pb6 pd6 pe5 pf7',
  },
  front: {
    snails: [
      { color: 'green', at: [4.85, 2.2], facing: 'left' },
      { color: 'bronze', at: [2.15, 4.8], facing: 'right' },
    ],
    trails: [
      { color: 'green', squares: ['h1', 'g2'] },
      { color: 'bronze', squares: ['a8', 'b7'] },
    ],
    pieces: 'Ke1 Qd1 Ra1 Rh1 Bf1 Nc3 Pa3 Pc2 Pd2 Pe4 Pf2 Pg2 Ph2 ke8 qd8 ra8 rh8 bc8 nb8 pa7 pb7 pc7 pd6 pe5 pf7 ph7',
  },
};

function storySprites(view, { snailScale = 1.4, pieces = true } = {}) {
  const story = STORY[view];
  const s = story.snails.map((sn) => ({ kind: 'snail', ...sn, scale: snailScale }));
  const list = story.pieces.split(' ');
  for (const p of list) {
    const isKing = p[0] === 'K' || p[0] === 'k';
    if (!pieces && !isKing) continue;
    s.push({ kind: 'piece', type: p[0].toLowerCase(), color: p[0] === p[0].toUpperCase() ? 'w' : 'b', at: p.slice(1) });
  }
  return s;
}

// ---------------------------------------------------------------------------- assets

const dropShadowFilter = `<svg width="0" height="0" style="position:absolute"><defs>
  <filter id="dropShadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000" flood-opacity="0.45"/></filter>
</defs></svg>`;

function scene({ width, height, view, cam, title, snailScale, pieces = true, spot, extraSprites = [] }) {
  return page({
    width,
    height,
    body: `${dropShadowFilter}${feltSvg(width, height, { spot })}
      ${boardSvg({ width, height, view, cam, sprites: [...storySprites(view, { snailScale, pieces }), ...extraSprites], trails: STORY[view].trails })}
      ${title ? titleSvg(title) : ''}`,
  });
}
const landscape = (opts) => scene({ view: 'side', ...opts });
const portrait = (opts) => scene({ view: 'front', ...opts });

/** The app / client icon: the bronze snail on a felt tile with a wood rim. */
export function iconPage(size, { square = false } = {}) {
  const small = size <= 32;
  const tiny = size <= 20;
  const r = square ? 0 : small ? 18 : 22;
  const rim = tiny ? 7 : small ? 6 : 5;
  const m = square ? 0 : small ? 1 : 4; // margin inside the canvas
  const inner = 100 - 2 * m;
  const cell = (inner - 2 * rim) / 4;
  const checker = small
    ? ''
    : [0, 1, 2, 3]
        .map((i) => `<rect x="${m + rim + i * cell}" y="72" width="${cell}" height="${cell}" fill="#ffffff" opacity="${i % 2 ? 0.05 : 0.12}"/>`)
        .join('') + `<rect x="${m + rim}" y="72" width="${inner - 2 * rim}" height="1.2" fill="#000" opacity="0.18"/>`;
  const snailBox = tiny ? { x: 4, y: 7, s: 92 } : small ? { x: 6, y: 8, s: 88 } : { x: 10, y: 10, s: 80 };
  const body = `<svg class="layer" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <defs>
      ${snailDefs()}
      <radialGradient id="tile" cx="0.42" cy="0.32" r="0.9">
        <stop offset="0" stop-color="#4d9a5c"/><stop offset="0.55" stop-color="#2a6340"/><stop offset="1" stop-color="#143a24"/>
      </radialGradient>
      <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#9a6436"/><stop offset="0.5" stop-color="#6e4524"/><stop offset="1" stop-color="#3f2410"/>
      </linearGradient>
      <clipPath id="tileClip"><rect x="${m + rim}" y="${m + rim}" width="${inner - 2 * rim}" height="${inner - 2 * rim}" rx="${Math.max(r - rim, 4)}"/></clipPath>
    </defs>
    <rect x="${m}" y="${m}" width="${inner}" height="${inner}" rx="${r}" fill="url(#rim)"/>
    <rect x="${m + rim}" y="${m + rim}" width="${inner - 2 * rim}" height="${inner - 2 * rim}" rx="${Math.max(r - rim, 4)}" fill="url(#tile)"/>
    <g clip-path="url(#tileClip)">${checker}</g>
    <g transform="translate(${snailBox.x} ${snailBox.y}) scale(${snailBox.s / 100})">${snail('bronze', { bold: small, shadow: !small })}</g>
  </svg>`;
  return page({ width: size, height: size, body, transparent: !square });
}

/**
 * Every Steam graphic. `type` jpeg/png; `transparent` keeps the alpha channel.
 * Sizes from Steamworks > Store Assets / Library Assets.
 */
export function steamAssets() {
  return [
    {
      file: 'header_capsule_920x430.png',
      width: 920,
      height: 430,
      html: landscape({
        width: 920,
        height: 430,
        cam: { eye: [0, 6.4, 8.0], target: [0, 0, 0.4], fov: 36, shift: [0, 118] },
        snailScale: 1.5,
        title: { left: 160, top: 12, width: 600, height: 160 },
      }),
    },
    {
      file: 'small_capsule_462x174.png',
      width: 462,
      height: 174,
      html: page({
        width: 462,
        height: 174,
        body: `${feltSvg(462, 174, { spot: [0.3, 0.5] })}
          ${spriteSvg({ left: 6, top: 22, size: 140, art: snail('green', { facing: 'right' }) })}
          ${titleSvg({ left: 146, top: 10, width: 306, height: 154, stroke: 13 })}`,
      }),
    },
    {
      file: 'main_capsule_1232x706.png',
      width: 1232,
      height: 706,
      html: landscape({
        width: 1232,
        height: 706,
        cam: { eye: [0, 6.8, 8.4], target: [0, 0, 0.3], fov: 40, shift: [0, 175] },
        snailScale: 1.5,
        title: { left: 216, top: 22, width: 800, height: 236 },
      }),
    },
    {
      file: 'vertical_capsule_748x896.png',
      width: 748,
      height: 896,
      html: portrait({
        width: 748,
        height: 896,
        cam: { eye: [0, 10.8, 11.2], target: [0, 0, 0.2], fov: 46, shift: [0, 150] },
        snailScale: 1.55,
        title: { left: 40, top: 30, width: 668, height: 250 },
      }),
    },
    {
      file: 'library_capsule_600x900.png',
      width: 600,
      height: 900,
      html: portrait({
        width: 600,
        height: 900,
        cam: { eye: [0, 11.6, 11.6], target: [0, 0, 0.2], fov: 46, shift: [0, 175] },
        snailScale: 1.55,
        title: { left: 30, top: 34, width: 540, height: 230 },
      }),
    },
    {
      file: 'library_header_920x430.png',
      width: 920,
      height: 430,
      html: landscape({
        width: 920,
        height: 430,
        cam: { eye: [0, 6.4, 8.0], target: [0, 0, 0.4], fov: 36, shift: [0, 118] },
        snailScale: 1.5,
        title: { left: 160, top: 12, width: 600, height: 160 },
      }),
    },
    {
      // No text or logo: Steam draws the library logo on top of it.
      file: 'library_hero_3840x1240.png',
      width: 3840,
      height: 1240,
      html: landscape({
        width: 3840,
        height: 1240,
        cam: { eye: [0, 5.0, 8.4], target: [0, 0, 0.2], fov: 31, shift: [0, 70] },
        snailScale: 1.4,
        title: null,
        spot: [0.5, 0.45],
        extraSprites: [
          { kind: 'piece', type: 'p', color: 'b', at: [5.2, -1.6], y: -0.5, tilt: -78 },
          { kind: 'piece', type: 'n', color: 'b', at: [2.6, -2.0], y: -0.5, tilt: -84 },
          { kind: 'piece', type: 'p', color: 'w', at: [4.6, 9.2], y: -0.5, tilt: 80 },
          { kind: 'piece', type: 'r', color: 'w', at: [2.2, 9.7], y: -0.5, tilt: 84 },
        ],
      }),
    },
    {
      file: 'library_logo_1280x720.png',
      width: 1280,
      height: 720,
      transparent: true,
      html: page({
        width: 1280,
        height: 720,
        transparent: true,
        body: titleSvg({ left: 0, top: 0, width: 1280, height: 720, stroke: 15, snails: true }),
      }),
    },
    {
      file: 'page_background_1438x810.png',
      width: 1438,
      height: 810,
      html: page({
        width: 1438,
        height: 810,
        body: `${dropShadowFilter}${feltSvg(1438, 810, { spot: [0.5, 0.3], glow: 0.5, seed: 11 })}
          <div class="layer" style="opacity:0.22">${boardSvg({
            width: 1438,
            height: 810,
            view: 'side',
            cam: { eye: [0, 7.5, 11.5], target: [0, 0, 0], fov: 42, shift: [0, 140] },
            sprites: storySprites('side', { snailScale: 1.3, pieces: false }),
            trails: STORY.side.trails,
          })}</div>
          <div class="layer" style="background: radial-gradient(120% 90% at 50% 20%, transparent 30%, rgba(5,15,9,0.85) 100%)"></div>`,
      }),
    },
    { file: 'community_icon_184x184.jpg', width: 184, height: 184, type: 'jpeg', html: iconPage(184, { square: true }) },
  ];
}
