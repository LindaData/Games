import { useState } from 'react';
import { CLASSES, GRADE_MULT, ROOMS, SPECIES, SPECIES_ORDER, TRAITS, type Grade } from '../game/data';
import type { AdvClass, RoomTypeId, TraitId } from '../game/types';
import { Icon } from '../ui/Icons';
import { GradeBadge, Modal, Portrait } from './common';

type Section = 'basics' | 'stats' | 'fit' | 'traits' | 'relations' | 'species' | 'adventurers' | 'rooms';

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'basics', label: 'Basics' },
  { id: 'stats', label: 'Stats & morale' },
  { id: 'fit', label: 'Job fit' },
  { id: 'traits', label: 'Traits' },
  { id: 'relations', label: 'Relationships' },
  { id: 'species', label: 'Monsters' },
  { id: 'adventurers', label: 'Adventurers' },
  { id: 'rooms', label: 'Rooms' },
];

export function Handbook({ onClose, initial = 'basics' }: { onClose: () => void; initial?: Section }) {
  const [section, setSection] = useState<Section>(initial);
  return (
    <Modal title="Employee Handbook" onClose={onClose} wide icon={<Icon name="book" size={22} className="gold" />}>
      <div className="seg">
        {SECTIONS.map((s) => (
          <button key={s.id} className={section === s.id ? 'on' : ''} onClick={() => setSection(s.id)}>
            {s.label}
          </button>
        ))}
      </div>
      <div className="handbook">
        {section === 'basics' && <Basics />}
        {section === 'stats' && <StatsSection />}
        {section === 'fit' && <Fit />}
        {section === 'traits' && <Traits />}
        {section === 'relations' && <Relations />}
        {section === 'species' && <Species />}
        {section === 'adventurers' && <Adventurers />}
        {section === 'rooms' && <Rooms />}
      </div>
    </Modal>
  );
}

function Basics() {
  return (
    <>
      <h4>The weekly loop</h4>
      <ol>
        <li>
          <b>Manage.</b> Hire, assign, build, research and set policies. Nothing happens until you open for business.
        </li>
        <li>
          <b>Invasion.</b> Adventurers walk the <b>Invasion Route</b> left to right. In each room they fight whoever is assigned there. Staff in the Back Office never fight.
        </li>
        <li>
          <b>Report.</b> You earn the bounty and loot if the party is stopped. If they clear the <b>Treasure Vault</b> they steal part of your gold.
        </li>
        <li>
          <b>HR Inbox.</b> Decide every memo before the next shift.
        </li>
      </ol>
      <h4>Winning and losing</h4>
      <p>
        The Board has five hearts of confidence. After a 6-week grace period, every breach costs one; two clean weeks in a row restore one. Lose them all and you're out. Survive 24
        weeks and the company IPOs (you can keep playing). The win-chance meter tells you how likely you are to stop next week's visitors.
      </p>
      <h4>Money</h4>
      <p>Salaries are paid every week whether you win or lose. Unpaid staff lose a lot of morale and may walk out. Keep a buffer.</p>
      <h4>Injuries and deaths</h4>
      <p>
        Knocked-out staff usually survive with an injury. Without a <b>Medical Bay</b>, injured staff may miss the next week; with one, they're patched up immediately and fewer
        knockouts are fatal.
      </p>
    </>
  );
}

function StatsSection() {
  return (
    <>
      <dl className="glossary">
        <dt>HP</dt>
        <dd>Health. Persists between weeks: staff heal 60% of max HP per week (fully with a Medical Bay).</dd>
        <dt>ATK</dt>
        <dd>Damage dealt per hit, before the target's defense.</dd>
        <dt>DEF</dt>
        <dd>Reduces incoming damage (damage × 25 ÷ (25 + DEF)).</dd>
        <dt>SPD</dt>
        <dd>Acts earlier in each round. Much faster than the enemy means a chance of extra actions.</dd>
        <dt>INT</dt>
        <dd>Boosts trap damage, research output, medics and accountants.</dd>
        <dt>Morale</dt>
        <dd>
          A combat multiplier: 0 morale = ×0.8, 50 = ×1.0, 100 = ×1.2. Below 20, staff write resignation letters; at 5 or below they walk out.
        </dd>
        <dt>Fatigue</dt>
        <dd>Rises when working. Above 60, staff are burnt out and lose effectiveness. Break Rooms, the bench and vacations reduce it.</dd>
        <dt>XP & levels</dt>
        <dd>Each level adds 10% to stats. Promotions (every two levels) add a new title, +8% stats and +20% salary.</dd>
        <dt>Power</dt>
        <dd>A rough single number for comparing employees. It ignores room fit and situational bonuses.</dd>
      </dl>
    </>
  );
}

