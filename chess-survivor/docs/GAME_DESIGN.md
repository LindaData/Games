# Chess Survivor — Game Design Reference

This is the reference for every rule, formula and tuning value in the game, with the source file each one lives in. Read it before changing balance. The [Player Guide](PLAYER_GUIDE.md) covers the same systems from the player's side.

## Design pillars

1. **It must stay chess.** Every normal move is generated and validated by chess.js. Rule bending is limited to explicit upgrades and boss rules, and each one is spelled out below.
2. **You are the prey.** The enemy's evaluation is about hunting one piece, not about checkmate (see [Developer Guide](DEVELOPER_GUIDE.md#ai)).
3. **Readable danger.** The player can always see which moves are safe. Deaths should come from being out-thought, not from information the game hid.
4. **Upgrades are a slight edge.** A strong defensive kit reduces hits taken by about 12–20%. It never makes you untouchable.
5. **Short runs.** 3 acts of about 5 battles each, 15–30 minutes.

---

## 1. Board model

- The player is **White** with a single piece. When the objective is *Protect*, there is also one static white pawn (the ally), which never moves.
- There is **no white king** unless the player is the King. chess.js supports this with `skipValidation`, and `_isKingAttacked` returns `false` for a missing king.
- The enemy is **Black** and always has a king on e8. Castling rights are derived from the placement (e8 king with rooks on a8/h8).
- White moves never capture a king. This matters only after a Parry or Stasis, when Black can be left in check on White's turn.

### Turn and damage flow (`src/game/combat.ts`)

```
player move ─▶ objective check (reach / escape / promote / capture / slay)
            ─▶ enemy has no legal moves? checkmate → win (+40g) / stalemate → draw (½ gold)
            ─▶ enemy phase:
                 forced action? Stasis → skip · Smoke → random move · Mirror → mirrored move
                 else Hunter AI move
                 capture of player → Knight's Instinct → Parry → −1 HP → Second Life → respawn / death
                 capture of ally   → objective failed (−1 HP)
                 King player: checkmated → same damage chain
            ─▶ turn++ → survive/protect goal reached? win · turn limit reached? fail (−1 HP)
            ─▶ player has no legal moves → stalemate draw
```

**Respawn** (`findRespawnSquare`, `src/chess/rules.ts`) scores every empty square the enemy can't capture on:
`2 × distance to nearest enemy + 1.5 × min(safe moves, 6) − 0.5 × rank + noise`.
Pawns avoid ranks 1, 7 and 8.

---

## 2. Characters (`src/game/pieces.ts`)

| Piece | Max HP | Signature upgrade | Start squares | Unlock (Insight) |
| --- | --- | --- | --- | --- |
| Pawn | 4 | reinforced_armor | e2, d2 | 0 |
| Knight | 4 | knights_instinct | g1, b1 | 0 |
| Bishop | 4 | ghost_move | c1, f1 | 40 |
| Rook | 3 | parry | a1, h1 | 80 |
| Queen | 2 | — | d1 | 150 |
| King | 3 | time_warp | e1 | 220 |

Hardcore mode sets max HP to 1. If no start square is safe, the generator falls back to any safe square on ranks 1–2.

---

## 3. Objectives (`src/game/encounters.ts`)

`s` = 1 if the player owns Swift Feet, otherwise 0. `tier` = battles won so far this run.

| Kind | Normal battle | Weight | Restrictions |
| --- | --- | --- | --- |
| survive | `min(8 + ⌊tier/3⌋, 11) − s` turns | 4 | — |
| capture | tier < 4 or Pawn: 2 in 14 turns · otherwise 3 in 18 | 2 (Pawn 1) | — |
| kingMove | within 18 turns | 2 (King 1) | — |
| promote | within 14 turns | 3 | Pawn only |
| reach | 1 square on ranks 6–7, within 12 turns | 2 | not Pawn or King; Bishop squares match its colour |
| escape | 2 portals on rank 8, within 14 turns | 2 | same as reach |
| protect | `8 − s` turns | 2 | from tier 1 |

**Elites** pick either *survive `11 − s`* or *capture 3 (Pawn: 2) in 18*.

---

## 4. Enemy armies and difficulty

### Army generation (normal and elite)

```
strength = tier + 2 × (act − 1) + 4 × loop
budget   = 4 + 2 × strength (+7 elite)            # piece points: N/B = 3, R = 5, Q = 9
pawns    = min(3 + ⌊strength / 2⌋ (+1 elite), 8)
advanced = min(⌊strength / 3⌋, 3)                 # pawns pushed to ranks 5–6
```

