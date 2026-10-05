// Fired by enqueueOperation (outbox.ts) every time a local change queues an
// operation for the server — what lets the auto-sync hook push it a moment
// later instead of waiting for the next periodic/foreground trigger. Fired
// from inside the caller's transaction, BEFORE it commits: listeners must
// not act synchronously on it (the scheduler debounces, which also batches a
// burst of writes into one sync).

const listeners = new Set<() => void>();

export function onLocalWrite(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyLocalWrite(): void {
  listeners.forEach((l) => l());
}
