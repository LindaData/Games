import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { Readiness } from './components/Readiness';
import { forecast, type Forecast } from './game/forecast';
import { TopBar } from './components/Chrome';
import { Coach, Tip, type CoachTab } from './components/Coach';
import { Memorial, Policies, Research } from './components/Company';
import { FloorPlan } from './components/FloorPlan';
import { Handbook } from './components/Handbook';
import { InvasionView } from './components/Invasion';
import { GameOver, HrInbox, Report } from './components/Phases';
import { EmployeeModal, Recruitment, StaffDirectory } from './components/Staff';
import { TitleScreen } from './components/Title';
import { Modal } from './components/common';
import { headcountLimit } from './game/dungeon';
import { deleteSlot, exportSave, saveToSlot, type Slot } from './game/save';
import { simulateInvasion, type SimResult } from './game/sim';
import { newGame, reducer } from './game/state';
import type { GameState } from './game/types';
import { downloadText, saveFileName } from './ui/download';
import { Icon } from './ui/Icons';
import { isMuted, play, setMuted } from './ui/sfx';
import { roomStaff, vaultRoom } from './game/dungeon';
import { askConfirm } from './ui/confirm';

type Tab = CoachTab;

function initialState(): GameState {
  return { ...newGame(), phase: 'title' };
}

