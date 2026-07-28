import type { PurchasePaymentInput } from "../validations";

export type PurchasePayment = {
  id: number;
  purchaseOrderId: number;
  amount: number;
  paidAt: string;
  method: string | null;
  notes: string | null;
  createdAt: string;
};

export type PurchaseOrderBalance = {
  totalCost: number;
  totalPaid: number;
  pending: number;
};

// Used by the Fase 9 "cuentas por pagar" report — pending balance grouped by
// distributor, only crédito orders that aren't cancelado.
export type AccountsPayableLine = {
  distributorId: number;
  pending: number;
};

export interface PurchasePaymentsRepo {
  listForOrder(purchaseOrderId: number): Promise<PurchasePayment[]>;
  getBalance(purchaseOrderId: number): Promise<PurchaseOrderBalance>;
  create(purchaseOrderId: number, data: PurchasePaymentInput): Promise<PurchasePayment>;
  getAccountsPayableSummary(): Promise<AccountsPayableLine[]>;
}
