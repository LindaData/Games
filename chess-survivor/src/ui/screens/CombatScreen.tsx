import { useEffect, useMemo, useRef, useState } from 'react';
import type { PieceSymbol, Square } from 'chess.js';
import { AlertTriangle, Brain, Eye, EyeOff, ShieldCheck, Swords, Target, X } from 'lucide-react';
import { requestEnemyMove } from '../../ai/client';
import { eloLabel } from '../../ai/profiles';
import {
  buildAiRequest,
  canUse,
  dangerInfo,
  enemyAct,
  forcedEnemyAction,
  getTargets,
  playerAct,
  setMode,
  useInstant,
  type CombatState,
} from '../../game/combat';
import { BOSSES, objectiveText } from '../../game/encounters';
import type { MetaState } from '../../game/meta';
import { THEMES } from '../../game/meta';
import { PIECE_NAMES } from '../../game/pieces';
import type { RunState } from '../../game/run';
import { ACTIVE_ORDER, UPGRADES, type UpgradeId } from '../../game/upgrades';
import { Board } from '../components/Board';
import { UpgradeIcon } from '../components/Icon';
import { PieceIcon } from '../components/PieceIcon';
import { HpHearts } from '../components/RunBar';
import { UpgradeChip } from '../components/UpgradeCard';

interface Props {
  run: RunState;
  meta: MetaState;
  onCombat: (c: CombatState) => void;
  onFinish: () => void;
  onToggleDanger: () => void;
  onToggleAnimations: () => void;
}

const MIN_THINK_MS = 450;

