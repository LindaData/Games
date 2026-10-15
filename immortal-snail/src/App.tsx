import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Square } from 'chess.js';
import { requestAiMove } from './ai/client';
import { chooseMove, type AiRequest } from './ai/search';
import {
  applyBlackMove,
  applyWhiteMove,
  blackMoves,
  canSacrifice,
  crawlSnails,
  focalKing,
  newGame,
  pieceAt,
  startSacrifice,
  whiteMoves,
  type GameState,
} from './game/engine';
import { AI_SETTINGS, type Mode } from './game/settings';
import { rankOf, turnsUntilCrawl } from './game/snail';
import { loadAllStats, loadGame, loadMode, recordResult, saveGame, saveMode, saveStats } from './storage';
import { Board } from './ui/Board';
import { NewGameButton } from './ui/Controls';
import { GameOverCard, ModePicker, RulesCard, SnailPair, StatsLine } from './ui/Panels';
import { SacrificePanel, Status } from './ui/Status';
import { MODE_INFO } from './ui/text';

/** Pause between the computer's move and the snails starting to crawl. */
const SNAIL_PAUSE_MS = 350;
/** The snails' glide. Keep in sync with --snail-glide in index.css. */
const SNAIL_GLIDE_MS = 700;
/** A glide that ends in a Hungry snail's chomp. Keep in sync with the .chomp animation in index.css. */
const CHOMP_MS = 1100;

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

/**
 * The start screen (mode picker): opens by itself when there is no saved game ('first': a mode
 * must be picked), and from New game ('open': it can be closed to keep playing).
 */
type PickerState = 'first' | 'open' | 'closed';

/**
 * Where the game-over card sits: in the half of the board away from the king the result is about,
 * or in the middle when both snails struck (both knocked-over kings, ranks 1 and 8, stay visible).
 */
function cardPlacement(game: GameState): 'top' | 'middle' | 'bottom' {
  if (game.result?.cause === 'snail-draw') return 'middle';
  return rankOf(focalKing(game)) < 4 ? 'top' : 'bottom';
}

/** On load: the saved game, or the start screen over a fresh game of the last mode. */
function boot(): { game: GameState; picker: PickerState } {
  const saved = loadGame();
  return saved ? { game: saved, picker: 'closed' } : { game: newGame(loadMode()), picker: 'first' };
}

