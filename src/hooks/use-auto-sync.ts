import NetInfo from '@react-native-community/netinfo';
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { runSync, syncEngineStore } from '@/lib/sync/engine';
import { onLocalWrite } from '@/lib/sync/local-writes';
import { refreshPendingCount } from '@/lib/sync/pending';
import { createSyncScheduler } from '@/lib/sync/scheduler';
import { sessionStore } from '@/lib/sync/session';
import { shouldRunOnConnectivityChange } from '@/lib/sync/triggers';

// Automatic sync triggers (sub-paso 12 + sync reactiva, CLAUDE.md "Fase 10"):
// cold start, back to the foreground, internet regained, right after login,
// every PERIODIC_MS while the app is in the foreground, and a couple of
// seconds after any local write that queued an operation. Never while the
// app is closed. Mounted once, at the root (app/_layout.tsx). The decisions
// (throttle, debounce, "no session") live in lib/sync/scheduler.ts.
const PERIODIC_MS = 60_000;

export function useAutoSync(): void {
  const wasOnline = useRef<boolean | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const scheduler = createSyncScheduler({
      run: runSync,
      isAuthenticated: () => sessionStore.getSnapshot().status === 'authenticated',
      isRunning: () => syncEngineStore.isRunning(),
    });

    refreshPendingCount();
    scheduler.auto();

    let wasAuthenticated = sessionStore.getSnapshot().status === 'authenticated';
    const unsubscribeSession = sessionStore.subscribe(() => {
      const isAuthenticated = sessionStore.getSnapshot().status === 'authenticated';
      if (isAuthenticated && !wasAuthenticated) scheduler.immediate();
      wasAuthenticated = isAuthenticated;
    });

    const appStateSubscription = AppState.addEventListener('change', (next) => {
      if (appState.current !== 'active' && next === 'active') scheduler.auto();
      appState.current = next;
    });

    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      const isOnline = !!state.isConnected && state.isInternetReachable !== false;
      if (shouldRunOnConnectivityChange(wasOnline.current, isOnline)) scheduler.auto();
      wasOnline.current = isOnline;
    });

    const interval = setInterval(() => {
      if (appState.current === 'active') scheduler.auto();
    }, PERIODIC_MS);

    const unsubscribeLocalWrite = onLocalWrite(() => scheduler.localWrite());

    return () => {
      scheduler.dispose();
      clearInterval(interval);
      unsubscribeSession();
      appStateSubscription.remove();
      unsubscribeNetInfo();
      unsubscribeLocalWrite();
    };
  }, []);
}
