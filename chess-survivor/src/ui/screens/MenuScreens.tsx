import { useState } from 'react';
import type { PieceSymbol } from 'chess.js';
import { ArrowLeft, Brain, Heart, Lock, Palette, Play, RotateCcw, Sparkles, Trophy } from 'lucide-react';
import { BOSSES } from '../../game/encounters';
import { MODES, THEMES, isUnlocked, type MetaState, type ModeId, type ThemeId, type Unlockable } from '../../game/meta';
import { CHARACTERS } from '../../game/pieces';
import type { RunState } from '../../game/run';
import { UPGRADES, type UpgradeId } from '../../game/upgrades';
import { UpgradeIcon } from '../components/Icon';
import { PieceIcon } from '../components/PieceIcon';
import { RARITY_COLOR } from '../components/UpgradeCard';

const PIECE_ORDER: PieceSymbol[] = ['p', 'n', 'b', 'r', 'q', 'k'];

export function TitleScreen({
  meta,
  hasRun,
  runInProgress,
  onContinue,
  onNew,
  onUnlocks,
  onHowTo,
}: {
  meta: MetaState;
  hasRun: boolean;
  /** A run that would be lost by starting over: asks for a second click first. */
  runInProgress: boolean;
  onContinue: () => void;
  onNew: () => void;
  onUnlocks: () => void;
  onHowTo: () => void;
}) {
  const [armed, setArmed] = useState(false);
  return (
    <div className="min-h-[88vh] flex flex-col items-center justify-center text-center fade-in">
      <div className="flex items-end gap-2 mb-6 opacity-90">
        {(['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'] as PieceSymbol[]).map((t, i) => (
          <div key={i} className="w-10 h-10 sm:w-12 sm:h-12" style={{ animation: `fadeIn .5s ${i * 0.06}s both` }}>
            <PieceIcon type={t} skin="black" />
          </div>
        ))}
      </div>
      <div className="w-24 h-24 mb-2 relative">
        <div className="absolute inset-0 rounded-full blur-2xl bg-amber-400/30" />
        <PieceIcon type="n" skin="player" className="relative" />
      </div>
      <h1 className="title-font text-5xl sm:text-7xl font-extrabold tracking-wider bg-gradient-to-b from-amber-100 to-amber-400 bg-clip-text text-transparent">Chess Survivor</h1>
      <p className="mt-3 text-[color:var(--muted)] max-w-md">You are one chess piece, trapped inside a real chess game. The whole army wants you gone. Survive.</p>
      <div className="mt-8 flex flex-col gap-3 w-64">
        {hasRun && (
          <button className="btn btn-primary" onClick={onContinue}>
            <Play size={16} /> Continue run
          </button>
        )}
        <button
          className={`btn ${hasRun ? '' : 'btn-primary'} ${armed ? '!border-red-500 !text-red-200' : ''}`}
          onClick={() => {
            if (runInProgress && !armed) setArmed(true);
            else onNew();
          }}
          onBlur={() => setArmed(false)}
        >
          <RotateCcw size={16} /> {armed ? 'Abandon current run? Click again' : 'New run'}
        </button>
        <button className="btn" onClick={onUnlocks}>
          <Sparkles size={16} /> Unlocks <span className="text-amber-300 text-xs">({meta.insight} insight)</span>
        </button>
        <button className="btn btn-ghost" onClick={onHowTo}>
          How to play
        </button>
      </div>
      <div className="mt-8 text-xs text-[color:var(--muted)] flex gap-4">
        <span>Runs: {meta.stats.runs}</span>
        <span>Wins: {meta.stats.wins}</span>
        <span>Best: {meta.stats.bestBattles} battles</span>
      </div>
    </div>
  );
}

