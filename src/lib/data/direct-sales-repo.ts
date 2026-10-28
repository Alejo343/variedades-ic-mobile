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
  // Set when the owner voided it (lib/domain/sale-void.ts): shown marked in
  // lists, left out of every total.
  voidedAt: string | null;
  voidReason: string | null;
  notes: string | null;
  createdAt: string;
  items: DirectSaleItem[];
};

export interface DirectSalesRepo {
  list(): Promise<DirectSale[]>;
  create(data: DirectSaleInput): Promise<DirectSale>;
  // Owner only. Units back into the principal stock, the cash income removed,
  // the sale kept and marked. Throws saleVoidBlocker's reason when it can't.
  voidSale(id: number, reason?: string | null): Promise<void>;
}
