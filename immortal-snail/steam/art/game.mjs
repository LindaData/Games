/**
 * Shared by the screenshot script (art/screenshots.mjs) and the trailer (trailer/make-trailer.mjs):
 * build the real game, serve it on localhost, and drive it like a player.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const steamDir = path.resolve(here, '..');
export const gameDir = path.resolve(steamDir, '..');

// ---------------------------------------------------------------------------- build + serve

/** Builds the game with a relative base into steam/.screenshots-web (git-ignored). */
export function buildGame() {
  const out = path.join(steamDir, '.screenshots-web');
  const rel = path.relative(gameDir, out);
  console.log(`Building the game into steam/.screenshots-web ...`);
  if (!existsSync(path.join(gameDir, 'node_modules'))) {
    const ci = spawnSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: gameDir, stdio: 'inherit', shell: process.platform === 'win32' });
    if (ci.status !== 0) throw new Error('npm ci failed in the game folder');
  }
  const r = spawnSync('npm', ['run', 'build', '--', '--base', './', '--outDir', rel.split(path.sep).join('/'), '--emptyOutDir'], {
    cwd: gameDir,
    stdio: ['ignore', 'ignore', 'inherit'],
    shell: process.platform === 'win32',
  });
  if (r.status !== 0) throw new Error('the game build failed');
  return out;
}

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

/** A static file server for a built game folder on 127.0.0.1 (random port). */
export function serve(root) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const file = path.join(root, path.normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '') || 'index.html');
    const target = existsSync(file) && statSync(file).isDirectory() ? path.join(file, 'index.html') : file;
    if (!target.startsWith(root) || !existsSync(target)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(target)] ?? 'application/octet-stream' });
    res.end(readFileSync(target));
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// ---------------------------------------------------------------------------- board helpers

const PIECE = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** "e4" -> "white pawn" for every square of a FEN (empty squares: "empty"). */
export function fenPlacement(fen) {
  const out = {};
  fen
    .split(' ')[0]
    .split('/')
    .forEach((row, i) => {
      let file = 0;
      for (const ch of row) {
        if (/\d/.test(ch)) {
          for (let k = 0; k < Number(ch); k++) out[`${'abcdefgh'[file++]}${8 - i}`] = 'empty';
        } else {
          out[`${'abcdefgh'[file++]}${8 - i}`] = `${ch === ch.toUpperCase() ? 'white' : 'black'} ${PIECE[ch.toLowerCase()]}`;
        }
      }
    });
  return out;
}

/** What the board shows: square -> "white pawn" / "empty" (from the squares' aria-labels). */
export const boardPlacement = (page) =>
  page.$$eval('.board button.sq', (els) =>
    Object.fromEntries(
      els.map((e) => {
        const [sq, what] = (e.getAttribute('aria-label') ?? '').split(',').map((s) => s.trim());
        return [sq, what];
      }),
    ),
  );

export const sq = (page, square) => page.locator(`.board button.sq[aria-label^="${square},"]`);

export async function isOurMove(page) {
  return page
    .getByText(/^Your move/)
    .first()
    .isVisible()
    .catch(() => false);
}

export const gameOver = (page) =>
  page
    .locator('.result-card, [aria-labelledby="result-title"]')
    .first()
    .isVisible()
    .catch(() => false);

export async function waitForOurMove(page, ms = 25000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await isOurMove(page)) return true;
    if (await gameOver(page)) return false;
    await sleep(150);
  }
  return false;
}

/**
 * Try to play `uci` (e2e4); returns false if it is not legal right now. `click` defaults to a
 * plain locator click; the trailer passes one that moves its on-screen pointer first.
 */
export async function tryMove(page, uci, click = (loc) => loc.click()) {
  const [from, to] = [uci.slice(0, 2), uci.slice(2, 4)];
  await click(sq(page, from));
  await sleep(120);
  const label = (await sq(page, to).getAttribute('aria-label')) ?? '';
  if (!/move here|capture/.test(label)) {
    await sq(page, from).click(); // deselect
    return false;
  }
  await click(sq(page, to));
  return true;
}

/** Close a rules card if one is open (never the Sacrifice "Start" button). */
export async function closeRules(page) {
  for (let i = 0; i < 3; i++) {
    const b = page.locator('[role="dialog"] button', { hasText: /^(play|close|got it|ok|let's play)$/i }).first();
    if (!(await b.isVisible().catch(() => false))) return;
    await b.click();
    await sleep(350);
  }
}

/** The mode card on the start screen ("Ghost", "Hungry", "Sacrifice"). */
export const modeCard = (page, name) => page.locator('button', { hasText: new RegExp(`${name} Snails`, 'i') }).first();

export async function pickMode(page, name, click = (loc) => loc.click()) {
  const card = modeCard(page, name);
  if (!(await card.isVisible().catch(() => false))) return false;
  await click(card);
  await sleep(400);
  await closeRules(page);
  return true;
}

// ---------------------------------------------------------------------------- saved positions

/**
 * Load a position through the game's save format (its `setup` field), then reload.
 * `yours` / `theirs` are the snail squares. v3 saves it at turn 9 by default, so both snails
 * crawl right after the next turn (they crawl after turns 3, 6, 9, ...); the one-snail v2 game
 * starts at turn 1 and crawls after the second.
 */
export async function loadPosition(page, version, { mode = 'ghost', fen, yours, theirs, turn = 9 }) {
  await page.evaluate(
    ({ version, mode, fen, yours, theirs, turn }) => {
      const P = 'immortal-snail:';
      for (const k of Object.keys(localStorage)) if (k.startsWith(`${P}game`)) localStorage.removeItem(k);
      if (version === 3) {
        const snails = { w: yours, b: theirs };
        localStorage.setItem(`${P}game:v3`, JSON.stringify({ v: 3, mode, setup: { fen, snails, turn }, moves: [], turn, snails }));
        localStorage.setItem(`${P}mode`, mode);
      } else {
        localStorage.setItem(`${P}game:v2`, JSON.stringify({ v: 2, setup: { fen, snail: theirs }, moves: [], turn: 1, snail: theirs }));
        localStorage.setItem(`${P}rules-seen`, '1');
      }
    },
    { version, mode, fen, yours, theirs, turn },
  );
  await page.reload();
  await page.waitForSelector('.board button.sq', { timeout: 20000 });
  await sleep(500);
  await closeRules(page);
  const want = fenPlacement(fen);
  const got = await boardPlacement(page);
  const wrong = Object.keys(want).filter((s) => want[s] !== got[s]);
  if (wrong.length) throw new Error(`the game did not load the position (differs on ${wrong.slice(0, 5).join(', ')})`);
}
