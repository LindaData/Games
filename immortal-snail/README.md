# Immortal Snail Chess

> *You get a normal game of chess. But a small bronze snail is slowly crawling toward your king, and if it touches you, you lose.*

Based on the "Immortal Snail Chess!" short (ViperKing) and the immortal snail meme. One screen, one tap to start playing.

## How to play

- You are **White** against the computer. All normal chess rules apply (castling, en passant, check, checkmate, stalemate, threefold repetition, 50-move rule, insufficient material). Your pawns always promote to a queen.
- **The snail** starts on a8. It is not a chess piece: it can't be captured or blocked, and pieces of both colours can move onto or through its square. The one exception is your king.
- After the computer replies, the snail crawls **one square** toward your king every few turns:

  | Difficulty | Snail crawls | Computer |
  | --- | --- | --- |
  | Easy | every 3rd turn | looks 1 move ahead, plays loosely |
  | Normal (default) | every 2nd turn | looks 2 moves ahead |
  | Hard | every turn | looks 3 moves ahead |

- **You lose if** the snail lands on your king, if the computer checkmates you, or if every legal move you have left would step your king onto the snail (it "cornered" you). Your king can never move onto the snail.
- **You win** by checkmating the computer before the snail gets you.
- The dotted green outline shows the square the snail will crawl to next. Your king's square glows red when the snail is right next to it.

The game saves after every move and resumes when you come back. Wins, losses and draws are tracked per difficulty.

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
| `npm run bench` | Times the AI at every difficulty on sample middlegames |

## How it's built

React 18 + TypeScript (strict) + Vite 5 + Tailwind 3, with `chess.js` (pinned to 1.4.0) for every chess rule. Game logic is plain TypeScript with no React, so it is fully unit tested.

| Path | What's in it |
| --- | --- |
| `src/game/snail.ts` | Snail maths: distance, the next step (minimise Chebyshev distance, then squared Euclidean, then a fixed direction order), the crawl schedule |
| `src/game/engine.ts` | Immutable game state and transitions (`applyWhiteMove`, `applyBlackMove`, `advanceSnail`), result detection, save/restore |
| `src/game/difficulty.ts` | Snail speed and AI settings per difficulty |
| `src/chess/fast.ts` | Typed adapter over chess.js internals for fast legal-move generation (why chess.js is pinned) |
| `src/ai/search.ts` | Negamax alpha-beta: material + piece-square tables, MVV-LVA/promotion/check ordering, mate-distance scoring, capture quiescence |
| `src/ai/ai.worker.ts`, `src/ai/client.ts` | The AI runs in a module Web Worker. Replies are tagged with game id + position, so stale replies are ignored. Each move takes at least 400 ms so it doesn't feel instant |
| `src/ui/*`, `src/App.tsx` | Board (square buttons with aria-labels, arrow-key navigation), the SVG snail, status, controls, game-over card |
| `src/storage.ts` | `localStorage` (keys prefixed `immortal-snail:`), wrapped in try/catch. The game works without it |

A turn is one White move plus Black's reply. The snail crawls after the reply on turns where `turn % every === 0`. If the reply ends the game, the snail stays put. The AI ignores the snail. Hard (depth 3) typically answers in tens of milliseconds; run `npm run bench` to measure it on your machine.