export function CombatScreen({ run, meta, onCombat, onFinish, onToggleDanger, onToggleAnimations }: Props) {
  const combat = run.combat!;
  const theme = THEMES[meta.theme];
  const [promo, setPromo] = useState<Square | null>(null);
  const [borrowPick, setBorrowPick] = useState(false);
  const [thinking, setThinking] = useState(false);
  const aiToken = useRef<number>(-1);
  const combatRef = useRef(combat);
  combatRef.current = combat;

  const targets = useMemo(() => (combat.phase === 'player' ? getTargets(combat) : []), [combat]);
  const danger = useMemo(() => dangerInfo(combat), [combat]);

  // ---- enemy turn driver --------------------------------------------------
  useEffect(() => {
    if (combat.phase !== 'enemy') return;
    if (aiToken.current === combat.seq) return;
    const token = combat.seq;
    aiToken.current = token;
    let cancelled = false;
    setThinking(true);
    const started = Date.now();
    const rng = Math.random;
    const run = async () => {
      await new Promise((r) => setTimeout(r, 280)); // let the player's move animate
      const current = combatRef.current;
      const forced = forcedEnemyAction(current, rng);
      let ai = null;
      if (!forced) {
        try {
          ai = await requestEnemyMove(buildAiRequest(current, Math.floor(Math.random() * 1e9)));
        } catch (e) {
          console.error('AI failed, falling back to random move', e);
        }
      }
      const wait = MIN_THINK_MS - (Date.now() - started);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      if (cancelled || aiToken.current !== token) return;
      setThinking(false);
      onCombat(enemyAct(combatRef.current, ai, forced, rng));
    };
    void run();
    return () => {
      cancelled = true;
      if (aiToken.current === token) aiToken.current = -1;
    };
  }, [combat.phase, combat.seq]);

  // ---- input ---------------------------------------------------------------
  const onTarget = (sq: Square) => {
    const t = targets.find((x) => x.to === sq);
    if (!t) return;
    if (t.promotion) {
      setPromo(sq);
      return;
    }
    onCombat(playerAct(combat, sq));
  };

  const activate = (id: UpgradeId) => {
    if (!canUse(combat, id)) return;
    const mode = combat.mode;
    if (id === 'teleport') onCombat(setMode(combat, mode.kind === 'teleport' ? { kind: 'normal' } : { kind: 'teleport' }));
    else if (id === 'ghost_move') onCombat(setMode(combat, mode.kind === 'ghost' ? { kind: 'normal' } : { kind: 'ghost' }));
    else if (id === 'promotion') {
      if (mode.kind === 'borrow') onCombat(setMode(combat, { kind: 'normal' }));
      else setBorrowPick(true);
    } else onCombat(useInstant(combat, id));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPromo(null);
        setBorrowPick(false);
        if (combatRef.current.mode.kind !== 'normal') onCombat(setMode(combatRef.current, { kind: 'normal' }));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCombat]);

  // ---- derived HUD info ----------------------------------------------------
  const enc = combat.enc;
  const o = enc.objective;
  const turnGoal = o.kind === 'survive' || o.kind === 'protect' ? o.turns : 'limit' in o ? o.limit : 0;
  const progressLabel =
    o.kind === 'survive' || o.kind === 'protect'
      ? `Turn ${combat.turn} / ${turnGoal}`
      : o.kind === 'capture'
        ? `Captures ${combat.captures} / ${o.count} · Turn ${combat.turn} / ${o.limit}`
        : `Turn ${combat.turn} / ${turnGoal}`;
  const progress = o.kind === 'capture' ? combat.captures / o.count : combat.turn / Math.max(1, turnGoal);
  /** A recharging upgrade that sits out this whole battle. */
  const resting = (id: UpgradeId) => !!UPGRADES[id].recharge && (combat.initialCharges?.[id] ?? 1) === 0;
  const actives = ACTIVE_ORDER.filter((id) => (combat.owned[id] ?? 0) > 0);
  const passives = (Object.keys(combat.owned) as UpgradeId[]).filter((id) => !UPGRADES[id].active);
  const safeMoves = targets.filter((t) => !t.danger).length;
  const modeLabel =
    combat.mode.kind === 'teleport'
      ? 'Teleport: pick any empty square'
      : combat.mode.kind === 'ghost'
        ? 'Ghost Move: pass through pieces'
        : combat.mode.kind === 'borrow'
          ? `Borrowed Crown: move as a ${PIECE_NAMES[combat.mode.as]}`
          : null;
  const finished = combat.phase === 'won' || combat.phase === 'lost';

  return (
    <div className="flex flex-col xl:flex-row gap-4 items-center xl:items-start justify-center">
      {/* Left: the hunted piece */}
      <aside className="panel p-4 w-full xl:w-72 flex flex-col gap-4 order-2 xl:order-1">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-xl bg-[#241f12] border border-amber-700/40 grid place-items-center">
            <PieceIcon type={combat.playerType} skin="player" className="!w-11 !h-11" />
          </div>
          <div>
            <div className="font-semibold">You — {PIECE_NAMES[combat.playerType]}</div>
            <HpHearts hp={combat.hp} maxHp={combat.maxHp} size={15} />
          </div>
        </div>
        <div
          className={`rounded-lg px-3 py-2 text-sm flex items-center gap-2 border ${
            danger.inDanger ? 'bg-red-950/50 border-red-700/60 text-red-200 danger-pulse' : 'bg-emerald-950/30 border-emerald-800/40 text-emerald-200'
          }`}
        >
          {danger.inDanger ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />}
          {finished
            ? 'Battle over'
            : danger.inDanger
              ? `In danger! ${danger.attackers.length} attacker${danger.attackers.length === 1 ? '' : 's'}`
              : 'Safe for now'}
          {combat.phase === 'player' && <span className="ml-auto text-xs opacity-80">{safeMoves} safe moves</span>}
        </div>

        <div>
          <div className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-2">Abilities</div>
          {actives.length === 0 && <div className="text-sm text-[color:var(--muted)]">No active abilities yet. Win battles to earn upgrades.</div>}
          <div className="flex flex-col gap-2">
            {actives.map((id) => {
              const d = UPGRADES[id];
              const charges = combat.charges[id] ?? 0;
              const isActive =
                (id === 'teleport' && combat.mode.kind === 'teleport') ||
                (id === 'ghost_move' && combat.mode.kind === 'ghost') ||
                (id === 'promotion' && combat.mode.kind === 'borrow') ||
                (id === 'stasis' && combat.pendingEnemy === 'stasis') ||
                (id === 'smoke_bomb' && combat.pendingEnemy === 'smoke');
              return (
                <button key={id} className={`ability ${isActive ? 'active' : ''}`} disabled={!canUse(combat, id) && !isActive} onClick={() => activate(id)} title={d.desc}>
                  <UpgradeIcon id={id} size={18} className={`rarity-${d.rarity}`} />
                  <span className="flex-1 text-sm font-medium">{d.name}</span>
                  <span className="text-xs text-[color:var(--muted)]">
                    {resting(id) ? 'recharging' : `${charges}${d.scope === 'run' ? ' left' : '×'}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {passives.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-2">Passives</div>
            <div className="flex flex-wrap gap-1.5">
              {passives.map((id) => (
                <UpgradeChip
                  key={id}
                  id={id}
                  count={combat.owned[id] ?? 1}
                  charges={UPGRADES[id].scope !== 'passive' && !resting(id) ? combat.charges[id] : undefined}
                  resting={resting(id)}
                />
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-[color:var(--muted)] leading-relaxed border-t border-[color:var(--line)] pt-3">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-teal-400 mr-1 align-middle" /> safe move
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 ml-3 mr-1 align-middle" /> capturable there
          <br />
          Red stripes = squares the enemy attacks. Hover an enemy to see its reach.
        </div>
      </aside>

      {/* Center: board */}
      <div className="order-1 xl:order-2 flex flex-col items-center gap-3">
        <div className="h-8 flex items-center">
          {modeLabel ? (
            <div className="chip !text-sm !px-3 !py-1 border-amber-500/60 text-amber-200">
              {modeLabel}
              <button className="ml-2 opacity-70 hover:opacity-100" onClick={() => onCombat(setMode(combat, { kind: 'normal' }))}>
                <X size={14} />
              </button>
            </div>
          ) : thinking ? (
            <div className="text-sm text-[color:var(--muted)] flex items-center gap-2">
              <Brain size={16} /> The enemy is thinking
              <span className="thinking-dots">
                <span>.</span>
                <span>.</span>
                <span>.</span>
              </span>
            </div>
          ) : combat.phase === 'player' ? (
            <div className="text-sm text-[color:var(--muted)]">Your move</div>
          ) : null}
        </div>
        <Board
          combat={combat}
          targets={targets}
          onTarget={onTarget}
          showDanger={meta.settings.dangerOverlay}
          animations={meta.settings.animations}
          light={theme.light}
          dark={theme.dark}
          accent={theme.accent}
        />
      </div>

      {/* Right: encounter */}
      <aside className="panel p-4 w-full xl:w-80 flex flex-col gap-4 order-3">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[color:var(--muted)]">
            <Swords size={14} /> {enc.kind === 'boss' ? 'Boss' : enc.kind === 'elite' ? 'Elite' : 'Battle'} · Act {run.act}
          </div>
          <div className="title-font text-xl mt-1">{enc.name}</div>
          <div className="text-sm text-[color:var(--muted)]">{enc.subtitle}</div>
          {enc.boss && <div className="text-sm mt-2 text-purple-200/90">{BOSSES[enc.boss].desc}</div>}
          <div className="mt-2 flex gap-2 flex-wrap">
            <span className="chip">
              <Brain size={12} /> ~{enc.elo} Elo · {eloLabel(enc.elo)}
            </span>
          </div>
        </div>
        <div className="rounded-lg bg-[#1a1d28] border border-[color:var(--line)] p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-200">
            <Target size={15} /> {objectiveText(o)}
          </div>
          <div className="mt-2 h-2 rounded-full bg-[#0f1118] overflow-hidden">
            <div className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-500" style={{ width: `${Math.min(100, progress * 100)}%` }} />
          </div>
          <div className="mt-1.5 text-xs text-[color:var(--muted)]">{progressLabel}</div>
        </div>
        <div className="flex-1 min-h-0">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase tracking-wider text-[color:var(--muted)]">Battle log</div>
            <div className="flex gap-3">
              <button className="text-xs text-[color:var(--muted)] hover:text-white" onClick={onToggleAnimations}>
                motion: {meta.settings.animations ? 'on' : 'off'}
              </button>
              <button className="text-xs text-[color:var(--muted)] hover:text-white flex items-center gap-1" onClick={onToggleDanger}>
                {meta.settings.dangerOverlay ? <Eye size={13} /> : <EyeOff size={13} />} danger map
              </button>
            </div>
          </div>
          <div className="log flex flex-col-reverse gap-1 max-h-60 xl:max-h-[340px] overflow-y-auto scroll-thin pr-1">
            {[...combat.log].reverse().map((l) => (
              <div key={l.id} className={l.tone}>
                {l.text}
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Promotion picker */}
      {promo && (
        <div className="overlay" onClick={() => setPromo(null)}>
          <div className="panel p-5 fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="title-font text-lg mb-3 text-center">Promote to…</div>
            <div className="flex gap-3">
              {(['q', 'r', 'b', 'n'] as PieceSymbol[]).map((t) => (
                <button
                  key={t}
                  className="w-20 h-20 rounded-xl bg-[#241f12] border border-amber-700/40 hover:border-amber-400 grid place-items-center"
                  onClick={() => {
                    onCombat(playerAct(combat, promo, t));
                    setPromo(null);
                  }}
                >
                  <PieceIcon type={t} skin="player" className="!w-16 !h-16" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Borrowed Crown picker */}
      {borrowPick && (
        <div className="overlay" onClick={() => setBorrowPick(false)}>
          <div className="panel p-5 fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="title-font text-lg mb-1 text-center">Borrowed Crown</div>
            <div className="text-sm text-center text-[color:var(--muted)] mb-3">Move as which piece for one move?</div>
            <div className="flex gap-3">
              {(['n', 'b', 'r'] as PieceSymbol[]).map((t) => (
                <button
                  key={t}
                  className="w-20 h-24 rounded-xl bg-[#241f12] border border-amber-700/40 hover:border-amber-400 flex flex-col items-center justify-center gap-1"
                  onClick={() => {
                    onCombat(setMode(combat, { kind: 'borrow', as: t }));
                    setBorrowPick(false);
                  }}
                >
                  <PieceIcon type={t} skin="player" className="!w-14 !h-14" />
                  <span className="text-xs">{PIECE_NAMES[t]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* End of battle */}
      {finished && (
        <div className="overlay">
          <div className="panel p-6 w-[min(420px,92vw)] text-center fade-in">
            <div className={`title-font text-3xl ${combat.phase === 'won' ? 'text-amber-300' : 'text-red-400'}`}>
              {combat.phase === 'won'
                ? combat.outcome === 'checkmate'
                  ? 'Checkmate!'
                  : combat.outcome === 'stalemate'
                    ? 'Stalemate'
                    : combat.outcome === 'slain'
                      ? 'Immortal Slain'
                      : combat.enc.objective.kind === 'survive' || combat.enc.objective.kind === 'protect'
                        ? 'Survived'
                        : 'Objective Complete'
                : combat.outcome === 'dead'
                  ? 'Captured'
                  : 'Objective Failed'}
            </div>
            <p className="text-sm text-[color:var(--muted)] mt-2">
              {combat.phase === 'won'
                ? `You lasted ${combat.turn} turns and captured ${combat.captures} piece${combat.captures === 1 ? '' : 's'}.`
                : combat.outcome === 'dead'
                  ? 'Your piece has been taken off the board for good.'
                  : 'You slip off the board, wounded.'}
            </p>
            <button className="btn btn-primary mt-5 w-full" onClick={onFinish} autoFocus>
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
