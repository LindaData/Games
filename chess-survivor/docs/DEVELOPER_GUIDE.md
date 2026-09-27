# Chess Survivor — Developer Guide

This guide covers how the code is organised, how a turn flows through it, how the AI works, and how to add content. The rules and numbers themselves are in the [Game Design Reference](GAME_DESIGN.md).

## Quick start

```bash
cd chess-survivor
npm install
npm run dev          # Vite dev server
npm test             # unit tests + headless full-run simulations (~45 s)
npm run build        # typecheck + production build to dist/
npm run balance      # opt-in balance harness (several minutes)
```

From the repository root, `npm run chess:install`, `chess:dev`, `chess:build` and `chess:test` do the same.

**Stack:** React 18, TypeScript 5 (strict), Vite 5, Tailwind 3, chess.js 1.4.0 (pinned exactly, because we use its internals; see below), lucide-react icons and Vitest.

---

## Architecture

The rule of the codebase: **game logic never imports React.** Everything under `chess/`, `ai/`, `game/`, `core/` and `persistence/` is plain TypeScript that runs in Node (tests), a Web Worker (AI) and the browser alike.

```
src/
├─ core/rng.ts            seeded PRNG (mulberry32) + pick/shuffle/weightedPick/gaussian
├─ chess/
│  ├─ rules.ts            the rules layer: legal moves, danger analysis, FEN editing, rule-bending moves
│  ├─ fast.ts             FastBoard: typed access to chess.js internals for speed
│  └─ squares.ts          square helpers (0x88 conversion, mirror, colour, distance)
├─ ai/
│  ├─ search.ts           the Hunter engine (pure; runs anywhere)
│  ├─ profiles.ts         Elo → depth/noise/blunder/time ladder
│  ├─ ai.worker.ts        Web Worker entry
│  └─ client.ts           promise API for the worker, with a synchronous fallback
├─ game/
│  ├─ combat.ts           battle state machine (the heart of the game)
│  ├─ encounters.ts       army, objective and boss generation
│  ├─ upgrades.ts         upgrade catalogue (data only)
│  ├─ pieces.ts           playable characters (data only)
│  ├─ run.ts              run state: map travel, rewards, shop, rest, events, acts, Insight
│  ├─ map.ts              branching act map
│  ├─ events.ts           random events
│  └─ meta.ts             permanent unlocks, themes, modes
├─ persistence/storage.ts localStorage load/save (meta + in-progress run)
├─ ui/                    React components and screens (render state, forward input)
└─ App.tsx                screen routing; owns MetaState and RunState in useState
```

### State model

There are three nested states. Every transition is a pure function `(state, input) → newState`.

| State | Lives in | Persisted | Changed by |
| --- | --- | --- | --- |
| `MetaState` | `game/meta.ts` | `chess-survivor:meta:v1` | `unlock`, `applyRunToMeta` |
| `RunState` | `game/run.ts` | `chess-survivor:run:v1` | `newRun`, `enterNode`, `finishCombat`, `claimReward`, `buyItem`, … |
| `CombatState` | `game/combat.ts` | inside `RunState.combat` | `playerAct`, `enemyAct`, `useInstant`, `setMode` |

`App.tsx` holds `meta` and `run` in `useState` and saves both on every change. A run reloaded mid-battle resumes exactly where it was. If it's the enemy's turn, `CombatScreen` asks the AI again.

**Save compatibility.** Fields added after release are optional (for example `RunState.cooldowns` and `CombatState.initialCharges`) and are read with `?? {}`. Keep doing this, or bump the storage key version.

### Stable piece ids

`CombatState.ids` maps each square to a piece id. The ids let the UI animate pieces (React keys) and let the game track special pieces (player, ally, Immortal, Mirror) across moves, captures, castling and en passant. Update them with `moveIds` for chess.js moves and `relocateIds` for rule-bending moves. Never rebuild them from the FEN.

---

## How a turn flows

