#!/usr/bin/env node
/**
 * Captures the Steam store screenshots (1920x1080 PNG) from the real game.
 *
 *   npm run screenshots                     # from immortal-snail/steam: builds the game, then shoots
 *   node art/screenshots.mjs --dist <dir>   # use an existing build (any folder with index.html)
 *   node art/screenshots.mjs --only win     # just the scenes whose name contains "win"
 *   node art/screenshots.mjs --out <dir>    # write somewhere else (for trying things out)
 *
 * Output: steam/store/screenshots/NN-name.png. Old PNGs there are removed first (unless --only).
 *
 * It drives the game like a player (clicks squares, picks modes). Scenes that need a particular
 * position (a Hungry eat, a snail win, a snail loss) load it through the game's own save format
 * (localStorage `immortal-snail:game:v3`, or `game:v2` for the older one-snail version) and then
 * play the last move for real. Each scene checks the board really shows the position it asked
 * for; a scene that cannot be reached is skipped with a warning instead of producing a wrong
 * picture. Works with both the current three-mode game and the older single-snail version.
 */
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { launchChromium } from './browser.mjs';
import {
  buildGame,
  closeRules,
  gameDir,
  gameOver,
  loadPosition,
  pickMode,
  serve,
  sleep,
  sq,
  steamDir,
  tryMove,
  waitForOurMove,
} from './game.mjs';

const args = process.argv.slice(2);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const outDir = opt('--out') ? path.resolve(opt('--out')) : path.join(steamDir, 'store', 'screenshots');
const only = opt('--only');

// 1440x810 CSS pixels at 4/3 device pixels = 1920x1080 images, with the board large and sharp.
const VIEWPORT = { width: 1440, height: 810 };
const SCALE = 4 / 3;

// ---------------------------------------------------------------------------- playing

/** Any legal move for White: the first piece that shows a target. */
async function anyMove(page, { avoid = [] } = {}) {
  const squares = await page.$$eval('.board button.sq', (els) =>
    els.map((e) => e.getAttribute('aria-label') ?? '').filter((l) => /^[a-h][1-8], white /.test(l)),
  );
  for (const label of squares) {
    const from = label.split(',')[0];
    if (avoid.some((a) => label.includes(a))) continue;
    await sq(page, from).click();
    await sleep(100);
    const target = page.locator('.board button.sq[aria-label*="move here"]').first();
    if (await target.count()) {
      await target.click();
      return true;
    }
    await sq(page, from).click();
  }
  return false;
}

/** Play White's turns from a list of preferred moves (falling back to any legal non-king move). */
async function playTurns(page, moves, turns) {
  let played = 0;
  for (const uci of moves) {
    if (played >= turns) break;
    if (!(await waitForOurMove(page))) return played;
    if (await tryMove(page, uci)) played++;
  }
  while (played < turns) {
    if (!(await waitForOurMove(page))) return played;
    if (!(await anyMove(page, { avoid: ['white king'] }))) return played;
    played++;
  }
  await waitForOurMove(page);
  return played;
}

// ---------------------------------------------------------------------------- positions

// Positions. Kings are boxed in by their own pieces so the snail's last crawl cannot be dodged.
const FEN = {
  // Black king e8 boxed in by Qd8, Bf8, pawns d7 e7 f7.
  blackBoxed: 'r2qkb1r/pp1ppppp/2n2n2/2p5/4P3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq - 4 4',
  // White king e1 boxed in by Qd1, Bf1, pawns d2 e2 f2.
  whiteBoxed: 'rnbqkb1r/pppp1ppp/5n2/4p3/2P5/2N5/PP1PPPPP/R1BQKBNR w KQkq - 2 3',
  // Black pawn e5 blocked by the white e4 pawn and with nothing to capture: it cannot run away.
  hungry: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
  // A calm Italian Game middlegame, both sides castled.
  midgame: 'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 7',
};

// ---------------------------------------------------------------------------- scenes