export function CharacterSelect({ meta, onStart, onBack }: { meta: MetaState; onStart: (p: PieceSymbol, mode: ModeId) => void; onBack: () => void }) {
  const [piece, setPiece] = useState<PieceSymbol>(meta.pieces[0] ?? 'p');
  const [mode, setMode] = useState<ModeId>('standard');
  const ch = CHARACTERS[piece];
  return (
    <div className="max-w-5xl mx-auto fade-in">
      <button className="btn btn-ghost mb-4" onClick={onBack}>
        <ArrowLeft size={16} /> Back
      </button>
      <div className="title-font text-3xl mb-1">Choose your piece</div>
      <div className="text-[color:var(--muted)] mb-6">Each piece is a different survivor with its own movement, HP and fantasy.</div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {PIECE_ORDER.map((p) => {
          const unlocked = meta.pieces.includes(p);
          const c = CHARACTERS[p];
          return (
            <button
              key={p}
              disabled={!unlocked}
              onClick={() => setPiece(p)}
              className={`panel p-3 flex flex-col items-center gap-1 transition ${piece === p ? '!border-amber-400 shadow-[0_0_0_1px_#f5c451]' : 'hover:!border-zinc-500'} disabled:opacity-40`}
            >
              <div className="w-14 h-14 relative">
                <PieceIcon type={p} skin={unlocked ? 'player' : 'black'} />
                {!unlocked && <Lock size={16} className="absolute right-0 bottom-0 text-zinc-400" />}
              </div>
              <div className="text-sm font-semibold">{c.name}</div>
              <div className="text-[11px] text-[color:var(--muted)]">{unlocked ? `${c.maxHp} HP` : `${c.unlockCost} insight`}</div>
            </button>
          );
        })}
      </div>
      <div className="panel p-5 mt-5 grid md:grid-cols-[1fr_auto] gap-5 items-center">
        <div>
          <div className="title-font text-2xl">
            {ch.name} <span className="text-base text-[color:var(--muted)] font-sans">— {ch.title}</span>
          </div>
          <p className="text-[color:var(--muted)] mt-1">{ch.blurb}</p>
          <div className="mt-3 flex gap-3 flex-wrap text-sm">
            <span className="chip">
              <Heart size={13} className="text-rose-400" /> {mode === 'hardcore' ? 1 : ch.maxHp} HP
            </span>
            <span className="chip">{ch.perk}</span>
          </div>
        </div>
        <div className="flex flex-col gap-2 min-w-[220px]">
          <div className="text-xs uppercase tracking-wider text-[color:var(--muted)]">Mode</div>
          {(Object.keys(MODES) as ModeId[]).map((m) => {
            const unlocked = meta.modes.includes(m);
            return (
              <button key={m} disabled={!unlocked} onClick={() => setMode(m)} className={`btn !justify-start text-sm ${mode === m ? '!border-amber-400' : ''}`} title={MODES[m].desc}>
                {!unlocked && <Lock size={13} />} {MODES[m].name}
              </button>
            );
          })}
          <button className="btn btn-primary mt-2" onClick={() => onStart(piece, mode)} disabled={!meta.pieces.includes(piece)}>
            <Play size={16} /> Begin run
          </button>
        </div>
      </div>
    </div>
  );
}

