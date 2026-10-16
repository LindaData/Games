/**
 * The trailer's gameplay: the real game in Chromium, played with an on-screen mouse pointer and
 * recorded frame by frame with the DevTools screencast (every frame the compositor draws, with its
 * timestamp, so the snails' glides and the chomp play at their real speed).
 *
 * Each clip loads a position through the game's own save format (like the screenshot script),
 * then plays its moves for real against the computer and checks that the thing it is meant to
 * show really happened (a win by your snail, a Hungry eat, a Sacrifice start).
 */
import { sleep, sq, loadPosition, modeCard, gameOver, waitForOurMove, tryMove } from '../art/game.mjs';

/** 1360x765 CSS pixels at 1920/1360 device pixels: 1920x1080 frames with the board as large as the layout allows. */
export const VIEWPORT = { width: 1360, height: 765 };
export const SCALE = 1920 / VIEWPORT.width;

// Positions (FEN). Each is set up so the computer cannot dodge what the clip shows.
const FEN = {
  // Black king e8 boxed in by Qd8, Bf8 and the d7/e7 pawns; f7 is empty, so your snail can sit
  // there in full view, and the king may not step onto it. White can castle.
  ghostWin: 'rnbqkb1r/ppppp1pp/5n2/8/2B1P3/2N2NP1/PPPP1P1P/R1BQK2R w KQkq - 4 5',
  // Black pawn e5 blocked by the white e4 pawn and with nothing to capture: it cannot run away.
  hungry: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
};