1. **Player phase.** `getTargets(state)` returns every clickable square for the current `mode`:
   - `normal`: chess.js legal moves
   - `ghost`, `teleport`, `borrow`: the rule-bending generators in `rules.ts`

   Each target carries a `danger` flag. It is computed by applying the move and asking chess.js for every legal enemy reply that captures the player (`landingIsDangerous` → `capturersOf`), so pins are respected.
2. `playerAct(state, square, promotion?)` applies the move, updates ids, handles captures, promotion and Bloodlust, then checks:
   - objectives
   - checkmate or stalemate of the enemy

   Otherwise it sets `phase = 'enemy'`.
3. **Enemy phase.** `CombatScreen` calls `forcedEnemyAction(state)` for Stasis, Smoke Bomb and Mirror moves. If nothing is forced, it sends `buildAiRequest(state)` to the worker.
4. `enemyAct(state, aiMove, forced)` applies the move and runs the damage chain (`defend` → `takeHit` → respawn), then `endEnemyTurn`, which handles turn count, objective completion or failure, and player stalemate.

The UI keeps a minimum "thinking" time of 450 ms, so fast AI replies still read as a turn.

---

## Chess rules layer

### Why chess.js internals?

chess.js's public `moves({ verbose: true })` builds a SAN string for every move, and SAN generation calls move generation again. That is fine for the UI but far too slow inside a search tree. `FastBoard` (`src/chess/fast.ts`) wraps these private members with types:

- `_moves`
- `_makeMove` / `_undoMove`
- `_attacked`
- `_board`, `_turn`, `_kings`, `_epSquare`

Those are the same routines chess.js uses internally, so all legality still comes from chess.js. Throughput is about 280k nodes/s.

> **Upgrading chess.js:** the dependency is pinned to exactly `1.4.0` for this reason. After any upgrade, run `npm test`. The AI tests and simulations exercise every internal we touch.

### Kingless White

When the player isn't the King, the FEN has no white king. `new Chess(fen, { skipValidation: true })` accepts that, and `_isKingAttacked` returns `false` for a missing king. So White's "legal" moves are just its pseudo-legal moves, which is the intended behaviour, while Black keeps full legality.

**Invariant:** never create positions chess.js can't hash, such as pawns on rank 1 or 8. The Zobrist hash throws a `BigInt` error on them. The rule-bending generators already refuse those squares.

### Rule mods

`RuleMods` (`armor`, `immortalSq`) are passed everywhere enemy captures are computed. Any new rule that changes who can capture whom must be applied in **three** places, or the danger dots, the damage logic and the AI will disagree:

1. `rules.ts`: `enemyMoves`, `capturersOf`, `enemyAttackMap`
2. `ai/search.ts`: `blackMoves`, `whiteMoves` and the evaluation's `attackersOfPlayer`
3. `combat.ts`: `ruleMods()` and anything reading it

---

## AI

`Hunter` in `src/ai/search.ts` plays Black.

**Search**

- Minimax with alpha-beta, iterative deepening and a per-move time budget.
- At the root every move is scored with a full window, so there are exact scores to add noise to.
- White's branching is only the player's moves (1–27), so the tree stays small enough for 4–7 plies.

**Terminal nodes**

