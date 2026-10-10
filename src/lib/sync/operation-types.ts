// Mirrors the web's lib/domain/sync-permissions.ts#SYNC_OPERATION_TYPES
// exactly (separate repos, so this is a copy, not shared code) — every type
// the server knows how to apply (sub-paso 7). Kept as its own file so
// outbox.ts and the repo files that enqueue operations don't have to import
// the whole sync module graph just for this list.
export const SYNC_OPERATION_TYPES = [
  'upsertCategory',
  'upsertProduct',
  'upsertSeller',
  'upsertDistributor',
  'upsertCashAccount',
  'createInventoryAdjustment',
  'createCashMovement',
  'createCashTransfer',
  'createDirectSale',
  'createSellerDelivery',
  'createSellerSale',
  'createSellerReturn',
  'createSellerLoss',
  'createPurchaseOrder',
  'transitionPurchaseOrder',
  'createPurchasePayment',
  'createSettlement',
  'markSettlementSettled',
  'createCommissionPayment',
] as const;

export type SyncOperationType = (typeof SYNC_OPERATION_TYPES)[number];
