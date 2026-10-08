// The owner paying a 'store' seller the commissions of their in-store sales.
// A payment covers every sale of that seller on or before periodDate that no
// earlier payment covered (same "todo lo pendiente hasta la fecha" rule as
// settlements), and is paid on creation: an expense in the chosen account.
export type CommissionPayment = {
  id: number;
  sellerId: number;
  periodDate: string;
  saleCount: number;
  totalCommission: number;
  accountId: number;
  paidAt: string;
  notes: string | null;
};

export type CommissionPaymentPreview = { saleCount: number; totalCommission: number };

export type CreateCommissionPaymentInput = {
  sellerId: number;
  periodDate: string; // 'YYYY-MM-DD'
  accountId: number;
  notes?: string;
};

export interface CommissionPaymentsRepo {
  listForSeller(sellerId: number): Promise<CommissionPayment[]>;
  preview(sellerId: number, periodDate: string): Promise<CommissionPaymentPreview>;
  create(data: CreateCommissionPaymentInput): Promise<CommissionPayment>;
}
