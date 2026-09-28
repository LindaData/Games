import { ARMOR_TIERS, POLICIES, TECHS, WEAPON_TIERS } from '../game/data';
import { policySlots } from '../game/dungeon';
import { researchPerWeek } from '../game/employees';
import type { Action } from '../game/state';
import type { GameState } from '../game/types';
import { Avatar } from '../ui/Avatar';
import { Icon } from '../ui/Icons';
import { play } from '../ui/sfx';
import { Gold } from './common';

export function Research({ state, dispatch }: { state: GameState; dispatch: (a: Action) => void }) {
  return (
    <>
      <div className="page-head">
        <div>
          <h2>Upgrades</h2>
          <p>
            <span style={{ color: '#b4a4ee' }}>
              <Icon name="flask" size={14} /> {state.research} R&amp;D points
            </span>{' '}
            · +{researchPerWeek(state)}/week. Staff a Research Lab (Witches excel) to research faster.
          </p>
        </div>
      </div>

      <div className="panel panel-pad">
        <div className="section-title">
          <Icon name="sword" /> Procurement <span className="sub">Company-wide equipment. Applies to every employee.</span>
        </div>
        {(['weapons', 'armor'] as const).map((kind) => {
          const tiers = kind === 'weapons' ? WEAPON_TIERS : ARMOR_TIERS;
          const cur = state[kind];
          const next = tiers[cur + 1];
          return (
            <div key={kind} style={{ marginBottom: 14 }}>
              <div className="row wrap">
                <b>{kind === 'weapons' ? 'Weapons' : 'Armor'}</b>
                <span className="muted small">
                  {kind === 'weapons' ? 'Attack' : 'Defense'} ×{tiers[cur].mult.toFixed(2)}
                </span>
                <span className="grow" />
                {next ? (
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={state.gold < next.cost}
                    onClick={() => {
                      dispatch({ type: 'BUY_EQUIP', kind });
                      play('coin');
                    }}
                  >
                    Buy {next.name} · {next.cost}g
                  </button>
                ) : (
                  <span className="chip gold">Maxed</span>
                )}
              </div>
              <div className="tier-track">
                {tiers.map((t, i) => (
                  <div key={t.name} className={`tier ${i <= cur ? 'owned' : ''}`}>
                    <b>{t.name}</b>×{t.mult.toFixed(2)}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="panel panel-pad">
        <div className="section-title">
          <Icon name="flask" /> Dungeon Technologies
        </div>
        <div className="card-grid">
          {TECHS.map((t) => {
            const done = state.tech.includes(t.id);
            const levelLocked = t.unlock > state.dungeonLevel;
            const reqMissing = t.requires && !state.tech.includes(t.requires);
            const locked = levelLocked || !!reqMissing;
            return (
              <div key={t.id} className={`tech ${done ? 'done' : ''} ${locked && !done ? 'locked' : ''}`}>
                <div className="tech-head">
                  {done ? <Icon name="star" size={16} className="good" /> : locked ? <Icon name="lock" size={16} /> : <Icon name="flask" size={16} />}
                  {t.name}
                  <span className="cost">{done ? 'Done' : `${t.cost} RP`}</span>
                </div>
                <div className="small muted">{t.desc}</div>
                {!done && (
                  <div className="row wrap" style={{ marginTop: 'auto' }}>
                    {levelLocked && <span className="chip">Dungeon Lv {t.unlock}</span>}
                    {reqMissing && <span className="chip">Requires {TECHS.find((x) => x.id === t.requires)?.name}</span>}
                    <span className="grow" />
                    <button
                      className="btn btn-sm"
                      disabled={locked || state.research < t.cost}
                      onClick={() => {
                        dispatch({ type: 'RESEARCH', techId: t.id });
                        play('hire');
                      }}
                    >
                      Research
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

export function Policies({ state, dispatch }: { state: GameState; dispatch: (a: Action) => void }) {
  const slots = policySlots(state);
  return (
    <>
      <div className="page-head">
        <div>
          <h2>Employee Handbook</h2>
          <p>
            Active policies: {state.policies.length}/{slots}. Build or upgrade an HR Office for more slots. Policies apply every week.
          </p>
        </div>
      </div>
      <div className="stack">
        {POLICIES.map((p) => {
          const on = state.policies.includes(p.id);
          const locked = p.unlock > state.dungeonLevel;
          const full = !on && state.policies.length >= slots;
          return (
            <div key={p.id} className={`policy ${on ? 'on' : ''}`} style={locked ? { opacity: 0.5 } : undefined}>
              <Icon name="book" size={22} className={on ? 'gold' : 'dim'} />
              <div>
                <div className="pname">
                  {p.name} {locked && <span className="chip">Lv {p.unlock}</span>}
                </div>
                <div className="pdesc">{p.desc}</div>
              </div>
              <button
                className={`toggle ${on ? 'on' : ''}`}
                aria-label={`Toggle ${p.name}`}
                aria-pressed={on}
                disabled={locked || full}
                onClick={() => {
                  dispatch({ type: 'TOGGLE_POLICY', id: p.id });
                  play('click');
                }}
              />
            </div>
          );
        })}
      </div>
    </>
  );
}

export function Memorial({ state }: { state: GameState }) {
  const s = state.stats;
  return (
    <>
      <div className="page-head">
        <div>
          <h2>Alumni &amp; Memorial Wall</h2>
          <p>Former employees. Some left for other opportunities. Some left this plane of existence.</p>
        </div>
      </div>
      <div className="kv">
        <div>
          <div className="k">Weeks survived</div>
          <div className="v">{state.week - 1}</div>
        </div>
        <div>
          <div className="k">Invasions repelled</div>
          <div className="v good">{s.defenses}</div>
        </div>
        <div>
          <div className="k">Breaches</div>
          <div className="v bad">{s.breaches}</div>
        </div>
        <div>
          <div className="k">Adventurers offboarded</div>
          <div className="v">{s.slain}</div>
        </div>
        <div>
          <div className="k">Total hires</div>
          <div className="v">{s.hired}</div>
        </div>
        <div>
          <div className="k">Workplace fatalities</div>
          <div className="v">{s.fatalities}</div>
        </div>
        <div>
          <div className="k">Gold earned</div>
          <div className="v">
            <Gold v={s.goldEarned} />
          </div>
        </div>
      </div>
      {state.memorial.length === 0 ? (
        <div className="panel empty-state">The wall is empty. For now.</div>
      ) : (
        <div className="tombs">
          {state.memorial.map((m, i) => (
            <div key={i} className="tomb">
              <div className="rip">{m.kind === 'fatality' ? 'R.I.P.' : m.kind === 'resigned' ? 'RESIGNED' : m.kind === 'retired' ? 'RETIRED' : 'TERMINATED'}</div>
              <Avatar kind={m.species} size={48} dead={m.kind === 'fatality'} />
              <div className="nm">{m.name}</div>
              <div className="cause">{m.cause}</div>
              <div className="xs dim">Week {m.week}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
