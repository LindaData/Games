import { useCallback, useEffect, useReducer, useState } from 'react';
import { Intel, TopBar } from './components/Chrome';
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
import { play } from './ui/sfx';
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
  const [toast, setToast] = useState<GameState['toast']>(null);

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
    { id: 'floor', label: 'Floor Plan', icon: 'vault' },
    { id: 'staff', label: 'Staff Directory', icon: 'users', count: `${state.employees.length}/${headcountLimit(state)}` },
    { id: 'recruit', label: 'Recruitment', icon: 'mail', count: String(state.applicants.length) },
    { id: 'rnd', label: 'R&D / Procurement', icon: 'flask', count: String(state.research) },
    { id: 'policies', label: 'HR Policies', icon: 'book', count: `${state.policies.length}` },
    { id: 'memorial', label: 'Memorial Wall', icon: 'skull', count: state.memorial.length ? String(state.memorial.length) : undefined },
  ];

  return (
    <div className="app">
      <TopBar state={state} onMenu={() => setMenu(true)} onHelp={() => setHelp(true)} />

      {state.phase === 'invasion' && sim && (
        <>
          <div className="tip-bar">
            <Tip id="invasion" state={state} dispatch={dispatch}>
              This is the live security feed. Visitors walk the route room by room and your staff fight automatically. Use <b>2×/4×</b> or <b>Skip</b> if you're busy.
            </Tip>
          </div>
          <InvasionView state={state} sim={sim} onFinish={finish} />
        </>
      )}
      {state.phase === 'report' && (
        <>
          <div className="tip-bar">
            <Tip id="report" state={state} dispatch={dispatch}>
              Your weekly report: money in and out, who performed, and incident reports for anyone hurt. Next comes the HR Inbox.
            </Tip>
          </div>
          <Report state={state} dispatch={dispatch} />
        </>
      )}
      {state.phase === 'hr' && (
        <>
          <div className="tip-bar">
            <Tip id="hr" state={state} dispatch={dispatch}>
              Every memo needs a decision before the next shift. Each option lists its consequences; greyed-out options need gold or a prerequisite.
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
                className={`navbtn ${tab === n.id ? 'active' : ''}`}
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
            {tab === 'floor' && <FloorPlan state={state} dispatch={dispatch} onOpenEmployee={setOpenEmp} />}
            {tab === 'staff' && <StaffDirectory state={state} onOpen={setOpenEmp} />}
            {tab === 'recruit' && <Recruitment state={state} dispatch={dispatch} />}
            {tab === 'rnd' && <Research state={state} dispatch={dispatch} />}
            {tab === 'policies' && <Policies state={state} dispatch={dispatch} />}
            {tab === 'memorial' && <Memorial state={state} />}
          </section>
          <Intel state={state} onStart={start} onNav={(t) => setTab(t as Tab)} />
        </main>
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
