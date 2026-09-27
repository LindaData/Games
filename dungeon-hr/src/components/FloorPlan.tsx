import { useEffect, useState, type DragEvent } from 'react';
import { OFFICE_ROOMS, ROOMS, ROUTE_ROOMS, officeSlotsFor, routeSlotsFor, GRADE_MULT } from '../game/data';
import { getRoom, headcountLimit, roomAt, roomCapacity, roomStaff, routeOrder, upgradeCost, buildCost, vaultRoom } from '../game/dungeon';
import { powerRating, suitability, title } from '../game/employees';
import { bond } from '../game/relations';
import type { Action } from '../game/state';
import type { Employee, GameState, Room, Zone } from '../game/types';
import { Avatar } from '../ui/Avatar';
import { Icon } from '../ui/Icons';
import { play } from '../ui/sfx';
import { askConfirm } from '../ui/confirm';
import { Gold, GradeBadge, Modal, Portrait } from './common';

const MAX_ROUTE = 7;
const MAX_OFFICE = 7;

interface Props {
  state: GameState;
  dispatch: (a: Action) => void;
  onOpenEmployee: (id: string) => void;
}

function unlockLevelFor(slot: number, fn: (l: number) => number): number {
  for (let l = 1; l <= 20; l++) if (fn(l) > slot) return l;
  return 99;
}

const STATUS_BADGE: Record<string, string> = { injured: 'INJ', vacation: 'OOO', strike: 'STRIKE', sick: 'SICK' };

