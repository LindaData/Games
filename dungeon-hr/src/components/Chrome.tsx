import { useState } from 'react';
import { MAX_BOARD, dungeonXpToNext } from '../game/data';
import { payroll } from '../game/employees';
import type { GameState } from '../game/types';
import { Icon } from '../ui/Icons';
import { isMuted, setMuted, play } from '../ui/sfx';
import { Bar, Gold } from './common';

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
        <span className="hearts mk" aria-label={`Board confidence ${state.board} of ${MAX_BOARD}`}>
          {Array.from({ length: MAX_BOARD }, (_, i) => i).map((i) => (
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
        <div className="kpi tooltip" data-tip="Board confidence. Each treasury breach costs one heart (not during the first 6 weeks). Two clean weeks in a row restore one. Zero hearts = game over.">
          <div>
            <div className="k-label">Board</div>
            <div className="hearts">
              {Array.from({ length: MAX_BOARD }, (_, i) => i).map((i) => (
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
