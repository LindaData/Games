import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Square } from 'chess.js';
import { requestAiMove } from './ai/client';
import { chooseMove } from './ai/search';
import { DEFAULT_DIFFICULTY, DIFFICULTY, type Difficulty } from './game/difficulty';
import {
  advanceSnail,
  applyBlackMove,
  applyWhiteMove,
  blackMoves,
  focalKing,
  newGame,
  pieceAt,
  restoreGame,
  serializeGame,
  whiteMoves,
  type GameState,
} from './game/engine';
import { rankOf } from './game/snail';
import { loadDifficulty, loadSavedGame, loadStats, recordResult, saveDifficulty, saveGame, saveStats } from './storage';
import { Board } from './ui/Board';
import { DifficultyPicker, NewGameButton } from './ui/Controls';
import { GameOverCard, HowToPlay, StatsLine } from './ui/Panels';
import { Snail } from './ui/Snail';
import { Status } from './ui/Status';

/** Pause between the computer's move and the snail starting to crawl. */
const SNAIL_PAUSE_MS = 350;
/** The snail's glide. Keep in sync with --snail-glide in index.css. */
const SNAIL_GLIDE_MS = 700;

const prefersReducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

interface AppState {
  /** Bumped on every new game so late AI replies for an old game are ignored. */
  gameId: number;
  game: GameState;
}

function init() {
  const preferred = loadDifficulty() ?? DEFAULT_DIFFICULTY;
  const restored = restoreGame(loadSavedGame());
  return { preferred, game: restored ?? newGame(preferred) };
}