| Event | Score (enemy's view) |
| --- | --- |
| Black captures the player | `+WIN − ply` |
| Black captures a protected ally | `+WIN/2 − ply` |
| Black moves or castles its king in a *kingMove* battle | `−WIN/2 + ply` |
| The player can reach an objective square | `−WIN/2 + ply` |
| Black is checkmated / stalemated | `−WIN + ply` / `−4000` |
| The player king is checkmated / the player is stalemated | `+WIN − ply` / `−4000` |

**Evaluation (the enemy's view)**

- Material. The player's own piece is excluded.
- Proximity of enemy pieces to the player (and to the ally).
- A player attacked with Black to move scores `WIN/4` (almost won).
- Each safe square the player can move to lowers the score by 18 (up to 8 squares counted). No safe squares at all adds +250, or `WIN/8` if the player is also attacked.
- Distance to objective squares, 45 per square.
- Attacks on the ally.
- −40 if Black's own king is in check.

**Difficulty** comes from the profile (`profiles.ts`): maximum depth, Gaussian noise added to root scores, and a blunder chance that picks a random move from those scoring above `−WIN/4`.

**Worker plumbing.** `client.ts` lazily creates `new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' })` and matches replies by request id. When `Worker` is unavailable (tests, SSR) it calls `chooseEnemyMove` synchronously.

**Known shortcuts:** there is no transposition table and no quiescence search, and the leaf attack check ignores pins. These are the natural next steps for a stronger engine.

---

## Adding content

### A new upgrade

1. Add the id to `UpgradeId` and an entry to `UPGRADES` in `game/upgrades.ts`. Set `scope`, `active`, `stackable` and `recharge`. An `unlockCost > 0` makes it a meta unlock, which appears on the Unlocks screen automatically.
2. Give it an icon: add its name to the `BY_NAME` map in `ui/components/Icon.tsx` (lucide icon).
3. Implement the effect where its rule lives:
   - movement → `rules.ts` generator plus a `mode` in `combat.ts`
   - defence → `defend()`
   - economy → `finishCombat()`
   - instant → `useInstant()`
4. Active upgrades must be added to `ACTIVE_ORDER` so they get a button.
5. Add a test in `tests/combat.test.ts`, then run `npm run balance` and compare hits per battle.

### A new playable piece variant or signature

Edit `CHARACTERS` in `game/pieces.ts`. Signatures are granted in `newRun` through `addUpgrade`.

### A new objective

1. Add a variant to `Objective` in `encounters.ts`, plus its `objectiveText` and a branch in `pickObjective`.
2. Check completion in `playerAct` or `endEnemyTurn` (`combat.ts`).
3. If the enemy should play against it, add a `GoalHint` in `goalHint()` and handle it in the Hunter's `evaluate` / `blackTerminal`.
4. Update the progress label in `CombatScreen.tsx`.

### A new boss

1. Add the id to `BossId` and `BOSSES` (name, subtitle, description).
2. Add its Elo in `battleElo` and its army and objective in the boss branch of `generateEncounter`.
3. Schedule it in `bossForAct` (`map.ts`).
4. Special rules go in `forcedEnemyAction` (enemy side) or `RuleMods` (capture rules; see the three places above).

### A new event

Append to `EVENTS` in `game/events.ts`. Options get an `available(run)` guard and an `apply(run, rng)` that returns `{ run, result }`. Use `addUpgrade` to grant upgrades, and check `run.owned` for non-stackable ones.

---

## Testing

| File | What it covers | Runs in `npm test` |
| --- | --- | --- |
| `tests/combat.test.ts` | Targets and danger flags, damage chain, every defensive upgrade, recharge timers, teleport/ghost limits, armor ranks, promotion, checkmate, King damage, protect failure, Immortal and Mirror rules, square colours | yes |
| `tests/ai.test.ts` | The engine takes hanging pieces, avoids hanging its own, respects armor, finds direct captures, stays within its time budget | yes |
| `tests/sim.test.ts` | A bot plays complete runs for all six pieces plus Endless mode, asserting board invariants (one black king, ids match pieces) every ply | yes |
| `tests/balance.sim.ts` | Hits per battle by piece, tier and boss against real AI budgets | `npm run balance` |
| `tests/edge.sim.ts` | How much a defensive upgrade kit reduces hits over six battles, with recharge timers applied | `npm run balance` |

Test FEN positions must be positions chess.js can hash. For example, no pawns on the first or last rank.

---

## Deployment

The game is a static site. After `npm run build`, serve `dist/` from any static host.

- For a sub-path or an embedded page, build with `npx vite build --base ./` so asset URLs are relative. The published claude.ai page uses this.
- For Vercel, point a project at `chess-survivor/` as its root directory. Vercel detects Vite, uses `npm run build` as the build command, and serves `dist/`. This needs Vercel's GitHub app installed on the repository.
- Keep native dialogs (`alert`, `confirm`, `prompt`) out of the UI. Sandboxed embeds block them.
