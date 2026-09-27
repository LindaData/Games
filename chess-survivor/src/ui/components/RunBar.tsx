import { Coins, Heart, Map as MapIcon } from 'lucide-react';
import type { RunState } from '../../game/run';
import type { UpgradeId } from '../../game/upgrades';
import { CHARACTERS } from '../../game/pieces';
import { PieceIcon } from './PieceIcon';
import { UpgradeChip } from './UpgradeCard';

export function HpHearts({ hp, maxHp, size = 16 }: { hp: number; maxHp: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: maxHp }, (_, i) => (
        <Heart key={i} size={size} className={i < hp ? 'text-rose-500' : 'text-zinc-600'} fill={i < hp ? 'currentColor' : 'none'} />
      ))}
    </span>
  );
}

export function RunBar({ run, onMenu }: { run: RunState; onMenu?: () => void }) {
  const ch = CHARACTERS[run.piece];
  const owned = Object.entries(run.owned) as [UpgradeId, number][];
  return (
    <div className="panel px-4 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-2">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8">
          <PieceIcon type={run.piece} skin="player" />
        </div>
        <div className="leading-tight">
          <div className="font-semibold text-sm">{ch.name}</div>
          <div className="text-[11px] text-[color:var(--muted)]">{ch.title}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <HpHearts hp={run.hp} maxHp={run.maxHp} />
        <span className="text-[color:var(--muted)]">
          {run.hp}/{run.maxHp}
        </span>
      </div>
      <div className="flex items-center gap-1.5 text-sm text-amber-300">
        <Coins size={16} /> {run.gold}
      </div>
      <div className="flex items-center gap-1.5 text-sm text-[color:var(--muted)]">
        <MapIcon size={16} /> Act {run.act}
        {run.mode !== 'standard' && <span className="chip ml-1 capitalize">{run.mode}</span>}
      </div>
      <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
        {owned.map(([id, n]) => (
          <UpgradeChip key={id} id={id} count={n} charges={run.runCharges[id]} resting={run.cooldowns?.[id]} />
        ))}
      </div>
      {onMenu && (
        <button className="btn btn-ghost text-xs py-1.5" onClick={onMenu}>
          Menu
        </button>
      )}
    </div>
  );
}
