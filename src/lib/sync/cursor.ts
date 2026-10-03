import { Storage } from 'expo-sqlite/kv-store';

// Persists how far this device's pull has gotten (sub-paso 11) — the
// `since` to send on the next GET /api/sync/pull, and when the sync last
// ran successfully end to end, for the "última sincronización" indicator
// (sub-paso 12). Not sensitive, so kv-store (sync API) like theme-preference
// and the "ever logged in" flag, not expo-secure-store.

const CURSOR_KEY = 'sync-cursor';
const LAST_SYNC_KEY = 'sync-last-at';

export function getCursor(): number {
  try {
    const stored = Storage.getItemSync(CURSOR_KEY);
    const n = stored ? Number(stored) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function setCursor(value: number): void {
  try {
    Storage.setItemSync(CURSOR_KEY, String(value));
  } catch {
    // Best-effort — the next sync just re-reads whatever was last saved.
  }
}

// Bug real encontrado en vivo (sesión 2026-10-03): el cursor vive en
// kv-store, que NINGÚN flujo que reemplaza los datos locales (el wipe del
// primer login, importar un respaldo) toca — así que un dispositivo que ya
// había sincronizado antes (aunque fuera parcial o contra otro servidor)
// arrancaba el siguiente pull desde ese cursor viejo, saltándose de
// entrada cualquier fila con una versión menor (p. ej. las cuentas de caja,
// sembradas con las versiones más bajas de todo el sistema). Debe llamarse
// SIEMPRE que los datos locales se reemplacen por completo, para que el
// siguiente pull vuelva a traer todo desde cero.
export function resetCursor(): void {
  setCursor(0);
}

export function getLastSyncAt(): string | null {
  try {
    return Storage.getItemSync(LAST_SYNC_KEY);
  } catch {
    return null;
  }
}

export function setLastSyncAt(iso: string): void {
  try {
    Storage.setItemSync(LAST_SYNC_KEY, iso);
  } catch {
    // Best-effort, same as above.
  }
}
