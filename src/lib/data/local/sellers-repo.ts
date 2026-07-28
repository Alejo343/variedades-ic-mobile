import { and, eq, sql } from "drizzle-orm";
import type { CreateSellerInput, Seller, SellerInventoryLineWithSeller, SellersRepo, UpdateSellerInput } from "../sellers-repo";
import { db } from "./db";
import { inventoryMovements, sellers } from "./schema";

function toSeller(row: typeof sellers.$inferSelect): Seller {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    city: row.city,
    commissionType: row.commissionType as Seller["commissionType"],
    commissionValue: row.commissionValue,
    active: row.active,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const localSellersRepo: SellersRepo = {
  async list() {
    const rows = await db.select().from(sellers).orderBy(sellers.name);
    return rows.map(toSeller);
  },

  async getById(id: number) {
    const row = await db.query.sellers.findFirst({ where: eq(sellers.id, id) });
    return row ? toSeller(row) : null;
  },

  async create(data: CreateSellerInput) {
    const [row] = await db
      .insert(sellers)
      .values({
        name: data.name,
        phone: data.phone ?? null,
        city: data.city ?? null,
        commissionType: data.commissionType,
        commissionValue: data.commissionValue,
        active: data.active ?? true,
        notes: data.notes ?? null,
      })
      .returning();
    return toSeller(row);
  },

  async update(id: number, data: UpdateSellerInput) {
    const [row] = await db
      .update(sellers)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(sellers.id, id))
      .returning();
    if (!row) throw new Error("Vendedor no encontrado");
    return toSeller(row);
  },

  async deactivate(id: number) {
    await db
      .update(sellers)
      .set({ active: false, updatedAt: new Date().toISOString() })
      .where(eq(sellers.id, id));
  },

  async getInventory(sellerId: number) {
    const rows = await db
      .select({
        productId: inventoryMovements.productId,
        quantity: sql<number>`SUM(${inventoryMovements.quantityDelta})`,
      })
      .from(inventoryMovements)
      .where(and(eq(inventoryMovements.ownerType, "seller"), eq(inventoryMovements.sellerId, sellerId)))
      .groupBy(inventoryMovements.productId);
    return rows.filter((row) => row.quantity > 0);
  },

  async getAllInventory() {
    const rows = await db
      .select({
        sellerId: inventoryMovements.sellerId,
        productId: inventoryMovements.productId,
        quantity: sql<number>`SUM(${inventoryMovements.quantityDelta})`,
      })
      .from(inventoryMovements)
      .where(eq(inventoryMovements.ownerType, "seller"))
      .groupBy(inventoryMovements.sellerId, inventoryMovements.productId);
    return rows.filter((row) => row.sellerId !== null && row.quantity > 0) as SellerInventoryLineWithSeller[];
  },
};