export default function App() {
  const [slot, setSlot] = useState<Slot | null>(null);
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [tab, setTab] = useState<Tab>('floor');
  const [sim, setSim] = useState<SimResult | null>(null);
  const [openEmp, setOpenEmp] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [help, setHelp] = useState(false);
  const [more, setMore] = useState(false);
  const [muted, setMutedState] = useState(isMuted());
  const [toast, setToast] = useState<GameState['toast']>(null);
  const isMobile = useIsMobile();
  // Win-chance forecast for the next invasion, shown in the Readiness card and the phone dock.
  const fc = useMemo(() => (state.phase === 'manage' ? forecast(state) : null), [state]);

  useEffect(() => {
    if (slot) saveToSlot(state, slot);
  }, [state, slot]);

  // Keyed on the toast id: every reducer action clones state, so the object identity always changes.
  const toastId = state.toast?.id;
  useEffect(() => {
    if (!state.toast) return;
    setToast(state.toast);
    if (state.toast.tone === 'bad') play('error');
    const t = setTimeout(() => setToast(null), 3700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toastId]);

  // A reload mid-invasion loses the simulation; fall back to the office.
  useEffect(() => {
    if (state.phase === 'invasion' && !sim) dispatch({ type: 'GO', phase: 'manage' });
  }, [state.phase, sim]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [state.phase]);

  const start = useCallback(() => {
    const result = simulateInvasion(state, state.nextParty, Math.random);
    setSim(result);
    dispatch({ type: 'START_INVASION' });
    play('breach');
  }, [state]);

  const finish = useCallback(() => {
    if (!sim) return;
    dispatch({ type: 'APPLY_INVASION', sim });
    setSim(null);
    play('coin');
  }, [sim]);

  const toTitle = () => {
    setMenu(false);
    setSlot(null);
    dispatch({ type: 'TO_TITLE' });
  };

  if (state.phase === 'title') {
    return (
      <TitleScreen
        onLoad={(s, loaded) => {
          setSlot(s);
          setTab('floor');
          dispatch({ type: 'LOAD', state: loaded });
          play('click');
        }}
        onNew={(s, company) => {
          deleteSlot(s);
          setSlot(s);
          setTab('floor');
          dispatch({ type: 'NEW_GAME', company });
          play('hire');
        }}
      />
    );
  }

  if (state.phase === 'gameover') {
    return <GameOver state={state} onNew={toTitle} />;
  }

  const nav: { id: Tab; label: string; icon: Parameters<typeof Icon>[0]['name']; count?: string }[] = [
    { id: 'floor', label: 'Dungeon', icon: 'vault' },
    { id: 'staff', label: 'Team', icon: 'users', count: `${state.employees.length}/${headcountLimit(state)}` },
    { id: 'recruit', label: 'Hire', icon: 'mail', count: String(state.applicants.length) },
    { id: 'rnd', label: 'Upgrades', icon: 'up' },
  ];
  const navTab: Tab = tab === 'policies' ? 'rnd' : tab === 'memorial' ? 'staff' : tab;

  return (
    <div className="app">
      <TopBar state={state} onMenu={() => setMenu(true)} onHelp={() => setHelp(true)} />

      {state.phase === 'invasion' && sim && (
        <>
          <div className="tip-bar">
            <Tip id="invasion" state={state} dispatch={dispatch}>
              Your staff fight on their own, room by room. Tap <b>Skip</b> to jump to the result.
            </Tip>
          </div>
          <InvasionView state={state} sim={sim} onFinish={finish} />
        </>
      )}
      {state.phase === 'report' && (
        <>
          <div className="tip-bar">
            <Tip id="report" state={state} dispatch={dispatch}>
              How the week went. Tap <b>Full breakdown</b> for details, then continue.
            </Tip>
          </div>
          <Report state={state} dispatch={dispatch} />
        </>
      )}
      {state.phase === 'hr' && (
        <>
          <div className="tip-bar">
            <Tip id="hr" state={state} dispatch={dispatch}>
              Decide each memo before the next shift, or tap <b>Handle all</b> to accept the ★ recommended choices. Greyed-out options need more gold.
            </Tip>
          </div>
          <HrInbox state={state} dispatch={dispatch} />
        </>
      )}

      {state.phase === 'manage' && (
        <main className="main">
          <nav className="sidenav">
            {nav.map((n) => (
              <button
                key={n.id}
                data-tour-target={`nav-${n.id}`}
                className={`navbtn ${navTab === n.id ? 'active' : ''}`}
                onClick={() => {
                  setTab(n.id);
                  play('click');
                }}
              >
                <Icon name={n.icon} size={17} />
                {n.label}
                {n.count && <span className="count">{n.count}</span>}
              </button>
            ))}
            <button className="navbtn" onClick={() => setHelp(true)}>
              <Icon name="book" size={17} />
              Handbook
            </button>
          </nav>
          <section className="content" key={tab}>
            <Coach state={state} tab={tab} dispatch={dispatch} onTab={setTab} />
            {tab === 'floor' && isMobile && fc && <Readiness state={state} fc={fc} dispatch={dispatch} onStart={start} onNav={setTab} inline />}
            {tab === 'floor' && <FloorPlan state={state} dispatch={dispatch} onOpenEmployee={setOpenEmp} />}
            {(tab === 'staff' || tab === 'memorial') && (
              <>
                <SubTabs value={tab} onChange={setTab} options={[['staff', 'Current team'], ['memorial', `Former staff (${state.memorial.length})`]]} />
                {tab === 'staff' ? <StaffDirectory state={state} onOpen={setOpenEmp} /> : <Memorial state={state} />}
              </>
            )}
            {tab === 'recruit' && <Recruitment state={state} dispatch={dispatch} />}
            {(tab === 'rnd' || tab === 'policies') && (
              <>
                <SubTabs value={tab} onChange={setTab} options={[['rnd', 'Equipment & research'], ['policies', `Policies (${state.policies.length})`]]} />
                {tab === 'rnd' ? <Research state={state} dispatch={dispatch} /> : <Policies state={state} dispatch={dispatch} />}
              </>
            )}
          </section>
          {!isMobile && fc && <Readiness state={state} fc={fc} dispatch={dispatch} onStart={start} onNav={setTab} />}
        </main>
      )}

      {state.phase === 'manage' && (
        <MobileDock
          state={state}
          tab={navTab}
          fc={fc}
          onTab={(t) => {
            setTab(t);
            window.scrollTo({ top: 0 });
            play('click');
          }}
          onMore={() => setMore(true)}
          onStart={start}
        />
      )}

      {more && (
        <Modal title="More" onClose={() => setMore(false)}>
          <div className="stack">
            <button
              className="btn more-item"
              onClick={() => {
                setMore(false);
                setHelp(true);
              }}
            >
              <Icon name="book" size={18} />
              <span className="grow" style={{ textAlign: 'left' }}>
                Employee Handbook
              </span>
            </button>
            <button
              className="btn more-item"
              onClick={() => {
                setMore(false);
                setMenu(true);
              }}
            >
              <Icon name="menu" size={18} />
              <span className="grow" style={{ textAlign: 'left' }}>
                Main menu (saves, sound)
              </span>
            </button>
          </div>
        </Modal>
      )}

      {openEmp && state.phase === 'manage' && <EmployeeModal id={openEmp} state={state} dispatch={dispatch} onClose={() => setOpenEmp(null)} onOpen={setOpenEmp} />}
      {help && <Handbook onClose={() => setHelp(false)} />}

      {state.phase === 'manage' && state.week > 24 && !state.ipoShown && (
        <Modal title="Initial Public Offering!" onClose={() => dispatch({ type: 'ACK_IPO' })}>
          <p style={{ margin: 0, fontSize: 15 }}>
            Six fiscal quarters without a hostile takeover. {state.company} is now publicly traded on the Underworld Stock Exchange (ticker: <b className="gold">DOOM</b>).
          </p>
          <p className="muted" style={{ margin: 0 }}>
            You've beaten the campaign. Keep playing to see how long your dungeon can hold out — the adventurers only get stronger.
          </p>
          <button className="btn btn-primary" onClick={() => dispatch({ type: 'ACK_IPO' })}>
            Ring the (cursed) bell
          </button>
        </Modal>
      )}

      {menu && (
        <Modal title="Main Menu" onClose={() => setMenu(false)}>
          <p className="muted" style={{ margin: 0 }}>
            Saving automatically to slot {slot}. Export a save file to back it up or move it to another browser.
          </p>
          <div className="stack">
            <button className="btn" onClick={() => downloadText(saveFileName(state.company, state.week), exportSave(state))}>
              <Icon name="download" size={16} /> Export save file
            </button>
            <CopySaveButton state={state} />
            <button className="btn" onClick={() => setHelp(true)}>
              <Icon name="book" size={16} /> Open the Handbook
            </button>
            <button
              className="btn"
              onClick={() => {
                setMuted(!muted);
                setMutedState(!muted);
                if (muted) play('click');
              }}
            >
              <Icon name={muted ? 'mute' : 'sound'} size={16} /> Sound: {muted ? 'off' : 'on'}
            </button>
            <button className="btn" onClick={toTitle}>
              Save &amp; exit to title
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                void askConfirm(`Abandon this dungeon? Slot ${slot} will be erased.`, { ok: 'Abandon' }).then((ok) => {
                  if (!ok) return;
                  if (slot) deleteSlot(slot);
                  toTitle();
                });
              }}
            >
              Abandon dungeon (erase slot {slot})
            </button>
          </div>
        </Modal>
      )}

      {toast && (
        <div className="toast-wrap" key={toast.id}>
          <div className={`toast ${toast.tone}`}>{toast.text}</div>
        </div>
      )}
    </div>
  );
}

