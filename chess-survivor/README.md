# Chess Survivor

> *What if you were one chess piece trapped inside a real chess game?*

A roguelike survival game played on a real chessboard. You control **one** piece. A full chess army, played by an AI, hunts you. Survive the battle's objective, pick upgrades, travel a branching map and beat three bosses. A run takes about 15–30 minutes.

## Run it

```bash
cd chess-survivor
npm install
npm run dev        # open the printed localhost URL
```

Other scripts:

| Command | What it does |
| --- | --- |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm test` | Unit tests plus headless full-run simulations for all six pieces |
| `npm run typecheck` | TypeScript only |
| `npm run balance` | Opt-in balance harness: a simple bot plays battles against the real AI budgets and reports hits taken per battle |

## Game rules

**The board.** You play White with a single piece. Every other piece belongs to the enemy (Black). All moves follow standard chess rules, enforced by chess.js: check, checkmate, castling, en passant, promotion, stalemate and legal move generation. Only an upgrade or a boss rule can bend them.

**A turn** is your move followed by the enemy's reply.

**Objectives** vary per battle:

- Survive N turns
- Reach a square
- Escape through a portal on the far rank
- Capture N pieces
- Protect an ally (a static white pawn)
- Promote (Pawn only)
- Force the enemy king to move

Timed objectives fail when their turn limit runs out.

**Damage:**

- Being captured costs **1 HP**, and you reform on the safest empty square.
- Failing an objective costs 1 HP.
- At 0 HP the run ends.
- **King** players can't be captured (that's chess). Only checkmate hurts them.

**Other endings:**

- Checkmating the enemy king wins the battle with a bonus.
- If either side has no legal moves, the battle ends as a stalemate: you escape with half gold.

**Reading the board:**

- Teal dots are safe moves.
- Red dots are squares where you'd be capturable. This is computed by actually playing the move and checking every legal enemy reply, so pins are respected.
- Red stripes show every square the enemy attacks.
- Dashed red arrows point from pieces that can capture you right now.
- Hover an enemy to see its reach.

### Characters

| Piece | HP | Signature upgrade | Unlock |
| --- | --- | --- | --- |
| Pawn | 4 | Reinforced Armor | free |
| Knight | 4 | Knight's Instinct | free |
| Bishop | 4 | Ghost Move | 40 insight |
| Rook | 3 | Parry | 80 insight |
| Queen | 2 | — | 150 insight |
| King | 3 | Time Warp | 220 insight |

A Pawn that reaches the 8th rank promotes, and keeps the new piece for the rest of that battle.

### Upgrades

Charges refill every battle unless the scope says *run*. Run-scoped charges are consumed permanently.

| Upgrade | Scope | Effect |
| --- | --- | --- |
| Second Life | run | The first capture that would take you to 0 HP leaves you at 1 HP instead |
| Ghost Move | run (active) | Move through occupied squares: sliders ignore blockers, other pieces step up to 2 squares |
| Knight's Instinct | battle | Automatically dodge the first capture each battle and leap to a safe square |
| Reinforced Armor | passive | Enemy pawns cannot capture you (the enemy's move list is filtered) |
| Time Warp | battle (active) | Rewind one full turn (your move and the enemy's reply) |
| Borrowed Crown | battle (active) | For one move, move as a Knight, Bishop, Rook or Queen |
| Teleport | battle (active) | Move to any empty square |
| Parry | battle | Survive a capture; the attacker is knocked back and loses its turn |
| Riposte | passive | Parry and dodge also destroy the attacker (never a king) |
| Stasis | battle (active) | The enemy skips its next turn |
| Smoke Bomb | battle (active) | The enemy's next move is random |
| Bloodlust | battle | Your first capture heals 1 HP |
| Iron Heart | passive | +1 max HP and heal 1 |
| Bounty Hunter | passive | +8 gold per capture |
| Swift Feet | passive | Survival objectives need 2 fewer turns |
| Opening Theory | passive | +50% battle gold |

*Design note:* the brief described Time Warp as "force the AI to repeat its previous move". I implemented it as a one-turn rewind, because that is unambiguous and feels good to use. Stasis and Smoke Bomb cover "mess with the enemy's next move".

### Map, bosses and meta progression

Each act is a branching map with 6 floors plus a boss. Node types are Battle, Elite, Event, Treasure, Forge (pick 1 of 3 upgrades), Shop, Rest and Boss.

| Act | Boss | Twist |
| --- | --- | --- |
| 1 | **The Horde** | 16 pawns on ranks 5–6, plus knights and bishops |
| 2 | **The Mirror** | A shadow copy of your piece mirrors each move you make, abilities included, whenever it can |
| 2 (alternative) | **The Immortal** | A queen that can only be captured on dark squares. Slay her or survive |
| 3 | **The Grandmaster** | A full standard army at maximum AI strength |

Runs earn **Insight**, which you spend in *Unlocks* on:

- new pieces
- 5 extra upgrades for the drop pool
- 5 board themes
- Hardcore mode (1 max HP, double Insight)
- Endless mode (acts loop forever, and every loop adds about 300 Elo)

## Architecture

The game logic has no React in it. Pure functions take state and return new state, and the UI only renders and forwards input.

```
src/
  chess/      rules.ts (chess.js wrapper, danger analysis, rule-bending moves), fast.ts (internal fast path), squares.ts
  ai/         search.ts (the Hunter engine), profiles.ts (Elo ladder), ai.worker.ts + client.ts (Web Worker)
  game/       combat.ts (battle state machine), encounters.ts (armies/objectives/bosses), upgrades.ts,
              pieces.ts, map.ts, run.ts (progression/economy), events.ts, meta.ts (unlocks)
  persistence/storage.ts   localStorage for meta + in-progress run (runs resume after reload)
  ui/         components (Board, PieceIcon, cards) and screens
