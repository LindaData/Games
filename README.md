# Games
Indie game ideas

## Projects

- [**Dungeon HR**](dungeon-hr/): a browser management game where you run Human (and Inhuman) Resources for a fantasy dungeon. React + TypeScript + Vite.
- [**Chess Survivor**](chess-survivor/): a roguelike where you are one chess piece trapped inside a real chess game. React + TypeScript + Vite, chess.js rules, custom Web Worker AI.
- [**Snailmate Chess**](immortal-snail/) ([play it](https://snailmate-chess.vercel.app)): plain chess against the computer with two immortal snails. Your green snail hunts their king, their bronze snail hunts yours, and every 3 turns both crawl one square. A snail that reaches a king wins for its side. Three modes: **Ghost** (snails slide over pieces), **Hungry** (snails eat enemy pieces they crawl onto) and **Sacrifice** (give up one of your pieces; your snail starts in its place). React + TypeScript + Vite, chess.js rules, Web Worker AI. Installs to the iPhone home screen and plays offline; Share button, controller support.
  - [Desktop app](immortal-snail/desktop/) (Electron, Windows / Linux / macOS) and a [Steam release kit](immortal-snail/steam/) (store copy, art, screenshots, SteamPipe upload scripts and a step-by-step checklist).

```bash
npm install
npm run dev     # runs Dungeon HR

# Chess Survivor has its own dependencies:
cd chess-survivor && npm install && npm run dev
# or, from the repo root:
npm run chess:install && npm run chess:dev

# Snailmate Chess (folder immortal-snail/) also has its own dependencies:
cd immortal-snail && npm install && npm run dev
# or, from the repo root:
npm run snail:install && npm run snail:dev

# Snailmate Chess as a desktop app (Electron):
cd immortal-snail/desktop && npm install
npm run build:web && npm start   # build the game into the app and run it
npm run dist:linux               # or dist:win / dist:mac: builds in immortal-snail/desktop/release/
# or, from the repo root:
npm run snail:desktop:install && npm run snail:desktop
npm run snail:desktop:dist       # a release build for this OS
```

Getting Snailmate Chess on Steam: follow the checklist in
[`immortal-snail/steam/README.md`](immortal-snail/steam/README.md). The owner's whole to-do list is
[`OWNER_TODO.md`](OWNER_TODO.md).
