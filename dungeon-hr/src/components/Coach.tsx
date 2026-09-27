import { useEffect, type ReactNode } from 'react';
import { roomStaff, vaultRoom } from '../game/dungeon';
import type { Action } from '../game/state';
import type { GameState } from '../game/types';
import { Icon } from '../ui/Icons';

export type CoachTab = 'floor' | 'staff' | 'recruit' | 'rnd' | 'policies' | 'memorial' | 'intel';

interface Step {
  id: string;
  title: string;
  text: string;
  target: string;
  tab?: CoachTab;
}

function currentStep(state: GameState, tab: CoachTab): Step | null {
  const vaultStaffed = roomStaff(state, vaultRoom(state).id).length > 0;
  const bench = state.employees.filter((e) => !e.roomId && e.status === 'active').length;
  if (state.stats.hired === 0) {
    return tab === 'recruit'
      ? { id: 'hire', title: 'Hire your first monster', text: 'Each applicant shows stats, traits, salary and a one-time fee. Pick someone affordable and press Hire.', target: 'hire-btn' }
      : { id: 'hire', title: 'Welcome, HR Manager', text: 'Adventurers arrive every week. You have three staff and a small budget. First, hire some help.', target: 'nav-recruit', tab: 'recruit' };
  }
  if (!vaultStaffed || bench > 0) {
    if (tab !== 'floor') return { id: 'assign', title: 'Put your staff to work', text: 'New hires start on the bench, where they do nothing. Head to the Floor Plan.', target: 'nav-floor', tab: 'floor' };
    return !vaultStaffed
      ? { id: 'vault', title: 'Guard the Treasure Vault', text: 'If adventurers clear the Vault, they steal your gold. Tap a benched employee, then tap the Vault (on a computer you can also drag them).', target: 'vault' }
      : { id: 'bench', title: 'Empty the bench', text: 'Benched staff won\'t fight. Tap one, then tap a room with a free slot. Tap a room itself to see who fits it best (job-fit grades S to D).', target: 'bench' };
  }
  if (state.rooms.length <= 3) {
    if (tab !== 'floor') return { id: 'build', title: 'Build a room', text: 'Head to the Floor Plan to build.', target: 'nav-floor', tab: 'floor' };
    return {
      id: 'build',
      title: 'Build a room',
      text: 'Tap an empty slot. A Medical Bay (Back Office) keeps injured staff on duty and saves lives. A Guard Post (Invasion Route) adds positions and defense.',
      target: 'empty-slot',
    };
  }
  return {
    id: 'go',
    title: 'Open for business',
    text: 'Check the Incoming Visitors briefing (the Visitors tab on a phone), then press Open for Business. The fight plays out on its own. Breaches in weeks 1–4 are forgiven (probation); after that, three strikes and the Board takes over.',
    target: 'go',
  };
}

export function Coach({ state, tab, dispatch, onTab }: { state: GameState; tab: CoachTab; dispatch: (a: Action) => void; onTab: (t: CoachTab) => void }) {
  const active = !state.tutorialDone && !state.tipsSeen.includes('coach') && state.week === 1;
  const step = active ? currentStep(state, tab) : null;

  useEffect(() => {
    if (step) document.body.dataset.tour = step.target;
    else delete document.body.dataset.tour;
    return () => {
      delete document.body.dataset.tour;
    };
  }, [step?.target, step]);

  if (!step) return null;
  const n = { hire: 1, assign: 2, vault: 2, bench: 2, build: 3, go: 4 }[step.id] ?? 1;
  return (
    <div className="coach" role="status">
      <div className="coach-head">
        <Icon name="book" size={16} className="gold" />
        <span className="coach-step">Onboarding · step {n} of 4</span>
        <button className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: 'DISMISS_TIP', id: 'coach' })}>
          Skip tutorial
        </button>
      </div>
      <div className="coach-title">{step.title}</div>
      <div className="coach-text">{step.text}</div>
      {step.tab && step.tab !== tab && (
        <button className="btn btn-primary btn-sm" onClick={() => onTab(step.tab!)}>
          Take me there <Icon name="arrow" size={14} />
        </button>
      )}
    </div>
  );
}

export function Tip({ id, state, dispatch, children }: { id: string; state: GameState; dispatch: (a: Action) => void; children: ReactNode }) {
  if (state.tipsSeen.includes(id)) return null;
  return (
    <div className="alert info tip">
      <Icon name="book" />
      <span className="grow">{children}</span>
      <button className="btn btn-sm" onClick={() => dispatch({ type: 'DISMISS_TIP', id })}>
        Got it
      </button>
    </div>
  );
}
