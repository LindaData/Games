import { useCallback, useEffect, useReducer, useState } from 'react';
import { Intel, TopBar } from './components/Chrome';
import { Memorial, Policies, Research } from './components/Company';
import { FloorPlan } from './components/FloorPlan';
import { InvasionView } from './components/Invasion';
import { GameOver, HrInbox, Report, TitleScreen } from './components/Phases';
import { EmployeeModal, Recruitment, StaffDirectory } from './components/Staff';
import { Modal } from './components/common';
import { headcountLimit } from './game/dungeon';
import { simulateInvasion, type SimResult } from './game/sim';
import { clearSave, loadGame, newGame, reducer, saveGame } from './game/state';
import type { GameState } from './game/types';
import { Icon } from './ui/Icons';
import { play } from './ui/sfx';

type Tab = 'floor' | 'staff' | 'recruit' | 'rnd' | 'policies' | 'memorial';

function initialState(): GameState {
  return { ...newGame(), phase: 'title' };
}

export default function App() {
  const [saved, setSaved] = useState<GameState | null>(() => loadGame());
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [tab, setTab] = useState<Tab>('floor');
  const [sim, setSim] = useState<SimResult | null>(null);
  const [openEmp, setOpenEmp] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState<GameState['toast']>(null);

  useEffect(() => {
    saveGame(state);
  }, [state]);

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

  if (state.phase === 'title') {
    return (
      <TitleScreen
        hasSave={!!saved}
        onContinue={() => saved && dispatch({ type: 'LOAD', state: saved })}
        onNew={(company) => {
          clearSave();
          setSaved(null);
          setTab('floor');
          dispatch({ type: 'NEW_GAME', company });
          play('hire');
        }}
      />
    );
  }

  if (state.phase === 'gameover') {
    return (
      <GameOver
        state={state}
        onNew={() => {
          clearSave();
          setSaved(null);
          dispatch({ type: 'TO_TITLE' });
        }}
      />
    );
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
      <TopBar state={state} onMenu={() => setMenu(true)} />

      {state.phase === 'invasion' && sim && <InvasionView state={state} sim={sim} onFinish={finish} />}
      {state.phase === 'report' && <Report state={state} dispatch={dispatch} />}
      {state.phase === 'hr' && <HrInbox state={state} dispatch={dispatch} />}

      {state.phase === 'manage' && (
        <main className="main">
          <nav className="sidenav">
            {nav.map((n) => (
              <button
                key={n.id}
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
          </nav>
          <section className="content" key={tab}>
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

      {openEmp && state.phase === 'manage' && <EmployeeModal id={openEmp} state={state} dispatch={dispatch} onClose={() => setOpenEmp(null)} />}

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
            Your progress saves automatically after every action.
          </p>
          <div className="stack">
            <button
              className="btn"
              onClick={() => {
                setMenu(false);
                setSaved(loadGame());
                dispatch({ type: 'TO_TITLE' });
              }}
            >
              Save &amp; exit to title
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                if (confirm('Abandon this dungeon and start over? Your save will be erased.')) {
                  setMenu(false);
                  clearSave();
                  setSaved(null);
                  dispatch({ type: 'TO_TITLE' });
                }
              }}
            >
              Abandon dungeon (new game)
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
