export type InventorySummary = {
  activeProducts: number;
  totalUnits: number;
  totalValue: number;
};

export type PurchasesReportLine = { distributorId: number | null; count: number; total: number };
export type PurchasesReport = { totalCount: number; totalAmount: number; byDistributor: PurchasesReportLine[] };

export type SalesChannelTotal = { count: number; total: number };
export type SalesReport = {
  totalCount: number;
  totalAmount: number;
  byChannel: { local: SalesChannelTotal; seller: SalesChannelTotal };
};

export type ProfitReport = { revenue: number; cogs: number; profit: number };

// from/to are 'YYYY-MM-DD' strings (inclusive), or omitted for "all time" —
// only the "flujo" reports (compras/ventas/utilidad) take a range, see
// CLAUDE.md "Alcance — Fase 9" for why state reports (inventario, stock,
// cuentas por pagar) never take one.
export interface ReportsRepo {
  getInventorySummary(): Promise<InventorySummary>;
  getPurchasesReport(from?: string, to?: string): Promise<PurchasesReport>;
  getSalesReport(from?: string, to?: string): Promise<SalesReport>;
  getProfitReport(from?: string, to?: string): Promise<ProfitReport>;
}
