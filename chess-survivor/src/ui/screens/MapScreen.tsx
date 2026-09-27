import { useState } from 'react';
import { BOSSES } from '../../game/encounters';
import { LANES, NODE_INFO, nodeById, reachableNodes, type MapNode } from '../../game/map';
import type { RunState } from '../../game/run';
import { NODE_ICONS } from '../components/Icon';

const COLORS: Record<string, string> = {
  battle: '#e5e7eb',
  elite: '#f87171',
  boss: '#f5c451',
  treasure: '#fbbf24',
  upgrade: '#c084fc',
  rest: '#fb923c',
  event: '#60a5fa',
  shop: '#34d399',
};

export function MapScreen({ run, onEnter }: { run: RunState; onEnter: (id: string) => void }) {
  const [hover, setHover] = useState<MapNode | null>(null);
  const { map } = run;
  const reachable = new Set(reachableNodes(map, run.nodeId).map((n) => n.id));
  const W = 560;
  const H = 720;
  const padY = 60;
  const xOf = (n: MapNode) => (n.kind === 'boss' ? W / 2 : 70 + (n.lane * (W - 140)) / (LANES - 1) + ((n.floor * 13 + n.lane * 7) % 17) - 8);
  const yOf = (n: MapNode) => H - padY - (n.floor * (H - padY * 2)) / (map.floors - 1);
  const current = run.nodeId ? nodeById(map, run.nodeId) : null;
  const info = hover ?? null;

  return (
    <div className="flex flex-col lg:flex-row gap-5 items-center lg:items-start justify-center fade-in">
      <div className="panel p-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-[min(560px,92vw)] h-auto max-h-[76vh]">
          <defs>
            <radialGradient id="mapglow" cx="50%" cy="0%" r="80%">
              <stop offset="0%" stopColor="#2a2413" />
              <stop offset="100%" stopColor="#12141c" />
            </radialGradient>
          </defs>
          <rect width={W} height={H} rx="12" fill="url(#mapglow)" />
          {/* faint chessboard texture */}
          {Array.from({ length: 64 }, (_, i) => (
            <rect key={i} x={(i % 8) * (W / 8)} y={Math.floor(i / 8) * (H / 8)} width={W / 8} height={H / 8} fill={(i + Math.floor(i / 8)) % 2 ? '#ffffff' : 'transparent'} opacity={0.018} />
          ))}
          {map.nodes.flatMap((n) =>
            n.next.map((id) => {
              const m = nodeById(map, id)!;
              const walked = run.visited.includes(n.id) && run.visited.includes(m.id);
              const open = n.id === run.nodeId && reachable.has(m.id);
              return (
                <line
                  key={`${n.id}-${id}`}
                  x1={xOf(n)}
                  y1={yOf(n)}
                  x2={xOf(m)}
                  y2={yOf(m)}
                  stroke={walked ? '#f5c451' : open ? '#e5e7eb' : '#3a3f52'}
                  strokeWidth={walked ? 3.5 : 2}
                  strokeDasharray={walked ? undefined : '6 7'}
                  opacity={walked || open ? 0.9 : 0.6}
                />
              );
            }),
          )}
          {map.nodes.map((n) => {
            const Icon = NODE_ICONS[n.kind];
            const isReach = reachable.has(n.id);
            const visited = run.visited.includes(n.id);
            const isCur = n.id === run.nodeId;
            const r = n.kind === 'boss' ? 34 : 21;
            const col = COLORS[n.kind];
            return (
              <g
                key={n.id}
                className={`map-node ${isReach ? 'reachable' : ''}`}
                style={{ transformOrigin: `${xOf(n)}px ${yOf(n)}px` }}
                onClick={() => isReach && onEnter(n.id)}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(null)}
              >
                <circle
                  className="bg"
                  cx={xOf(n)}
                  cy={yOf(n)}
                  r={r}
                  fill={isCur ? '#3a2f10' : visited ? '#262216' : '#171a24'}
                  stroke={isReach ? col : visited ? '#8a6d2c' : '#3a3f52'}
                  strokeWidth={isReach ? 3 : 2}
                  opacity={!isReach && !visited && !isCur && run.nodeId !== null && n.floor <= (current?.floor ?? -1) ? 0.35 : 1}
                />
                <foreignObject x={xOf(n) - r * 0.55} y={yOf(n) - r * 0.55} width={r * 1.1} height={r * 1.1} pointerEvents="none">
                  <Icon size={r * 1.1} color={isReach || visited || isCur ? col : '#6b7080'} strokeWidth={1.8} />
                </foreignObject>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="panel p-5 w-full lg:w-80">
        <div className="title-font text-2xl">Act {run.act}</div>
        <div className="text-sm text-[color:var(--muted)] mb-4">
          {run.nodeId ? 'Choose your next square.' : 'Choose where to begin.'} Highlighted nodes are reachable.
        </div>
        {info ? (
          <div className="fade-in">
            <div className="font-semibold" style={{ color: COLORS[info.kind] }}>
              {info.kind === 'boss' && info.boss ? BOSSES[info.boss].name : NODE_INFO[info.kind].label}
            </div>
            <div className="text-sm text-[color:var(--muted)] mt-1">{info.kind === 'boss' && info.boss ? BOSSES[info.boss].desc : NODE_INFO[info.kind].desc}</div>
          </div>
        ) : (
          <div className="text-sm text-[color:var(--muted)]">Hover a node for details.</div>
        )}
        <div className="grid grid-cols-2 gap-2 mt-5 text-xs">
          {(Object.keys(NODE_INFO) as (keyof typeof NODE_INFO)[]).map((k) => {
            const Icon = NODE_ICONS[k];
            return (
              <div key={k} className="flex items-center gap-2 text-[color:var(--muted)]">
                <Icon size={15} color={COLORS[k]} /> {NODE_INFO[k].label}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