export default function App() {
  const [initial] = useState(boot);
  const [app, setApp] = useState<AppState>({ gameId: 1, game: initial.game });
  const [picker, setPicker] = useState<PickerState>(initial.picker);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [selected, setSelected] = useState<Square | null>(null);
  /** Sacrifice setup: the piece picked to give up. */
  const [pick, setPick] = useState<Square | null>(null);
  const [kingTapped, setKingTapped] = useState(false);
  const [crawling, setCrawling] = useState(false);
  const [overlayHidden, setOverlayHidden] = useState(false);
  const [stats, setStats] = useState(loadAllStats);
  // A game restored already finished was counted when it ended.
  const countedRef = useRef<number | null>(app.game.phase === 'over' ? 1 : null);

  const { game, gameId } = app;
  const mode = game.mode;
  const inProgress = game.phase !== 'over' && game.history.length > 0;

  // ---- persistence ----------------------------------------------------------
  // Nothing is saved until a mode is picked, so the start screen opens again on the next visit.
  useEffect(() => {
    if (picker !== 'first') saveGame(game);
  }, [game, picker]);

  useEffect(() => {
    saveStats(mode, stats[mode]);
  }, [stats, mode]);

  useEffect(() => {
    if (game.phase !== 'over' || !game.result || countedRef.current === gameId) return;
    countedRef.current = gameId;
    const { mode: m, result } = game;
    setStats((s) => ({ ...s, [m]: recordResult(s[m], result.outcome) }));
  }, [game, gameId]);

  // ---- the computer's turn --------------------------------------------------
  useEffect(() => {
    if (game.phase !== 'black' || !game.snails) return;
    let cancelled = false;
    const tag = { gameId, fen: game.fen, ply: game.history.length };
    const req: AiRequest = { fen: game.fen, ...AI_SETTINGS, snails: game.snails, mode: game.mode, crawlIn: turnsUntilCrawl(game.turn) };
    requestAiMove({ ...req, seed: Math.floor(Math.random() * 2 ** 31) }, tag)
      .catch(() => ({ tag, result: chooseMove(req) }))
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
            // Should never happen: the AI only plays allowed moves. Never stall regardless.
            const fallback = blackMoves(cur.game)[0];
            return fallback ? { ...cur, game: applyBlackMove(cur.game, fallback) } : cur;
          }
        });
      });
    return () => {
      cancelled = true;
    };
  }, [game, gameId]);

  // ---- the snails' crawl ----------------------------------------------------
  useEffect(() => {
    if (game.phase !== 'crawl') return;
    const t = setTimeout(() => {
      setApp((cur) => (cur.gameId === gameId && cur.game === game ? { ...cur, game: crawlSnails(cur.game) } : cur));
      if (!prefersReducedMotion()) setCrawling(true);
    }, SNAIL_PAUSE_MS);
    return () => clearTimeout(t);
  }, [game, gameId]);

  const crawlMs = game.lastCrawl?.eats.length ? CHOMP_MS : SNAIL_GLIDE_MS;
  useEffect(() => {
    if (!crawling) return;
    const t = setTimeout(() => setCrawling(false), crawlMs);
    return () => clearTimeout(t);
  }, [crawling, crawlMs]);

  // ---- actions --------------------------------------------------------------
  const startGame = useCallback((m: Mode) => {
    setApp((cur) => ({ gameId: cur.gameId + 1, game: newGame(m) }));
    setSelected(null);
    setPick(null);
    setKingTapped(false);
    setCrawling(false);
    setOverlayHidden(false);
  }, []);

  const pickMode = useCallback(
    (m: Mode) => {
      saveMode(m);
      setPicker('closed');
      startGame(m);
    },
    [startGame],
  );

  const closePicker = useCallback(() => setPicker('closed'), []);
  const closeRules = useCallback(() => setRulesOpen(false), []);

  const canMove = game.phase === 'white' && !crawling;
  const targets = useMemo(
    () => (selected && canMove ? whiteMoves(game).filter((m) => m.from === selected) : []),
    [selected, canMove, game],
  );

  const onSquare = (sq: Square) => {
    const piece = pieceAt(game, sq);
    if (game.phase === 'setup') {
      if (canSacrifice(game, sq)) setPick(sq);
      setKingTapped(piece?.color === 'w' && piece.type === 'k');
      return;
    }
    if (!canMove) return;
    if (selected) {
      const move = targets.find((m) => m.to === sq);
      if (move) {
        setApp((cur) => (cur.game === game ? { ...cur, game: applyWhiteMove(cur.game, move) } : cur));
        setSelected(null);
        return;
      }
    }
    if (piece?.color === 'w' && sq !== selected) setSelected(sq);
    else setSelected(null);
  };

  const onStart = () => {
    if (!canSacrifice(game, pick)) return;
    setApp((cur) => (cur.game === game ? { ...cur, game: startSacrifice(cur.game, pick) } : cur));
    setPick(null);
  };

  // While a dialog is open the game-over card waits (it would take focus from the dialog).
  const showOverlay = game.phase === 'over' && !crawling && !overlayHidden && picker === 'closed' && !rulesOpen;

  return (
    <main className="mx-auto w-full max-w-[1040px] px-4 pb-10 pt-4 sm:pt-6">
      <header className="mx-auto mb-3 flex max-w-[560px] items-center gap-3 lg:mx-0 lg:max-w-none">
        <SnailPair className="h-9 shrink-0 sm:h-12" />
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold leading-tight sm:text-2xl">Immortal Snail Chess</h1>
          <p className="text-sm text-muted">
            <strong className="text-ink">{MODE_INFO[mode].name}</strong> · Get their king before their snail gets yours.
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-6">
        <section className="relative mx-auto flex w-full max-w-[560px] shrink-0 flex-col gap-3 lg:mx-0" aria-label="Game">
          <Board
            game={game}
            gameId={gameId}
            selected={canMove ? selected : null}
            targets={targets}
            crawling={crawling}
            pick={pick}
            onSquare={onSquare}
          >
            {showOverlay && (
              <GameOverCard
                game={game}
                stats={stats[mode]}
                placement={cardPlacement(game)}
                onPlayAgain={() => startGame(mode)}
                onHide={() => setOverlayHidden(true)}
              />
            )}
          </Board>
          {game.phase === 'setup' ? (
            <SacrificePanel game={game} pick={pick} kingTapped={kingTapped} onStart={onStart} />
          ) : (
            <Status game={game} crawling={crawling} />
          )}
        </section>

        <aside className="mx-auto flex w-full max-w-[560px] flex-col gap-3 lg:mx-0 lg:max-w-[400px] lg:flex-1">
          <div className="panel flex gap-3 p-3">
            <NewGameButton inProgress={inProgress} onNewGame={() => setPicker('open')} />
            <button type="button" className="btn btn-secondary shrink-0" aria-haspopup="dialog" onClick={() => setRulesOpen(true)}>
              Rules
            </button>
          </div>
          <StatsLine mode={mode} stats={stats[mode]} />
        </aside>
      </div>

      {picker !== 'closed' && <ModePicker current={mode} onPick={pickMode} onClose={picker === 'open' ? closePicker : undefined} />}
      {rulesOpen && <RulesCard mode={mode} onClose={closeRules} />}
    </main>
  );
}
