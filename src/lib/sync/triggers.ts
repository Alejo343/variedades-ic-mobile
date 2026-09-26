// Pure decision logic behind the automatic sync triggers (sub-paso 12,
// CLAUDE.md "Fase 10": "al recuperar conexión, al volver a la app"). The
// AppState/NetInfo wiring that calls these lives in hooks/use-auto-sync.ts.

// Only an automatic trigger is throttled — the manual "Sincronizar ahora"
// button always runs regardless, since the user explicitly asked for it.
export function withinThrottle(lastRunAt: number | null, now: number, minIntervalMs: number): boolean {
  if (lastRunAt === null) return false;
  return now - lastRunAt < minIntervalMs;
}

// Fires only on the OFFLINE -> ONLINE transition, never on every "still
// online" event NetInfo re-emits, and never while going offline or staying
// offline. `null` (not known yet) counts as "not online" for this purpose.
export function shouldRunOnConnectivityChange(wasOnline: boolean | null, isOnline: boolean): boolean {
  return !wasOnline && isOnline;
}
