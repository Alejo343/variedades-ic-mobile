import type { SellerReturnInput } from "../validations";

export type SellerReturnItem = {
  id: number;
  returnId: number;
  productId: number;
  quantity: number;
};

export type SellerReturn = {
  id: number;
  sellerId: number;
  returnDate: string;
  notes: string | null;
  createdAt: string;
  items: SellerReturnItem[];
};

// Used by the Fase 9 "productos devueltos" report — total returned units per
// product across all sellers, all time (no date filter, see CLAUDE.md).
export type ReturnedProductSummaryLine = {
  productId: number;
  totalQuantity: number;
};

export interface SellerReturnsRepo {
  list(): Promise<SellerReturn[]>;
  listForSeller(sellerId: number): Promise<SellerReturn[]>;
  create(data: SellerReturnInput): Promise<SellerReturn>;
  getReturnedProductsSummary(): Promise<ReturnedProductSummaryLine[]>;
}
