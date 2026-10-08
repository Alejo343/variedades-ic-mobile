import { SYNC_BASE_URL } from './config';

// Thin client for the server's /api/sync/* endpoints (sub-paso 9). Contract:
// input = credentials/token; output = a typed result or a Spanish error
// message the login screen can show directly — never a thrown network error
// (offline is the expected case, not a bug).

export type SyncUser = { username: string; name: string; role: 'owner' | 'seller' };
export type SyncSeller = { uuid: string; name: string } | null;
export type LoginResponse = { token: string; user: SyncUser; seller: SyncSeller };
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

// The server sends either a plain string or a zod .flatten() object (same
// two shapes the web's own client code already parses in SellerAccessCard.tsx).
export function extractErrorMessage(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || !('error' in body)) return null;
  const err = (body as { error: unknown }).error;
  if (typeof err === 'string') return err;
  if (typeof err !== 'object' || err === null) return null;
  const flat = err as { formErrors?: unknown; fieldErrors?: Record<string, unknown> };
  if (Array.isArray(flat.formErrors) && typeof flat.formErrors[0] === 'string') return flat.formErrors[0];
  const firstField = Object.values(flat.fieldErrors ?? {}).find((v) => Array.isArray(v) && typeof v[0] === 'string');
  return Array.isArray(firstField) ? (firstField[0] as string) : null;
}

async function parseJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function loginRequest(username: string, password: string, deviceName?: string): Promise<ApiResult<LoginResponse>> {
  try {
    const res = await fetch(`${SYNC_BASE_URL}/api/sync/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, deviceName }),
    });
    const body = await parseJson(res);
    if (!res.ok) return { ok: false, error: extractErrorMessage(body) ?? 'No se pudo iniciar sesión' };
    return { ok: true, data: body as LoginResponse };
  } catch {
    return { ok: false, error: 'Sin conexión con el servidor. Verifica tu internet e intenta de nuevo.' };
  }
}

// Best-effort: the token is cleared locally regardless of whether this call
// succeeds (logging out while offline still has to work).
export async function logoutRequest(token: string): Promise<void> {
  try {
    await fetch(`${SYNC_BASE_URL}/api/sync/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  } catch {
    // Ignored on purpose — see comment above.
  }
}

// POST /api/sync/push (sub-paso 11) — see lib/sync/push.ts on the server for
// the contract. `operations` must be 1-100 (the server's own cap); the push
// engine chunks the outbox into batches of that size.
export type PushOperation = { id: string; type: string; payload: unknown };
export type PushResult = { id: string; status: 'applied' | 'rejected' | 'error' | 'skipped'; error?: string; duplicate?: true };

export async function pushRequest(token: string, operations: PushOperation[]): Promise<ApiResult<{ results: PushResult[] }>> {
  try {
    const res = await fetch(`${SYNC_BASE_URL}/api/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ operations }),
    });
    const body = await parseJson(res);
    if (!res.ok) return { ok: false, error: extractErrorMessage(body) ?? 'No se pudo sincronizar' };
    return { ok: true, data: body as { results: PushResult[] } };
  } catch {
    return { ok: false, error: 'Sin conexión con el servidor. Verifica tu internet e intenta de nuevo.' };
  }
}

// GET /api/sync/pull?since=<cursor> — see lib/sync/pull.ts on the server.
export type PullResponse = {
  cursor: number;
  hasMore: boolean;
  changes: Record<string, Record<string, unknown>[]>;
  tombstones: { table: string; uuid: string }[];
};

export async function pullRequest(token: string, since: number): Promise<ApiResult<PullResponse>> {
  try {
    const res = await fetch(`${SYNC_BASE_URL}/api/sync/pull?since=${since}`, { headers: { Authorization: `Bearer ${token}` } });
    const body = await parseJson(res);
    if (!res.ok) return { ok: false, error: extractErrorMessage(body) ?? 'No se pudo sincronizar' };
    return { ok: true, data: body as PullResponse };
  } catch {
    return { ok: false, error: 'Sin conexión con el servidor. Verifica tu internet e intenta de nuevo.' };
  }
}

// /api/sync/sellers/[sellerUuid]/access — the owner managing a seller's app
// login (username + password) from the phone. Online only: a password never
// lives on a phone, so there's nothing to queue for later.
export type SellerAccess = { username: string; active: boolean } | null;

async function accessRequest<T>(token: string, sellerUuid: string, method: 'GET' | 'POST' | 'PATCH', body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${SYNC_BASE_URL}/api/sync/sellers/${sellerUuid}/access`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await parseJson(res);
    if (!res.ok) return { ok: false, error: extractErrorMessage(json) ?? 'No se pudo completar la operación' };
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, error: 'Sin conexión con el servidor. Necesitas internet para gestionar el acceso.' };
  }
}

export async function getSellerAccessRequest(token: string, sellerUuid: string): Promise<ApiResult<SellerAccess>> {
  const result = await accessRequest<{ user: SellerAccess }>(token, sellerUuid, 'GET');
  return result.ok ? { ok: true, data: result.data.user } : result;
}

export async function createSellerAccessRequest(token: string, sellerUuid: string, username: string, password: string): Promise<ApiResult<SellerAccess>> {
  return accessRequest<SellerAccess>(token, sellerUuid, 'POST', { username, password });
}

export async function updateSellerAccessRequest(
  token: string,
  sellerUuid: string,
  changes: { password?: string; active?: boolean },
): Promise<ApiResult<SellerAccess>> {
  return accessRequest<SellerAccess>(token, sellerUuid, 'PATCH', changes);
}
