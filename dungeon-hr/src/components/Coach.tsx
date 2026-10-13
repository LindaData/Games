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
      ? { id: 'hire', title: 'Hire your first monster', text: 'Bigger power numbers fight better. Pick someone you can afford and tap Hire. New hires go straight to work.', target: 'hire-btn' }
      : { id: 'hire', title: 'Welcome, HR Manager', text: 'Adventurers attack every week, and your monsters stop them. First, hire some help.', target: 'nav-recruit', tab: 'recruit' };
  }
  if (!state.rooms.some((r) => r.type === 'medical')) {
    if (tab !== 'floor') return { id: 'build', title: 'Build a Medical Bay', text: 'Head back to your dungeon.', target: 'nav-floor', tab: 'floor' };
    return { id: 'build', title: 'Build a Medical Bay', text: 'Tap an empty Back office slot and pick Medical Bay. It keeps injured staff working and saves lives.', target: 'empty-slot' };
  }
  if (!vaultStaffed || bench > 0) {
    if (tab !== 'floor') return { id: 'assign', title: 'Put everyone to work', text: 'Head back to your dungeon.', target: 'nav-floor', tab: 'floor' };
    return { id: 'assign', title: 'Put everyone to work', text: 'Tap Auto-assign staff. It puts each monster where they fight best and guards the Treasure Vault.', target: 'auto-assign' };
  }
  return {
    id: 'go',
    title: 'Open for business',
    text: 'The win chance shows how likely you are to stop this week\'s visitors. When you\'re happy, tap Open for Business. The first 6 weeks are forgiving.',
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
  const n = { hire: 1, build: 2, assign: 3, go: 4 }[step.id] ?? 1;
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
