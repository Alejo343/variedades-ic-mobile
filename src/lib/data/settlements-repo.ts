import type { SettlementStatus } from "../domain/settlement-status";
import type { SettlementInput } from "../validations";

export type Settlement = {
  id: number;
  sellerId: number;
  periodDate: string;
  totalSales: number;
  totalCommission: number;
  totalLosses: number;
  amountDue: number;
  status: SettlementStatus;
  settledAt: string | null;
  createdAt: string;
};

export type SettlementPreview = {
  totalSales: number;
  totalCommission: number;
  totalLosses: number;
  amountDue: number;
};

export interface SettlementsRepo {
  list(): Promise<Settlement[]>;
  getById(id: number): Promise<Settlement | null>;
  preview(sellerId: number, periodDate: string): Promise<SettlementPreview>;
  create(data: SettlementInput): Promise<Settlement>;
  markSettled(id: number, accountId: number): Promise<Settlement>;
  // Rebuilds and re-enqueues markSettlementSettled for a settlement that's
  // already "liquidada" locally — for recovering one whose first attempt
  // got rejected (and the rejection since dismissed) after a bug fix, or any
  // other reason the server never actually got it (CLAUDE.md, "Fase 10",
  // sub-paso 15). Resending one the server already has is harmless: it just
  // gets rejected again (an already-"liquidada" settlement has no further
  // valid transition), same as any other mismatched retry.
  resyncSettled(id: number): Promise<void>;
}
