import { UPGRADES, type UpgradeId } from '../../game/upgrades';
import { UpgradeIcon } from './Icon';

export const RARITY_COLOR = { common: '#a3a3a3', uncommon: '#60a5fa', rare: '#c084fc' } as const;

const SCOPE_TEXT = { run: 'Once per run', encounter: 'Every battle', passive: 'Passive' } as const;

function scopeText(id: UpgradeId): string {
  const d = UPGRADES[id];
  if (d.recharge) return `Every ${d.recharge} battles`;
  return d.active ? `Active · ${SCOPE_TEXT[d.scope]}` : SCOPE_TEXT[d.scope];
}

export function UpgradeCard({ id, onClick, footer, disabled }: { id: UpgradeId; onClick?: () => void; footer?: React.ReactNode; disabled?: boolean }) {
  const d = UPGRADES[id];
  return (
    <button
      className="upgrade-card fade-in w-full disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ ['--rc' as string]: RARITY_COLOR[d.rarity] }}
      onClick={onClick}
      disabled={disabled}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="icon-wrap">
          <UpgradeIcon id={id} size={22} />
        </div>
        <div>
          <div className="font-semibold text-[15px]">{d.name}</div>
          <div className={`text-[11px] uppercase tracking-wider rarity-${d.rarity}`}>
            {d.rarity} · {scopeText(id)}
          </div>
        </div>
      </div>
      <p className="text-sm text-[color:var(--muted)] leading-snug">{d.desc}</p>
      {footer && <div className="mt-3">{footer}</div>}
    </button>
  );
}

export function UpgradeChip({ id, count, charges, resting }: { id: UpgradeId; count: number; charges?: number; resting?: boolean | number }) {
  const d = UPGRADES[id];
  return (
    <span className="chip" title={`${d.name}: ${d.desc}`} style={{ color: RARITY_COLOR[d.rarity] }}>
      <UpgradeIcon id={id} size={13} />
      <span className="text-[color:var(--text)]">{d.name}</span>
      {count > 1 && <span className="opacity-70">×{count}</span>}
      {charges !== undefined && <span className="opacity-70">({charges})</span>}
      {!!resting && (
        <span className="opacity-60 italic">{typeof resting === 'number' ? `recharging: ${resting} battle${resting === 1 ? '' : 's'}` : 'recharging'}</span>
      )}
    </span>
  );
}
