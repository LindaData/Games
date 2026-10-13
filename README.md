# Games
Indie game ideas

## Projects

- [**Dungeon HR**](dungeon-hr/): a browser management game where you run Human (and Inhuman) Resources for a fantasy dungeon. React + TypeScript + Vite.
- [**Chess Survivor**](chess-survivor/): a roguelike where you are one chess piece trapped inside a real chess game. React + TypeScript + Vite, chess.js rules, custom Web Worker AI.
- [**Immortal Snail Chess**](immortal-snail/): plain chess against the computer while an unkillable bronze snail crawls toward your king. If it touches you, you lose. React + TypeScript + Vite, chess.js rules, Web Worker AI.

```bash
npm install
npm run dev     # runs Dungeon HR

# Chess Survivor has its own dependencies:
cd chess-survivor && npm install && npm run dev
# or, from the repo root:
npm run chess:install && npm run chess:dev

# Immortal Snail Chess also has its own dependencies:
cd immortal-snail && npm install && npm run dev
# or, from the repo root:
npm run snail:install && npm run snail:dev
```
