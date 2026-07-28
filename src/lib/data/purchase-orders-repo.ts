import type { PurchaseOrderStatus } from "../domain/order-status";
import type { PurchaseOrderInput } from "../validations";

export type PurchaseOrderItem = {
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
  unitCost: number;
};

export type PurchaseOrder = {
  id: number;
  distributorId: number | null;
  status: PurchaseOrderStatus;
  purchaseType: "contado" | "credito";
  orderDate: string;
  expectedDate: string | null;
  totalCost: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: PurchaseOrderItem[];
};

export interface PurchaseOrdersRepo {
  list(): Promise<PurchaseOrder[]>;
  getById(id: number): Promise<PurchaseOrder | null>;
  create(data: PurchaseOrderInput): Promise<PurchaseOrder>;
  markInTransit(id: number): Promise<PurchaseOrder>;
  markReceived(id: number): Promise<PurchaseOrder>;
  cancel(id: number): Promise<PurchaseOrder>;
}
