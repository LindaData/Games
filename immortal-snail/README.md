# Snailmate Chess

> *You get a normal game of chess, plus two unkillable snails. Yours is slowly crawling toward their king. Theirs is slowly crawling toward yours.*

Play it at **https://snailmate-chess.vercel.app**. Inspired by the "Immortal Snail Chess!" short (ViperKing) and the immortal snail meme. One screen: pick a game, then play.

> The game was first called "Immortal Snail Chess". The folder is still `immortal-snail/` (Vercel's root directory points at it) and saves still use the `immortal-snail:` localStorage prefix, so players keep their games and records.

## How to play

1. **You are White. Win by checkmate — or when your snail reaches their king.**
2. **Every 3 turns, both snails crawl 1 square toward the enemy king.**
3. **If their snail touches your king, you lose.**

Your snail is green, theirs is bronze. To move, tap a piece, then tap a dot.

## Three ways to play

The start screen asks which one. **New game** brings it back; **Rules** shows the rules for the game you're in.

| Mode | The 4th rule |
| --- | --- |
| **Ghost Snails** | Snails slide over pieces. They never eat anything. |
| **Hungry Snails** | Snails eat enemy pieces they crawl onto. |
| **Sacrifice Snails** | Pick one of your pieces to give up. Your snail starts in its place. |

- **Ghost:** the snails start on h1 (yours) and a8 (theirs), each 7 king-steps from the king it hunts, and share squares with anything.
- **Hungry:** same start. When a snail's crawl ends on an enemy piece (never a king), that piece is eaten: "Your snail ate their knight!" A snail sitting on one of its own side's pieces just shares the square. If an eat leaves the black king open to one of your pieces on your move, you win on the spot ("Their king was left open"); if it opens a line to your king, you are simply in check.
- **Sacrifice:** before move 1 you tap one of your pieces (not the king) and press **Start**. That piece leaves the board and your snail starts on its square; the computer gives up the same piece on the mirrored square (b1 → b8, e2 → e7) and its snail starts there. Giving up a rook drops that side's castling right on both sides. The snails then behave like Ghost snails.

The fine print, for the curious: all normal chess rules apply (castling, en passant, stalemate and the usual draws), and your pawns always promote to a queen. A turn is your move plus the computer's reply; on turns 3, 6, 9, … both snails crawl at the same time, right after the reply (unless the reply ended the game). Each takes one king-step toward the enemy king. If your snail lands on their king you win, if theirs lands on yours you lose, and if both land in the same crawl it's a draw. Snails can't be captured or blocked, and share squares with any piece and with each other. Neither king may ever step (or castle) onto the enemy snail; a king may share a square with its own snail. If a side's only legal moves are onto the enemy snail, that side is trapped and loses. The dotted outlines show where each snail crawls next; your king's square glows red when their snail is right next to it, and their king glows green when yours is.

The game saves after every move and resumes when you come back. It remembers the last mode and keeps a record of wins, losses and draws for each mode.

## On iPhone, sharing, controllers

- **iPhone / Android:** open the link, then *Share → Add to Home Screen*. It runs full screen like an app and works offline (in iPhone Safari a small hint says how, until × hides it for good). Nothing hides under the notch or the home bar; the board ignores double-tap zoom and long presses.
- **Share** (next to Rules; just the icon on phones) opens the phone's share sheet with "A snail is hunting my king 🐌♟️ Can you win?" and the link, or copies them ("Link copied") where there is no share sheet. The end card has **Share result** ("I beat the snail in 23 turns (Hungry Snails) 🐌♟️"). Link previews (iMessage, WhatsApp, X, …) show `public/og.png`.
- **Controller** (Steam Deck, Xbox, PlayStation): D-pad or left stick moves between squares, buttons and cards; **A** selects / moves / presses; **B** goes back (deselect, close a card); **X** rules; **Y** or **Start** new game (twice during a game, like the button). In Sacrifice, A on the picked piece again (or the Start button) starts. A focus ring shows while the controller is in use. Keyboard: arrow keys on the board, Tab, Enter, Esc.
- Text stays at least 12px (13px board letters) at 1280x800, Valve's Steam Deck guideline.

## Run it

```bash
cd immortal-snail
npm install
npm run dev        # open the printed localhost URL
```

| Command | What it does |
| --- | --- |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm test` | Unit tests (snail maths, game rules for all modes, AI, saves, controller mapping, share texts, PWA/offline pieces) |
| `npm run typecheck` | TypeScript only |
| `npm run bench` | Times the AI on sample middlegames |
| `npm run art` | Re-renders the icons and the link-preview image (`og.png`, 256 colours so it stays under 300 KB) into `public/` (needs `npm ci` in `desktop/` or `steam/` for playwright-core, Chromium and ffmpeg) |

### Name, address, stats

- **The name and the public address live in `src/site.json`** (name, short name, URL, description, colours). The page title, link-preview tags, web app manifest, header, Share texts and `npm run art` all read it. To move to https://snailmate.lindadata.com (once its DNS record is in), change `url` there (and re-deploy). The desktop app and Steam kit have their own names (`desktop/package.json`, `desktop/electron-builder.yml`, `steam/`).
- **Stats:** Vercel Web Analytics (`@vercel/analytics`), only on the deployed site (never in dev, on localhost or in the desktop app). Cookieless, no personal data. Page views, plus these events (custom events need Vercel Pro): `game_start {mode}`, `game_end {mode, result, cause, turns}`, `share {kind: link|result, method: native|copy}`, `install_hint {action: shown|dismissed}`. `turns` counts your moves. Turn it on in the Vercel project's *Analytics* tab.
- **Offline:** the build writes `sw.js`, a service worker that keeps every built file (the AI worker included) in a cache named after a hash of their contents and serves them cache first. A new deploy downloads in the background; the game switches to it the next time it is opened. Registered only on http(s) in production builds.

## How it's built

React 18 + TypeScript (strict) + Vite 5 + Tailwind 3, with `chess.js` (pinned to 1.4.0) for every chess rule. Game logic is plain TypeScript with no React, so it is fully unit tested.

| Path | What's in it |
| --- | --- |
| `src/game/snail.ts` | Snail maths: start squares, distance, the next step (minimise Chebyshev distance, then squared Euclidean, then a fixed direction order), the crawl schedule, mirrored squares |
| `src/game/engine.ts` | Immutable game state and transitions (`newGame`, `startSacrifice`, `applyWhiteMove`, `applyBlackMove`, `crawlSnails`), the king-onto-snail filter, Hungry eats, result detection, save/restore |
| `src/game/settings.ts` | The three modes and the fixed settings: how often the snails crawl, how the computer plays |
| `src/chess/fast.ts` | Typed adapter over chess.js internals for fast legal-move generation (why chess.js is pinned) |
| `src/ai/search.ts` | Negamax alpha-beta: material + piece-square tables, MVV-LVA/promotion/check ordering, mate-distance scoring, capture quiescence, plus the snail rules below |
| `src/ai/ai.worker.ts`, `src/ai/client.ts` | The AI runs in a module Web Worker. Replies are tagged with game id + position, so stale replies are ignored. Each move takes at least 400 ms so it doesn't feel instant |
| `src/ui/*`, `src/App.tsx` | Start screen (mode picker), board (square buttons with aria-labels, arrow-key navigation), the SVG snails, the chomp, status, Sacrifice pick panel, rules card, game-over card |
| `src/storage.ts` | `localStorage` (keys prefixed `immortal-snail:`): the game (`game:v3`), the last mode, one record per mode, the closed install hint. Wrapped in try/catch; the game works without it |
| `src/site.json`, `src/site.ts` | The name, public URL, description and colours, in one place |
| `src/share.ts`, `src/ui/Extras.tsx` | Share texts, share sheet or copy, the toast, the Add to Home Screen hint |
| `src/input/*` | Controller: button mapping and repeat (`gamepad.ts`), D-pad focus moves (`spatial.ts`, `focus.ts`), Gamepad API polling (`useGamepad.ts`) |
| `src/pwa/*`, `vite-plugin-site.ts` | Manifest, the service worker template and its registration, the install-hint rules; the Vite plugin fills `index.html` from `site.json` and writes `manifest.webmanifest` and `sw.js` |
| `src/analytics.ts` | Vercel Web Analytics: when it is on, and the typed events |
| `public/`, `scripts/make-web-art.mjs` | Icons (192, 512, maskable, Apple touch, favicons) and `og.png` (1200x630), rendered by `npm run art` |
| `vercel.json` | Caching: `sw.js` always revalidates, hashed assets are cached for a year |

The snails are not chess.js pieces: the engine tracks their squares beside the chess position. A Hungry eat removes the piece with chess.js `remove()` (which also fixes castling rights and en passant), resets the 50-move count and restarts the position's repetition history, since earlier positions can never come back. A save holds the mode, the Sacrifice pick and the move list; everything else (snail paths, eats) is replayed deterministically on load, then checked against the saved turn and snail squares. A missing, corrupt or older save opens the start screen.

The computer looks one move ahead and picks randomly among moves within 80 centipawns of its best, so it plays loosely and varies from game to game. It knows a few snail rules: its king never steps onto your snail; a snail within 3 squares of a king costs that king's side (300 / 120 / 40 centipawns at 1 / 2 / 3 squares); when the snails crawl right after its move, a snail about to land on a king decides the game, and in Hungry games a piece on a snail's next square counts as lost.
