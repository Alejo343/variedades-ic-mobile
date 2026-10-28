// Voiding a sale the owner registered by mistake (decisión del usuario,
// 2026-10-28): the sale is never deleted, it's marked voided; its units go
// back where they came from and its cash income is removed. To fix a sale it
// is voided and registered again. The mobile app has an identical copy.
//
// Contract:
// - Only the owner voids (the sync operations aren't seller operations).
// - A sale already counted in money that changed hands can't be voided: a
//   consignment sale inside a settlement, or an in-store sale whose seller
//   commission was already paid. Closed accounts never change.
// - Voiding twice is refused.

export const SALE_ALREADY_VOIDED = "Esta venta ya está anulada.";
export const SALE_IN_SETTLEMENT =
  "Esta venta ya está en una liquidación: no se puede anular. Corrige la diferencia en la próxima liquidación o con un movimiento de caja.";
export const SALE_COMMISSION_PAID =
  "La comisión de esta venta ya se pagó: no se puede anular. Corrige la diferencia con un movimiento de caja.";

export type VoidableSale = {
  voidedAt: unknown;
  /** Consignment sales: the settlement that included it. */
  settlementId?: number | null;
  /** In-store sales of a seller: the commission payment that paid it. */
  commissionPaymentId?: number | null;
};

/** Why the sale can't be voided, or null when it can. */
export function saleVoidBlocker(sale: VoidableSale): string | null {
  if (sale.voidedAt != null) return SALE_ALREADY_VOIDED;
  if (sale.settlementId != null) return SALE_IN_SETTLEMENT;
  if (sale.commissionPaymentId != null) return SALE_COMMISSION_PAID;
  return null;
}

export const VOID_REASON_MAX = 500;

/** The optional reason as stored: trimmed, null when empty. */
export function normalizeVoidReason(reason: string | null | undefined): string | null {
  const text = (reason ?? "").trim();
  return text === "" ? null : text.slice(0, VOID_REASON_MAX);
}

/** The sales that count in totals: every one but the voided. */
export function countedSales<T extends { voidedAt: unknown }>(sales: T[]): T[] {
  return sales.filter((s) => s.voidedAt == null);
}
