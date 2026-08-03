import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AppScreen } from '../types/account';
import { useAccountStore } from '../store/accountStore';
import type { EncounterKind } from '../systems/cultivationSystem';

interface PageTransitionContextValue {
  isTransitioning: boolean;
  isReady: boolean;
  transitioningTo: AppScreen | null;
  startTransition: (target: AppScreen) => Promise<void>;
}

const PageTransitionContext = createContext<PageTransitionContextValue | null>(null);

const FADE_IN_MS = 400;
const HOLD_MS = 300;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type StoreNavigators = {
  navigateTo: (screen: AppScreen) => void;
  navigateToGame: () => void;
  navigateToEvent: (kind: EncounterKind) => void;
  navigateToCharacter: (tab?: 'person' | 'techniques') => void;
  logout: () => void;
  loginAccount: (id: string) => void;
};

export function PageTransitionProvider({ children }: { children: ReactNode }) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [transitioningTo, setTransitioningTo] = useState<AppScreen | null>(null);
  const originalsRef = useRef<StoreNavigators | null>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingTargetRef = useRef<AppScreen | null>(null);

  const runTransition = useCallback(async (target: AppScreen, performNav: () => void) => {
    if (pendingTargetRef.current === target) return;

    const task = queueRef.current.then(async () => {
      pendingTargetRef.current = target;
      // Show overlay immediately (fade-in starts)
      setIsTransitioning(true);
      setTransitioningTo(target);
      setIsReady(false);
      // Wait for fade-in to complete
      await delay(FADE_IN_MS);
      // Fade-in done: allow pointer-events, execute navigation
      setIsReady(true);
      // Perform the actual navigation — this changes the screen synchronously
      performNav();
      // Wait for hold period (new screen is visible under overlay)
      await delay(HOLD_MS);
      // Hide overlay
      setIsReady(false);
      setIsTransitioning(false);
      setTransitioningTo(null);
      pendingTargetRef.current = null;
    });
    queueRef.current = task.catch(() => undefined);
    await task;
  }, []);

  const startTransition = useCallback(
    async (target: AppScreen) => {
      const originals = originalsRef.current;
      if (!originals) {
        useAccountStore.getState().navigateTo(target);
        return;
      }
      await runTransition(target, () => originals.navigateTo(target));
    },
    [runTransition],
  );

  useEffect(() => {
    const state = useAccountStore.getState();
    originalsRef.current = {
      navigateTo: state.navigateTo,
      navigateToGame: state.navigateToGame,
      navigateToEvent: state.navigateToEvent,
      navigateToCharacter: state.navigateToCharacter,
      logout: state.logout,
      loginAccount: state.loginAccount,
    };

    useAccountStore.setState({
      navigateTo: (screen) => {
        if (useAccountStore.getState().screen === screen) return;
        void runTransition(screen, () => originalsRef.current!.navigateTo(screen));
      },
      navigateToGame: () => {
        void runTransition('game', () => originalsRef.current!.navigateToGame());
      },
      navigateToEvent: (kind) => {
        void runTransition('event', () => originalsRef.current!.navigateToEvent(kind));
      },
      navigateToCharacter: (tab) => {
        void runTransition('character', () => originalsRef.current!.navigateToCharacter(tab));
      },
      logout: () => {
        void runTransition('entry', () => originalsRef.current!.logout());
      },
      loginAccount: (id) => {
        void runTransition('game', () => originalsRef.current!.loginAccount(id));
      },
    });

    return () => {
      const originals = originalsRef.current;
      if (originals) {
        useAccountStore.setState(originals);
      }
    };
  }, [runTransition]);

  return (
    <PageTransitionContext.Provider value={{ isTransitioning, isReady, transitioningTo, startTransition }}>
      {children}
    </PageTransitionContext.Provider>
  );
}

export function usePageTransition(): PageTransitionContextValue {
  const ctx = useContext(PageTransitionContext);
  if (!ctx) throw new Error('usePageTransition must be used within PageTransitionProvider');
  return ctx;
}
