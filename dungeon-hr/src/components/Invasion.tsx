import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { CLASSES, ROOMS, SPECIES } from '../game/data';
import type { SimEvent, SimResult, UnitInfo } from '../game/sim';
import type { AdvClass, GameState, SpeciesId } from '../game/types';
import { Icon } from '../ui/Icons';
import { play } from '../ui/sfx';
import { Bar, Portrait, hpColor } from './common';

type UnitStatus = 'down' | 'dead' | 'inj' | 'fled';

interface LogLine {
  id: number;
  text: string;
  cls: string;
}

interface PB {
  idx: number;
  hp: Record<string, number>;
  st: Record<string, UnitStatus | undefined>;
  roomIdx: number;
  staff: string[];
  log: LogLine[];
  outcome: 'defended' | 'breach' | null;
}

function step(pb: PB, ev: SimEvent, units: Record<string, UnitInfo>): PB {
  const next: PB = { ...pb, idx: pb.idx + 1, hp: { ...pb.hp }, st: { ...pb.st }, log: pb.log };
  const line = (text: string, cls = '') => {
    next.log = [...next.log, { id: pb.idx, text, cls }];
  };
  switch (ev.t) {
    case 'room':
      next.roomIdx = ev.roomIdx;
      next.staff = ev.staff;
      line(`▸ ${ev.text}${ev.staff.length ? ` On duty: ${ev.staff.map((s) => units[s].name).join(', ')}.` : ''}`, 'f-room');
      break;
    case 'hit':
      next.hp[ev.tgt] = ev.hp;
      line(ev.text, ev.crit ? 'warn' : units[ev.tgt]?.side === 'adv' ? 'good' : '');
      break;
    case 'heal':
      next.hp[ev.tgt] = ev.hp;
      line(ev.text, units[ev.tgt]?.side === 'adv' ? 'bad' : 'good');
      break;
    case 'down': {
      const side = units[ev.uid]?.side;
      next.st[ev.uid] = side === 'adv' ? 'down' : ev.fatal ? 'dead' : 'inj';
      line(ev.text, side === 'adv' ? 'good' : 'bad');
      break;
    }
    case 'flee':
      next.st[ev.uid] = 'fled';
      line(ev.text, 'warn');
      break;
    case 'revive':
      next.hp[ev.uid] = ev.hp;
      next.st[ev.uid] = undefined;
      line(ev.text, 'good');
      break;
    case 'log':
      line(ev.text, ev.tone ?? '');
      break;
    case 'clear':
      line(ev.text, 'info');
      break;
    case 'end':
      next.outcome = ev.outcome;
      line(ev.text, ev.outcome === 'defended' ? 'good' : 'bad');
      break;
  }
  return next;
}

const DELAY: Record<SimEvent['t'], number> = { room: 1000, hit: 420, heal: 420, down: 700, flee: 650, revive: 700, log: 750, clear: 750, end: 500 };

interface Fx {
  id: number;
  uid: string;
  text: string;
  cls: string;
}

