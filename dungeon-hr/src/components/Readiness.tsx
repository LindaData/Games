import { useMemo, useState } from 'react';
import { CLASSES, ROOMS, WEAPON_TIERS } from '../game/data';
import { buildCost, hasRoom, headcountLimit, roomAt, roomCapacity, roomStaff, routeOrder, vaultRoom } from '../game/dungeon';
import { hireCost, payroll } from '../game/employees';
import { forecast, type Forecast } from '../game/forecast';
import { partyKindLabel } from '../game/sim';
import { autoAssign } from '../game/staffing';
import type { Action } from '../game/state';
import type { GameState } from '../game/types';
import { Icon } from '../ui/Icons';
import { play } from '../ui/sfx';
import { Portrait } from './common';

interface Step {
  id: string;
  tone: 'bad' | 'warn' | 'info';
  text: string;
  label?: string;
  run?: () => void;
}

export function WinMeter({ f, compact }: { f: Forecast; compact?: boolean }) {
  const pct = Math.round(f.winChance * 100);
  return (
    <div className={`winmeter ${f.tone} ${compact ? 'compact' : ''}`} aria-label={`Win chance ${pct} percent`}>
      <div className="win-num">{pct}%</div>
      <div className="win-text">
        <b>{f.label}</b>
        <span>chance to stop them</span>
      </div>
      <div className="win-bar">
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Readiness({
  state,
  fc,
  dispatch,
  onStart,
  onNav,
  inline,
}: {
  state: GameState;
  fc: Forecast;
  dispatch: (a: Action) => void;
  onStart: () => void;
  onNav: (tab: 'recruit' | 'rnd' | 'staff' | 'floor') => void;
  inline?: boolean;
}) {
  const p = state.nextParty;
  const [showParty, setShowParty] = useState(false);
  const intel = state.tech.includes('intel');

  // How much better would the automatic staffing do?
  const alt = useMemo(() => {
    const c = structuredClone(state);
    autoAssign(c);
    return forecast(c);
  }, [state]);

  const steps: Step[] = [];
  const vaultEmpty = roomStaff(state, vaultRoom(state).id).filter((e) => e.status === 'active').length === 0;
  const bench = state.employees.filter((e) => !e.roomId && e.status === 'active').length;
  const autoGain = Math.round((alt.winChance - fc.winChance) * 100);
  const assign = () => {
    dispatch({ type: 'AUTO_ASSIGN' });
    play('click');
  };
  if (vaultEmpty) steps.push({ id: 'vault', tone: 'bad', text: 'Nobody guards the Treasure Vault.', label: 'Auto-assign', run: assign });
  else if (bench > 0) steps.push({ id: 'bench', tone: 'warn', text: `${bench} staff on the bench won't fight.`, label: 'Auto-assign', run: assign });
  else if (autoGain >= 8) steps.push({ id: 'better', tone: 'info', text: `Auto-assign could raise your odds to ${Math.round(alt.winChance * 100)}%.`, label: 'Auto-assign', run: assign });

  const freeOffice = Array.from({ length: state.officeSlots }, (_, i) => i).find((i) => !roomAt(state, 'office', i));
  if (!hasRoom(state, 'medical') && freeOffice !== undefined && state.gold >= buildCost('medical')) {
    steps.push({
      id: 'medical',
      tone: 'info',
      text: 'Build a Medical Bay so injured staff return right away.',
      label: `Build · ${buildCost('medical')}g`,
      run: () => {
        dispatch({ type: 'BUILD', zone: 'office', slot: freeOffice, roomType: 'medical' });
        play('build');
      },
    });
  }

  const route = routeOrder(state);
  const openPositions = route.reduce((n, r) => n + roomCapacity(r) - roomStaff(state, r.id).length, 0);
  const cheapest = [...state.applicants].sort((a, b) => hireCost(a) - hireCost(b))[0];
  const away = state.employees.filter((e) => e.status !== 'active' && route.some((r) => r.id === e.roomId)).length;
  if (away > 0) steps.push({ id: 'away', tone: 'warn', text: `${away} of your fighters ${away === 1 ? 'is' : 'are'} away this week (vacation, sick or injured).` });
  if (fc.winChance < 0.85 && state.employees.length < headcountLimit(state) && cheapest && state.gold >= hireCost(cheapest)) {
    steps.push({
      id: 'hire',
      tone: fc.winChance < 0.5 ? 'bad' : 'info',
      text: openPositions > 0 ? `Hire more staff: ${openPositions} open position${openPositions === 1 ? '' : 's'}.` : 'Hire more staff (they need a room with space; see below).',
      label: 'Hire',
      run: () => onNav('recruit'),
    });
  }
  const freeRoute = Array.from({ length: state.routeSlots }, (_, i) => i).find((i) => !roomAt(state, 'route', i));
  if (fc.winChance < 0.85 && openPositions === 0 && freeRoute !== undefined && state.gold >= buildCost('guardpost')) {
    steps.push({
      id: 'guardpost',
      tone: 'info',
      text: 'All positions are filled. A Guard Post adds room for more defenders.',
      label: `Build · ${buildCost('guardpost')}g`,
      run: () => {
        dispatch({ type: 'BUILD', zone: 'route', slot: freeRoute, roomType: 'guardpost' });
        play('build');
      },
    });
  }
  const nextWeapon = WEAPON_TIERS[state.weapons + 1];
  if (fc.winChance < 0.7 && nextWeapon && state.gold >= nextWeapon.cost + payroll(state)) {
    steps.push({
      id: 'weapons',
      tone: 'info',
      text: `Better weapons: ${nextWeapon.name} (+${Math.round((nextWeapon.mult / WEAPON_TIERS[state.weapons].mult - 1) * 100)}% attack for everyone).`,
      label: `Buy · ${nextWeapon.cost}g`,
      run: () => {
        dispatch({ type: 'BUY_EQUIP', kind: 'weapons' });
        play('coin');
      },
    });
  }
  if (payroll(state) > state.gold) steps.push({ id: 'pay', tone: 'bad', text: `You can't cover next week's payroll (${payroll(state)}g). Unpaid staff get very unhappy.` });
  const unhappy = state.employees.filter((e) => e.morale < 25).length;
  if (unhappy) steps.push({ id: 'morale', tone: 'warn', text: `${unhappy} staff are unhappy and may quit.`, label: 'See team', run: () => onNav('staff') });

  // Matchup tips: short and only when relevant.
  const routeStaff = state.employees.filter((e) => route.some((r) => r.id === e.roomId));
  const tips: string[] = [];
  if (p.members.some((m) => m.cls === 'paladin' || m.cls === 'cleric') && routeStaff.some((e) => e.species === 'skeleton' || e.species === 'vampire'))
    tips.push('Paladins and clerics hit undead (skeletons, vampires) extra hard.');
  if (p.members.filter((m) => m.cls === 'wizard').length >= 2) tips.push('Wizards hit everyone in a room at once. Spreading staff out helps.');
  if (p.members.some((m) => m.cls === 'rogue') && state.rooms.some((r) => r.type === 'trap')) tips.push('Rogues can disarm traps.');
  if (p.night && routeStaff.some((e) => e.species === 'vampire' || e.traits.includes('nightowl'))) tips.push('Night shift: vampires and night owls fight 30% better.');

  return (
    <aside className={inline ? 'ready-inline' : 'aside'}>
      <div className="panel panel-pad ready">
        <div className="eyebrow">
          Next invasion · Week {state.week}
          {p.boss && <span className="chip bad">Boss wave</span>}
        </div>
        <div className="ready-title">{p.name}</div>
        <div className="row wrap" style={{ gap: 5 }}>
          <span className="chip info">{partyKindLabel(p.kind)}</span>
          <span className="chip">
            <Icon name={p.night ? 'moon' : 'sun'} size={11} /> {p.night ? 'Night' : 'Day'}
          </span>
          <span className="chip gold">Win: +{p.bounty}g</span>
        </div>
        <WinMeter f={fc} />
        <button className="party-strip" onClick={() => setShowParty((s) => !s)} aria-expanded={showParty}>
          <span className="party-faces">
            {p.members.map((m) => (
              <Portrait key={m.id} kind={m.cls} hue={m.hue} size={30} />
            ))}
          </span>
          <span className="xs muted">
            {p.members.length} visitors {showParty ? '▴' : '▾'}
          </span>
        </button>
        {showParty && (
          <div className="party-list">
            {p.members.map((m) => (
              <div key={m.id} className="party-row">
                <Portrait kind={m.cls} hue={m.hue} size={34} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="small" style={{ fontWeight: 600 }}>
                    {m.name}
                  </div>
                  <div className="xs muted">
                    Lv {m.level} {CLASSES[m.cls].name} · {CLASSES[m.cls].strength}
                    {intel && ` · ${m.maxHp} HP, ${Math.round(m.atk)} ATK`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {state.weeklyBuff && (
          <div className="xs good">
            <Icon name="bolt" size={12} /> {state.weeklyBuff.label} is active for this fight.
          </div>
        )}
      </div>

      <div className="panel panel-pad">
        <div className="section-title" style={{ marginBottom: 8 }}>
          <Icon name="star" /> Next steps
        </div>
        {steps.length === 0 ? (
          <div className="small muted">You're all set. Open for business when you're ready.</div>
        ) : (
          <ul className="steps">
            {steps.slice(0, 4).map((s) => (
              <li key={s.id} className={s.tone}>
                <span className="step-dot" />
                <span className="grow">{s.text}</span>
                {s.run && (
                  <button className={`btn btn-sm ${s.tone === 'bad' ? 'btn-primary' : ''}`} onClick={s.run} data-tour-target={s.label === 'Auto-assign' ? 'auto-assign' : undefined}>
                    {s.label}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {tips.length > 0 && (
          <div className="tips">
            {tips.map((t) => (
              <div key={t} className="xs muted">
                <Icon name="shield" size={12} /> {t}
              </div>
            ))}
          </div>
        )}
      </div>

      <button className="btn btn-primary btn-lg go-btn" data-tour-target="go" onClick={onStart}>
        <span className="display" style={{ letterSpacing: '0.08em' }}>
          Open for Business
        </span>
        <small>
          {Math.round(fc.winChance * 100)}% win chance · {ROOMS.vault.name} {vaultEmpty ? 'unguarded!' : 'guarded'}
        </small>
      </button>
    </aside>
  );
}
