import NetInfo from '@react-native-community/netinfo';
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { runSync } from '@/lib/sync/engine';
import { refreshPendingCount } from '@/lib/sync/pending';
import { shouldRunOnConnectivityChange, withinThrottle } from '@/lib/sync/triggers';

// Automatic sync triggers (sub-paso 12, CLAUDE.md "Fase 10"): on cold start
// (covers "opening the app" with an already-saved session), on returning to
// the foreground, and on regaining internet — never while the app is
// closed. Mounted once, at the root (app/_layout.tsx); runSync() itself is
// a no-op without a session, so this hook doesn't need to check that.
const MIN_INTERVAL_MS = 30_000;

export function useAutoSync(): void {
  const lastRunAt = useRef<number | null>(null);
  const wasOnline = useRef<boolean | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    function trigger() {
      const now = Date.now();
      if (withinThrottle(lastRunAt.current, now, MIN_INTERVAL_MS)) return;
      lastRunAt.current = now;
      runSync().finally(refreshPendingCount);
    }

    refreshPendingCount();
    trigger();

    const appStateSubscription = AppState.addEventListener('change', (next) => {
      if (appState.current !== 'active' && next === 'active') trigger();
      appState.current = next;
    });

    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      const isOnline = !!state.isConnected && state.isInternetReachable !== false;
      if (shouldRunOnConnectivityChange(wasOnline.current, isOnline)) trigger();
      wasOnline.current = isOnline;
    });

    return () => {
      appStateSubscription.remove();
      unsubscribeNetInfo();
    };
  }, []);
}
