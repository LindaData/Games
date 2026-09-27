# Chess Survivor — Player Guide

You are one chess piece. Everything else on the board is an enemy army played by a chess AI, and its only goal is to catch you. You don't win by checkmating anyone. You win by surviving long enough to finish each battle's objective, getting stronger between battles, and beating three bosses.

A full run takes 15–30 minutes.

---

## 1. Starting a run

1. On the title screen, click **New run**. If a run is already in progress, the button asks you to click again before it abandons that run.
2. Pick a **piece** and a **mode**, then click **Begin run**.
3. Your run is saved in the browser after every action. Close the tab and come back later with **Continue run**.

### The pieces

| Piece | HP | Starts with | How it plays |
| --- | --- | --- | --- |
| **Pawn** | 4 | Reinforced Armor | Slow and easily blocked, but enemy pawns can't hurt it on its own half. If it reaches the 8th rank it promotes and keeps the new piece for the rest of the battle. |
| **Knight** | 4 | Knight's Instinct | Jumps over pieces. The best piece for learning the game. |
| **Bishop** | 4 | Ghost Move | Fast along diagonals but can only ever reach squares of one colour. |
| **Rook** | 3 | Parry | Crosses the board in one move. Strong on open files. |
| **Queen** | 2 | — | Moves anywhere, but has only 2 HP and no starting upgrade. |
| **King** | 3 | Time Warp | Can't be captured, only checkmated. Chess rules stop it from moving into check. |

Pawn and Knight are available from the start. The others are unlocked with Insight (see §7).

### Modes

- **Standard**: three acts; beat the Grandmaster to win.
- **Hardcore** (unlockable): 1 max HP, double Insight.
- **Endless** (unlockable): the acts never end and the enemy gets stronger each time the three-act cycle repeats.

---

## 2. Reading the battle screen

The screen has three columns: your piece on the left, the board in the centre, the battle on the right.

**Left panel: you.** Your HP, a *Safe for now* / *In danger!* banner, the number of safe moves you have, your abilities (buttons) and your passive upgrades.

**Centre: the board.** You play White at the bottom. Your piece glows and shows its HP as small hearts above it.

| You see | It means |
| --- | --- |
| Teal dot | A legal move where you **can't** be captured next turn |
| Red dot | A legal move where you **can** be captured next turn |
| Ring instead of a dot | The move captures an enemy piece |
| Red diagonal stripes | Every square the enemy currently attacks |
| Dashed red arrow | An enemy piece that can capture you **right now** |
| Red glow on your piece | You are in danger this turn |
| Yellow square | The last move played |
| Gold-bordered square with a flag | Objective square to reach |
| Blue glowing squares | Escape portals |
| Blue piece with a shield | Your ally (Protect objectives) |
| Purple queen with ∞ | The Immortal (boss) |
| Grey dashed piece | The Mirror (boss) |

Hover over any enemy piece to see every square it attacks. The red dots are exact: the game plays your move, then checks every legal enemy reply, so pinned enemy pieces aren't counted as threats.

**Right panel: the battle.** The battle's name, the enemy's approximate **Elo** (its strength), the objective with a progress bar, and a log of every move. Two toggles sit at the top of the log: **motion** (animations on or off) and **danger map** (red stripes on or off).

---

## 3. How a battle works

- **A turn** is your move followed by the enemy's reply.
- Every move follows standard chess rules: check, castling, en passant, promotion and stalemate all work. Only your upgrades and some boss rules can bend them.
- You can **give check**. The enemy must answer it, which is a strong way to buy time. If the enemy king is **checkmated**, you win the battle immediately and earn +40 gold.

### Objectives

| Objective | You win when… | Fails when… |
| --- | --- | --- |
| Survive N turns | N enemy turns have passed | — |
| Reach a square | Your piece stands on the flagged square | The turn limit runs out |
| Escape | You step onto a portal | The turn limit runs out |
| Capture N pieces | You've captured N enemies | The turn limit runs out |
| Protect your ally | N turns pass with your ally alive | The ally is captured |
| Promote (Pawn only) | Your pawn reaches the 8th rank | The turn limit runs out |
| Force the king to move | The enemy king moves (e.g. because you gave check) | The turn limit runs out |

### Damage and death

- **Captured:** you lose 1 HP and reappear on the safest empty square nearby. The battle continues.
- **King player:** you can't be captured. Checkmate costs 1 HP, and then you reappear.
- **Failing an objective:** you lose 1 HP and leave the battle with no reward.
- **0 HP:** the run is over.

### Stalemate

If either side has no legal moves and isn't in check, the battle ends in a draw. You escape, but get only half the gold. This happens most often to a Pawn blocked head-on by an enemy pawn.

---

## 4. Abilities and upgrades

After most battles you choose **one of three upgrades**. Upgrades give a slight edge, not a safety net.

- **Active abilities** appear as buttons in the left panel. Click one and the board shows the special moves it allows. Press **Esc** or click ✕ to cancel.
- **Passive upgrades** work on their own.
- **Recharging upgrades** can only be used once every 2 or 3 battles. While one is recharging, it's greyed out and labelled *recharging*. The map bar shows how many battles until it's back.

