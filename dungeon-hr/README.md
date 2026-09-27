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

No backend. Progress autosaves to `localStorage`.

## How to play

1. **Hire** monsters in *Recruitment*. Each applicant has stats (HP, ATK, DEF, SPD, INT), a salary, a one-time recruiting fee, traits and a cover letter.
2. **Assign** staff on the *Floor Plan*: drag them onto rooms, or click a staff member and then a room. The **Invasion Route** is walked left to right and ends at the **Treasure Vault**. The **Back Office** holds support facilities.
3. Read the **Incoming Visitors** briefing, then **Open for Business**. The fight plays out automatically on the security camera feed (pause, 1×/2×/4×, or skip).
4. Read the **Weekly Operations Report**: finances, performance, level-ups and *Employee Incident Reports*.
5. Clear the **HR Inbox**: raises, union demands, vacations, sick leave, feuds, resignations, performance reviews and inspections. Every decision changes morale, money or who shows up next week.
6. Spend gold and R&D points: build and upgrade rooms, buy equipment tiers, research technologies, enact (questionable) HR policies.

The first four weeks are a probation period. After that, each treasury breach costs one of three Board confidence hearts; two clean weeks in a row restore one. Lose all three and the Board stages a hostile takeover. Survive 24 weeks for the IPO, then keep going for as long as you can.

## Systems

- **Species (8):** Slime (Unpaid Intern), Goblin (Janitor), Skeleton (Security Guard), Orc (Heavy Security), Mimic (Asset Protection), Witch (R&D Researcher), Vampire (Night Shift Manager), Dragon (Chief Executive Wyrm). Each has a signature ability (taunt, reassembly, ambush, hex, lifesteal, fire breath…) and per-room job suitability grades from S to D.
- **Traits (16):** Lazy, Bloodthirsty, Union Organizer, Coward, Overachiever, Night Owl, Master of Disguise, Team Player, Lone Wolf, Gold Digger, Thick-Skinned, Glass Cannon, Quick Learner, Office Gossip, Hypochondriac and Boss's Nephew. Most are trade-offs rather than flat bonuses.
- **HR:** salary, morale (a combat multiplier), fatigue and burnout, XP and levels, promotions through five ranks, paid training, vacations, raises, termination, resignation letters, and walk-outs at zero morale.
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
  state.ts       Reducer (all player actions), new game, save/load
  autoplay.ts    Headless auto-player used for balance testing
src/components/  React screens (floor plan, staff, invasion playback, report, HR inbox…)
src/ui/          Procedural SVG avatars, icons, WebAudio sound effects, flavor text
```

The simulation runs to completion first and produces an event log, which the UI then replays. That keeps combat deterministic under a seed, testable, and skippable.
