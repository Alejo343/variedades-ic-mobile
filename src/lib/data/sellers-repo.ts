import type { SellerInput } from "../validations";

export type Seller = {
  id: number;
  name: string;
  phone: string | null;
  city: string | null;
  commissionType: "percentage" | "fixed_per_unit";
  commissionValue: number;
  active: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateSellerInput = SellerInput;
export type UpdateSellerInput = Partial<CreateSellerInput>;

// One line per product currently held by the seller — derived from the
// inventory_movements ledger (ownerType: "seller"), never stored directly.
export type SellerInventoryLine = {
  productId: number;
  quantity: number;
};

// Same as SellerInventoryLine but across all sellers in one grouped query —
// used by the Fase 9 "inventario por vendedor" report, avoids N+1 calls to
// getInventory per seller.
export type SellerInventoryLineWithSeller = SellerInventoryLine & { sellerId: number };

export interface SellersRepo {
  list(): Promise<Seller[]>;
  getById(id: number): Promise<Seller | null>;
  // Lookup by the server-issued uuid — the session only knows the seller by
  // uuid (local ids are per-device), so the seller role resolves "me" here.
  getByUuid(uuid: string): Promise<Seller | null>;
  create(data: CreateSellerInput): Promise<Seller>;
  update(id: number, data: UpdateSellerInput): Promise<Seller>;
  deactivate(id: number): Promise<void>;
  getInventory(sellerId: number): Promise<SellerInventoryLine[]>;
  getAllInventory(): Promise<SellerInventoryLineWithSeller[]>;
}
