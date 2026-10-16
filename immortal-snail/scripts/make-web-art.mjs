#!/usr/bin/env node
/**
 * Renders the web version's icons and its link-preview image into public/, in the same style as
 * the Steam art (it reuses the snail, piece and icon templates from ../steam/art):
 *
 *   public/og.png                    1200x630 link preview (Open Graph / Twitter card), 256 colours
 *   public/apple-touch-icon.png      180x180, opaque (iOS rounds the corners itself)
 *   public/icons/icon-192.png        192x192 } manifest icons
 *   public/icons/icon-512.png        512x512 }
 *   public/icons/maskable-512.png    512x512, full bleed, snail inside the maskable safe zone
 *   public/favicon-32.png, favicon-16.png, favicon.svg
 *
 *   npm run art          # from immortal-snail/
 *
 * The title comes from src/site.json. Needs playwright-core (from this folder, desktop/ or steam/
 * node_modules), Chromium (/opt/pw-browsers/chromium, or set CHROMIUM_PATH; it never downloads a
 * browser) and ffmpeg (FFMPEG_PATH, ffmpeg-static from here or steam/, or "ffmpeg" on the PATH).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const gameDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(gameDir, 'public');
const artDir = path.join(gameDir, 'steam', 'art');
const SITE = JSON.parse(readFileSync(path.join(gameDir, 'src', 'site.json'), 'utf8'));

const { iconPage } = await import(path.join(artDir, 'scenes.mjs'));
const { PIECE_CSS, piece, snail, snailDefs } = await import(path.join(artDir, 'shapes.mjs'));

function loadPlaywright() {
  for (const dir of [gameDir, path.join(gameDir, 'desktop'), path.join(gameDir, 'steam')]) {
    try {
      return createRequire(path.join(dir, 'package.json'))('playwright-core');
    } catch {
      /* try the next one */
    }
  }
  console.error('make-web-art: playwright-core not found. Run "npm ci" in immortal-snail/desktop (or steam/) first.');
  process.exit(1);
}

/** ffmpeg makes og.png a 256-colour PNG (see palettePng). */
function findFfmpeg() {
  const candidates = [process.env.FFMPEG_PATH];
  for (const dir of [gameDir, path.join(gameDir, 'steam')]) {
    try {
      candidates.push(createRequire(path.join(dir, 'package.json'))('ffmpeg-static'));
    } catch {
      /* not installed there */
    }
  }
  candidates.push('ffmpeg');
  const found = candidates.find((c) => c && spawnSync(c, ['-version'], { stdio: 'ignore' }).status === 0);
  if (found) return found;
  console.error('make-web-art: ffmpeg not found. Set FFMPEG_PATH, put ffmpeg on the PATH, or run "npm i --no-save ffmpeg-static" in steam/.');
  process.exit(1);
}
const ffmpeg = findFfmpeg();

/**
 * Link previews: WhatsApp (and some other apps) drop a preview image over about 300 KB. A
 * full-colour og.png is about 650 KB; with 256 colours (dithered) it is about 230 KB.
 */
const OG_MAX_BYTES = 300 * 1024;
function palettePng(png) {
  const r = spawnSync(
    ffmpeg,
    ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-vf', 'split[a][b];[a]palettegen=max_colors=256[p];[b][p]paletteuse', '-frames:v', '1', '-c:v', 'png', '-f', 'image2pipe', 'pipe:1'],
    { input: png, maxBuffer: 64 * 1024 * 1024 },
  );
  if (r.status !== 0) throw new Error(`ffmpeg failed on og.png: ${r.stderr}`);
  if (r.stdout.length > OG_MAX_BYTES) throw new Error(`og.png is ${(r.stdout.length / 1024).toFixed(0)} KB; link previews need it under ${OG_MAX_BYTES / 1024} KB`);
  return r.stdout;
}

const executablePath = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'].find((p) => p && existsSync(p));
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ executablePath, args: ['--font-render-hinting=none', '--disable-lcd-text'] });
const page = await browser.newPage({ deviceScaleFactor: 1 });

const font = (file) => readFileSync(path.join(artDir, 'fonts', file)).toString('base64');
const escapeXml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------------------------------------------------------------------------- the OG image

/** Felt, wood and the game's board colours (src/index.css). */
const C = { feltLight: '#3c7a49', feltMid: '#25573a', feltDark: '#0f2a1a', sqLight: '#edd6aa', sqDark: '#b7845a', frame: '#6e4524', frameEdge: '#4a2c14', ink: '#3a2410' };

/** The board, top-down like the game: two crawls in, each snail left a slime trail. */
const POSITION = 'Ke1 Qd1 Ra1 Rh1 Bc1 Bf1 Nc3 Pa2 Pb2 Pc2 Pd3 Pe4 Pf2 Pg2 Ph2 ke8 qd8 ra8 rh8 bc8 bf8 nb8 nf6 pa7 pb7 pc7 pd6 pe5 pf7 pg7 ph7';
const SNAILS = { green: 'f3', bronze: 'c6' };
const TRAILS = { green: ['h1', 'g2'], bronze: ['a8', 'b7'] };