/** Each scene gets a fresh browser profile and returns true when its picture is ready. */
const SCENES = [
  {
    name: 'pick-a-mode',
    async run({ page, version }) {
      // No keyboard focus ring on the first card in the picture.
      await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
      if (version === 3) return page.locator('button', { hasText: /Ghost Snails/ }).first().isVisible();
      return page.locator('[role="dialog"]').first().isVisible(); // the one-mode version's rules card
    },
  },
  {
    name: 'ghost-snails',
    async run({ page, version }) {
      // A middlegame with the snails on their way, and the c1 bishop's moves showing. On v3 one
      // quiet move is played first, so the status line counts down to the crawl instead of
      // showing the first-move hint.
      await loadPosition(page, version, { mode: 'ghost', fen: FEN.midgame, yours: 'f4', theirs: 'c5', turn: 8 });
      if (version === 3) {
        if (!(await tryMove(page, 'h2h3')) || !(await waitForOurMove(page))) return false;
        if (await page.getByText(/in check/i).first().isVisible().catch(() => false)) return false;
        if (!(await page.getByText(/Snails crawl after this turn/).first().isVisible().catch(() => false))) return false;
      }
      await sq(page, 'c1').click();
      return (await page.locator('.board button.sq[aria-label*="move here"]').count()) > 0;
    },
  },
  {
    name: 'hungry-snail-eats',
    versions: [3],
    async run({ page, version }) {
      // Your snail on e4 (with your pawn) crawls to e5 and eats the blocked black pawn.
      await loadPosition(page, version, { mode: 'hungry', fen: FEN.hungry, yours: 'e4', theirs: 'a6' });
      if (!(await tryMove(page, 'd2d3'))) return false;
      const ate = page.getByText(/ate their/i).first();
      await ate.waitFor({ timeout: 20000 });
      await sleep(750); // the snail has finished its glide onto the pawn's square
      return true;
    },
  },
  {
    name: 'sacrifice-pick',
    versions: [3],
    async run({ page }) {
      if (!(await pickMode(page, 'Sacrifice'))) return false;
      await sq(page, 'b1').click();
      await page.getByRole('button', { name: /^Start/ }).first().waitFor({ timeout: 5000 });
      await sleep(400);
      return true;
    },
  },
  {
    name: 'sacrifice-dark',
    versions: [3],
    colorScheme: 'dark',
    async run({ page }) {
      if (!(await pickMode(page, 'Sacrifice'))) return false;
      await sq(page, 'g1').click();
      await page.getByRole('button', { name: /^Start/ }).first().click();
      await sleep(600);
      await closeRules(page);
      return (await playTurns(page, ['e2e4', 'd2d4', 'b1c3', 'f1d3', 'c1e3', 'd1d2'], 4)) === 4;
    },
  },
  {
    name: 'dark-midgame',
    versions: [2],
    colorScheme: 'dark',
    async run({ page }) {
      await closeRules(page);
      return (await playTurns(page, ['d2d4', 'c1f4', 'b1c3', 'e2e3', 'g1f3', 'f1d3'], 5)) === 5;
    },
  },
  {
    name: 'long-game',
    versions: [2],
    async run({ page }) {
      await closeRules(page);
      return (await playTurns(page, ['c2c4', 'b1c3', 'g2g3', 'f1g2', 'g1f3', 'e1g1', 'd2d3', 'a2a3', 'a1b1', 'b2b4'], 9)) === 9;
    },
  },
  {
    name: 'your-snail-wins',
    versions: [3],
    async run({ page, version }) {
      // Your snail on d7 is next to the boxed-in black king; it crawls onto it after this turn.
      await loadPosition(page, version, { fen: FEN.blackBoxed, yours: 'd7', theirs: 'h6' });
      if (!(await tryMove(page, 'a2a3'))) return false;
      await page.locator('.result-card').first().waitFor({ timeout: 25000 });
      await sleep(900);
      return /win/i.test((await page.locator('.result-card').first().innerText()) ?? '');
    },
  },
  {
    name: 'snail-next-to-king',
    versions: [2],
    async run({ page, version }) {
      await loadPosition(page, version, { fen: FEN.whiteBoxed, yours: 'a4', theirs: 'f2' });
      return page.getByText(/Watch out/i).first().isVisible();
    },
  },
  {
    name: 'their-snail-wins',
    async run({ page, version }) {
      // Their snail on f2 is next to your boxed-in king. Play quiet moves until it strikes.
      await loadPosition(page, version, { fen: FEN.whiteBoxed, yours: 'a4', theirs: 'f2' });
      for (const uci of ['a2a3', 'b2b3', 'h2h3']) {
        if (await gameOver(page)) break;
        if (!(await waitForOurMove(page))) break;
        if (!(await tryMove(page, uci))) return false;
        await sleep(300);
      }
      await page.locator('.result-card').first().waitFor({ timeout: 25000 });
      await sleep(900);
      return /snail/i.test((await page.locator('.result-card').first().innerText()) ?? '');
    },
  },
];

// ---------------------------------------------------------------------------- main

const distDir = opt('--dist') ? path.resolve(opt('--dist')) : buildGame();
if (!existsSync(path.join(distDir, 'index.html'))) throw new Error(`no index.html in ${distDir}`);
const server = await serve(distDir);
const url = `http://127.0.0.1:${server.address().port}/index.html`;
const browser = await launchChromium();

mkdirSync(outDir, { recursive: true });
if (!only) for (const f of readdirSync(outDir)) if (f.endsWith('.png')) rmSync(path.join(outDir, f));

let version = null;
let n = 0;
const skipped = [];

/** A fresh browser profile on the game's start page. */
async function openGame(colorScheme) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE, colorScheme, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForSelector('.board button.sq', { timeout: 20000 });
  await sleep(500);
  return { context, page, errors };
}

try {
  {
    // The three-mode game opens on its mode picker; the older one goes straight to the board.
    const { context, page } = await openGame('light');
    version = (await page.locator('button', { hasText: /Ghost Snails/ }).first().isVisible().catch(() => false)) ? 3 : 2;
    console.log(`Game version: ${version === 3 ? 'three modes, two snails (save v3)' : 'one snail (save v2)'}`);
    await context.close();
  }
  for (const scene of SCENES) {
    if ((scene.versions && !scene.versions.includes(version)) || (only && !scene.name.includes(only))) continue;
    // The computer plays differently every game, so a scene that plays real moves can end up
    // somewhere else (say, an early checkmate). Give each scene three tries.
    let done = false;
    for (let attempt = 1; attempt <= 3 && !done; attempt++) {
      const { context, page, errors } = await openGame(scene.colorScheme ?? 'light');
      let ok = false;
      let why = 'could not reach the scene';
      try {
        ok = await scene.run({ page, version });
      } catch (e) {
        why = e.message.split('\n')[0];
      }
      if (ok && errors.length === 0) {
        n++;
        const file = path.join(outDir, `${String(n).padStart(2, '0')}-${scene.name}.png`);
        await page.screenshot({ path: file });
        console.log(`  ${path.relative(gameDir, file)}`);
        done = true;
      } else {
        console.log(`  ${scene.name} (try ${attempt}): ${errors.length ? `page error: ${errors[0]}` : why}`);
      }
      await context.close();
    }
    if (!done) skipped.push(scene.name);
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${n} screenshot(s) in ${path.relative(process.cwd(), outDir) || '.'}${skipped.length ? `; skipped: ${skipped.join(', ')}` : ''}`);
if (n < 5) console.log('Steam needs at least 5 screenshots.');
process.exit(n === 0 ? 1 : 0);
