import type { SalaryPeriod } from "../domain/salary";

// The owner paying a salaried store seller one period of their salary (a week
// from its Monday or a calendar month, lib/domain/salary.ts). The amount
// defaults to the seller's salary but may differ (advances, absences,
// bonuses). Paid on creation: an expense in the chosen account. A period is
// paid only once.
export type SalaryPayment = {
  id: number;
  sellerId: number;
  period: SalaryPeriod;
  periodStart: string; // 'YYYY-MM-DD'
  amount: number;
  accountId: number;
  paidAt: string;
  notes: string | null;
};

export type CreateSalaryPaymentInput = {
  sellerId: number;
  period: SalaryPeriod;
  periodStart: string;
  amount: number;
  accountId: number;
  notes?: string;
};

export interface SalaryPaymentsRepo {
  // Newest first.
  listForSeller(sellerId: number): Promise<SalaryPayment[]>;
  // Throws when periodStart doesn't start a period, the amount isn't a
  // positive integer, or that period is already paid on this device.
  create(data: CreateSalaryPaymentInput): Promise<SalaryPayment>;
}
