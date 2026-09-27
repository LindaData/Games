import { Coins, Flame, Gem, Hammer, Heart, Store, Swords } from 'lucide-react';
import { eventById } from '../../game/events';
import type { RunState } from '../../game/run';
import { UPGRADES, type UpgradeId } from '../../game/upgrades';
import { UpgradeCard } from '../components/UpgradeCard';

function Shell({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="max-w-4xl mx-auto fade-in">
      <div className="text-center mb-6">
        <div className="inline-grid place-items-center w-14 h-14 rounded-2xl bg-[#221d10] border border-amber-700/40 text-amber-300 mb-3">{icon}</div>
        <div className="title-font text-3xl">{title}</div>
        {subtitle && <div className="text-[color:var(--muted)] mt-1">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

export function RewardScreen({ run, onPick }: { run: RunState; onPick: (id: UpgradeId | null) => void }) {
  const r = run.reward!;
  const failed = r.outcome === 'failed';
  return (
    <Shell icon={<Swords size={26} />} title={r.title} subtitle={failed ? undefined : 'Choose one upgrade to carry forward.'}>
      <div className="flex justify-center gap-3 mb-6 flex-wrap">
        {r.gold > 0 && (
          <span className="chip !text-sm text-amber-300">
            <Coins size={14} /> +{r.gold} gold
          </span>
        )}
        {r.heal > 0 && (
          <span className="chip !text-sm text-rose-300">
            <Heart size={14} /> +{r.heal} HP
          </span>
        )}
        {r.lines.map((l) => (
          <span key={l} className="chip !text-sm text-[color:var(--muted)]">
            {l}
          </span>
        ))}
      </div>
      {r.choices.length > 0 && (
        <div className="grid sm:grid-cols-3 gap-4">
          {r.choices.map((id) => (
            <UpgradeCard key={id} id={id} onClick={() => onPick(id)} footer={run.owned[id] ? <span className="text-xs text-[color:var(--muted)]">Owned ×{run.owned[id]} — stacks</span> : null} />
          ))}
        </div>
      )}
      <div className="text-center mt-6">
        <button className={`btn ${r.choices.length ? 'btn-ghost' : 'btn-primary'}`} onClick={() => onPick(null)}>
          {r.choices.length ? 'Skip' : 'Continue'}
        </button>
      </div>
    </Shell>
  );
}

export function ForgeScreen({ run, onPick }: { run: RunState; onPick: (id: UpgradeId | null) => void }) {
  return (
    <Shell icon={<Hammer size={26} />} title="The Forge" subtitle="An old blacksmith offers you one masterwork. Choose wisely.">
      <div className="grid sm:grid-cols-3 gap-4">
        {(run.forge ?? []).map((id) => (
          <UpgradeCard key={id} id={id} onClick={() => onPick(id)} />
        ))}
      </div>
      <div className="text-center mt-6">
        <button className="btn btn-ghost" onClick={() => onPick(null)}>
          Leave
        </button>
      </div>
    </Shell>
  );
}

export function ShopScreen({ run, onBuy, onLeave }: { run: RunState; onBuy: (i: number) => void; onLeave: () => void }) {
  return (
    <Shell icon={<Store size={26} />} title="The Shop" subtitle={`A travelling merchant with a knight's patience. You have ${run.gold} gold.`}>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {(run.shop ?? []).map((item, i) =>
          item.kind === 'upgrade' ? (
            <UpgradeCard
              key={i}
              id={item.id}
              disabled={item.sold || run.gold < item.price}
              onClick={() => onBuy(i)}
              footer={
                <span className={`chip ${item.sold ? '' : 'text-amber-300'}`}>
                  {item.sold ? (
                    'Sold'
                  ) : (
                    <>
                      <Coins size={12} /> {item.price}
                    </>
                  )}
                </span>
              }
            />
          ) : (
            <button key={i} className="upgrade-card disabled:opacity-40" style={{ ['--rc' as string]: '#f43f5e' }} disabled={item.sold || run.gold < item.price || run.hp >= run.maxHp} onClick={() => onBuy(i)}>
              <div className="flex items-center gap-3 mb-2">
                <div className="icon-wrap">
                  <Heart size={22} />
                </div>
                <div className="font-semibold">Field Dressing</div>
              </div>
              <p className="text-sm text-[color:var(--muted)]">Restore 1 HP.</p>
              <div className="mt-3">
                <span className="chip text-amber-300">
                  {item.sold ? (
                    'Sold'
                  ) : (
                    <>
                      <Coins size={12} /> {item.price}
                    </>
                  )}
                </span>
              </div>
            </button>
          ),
        )}
      </div>
      <div className="text-center mt-6">
        <button className="btn btn-primary" onClick={onLeave}>
          Leave shop
        </button>
      </div>
    </Shell>
  );
}

export function EventScreen({ run, onChoose, onLeave }: { run: RunState; onChoose: (i: number) => void; onLeave: () => void }) {
  const ev = eventById(run.event!.id);
  const result = run.event!.result;
  return (
    <Shell icon={<span className="text-2xl">?</span>} title={ev.title}>
      <div className="panel p-6 max-w-2xl mx-auto">
        <p className="text-[15px] leading-relaxed">{ev.text}</p>
        {result ? (
          <div className="mt-5 fade-in">
            <div className="rounded-lg border border-amber-700/40 bg-[#221d10] p-4 text-amber-100">{result}</div>
            <button className="btn btn-primary mt-5 w-full" onClick={onLeave}>
              Continue
            </button>
          </div>
        ) : (
          <div className="mt-5 flex flex-col gap-2">
            {ev.options.map((o, i) => {
              const ok = !o.available || o.available(run);
              return (
                <button key={i} className="btn !justify-between text-left" disabled={!ok} onClick={() => onChoose(i)}>
                  <span>{o.label}</span>
                  <span className="text-xs font-normal text-[color:var(--muted)]">{o.hint}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Shell>
  );
}

export function RestScreen({ run, onAction, onLeave }: { run: RunState; onAction: (a: 'heal' | 'train') => void; onLeave: () => void }) {
  const heal = Math.max(2, Math.ceil(run.maxHp / 2));
  return (
    <Shell icon={<Flame size={26} />} title="Campfire" subtitle="The board is quiet. For now.">
      {run.restDone ? (
        <div className="panel p-6 max-w-lg mx-auto text-center fade-in">
          <p>{run.restDone}</p>
          <button className="btn btn-primary mt-5 w-full" onClick={onLeave}>
            Continue
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
          <button className="upgrade-card" style={{ ['--rc' as string]: '#fb923c' }} onClick={() => onAction('heal')} disabled={run.hp >= run.maxHp}>
            <div className="flex items-center gap-3 mb-2">
              <div className="icon-wrap">
                <Heart size={22} />
              </div>
              <div className="font-semibold text-lg">Rest</div>
            </div>
            <p className="text-sm text-[color:var(--muted)]">Heal {heal} HP{run.hp >= run.maxHp ? ' (already full)' : ''}.</p>
          </button>
          <button className="upgrade-card" style={{ ['--rc' as string]: '#60a5fa' }} onClick={() => onAction('train')}>
            <div className="flex items-center gap-3 mb-2">
              <div className="icon-wrap">
                <Hammer size={22} />
              </div>
              <div className="font-semibold text-lg">Train</div>
            </div>
            <p className="text-sm text-[color:var(--muted)]">Gain a random upgrade.</p>
          </button>
        </div>
      )}
    </Shell>
  );
}

export function TreasureScreen({ run, onTake }: { run: RunState; onTake: () => void }) {
  const t = run.treasure!;
  return (
    <Shell icon={<Gem size={26} />} title="Treasure" subtitle="An abandoned supply chest sits on a quiet square.">
      <div className="max-w-md mx-auto flex flex-col gap-4">
        <div className="panel p-4 flex items-center gap-3 text-amber-300">
          <Coins /> {t.gold} gold
        </div>
        {t.upgrade && <UpgradeCard id={t.upgrade} onClick={onTake} />}
        <button className="btn btn-primary" onClick={onTake}>
          Take everything
        </button>
      </div>
    </Shell>
  );
}

export function upgradeName(id: UpgradeId) {
  return UPGRADES[id].name;
}