Pieces are drawn with weights N 3, B 3, R 2, Q 1 while the budget allows. They go on their home squares when free, otherwise on a random square on ranks 6–8.

### Enemy Elo

```
battle = 800 + 90 × tier + 120 × (act − 1) + 300 × loop
elite  = battle + 250
bosses = Horde 1150 · Immortal 1350 · Mirror 1450 · Grandmaster 2200   (+300 × loop)
```

`loop = ⌊(act − 1) / 3⌋`, which is only non-zero in Endless mode.

### AI strength ladder (`src/ai/profiles.ts`)

The profile with the highest Elo not above the target is used.

| Elo | Depth (plies) | Noise (cp σ) | Blunder % | Time (ms) |
| --- | --- | --- | --- | --- |
| 800 | 1 | 120 | 20 | 400 |
| 900 | 2 | 90 | 14 | 500 |
| 1000 | 2 | 60 | 10 | 600 |
| 1100 | 3 | 45 | 7 | 700 |
| 1200 | 3 | 30 | 5 | 800 |
| 1300 | 3 | 20 | 3 | 900 |
| 1400 | 4 | 15 | 2 | 1100 |
| 1600 | 4 | 8 | 1 | 1300 |
| 1800 | 5 | 5 | 0 | 1600 |
| 2000 | 5 | 2 | 0 | 2000 |
| 2200 | 6 | 0 | 0 | 2600 |
| 2500 | 7 | 0 | 0 | 3200 |

These Elo numbers are design targets, not measured ratings. A "blunder" is a random legal move, excluding moves that would lose the battle outright.

### Bosses

| Boss | Army | Rule | Objective |
| --- | --- | --- | --- |
| The Horde | King + 16 pawns (ranks 5–6) + 2 knights + 2 bishops (+ queen in Endless loops) | — | Survive 12 − s |
| The Mirror | Budget 14 (+4/loop), 6 pawns, plus a black copy of the player's piece on the mirrored start square (the enemy king, when the player is the King) | After each player move, if the reflected move is legal for the Mirror, it is forced. Special moves (teleport, ghost, borrowed) are copied as rule-bending jumps. | Survive 12 − s |
| The Immortal | Budget 8 (+4/loop), 5 pawns, Immortal queen on d8 | The player can capture the queen only on a **dark** square; Riposte never destroys her. Capturing her wins instantly (+60 gold). | Survive 12 − s |
| The Grandmaster | Full standard army | Strongest AI profile | Survive 10 − s |

Bosses by act: act 1 Horde, act 2 Mirror or Immortal (50/50), act 3 Grandmaster. The cycle repeats in Endless mode.

---

## 5. Upgrades (`src/game/upgrades.ts`)

Charge scopes:

- **run:** charges never refill.
- **encounter:** one charge per battle.
- **recharge N:** after being used, the upgrade sits out the next N − 1 battles.

Cooldowns tick in `nextCooldowns` (`src/game/run.ts`) after every battle, whether it was won or lost.

| Id | Name | Rarity | Scope | Recharge | Stacks | Unlock | Effect |
| --- | --- | --- | --- | --- | --- | --- | --- |
| second_life | Second Life | rare | run | — | no | 0 | Survive a lethal hit at 1 HP |
| ghost_move | Ghost Move | uncommon | run | — | yes | 0 | Pass through pieces; sliders ≤ 3 squares, leapers ≤ 2 (Pawn: 1–2 forward); empty landing only |
| knights_instinct | Knight's Instinct | rare | encounter | 3 | no | 0 | Auto-dodge the first capture; relocate to a safe square |
| reinforced_armor | Reinforced Armor | uncommon | passive | — | no | 0 | Enemy pawns can't capture you on ranks 1–4 |
| time_warp | Time Warp | rare | encounter | 3 | no | 60 | Restore the snapshot from before your last move |
| promotion | Borrowed Crown | uncommon | encounter | 2 | no | 0 | One move as N, B or R |
| teleport | Teleport | rare | encounter | 3 | no | 0 | Any empty square within Chebyshev distance 3 |
| parry | Parry | uncommon | encounter | 2 | no | 0 | Cancel a capture; Black loses its turn |
| riposte | Riposte | rare | passive | — | no | 90 | On parry or dodge, remove the attacker if it is a P, N or B |
| iron_heart | Iron Heart | common | passive | — | yes | 0 | +1 max HP (no heal) |
| stasis | Stasis | uncommon | encounter | 2 | no | 40 | Black skips a turn; not usable while Black is in check |
| smoke_bomb | Smoke Bomb | common | encounter | — | no | 30 | Black's next move is uniformly random |
| bloodlust | Bloodlust | uncommon | encounter | — | no | 50 | Capturing a R or Q heals 1 HP (once per battle) |
| bounty | Bounty Hunter | common | passive | — | yes | 0 | +4 gold × count per capture |
| swift | Swift Feet | common | passive | — | no | 0 | Survival goals −1 turn |
| scholar | Opening Theory | common | passive | — | no | 0 | Battle gold × 1.2 |

