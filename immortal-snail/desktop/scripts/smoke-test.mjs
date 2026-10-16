#!/usr/bin/env node
/**
 * Smoke test for the desktop app: launches the real (packaged) app, connects over the Chrome
 * DevTools Protocol with playwright-core and checks that
 *   - the window opens on app://snail/ and the board renders,
 *   - a move gets a computer reply, computed in the module Web Worker,
 *   - the saved game survives a page reload AND a quit (Ctrl+Q) + restart,
 *   - the window state file is written, navigation away / window.open are blocked,
 *     path traversal on app:// is refused, MIME types and the CSP header are right,
 *   - no page errors or CSP violations happen,
 *   - the web version's extras stay off in the app: no service worker, no analytics, and Share
 *     copies the link (no share sheet here).
 *
 *   node scripts/smoke-test.mjs                 # packaged build in release/ for this OS
 *   node scripts/smoke-test.mjs --dev           # unpackaged: electron . (needs npm run build:web)
 *   node scripts/smoke-test.mjs --exe <path>    # any build
 *
 * On Linux without a display it re-runs itself under xvfb-run. Screenshots go to release/smoke/.
 * The packaged app's fuses forbid --inspect, so this uses --remote-debugging-port instead of
 * Playwright's _electron.launch.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { EXE_NAMES } from './exe-names.mjs';

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { productName } = JSON.parse(readFileSync(path.join(desktopDir, 'package.json'), 'utf8'));
const argv = process.argv.slice(2);
const DEV = argv.includes('--dev');
const exeArg = argv.includes('--exe') ? argv[argv.indexOf('--exe') + 1] : null;
const KEEP = argv.includes('--keep-profile');

// ---- re-run under a virtual display on headless Linux --------------------------------------
if (process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY && !process.env.SNAIL_SMOKE_XVFB) {
  const r = spawnSync('xvfb-run', ['-a', '-s', '-screen 0 1600x1000x24', process.execPath, fileURLToPath(import.meta.url), ...argv], {
    stdio: 'inherit',
    env: { ...process.env, SNAIL_SMOKE_XVFB: '1' },
  });
  if (r.error) {
    console.error('No display and xvfb-run is not available. Install Xvfb or run with a display.');
    process.exit(1);
  }
  process.exit(r.status ?? 1);
}

function defaultExe() {
  const release = path.join(desktopDir, 'release');
  if (process.platform === 'linux') return path.join(release, 'linux-unpacked', EXE_NAMES.linux);
  if (process.platform === 'win32') return path.join(release, 'win-unpacked', `${EXE_NAMES.win}.exe`);
  for (const dir of ['mac-universal', 'mac-arm64', 'mac']) {
    const app = path.join(release, dir, `${productName}.app`, 'Contents', 'MacOS', productName);
    if (existsSync(app)) return app;
  }
  return path.join(release, 'mac', `${productName}.app`, 'Contents', 'MacOS', productName);
}

const electronBin = () => {
  const p = path.join(desktopDir, 'node_modules', 'electron', 'path.txt');
  return path.join(desktopDir, 'node_modules', 'electron', 'dist', readFileSync(p, 'utf8').trim());
};
const exe = DEV ? electronBin() : path.resolve(exeArg ?? defaultExe());
if (!existsSync(exe)) {
  console.error(`smoke: app not found at ${exe}\nBuild it first (npm run dist:linux / dist:win / dist:mac) or pass --dev.`);
  process.exit(1);
}

// A throwaway profile so the test never touches (or depends on) a real save.
const profile = mkdtempSync(path.join(os.tmpdir(), 'snail-smoke-'));
const env = { ...process.env, XDG_CONFIG_HOME: profile, APPDATA: profile, ELECTRON_ENABLE_LOGGING: '' };
const userDataDir = path.join(profile, productName);
const shotsDir = path.join(desktopDir, 'release', 'smoke');
mkdirSync(shotsDir, { recursive: true });

let failures = 0;
const ok = (msg) => console.log(`  ok   ${msg}`);
const fail = (msg) => {
  failures++;
  console.log(`  FAIL ${msg}`);
};
const check = (cond, msg) => (cond ? ok(msg) : fail(msg));
const warn = (msg) => console.log(`  warn ${msg}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Start the app and connect to it over CDP. */
async function launch(label) {
  const args = [...(DEV ? [desktopDir] : []), '--remote-debugging-port=0'];
  if (DEV && process.getuid?.() === 0) args.push('--no-sandbox'); // the packaged launcher does this itself
  const child = spawn(exe, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  const wsUrl = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no DevTools endpoint after 30 s. Output:\n${log}`)), 30000);
    const onData = (d) => {
      log += d.toString();
      const m = log.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) {
        clearTimeout(timer);
        resolve(m[1]);
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code, sig) => {
      clearTimeout(timer);
      reject(new Error(`app exited early (${code ?? sig}). Output:\n${log}`));
    });
  });
  const exited = new Promise((resolve) => child.on('exit', (code, signal) => resolve({ code, signal })));
  const browser = await chromium.connectOverCDP(wsUrl);
  let page = null;
  for (let i = 0; i < 100 && !page; i++) {
    page = browser.contexts().flatMap((c) => c.pages()).find((p) => p.url().startsWith('app://snail/')) ?? null;
    if (!page) await sleep(100);
  }
  if (!page) throw new Error('no app://snail/ page found');
  const problems = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' || /Content Security Policy/i.test(t)) problems.push(`console.${m.type()}: ${t}`);
  });
  console.log(`[${label}] launched ${path.relative(desktopDir, exe) || exe} (pid ${child.pid})`);
  return { child, browser, page, problems, exited, log: () => log };
}

/** Get past any start screen (mode picker, rules card) to a playable board. */
async function getToBoard(page) {
  await page.waitForSelector('.board .sq', { timeout: 20000 });
  for (let i = 0; i < 6; i++) {
    const mode = page.locator('button', { hasText: /ghost/i }).first();
    if (await mode.isVisible().catch(() => false)) {
      await mode.click();
      await sleep(300);
      continue;
    }
    const dialogButton = page.locator('[role="dialog"] button', { hasText: /^(play|start|close|got it|ok)$/i }).first();
    if (await dialogButton.isVisible().catch(() => false)) {
      await dialogButton.click();
      await sleep(300);
      continue;
    }
    break;
  }
}

const sq = (page, square) => page.locator(`.board button.sq[aria-label^="${square},"]`);
/** "e4 -> white pawn" for every square: the position as the screen shows it. */
const placement = (page) =>
  page.$$eval('.board button.sq', (els) =>
    els.map((e) => (e.getAttribute('aria-label') ?? '').split(',').slice(0, 2).map((s) => s.trim()).join(' ')),
  );

/**
 * DevTools key events never reach the app's before-input-event shortcuts, so on Linux real X11
 * key presses are sent with scripts/xkeys.py (python3 + libXtst). Returns false when that is
 * not possible here.
 */
const canPressNative = process.platform === 'linux' && !!process.env.DISPLAY && spawnSync('python3', ['--version']).status === 0;
async function pressNative(page, chord) {
  if (!canPressNative) return false;
  const [x, y] = await page.evaluate(() => [
    Math.round(window.screenX + window.outerWidth / 2),
    Math.round(window.screenY + Math.min(window.outerHeight / 2, 300)),
  ]);
  const r = spawnSync('python3', [path.join(desktopDir, 'scripts', 'xkeys.py'), String(x), String(y), chord], { encoding: 'utf8' });
  if (r.status !== 0) warn(`xkeys.py ${chord} failed: ${r.stderr || r.error}`);
  return r.status === 0;
}

/** Quit with Ctrl+Q when real key presses are possible, otherwise with SIGTERM (also graceful). */
async function quitApp(app, label) {
  const native = await pressNative(app.page, 'Control_L+q');
  if (!native) app.child.kill('SIGTERM');
  const result = await Promise.race([app.exited, sleep(15000).then(() => null)]);
  check(result !== null && result.code === 0, `[${label}] ${native ? 'Ctrl+Q' : 'SIGTERM'} quits the app cleanly (${result ? `exit ${result.code ?? result.signal}` : 'still running'})`);
  if (result === null) app.child.kill('SIGKILL');
  await app.browser.close().catch(() => {});
}

async function main() {
  console.log(`smoke: ${DEV ? 'dev (electron .)' : 'packaged app'}; profile ${profile}`);

  // ---------------------------------------------------------------- run 1
  let app = await launch('run 1');
  let { page } = app;
  await page.waitForLoadState('load');
  check(page.url().startsWith('app://snail/'), `[run 1] page served from app://snail/ (${page.url()})`);
  check((await page.title()) === productName, `[run 1] document title "${await page.title()}"`);
  await page.screenshot({ path: path.join(shotsDir, '1-first-launch.png') });

  // A first launch opens on the start screen: the mode picker with its three modes.
  await page.waitForSelector('.board .sq', { timeout: 20000 });
  const modeCards = page.locator('[role="dialog"] button', { hasText: /(Ghost|Hungry|Sacrifice) Snails/ });
  await modeCards.first().waitFor({ timeout: 10000 }).catch(() => {});
  const modes = await modeCards.allInnerTexts().catch(() => []);
  const modeNames = modes.map((t) => t.match(/(Ghost|Hungry|Sacrifice) Snails/)?.[0]).filter(Boolean);
  check(modeNames.length === 3, `[run 1] mode picker shows the three modes (${modeNames.join(', ') || 'none'})`);
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  await page.screenshot({ path: path.join(shotsDir, '0-mode-picker.png') });

  await getToBoard(page);
  check((await page.locator('[role="dialog"]').count()) === 0, '[run 1] Ghost Snails picked, the picker closed');
  check(await page.getByText('Ghost Snails', { exact: true }).first().isVisible(), '[run 1] playing Ghost Snails');
  const squares = await page.locator('.board button.sq').count();
  check(squares === 64, `[run 1] board renders 64 squares (${squares})`);
  const box = await page.locator('.board').boundingBox();
  check(box && box.width > 200 && box.height > 200, `[run 1] board is visible (${box ? `${Math.round(box.width)}x${Math.round(box.height)}` : 'none'})`);
  // Square labels read like "h1, white king, your snail" ("... crawls here next" marks a next step).
  const snailOn = (who) =>
    page.$$eval(
      '.board button.sq',
      (els, who) => els.filter((e) => (e.getAttribute('aria-label') ?? '').split(', ').includes(who)).map((e) => e.getAttribute('aria-label').split(',')[0]),
      who,
    );
  const [yours, theirs] = [await snailOn('your snail'), await snailOn('their snail')];
  const snailTokens = await page.locator('.board .snail-token').count();
  check(
    snailTokens === 2 && yours.join() === 'h1' && theirs.join() === 'a8',
    `[run 1] both snails on the board (${snailTokens} tokens; yours on ${yours.join() || '?'}, theirs on ${theirs.join() || '?'})`,
  );

  // Count Worker traffic so we know the reply came from the worker, not the main-thread fallback.
  await page.evaluate(() => {
    const Native = window.Worker;
    const w = window;
    w.__smoke = { created: 0, messages: 0, errors: 0 };
    window.Worker = class extends Native {
      constructor(...args) {
        super(...args);
        w.__smoke.created++;
        this.addEventListener('message', () => w.__smoke.messages++);
        this.addEventListener('error', () => w.__smoke.errors++);
      }
    };
  });

  await sq(page, 'e2').click();
  await sq(page, 'e4').click();
  const moved = await page
    .waitForSelector('.board button.sq[aria-label^="e4,"][aria-label*="white pawn"]', { timeout: 5000 })
    .then(() => true, () => false);
  check(moved, '[run 1] e2-e4 played by clicking');
  const replied = await page
    .waitForSelector('.board button.sq[aria-label*="black"][aria-label*="last move"]', { timeout: 20000 })
    .then(() => true, () => false);
  check(replied, '[run 1] the computer replied');
  const worker = await page.evaluate(() => window.__smoke);
  check(worker.created >= 1 && worker.messages >= 1 && worker.errors === 0, `[run 1] reply computed in the Web Worker (${JSON.stringify(worker)})`);
  const workerUrls = page.workers().map((w) => w.url());
  if (workerUrls.length) ok(`[run 1] worker script ${workerUrls[0]}`);

  // The web version's extras stay off in the app: no offline service worker, no analytics.
  const web = await page.evaluate(async () => ({
    registrations: 'serviceWorker' in navigator ? (await navigator.serviceWorker.getRegistrations().catch(() => [])).length : 0,
    controlled: Boolean(navigator.serviceWorker?.controller),
    analytics: Boolean(document.querySelector('script[src*="_vercel"]')) || 'va' in window,
  }));
  check(web.registrations === 0 && !web.controlled, `[run 1] no service worker in app:// (${web.registrations} registrations)`);
  check(!web.analytics, '[run 1] no analytics in the app');
  // No share sheet here: Share copies the link and says so.
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  const toast = await page
    .waitForSelector('.toast', { timeout: 3000 })
    .then((t) => t.innerText(), () => '');
  check(toast === 'Link copied', `[run 1] Share copies the link ("${toast || 'no toast'}")`);
  // Wait until it is your move again (the reply is in, the snails are not crawling), then give the
  // save a moment.
  await page
    .waitForFunction(() => document.querySelector('.status')?.textContent?.includes('Your move'), null, { timeout: 10000 })
    .catch(() => {});
  await sleep(1500);
  await page.screenshot({ path: path.join(shotsDir, '2-after-reply.png') });
  const afterReply = await placement(page);

  // Reload keeps the game.
  await page.reload();
  await page.waitForSelector('.board .sq', { timeout: 20000 });
  await sleep(500);
  const afterReload = await placement(page);
  check(JSON.stringify(afterReload) === JSON.stringify(afterReply), '[run 1] reload keeps the saved game');

  // F11 fullscreen, Esc back (real key presses, Linux only).
  const size = () => page.evaluate(() => [window.outerWidth, window.outerHeight]);
  const before = await size();
  if (await pressNative(page, 'F11')) {
    await sleep(1200);
    const full = await size();
    await pressNative(page, 'Escape');
    await sleep(1200);
    const after = await size();
    const msg = `F11 fullscreen ${before.join('x')} -> ${full.join('x')}, Esc back to ${after.join('x')}`;
    if (full[0] * full[1] > before[0] * before[1] && after[0] === before[0] && after[1] === before[1]) ok(`[run 1] ${msg}`);
    // A bare Xvfb has no window manager to grant fullscreen, so the size cannot change there.
    else warn(`[run 1] ${msg} (no window manager here to grant fullscreen?)`);
  } else {
    warn('[run 1] F11 / Esc not tested (needs Linux + python3 + an X display)');
  }

  check(app.problems.length === 0, `[run 1] no page errors / CSP violations${app.problems.length ? `:\n    ${app.problems.join('\n    ')}` : ''}`);
  await quitApp(app, 'run 1');

  const stateFile = path.join(userDataDir, 'window-state.json');
  let state = null;
  try {
    state = JSON.parse(readFileSync(stateFile, 'utf8'));
  } catch {
    /* checked below */
  }
  check(state && state.width >= 420 && state.height >= 700, `window state saved (${state ? `${state.width}x${state.height}` : 'missing'})`);

  // ---------------------------------------------------------------- run 2
  app = await launch('run 2');
  page = app.page;
  await page.waitForSelector('.board .sq', { timeout: 20000 });
  await sleep(800);
  const afterRestart = await placement(page);
  check(JSON.stringify(afterRestart) === JSON.stringify(afterReply), '[run 2] restart keeps the saved game');
  check(
    (await page.locator('[role="dialog"]').count()) === 0 && (await page.getByText('Ghost Snails', { exact: true }).first().isVisible()),
    '[run 2] restart goes straight back to the Ghost Snails game (no mode picker)',
  );
  await page.screenshot({ path: path.join(shotsDir, '3-after-restart.png') });
  check(app.problems.length === 0, `[run 2] no page errors / CSP violations${app.problems.length ? `:\n    ${app.problems.join('\n    ')}` : ''}`);

  // Security checks. These provoke console errors on purpose (blocked loads, 404s).
  const env2 = await page.evaluate(() => ({ require: typeof require, process: typeof process, isSecure: window.isSecureContext }));
  check(env2.require === 'undefined' && env2.process === 'undefined', '[run 2] no Node.js in the page');
  check(env2.isSecure, '[run 2] app://snail is a secure context');
  check((await page.evaluate(() => window.open('app://snail/index.html') === null)), '[run 2] window.open is denied');
  await page.evaluate(() => {
    location.href = 'file:///etc/hosts';
  }).catch(() => {});
  await sleep(1000);
  check(page.url().startsWith('app://snail/'), `[run 2] navigation away is blocked (${page.url()})`);

  const fetched = await page.evaluate(async () => {
    const head = async (u) => {
      try {
        const r = await fetch(u);
        return { status: r.status, type: r.headers.get('content-type'), csp: r.headers.get('content-security-policy') };
      } catch (e) {
        return { status: 'error', error: String(e) };
      }
    };
    const scripts = [...document.querySelectorAll('script[src], link[rel="stylesheet"]')].map((e) => e.src || e.href);
    return {
      index: await head('app://snail/index.html'),
      assets: await Promise.all(scripts.map(async (u) => ({ u, ...(await head(u)) }))),
      traversal: await Promise.all(
        ['app://snail/%2e%2e/package.json', 'app://snail/..%2fpackage.json', 'app://snail/..%5cpackage.json', 'app://snail/%2e%2e%2f%2e%2e%2fsrc/main.js', 'app://other/index.html'].map(head),
      ),
    };
  });
  check(fetched.index.status === 200 && /text\/html/.test(fetched.index.type), `[run 2] index.html is text/html (${fetched.index.type})`);
  check(/script-src 'self'/.test(fetched.index.csp ?? ''), '[run 2] CSP header on app:// responses');
  for (const a of fetched.assets) {
    const want = a.u.endsWith('.css') ? /text\/css/ : /text\/javascript/;
    check(a.status === 200 && want.test(a.type ?? ''), `[run 2] ${a.u.replace('app://snail/', '')} is ${a.type}`);
  }
  check(fetched.traversal.every((t) => t.status === 404 || t.status === 'error'), `[run 2] path traversal refused (${fetched.traversal.map((t) => t.status).join(', ')})`);

  await quitApp(app, 'run 2');
}

try {
  await main();
} catch (e) {
  failures++;
  console.error(`smoke: ${e.stack || e}`);
} finally {
  if (!KEEP) rmSync(profile, { recursive: true, force: true });
}
console.log(failures ? `\nsmoke: ${failures} check(s) FAILED` : '\nsmoke: all checks passed');
process.exit(failures ? 1 : 0);