export function UnlocksScreen({ meta, onUnlock, onTheme, onBack }: { meta: MetaState; onUnlock: (u: Unlockable, cost: number) => void; onTheme: (t: ThemeId) => void; onBack: () => void }) {
  const upgrades = (Object.keys(UPGRADES) as UpgradeId[]).filter((id) => UPGRADES[id].unlockCost > 0);
  const Buy = ({ u, cost }: { u: Unlockable; cost: number }) =>
    isUnlocked(meta, u) ? (
      <span className="text-xs text-emerald-400">Unlocked</span>
    ) : (
      <button className="btn text-xs !py-1 !px-2.5" disabled={meta.insight < cost} onClick={() => onUnlock(u, cost)}>
        <Lock size={12} /> {cost}
      </button>
    );
  return (
    <div className="max-w-5xl mx-auto fade-in">
      <button className="btn btn-ghost mb-4" onClick={onBack}>
        <ArrowLeft size={16} /> Back
      </button>
      <div className="flex items-end justify-between mb-6 flex-wrap gap-2">
        <div>
          <div className="title-font text-3xl">Unlocks</div>
          <div className="text-[color:var(--muted)]">Spend Insight earned from runs on permanent unlocks.</div>
        </div>
        <div className="chip !text-base !px-4 !py-1.5 text-amber-300">
          <Brain size={16} /> {meta.insight} insight
        </div>
      </div>

      <section className="mb-8">
        <div className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-3">Starting pieces</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {PIECE_ORDER.map((p) => (
            <div key={p} className="panel p-3 flex flex-col items-center gap-2">
              <div className="w-12 h-12">
                <PieceIcon type={p} skin={meta.pieces.includes(p) ? 'player' : 'black'} />
              </div>
              <div className="text-sm font-semibold">{CHARACTERS[p].name}</div>
              <Buy u={{ kind: 'piece', id: p }} cost={CHARACTERS[p].unlockCost} />
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <div className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-3">Upgrades added to the pool</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {upgrades.map((id) => (
            <div key={id} className="panel p-3 flex items-start gap-3">
              <div style={{ color: RARITY_COLOR[UPGRADES[id].rarity] }} className="mt-0.5">
                <UpgradeIcon id={id} size={20} />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm">{UPGRADES[id].name}</div>
                <div className="text-xs text-[color:var(--muted)]">{UPGRADES[id].desc}</div>
              </div>
              <Buy u={{ kind: 'upgrade', id }} cost={UPGRADES[id].unlockCost} />
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <div className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-3">Game modes</div>
        <div className="grid sm:grid-cols-3 gap-3">
          {(Object.keys(MODES) as ModeId[]).map((m) => (
            <div key={m} className="panel p-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{MODES[m].name}</div>
                <Buy u={{ kind: 'mode', id: m }} cost={MODES[m].cost} />
              </div>
              <div className="text-xs text-[color:var(--muted)] mt-1">{MODES[m].desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <div className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-3 flex items-center gap-2">
          <Palette size={14} /> Board themes
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {(Object.keys(THEMES) as ThemeId[]).map((t) => {
            const th = THEMES[t];
            const owned = meta.themes.includes(t);
            return (
              <div key={t} className={`panel p-3 flex flex-col items-center gap-2 ${meta.theme === t ? '!border-amber-400' : ''}`}>
                <div className="grid grid-cols-4 w-16 h-16 rounded overflow-hidden">
                  {Array.from({ length: 16 }, (_, i) => (
                    <div key={i} style={{ background: (i + Math.floor(i / 4)) % 2 ? th.dark : th.light }} />
                  ))}
                </div>
                <div className="text-sm">{th.name}</div>
                {owned ? (
                  <button className="btn text-xs !py-1 !px-2.5" disabled={meta.theme === t} onClick={() => onTheme(t)}>
                    {meta.theme === t ? 'Equipped' : 'Equip'}
                  </button>
                ) : (
                  <Buy u={{ kind: 'theme', id: t }} cost={th.cost} />
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export function HowToScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="max-w-3xl mx-auto fade-in">
      <button className="btn btn-ghost mb-4" onClick={onBack}>
        <ArrowLeft size={16} /> Back
      </button>
      <div className="title-font text-3xl mb-4">How to play</div>
      <div className="panel p-6 space-y-4 text-[15px] leading-relaxed">
        <p>
          <b className="text-amber-300">You control one piece.</b> The rest of the board — a real chess army — is played by an AI whose only goal is to hunt you down. Every move you
          and the enemy make follows standard chess rules (check, castling, en passant, promotion, stalemate) unless an upgrade says otherwise.
        </p>
        <p>
          <b className="text-amber-300">Survive and complete the objective.</b> Each battle has a goal: survive N turns, reach a square, escape through a portal, capture pieces,
          protect an ally, promote, or force the enemy king to move. A turn is your move plus the enemy reply.
        </p>
        <p>
          <b className="text-amber-300">Getting captured</b> costs 1 HP and you reform on a safe square. At 0 HP the run ends. As the King you can't be captured — only checkmate
          hurts you. Failing a timed objective also costs 1 HP. Checkmating the enemy king ends the battle with a bonus. If either side has no legal moves, the battle ends in a
          stalemate (you escape with half gold).
        </p>
        <p>
          <b className="text-amber-300">Read the board.</b> Teal dots are safe moves, red dots are squares where you'd be capturable. Red stripes show everything the enemy
          attacks, and dashed red arrows point from pieces that can capture you right now. Hover any enemy piece to see its reach.
        </p>
        <p>
          <b className="text-amber-300">Build your run.</b> After battles pick one of three upgrades. Travel the branching map through battles, elites, events, shops, forges and
          campfires. Each act ends with a boss: {Object.values(BOSSES).map((b) => b.name).join(', ')}.
        </p>
        <p>
          <b className="text-amber-300">Meta progression.</b> Runs earn Insight, which unlocks new pieces, upgrades, modes and board themes.
        </p>
        <p className="text-sm text-[color:var(--muted)]">Shortcut: Esc cancels an ability targeting mode.</p>
      </div>
    </div>
  );
}

export function EndScreen({ run, onDone }: { run: RunState; onDone: () => void }) {
  const victory = run.screen === 'victory';
  const mins = Math.max(1, Math.round(((run.endedAt ?? Date.now()) - run.startedAt) / 60000));
  return (
    <div className="min-h-[80vh] grid place-items-center fade-in">
      <div className="panel p-8 w-[min(520px,94vw)] text-center">
        <div className={`inline-grid place-items-center w-16 h-16 rounded-2xl mb-3 ${victory ? 'bg-amber-900/40 text-amber-300' : 'bg-red-950/60 text-red-400'}`}>
          {victory ? <Trophy size={30} /> : <div className="w-10 h-10"><PieceIcon type={run.piece} skin="black" /></div>}
        </div>
        <div className="title-font text-4xl">{victory ? 'You Survived' : 'Captured'}</div>
        <p className="text-[color:var(--muted)] mt-2">
          {victory ? 'The Grandmaster tips over their king. One piece outlasted an entire army.' : `Your ${CHARACTERS[run.piece].name.toLowerCase()} falls in Act ${run.act}.`}
        </p>
        <div className="grid grid-cols-3 gap-3 mt-6 text-sm">
          <Stat label="Battles won" value={run.stats.battlesWon} />
          <Stat label="Turns survived" value={run.stats.turns} />
          <Stat label="Captures" value={run.stats.captures} />
          <Stat label="Elites" value={run.stats.elitesWon} />
          <Stat label="Bosses" value={run.stats.bossesWon} />
          <Stat label="Minutes" value={mins} />
        </div>
        <div className="mt-6 text-amber-300 font-semibold flex items-center justify-center gap-2">
          <Brain size={18} /> +{run.insightEarned ?? 0} insight
        </div>
        <button className="btn btn-primary mt-6 w-full" onClick={onDone}>
          Return to title
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-[#1a1d28] border border-[color:var(--line)] p-3">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-[11px] text-[color:var(--muted)]">{label}</div>
    </div>
  );
}
