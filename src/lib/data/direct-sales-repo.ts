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
  notes: string | null;
  createdAt: string;
  items: DirectSaleItem[];
};

export interface DirectSalesRepo {
  list(): Promise<DirectSale[]>;
  create(data: DirectSaleInput): Promise<DirectSale>;
}
