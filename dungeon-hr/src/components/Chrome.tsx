import { useState } from 'react';
import { CLASSES, dungeonXpToNext } from '../game/data';
import { roomStaff, vaultRoom, hasRoom } from '../game/dungeon';
import { payroll } from '../game/employees';
import { partyKindLabel } from '../game/sim';
import type { GameState } from '../game/types';
import { Icon } from '../ui/Icons';
import { isMuted, setMuted, play } from '../ui/sfx';
import { Bar, Gold, Portrait } from './common';

export function TopBar({ state, onMenu, onHelp }: { state: GameState; onMenu: () => void; onHelp: () => void }) {
  const [muted, setM] = useState(isMuted());
  const need = dungeonXpToNext(state.dungeonLevel);
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">
          <Icon name="door" size={20} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="brand-name">DUNGEON HR</div>
          <div className="brand-sub">{state.company}</div>
        </div>
      </div>
      <div className="mobile-kpis mobile-only" aria-label="Company status">
        <span className="mk">
          <Icon name={state.nextParty?.night ? 'moon' : 'sun'} size={14} className="muted" /> Wk {state.week}
        </span>
        <span className="mk">
          <Icon name="gold" size={14} className="gold" /> <Gold v={state.gold} />
        </span>
        <span className="mk">Lv {state.dungeonLevel}</span>
        <span className="hearts mk" aria-label={`Board confidence ${state.board} of 3`}>
          {[0, 1, 2].map((i) => (
            <Icon key={i} name="heart" size={13} className={i < state.board ? 'on' : 'off'} />
          ))}
        </span>
        <button className="btn btn-ghost btn-icon mk-menu" aria-label="Menu" onClick={onMenu}>
          <Icon name="menu" />
        </button>
      </div>
      <div className="mobile-xp mobile-only" aria-hidden="true">
        <span style={{ width: `${Math.min(100, (state.dungeonXp / need) * 100)}%` }} />
      </div>
      <div className="kpis desktop-only">
        <div className="kpi">
          <Icon name={state.nextParty?.night ? 'moon' : 'sun'} size={16} className="muted" />
          <div>
            <div className="k-label">Week</div>
            <div className="k-val">{state.week}</div>
          </div>
        </div>
        <div className="kpi tooltip" data-tip={`Weekly payroll: ${payroll(state)}g`}>
          <Icon name="gold" size={16} className="gold" />
          <div>
            <div className="k-label">Treasury</div>
            <div className="k-val">
              <Gold v={state.gold} />
            </div>
          </div>
        </div>
        <div className="kpi">
          <Icon name="flask" size={16} className="muted" />
          <div>
            <div className="k-label">R&amp;D</div>
            <div className="k-val" style={{ color: '#b4a4ee' }}>
              {state.research}
            </div>
          </div>
        </div>
        <div className="kpi kpi-level tooltip" data-tip={`Dungeon XP ${state.dungeonXp}/${need}. Level-ups unlock monsters, rooms and policies.`}>
          <Icon name="star" size={16} className="gold" />
          <div style={{ flex: 1 }}>
            <div className="k-label">Dungeon Level {state.dungeonLevel}</div>
            <Bar value={state.dungeonXp} max={need} color="var(--gold)" />
          </div>
        </div>
        <div className="kpi tooltip" data-tip="Board confidence. Each treasury breach costs one. Two clean weeks in a row restore one. Zero = hostile takeover.">
          <div>
            <div className="k-label">Board</div>
            <div className="hearts">
              {[0, 1, 2].map((i) => (
                <Icon key={i} name="heart" size={15} className={i < state.board ? 'on' : 'off'} />
              ))}
            </div>
          </div>
        </div>
        <button
          className="btn btn-ghost btn-icon"
          aria-label={muted ? 'Unmute' : 'Mute'}
          onClick={() => {
            setMuted(!muted);
            setM(!muted);
            if (muted) play('click');
          }}
        >
          <Icon name={muted ? 'mute' : 'sound'} />
        </button>
        <button className="btn btn-ghost btn-icon" aria-label="Handbook" title="Employee Handbook" onClick={onHelp}>
          <Icon name="book" />
        </button>
        <button className="btn btn-ghost btn-icon" aria-label="Menu" onClick={onMenu}>
          <Icon name="menu" />
        </button>
      </div>
    </header>
  );
}

