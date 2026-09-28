# Dungeon HR

*Human (and Inhuman) Resources.*

You are the HR manager of a fantasy dungeon. Adventurers keep showing up to steal the treasure; your job is to hire, place, train, promote and emotionally support the monsters who stop them. Dungeon Keeper × Papers, Please × The Sims × a very bad corporate job.

## Run it

```bash
cd dungeon-hr
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173). From the repository root, `npm install && npm run dev` works too (npm workspace).

Other scripts:

| Command | What it does |
| --- | --- |
| `npm run build` | Typecheck and build a production bundle into `dist/` |
| `npm run preview` | Serve the production build |
| `npm test` | Run the game-logic tests, including a headless auto-player balance check |
| `npm run typecheck` | TypeScript only |

No backend. Progress autosaves to one of three save slots in `localStorage`. Saves can be exported to a `.json` file (title screen or in-game menu) and imported into any slot.

## How to play

1. **Hire** monsters on the *Hire* page. Bigger power numbers fight better. New hires go straight to the best open position.
2. Check the **Next invasion** card. It shows who's coming, your **win chance** (the fight simulated 40 times), and **Next steps** with one-tap fixes like *Auto-assign staff*, *Build a Medical Bay* or *Hire*.
3. **Open for Business.** Your staff fight room by room on their own; tap *Skip* to jump to the result.
4. Read the **weekly report**: gold, visitors stopped, staff hurt and Board mood, with a full breakdown on request.
5. Clear the **HR inbox**, either one memo at a time or with **Handle all**, which applies the ★ recommended choices.
6. Spend gold on **Upgrades**: equipment, research and HR policies.

The first 6 weeks are forgiving. After that, each treasury breach costs one of five Board hearts; two clean weeks in a row restore one. Lose them all and the Board takes over. Survive 24 weeks for the IPO, then keep going as long as you can.

## Systems

- **Species (8):** Slime (Unpaid Intern), Goblin (Janitor), Skeleton (Security Guard), Orc (Heavy Security), Mimic (Asset Protection), Witch (R&D Researcher), Vampire (Night Shift Manager), Dragon (Chief Executive Wyrm). Each has a signature ability (taunt, reassembly, ambush, hex, lifesteal, fire breath…) and per-room job suitability grades from S to D.
- **Traits (16):** Lazy, Bloodthirsty, Union Organizer, Coward, Overachiever, Night Owl, Master of Disguise, Team Player, Lone Wolf, Gold Digger, Thick-Skinned, Glass Cannon, Quick Learner, Office Gossip, Hypochondriac and Boss's Nephew. Most are trade-offs rather than flat bonuses.
- **HR:** salary, morale (a combat multiplier), fatigue and burnout, XP and levels, promotions through five ranks, paid training, vacations, raises, termination, resignation letters, and walk-outs at zero morale. The inbox has 19 memo types, including feuds, poaching, birthdays, the suggestion box, retirement, a merger offer, and audit prep that grants a one-week buff.
- **Relationships:** staff who share a room become friends (+8% each in the same room) or rivals (−8%, plus feud memos). Losing a friend hurts morale.
- **Onboarding:** a step-by-step coach guides the first week, one-time tips explain each screen, and the in-game **Handbook** covers stats, job-fit grades, traits, relationships, monsters, adventurers and rooms.
- **Rooms (14):** Hallway, Guard Post, Trap Corridor, Ambush Den, Executive Suite, Treasure Vault, Barracks, Break Room, Training Room, Medical Bay, Cafeteria, HR Office, Research Lab, Accounting. All rooms can be upgraded.
- **Adventurers:** 8 classes (Fighter, Rogue, Wizard, Cleric, Paladin, Ranger, Barbarian, Bard) with real counters. Rogues disarm traps and spot mimics, wizards fireball whole rooms, paladins smite undead, rangers hunt beasts, clerics heal and bards buff. There are 8 party archetypes, night shifts every 3rd week, and a Quarterly Audit boss wave every 8th.
- **Progression:** dungeon level → new species, rooms, slots and policies; weapon and armor tiers; 16 technologies; 12 HR policies.

## Code layout

```
src/game/        Pure, UI-free game model (unit-testable)
  data.ts        Species, traits, rooms, classes, parties, tech, policies
  employees.ts   Generation, stat math, XP, suitability
  adventurers.ts Party generation and difficulty curve
  sim.ts         Deterministic invasion simulation → replayable event log
  week.ts        End-of-week processing: payroll, morale, fatigue, XP, board
  hr.ts          HR inbox generation, options and consequences
  stories.ts     Extra memo types and one-off story events
  relations.ts   Friendships, rivalries and their effects
  save.ts        Save slots, v1→v2 migration, export/import
  state.ts       Reducer (all player actions), new game, save/load
  autoplay.ts    Headless auto-player used for balance testing
src/components/  React screens (floor plan, staff, invasion playback, report, HR inbox…)
src/ui/          Procedural SVG avatars, icons, WebAudio sound effects, flavor text
```

The simulation runs to completion first and produces an event log, which the UI then replays. That keeps combat deterministic under a seed, testable, and skippable.
