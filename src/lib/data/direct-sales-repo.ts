import type { DirectSaleInput } from "../validations";

export type DirectSaleItem = {
  id: number;
  saleId: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

export type DirectSale = {
  id: number;
  saleDate: string;
  totalAmount: number;
  accountId: number;
  // Set when a 'store' seller made the sale (null = the owner).
  sellerId: number | null;
  commissionAmount: number;
  // Set once a commission payment covered this sale (null = still pending).
  commissionPaymentId: number | null;
  notes: string | null;
  createdAt: string;
  items: DirectSaleItem[];
};

export interface DirectSalesRepo {
  list(): Promise<DirectSale[]>;
  create(data: DirectSaleInput): Promise<DirectSale>;
}
