import { Storage } from 'expo-sqlite/kv-store';

import { sellersRepo } from '../data';
import type { Session } from './session';
import { scopeOf, type SyncScope } from './scope-rules';

// What the server's pull lets this device see depends on who it is: the owner
// sees everything, a consignment seller their own ledger, a store seller also
// the cash accounts and their own in-store sales. The pull cursor only moves
// forward, so when the scope changes (the owner switches a seller from
// consignment to store) rows that became visible but have old versions would
// never arrive. Remembering the last scope lets the engine detect that change
// and pull again from zero (the pull upserts by uuid, so nothing duplicates).

const SCOPE_KEY = 'sync-scope';

export async function readCurrentScope(session: Session): Promise<SyncScope | null> {
  if (session.user.role === 'owner') return 'owner';
  const seller = session.seller ? await sellersRepo.getByUuid(session.seller.uuid) : null;
  return scopeOf('seller', seller?.inventoryMode);
}

export function getStoredScope(): string | null {
  try {
    return Storage.getItemSync(SCOPE_KEY);
  } catch {
    return null;
  }
}

export function setStoredScope(scope: SyncScope): void {
  try {
    Storage.setItemSync(SCOPE_KEY, scope);
  } catch {
    // Best-effort: worst case the next scope change is detected one sync late.
  }
}
