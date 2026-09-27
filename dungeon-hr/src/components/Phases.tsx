import { SPECIES } from '../game/data';
import { empById, hrOptions } from '../game/hr';
import { title } from '../game/employees';
import type { Action } from '../game/state';
import type { GameState, HrEvent } from '../game/types';
import { Avatar } from '../ui/Avatar';
import { Icon } from '../ui/Icons';
import { play } from '../ui/sfx';
import { Gold, Portrait } from './common';

export function Report({ state, dispatch }: { state: GameState; dispatch: (a: Action) => void }) {
  const s = state.lastSummary;
  if (!s) return null;
  const win = s.outcome === 'defended';
  const income = s.bounty + s.loot + s.accountingBonus;
  const net = income - s.payroll - s.policyCost - s.stolen;
  const inbox = state.hrInbox.length;
  return (
    <div className="report">
      <div className={`banner ${win ? 'win' : 'lose'}`}>
        <Icon name={win ? 'shield' : 'vault'} size={44} className={win ? 'gold' : 'bad'} />
        <div className="grow">
          <div className="xs muted" style={{ letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>
            Weekly Operations Report · Week {s.week} · {s.night ? 'Night shift' : 'Day shift'}
          </div>
          <h2 className={win ? 'gold' : 'bad'}>{win ? 'Threat Neutralized' : 'Security Breach'}</h2>
          <div className="muted">
            vs {s.partyName}: {s.slain}/{s.partySize} visitors offboarded.{' '}
            {s.mvp && (
              <>
                Employee of the Week: <b style={{ color: 'var(--text)' }}>{s.mvp.name}</b> ({s.mvp.kills} kills, {s.mvp.damage} damage).
              </>
            )}
          </div>
        </div>
        <button
          className="btn btn-primary btn-lg"
          onClick={() => {
            dispatch({ type: 'GO', phase: inbox ? 'hr' : 'manage' });
            play('memo');
          }}
        >
          {inbox ? (
            <>
              <Icon name="mail" size={18} /> Open HR Inbox ({inbox})
            </>
          ) : (
            <>
              Back to the office <Icon name="arrow" size={16} />
            </>
          )}
        </button>
      </div>

      {s.dungeonLevelUp && (
        <div className="alert info" style={{ fontSize: 14 }}>
          <Icon name="star" size={20} />
          <span>
            <b>Dungeon Level {s.dungeonLevelUp}!</b> Corporate has approved an expansion. New hires, rooms, and policies may be available.
          </span>
        </div>
      )}

      <div className="report-grid">
        <div className="panel panel-pad">
          <div className="section-title">
            <Icon name="gold" /> Financial Statement
          </div>
          <table className="ledger">
            <tbody>
              <tr>
                <td>Contract bounty {win ? '' : '(forfeited)'}</td>
                <td className="good">+{s.bounty}g</td>
              </tr>
              <tr>
                <td>Recovered "lost property" (loot)</td>
                <td className="good">+{s.loot}g</td>
              </tr>
              {s.accountingBonus > 0 && (
                <tr>
                  <td>Creative accounting</td>
                  <td className="good">+{s.accountingBonus}g</td>
                </tr>
              )}
              <tr>
                <td>Payroll {s.unpaid > 0 && <span className="bad">({s.unpaid} unpaid)</span>}</td>
                <td className="bad">−{s.payroll}g</td>
              </tr>
              {s.policyCost > 0 && (
                <tr>
                  <td>Policy costs</td>
                  <td className="bad">−{s.policyCost}g</td>
                </tr>
              )}
              {s.stolen > 0 && (
                <tr>
                  <td>Stolen from the treasury</td>
                  <td className="bad">−{s.stolen}g</td>
                </tr>
              )}
              <tr className="total">
                <td>Net</td>
                <td className={net >= 0 ? 'good' : 'bad'}>
                  {net >= 0 ? '+' : '−'}
                  {Math.abs(net)}g
                </td>
              </tr>
              <tr>
                <td className="muted">Treasury balance</td>
                <td>
                  <Gold v={state.gold} />
                </td>
              </tr>
              <tr>
                <td className="muted">R&amp;D points earned</td>
                <td style={{ color: '#b4a4ee' }}>+{s.researchGained}</td>
              </tr>
              <tr>
                <td className="muted">Dungeon XP</td>
                <td className="gold">+{s.xpGained}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="panel panel-pad">
          <div className="section-title">
            <Icon name="chart" /> Performance Review
          </div>
          <div className="table-scroll">
          <table className="perf">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Dmg</th>
                <th style={{ textAlign: 'right' }}>Kills</th>
                <th style={{ textAlign: 'right' }}>XP</th>
              </tr>
            </thead>
            <tbody>
              {[...s.performance]
                .sort((a, b) => b.damage - a.damage)
                .map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span className="row" style={{ gap: 6 }}>
                        <Avatar kind={p.species} size={22} dead={p.outcome === 'Deceased'} /> {p.name}
                      </span>
                    </td>
                    <td className={p.outcome === 'Deceased' ? 'bad' : p.outcome === 'Injured' || p.outcome === 'Fled' ? 'warn' : 'muted'}>{p.outcome}</td>
                    <td className="n">{p.damage}</td>
                    <td className="n">{p.kills}</td>
                    <td className="n gold">+{p.xp}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          </div>
          {s.performance.length === 0 && <div className="dim small">Nobody was on the invasion route this week.</div>}
          {s.levelUps.length > 0 && (
            <div className="stack" style={{ marginTop: 12, gap: 4 }}>
              {s.levelUps.map((l, i) => (
                <div key={i} className="small good">
                  <Icon name="up" size={12} /> {l}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {(s.notes.length > 0 || s.departures.length > 0) && (
        <div className="panel panel-pad stack" style={{ gap: 6 }}>
          <div className="section-title" style={{ marginBottom: 4 }}>
            <Icon name="book" /> Notes from Management
          </div>
          {s.departures.map((d, i) => (
            <div key={`d${i}`} className="small bad">
              {d}
            </div>
          ))}
          {s.notes.map((n, i) => (
            <div key={i} className="small muted">
              {n}
            </div>
          ))}
        </div>
      )}

      {s.incidents.length > 0 && (
        <div className="panel panel-pad">
          <div className="section-title">
            <Icon name="skull" /> Employee Incident Reports
          </div>
          <div className="incidents">
            {s.incidents.map((r, i) => (
              <div key={i} className="incident">
                <span className={`stamp ${r.fatal ? '' : 'inj'}`}>{r.fatal ? 'FATAL' : 'INJURY'}</span>
                <h4>EMPLOYEE INCIDENT REPORT</h4>
                <dl>
                  <dt>Employee:</dt>
                  <dd>{r.employee}</dd>
                  <dt>Department:</dt>
                  <dd>{r.department}</dd>
                  <dt>Incident:</dt>
                  <dd>{r.incident}</dd>
                  <dt>Cause:</dt>
                  <dd>{r.cause}</dd>
                  <dt>Recommended Action:</dt>
                  <dd>{r.action}</dd>
                </dl>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function HrInbox({ state, dispatch }: { state: GameState; dispatch: (a: Action) => void }) {
  const ev: HrEvent | undefined = state.hrInbox[0];
  const outcome = state.hrOutcome;
  const e = ev ? empById(state, ev.empId) : undefined;
  const e2 = ev ? empById(state, ev.empId2) : undefined;
  return (
    <div className="hr-wrap">
      <div className="memo-stack">
        <div className="section-title" style={{ marginBottom: 4 }}>
          <Icon name="mail" /> HR Inbox
        </div>
        <div className="xs muted memo-count">{state.hrInbox.length} memo{state.hrInbox.length === 1 ? '' : 's'} waiting</div>
        <div className="xs muted memo-help" style={{ marginBottom: 6 }}>
          Resolve every memo before the next shift. Decisions affect morale, money, and who shows up to work.
        </div>
        {outcome && (
          <div className="memo-tab current">
            <div className="from">Resolved</div>
            {outcome.title}
          </div>
        )}
        {state.hrInbox.map((m, i) => (
          <div key={m.id} className={`memo-tab ${!outcome && i === 0 ? 'current' : ''}`}>
            <div className="from">From: {m.from}</div>
            {m.title}
          </div>
        ))}
      </div>
      <div>
        {outcome ? (
          <div className="memo" key={`o-${outcome.title}`}>
            <div className="memo-header">
              <b>Re:</b>
              <span>{outcome.title}</span>
              <b>Status:</b>
              <span>Decision filed</span>
            </div>
            <div className="memo-outcome">{outcome.text}</div>
            <button
              className="btn btn-lg"
              onClick={() => {
                dispatch({ type: 'HR_NEXT' });
                play(state.hrInbox.length ? 'memo' : 'click');
              }}
            >
              {state.hrInbox.length ? `Next memo (${state.hrInbox.length} left)` : 'Back to the office'} <Icon name="arrow" size={16} />
            </button>
          </div>
        ) : ev ? (
          <Memo ev={ev} state={state} dispatch={dispatch} e={e} e2={e2} />
        ) : (
          <div className="memo">
            <p>Inbox zero. A rare and beautiful sight.</p>
            <button className="btn" onClick={() => dispatch({ type: 'GO', phase: 'manage' })}>
              Back to the office
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Memo({ ev, state, dispatch, e, e2 }: { ev: HrEvent; state: GameState; dispatch: (a: Action) => void; e?: ReturnType<typeof empById>; e2?: ReturnType<typeof empById> }) {
  const opts = hrOptions(state, ev);
  return (
    <div className="memo" key={ev.id}>
      <div className="memo-header">
        <b>From:</b>
        <span>{ev.from}</span>
        <b>To:</b>
        <span>HR Manager, {state.company}</span>
        <b>Week:</b>
        <span>{state.week}</span>
      </div>
      <h3>{ev.title}</h3>
      {(e || e2) && (
        <div className="row wrap" style={{ gap: 10 }}>
          {[e, e2].filter(Boolean).map((x) => (
            <div key={x!.id} className="memo-emp">
              <Portrait kind={x!.species} hue={x!.hue} size={48} />
              <div>
                <b>{x!.name}</b>
                <div className="xs">
                  {title(x!)} · Lv {x!.level} · {SPECIES[x!.species].name}
                </div>
                <div className="xs">
                  Morale {Math.round(x!.morale)} · Salary {x!.salary}g/wk
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <p>{ev.body}</p>
      <div className="memo-options">
        {opts.map((o) => (
          <button
            key={o.id}
            className="memo-opt"
            disabled={o.disabled}
            onClick={() => {
              dispatch({ type: 'HR_RESOLVE', eventId: ev.id, option: o.id });
              play('click');
            }}
          >
            <b>{o.label}</b>
            <span>{o.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function GameOver({ state, onNew }: { state: GameState; onNew: () => void }) {
  const s = state.stats;
  return (
    <div className="title-screen">
      <div className="title-card">
        <Icon name="vault" size={60} className="bad" />
        <div className="logo" style={{ fontSize: 'clamp(34px, 7vw, 60px)' }}>
          HOSTILE
          <br />
          TAKEOVER
        </div>
        <div className="tagline">{state.gameOverReason}</div>
        <div className="kv" style={{ width: '100%' }}>
          <div>
            <div className="k">Weeks survived</div>
            <div className="v">{state.week}</div>
          </div>
          <div>
            <div className="k">Invasions repelled</div>
            <div className="v good">{s.defenses}</div>
          </div>
          <div>
            <div className="k">Adventurers offboarded</div>
            <div className="v">{s.slain}</div>
          </div>
          <div>
            <div className="k">Dungeon level</div>
            <div className="v gold">{state.dungeonLevel}</div>
          </div>
          <div>
            <div className="k">Staff hired</div>
            <div className="v">{s.hired}</div>
          </div>
          <div>
            <div className="k">Fatalities</div>
            <div className="v bad">{s.fatalities}</div>
          </div>
        </div>
        <button className="btn btn-primary btn-lg" onClick={onNew}>
          Update résumé & try again
        </button>
      </div>
    </div>
  );
}
