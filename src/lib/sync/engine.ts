import { sessionStore } from './session';
import { setLastSyncAt } from './cursor';
import { bumpDataVersion } from './data-version';
import { refreshPendingCount } from './pending';
import { uploadPendingProductPhotos } from './photo-upload';
import { pushPendingOperations } from './push-engine';
import { pullServerChanges } from './pull-engine';

// Orchestrates one sync round: upload any pending photos, THEN push
// everything pending, THEN pull — always in that order, so the pull sees a
// server state that already includes whatever this device just sent
// (CLAUDE.md, "Fase 10": "Orden fijo: primero push, después pull"; photos
// go first because a product's upsertProduct can only carry `images` once
// none of them are local anymore — sub-paso 13). No-op without a session; a
// second call while one is already running just waits for it instead of
// racing it (two overlapping syncs would both read/clear the same outbox
// rows).
//
// A photo upload failure is reported but doesn't stop the round: the
// affected product's catalog fields still sync normally (without `images`,
// same as before this device could upload anything), and the next sync
// retries just the photos that never made it.

export type SyncResult =
  | { status: 'skipped-no-session' }
  | { status: 'ok'; pushed: number; rejected: number; pulledPages: number; photoUploadError?: string }
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
  // Whether open screens need to reload once this round ends (data-version.ts):
  // the pull applied rows/tombstones, or the push resolved operations (that
  // changes "(pendiente)" labels even when the pull brings nothing new).
  let dataChanged = false;
  try {
    const photoSummary = await uploadPendingProductPhotos(session.session.token);

    const pushSummary = await pushPendingOperations(session.session.token);
    if (pushSummary.applied + pushSummary.rejected > 0) dataChanged = true;
    if (pushSummary.error) {
      return { status: 'error', stage: 'push', error: pushSummary.error, pushed: pushSummary.applied, rejected: pushSummary.rejected };
    }

    const pullSummary = await pullServerChanges(session.session.token);
    // Pages applied before a failing one are already committed, so they count.
    if (pullSummary.changed > 0) dataChanged = true;
    if (pullSummary.error) {
      return { status: 'error', stage: 'pull', error: pullSummary.error, pushed: pushSummary.applied, rejected: pushSummary.rejected };
    }

    setLastSyncAt(new Date().toISOString());
    return {
      status: 'ok',
      pushed: pushSummary.applied,
      rejected: pushSummary.rejected,
      pulledPages: pullSummary.pages,
      ...(photoSummary.error ? { photoUploadError: photoSummary.error } : {}),
    };
  } finally {
    // Whatever the outcome — a rejection during push still resolves that
    // operation out of the outbox, so the count can change even on failure.
    await refreshPendingCount();
    if (dataChanged) bumpDataVersion();
    setRunning(false);
  }
}