| Upgrade | How often | Effect |
| --- | --- | --- |
| Second Life | once per run | The first capture that would take you to 0 HP leaves you at 1 HP |
| Ghost Move | once per run | Slide up to 3 squares through pieces (other pieces: step up to 2); must land on an empty square |
| Knight's Instinct | every 3 battles | Dodge the first capture of the battle and leap to a safe square |
| Reinforced Armor | always | Enemy pawns can't capture you while you're on ranks 1–4 |
| Time Warp | every 3 battles | Undo your last move and the enemy's reply |
| Borrowed Crown | every 2 battles | For one move, move as a Knight, Bishop or Rook |
| Teleport | every 3 battles | Jump to an empty square within 3 squares |
| Parry | every 2 battles | Survive a capture; the attacker is knocked back and loses its turn |
| Riposte | always | Parry and dodge also destroy an attacking pawn, knight or bishop |
| Stasis | every 2 battles | The enemy skips its next turn (not while its king is in check) |
| Smoke Bomb | every battle | The enemy's next move is random (it can still capture you) |
| Bloodlust | every battle | Capturing a Rook or Queen heals 1 HP |
| Iron Heart | always | +1 max HP |
| Bounty Hunter | always | +4 gold per capture |
| Swift Feet | always | Survival objectives need 1 fewer turn |
| Opening Theory | always | +20% gold from battles |

When a capture would hit you, protections trigger in this order: **Knight's Instinct → Parry → lose 1 HP → Second Life**.

---

## 5. The map

Each act is a branching map read from bottom to top: 6 floors of choices, then a boss. Highlighted nodes are the ones you can move to next. Hover over a node for details.

| Node | What happens |
| --- | --- |
| ⚔ Battle | A normal fight |
| ☠ Elite | A stronger army (+250 Elo) with better upgrade choices |
| ♛ Boss | The end of the act |
| ◆ Treasure | Gold plus a free upgrade |
| 🔨 Forge | Choose 1 of 3 upgrades (uncommon or better), free |
| 🔥 Rest | Heal (half your max HP, at least 2) **or** train for a random upgrade |
| ? Event | A short story with a choice (see below) |
| 🏪 Shop | Buy upgrades (45 / 75 / 120 gold by rarity) or 1 HP for 35 gold |

### Events

| Event | Choices |
| --- | --- |
| The Wandering Bishop | Pay 30 gold to heal 2 HP · Ask for wisdom (Opening Theory, or 25 gold if you have it) |
| The Cursed Altar | Lose 1 max HP for a random rare upgrade |
| A Gambit | 50%: +60 gold, 50%: −1 HP |
| Fountain of Promotion | +1 max HP **or** +40 gold |
| The Rook Smith | Reinforced Armor for 50 gold · Parry for 40 gold |
| The Fallen Pawn | Second Life for 20 gold · heal 1 HP |
| The Endgame Library | Lose 1 HP for a random uncommon upgrade |

---

## 6. Bosses

| Act | Boss | What to expect |
| --- | --- | --- |
| 1 | **The Horde** | 16 pawns packed on ranks 5–6 with knights and bishops behind them. Survive 12 turns. |
| 2 | **The Mirror** | A shadow copy of your piece copies each move you make, reflected across the board, including your abilities. Survive 12 turns. |
| 2 | **The Immortal** (alternative) | A queen who can only be captured while she stands on a **dark** square. Capture her for an instant win, or survive 12 turns. |
| 3 | **The Grandmaster** | A full standard chess army at maximum strength (~2200 Elo). Survive 10 turns. |

Beating a boss heals 2 HP, offers rare upgrades, and fully heals you at the start of the next act. If you fail a boss objective, you lose 1 HP and must fight the boss again.

---

## 7. Between runs: Insight and unlocks

When a run ends, you earn **Insight**:

- 4 per battle won
- 8 per elite
- 20 per boss
- 1 per 4 turns survived
- 5 per checkmate
- 40 for winning the run

Hardcore mode doubles the total. Spend it under **Unlocks** on the title screen:

| Unlock | Cost |
| --- | --- |
| Bishop / Rook / Queen / King | 40 / 80 / 150 / 220 |
| Smoke Bomb / Stasis / Bloodlust / Time Warp / Riposte (added to the upgrade pool) | 30 / 40 / 50 / 60 / 90 |
| Hardcore / Endless mode | 60 / 120 |
| Board themes (Midnight, Marble, Emerald, Ember, Ivory & Slate) | 25–100 |

---

## 8. Tips

- **Prefer teal dots.** A red dot isn't always a mistake: it can be right when you have Parry, or when stepping there completes the objective.
- **Check is your best defence.** A checking move forces the enemy to spend its turn on its king.
- **Stay out of the stripes.** Surviving is about keeping your safe-move count high. The number in the left panel tells you how boxed in you are.
- **Early enemies blunder.** Battles start around 800 Elo and the AI sometimes misses things. From about 1400 Elo it rarely does.
- **Save recharging abilities for elites and bosses.** Using one in an easy battle can leave it unavailable when you really need it.
