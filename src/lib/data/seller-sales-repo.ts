import type { SellerSaleInput } from "../validations";

export type SellerSaleItem = {
  id: number;
  saleId: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

export type SellerSale = {
  id: number;
  sellerId: number;
  saleDate: string;
  totalAmount: number;
  commissionAmount: number;
  // The settlement that included it (null = still pending).
  settlementId: number | null;
  // Same as DirectSale.voidedAt / voidReason.
  voidedAt: string | null;
  voidReason: string | null;
  notes: string | null;
  createdAt: string;
  items: SellerSaleItem[];
};

// Used by the Fase 9 "ventas por vendedor" report — one row per seller with
// counts/totals, grouped in a single query instead of N+1 listForSeller calls.
export type SellerSalesSummaryLine = {
  sellerId: number;
  count: number;
  totalAmount: number;
  totalCommission: number;
};

export interface SellerSalesRepo {
  list(): Promise<SellerSale[]>;
  listForSeller(sellerId: number): Promise<SellerSale[]>;
  create(data: SellerSaleInput): Promise<SellerSale>;
  // Owner only. Units back into the seller's inventory, the sale kept and
  // marked. Throws saleVoidBlocker's reason when it can't (e.g. settled).
  voidSale(id: number, reason?: string | null): Promise<void>;
  // Every sale made by each seller: consignment sales plus a store seller's
  // in-store sales (direct_sales tagged with them).
  getSummaryBySeller(): Promise<SellerSalesSummaryLine[]>;
}
