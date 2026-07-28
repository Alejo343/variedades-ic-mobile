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
  markSettled(id: number): Promise<Settlement>;
}
