import { useRef, useState } from 'react';
import { SLOTS, deleteSlot, exportSave, importSave, listSlots, loadSlot, saveToSlot, type Slot } from '../game/save';
import type { GameState } from '../game/types';
import { Avatar } from '../ui/Avatar';
import { downloadText, saveFileName, timeAgo } from '../ui/download';
import { Icon } from '../ui/Icons';
import { play } from '../ui/sfx';

const LINEUP = ['slime', 'goblin', 'skeleton', 'orc', 'mimic', 'witch', 'vampire', 'dragon'] as const;

export function TitleScreen({ onLoad, onNew }: { onLoad: (slot: Slot, state: GameState) => void; onNew: (slot: Slot, company: string) => void }) {
  const [slots, setSlots] = useState(listSlots);
  const [creating, setCreating] = useState<Slot | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const importTarget = useRef<Slot>(1);
  const anySave = SLOTS.some((s) => slots[s]);

  const startImport = (slot: Slot) => {
    importTarget.current = slot;
    setError(null);
    fileRef.current?.click();
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const state = importSave(await file.text());
      const slot = importTarget.current;
      if (slots[slot] && !confirm(`Overwrite slot ${slot} (${slots[slot]!.company})?`)) return;
      saveToSlot(state, slot);
      setSlots(listSlots());
      play('hire');
    } catch (e) {
      setError((e as Error).message);
      play('error');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="title-screen">
      <div className="title-card">
        <div className="title-lineup">
          {LINEUP.map((k, i) => (
            <div key={k} className="portrait" style={{ width: 58, height: 58, animationDelay: `${-i * 0.4}s` }}>
              <Avatar kind={k} size={54} hue={0} />
            </div>
          ))}
        </div>
        <div className="logo">
          DUNGEON
          <br />
          HR
        </div>
        <div className="tagline">
          Human <i>(and Inhuman)</i> Resources. Hire monsters, manage morale, survive the quarterly invasion. The adventurers are coming. So is the union.
        </div>

        <div className="slots">
          {SLOTS.map((slot) => {
            const info = slots[slot];
            if (creating === slot) {
              return (
                <div key={slot} className="slot-card active">
                  <div className="slot-label">Slot {slot} · New company</div>
                  <input
                    className="title-input"
                    autoFocus
                    placeholder="Company name (e.g. Doom & Associates)"
                    value={name}
                    maxLength={40}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && onNew(slot, name.trim() || 'Doom & Associates')}
                  />
                  <div className="row">
                    <button className="btn btn-primary grow" onClick={() => onNew(slot, name.trim() || 'Doom & Associates')}>
                      {info ? 'Overwrite & start' : 'Start your first week'}
                    </button>
                    <button className="btn" onClick={() => setCreating(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              );
            }
            if (!info) {
              return (
                <div key={slot} className="slot-card empty">
                  <div className="slot-label">Slot {slot} · Empty</div>
                  <div className="row">
                    <button
                      className={`btn grow ${!anySave && slot === 1 ? 'btn-primary' : ''}`}
                      onClick={() => {
                        setCreating(slot);
                        setName('');
                        play('click');
                      }}
                    >
                      <Icon name="plus" size={15} /> New game
                    </button>
                    <button className="btn" onClick={() => startImport(slot)} title="Import a save file into this slot">
                      <Icon name="upload" size={15} /> Import
                    </button>
                  </div>
                </div>
              );
            }
            return (
              <div key={slot} className="slot-card">
                <div className="slot-label">
                  Slot {slot} · saved {timeAgo(info.savedAt)}
                </div>
                <div className="slot-company">{info.company}</div>
                <div className="slot-meta">
                  Week {info.week} · Dungeon Lv {info.level} · {Math.round(info.gold)}g · {info.staff} staff ·{' '}
                  <span className="hearts" style={{ display: 'inline-flex' }}>
                    {[0, 1, 2].map((i) => (
                      <Icon key={i} name="heart" size={12} className={i < info.board ? 'on' : 'off'} />
                    ))}
                  </span>
                </div>
                <div className="row wrap">
                  <button
                    className="btn btn-primary grow"
                    onClick={() => {
                      const s = loadSlot(slot);
                      if (s) onLoad(slot, s);
                    }}
                  >
                    Continue
                  </button>
                  <button
                    className="btn btn-icon"
                    aria-label="Export save"
                    title="Export save file"
                    onClick={() => {
                      const s = loadSlot(slot);
                      if (s) downloadText(saveFileName(s.company, s.week), exportSave(s));
                    }}
                  >
                    <Icon name="download" size={16} />
                  </button>
                  <button className="btn btn-icon" aria-label="Import into slot" title="Import a save file into this slot" onClick={() => startImport(slot)}>
                    <Icon name="upload" size={16} />
                  </button>
                  <button
                    className="btn btn-icon btn-danger"
                    aria-label="Delete save"
                    title="Delete this save"
                    onClick={() => {
                      if (confirm(`Delete "${info.company}" (slot ${slot})? This can't be undone.`)) {
                        deleteSlot(slot);
                        setSlots(listSlots());
                      }
                    }}
                  >
                    <Icon name="close" size={16} />
                  </button>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => {
                      setCreating(slot);
                      setName('');
                    }}
                  >
                    New game here
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {error && <div className="alert bad">{error}</div>}
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onFile(e.target.files?.[0])} />

        <div className="panel panel-pad howto">
          <div>
            <b>1. Hire</b> monsters from the applicant pool. Each has stats, a salary, and personality traits.
          </div>
          <div>
            <b>2. Assign</b> them to rooms along the invasion route. Species suit some jobs better (S → D).
          </div>
          <div>
            <b>3. Open for business.</b> Adventurers walk the route; your staff fight automatically.
          </div>
          <div>
            <b>4. Handle HR.</b> Raises, unions, feuds, birthdays, resignations. Morale and friendships drive performance.
          </div>
          <div>
            <b>5. Grow.</b> Earn gold, level the dungeon, unlock rooms, monsters, tech, and questionable policies.
          </div>
        </div>
      </div>
    </div>
  );
}
