// "Something in the local database changed underneath the screens" signal.
// Screens read SQLite through lib/data/* and only reload on focus — so when a
// background sync pulls new rows while a screen is already open, nothing
// would tell it to reload. engine.ts bumps this counter after a round that
// actually changed local data, and hooks/use-data-focus-effect.ts re-runs a
// focused screen's loader whenever it moves. A plain counter, same
// subscribe/getSnapshot shape as pendingStore, so it plugs into
// useSyncExternalStore without touching any repo or the layering rule
// (screens still only talk to lib/data/*).

let version = 0;
const listeners = new Set<() => void>();

export const dataVersionStore = {
  getSnapshot(): number {
    return version;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function bumpDataVersion(): void {
  version++;
  listeners.forEach((l) => l());
}
