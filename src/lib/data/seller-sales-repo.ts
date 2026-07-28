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
  getSummaryBySeller(): Promise<SellerSalesSummaryLine[]>;
}
