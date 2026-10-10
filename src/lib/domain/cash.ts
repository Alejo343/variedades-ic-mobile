// Ported as-is from the web repo (lib/domain/cash.ts) — keep both in sync.
// Cash movements carry a direction (`type`: ingreso | gasto) that always
// counts toward the balance, and a `sourceType` that says where they came from.
//
// Two sources move a balance without being business income or expense, so
// they are left out of every income/expense figure (Caja del mes, Reportes →
// Flujo de caja, and the mobile app's equivalents):
// - a "cash adjustment" (`sourceType = 'ajuste'`): the money already in the
//   drawer the first day the app is used, or correcting a count difference;
// - a "transfer" between accounts (`sourceType = 'transferencia'`): one gasto
//   in the origin account and one ingreso in the destination, so each account
//   is right and the total balance doesn't change.
//
// Both are stored as regular ingreso/gasto rows on purpose: the mobile app
// syncs cash_movements and computes balances from `type`, so a new `type`
// value would break its balances. `sourceType` already travels in the sync.

export const CASH_ADJUSTMENT_SOURCE = "ajuste";
export const CASH_TRANSFER_SOURCE = "transferencia";

export type CashMovementLike = { type: string; amount: number; sourceType: string | null };

export function isCashAdjustment(m: Pick<CashMovementLike, "sourceType">): boolean {
  return m.sourceType === CASH_ADJUSTMENT_SOURCE;
}

export function isCashTransfer(m: Pick<CashMovementLike, "sourceType">): boolean {
  return m.sourceType === CASH_TRANSFER_SOURCE;
}

/** Real business income/expense: everything except adjustments and transfers. */
export function isBusinessCashMovement(m: Pick<CashMovementLike, "sourceType">): boolean {
  return !isCashAdjustment(m) && !isCashTransfer(m);
}

export type CashFlowSummary = {
  /** Business income (excludes adjustments and transfers). */
  income: number;
  /** Business expense (excludes adjustments and transfers). */
  expense: number;
  /** Net effect of adjustments on the balance (+ added, − removed). */
  adjustments: number;
  /** Net effect of transfers: 0 across all accounts, non-zero for a subset. */
  transfers: number;
  /** Total effect on the balance: income − expense + adjustments + transfers. */
  balanceChange: number;
};

export function summarizeCashFlow(movements: CashMovementLike[]): CashFlowSummary {
  let income = 0;
  let expense = 0;
  let adjustments = 0;
  let transfers = 0;
  for (const m of movements) {
    const signed = m.type === "ingreso" ? m.amount : -m.amount;
    if (isCashAdjustment(m)) adjustments += signed;
    else if (isCashTransfer(m)) transfers += signed;
    else if (m.type === "ingreso") income += m.amount;
    else expense += m.amount;
  }
  return { income, expense, adjustments, transfers, balanceChange: income - expense + adjustments + transfers };
}

export type PlannedTransferMovement = {
  type: "ingreso" | "gasto";
  amount: number;
  accountId: number;
  concept: string;
  sourceType: typeof CASH_TRANSFER_SOURCE;
};

/**
 * The two movements of a transfer: a gasto in `from` and an ingreso in `to`,
 * same amount and concept. The panel and the sync handler both build them
 * here, so a transfer looks the same wherever it was recorded.
 */
export function planCashTransfer(input: {
  from: { id: number; name: string };
  to: { id: number; name: string };
  amount: number;
}): { ok: true; movements: [PlannedTransferMovement, PlannedTransferMovement] } | { ok: false; reason: string } {
  if (input.from.id === input.to.id) return { ok: false, reason: "La cuenta de origen y la de destino deben ser distintas" };
  if (!Number.isInteger(input.amount) || input.amount <= 0) return { ok: false, reason: "El monto debe ser mayor a 0" };
  const concept = `Transferencia: ${input.from.name} → ${input.to.name}`;
  return {
    ok: true,
    movements: [
      { type: "gasto", amount: input.amount, accountId: input.from.id, concept, sourceType: CASH_TRANSFER_SOURCE },
      { type: "ingreso", amount: input.amount, accountId: input.to.id, concept, sourceType: CASH_TRANSFER_SOURCE },
    ],
  };
}
