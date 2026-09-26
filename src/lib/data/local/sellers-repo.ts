import { and, eq, sql } from "drizzle-orm";
import { enqueueOperation } from "../../sync/outbox";
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

// See categories-repo.ts#toUpsertPayload — same "whole row, last write wins" contract.
function toUpsertPayload(row: typeof sellers.$inferSelect) {
  return {
    uuid: row.uuid,
    name: row.name,
    phone: row.phone,
    city: row.city,
    commissionType: row.commissionType,
    commissionValue: row.commissionValue,
    active: row.active,
    notes: row.notes,
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

  async getByUuid(uuid: string) {
    const row = await db.query.sellers.findFirst({ where: eq(sellers.uuid, uuid) });
    return row ? toSeller(row) : null;
  },

  async create(data: CreateSellerInput) {
    return db.transaction(async (tx) => {
      const [row] = await tx
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
      await enqueueOperation(tx, "upsertSeller", toUpsertPayload(row));
      return toSeller(row);
    });
  },

  async update(id: number, data: UpdateSellerInput) {
    return db.transaction(async (tx) => {
      const [row] = await tx
        .update(sellers)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(eq(sellers.id, id))
        .returning();
      if (!row) throw new Error("Vendedor no encontrado");
      await enqueueOperation(tx, "upsertSeller", toUpsertPayload(row));
      return toSeller(row);
    });
  },

  async deactivate(id: number) {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .update(sellers)
        .set({ active: false, updatedAt: new Date().toISOString() })
        .where(eq(sellers.id, id))
        .returning();
      if (row) await enqueueOperation(tx, "upsertSeller", toUpsertPayload(row));
    });
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
