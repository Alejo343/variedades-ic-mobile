import { and, desc, eq, sql } from "drizzle-orm";
import { validateAdjustmentReason } from "../../domain/inventory-movement";
import { enqueueOperation } from "../../sync/outbox";
import type { InventoryAdjustmentInput } from "../../validations";
import type { InventoryMovement, InventoryRepo } from "../inventory-repo";
import { db } from "./db";
import { productColumns, toProduct } from "./products-repo";
import { inventoryMovements, products } from "./schema";
import { recordProductMovement } from "./stock-movements";

// recordProductMovement/recordSellerMovement moved to stock-movements.ts —
// products-repo.ts needs recordProductMovement too (sub-paso: stock inicial
// como ajuste real), and importing it from here while this file imports
// productColumns/toProduct from products-repo.ts made a require cycle. Every
// local/* repo that used them now imports straight from stock-movements.ts.

function toMovement(row: typeof inventoryMovements.$inferSelect): InventoryMovement {
  return {
    id: row.id,
    productId: row.productId,
    type: row.type as InventoryMovement["type"],
    quantityDelta: row.quantityDelta,
    reason: row.reason,
    sourceType: row.sourceType,
    createdAt: row.createdAt,
  };
}

export const localInventoryRepo: InventoryRepo = {
  async recordAdjustment(input: InventoryAdjustmentInput) {
    if (!validateAdjustmentReason("ajuste", input.reason)) {
      throw new Error("El motivo es requerido para un ajuste");
    }

    return db.transaction(async (tx) => {
      const { newStock, productUuid, movementUuid, movementCreatedAt } = await recordProductMovement(tx, {
        productId: input.productId,
        quantityDelta: input.quantityDelta,
        type: "ajuste",
        reason: input.reason,
        sourceType: "manual",
      });
      await enqueueOperation(tx, "createInventoryAdjustment", {
        uuid: movementUuid,
        productUuid,
        quantityDelta: input.quantityDelta,
        reason: input.reason,
        occurredAt: movementCreatedAt,
      });
      return { newStock };
    });
  },

  async getMovementsForProduct(productId: number) {
    const rows = await db
      .select()
      .from(inventoryMovements)
      .where(eq(inventoryMovements.productId, productId))
      .orderBy(desc(inventoryMovements.createdAt));
    return rows.map(toMovement);
  },

  // Only the shop's own (principal) ledger: seller rows (the + side of a
  // delivery, a seller's sale) never touch products.stock and read as noise
  // on the Inventario screen.
  async getRecentMovements(limit = 50) {
    const rows = await db
      .select()
      .from(inventoryMovements)
      .where(eq(inventoryMovements.ownerType, "principal"))
      .orderBy(desc(inventoryMovements.createdAt), desc(inventoryMovements.id))
      .limit(limit);
    return rows.map(toMovement);
  },

  async getLowStock() {
    const rows = await db
      .select(productColumns)
      .from(products)
      .where(
        and(
          eq(products.active, true),
          sql`${products.minStock} > 0`,
          sql`${products.stock} > 0`,
          sql`${products.stock} <= ${products.minStock}`,
        ),
      );
    return rows.map(toProduct);
  },

  async getOutOfStock() {
    // <= 0, not = 0: sync accepts an offline sale of the last unit, so stock
    // can go negative — that product is just as sold out.
    const rows = await db.select(productColumns).from(products).where(and(eq(products.active, true), sql`${products.stock} <= 0`));
    return rows.map(toProduct);
  },
};