export function Intel({ state, onStart, onNav, inline }: { state: GameState; onStart: () => void; onNav: (tab: string) => void; inline?: boolean }) {
  const p = state.nextParty;
  const intel = state.tech.includes('intel');
  const vault = vaultRoom(state);
  const vaultStaff = roomStaff(state, vault.id).filter((e) => e.status === 'active');
  const benchActive = state.employees.filter((e) => !e.roomId && e.status === 'active');
  const routeStaff = state.employees.filter((e) => e.roomId && state.rooms.find((r) => r.id === e.roomId)?.zone === 'route' && e.status === 'active');
  const trap = state.rooms.find((r) => r.type === 'trap' && roomStaff(state, r.id).length === 0);
  const unhappy = state.employees.filter((e) => e.morale < 25);
  const pay = payroll(state);
  const undeadVsHoly = (p.kind === 'paladins' || p.members.some((m) => m.cls === 'paladin')) && routeStaff.some((e) => e.species === 'skeleton' || e.species === 'vampire');
  const beastsVsRangers = p.kind === 'goblinhunters' && routeStaff.some((e) => ['goblin', 'orc', 'slime'].includes(e.species));
  const wizards = p.members.filter((m) => m.cls === 'wizard').length >= 2;
  const rogues = p.members.some((m) => m.cls === 'rogue');
  const hasTrap = state.rooms.some((r) => r.type === 'trap');
  const hasMimic = routeStaff.some((e) => e.species === 'mimic' || e.traits.includes('disguise'));


  return (
    <aside className={inline ? 'intel-inline' : 'aside'}>
      <div className="panel panel-pad intel">
        <div className="intel-head">
          <div className="grow">
            <div className="section-title" style={{ marginBottom: 2 }}>
              <Icon name="users" /> Incoming Visitors
            </div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div>
            <div className="row wrap" style={{ marginTop: 4, gap: 5 }}>
              <span className={`chip ${p.boss ? 'bad' : 'info'}`}>{partyKindLabel(p.kind)}</span>
              <span className="chip">
                <Icon name={p.night ? 'moon' : 'sun'} size={11} /> {p.night ? 'Night shift' : 'Day shift'}
              </span>
              <span className="chip gold">Bounty {p.bounty}g</span>
            </div>
          </div>
        </div>
        <div className="intel-flavor">{p.flavor}</div>
        {p.members.map((m) => (
          <div key={m.id} className="party-row">
            <Portrait kind={m.cls} hue={m.hue} size={40} />
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="small" style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {m.name}
              </div>
              <div className="xs muted">
                Lv {m.level} {CLASSES[m.cls].name}
                {intel && (
                  <span className="mono">
                    {' '}
                    · {m.maxHp}hp {Math.round(m.atk)}atk {Math.round(m.def)}def
                  </span>
                )}
              </div>
            </div>
            <span className="tooltip" data-tip={`${CLASSES[m.cls].strength} Weakness: ${CLASSES[m.cls].weakness}`}>
              <Icon name="book" size={14} className="dim" />
            </span>
          </div>
        ))}
        {!intel && (
          <div className="xs dim" style={{ marginTop: 8 }}>
            Research “Adventurer LinkedIn” to see exact stats.
          </div>
        )}
      </div>

      <div className="stack">
        {vaultStaff.length === 0 && (
          <div className="alert bad">
            <Icon name="warn" />
            <span>
              <b>The Treasure Vault is unstaffed.</b> Anyone who reaches it walks off with the gold.
            </span>
          </div>
        )}
        {benchActive.length > 0 && (
          <div className="alert" onClick={() => onNav('floor')} style={{ cursor: 'pointer' }}>
            <Icon name="users" />
            <span>
              {benchActive.length} employee{benchActive.length > 1 ? 's are' : ' is'} on the bench and won't fight.
            </span>
          </div>
        )}
        {pay > state.gold && (
          <div className="alert bad">
            <Icon name="gold" />
            <span>
              Payroll ({pay}g) exceeds the treasury. Unpaid staff lose a lot of morale.
            </span>
          </div>
        )}
        {unhappy.length > 0 && (
          <div className="alert">
            <Icon name="warn" />
            <span>
              {unhappy.length} employee{unhappy.length > 1 ? 's are' : ' is'} updating their résumé (morale &lt; 25).
            </span>
          </div>
        )}
        {trap && !state.tech.includes('autoreset') && (
          <div className="alert info">
            <Icon name="trap" />
            <span>The Trap Corridor has no technician: traps are only half-armed. Goblins are ideal.</span>
          </div>
        )}
        {undeadVsHoly && (
          <div className="alert info">
            <Icon name="shield" />
            <span>Paladins and clerics smite undead for bonus damage. Consider moving skeletons/vampires back.</span>
          </div>
        )}
        {beastsVsRangers && (
          <div className="alert info">
            <Icon name="shield" />
            <span>Rangers deal +30% to beasts (goblins, orcs, slimes). Skeletons are a safer frontline.</span>
          </div>
        )}
        {wizards && (
          <div className="alert info">
            <Icon name="shield" />
            <span>Multiple wizards: fireballs hit every employee in a room. Spread your staff across rooms.</span>
          </div>
        )}
        {rogues && (hasTrap || hasMimic) && (
          <div className="alert info">
            <Icon name="shield" />
            <span>Rogues can disarm traps and spot disguised mimics. Kill them early.</span>
          </div>
        )}
        {p.night && routeStaff.some((e) => e.species === 'vampire' || e.traits.includes('nightowl')) && (
          <div className="alert info">
            <Icon name="moon" />
            <span>Night shift: vampires and night owls fight at +30%.</span>
          </div>
        )}
      </div>

      {state.weeklyBuff && (
        <div className="alert info">
          <Icon name="bolt" />
          <span>
            <b>{state.weeklyBuff.label}</b> is in effect for this invasion
            {state.weeklyBuff.atk !== 1 && ` (attack +${Math.round((state.weeklyBuff.atk - 1) * 100)}%`}
            {state.weeklyBuff.def !== 1 && `${state.weeklyBuff.atk !== 1 ? ', ' : ' ('}defense +${Math.round((state.weeklyBuff.def - 1) * 100)}%`}
            {(state.weeklyBuff.atk !== 1 || state.weeklyBuff.def !== 1) && ')'}.
          </span>
        </div>
      )}

      <button className="btn btn-primary btn-lg go-btn" data-tour-target="go" onClick={onStart}>
        <span className="display" style={{ letterSpacing: '0.08em' }}>
          Open for Business
        </span>
        <small>
          Week {state.week} · {p.members.length} visitors · {hasRoom(state, 'medical') ? 'Medical Bay on call' : 'No medical coverage'}
        </small>
      </button>
    </aside>
  );
}
