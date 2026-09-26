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
