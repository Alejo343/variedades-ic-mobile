import type { SellerDeliveryInput } from "../validations";

export type SellerDeliveryItem = {
  id: number;
  deliveryId: number;
  productId: number;
  quantity: number;
  unitCost: number;
};

export type SellerDelivery = {
  id: number;
  sellerId: number;
  deliveryDate: string;
  notes: string | null;
  createdAt: string;
  items: SellerDeliveryItem[];
};

export interface SellerDeliveriesRepo {
  list(): Promise<SellerDelivery[]>;
  listForSeller(sellerId: number): Promise<SellerDelivery[]>;
  create(data: SellerDeliveryInput): Promise<SellerDelivery>;
}
