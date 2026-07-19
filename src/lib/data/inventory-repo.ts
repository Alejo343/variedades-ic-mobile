import type { MovementType } from "../domain/inventory-movement";
import type { InventoryAdjustmentInput } from "../validations";
import type { Product } from "./products-repo";

export type InventoryMovement = {
  id: number;
  productId: number;
  type: MovementType;
  quantityDelta: number;
  reason: string | null;
  sourceType: string | null;
  createdAt: string;
};

export interface InventoryRepo {
  recordAdjustment(input: InventoryAdjustmentInput): Promise<{ newStock: number }>;
  getMovementsForProduct(productId: number): Promise<InventoryMovement[]>;
  getRecentMovements(limit?: number): Promise<InventoryMovement[]>;
  getLowStock(): Promise<Product[]>;
  getOutOfStock(): Promise<Product[]>;
}
