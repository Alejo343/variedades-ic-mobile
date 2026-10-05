import { withinThrottle } from './triggers';

// When to run a sync round — the decision logic behind hooks/use-auto-sync.ts,
// kept free of React Native (AppState/NetInfo/session wiring lives in the
// hook) so it can be tested with fake timers.
//
// - auto(): cold start, back to foreground, internet regained, periodic tick.
//   Throttled, and a no-op without a session — which does NOT consume the
//   throttle (before this, the cold-start trigger with no session "used up"
//   the window and nothing synced after logging in).
// - immediate(): the session just became authenticated (login). Always runs —
//   a fresh login has an empty local database that needs its first pull now.
// - localWrite(): a local change was queued. Debounced (the write's
//   transaction hasn't committed yet when it fires, and a burst of writes
//   becomes one sync), not throttled (pushing a sale right away is the point).
//   If a round is already running when the debounce fires, it retries a bit
//   later — runSync() would just hand back the in-flight round, which read
//   the outbox before this write existed.

export type SchedulerDeps = {
  run: () => Promise<unknown>;
  isAuthenticated: () => boolean;
  isRunning: () => boolean;
  now?: () => number;
};

export type SchedulerOptions = { minIntervalMs: number; localWriteDebounceMs: number; busyRetryMs: number };

export const DEFAULT_SCHEDULER_OPTIONS: SchedulerOptions = {
  minIntervalMs: 30_000,
  localWriteDebounceMs: 2_000,
  busyRetryMs: 1_000,
};

export type SyncScheduler = {
  auto(): boolean;
  immediate(): void;
  localWrite(): void;
  dispose(): void;
};

export function createSyncScheduler(deps: SchedulerDeps, options: SchedulerOptions = DEFAULT_SCHEDULER_OPTIONS): SyncScheduler {
  const now = deps.now ?? Date.now;
  let lastRunAt: number | null = null;
  let localTimer: ReturnType<typeof setTimeout> | null = null;

  function runNow() {
    lastRunAt = now();
    deps.run().catch(() => {});
  }

  function scheduleLocal(delayMs: number) {
    if (localTimer) clearTimeout(localTimer);
    localTimer = setTimeout(() => {
      localTimer = null;
      if (!deps.isAuthenticated()) return;
      if (deps.isRunning()) {
        scheduleLocal(options.busyRetryMs);
        return;
      }
      runNow();
    }, delayMs);
  }

  return {
    auto() {
      if (!deps.isAuthenticated()) return false;
      if (withinThrottle(lastRunAt, now(), options.minIntervalMs)) return false;
      runNow();
      return true;
    },
    immediate() {
      if (!deps.isAuthenticated()) return;
      runNow();
    },
    localWrite() {
      scheduleLocal(options.localWriteDebounceMs);
    },
    dispose() {
      if (localTimer) clearTimeout(localTimer);
      localTimer = null;
    },
  };
}