**Offer weights by rarity:** common 55, uncommon 32, rare 13.

**Minimum rarity offered:**

| Source | Minimum rarity |
| --- | --- |
| Normal battle, Rest (train) | common |
| Elite, Forge, Treasure, Library event | uncommon |
| Boss, Altar event | rare |

Non-stackable upgrades you already own are never offered again.

**Measured edge:** `npm run balance` (in `tests/edge.sim.ts`) plays six consecutive battles with a naive bot, with and without Knight's Instinct, Parry, Armor and Swift Feet. Hits taken went from 10.5 to 9.3 for the Knight and from 3.75 to 3.0 for the Rook. That is 4 seeds per piece, so treat it as a rough indicator.

---

## 6. Economy (`src/game/run.ts`)

| Source | Gold |
| --- | --- |
| Normal battle | 18 + 2 × tier |
| Elite | 45 |
| Boss | 90 (+2 HP) |
| Stalemate | ½ of base |
| Checkmate bonus | +40 |
| Slaying the Immortal | +60 |
| Flawless (0 hits taken) | +10 |
| Opening Theory | × 1.2 (applied before Bounty and Flawless) |
| Bounty Hunter | +4 × captures × copies |
| Treasure node | 30–55 + one uncommon or better upgrade |
| Failed objective | 0 |

**Prices:** shop upgrades cost 45 / 75 / 120 by rarity, ±5–10 random. Healing costs 35 gold per HP.

**Rest:** heal `max(2, ⌈maxHp / 2⌉)`, or gain a random common upgrade.

**Act transition:** full heal.

---

## 7. Map (`src/game/map.ts`)

5 lanes and floors 0–5, then the boss on floor 6. Four random walks start from 3 distinct lanes and drift −1/0/+1 lane per floor. Nodes that land on the same square merge, which creates the branches. Every floor-5 node connects to the boss.

| Floor | Node weights |
| --- | --- |
| 0 | battle 1 |
| 1 | battle 5 · event 3 · treasure 1 |
| 2 | battle 4 · event 2 · shop 2 · forge 1 |
| 3 | battle 3 · elite 2 · event 2 · treasure 2 |
| 4 | battle 3 · elite 2 · shop 2 · forge 1 · event 1 |
| 5 | rest 4 · shop 2 · forge 2 |

Maps are seeded from the run seed and the act number, so a given run always produces the same maps.

---

## 8. Meta progression (`src/game/meta.ts`)

```
insight = 4·battles + 8·elites + 20·bosses + ⌊turns/4⌋ + 5·checkmates + 40·victory   (× 2 in Hardcore)
```

| Unlock | Cost |
| --- | --- |
| Pieces | Bishop 40 · Rook 80 · Queen 150 · King 220 |
| Upgrades | Smoke Bomb 30 · Stasis 40 · Bloodlust 50 · Time Warp 60 · Riposte 90 |
| Modes | Hardcore 60 · Endless 120 |
| Themes | Midnight 25 · Marble 40 · Emerald 50 · Ember 70 · Ivory & Slate 100 |

From the formula, a run that ends in act 1 earns roughly 15–30 Insight, so the Bishop takes one to three runs. The headless full-run simulations, where a bot wins all three acts, earned about 145–170 Insight.

---

## 9. Known rule deviations

These are deliberate, and each is limited to an upgrade or boss:

- **FEN edits.** Teleport, Ghost Move, Borrowed Crown, respawn, Parry, Stasis and Mirror jumps rewrite the position (FEN) directly and clear en-passant rights.
- **Parry and Stasis.** Either can leave Black in check on White's turn. White can never capture the king, so Black must resolve the check on its next move.
- **Draw rules.** Threefold repetition and the 50-move rule aren't tracked: positions are rebuilt from FEN, and battles are short.