export function InvasionView({ state, sim, onFinish }: { state: GameState; sim: SimResult; onFinish: () => void }) {
  const party = state.nextParty;
  const init: PB = useMemo(
    () => ({
      idx: 0,
      hp: Object.fromEntries(Object.values(sim.units).map((u) => [u.uid, u.hp])),
      st: {},
      roomIdx: -1,
      staff: [],
      log: [{ id: -1, text: `${party.name} ${party.members.length > 1 ? 'have' : 'has'} arrived at the main entrance. Security cameras rolling.`, cls: 'info' }],
      outcome: null,
    }),
    [sim, party],
  );
  const [pb, advance] = useReducer((s: PB, a: { type: 'step' } | { type: 'skip' }) => {
    if (a.type === 'step') return s.idx < sim.events.length ? step(s, sim.events[s.idx], sim.units) : s;
    let n = s;
    while (n.idx < sim.events.length) n = step(n, sim.events[n.idx], sim.units);
    return n;
  }, init);
  const [speed, setSpeed] = useState(2);
  const [paused, setPaused] = useState(false);
  const [fx, setFx] = useState<Fx[]>([]);
  const [flash, setFlash] = useState<Record<string, string>>({});
  const feedRef = useRef<HTMLDivElement>(null);
  const done = pb.idx >= sim.events.length;

  useEffect(() => {
    if (done || paused) return;
    const ev = sim.events[pb.idx];
    const t = setTimeout(() => {
      effects(ev);
      advance({ type: 'step' });
    }, DELAY[ev.t] / speed);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pb.idx, paused, speed, done]);

  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [pb.log.length]);

  function effects(ev: SimEvent) {
    const quiet = speed > 2;
    const addFx = (uid: string, text: string, cls: string) => {
      const id = Math.random();
      setFx((f) => [...f, { id, uid, text, cls }]);
      setTimeout(() => setFx((f) => f.filter((x) => x.id !== id)), 900);
    };
    const pulse = (uid: string, cls: string) => {
      setFlash((f) => ({ ...f, [uid]: cls }));
      setTimeout(() => setFlash((f) => (f[uid] === cls ? { ...f, [uid]: '' } : f)), 320);
    };
    if (ev.t === 'hit') {
      addFx(ev.tgt, `-${ev.dmg}`, ev.crit ? 'crit' : 'dmg');
      pulse(ev.tgt, 'hit');
      if (ev.src) pulse(ev.src, 'acting');
      if (!quiet) play(ev.tag === 'fire' ? 'fire' : ev.crit ? 'crit' : 'hit');
    } else if (ev.t === 'heal') {
      addFx(ev.tgt, `+${ev.amt}`, 'heal');
      pulse(ev.tgt, 'healed');
      if (!quiet) play('heal');
    } else if (ev.t === 'down') {
      play('down');
    } else if (ev.t === 'revive') {
      pulse(ev.uid, 'healed');
      play('heal');
    } else if (ev.t === 'end') {
      play(ev.outcome === 'defended' ? 'victory' : 'breach');
    } else if (ev.t === 'room' && !quiet) {
      play('click');
    }
  }

  const skip = () => {
    advance({ type: 'skip' });
    play(sim.outcome === 'defended' ? 'victory' : 'breach');
  };

  const room = pb.roomIdx >= 0 ? sim.rooms[pb.roomIdx] : null;
  const staffUnits = pb.staff.map((id) => sim.units[id]);
  const advUnits = party.members.map((m) => sim.units[m.id]);

  const renderUnit = (u: UnitInfo) => {
    const st = pb.st[u.uid];
    const hp = pb.hp[u.uid] ?? u.hp;
    const label = u.side === 'emp' ? SPECIES[u.kind as SpeciesId].job : CLASSES[u.kind as AdvClass].name;
    const stamp =
      st === 'down' ? { t: 'OFFBOARDED', c: '' } : st === 'dead' ? { t: 'DECEASED', c: '' } : st === 'inj' ? { t: 'INJURED', c: 'inj' } : st === 'fled' ? { t: u.side === 'adv' ? 'RETREATED' : 'FLED', c: 'fled' } : null;
    return (
      <div key={u.uid} className={`unit ${u.side === 'adv' ? 'adv' : ''} ${flash[u.uid] ?? ''} ${st ? 'down' : ''}`}>
        <Portrait kind={u.kind} hue={u.hue} size={52} dead={st === 'dead' || st === 'down'} />
        <div className="uinfo">
          <div className="uname">{u.name}</div>
          <div className="usub">
            Lv {u.level} {label}
          </div>
          <Bar value={hp} max={u.maxHp} color={hpColor(hp / u.maxHp)} />
          <div className="xs mono dim" style={{ marginTop: 2 }}>
            {Math.max(0, Math.round(hp))}/{u.maxHp}
          </div>
        </div>
        {stamp && <div className={`stamp ${stamp.c}`}>{stamp.t}</div>}
        {fx
          .filter((f) => f.uid === u.uid)
          .map((f) => (
            <span key={f.id} className={`float ${f.cls}`}>
              {f.text}
            </span>
          ))}
      </div>
    );
  };

  return (
    <div className="invasion">
      <div className="stack" style={{ gap: 12, minWidth: 0 }}>
        <div className="inv-head">
          <span className="live-dot" />
          <h2>Live Invasion Feed</h2>
          <span className="chip info">{party.name}</span>
          <span className="chip">
            <Icon name={party.night ? 'moon' : 'sun'} size={11} /> {party.night ? 'Night shift' : 'Day shift'}
          </span>
          {party.boss && <span className="chip bad">Boss wave</span>}
          <div className="controls">
            <button className="btn btn-sm" onClick={() => setPaused((p) => !p)} disabled={done}>
              {paused ? 'Resume' : 'Pause'}
            </button>
            <div className="seg">
              {[1, 2, 4].map((s) => (
                <button key={s} className={speed === s ? 'on' : ''} onClick={() => setSpeed(s)}>
                  {s}×
                </button>
              ))}
            </div>
            <button className="btn btn-sm" onClick={skip} disabled={done}>
              Skip
            </button>
          </div>
        </div>

        <div className="inv-route">
          <div className={`inv-room ${pb.roomIdx >= 0 ? 'done' : 'current'}`}>
            <Icon name="door" size={14} /> Entrance
          </div>
          {sim.rooms.map((r, i) => (
            <div key={r.id} className="row" style={{ gap: 6 }}>
              <Icon name="arrow" size={12} className="dim" />
              <div className={`inv-room ${i < pb.roomIdx ? 'done' : i === pb.roomIdx ? 'current' : ''}`}>
                <Icon name={r.type} size={14} /> {ROOMS[r.type].name}
              </div>
            </div>
          ))}
        </div>

        <div className={`stage ${party.night ? 'night' : ''}`}>
          <div className="stage-title">
            {room ? (
              <>
                <Icon name={room.type} size={14} /> {ROOMS[room.type].name.toUpperCase()}
              </>
            ) : (
              <>
                <Icon name="door" size={14} /> MAIN ENTRANCE
              </>
            )}
          </div>
          {room ? (
            <>
              <div className="side">
                <div className="side-label">Your staff</div>
                {staffUnits.length ? staffUnits.map(renderUnit) : <div className="dim small">Nobody is on shift in this room.</div>}
              </div>
              <div className="vs">VS</div>
            </>
          ) : (
            <>
              <div className="side">
                <div className="side-label">Your staff</div>
                <div className="dim small">Awaiting visitors…</div>
              </div>
              <div className="vs">VS</div>
            </>
          )}
          <div className="side right">
            <div className="side-label" style={{ textAlign: 'right' }}>
              Visitors
            </div>
            {advUnits.map(renderUnit)}
          </div>

          {done && pb.outcome && (
            <div className="outcome">
              <div className={`outcome-card ${pb.outcome === 'defended' ? 'win' : 'lose'}`}>
                <Icon name={pb.outcome === 'defended' ? 'shield' : 'vault'} size={48} className={pb.outcome === 'defended' ? 'gold' : 'bad'} />
                <h2>{pb.outcome === 'defended' ? 'THREAT NEUTRALIZED' : 'SECURITY BREACH'}</h2>
                <div className="muted">
                  {pb.outcome === 'defended'
                    ? `${sim.slain} visitor${sim.slain === 1 ? '' : 's'} offboarded${sim.retreated ? ', the rest retreated' : ''}. ${sim.loot}g in recovered "lost property".`
                    : 'The adventurers reached the treasury. Accounting is crying.'}
                </div>
                <button className="btn btn-primary btn-lg" onClick={onFinish}>
                  View Weekly Report <Icon name="arrow" size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="panel feed">
        <div className="feed-head">
          <Icon name="skull" size={16} /> Security Camera Transcript
        </div>
        <div className="feed-body" ref={feedRef}>
          {pb.log.map((l) => (
            <div key={l.id} className={`feed-line ${l.cls}`}>
              {l.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
