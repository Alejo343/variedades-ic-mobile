import { getOutboxCount } from './outbox';

// "N pendientes" (sub-paso 12) — sync_outbox has no reactive change feed of
// its own (it's just a SQLite table), so this is a plain count refreshed on
// demand rather than something that updates itself: after every local write
// that enqueues an operation, that would mean touching all 15 repo files
// again just to notify a UI counter, which isn't worth it yet. Instead,
// refreshPendingCount() is called wherever it already matters — engine.ts
// after a sync, and the Settings screen on focus.

let count = 0;
const listeners = new Set<() => void>();

export const pendingStore = {
  getSnapshot(): number {
    return count;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export async function refreshPendingCount(): Promise<number> {
  count = await getOutboxCount();
  listeners.forEach((l) => l());
  return count;
}