function Fit() {
  return (
    <>
      <p>Every species has a suitability grade for every room. It multiplies how well they perform there:</p>
      <div className="row wrap" style={{ gap: 14 }}>
        {(Object.keys(GRADE_MULT) as Grade[]).map((g) => (
          <span key={g} className="row">
            <GradeBadge g={g} /> ×{GRADE_MULT[g].toFixed(2)}
          </span>
        ))}
      </div>
      <p>For example, a Goblin (S at traps) resetting a Trap Corridor is worth far more than the same Goblin standing in a Guard Post (C). The room panel sorts candidates by grade.</p>
      <table className="perf">
        <thead>
          <tr>
            <th>Species</th>
            <th>Best rooms</th>
          </tr>
        </thead>
        <tbody>
          {SPECIES_ORDER.map((id) => {
            const sp = SPECIES[id];
            const best = (Object.entries(sp.suit) as [RoomTypeId, Grade][]).filter(([, g]) => g === 'S' || g === 'A');
            return (
              <tr key={id}>
                <td>{sp.name}</td>
                <td>
                  <span className="row wrap" style={{ gap: 8 }}>
                    {best.map(([r, g]) => (
                      <span key={r} className="row" style={{ gap: 4 }}>
                        <GradeBadge g={g} /> {ROOMS[r].name}
                      </span>
                    ))}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

function Traits() {
  return (
    <dl className="glossary">
      {(Object.keys(TRAITS) as TraitId[]).map((t) => (
        <div key={t} style={{ display: 'contents' }}>
          <dt>
            <span className={`chip ${TRAITS[t].tone}`}>{TRAITS[t].name}</span>
          </dt>
          <dd>{TRAITS[t].desc}</dd>
        </div>
      ))}
    </dl>
  );
}

function Relations() {
  return (
    <>
      <p>Employees who share a room build relationships over time. Each pair has a score from −100 to +100.</p>
      <dl className="glossary">
        <dt>♥ Friends (+40)</dt>
        <dd>+8% effectiveness for each friend in the same room (up to two). Losing a friend hurts morale.</dd>
        <dt>⚡ Rivals (−40)</dt>
        <dd>−8% effectiveness for each rival in the same room. Rivals sharing a room generate feud memos.</dd>
        <dt>What helps</dt>
        <dd>Working together, winning together, the same species, Team Players, birthday cake, mediation, team-building retreats.</dd>
        <dt>What hurts</dt>
        <dd>Office Gossips, Lone Wolves, taking sides in disputes, losing fights together, and someone microwaving fish.</dd>
      </dl>
      <p>Relationships slowly fade between people who don't work together. The Floor Plan and room panel show who gets along.</p>
    </>
  );
}

function Species() {
  return (
    <div className="stack">
      {SPECIES_ORDER.map((id) => {
        const sp = SPECIES[id];
        return (
          <div key={id} className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
            <Portrait kind={id} size={52} />
            <div className="grow">
              <div>
                <b>{sp.name}</b> <span className="muted">— {sp.job}</span> <span className="chip">Unlocks at Lv {sp.unlock}</span> <span className="chip gold">~{sp.salary}g/wk</span>
              </div>
              <div className="small muted">{sp.blurb}</div>
              <div className="small">{sp.ability}</div>
              <div className="xs dim mono">
                HP {sp.base.hp} · ATK {sp.base.atk} · DEF {sp.base.def} · SPD {sp.base.spd} · INT {sp.base.int}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Adventurers() {
  return (
    <div className="stack">
      {(Object.keys(CLASSES) as AdvClass[]).map((id) => {
        const c = CLASSES[id];
        return (
          <div key={id} className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
            <Portrait kind={id} size={48} />
            <div className="grow">
              <b>{c.name}</b>
              <div className="small">
                <span className="good">Strength:</span> {c.strength}
              </div>
              <div className="small">
                <span className="bad">Weakness:</span> {c.weakness}
              </div>
            </div>
          </div>
        );
      })}
      <p className="small muted">
        Night shifts come every 3rd week (vampires and Night Owls fight better). The Quarterly Audit, a boss wave, arrives every 8th week. You'll get a memo the week before.
      </p>
    </div>
  );
}

function Rooms() {
  return (
    <div className="stack">
      {(Object.keys(ROOMS) as RoomTypeId[]).map((id) => {
        const r = ROOMS[id];
        return (
          <div key={id} className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
            <span className="room-icon" style={{ color: r.color }}>
              <Icon name={id} size={18} />
            </span>
            <div className="grow">
              <b>{r.name}</b> <span className="chip">{r.zone === 'route' ? 'Invasion route' : 'Back office'}</span>{' '}
              {r.buildable && <span className="chip gold">{r.cost}g</span>} {r.unlock > 1 && <span className="chip">Lv {r.unlock}</span>}
              <div className="small muted">{r.desc}</div>
              <div className="small" style={{ color: '#b4d3f2' }}>
                {r.effect(1)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
