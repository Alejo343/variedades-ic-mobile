export type SettlementTotals = {
  totalSales: number;
  totalCommission: number;
  totalLosses: number;
};

export type SettlementResult = {
  amountDue: number;
};

export function calculateSettlement(totals: SettlementTotals): SettlementResult {
  return { amountDue: totals.totalSales - totals.totalCommission + totals.totalLosses };
}
