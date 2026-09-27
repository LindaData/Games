import { useCallback, useEffect, useState } from 'react';
import type { PieceSymbol } from 'chess.js';
import { newSeed } from './core/rng';
import type { CombatState } from './game/combat';
import { unlock, type MetaState, type ModeId, type ThemeId, type Unlockable } from './game/meta';
import {
  applyRunToMeta,
  buyItem,
  claimReward,
  enterNode,
  eventChoose,
  finishCombat,
  forgePick,
  leaveNode,
  newRun,
  restAction,
  takeTreasure,
  type RunState,
} from './game/run';
import { loadMeta, loadRun, saveMeta, saveRun } from './persistence/storage';
import { RunBar } from './ui/components/RunBar';
import { CombatScreen } from './ui/screens/CombatScreen';
import { MapScreen } from './ui/screens/MapScreen';
import { CharacterSelect, EndScreen, HowToScreen, TitleScreen, UnlocksScreen } from './ui/screens/MenuScreens';
import { EventScreen, ForgeScreen, RestScreen, RewardScreen, ShopScreen, TreasureScreen } from './ui/screens/NodeScreens';

type View = 'title' | 'select' | 'unlocks' | 'howto' | 'run';

export default function App() {
  const [meta, setMeta] = useState<MetaState>(() => loadMeta());
  const [run, setRun] = useState<RunState | null>(() => loadRun());
  const [view, setView] = useState<View>('title');

  useEffect(() => saveMeta(meta), [meta]);
  useEffect(() => saveRun(run), [run]);

  const update = useCallback((fn: (r: RunState) => RunState) => setRun((r) => (r ? fn(r) : r)), []);
  const onCombat = useCallback((c: CombatState) => setRun((r) => (r ? { ...r, combat: c } : r)), []);

  const start = (piece: PieceSymbol, mode: ModeId) => {
    setRun(newRun(piece, mode, meta, newSeed()));
    setView('run');
  };
  const endRun = () => {
    if (run) setMeta((m) => applyRunToMeta(m, run));
    setRun(null);
    setView('title');
  };

  let body: React.ReactNode = null;
  if (view === 'title' || (view === 'run' && !run)) {
    body = (
      <TitleScreen
        meta={meta}
        hasRun={!!run}
        runInProgress={!!run && run.screen !== 'gameover' && run.screen !== 'victory'}
        onContinue={() => setView('run')}
        onNew={() => {
          if (run && (run.screen === 'gameover' || run.screen === 'victory')) setMeta((m) => applyRunToMeta(m, run));
          setRun(null);
          setView('select');
        }}
        onUnlocks={() => setView('unlocks')}
        onHowTo={() => setView('howto')}
      />
    );
  } else if (view === 'select') {
    body = <CharacterSelect meta={meta} onStart={start} onBack={() => setView('title')} />;
  } else if (view === 'unlocks') {
    body = (
      <UnlocksScreen
        meta={meta}
        onUnlock={(u: Unlockable, cost: number) => setMeta((m) => unlock(m, u, cost))}
        onTheme={(t: ThemeId) => setMeta((m) => ({ ...m, theme: t }))}
        onBack={() => setView('title')}
      />
    );
  } else if (view === 'howto') {
    body = <HowToScreen onBack={() => setView('title')} />;
  } else if (run) {
    const s = run.screen;
    let screen: React.ReactNode = null;
    if (s === 'map') screen = <MapScreen run={run} onEnter={(id) => update((r) => enterNode(r, id))} />;
    else if (s === 'combat' && run.combat)
      screen = (
        <CombatScreen
          run={run}
          meta={meta}
          onCombat={onCombat}
          onFinish={() => update(finishCombat)}
          onToggleDanger={() => setMeta((m) => ({ ...m, settings: { ...m.settings, dangerOverlay: !m.settings.dangerOverlay } }))}
          onToggleAnimations={() => setMeta((m) => ({ ...m, settings: { ...m.settings, animations: !m.settings.animations } }))}
        />
      );
    else if (s === 'reward') screen = <RewardScreen run={run} onPick={(id) => update((r) => claimReward(r, id))} />;
    else if (s === 'shop') screen = <ShopScreen run={run} onBuy={(i) => update((r) => buyItem(r, i))} onLeave={() => update(leaveNode)} />;
    else if (s === 'event') screen = <EventScreen run={run} onChoose={(i) => update((r) => eventChoose(r, i))} onLeave={() => update(leaveNode)} />;
    else if (s === 'rest') screen = <RestScreen run={run} onAction={(a) => update((r) => restAction(r, a))} onLeave={() => update(leaveNode)} />;
    else if (s === 'treasure') screen = <TreasureScreen run={run} onTake={() => update(takeTreasure)} />;
    else if (s === 'forge') screen = <ForgeScreen run={run} onPick={(id) => update((r) => forgePick(r, id))} />;
    else if (s === 'gameover' || s === 'victory') return <div className="p-4"><EndScreen run={run} onDone={endRun} /></div>;
    body = (
      <div className="flex flex-col gap-4">
        {s !== 'combat' && <RunBar run={run} onMenu={() => setView('title')} />}
        {s === 'combat' && (
          <div className="flex justify-end">
            <button className="btn btn-ghost text-xs !py-1" onClick={() => setView('title')}>
              Menu
            </button>
          </div>
        )}
        {screen}
      </div>
    );
  }

  return <div className="min-h-full p-3 sm:p-5 max-w-[1500px] mx-auto">{body}</div>;
}
