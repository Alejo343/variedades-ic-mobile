// Pure rules behind scope.ts (no storage, no database), so they can be tested
// and imported without native modules.

export type SyncScope = 'owner' | 'seller:consignment' | 'seller:store';

// null = can't tell yet (a seller whose own row hasn't arrived).
export function scopeOf(role: 'owner' | 'seller', inventoryMode: string | null | undefined): SyncScope | null {
  if (role === 'owner') return 'owner';
  if (inventoryMode === 'store') return 'seller:store';
  if (inventoryMode === 'consignment') return 'seller:consignment';
  return null;
}

// Only a change between two known scopes needs a full pull; the very first
// sync already starts from zero.
export function scopeNeedsFullPull(previous: string | null, current: SyncScope | null): boolean {
  return previous !== null && current !== null && previous !== current;
}
