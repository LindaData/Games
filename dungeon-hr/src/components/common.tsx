import { useEffect, type ReactNode } from 'react';
import { GRADE_MULT, ROOMS, SPECIES, TRAITS, type Grade } from '../game/data';
import { coreStats, hireCost, moraleLabel, powerRating, title } from '../game/employees';
import type { Employee, EmployeeStatus, SpeciesId, AdvClass, TraitId, RoomTypeId } from '../game/types';
import { Avatar } from '../ui/Avatar';
import { Icon } from '../ui/Icons';
import { isTouch, showInfo } from '../ui/infotip';

const GRADE_TEXT: Record<Grade, string> = {
  S: 'Perfect fit: ×1.30 effectiveness in this room.',
  A: 'Great fit: ×1.15 effectiveness in this room.',
  B: 'Normal fit: ×1.00 effectiveness.',
  C: 'Poor fit: ×0.85 effectiveness.',
  D: 'Bad fit: ×0.70 effectiveness.',
};

export function Modal({ title: t, onClose, children, wide, icon }: { title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean; icon?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          {icon}
          <h3>{t}</h3>
          <button className="btn btn-ghost btn-icon close" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Portrait({ kind, hue, size = 56, dead }: { kind: SpeciesId | AdvClass; hue?: number; size?: number; dead?: boolean }) {
  return (
    <div className="portrait" style={{ width: size, height: size }}>
      <Avatar kind={kind} hue={hue} size={size - 4} dead={dead} />
    </div>
  );
}

export function TraitChip({ id }: { id: TraitId }) {
  const t = TRAITS[id];
  return (
    <span
      className={`chip tooltip ${t.tone}`}
      data-tip={t.desc}
      onClick={(e) => {
        if (!isTouch()) return;
        e.stopPropagation();
        showInfo(t.name, t.desc);
      }}
    >
      {t.name}
    </span>
  );
}

export function GradeBadge({ g, label }: { g: Grade; label?: string }) {
  return (
    <span
      className={`grade grade-${g} tooltip`}
      data-tip={label ?? `Job suitability: ${g}`}
      onClick={(e) => {
        if (!isTouch()) return;
        e.stopPropagation();
        showInfo(`Job fit: ${g}`, `${label ? label + '. ' : ''}${GRADE_TEXT[g]}`);
      }}
    >
      {g}
    </span>
  );
}

const STATUS_LABEL: Record<EmployeeStatus, { text: string; cls: string }> = {
  active: { text: 'Active', cls: 'good' },
  injured: { text: 'Medical leave', cls: 'bad' },
  vacation: { text: 'On vacation', cls: 'info' },
  strike: { text: 'On strike', cls: 'bad' },
  sick: { text: 'Sick leave', cls: 'mixed' },
};

export function StatusChip({ status }: { status: EmployeeStatus }) {
  if (status === 'active') return null;
  const s = STATUS_LABEL[status];
  return <span className={`chip ${s.cls}`}>{s.text}</span>;
}

export function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className="bar">
      <span style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function hpColor(ratio: number) {
  return ratio > 0.6 ? 'var(--green)' : ratio > 0.3 ? 'var(--orange)' : 'var(--red)';
}

export function StatBars({ e }: { e: Employee }) {
  const s = coreStats(e);
  const rows: [string, number, number, string][] = [
    ['HP', s.hp, 200, 'var(--red)'],
    ['ATK', s.atk, 40, 'var(--orange)'],
    ['DEF', s.def, 25, 'var(--blue)'],
    ['SPD', s.spd, 20, 'var(--teal)'],
    ['INT', s.int, 25, 'var(--purple)'],
  ];
  return (
    <div className="stats">
      {rows.map(([l, v, m, c]) => (
        <div className="statrow" key={l}>
          <span className="lbl">{l}</span>
          <Bar value={v} max={m} color={c} />
          <span className="val">{Math.round(v)}</span>
        </div>
      ))}
    </div>
  );
}

export function MoodLine({ e }: { e: Employee }) {
  const m = moraleLabel(e.morale);
  const mc = m.tone === 'good' ? 'var(--green)' : m.tone === 'ok' ? 'var(--gold)' : 'var(--red)';
  return (
    <div className="moodline">
      <div>
        <div className="lab">
          <span>Morale</span>
          <span style={{ color: mc }}>{m.label}</span>
        </div>
        <Bar value={e.morale} max={100} color={mc} />
      </div>
      <div>
        <div className="lab">
          <span>Fatigue</span>
          <span style={{ color: e.fatigue > 60 ? 'var(--red2)' : 'var(--muted)' }}>{e.fatigue > 60 ? 'Burnt out' : `${Math.round(e.fatigue)}%`}</span>
        </div>
        <Bar value={e.fatigue} max={100} color={e.fatigue > 60 ? 'var(--red)' : 'var(--muted)'} />
      </div>
    </div>
  );
}

export function Gold({ v, className }: { v: number; className?: string }) {
  return (
    <span className={`mono ${className ?? ''}`} style={{ color: v < 0 ? 'var(--red2)' : 'var(--gold2)', fontWeight: 600 }}>
      {Math.round(v).toLocaleString()}g
    </span>
  );
}

/** The rooms this species is best at (S/A grades), best first. */
export function bestJobs(e: Employee, max = 2): { name: string; grade: Grade }[] {
  return (Object.entries(SPECIES[e.species].suit) as [RoomTypeId, Grade][])
    .filter(([r, g]) => (g === 'S' || g === 'A') && r !== 'barracks')
    .sort((a, b) => GRADE_MULT[b[1]] - GRADE_MULT[a[1]] || (ROOMS[a[0]].zone === 'route' ? -1 : 1))
    .slice(0, max)
    .map(([r, g]) => ({ name: ROOMS[r].name, grade: g }));
}

export function EmployeeCard({
  e,
  onClick,
  footer,
  applicant,
  extra,
}: {
  e: Employee;
  onClick?: () => void;
  footer?: ReactNode;
  applicant?: boolean;
  extra?: ReactNode;
}) {
  const s = coreStats(e);
  const mood = moraleLabel(e.morale);
  const jobs = bestJobs(e);
  return (
    <div className={`ecard ${onClick ? 'clickable' : ''}`} onClick={onClick}>
      <div className="ecard-head">
        <Portrait kind={e.species} hue={e.hue} size={56} />
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="ecard-name">{e.name}</div>
          <div className="ecard-title">
            {title(e)} · Lv {e.level}
          </div>
          <div className="ecard-quick">
            HP {Math.round(s.hp)} · ATK {Math.round(s.atk)} · DEF {Math.round(s.def)}
          </div>
        </div>
        <div className="power" title="Overall power: higher is stronger">
          <b>{powerRating(e)}</b>
          <span>power</span>
        </div>
      </div>
      {(e.traits.length > 0 || e.status !== 'active' || (!applicant && (mood.tone === 'bad' || mood.tone === 'crit' || e.fatigue > 60))) && (
        <div className="traits">
          <StatusChip status={e.status} />
          {!applicant && (mood.tone === 'bad' || mood.tone === 'crit') && <span className="chip bad">{mood.label}</span>}
          {!applicant && e.fatigue > 60 && <span className="chip bad">Burnt out</span>}
          {e.traits.map((t) => (
            <TraitChip key={t} id={t} />
          ))}
        </div>
      )}
      {applicant && jobs.length > 0 && (
        <div className="xs muted row wrap" style={{ gap: 6 }}>
          Best at:
          {jobs.map((j) => (
            <span key={j.name} className="row" style={{ gap: 4, color: 'var(--text)' }}>
              <GradeBadge g={j.grade} /> {j.name}
            </span>
          ))}
        </div>
      )}
      {extra}
      <div className="ecard-foot">
        <Gold v={e.salary} />
        <span className="dim">/week</span>
        {applicant && (
          <>
            <span className="muted" style={{ marginLeft: 8 }}>
              + {hireCost(e)}g to hire
            </span>
          </>
        )}
        <span className="spacer" />
        {footer}
      </div>
    </div>
  );
}
