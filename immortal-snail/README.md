# Immortal Snail Chess

> *You get a normal game of chess. But a small bronze snail is slowly crawling toward your king, and if it touches you, you lose.*

Based on the "Immortal Snail Chess!" short (ViperKing) and the immortal snail meme. One screen, one tap to start playing.

## How to play

1. **You are White. Checkmate the computer to win.**
2. **Every 2 turns, the snail crawls 1 square toward your king. Nothing can stop it.**
3. **If the snail touches your king, you lose.**

To move, tap a piece, then tap a dot. The rules card shows on your first visit; the **Rules** button brings it back.

The fine print, for the curious: all normal chess rules apply (castling, en passant, stalemate and the usual draws), and your pawns always promote to a queen. The snail starts on a8 and crawls after the computer's reply on turns 2, 4, 6, … It can't be captured or blocked, and any piece except your king may share its square. Your king can never step (or castle) onto the snail, so in the rare case where every move you have left would do that, the snail has trapped your king and you lose. If the computer's reply ends the game, the snail stays put. The dotted green outline shows where the snail crawls next, and your king's square glows red when the snail is right next to it.

The game saves after every move and resumes when you come back. It keeps one record of wins, losses and draws.

## Run it

```bash
cd immortal-snail
npm install
npm run dev        # open the printed localhost URL
```

| Command | What it does |
| --- | --- |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm test` | Unit tests (snail maths, game rules, AI) |
| `npm run typecheck` | TypeScript only |
| `npm run bench` | Times the AI on sample middlegames |

## How it's built

React 18 + TypeScript (strict) + Vite 5 + Tailwind 3, with `chess.js` (pinned to 1.4.0) for every chess rule. Game logic is plain TypeScript with no React, so it is fully unit tested.

| Path | What's in it |
| --- | --- |
| `src/game/snail.ts` | Snail maths: distance, the next step (minimise Chebyshev distance, then squared Euclidean, then a fixed direction order), the crawl schedule |
| `src/game/engine.ts` | Immutable game state and transitions (`applyWhiteMove`, `applyBlackMove`, `advanceSnail`), result detection, save/restore |
| `src/game/settings.ts` | The fixed settings: how often the snail crawls, how the computer plays |
| `src/chess/fast.ts` | Typed adapter over chess.js internals for fast legal-move generation (why chess.js is pinned) |
| `src/ai/search.ts` | Negamax alpha-beta: material + piece-square tables, MVV-LVA/promotion/check ordering, mate-distance scoring, capture quiescence |
| `src/ai/ai.worker.ts`, `src/ai/client.ts` | The AI runs in a module Web Worker. Replies are tagged with game id + position, so stale replies are ignored. Each move takes at least 400 ms so it doesn't feel instant |
| `src/ui/*`, `src/App.tsx` | Board (square buttons with aria-labels, arrow-key navigation), the SVG snail, status, controls, rules card, game-over card |
| `src/storage.ts` | `localStorage` (keys prefixed `immortal-snail:`), wrapped in try/catch. The game works without it |

A turn is one White move plus Black's reply. The snail crawls after the reply on turns where `turn % 2 === 0`. If the reply ends the game, the snail stays put. The computer looks one move ahead and picks randomly among moves within 80 centipawns of its best, so it plays loosely and varies from game to game. It ignores the snail and answers in a few milliseconds (each move still takes at least 400 ms).
