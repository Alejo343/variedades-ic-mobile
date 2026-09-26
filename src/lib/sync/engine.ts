import { sessionStore } from './session';
import { setLastSyncAt } from './cursor';
import { pushPendingOperations } from './push-engine';
import { pullServerChanges } from './pull-engine';

// Orchestrates one sync round (sub-paso 11): push everything pending, THEN
// pull — always in that order, so the pull sees a server state that already
// includes whatever this device just sent (CLAUDE.md, "Fase 10": "Orden
// fijo: primero push, después pull"). No-op without a session; a second
// call while one is already running just waits for it instead of racing it
// (two overlapping syncs would both read/clear the same outbox rows).

export type SyncResult =
  | { status: 'skipped-no-session' }
  | { status: 'ok'; pushed: number; rejected: number; pulledPages: number }
  | { status: 'error'; stage: 'push' | 'pull'; error: string; pushed: number; rejected: number };

type Listener = () => void;
const listeners = new Set<Listener>();
let running = false;
let inFlight: Promise<SyncResult> | null = null;

export const syncEngineStore = {
  isRunning(): boolean {
    return running;
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

function setRunning(value: boolean) {
  running = value;
  listeners.forEach((l) => l());
}

export function runSync(): Promise<SyncResult> {
  if (inFlight) return inFlight;
  inFlight = performSync().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function performSync(): Promise<SyncResult> {
  const session = sessionStore.getSnapshot();
  if (session.status !== 'authenticated') return { status: 'skipped-no-session' };

  setRunning(true);
  try {
    const pushSummary = await pushPendingOperations(session.session.token);
    if (pushSummary.error) {
      return { status: 'error', stage: 'push', error: pushSummary.error, pushed: pushSummary.applied, rejected: pushSummary.rejected };
    }

    const pullSummary = await pullServerChanges(session.session.token);
    if (pullSummary.error) {
      return { status: 'error', stage: 'pull', error: pullSummary.error, pushed: pushSummary.applied, rejected: pushSummary.rejected };
    }

    setLastSyncAt(new Date().toISOString());
    return { status: 'ok', pushed: pushSummary.applied, rejected: pushSummary.rejected, pulledPages: pullSummary.pages };
  } finally {
    setRunning(false);
  }
}
