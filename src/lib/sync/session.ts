import * as SecureStore from 'expo-secure-store';
import { Storage } from 'expo-sqlite/kv-store';
import { loginRequest, logoutRequest, type SyncSeller, type SyncUser } from './api';
import { resetCursor } from './cursor';
import { wipeLocalDatabase } from './reset-local-db';

// Session store for the phone's sync login (sub-paso 9). Same
// subscribe/getSnapshot shape as theme-preference.ts, so it plugs into
// useSyncExternalStore the same way — but the token lives in SecureStore
// (sensitive), not expo-sqlite/kv-store (theme preference isn't sensitive).
//
// El primer login en un celular borra su base local (CLAUDE.md, "Fase 10"):
// tracked by a separate, non-secret flag so it survives a logout — logging
// back in later on the same device must NOT wipe already-synced data again.

const TOKEN_KEY = 'sync-token';
const USER_KEY = 'sync-user';
const EVER_LOGGED_IN_KEY = 'sync-ever-logged-in';

export type Session = { token: string; user: SyncUser; seller: SyncSeller };
export type SessionState = { status: 'authenticated'; session: Session } | { status: 'unauthenticated' };
export type LoginResult = { ok: true } | { ok: false; error: string };

export function shouldWipeOnLogin(hasLoggedInBefore: boolean): boolean {
  return !hasLoggedInBefore;
}

function readStoredSession(): SessionState {
  try {
    const token = SecureStore.getItem(TOKEN_KEY);
    const userJson = SecureStore.getItem(USER_KEY);
    if (!token || !userJson) return { status: 'unauthenticated' };
    const { user, seller } = JSON.parse(userJson) as { user: SyncUser; seller: SyncSeller };
    return { status: 'authenticated', session: { token, user, seller } };
  } catch {
    return { status: 'unauthenticated' };
  }
}

function hasLoggedInBefore(): boolean {
  try {
    return Storage.getItemSync(EVER_LOGGED_IN_KEY) === 'true';
  } catch {
    return false;
  }
}

let state: SessionState = readStoredSession();
const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((listener) => listener());
}

export const sessionStore = {
  getSnapshot(): SessionState {
    return state;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  async login(username: string, password: string, deviceName?: string): Promise<LoginResult> {
    const result = await loginRequest(username, password, deviceName);
    if (!result.ok) return { ok: false, error: result.error };

    const { token, user, seller } = result.data;
    // Persist before flipping in-memory state, so a crash mid-login can't
    // leave the app "authenticated" without a token actually saved.
    SecureStore.setItem(TOKEN_KEY, token);
    SecureStore.setItem(USER_KEY, JSON.stringify({ user, seller }));

    const wipe = shouldWipeOnLogin(hasLoggedInBefore());
    Storage.setItemSync(EVER_LOGGED_IN_KEY, 'true');

    if (wipe) {
      // wipeLocalDatabase (lib/sync/reset-local-db.ts) just clears every
      // table's rows on the already-open connection — the schema doesn't
      // change, so it's safe to flip straight to "authenticated" below and
      // let the sync engine's next pull repopulate everything. resetCursor
      // is what actually makes that repopulation start from zero — without
      // it, a stale cursor from any earlier sync (even a partial or failed
      // one) would make the next pull skip every row below it (bug found
      // live, see cursor.ts).
      await wipeLocalDatabase();
      resetCursor();
    }

    state = { status: 'authenticated', session: { token, user, seller } };
    notify();
    return { ok: true };
  },

  async logout(): Promise<void> {
    if (state.status === 'authenticated') await logoutRequest(state.session.token);
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    await SecureStore.deleteItemAsync(USER_KEY).catch(() => {});
    state = { status: 'unauthenticated' };
    notify();
  },
};