export function FloorPlan({ state, dispatch, onOpenEmployee }: Props) {
  const [panel, setPanel] = useState<string | null>(null);
  const [buildAt, setBuildAt] = useState<{ zone: Zone; slot: number } | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSelected(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const assign = (empId: string, roomId: string | null) => {
    dispatch({ type: 'ASSIGN', empId, roomId });
    play('click');
  };

  const onDragStart = (e: DragEvent, empId: string) => {
    e.dataTransfer.setData('text/emp', empId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const dropProps = (roomId: string | null, key: string) => ({
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes('text/emp')) return;
      e.preventDefault();
      setDragOver(key);
    },
    onDragLeave: () => setDragOver((d) => (d === key ? null : d)),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      setDragOver(null);
      const id = e.dataTransfer.getData('text/emp');
      if (id) assign(id, roomId);
    },
  });

  const onRoomClick = (room: Room) => {
    if (selected && room.type !== 'barracks') {
      assign(selected, room.id);
      setSelected(null);
      return;
    }
    setPanel(room.id);
  };

  const bench = state.employees.filter((e) => !e.roomId);
  const route = routeOrder(state).filter((r) => r.type !== 'vault');
  const vault = vaultRoom(state);
  const selectedEmp = state.employees.find((e) => e.id === selected);

  const renderRoom = (room: Room) => {
    const def = ROOMS[room.type];
    const staff = roomStaff(state, room.id);
    const cap = roomCapacity(room);
    const key = room.id;
    return (
      <div
        key={room.id}
        className={`room ${room.type === 'vault' ? 'vault' : ''} ${dragOver === key ? 'drop-ok' : ''}`}
        data-tour-target={room.type === 'vault' ? 'vault' : undefined}
        onClick={() => onRoomClick(room)}
        {...(room.type !== 'barracks' ? dropProps(room.id, key) : {})}
      >
        <div className="room-band" style={{ background: def.color }} />
        <div className="room-head">
          <div className="room-icon" style={{ color: def.color }}>
            <Icon name={room.type} size={18} />
          </div>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="room-name">{def.name}</div>
            <div className="room-lvl">
              Lv {room.level}/{def.maxLevel}
              {cap > 0 && ` · ${staff.length}/${cap} staff`}
            </div>
          </div>
        </div>
        <ChemistryBadge state={state} staff={staff} />
        <div className="room-effect">{def.effect(room.level)}</div>
        {cap > 0 ? (
          <div className="room-staff">
            {Array.from({ length: cap }).map((_, i) => {
              const e = staff[i];
              if (!e) return <div key={i} className="slot"><Icon name="plus" size={14} /></div>;
              return (
                <div
                  key={e.id}
                  className="slot filled tooltip"
                  data-tip={`${e.name} · ${title(e)} · Suitability ${suitability(e.species, room.type)}`}
                  draggable
                  onDragStart={(ev) => onDragStart(ev, e.id)}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onOpenEmployee(e.id);
                  }}
                >
                  <Avatar kind={e.species} hue={e.hue} size={38} dead={e.status !== 'active'} />
                  {e.status !== 'active' && <span className="mini-status">{STATUS_BADGE[e.status]}</span>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="room-staff muted xs">
            <Icon name="users" size={14} /> Headcount limit: {headcountLimit(state)}
          </div>
        )}
      </div>
    );
  };

  const renderEmpty = (zone: Zone, slot: number, max: number, fn: (l: number) => number) => {
    if (slot >= max) {
      return (
        <div key={`${zone}-${slot}`} className="room empty locked">
          <Icon name="lock" />
          <span className="xs">Unlocks at Lv {unlockLevelFor(slot, fn)}</span>
        </div>
      );
    }
    return (
      <button
        key={`${zone}-${slot}`}
        data-tour-target="empty-slot"
        className="room empty"
        onClick={() => {
          setBuildAt({ zone, slot });
          play('click');
        }}
      >
        <Icon name="plus" size={22} />
        <span>Build room</span>
      </button>
    );
  };

  const routeSlots = Array.from({ length: Math.min(MAX_ROUTE, Math.max(state.routeSlots + 1, 4)) }, (_, i) => i);
  const officeSlots = Array.from({ length: Math.min(MAX_OFFICE, Math.max(state.officeSlots + 1, 4)) }, (_, i) => i);

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Floor Plan</h2>
          <p>Tap a staff member, then tap a room to assign them. Tap a room to manage it. On a computer you can also drag.</p>
        </div>
      </div>

      {selectedEmp && (
        <div className="alert info">
          <Icon name="users" />
          <span className="grow">
            Assigning <b>{selectedEmp.name}</b> — click a room to place them. <span className="dim">(Esc to cancel)</span>
          </span>
          <button className="btn btn-sm" onClick={() => setSelected(null)}>
            Cancel
          </button>
        </div>
      )}

      <div className="panel panel-pad">
        <div className="section-title">
          <Icon name="sword" /> Invasion Route <span className="sub">Visitors walk left to right. Every room they clear brings them closer to the gold.</span>
        </div>
        <div className="route">
          <div className="entrance">
            <Icon name="door" size={26} />
            Main Entrance
            <span className="dim">Visitor parking</span>
          </div>
          {routeSlots.map((slot) => {
            const room = route.find((r) => r.slot === slot);
            return (
              <div key={slot} className="row" style={{ gap: 6, alignItems: 'stretch' }}>
                <div className="route-arrow">
                  <Icon name="arrow" size={16} />
                </div>
                {room ? renderRoom(room) : renderEmpty('route', slot, state.routeSlots, routeSlotsFor)}
              </div>
            );
          })}
          <div className="route-arrow">
            <Icon name="arrow" size={16} />
          </div>
          {renderRoom(vault)}
        </div>
      </div>

      <div className="panel panel-pad">
        <div className="section-title">
          <Icon name="book" /> Back Office <span className="sub">Support facilities. Staff assigned here work jobs instead of fighting.</span>
        </div>
        <div className="office-grid">
          {officeSlots.map((slot) => {
            const room = roomAt(state, 'office', slot);
            return room ? renderRoom(room) : renderEmpty('office', slot, state.officeSlots, officeSlotsFor);
          })}
        </div>
      </div>

      <div className="panel panel-pad">
        <div className="section-title">
          <Icon name="users" /> The Bench <span className="sub">Unassigned staff recover fatigue but earn nothing and slowly lose morale. Drop staff here to unassign.</span>
        </div>
        <div className={`bench ${dragOver === 'bench' ? 'drop-ok' : ''}`} data-tour-target="bench" {...dropProps(null, 'bench')}>
          {bench.length === 0 && <span className="dim small" style={{ alignSelf: 'center' }}>Everyone has a job. Very efficient. Slightly dystopian.</span>}
          {bench.map((e) => (
            <div
              key={e.id}
              className={`staff-chip ${selected === e.id ? 'selected' : ''}`}
              draggable
              onDragStart={(ev) => onDragStart(ev, e.id)}
              onClick={() => setSelected(selected === e.id ? null : e.id)}
              onDoubleClick={() => onOpenEmployee(e.id)}
            >
              <Avatar kind={e.species} hue={e.hue} size={34} dead={e.status !== 'active'} />
              <div>
                <div className="nm">{e.name}</div>
                <div className="sub">
                  {title(e)} · Lv {e.level}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {panel && getRoom(state, panel) && (
        <RoomPanel
          room={getRoom(state, panel)!}
          state={state}
          dispatch={dispatch}
          onClose={() => setPanel(null)}
          onOpenEmployee={onOpenEmployee}
        />
      )}
      {buildAt && (
        <BuildModal
          state={state}
          zone={buildAt.zone}
          onClose={() => setBuildAt(null)}
          onBuild={(type) => {
            dispatch({ type: 'BUILD', zone: buildAt.zone, slot: buildAt.slot, roomType: type });
            play('build');
            setBuildAt(null);
          }}
        />
      )}
    </>
  );
}

function RoomPanel({
  room,
  state,
  dispatch,
  onClose,
  onOpenEmployee,
}: {
  room: Room;
  state: GameState;
  dispatch: (a: Action) => void;
  onClose: () => void;
  onOpenEmployee: (id: string) => void;
}) {
  const def = ROOMS[room.type];
  const staff = roomStaff(state, room.id);
  const cap = roomCapacity(room);
  const maxed = room.level >= def.maxLevel;
  const cost = upgradeCost(room);
  const others: Employee[] = state.employees
    .filter((e) => e.roomId !== room.id)
    .sort((a, b) => GRADE_MULT[suitability(b.species, room.type)] - GRADE_MULT[suitability(a.species, room.type)] || powerRating(b) - powerRating(a));

  return (
    <Modal
      title={`${def.name} · Lv ${room.level}`}
      onClose={onClose}
      icon={
        <div className="room-icon" style={{ color: def.color }}>
          <Icon name={room.type} size={20} />
        </div>
      }
    >
      <p className="muted" style={{ margin: 0 }}>
        {def.desc}
      </p>
      <div className="kv">
        <div>
          <div className="k">Current effect</div>
          <div className="small">{def.effect(room.level)}</div>
        </div>
        {!maxed && (
          <div>
            <div className="k">Next level</div>
            <div className="small">{def.effect(room.level + 1)}</div>
          </div>
        )}
        {cap > 0 && (
          <div>
            <div className="k">Positions</div>
            <div className="v">
              {staff.length}/{cap}
            </div>
          </div>
        )}
      </div>
      <div className="row wrap">
        {!maxed && (
          <button
            className="btn btn-primary"
            disabled={state.gold < cost}
            onClick={() => {
              dispatch({ type: 'UPGRADE', roomId: room.id });
              play('build');
            }}
          >
            <Icon name="up" size={16} /> Upgrade · {cost}g
          </button>
        )}
        {room.type !== 'vault' && (
          <button
            className="btn btn-danger"
            onClick={() => {
              void askConfirm(`Demolish the ${def.name}? You'll get ${Math.round(buildCost(room.type) * 0.5)}g back and its staff go to the bench.`, { ok: 'Demolish' }).then((ok) => {
                if (!ok) return;
                dispatch({ type: 'DEMOLISH', roomId: room.id });
                onClose();
              });
            }}
          >
            Demolish · +{Math.round(buildCost(room.type) * 0.5)}g
          </button>
        )}
      </div>

      {cap > 0 && (
        <>
          <div className="section-title" style={{ marginBottom: 0 }}>
            Assigned staff
          </div>
          <div className="assign-list">
            {staff.length === 0 && <div className="dim small">Nobody works here yet.</div>}
            {staff.map((e) => (
              <div key={e.id} className="assign-row">
                <Portrait kind={e.species} hue={e.hue} size={40} />
                <div style={{ minWidth: 0, cursor: 'pointer' }} onClick={() => onOpenEmployee(e.id)}>
                  <div style={{ fontWeight: 700 }}>{e.name}</div>
                  <div className="xs muted">
                    {title(e)} · Lv {e.level}
                    {e.status !== 'active' && <span className="bad"> · {e.status}</span>}
                  </div>
                </div>
                <GradeBadge g={suitability(e.species, room.type)} />
                <button className="btn btn-sm" onClick={() => dispatch({ type: 'ASSIGN', empId: e.id, roomId: null })}>
                  Unassign
                </button>
              </div>
            ))}
          </div>
          <div className="section-title" style={{ marginBottom: 0 }}>
            Available staff <span className="sub">Sorted by job suitability</span>
          </div>
          <div className="assign-list">
            {others.length === 0 && <div className="dim small">No other staff. Visit Recruitment.</div>}
            {others.map((e) => {
              const where = getRoom(state, e.roomId);
              return (
                <div key={e.id} className="assign-row">
                  <Portrait kind={e.species} hue={e.hue} size={40} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{e.name}</div>
                    <div className="xs muted">
                      {title(e)} · Lv {e.level} · {where ? ROOMS[where.type].name : 'Bench'}
                      {e.status !== 'active' && <span className="bad"> · {e.status}</span>}
                      <BondHints state={state} emp={e} staff={staff} />
                    </div>
                  </div>
                  <GradeBadge g={suitability(e.species, room.type)} />
                  <button
                    className="btn btn-sm"
                    disabled={staff.length >= cap}
                    onClick={() => {
                      dispatch({ type: 'ASSIGN', empId: e.id, roomId: room.id });
                      play('click');
                    }}
                  >
                    Assign
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Modal>
  );
}

function BuildModal({ state, zone, onClose, onBuild }: { state: GameState; zone: Zone; onClose: () => void; onBuild: (t: Room['type']) => void }) {
  const types = (zone === 'route' ? ROUTE_ROOMS : OFFICE_ROOMS).map((t) => ROOMS[t]);
  return (
    <Modal title={zone === 'route' ? 'Build: Invasion Route' : 'Build: Back Office'} onClose={onClose} wide>
      <div className="build-grid">
        {types.map((d) => {
          const locked = d.unlock > state.dungeonLevel;
          const poor = state.gold < d.cost;
          const count = state.rooms.filter((r) => r.type === d.id).length;
          return (
            <button key={d.id} className="build-card" disabled={locked || poor} onClick={() => onBuild(d.id)}>
              <div className="t">
                <span className="room-icon" style={{ color: d.color }}>
                  <Icon name={d.id} size={16} />
                </span>
                {d.name}
                <span style={{ marginLeft: 'auto' }}>{locked ? <span className="chip">Lv {d.unlock}</span> : <Gold v={d.cost} />}</span>
              </div>
              <div className="d">{d.desc}</div>
              <div className="e">{d.effect(1)}</div>
              {count > 0 && <div className="xs dim">You have {count}.</div>}
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

function ChemistryBadge({ state, staff }: { state: GameState; staff: Employee[] }) {
  let friends = 0;
  let rivals = 0;
  for (let i = 0; i < staff.length; i++) {
    for (let j = i + 1; j < staff.length; j++) {
      const b = bond(state, staff[i].id, staff[j].id);
      if (b === 'friend') friends += 1;
      if (b === 'rival') rivals += 1;
    }
  }
  if (!friends && !rivals) return null;
  return (
    <div className="room-chem">
      {friends > 0 && (
        <span className="chip good tooltip" data-tip="Friends working together: +8% each">
          ♥ {friends}
        </span>
      )}
      {rivals > 0 && (
        <span className="chip bad tooltip" data-tip="Rivals stuck together: −8% each, and feuds">
          ⚡ {rivals}
        </span>
      )}
    </div>
  );
}

function BondHints({ state, emp, staff }: { state: GameState; emp: Employee; staff: Employee[] }) {
  const friends = staff.filter((o) => bond(state, emp.id, o.id) === 'friend');
  const rivals = staff.filter((o) => bond(state, emp.id, o.id) === 'rival');
  return (
    <>
      {friends.length > 0 && <span className="good"> · ♥ friends with {friends.map((f) => f.name).join(', ')}</span>}
      {rivals.length > 0 && <span className="bad"> · ⚡ rival of {rivals.map((r) => r.name).join(', ')}</span>}
    </>
  );
}
