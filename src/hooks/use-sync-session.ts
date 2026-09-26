import { useSyncExternalStore } from 'react';
import { sessionStore, type SessionState } from '@/lib/sync/session';

export function useSyncSession(): SessionState {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.getSnapshot);
}