export default function App() {
  const [initial] = useState(init);
  const [app, setApp] = useState<AppState>({ gameId: 1, game: initial.game });
  const [nextDifficulty, setNextDifficulty] = useState<Difficulty>(initial.preferred);
  const [selected, setSelected] = useState<Square | null>(null);
  const [crawling, setCrawling] = useState(false);
  const [overlayHidden, setOverlayHidden] = useState(false);
  const [stats, setStats] = useState(loadStats);
  // A game restored already finished was counted when it ended.
  const countedRef = useRef<number | null>(initial.game.phase === 'over' ? 1 : null);

  const { game, gameId } = app;
  const inProgress = game.phase !== 'over' && game.history.length > 0;

  // ---- persistence ----------------------------------------------------------
  useEffect(() => {
    saveGame(serializeGame(game));
  }, [game]);

  useEffect(() => {
    saveStats(stats);
  }, [stats]);

  useEffect(() => {
    if (game.phase !== 'over' || !game.result || countedRef.current === gameId) return;
    countedRef.current = gameId;
    const outcome = game.result.outcome;
    const difficulty = game.difficulty;
    setStats((s) => recordResult(s, difficulty, outcome));
  }, [game, gameId]);

  // ---- the computer's turn --------------------------------------------------
  useEffect(() => {
    if (game.phase !== 'black') return;
    let cancelled = false;
    const settings = DIFFICULTY[game.difficulty];
    const tag = { gameId, fen: game.fen, ply: game.history.length };
    requestAiMove(
      {
        fen: game.fen,
        depth: settings.aiDepth,
        randomWindow: settings.randomWindow,
        quiescence: settings.quiescence,
        seed: Math.floor(Math.random() * 2 ** 31),
      },
      tag,
    )
      .catch(() => ({ tag, result: chooseMove({ fen: game.fen, depth: 1 }) }))
      .then(({ tag: replyTag, result }) => {
        if (cancelled) return;
        setApp((cur) => {
          // Ignore replies for another game or another position (e.g. New game while thinking).
          if (
            cur.gameId !== replyTag.gameId ||
            cur.game.phase !== 'black' ||
            cur.game.fen !== replyTag.fen ||
            cur.game.history.length !== replyTag.ply
          ) {
            return cur;
          }
          try {
            return { ...cur, game: applyBlackMove(cur.game, result) };
          } catch {
            // Should never happen: the AI only plays chess.js-legal moves. Never stall regardless.
            const fallback = blackMoves(cur.game)[0];
            return fallback ? { ...cur, game: applyBlackMove(cur.game, fallback) } : cur;
          }
        });
      });
    return () => {
      cancelled = true;
    };
  }, [game, gameId]);

  // ---- the snail's crawl ----------------------------------------------------
  useEffect(() => {
    if (game.phase !== 'snail') return;
    const t = setTimeout(() => {
      setApp((cur) => (cur.gameId === gameId && cur.game === game ? { ...cur, game: advanceSnail(cur.game) } : cur));
      if (!prefersReducedMotion()) setCrawling(true);
    }, SNAIL_PAUSE_MS);
    return () => clearTimeout(t);
  }, [game, gameId]);

  useEffect(() => {
    if (!crawling) return;
    const t = setTimeout(() => setCrawling(false), SNAIL_GLIDE_MS);
    return () => clearTimeout(t);
  }, [crawling]);

  // ---- actions --------------------------------------------------------------
  const startNewGame = useCallback((difficulty: Difficulty) => {
    setApp((cur) => ({ gameId: cur.gameId + 1, game: newGame(difficulty) }));
    setSelected(null);
    setCrawling(false);
    setOverlayHidden(false);
  }, []);

  const onDifficulty = (d: Difficulty) => {
    setNextDifficulty(d);
    saveDifficulty(d);
    // Before the first move a change restarts right away; mid-game it waits for the next game.
    if (game.history.length === 0 && d !== game.difficulty) startNewGame(d);
  };

  const canMove = game.phase === 'white' && !crawling;
  const targets = useMemo(
    () => (selected && canMove ? whiteMoves(game).filter((m) => m.from === selected) : []),
    [selected, canMove, game],
  );

  const onSquare = (sq: Square) => {
    if (!canMove) return;
    if (selected) {
      const move = targets.find((m) => m.to === sq);
      if (move) {
        setApp((cur) => (cur.game === game ? { ...cur, game: applyWhiteMove(cur.game, move) } : cur));
        setSelected(null);
        return;
      }
    }
    const piece = pieceAt(game, sq);
    if (piece?.color === 'w' && sq !== selected) setSelected(sq);
    else setSelected(null);
  };

  const showOverlay = game.phase === 'over' && !crawling && !overlayHidden;

  return (
    <main className="mx-auto w-full max-w-[1040px] px-4 pb-10 pt-4 sm:pt-6">
      <header className="mx-auto mb-3 flex max-w-[560px] items-center gap-3 lg:mx-0 lg:max-w-none">
        <Snail className="h-12 w-12 shrink-0" />
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold leading-tight sm:text-2xl">Immortal Snail Chess</h1>
          <p className="text-sm text-muted">Checkmate the computer before the snail touches your king.</p>
        </div>
      </header>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-6">
        <section className="mx-auto flex w-full max-w-[560px] shrink-0 flex-col gap-3 lg:mx-0" aria-label="Game">
          <Board
            game={game}
            gameId={gameId}
            selected={canMove ? selected : null}
            targets={targets}
            crawling={crawling}
            onSquare={onSquare}
          >
            {showOverlay && (
              <GameOverCard
                game={game}
                stats={stats}
                placement={rankOf(focalKing(game)) < 4 ? 'top' : 'bottom'}
                onPlayAgain={() => startNewGame(nextDifficulty)}
                onHide={() => setOverlayHidden(true)}
              />
            )}
          </Board>
          <Status game={game} crawling={crawling} />
        </section>

        <aside className="mx-auto flex w-full max-w-[560px] flex-col gap-3 lg:mx-0 lg:max-w-[400px] lg:flex-1">
          <div className="panel flex flex-col gap-3 p-3">
            <NewGameButton inProgress={inProgress} onNewGame={() => startNewGame(nextDifficulty)} />
            <DifficultyPicker
              value={nextDifficulty}
              current={game.difficulty}
              inProgress={inProgress || game.phase === 'over'}
              onChange={onDifficulty}
            />
          </div>
          <HowToPlay />
          <StatsLine stats={stats} />
        </aside>
      </div>
    </main>
  );
}