function boardSvg() {
  const S = 100; // square size in board units
  const xy = (sq) => [('abcdefgh'.indexOf(sq[0])) * S, (8 - Number(sq[1])) * S];
  const out = [];
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      out.push(`<rect x="${f * S}" y="${r * S}" width="${S}" height="${S}" fill="${(f + r) % 2 === 0 ? C.sqLight : C.sqDark}"/>`);
    }
  }
  const trail = { green: 'rgba(120, 200, 60, 0.45)', bronze: 'rgba(214, 150, 60, 0.5)' };
  for (const [color, squares] of Object.entries(TRAILS)) {
    for (const sq of squares) {
      const [x, y] = xy(sq);
      out.push(`<rect x="${x + 8}" y="${y + 8}" width="${S - 16}" height="${S - 16}" rx="26" fill="${trail[color]}"/>`);
    }
  }
  // Where each snail crawls next: the game's dotted outlines.
  const next = { green: ['e4', '#1f6b12'], bronze: ['d5', '#7f3a0c'] };
  for (const [sq, stroke] of Object.values(next)) {
    const [x, y] = xy(sq);
    out.push(`<rect x="${x + 7}" y="${y + 7}" width="${S - 14}" height="${S - 14}" rx="30" fill="none" stroke="rgba(255,250,235,0.6)" stroke-width="9"/>`);
    out.push(`<rect x="${x + 7}" y="${y + 7}" width="${S - 14}" height="${S - 14}" rx="30" fill="none" stroke="${stroke}" stroke-width="6" stroke-dasharray="1 11" stroke-linecap="round"/>`);
  }
  for (const p of POSITION.split(' ')) {
    const [x, y] = xy(p.slice(1));
    const color = p[0] === p[0].toUpperCase() ? 'w' : 'b';
    out.push(`<g transform="translate(${x + 7} ${y + 7}) scale(0.86)">${piece(p[0].toLowerCase(), color, { shadow: false })}</g>`);
  }
  for (const [color, sq] of Object.entries(SNAILS)) {
    const [x, y] = xy(sq);
    const facing = color === 'green' ? 'right' : 'left';
    out.push(`<g transform="translate(${x - 22} ${y - 30}) scale(1.4)">${snail(color, { facing })}</g>`);
  }
  return `<svg viewBox="-30 -30 860 860" xmlns="http://www.w3.org/2000/svg">
    <defs>
      ${snailDefs()}
      <linearGradient id="frame" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#8a5a30"/><stop offset="0.5" stop-color="${C.frame}"/><stop offset="1" stop-color="${C.frameEdge}"/>
      </linearGradient>
      <radialGradient id="shade" cx="0.5" cy="0.45" r="0.75">
        <stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.22"/>
      </radialGradient>
      <clipPath id="sqs"><rect x="0" y="0" width="800" height="800" rx="10"/></clipPath>
    </defs>
    <rect x="-30" y="-30" width="860" height="860" rx="34" fill="url(#frame)"/>
    <g clip-path="url(#sqs)">${out.slice(0, 64).join('')}<rect width="800" height="800" fill="url(#shade)"/></g>
    ${out.slice(64).join('\n')}
  </svg>`;
}