export const CLIPS = [
  {
    name: 'ghost',
    caption: { title: 'Ghost Snails', line: 'Snails slide over pieces.' },
    async setup(page) {
      // Your snail on f7, next to their boxed-in king; theirs on h4, on its way to your king.
      await loadPosition(page, 3, { mode: 'ghost', fen: FEN.ghostWin, yours: 'f7', theirs: 'h4' });
    },
    async play({ page, pointer, mark }) {
      mark('caption');
      await sleep(1100);
      // Castle; the computer replies; both snails crawl: theirs slides onto your g3 pawn (and
      // leaves it), yours slides onto their king.
      if (!(await tryMove(page, 'e1g1', pointer.click))) throw new Error('could not castle');
      await page.locator('.result-card').first().waitFor({ timeout: 25000 });
      const text = (await page.locator('.result-card').first().innerText()) ?? '';
      if (!/win/i.test(text) || !/snail/i.test(text)) throw new Error(`unexpected result: ${text.split('\n')[0]}`);
      await pointer.moveTo({ x: 1010, y: 560 }, 700);
      await sleep(2600);
    },
  },
  {
    name: 'hungry',
    caption: { title: 'Hungry Snails', line: 'Snails eat enemy pieces.' },
    async setup(page) {
      // Your snail on d4 crawls to e5 and eats the stuck black pawn; theirs goes b4 -> c3.
      await loadPosition(page, 3, { mode: 'hungry', fen: FEN.hungry, yours: 'd4', theirs: 'b4' });
    },
    async play({ page, pointer, mark }) {
      mark('caption');
      await sleep(1100);
      if (!(await tryMove(page, 'd2d3', pointer.click))) throw new Error('d2-d3 was not playable');
      await page.getByText(/Your snail ate their pawn/i).first().waitFor({ timeout: 25000 });
      await pointer.moveTo({ x: 1010, y: 560 }, 700);
      await sleep(2400);
      if (!(await waitForOurMove(page, 3000))) throw new Error('the game did not come back to White');
    },
  },
  {
    name: 'sacrifice',
    caption: { title: 'Sacrifice Snails', line: 'Give up a piece. Your snail takes its place.' },
    // First visit: the start screen with the three modes.
    async setup(page) {
      if (!(await modeCard(page, 'Sacrifice').isVisible())) throw new Error('no mode picker');
    },
    async play({ page, pointer, mark }) {
      await sleep(1000);
      await pointer.click(modeCard(page, 'Sacrifice'));
      await sleep(350);
      mark('caption');
      await sleep(350);
      await pointer.click(sq(page, 'b1'));
      const start = page.getByRole('button', { name: /^Start/ }).first();
      await start.waitFor({ timeout: 5000 });
      await sleep(1100);
      await pointer.click(start);
      await sleep(900);
      const labels = await page.$$eval('.board button.sq', (els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
      if (!labels.some((l) => l.startsWith('b1,') && /your snail/.test(l))) throw new Error('your snail is not on b1');
      if (!(await tryMove(page, 'e2e4', pointer.click))) throw new Error('e2-e4 was not playable');
      if (!(await waitForOurMove(page))) throw new Error('the computer did not reply');
      if (await gameOver(page)) throw new Error('the game ended');
      await sleep(1400);
    },
  },
];

// ---------------------------------------------------------------------------- the pointer

/** An arrow pointer and a click ripple drawn on top of the page, following the real mouse. */
async function injectPointer(page) {
  await page.evaluate(() => {
    const NS = 'http://www.w3.org/2000/svg';
    const root = document.createElement('div');
    root.id = 'trailer-pointer';
    root.style.cssText = 'position:fixed; left:0; top:0; z-index:2147483647; pointer-events:none; will-change:transform;';
    root.innerHTML = `<svg xmlns="${NS}" width="30" height="40" viewBox="0 0 30 40" style="display:block; filter:drop-shadow(0 2px 2px rgba(0,0,0,0.35))">
      <path d="M2 2 L2 31 L9.5 24 L14.5 36 L19.5 34 L14.5 22.5 L25 22.5 Z" fill="#fff" stroke="#111" stroke-width="2.2" stroke-linejoin="round"/></svg>`;
    document.body.appendChild(root);
    const place = (x, y) => (root.style.transform = `translate(${x - 2}px, ${y - 2}px)`);
    place(-100, -100);
    window.addEventListener('mousemove', (e) => place(e.clientX, e.clientY), true);
    window.addEventListener(
      'mousedown',
      (e) => {
        const ring = document.createElement('div');
        ring.style.cssText = `position:fixed; left:${e.clientX - 22}px; top:${e.clientY - 22}px; width:44px; height:44px;
          border-radius:50%; border:4px solid rgba(255,255,255,0.95); box-shadow:0 0 0 2px rgba(0,0,0,0.25);
          z-index:2147483646; pointer-events:none;`;
        document.body.appendChild(ring);
        ring.animate([{ transform: 'scale(0.3)', opacity: 1 }, { transform: 'scale(1.2)', opacity: 0 }], { duration: 450, easing: 'ease-out' }).onfinish = () => ring.remove();
      },
      true,
    );
  });
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function makePointer(page, start) {
  let at = { ...start };
  const pointer = {
    async moveTo(to, ms) {
      const from = { ...at };
      const dist = Math.hypot(to.x - from.x, to.y - from.y);
      const duration = ms ?? Math.min(750, 300 + dist * 0.7);
      const t0 = Date.now();
      for (;;) {
        const t = Math.min(1, (Date.now() - t0) / duration);
        const k = ease(t);
        await page.mouse.move(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k);
        if (t >= 1) break;
        await sleep(12);
      }
      at = { ...to };
    },
    /** Glide to the middle of a locator's element and click it. */
    async click(locator) {
      const box = await locator.boundingBox();
      if (!box) throw new Error('nothing to click');
      await pointer.moveTo({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
      await sleep(90);
      await page.mouse.down();
      await sleep(60);
      await page.mouse.up();
      await sleep(60);
    },
  };
  return pointer;
}

// ---------------------------------------------------------------------------- recording

/**
 * Records one clip. Returns its frames ({ t, data } with t in seconds from the start, data a
 * base64 JPEG), its length, its marks (seconds) and where the caption may go (video pixels).
 */
export async function recordClip({ browser, url, clip }) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE, colorScheme: 'light', reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.goto(url);
    await page.waitForSelector('.board button.sq', { timeout: 20000 });
    await sleep(500);
    await clip.setup(page);
    await injectPointer(page);
    const start = { x: 1010, y: 560 };
    await page.mouse.move(start.x, start.y);
    await sleep(400);

    // The free part of the right-hand column (under the record line), for the caption.
    const aside = await page.locator('aside').first().boundingBox();
    const captionBox = aside && {
      left: Math.round(aside.x * SCALE),
      top: Math.round((aside.y + aside.height + 44) * SCALE),
      width: Math.round(aside.width * SCALE),
    };

    const cdp = await context.newCDPSession(page);
    const frames = [];
    cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
      frames.push({ t: metadata.timestamp, data });
      cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    });
    const marks = {};
    const t0 = Date.now() / 1000;
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
    const mark = (name) => (marks[name] = Date.now() / 1000 - t0);
    let failure = null;
    try {
      await clip.play({ page, pointer: makePointer(page, start), mark });
    } catch (e) {
      failure = e;
    }
    const t1 = Date.now() / 1000;
    await cdp.send('Page.stopScreencast');
    await sleep(100);
    if (failure) throw failure;
    if (errors.length) throw new Error(`page error: ${errors[0]}`);
    if (frames.length < 30) throw new Error(`only ${frames.length} frames were recorded`);
    // Screencast timestamps are wall-clock seconds, like Date.now(); a frame that came in before
    // the recording started counts from 0.
    return {
      frames: frames.map((f) => ({ t: Math.max(0, f.t - t0), data: f.data })),
      length: t1 - t0,
      marks,
      captionBox,
    };
  } finally {
    await context.close();
  }
}