/** Copies the save as text, for browsers or embeds that block file downloads. */
function CopySaveButton({ state }: { state: GameState }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'manual'>('idle');
  const code = exportSave(state);
  return (
    <>
      <button
        className="btn"
        onClick={() => {
          navigator.clipboard
            .writeText(code)
            .then(() => setStatus('copied'))
            .catch(() => setStatus('manual'));
        }}
      >
        <Icon name="book" size={16} /> {status === 'copied' ? 'Save code copied' : 'Copy save code'}
      </button>
      {status === 'manual' && (
        <textarea className="save-code" readOnly value={code} aria-label="Save code" onFocus={(e) => e.currentTarget.select()} autoFocus />
      )}
      {status !== 'idle' && <div className="xs muted">Paste it on the title screen under “Paste a save code” to restore this dungeon.</div>}
    </>
  );
}

/** Phone-only bottom dock: the Open for Business bar plus the main tabs. */
function MobileDock({
  state,
  tab,
  fc,
  onTab,
  onMore,
  onStart,
}: {
  state: GameState;
  tab: Tab;
  fc: Forecast | null;
  onTab: (t: Tab) => void;
  onMore: () => void;
  onStart: () => void;
}) {
  const vaultEmpty = roomStaff(state, vaultRoom(state).id).filter((e) => e.status === 'active').length === 0;
  const bench = state.employees.filter((e) => !e.roomId && e.status === 'active').length;
  const warn = vaultEmpty ? 'Vault is unguarded!' : bench ? `${bench} on the bench` : null;
  const pct = fc ? Math.round(fc.winChance * 100) : 0;
  const tabs: { id: Tab; label: string; icon: Parameters<typeof Icon>[0]['name']; badge?: string }[] = [
    { id: 'floor', label: 'Dungeon', icon: 'vault', badge: warn ? '!' : undefined },
    { id: 'staff', label: 'Team', icon: 'users' },
    { id: 'recruit', label: 'Hire', icon: 'mail', badge: state.applicants.length ? String(state.applicants.length) : undefined },
    { id: 'rnd', label: 'Upgrades', icon: 'up' },
  ];
  return (
    <div className="dock mobile-only">
      <div className="dock-cta">
        <button className="dock-info" onClick={() => onTab('floor')}>
          <b className={fc ? fc.tone : ''}>
            {pct}% win chance{state.nextParty.boss ? ' · BOSS' : ''}
          </b>
          <span className={warn ? 'bad' : 'muted'}>{warn ?? `Week ${state.week} · ${state.nextParty.members.length} visitors`}</span>
        </button>
        <button className="btn btn-primary" data-tour-target="go" onClick={onStart}>
          Open for Business
        </button>
      </div>
      <nav className="tabbar" aria-label="Sections">
        {tabs.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} data-tour-target={`nav-${t.id}`} onClick={() => onTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
            <span className="tab-icon">
              <Icon name={t.icon} size={20} />
              {t.badge && <span className={`tab-badge ${t.badge === '!' ? 'bad' : ''}`}>{t.badge}</span>}
            </span>
            {t.label}
          </button>
        ))}
        <button onClick={onMore}>
          <span className="tab-icon">
            <Icon name="menu" size={20} />
          </span>
          More
        </button>
      </nav>
    </div>
  );
}

function SubTabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="seg subtabs" role="tablist">
      {options.map(([id, label]) => (
        <button key={id} role="tab" aria-selected={value === id} className={value === id ? 'on' : ''} onClick={() => onChange(id)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function useIsMobile(): boolean {
  const query = '(max-width: 760px)';
  const [mobile, setMobile] = useState(() => {
    try {
      return window.matchMedia(query).matches;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia(query);
    } catch {
      return;
    }
    const on = () => setMobile(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return mobile;
}