tests/        rules/combat unit tests, AI tactics tests, full-run simulations, balance harness
```

## AI implementation

**Why not Stockfish?** Stockfish plays for checkmate. In Chess Survivor you usually aren't a king, so Stockfish would ignore your piece, and it has no notion of objectives or upgrades. Instead, the enemy is **the Hunter**, a custom engine. It runs in a Web Worker so the UI never freezes.

**Search:**

- Alpha-beta minimax with iterative deepening and a per-move time budget.
- Move generation comes from chess.js internals, so every move it considers is legal chess. The internal path skips SAN formatting and runs at roughly 280k nodes/s.
- The player side only generates moves for your piece. That keeps branching small, so searches reach 4–6 plies.
- Terminal nodes:
  - capturing you
  - killing a protected ally
  - letting you reach an objective square
  - moving the king in "force the king to move" battles
  - being checkmated or stalemated

**Evaluation (the enemy's point of view):**

- material
- how many safe squares you have left (trapping you)
- how tightly its pieces close in on you
- attacks on you or your ally
- your distance to objective squares
- its own king safety

**Difficulty.** Strength scales with search depth, evaluation noise and blunder rate. The `~Elo` labels are approximate targets, not calibrated ratings:

| ~Elo | Depth (plies) | Noise | Blunder rate |
| --- | --- | --- | --- |
| 800 | 1 | 120 | 20% |
| 1000 | 2 | 60 | 10% |
| 1200 | 3 | 30 | 5% |
| 1400 | 4 | 15 | 2% |
| 1800 | 5 | 5 | 0% |
| 2200 (Grandmaster) | 6 | 0 | 0% |

A "blunder" is a random move, but never one that throws away the encounter outright.

Battle Elo starts at about 800 and rises by about 90 per battle won and about 120 per act. Elites add 250.

## Known issues and limitations

- **Elo labels are approximate.** They are not measured against rated play.
- **Repetition and 50-move rules are not tracked.** Threefold repetition and the 50-move rule aren't enforced, because positions are rebuilt from FEN and battles are short.
- **Rule-bending moves edit the FEN directly.** This covers teleport, ghost, respawn, parry, Stasis and mirror jumps, and they clear en-passant rights. After a Parry, the enemy king can still be in check on your turn. You can never capture a king; the enemy must answer the check on its next move.
- **Pawn stalemates are common.** A pawn often gets blocked head-on, which ends the battle as a stalemate (half gold). This is the correct chess result, but it can feel abrupt.
- **Mirror vs King.** Against The Mirror, a King player is mirrored by the enemy king itself.
- **Engine shortcuts.** The Hunter has no transposition table or quiescence search, and leaf evaluation treats "you are attacked on the enemy's move" as nearly winning, without checking pins. Deep tactics can therefore be misjudged.
- **Balance testing is limited.** Balance has only been tuned with a naive bot (`npm run balance`), not with human playtests.
- **Presentation gaps.** There is no sound, no drag-and-drop (click to move) and no tutorial battle. Fonts load from Google Fonts and fall back to system fonts offline.

## Recommended next steps

1. **Playtest telemetry.** Log per-battle outcomes (piece, objective, Elo, hits, turns, upgrades) to tune difficulty curves and upgrade pick rates from real data.
2. **Stronger engine.** Add a transposition table, quiescence search and killer moves. Optionally use Stockfish WASM for a boss mode reframed around checkmate, for example a King run.
3. **Content.** More bosses (e.g. *The Castler*, *The En-Passant Assassin*), events, relic-style synergies and a daily seeded run.
4. **Feel.** Sound design, drag-to-move, a short interactive tutorial, and controller/keyboard square navigation.
5. **Accessibility.** A colour-blind palette for the safe/danger dots and a reduced-motion setting (movement animations can already be switched off from the battle panel).
