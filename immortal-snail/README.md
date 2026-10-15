# Immortal Snail Chess

> *You get a normal game of chess, plus two unkillable snails. Yours is slowly crawling toward their king. Theirs is slowly crawling toward yours.*

Based on the "Immortal Snail Chess!" short (ViperKing) and the immortal snail meme. One screen: pick a game, then play.

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

## Run it

```bash
cd immortal-snail
npm install
npm run dev        # open the printed localhost URL
```

| Command | What it does |
| --- | --- |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm test` | Unit tests (snail maths, game rules for all modes, AI, saves) |
| `npm run typecheck` | TypeScript only |
| `npm run bench` | Times the AI on sample middlegames |

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
| `src/storage.ts` | `localStorage` (keys prefixed `immortal-snail:`): the game (`game:v3`), the last mode, one record per mode. Wrapped in try/catch; the game works without it |

The snails are not chess.js pieces: the engine tracks their squares beside the chess position. A Hungry eat removes the piece with chess.js `remove()` (which also fixes castling rights and en passant), resets the 50-move count and restarts the position's repetition history, since earlier positions can never come back. A save holds the mode, the Sacrifice pick and the move list; everything else (snail paths, eats) is replayed deterministically on load, then checked against the saved turn and snail squares. A missing, corrupt or older save opens the start screen.

The computer looks one move ahead and picks randomly among moves within 80 centipawns of its best, so it plays loosely and varies from game to game. It knows a few snail rules: its king never steps onto your snail; a snail within 3 squares of a king costs that king's side (300 / 120 / 40 centipawns at 1 / 2 / 3 squares); when the snails crawl right after its move, a snail about to land on a king decides the game, and in Hungry games a piece on a snail's next square counts as lost.