function ogPage() {
  const W = 1200;
  const H = 630;
  const words = SITE.name.split(' ');
  // "Snailmate" over "Chess": the last word big and cream, the rest gold above it.
  const lines =
    words.length > 1
      ? [
          { text: words.slice(0, -1).join(' '), size: 132, y: 0, fill: 'url(#gold)' },
          { text: words.at(-1), size: 168, y: 150, fill: 'url(#cream)' },
        ]
      : [{ text: SITE.name, size: 150, y: 0, fill: 'url(#cream)' }];
  const texts = (attrs) => lines.map((l) => `<text x="0" y="${l.y}" font-size="${l.size}" ${attrs(l)}>${escapeXml(l.text)}</text>`).join('');
  const stroke = 15;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face { font-family: 'Lilita One'; src: url(data:font/ttf;base64,${font('LilitaOne-Regular.ttf')}) format('truetype'); }
    @font-face { font-family: 'Fredoka'; font-weight: 300 700; src: url(data:font/ttf;base64,${font('Fredoka.ttf')}) format('truetype'); }
    ${PIECE_CSS}
    html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; background: ${C.feltDark}; }
    .stage { position: relative; width: ${W}px; height: ${H}px; overflow: hidden; }
    .layer { position: absolute; inset: 0; width: 100%; height: 100%; }
    .title { position: absolute; left: 44px; top: 70px; width: 560px; height: 330px; overflow: visible; }
    .title text { font-family: 'Lilita One', sans-serif; text-anchor: middle; paint-order: stroke fill; stroke-linejoin: round; }
    .tag { position: absolute; left: 24px; width: 600px; top: 432px; text-align: center; font-family: 'Fredoka', sans-serif;
      font-weight: 600; font-size: 40px; line-height: 1.2; color: #fff6df;
      text-shadow: 0 3px 0 rgba(0,0,0,0.45), 0 0 18px rgba(0,0,0,0.35); }
    .tag small { display: block; margin-top: 12px; font-size: 26px; font-weight: 500; color: #d9ecc9; }
    .board { position: absolute; left: 652px; top: 52px; width: 526px; height: 526px; transform: rotate(-5deg);
      filter: drop-shadow(0 22px 26px rgba(0,0,0,0.5)); }
    .board svg { width: 100%; height: 100%; overflow: visible; }
  </style></head><body><div class="stage">
    <svg class="layer" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="felt" cx="0.42" cy="0.4" r="0.9">
          <stop offset="0" stop-color="${C.feltLight}"/><stop offset="0.5" stop-color="${C.feltMid}"/><stop offset="1" stop-color="${C.feltDark}"/>
        </radialGradient>
        <radialGradient id="warm" cx="0.27" cy="0.36" r="0.5">
          <stop offset="0" stop-color="#ffd98a" stop-opacity="0.22"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/>
        </radialGradient>
        <filter id="grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7"/>
          <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.11 0"/>
        </filter>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#felt)"/>
      <rect width="${W}" height="${H}" filter="url(#grain)"/>
      <rect width="${W}" height="${H}" fill="url(#warm)"/>
    </svg>
    <div class="board">${boardSvg()}</div>
    <svg class="title fit" data-pad="${stroke + 4}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#fff0b0"/><stop offset="0.55" stop-color="#f2be55"/><stop offset="1" stop-color="#c98a2c"/>
        </linearGradient>
        <linearGradient id="cream" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ffffff"/><stop offset="0.6" stop-color="#fff2d2"/><stop offset="1" stop-color="#ecd29a"/>
        </linearGradient>
      </defs>
      <g class="fit-content">
        <g transform="translate(0 ${stroke * 0.55})" opacity="0.55">${texts(() => `fill="#0b0602" stroke="#0b0602" stroke-width="${stroke * 2}"`)}</g>
        ${texts((l) => `fill="${l.fill}" stroke="${C.ink}" stroke-width="${stroke * 2}"`)}
      </g>
    </svg>
    <div class="tag">${escapeXml(SITE.tagline)}<small>Chess vs. the computer, with two immortal snails</small></div>
  </div></body></html>`;
}

/** Size each svg.fit's viewBox to its content, so the title fills its box. */
function fitTitles() {
  for (const svg of document.querySelectorAll('svg.fit')) {
    const box = svg.querySelector('.fit-content').getBBox();
    const pad = Number(svg.dataset.pad || 0);
    svg.setAttribute('viewBox', `${box.x - pad} ${box.y - pad} ${box.width + 2 * pad} ${box.height + 2 * pad}`);
  }
}

// ---------------------------------------------------------------------------- icons

/** Maskable icon: felt to every edge, the snail inside the central safe circle (80%). */
function maskablePage(size) {
  return `<!doctype html><html><head><style>html,body{margin:0;width:${size}px;height:${size}px;overflow:hidden}</style></head><body>
    <svg viewBox="0 0 100 100" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        ${snailDefs()}
        <radialGradient id="tile" cx="0.42" cy="0.32" r="0.9">
          <stop offset="0" stop-color="#4d9a5c"/><stop offset="0.55" stop-color="#2a6340"/><stop offset="1" stop-color="#143a24"/>
        </radialGradient>
      </defs>
      <rect width="100" height="100" fill="url(#tile)"/>
      <g transform="translate(21 20) scale(0.58)">${snail('bronze')}</g>
    </svg></body></html>`;
}

async function render(html, width, height, { transparent = false } = {}) {
  await page.setViewportSize({ width, height });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(fitTitles);
  return page.screenshot({ type: 'png', omitBackground: transparent, clip: { x: 0, y: 0, width, height } });
}

function write(rel, buf) {
  const file = path.join(publicDir, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, buf);
  console.log(`  public/${rel}  (${(buf.length / 1024).toFixed(0)} KB)`);
}

try {
  console.log(`Web art for "${SITE.name}":`);
  write('og.png', palettePng(await render(ogPage(), 1200, 630)));
  write('apple-touch-icon.png', await render(iconPage(180, { square: true }), 180, 180));
  write('icons/icon-192.png', await render(iconPage(192), 192, 192, { transparent: true }));
  write('icons/icon-512.png', await render(iconPage(512), 512, 512, { transparent: true }));
  write('icons/maskable-512.png', await render(maskablePage(512), 512, 512));
  write('favicon-32.png', await render(iconPage(32), 32, 32, { transparent: true }));
  write('favicon-16.png', await render(iconPage(16), 16, 16, { transparent: true }));

  // The SVG favicon: the small (bold) icon's own SVG, standalone.
  await page.setContent(iconPage(32), { waitUntil: 'load' });
  const svg = await page.evaluate(() => {
    const el = document.querySelector('svg.layer').cloneNode(true);
    el.removeAttribute('class');
    el.setAttribute('width', '32');
    el.setAttribute('height', '32');
    return el.outerHTML.replace(/\n\s*/g, ' ');
  });
  write('favicon.svg', Buffer.from(`${svg}\n`));
} finally {
  await browser.close();
}
