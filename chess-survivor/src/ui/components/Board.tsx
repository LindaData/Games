import { useEffect, useMemo, useRef, useState } from 'react';
import type { PieceSymbol, Square } from 'chess.js';
import { Flag, Heart, Infinity as InfinityIcon, Shield, Zap } from 'lucide-react';
import { boardFromFen, enemyAttackMap } from '../../chess/rules';
import { FastBoard } from '../../chess/fast';
import { ALL_SQUARES, fileOf, isDark, rankOf, to0x88 } from '../../chess/squares';
import { dangerInfo, maybePlayerSquare, ruleMods, type CombatState, type Fx, type PlayerTarget } from '../../game/combat';
import { PieceIcon, type PieceSkin } from './PieceIcon';

interface Props {
  combat: CombatState;
  targets: PlayerTarget[];
  onTarget: (sq: Square) => void;
  showDanger: boolean;
  animations: boolean;
  light: string;
  dark: string;
  accent: string;
}

interface RenderPiece {
  id: number;
  sq: Square;
  type: PieceSymbol;
  color: 'w' | 'b';
  skin: PieceSkin;
}

const pos = (sq: Square) => ({ x: fileOf(sq), y: 8 - rankOf(sq) });

export function Board({ combat, targets, onTarget, showDanger, animations, light, dark, accent }: Props) {
  const [hover, setHover] = useState<Square | null>(null);
  const [shake, setShake] = useState(false);
  const [activeFx, setActiveFx] = useState<Fx[]>([]);
  const seenFx = useRef<number>(combat.fx.length ? combat.fx[combat.fx.length - 1].id : 0);

  const playerSq = maybePlayerSquare(combat);
  const mods = ruleMods(combat);

  const pieces: RenderPiece[] = useMemo(() => {
    const out: RenderPiece[] = [];
    for (const p of boardFromFen(combat.fen)) {
      const id = combat.ids[p.sq];
      if (id === undefined) continue;
      let skin: PieceSkin = p.color === 'w' ? 'white' : 'black';
      if (id === combat.playerId) skin = 'player';
      else if (id === combat.allyId) skin = 'ally';
      else if (id === combat.immortalId) skin = 'immortal';
      else if (id === combat.mirrorId) skin = 'mirror';
      out.push({ id, sq: p.sq, type: p.type, color: p.color, skin });
    }
    return out.sort((a, b) => a.id - b.id);
  }, [combat.fen, combat.ids, combat.playerId, combat.allyId, combat.immortalId, combat.mirrorId]);

  const attackMap = useMemo(() => (showDanger ? enemyAttackMap(combat.fen, mods) : new Set<Square>()), [combat.fen, showDanger, mods.armor, mods.immortalSq]);
  const danger = useMemo(() => dangerInfo(combat), [combat.fen, combat.phase, combat.ids]);

  const hoverAttacks = useMemo(() => {
    if (!hover) return new Set<Square>();
    const p = pieces.find((x) => x.sq === hover);
    if (!p || p.color !== 'b') return new Set<Square>();
    const fb = new FastBoard(combat.fen);
    const out = new Set<Square>();
    for (const s of ALL_SQUARES) if ((fb.attackers('b', to0x88(s)) as string[]).includes(hover)) out.add(s);
    return out;
  }, [hover, pieces, combat.fen]);

  const targetMap = useMemo(() => new Map(targets.map((t) => [t.to, t])), [targets]);
  const o = combat.enc.objective;
  const objectiveSquares = new Set<Square>(o.kind === 'reach' || o.kind === 'escape' ? o.squares : []);
  const promoteRank = o.kind === 'promote' || combat.playerType === 'p';

  // FX lifecycle
  useEffect(() => {
    const fresh = combat.fx.filter((f) => f.id > seenFx.current);
    if (!fresh.length) return;
    seenFx.current = fresh[fresh.length - 1].id;
    setActiveFx((cur) => [...cur, ...fresh]);
    if (fresh.some((f) => f.kind === 'hit') && animations) {
      setShake(true);
      setTimeout(() => setShake(false), 450);
    }
    const ids = fresh.map((f) => f.id);
    setTimeout(() => setActiveFx((cur) => cur.filter((f) => !ids.includes(f.id))), 1500);
  }, [combat.fx, animations]);

  const defensiveReady = (combat.charges.knights_instinct ?? 0) > 0 || (combat.charges.parry ?? 0) > 0;

  return (
    <div className={`board-frame ${shake ? 'shake' : ''} ${animations ? '' : 'no-anim'}`} style={{ ['--light' as string]: light, ['--dark' as string]: dark, ['--accent' as string]: accent }}>
      <div className="board">
        {ALL_SQUARES.map((sq) => {
          const t = targetMap.get(sq);
          const isLast = combat.lastMove && (combat.lastMove.from === sq || combat.lastMove.to === sq);
          const cls = [
            'sq',
            isDark(sq) ? 'dark' : 'light',
            isLast ? 'last' : '',
            attackMap.has(sq) ? 'heat' : '',
            hoverAttacks.has(sq) ? 'hover-attack' : '',
            t ? 'target' : '',
            objectiveSquares.has(sq) ? (o.kind === 'escape' ? 'portal' : 'goal') : '',
            promoteRank && rankOf(sq) === 8 ? 'promo-rank' : '',
          ].join(' ');
          return (
            <div
              key={sq}
              className={cls}
              onClick={() => t && onTarget(sq)}
              onMouseEnter={() => setHover(sq)}
              onMouseLeave={() => setHover((h) => (h === sq ? null : h))}
            >
              {objectiveSquares.has(sq) && <Flag className="goal-flag" size={18} />}
              {t && <span className={`dot ${t.capture ? 'cap' : ''} ${t.danger ? 'danger' : 'safe'}`} />}
              {fileOf(sq) === 0 && <span className="coord rank">{rankOf(sq)}</span>}
              {rankOf(sq) === 1 && <span className="coord file">{sq[0]}</span>}
            </div>
          );
        })}

        <svg className="arrows" viewBox="0 0 800 800" aria-hidden>
          <defs>
            <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="rgba(239,68,68,.9)" />
            </marker>
          </defs>
          {playerSq &&
            danger.attackers.map((a) => {
              const s = pos(a);
              const e = pos(playerSq);
              const sx = s.x * 100 + 50;
              const sy = s.y * 100 + 50;
              const ex = e.x * 100 + 50;
              const ey = e.y * 100 + 50;
              const len = Math.hypot(ex - sx, ey - sy);
              const k = (len - 34) / len;
              return <line key={a} x1={sx} y1={sy} x2={sx + (ex - sx) * k} y2={sy + (ey - sy) * k} className="threat-line" markerEnd="url(#arrowhead)" />;
            })}
        </svg>

        <div className="pieces">
          {pieces.map((p) => {
            const { x, y } = pos(p.sq);
            const attacking = danger.attackers.includes(p.sq);
            return (
              <div
                key={p.id}
                className={`piece ${p.skin} ${attacking ? 'attacker' : ''} ${p.skin === 'player' && danger.inDanger ? 'in-danger' : ''} ${p.skin === 'immortal' && !isDark(p.sq) ? 'invuln' : ''}`}
                style={{ transform: `translate(${x * 100}%, ${y * 100}%)` }}
              >
                {p.skin === 'player' && <div className="aura" />}
                <PieceIcon type={p.type} skin={p.skin} />
                {p.skin === 'player' && (
                  <div className="hp-pips">
                    {Array.from({ length: combat.maxHp }, (_, i) => (
                      <Heart key={i} size={10} className={i < combat.hp ? 'full' : 'empty'} fill={i < combat.hp ? 'currentColor' : 'none'} />
                    ))}
                  </div>
                )}
                {p.skin === 'player' && defensiveReady && (
                  <div className="def-badge" title="A defensive upgrade is ready">
                    {(combat.charges.knights_instinct ?? 0) > 0 ? <Zap size={11} /> : <Shield size={11} />}
                  </div>
                )}
                {p.skin === 'ally' && (
                  <div className="role-badge ally-badge" title="Your ally — keep it alive">
                    <Shield size={11} />
                  </div>
                )}
                {p.skin === 'immortal' && (
                  <div className="role-badge immortal-badge" title="The Immortal — only capturable on dark squares">
                    <InfinityIcon size={11} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="fx-layer">
          {activeFx.map((f) => {
            if (!f.sq) return <div key={f.id} className={`banner-fx ${f.tone}`}>{f.text}</div>;
            const { x, y } = pos(f.sq);
            return (
              <div key={f.id} className={`fx fx-${f.kind} ${f.tone}`} style={{ transform: `translate(${x * 100}%, ${y * 100}%)` }}>
                {(f.kind === 'capture' || f.kind === 'hit') && (
                  <div className="burst">
                    {Array.from({ length: 10 }, (_, i) => (
                      <i key={i} style={{ ['--a' as string]: `${i * 36}deg` }} />
                    ))}
                  </div>
                )}
                {(f.kind === 'teleport' || f.kind === 'respawn' || f.kind === 'ghost' || f.kind === 'dodge' || f.kind === 'parry') && <div className="ring" />}
                {f.text && <span className="float-text">{f.text}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
