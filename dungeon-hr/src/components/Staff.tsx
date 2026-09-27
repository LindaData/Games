import { useMemo, useState } from 'react';
import { ROOMS, SPECIES, RANKS } from '../game/data';
import { getRoom, headcountLimit } from '../game/dungeon';
import {
  canPromote,
  combatProfile,
  coreStats,
  fatigueMult,
  hasTrait,
  hireCost,
  moraleMult,
  payroll,
  powerRating,
  suitability,
  title,
  trainingCost,
  weeklySalary,
} from '../game/employees';
import type { Action } from '../game/state';
import type { Employee, GameState, RoomTypeId } from '../game/types';
import { coverLetter } from '../ui/flavor';
import { askConfirm } from '../ui/confirm';
import { relationsOf } from '../game/relations';
import { Icon } from '../ui/Icons';
import { play } from '../ui/sfx';
import { EmployeeCard, Gold, GradeBadge, Modal, MoodLine, Portrait, StatBars, TraitChip, StatusChip } from './common';

type Filter = 'all' | 'route' | 'office' | 'bench' | 'attention';
type Sort = 'power' | 'level' | 'morale' | 'salary' | 'name';

export function StaffDirectory({ state, onOpen }: { state: GameState; onOpen: (id: string) => void }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('power');
  const list = useMemo(() => {
    let l = state.employees.slice();
    if (filter === 'route') l = l.filter((e) => getRoom(state, e.roomId)?.zone === 'route');
    if (filter === 'office') l = l.filter((e) => getRoom(state, e.roomId)?.zone === 'office');
    if (filter === 'bench') l = l.filter((e) => !e.roomId);
    if (filter === 'attention') l = l.filter((e) => e.morale < 35 || e.fatigue > 60 || e.status !== 'active' || canPromote(e));
    const key: Record<Sort, (e: Employee) => number | string> = {
      power: (e) => -powerRating(e),
      level: (e) => -e.level,
      morale: (e) => e.morale,
      salary: (e) => -e.salary,
      name: (e) => e.name,
    };
    return l.sort((a, b) => (key[sort](a) < key[sort](b) ? -1 : key[sort](a) > key[sort](b) ? 1 : 0));
  }, [state, filter, sort]);

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Staff Directory</h2>
          <p>
            {state.employees.length}/{headcountLimit(state)} headcount · Weekly payroll <Gold v={payroll(state)} />
          </p>
        </div>
        <div className="actions">
          <div className="seg">
            {(['all', 'route', 'office', 'bench', 'attention'] as Filter[]).map((f) => (
              <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
                {{ all: 'All', route: 'Security', office: 'Back office', bench: 'Bench', attention: 'Needs attention' }[f]}
              </button>
            ))}
          </div>
          <div className="seg">
            {(['power', 'level', 'morale', 'salary', 'name'] as Sort[]).map((s) => (
              <button key={s} className={sort === s ? 'on' : ''} onClick={() => setSort(s)}>
                {s[0].toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>
      {list.length === 0 ? (
        <div className="panel empty-state">Nobody matches that filter.</div>
      ) : (
        <div className="card-grid">
          {list.map((e) => (
            <EmployeeCard
              key={e.id}
              e={e}
              onClick={() => onOpen(e.id)}
              footer={<span className="xs muted">{getRoom(state, e.roomId) ? ROOMS[getRoom(state, e.roomId)!.type].name : 'Bench'}</span>}
            />
          ))}
        </div>
      )}
    </>
  );
}

export function EmployeeModal({
  id,
  state,
  dispatch,
  onClose,
  onOpen,
}: {
  id: string;
  state: GameState;
  dispatch: (a: Action) => void;
  onClose: () => void;
  onOpen?: (id: string) => void;
}) {
  const e = state.employees.find((x) => x.id === id);
  if (!e) return null;
  const room = getRoom(state, e.roomId);
  const prof = combatProfile(e, state, room, false);
  const core = coreStats(e);
  const sp = SPECIES[e.species];
  const suitRooms = (Object.keys(sp.suit) as RoomTypeId[]).filter((r) => ROOMS[r].unlock <= state.dungeonLevel || r === 'vault');
  const tCost = trainingCost(e);
  return (
    <Modal title={e.name} onClose={onClose} wide icon={<Portrait kind={e.species} hue={e.hue} size={44} />}>
      <div className="row wrap" style={{ gap: 12 }}>
        <div className="grow">
          <div style={{ fontSize: 15, fontWeight: 700 }}>{title(e)}</div>
          <div className="muted small">
            {sp.department} · {sp.name} · Level {e.level} · Hired week {e.hiredWeek} · {e.kills} lifetime kills
          </div>
        </div>
        <StatusChip status={e.status} />
        <span className="chip gold">
          <Icon name="bolt" size={11} /> Power {powerRating(e)}
        </span>
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        {sp.blurb} <b style={{ color: 'var(--text)' }}>{sp.ability}</b>
      </p>
      {e.traits.length > 0 && (
        <div className="stack" style={{ gap: 6 }}>
          {e.traits.map((t) => (
            <div key={t} className="row small">
              <TraitChip id={t} />
            </div>
          ))}
        </div>
      )}
      <div className="report-grid">
        <div className="panel panel-pad stack">
          <div className="section-title" style={{ marginBottom: 0 }}>
            Base stats
          </div>
          <StatBars e={e} />
          <MoodLine e={e} />
        </div>
        <div className="panel panel-pad stack">
          <div className="section-title" style={{ marginBottom: 0 }}>
            On the job <span className="sub">{room ? ROOMS[room.type].name : 'Bench'}</span>
          </div>
          <div className="kv">
            <div>
              <div className="k">Max HP</div>
              <div className="v">
                {Math.round(Math.min(e.hp, prof.maxHp))}/{prof.maxHp}
              </div>
            </div>
            <div>
              <div className="k">Attack</div>
              <div className="v">
                {prof.atk.toFixed(1)} <span className="xs dim">base {core.atk.toFixed(0)}</span>
              </div>
            </div>
            <div>
              <div className="k">Defense</div>
              <div className="v">{prof.def.toFixed(1)}</div>
            </div>
            <div>
              <div className="k">Morale ×</div>
              <div className="v">{moraleMult(e.morale).toFixed(2)}</div>
            </div>
            <div>
              <div className="k">Fatigue ×</div>
              <div className="v">{fatigueMult(e.fatigue).toFixed(2)}</div>
            </div>
            <div>
              <div className="k">Salary</div>
              <div className="v">
                <Gold v={weeklySalary(e, state)} />
              </div>
            </div>
          </div>
          <div className="xs muted">
            Job suitability:{' '}
            {suitRooms.map((r) => (
              <span key={r} className="row" style={{ display: 'inline-flex', gap: 4, marginRight: 8 }}>
                {ROOMS[r].name} <GradeBadge g={suitability(e.species, r)} />
              </span>
            ))}
          </div>
        </div>
      </div>
      <RelationsPanel id={e.id} state={state} onOpen={onOpen} />
      <div className="row wrap">
        <button
          className="btn btn-primary"
          disabled={state.gold < tCost}
          onClick={() => {
            dispatch({ type: 'TRAIN', empId: e.id });
            play('hire');
          }}
        >
          <Icon name="training" size={16} /> Training course · {tCost}g
        </button>
        <button className="btn" disabled={!canPromote(e)} onClick={() => dispatch({ type: 'PROMOTE', empId: e.id })} title={canPromote(e) ? '' : `Requires level ${2 + e.rank * 2}`}>
          <Icon name="up" size={16} /> Promote to {RANKS[e.rank + 1] !== undefined ? `${RANKS[e.rank + 1]}${sp.job}` : '—'}
          {!canPromote(e) && e.rank < RANKS.length - 1 && <span className="dim xs">(Lv {2 + e.rank * 2})</span>}
        </button>
        <button className="btn" onClick={() => dispatch({ type: 'RAISE', empId: e.id })}>
          <Icon name="gold" size={16} /> Give 10% raise
        </button>
        <button className="btn" disabled={e.status !== 'active'} onClick={() => dispatch({ type: 'VACATION', empId: e.id })}>
          <Icon name="sun" size={16} /> Send on vacation
        </button>
        <span className="grow" />
        <button
          className="btn btn-danger"
          onClick={() => {
            void askConfirm(`Terminate ${e.name}? Everyone loses morale${hasTrait(e, 'nepo') ? ' (a LOT — he is the Boss\'s Nephew)' : ''}.`, { ok: 'Terminate' }).then((ok) => {
              if (!ok) return;
              dispatch({ type: 'FIRE', empId: e.id });
              onClose();
            });
          }}
        >
          Terminate
        </button>
      </div>
    </Modal>
  );
}

export function Recruitment({ state, dispatch }: { state: GameState; dispatch: (a: Action) => void }) {
  const full = state.employees.length >= headcountLimit(state);
  return (
    <>
      <div className="page-head">
        <div>
          <h2>Recruitment</h2>
          <p>
            Applicant pool for week {state.week}. Headcount {state.employees.length}/{headcountLimit(state)}. New applicants arrive every week.
          </p>
        </div>
        <div className="actions">
          <button
            className="btn"
            disabled={state.gold < 15}
            onClick={() => {
              dispatch({ type: 'REFRESH_APPLICANTS' });
              play('memo');
            }}
          >
            <Icon name="mail" size={16} /> Post new job ad · 15g
          </button>
        </div>
      </div>
      {full && (
        <div className="alert bad">
          <Icon name="warn" /> Headcount limit reached. Build or upgrade Barracks (Back Office) to hire more staff.
        </div>
      )}
      {state.applicants.length === 0 ? (
        <div className="panel empty-state">No applicants left this week. Post a new job ad, or wait until next week.</div>
      ) : (
        <div className="card-grid">
          {state.applicants.map((a) => {
            const cost = hireCost(a);
            return (
              <EmployeeCard
                key={a.id}
                e={a}
                applicant
                extra={<div className="cover">“{coverLetter(a)}”</div>}
                footer={
                  <button
                    className="btn btn-primary btn-sm"
                    data-tour-target="hire-btn"
                    disabled={full || state.gold < cost}
                    onClick={() => {
                      dispatch({ type: 'HIRE', id: a.id });
                      play('hire');
                    }}
                  >
                    Hire
                  </button>
                }
              />
            );
          })}
        </div>
      )}
      <div className="panel panel-pad small muted">
        <b style={{ color: 'var(--text)' }}>Hiring tips.</b> Salary is paid every week, win or lose. The recruiting fee is paid once. Match species to rooms with good
        suitability (S/A) — a Goblin resetting traps is worth two in a hallway. New species unlock as your dungeon levels up.
      </div>
    </>
  );
}

function RelationsPanel({ id, state, onOpen }: { id: string; state: GameState; onOpen?: (id: string) => void }) {
  const rels = relationsOf(state, id).filter((r) => Math.abs(r.score) >= 10);
  return (
    <div className="panel panel-pad">
      <div className="section-title" style={{ marginBottom: 8 }}>
        <Icon name="heart" /> Workplace relationships <span className="sub">Friends in the same room: +8% each. Rivals: −8% each.</span>
      </div>
      {rels.length === 0 ? (
        <div className="small dim">No strong feelings about anyone yet. Coworkers who share a room get to know each other.</div>
      ) : (
        <div className="rel-list">
          {rels.map(({ other, score, bond }) => (
            <button key={other.id} className="rel-row" onClick={() => onOpen?.(other.id)} disabled={!onOpen}>
              <Portrait kind={other.species} hue={other.hue} size={34} />
              <span className="grow" style={{ textAlign: 'left' }}>
                <b>{other.name}</b>
                <span className="xs muted"> · {title(other)}</span>
              </span>
              <span className={`chip ${bond === 'friend' ? 'good' : bond === 'rival' ? 'bad' : ''}`}>
                {bond === 'friend' ? '♥ Friend' : bond === 'rival' ? '⚡ Rival' : score > 0 ? 'Friendly' : 'Tense'}
              </span>
              <span className="rel-meter" aria-label={`Relationship ${score}`}>
                <span style={{ left: score >= 0 ? '50%' : `${50 + score / 2}%`, width: `${Math.abs(score) / 2}%`, background: score >= 0 ? 'var(--green)' : 'var(--red)' }} />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
