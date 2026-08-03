import type { ReactNode } from 'react';
import { useAccountStore } from './store/accountStore';
import EntryScreen from './screens/EntryScreen';
import CharacterCreate from './screens/CharacterCreate';
import GameScreen from './screens/GameScreen';
import CharacterScreen from './screens/CharacterScreen';
import EventScreen from './screens/EventScreen';
import { PageTransitionProvider, usePageTransition } from './components/PageTransitionProvider';
import PageTransitionOverlay from './components/PageTransitionOverlay';

function AppContent() {
  const { isTransitioning } = usePageTransition();
  const { screen } = useAccountStore();

  let eventScreen: ReactNode = null;
  if (screen === 'event') {
    const id = useAccountStore.getState().storage.activeAccountId;
    const sgs = id ? useAccountStore.getState().storage.gameStates[id] : null;
    const kind = sgs?.pendingEncounterKind ?? 'absorb';
    eventScreen = (
      <EventScreen
        encounterKind={kind}
        onComplete={() => useAccountStore.getState().navigateToGame()}
      />
    );
  }

  return (
    <>
      <div
        style={{
          filter: isTransitioning ? 'blur(8px)' : 'none',
          transition: 'filter 0.4s ease',
          minHeight: '100%',
        }}
      >
        {screen === 'entry' && <EntryScreen />}
        {screen === 'create' && <CharacterCreate />}
        {eventScreen}
        {screen === 'character' && <CharacterScreen />}
        {screen === 'game' && <GameScreen />}
      </div>
      <PageTransitionOverlay />
    </>
  );
}

export default function App() {
  return (
    <PageTransitionProvider>
      <AppContent />
    </PageTransitionProvider>
  );
}
