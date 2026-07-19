import { and, desc, eq, sql } from "drizzle-orm";
import { applyMovement, type MovementType, validateAdjustmentReason } from "../../domain/inventory-movement";
import type { InventoryAdjustmentInput } from "../../validations";
import type { InventoryMovement, InventoryRepo } from "../inventory-repo";
import type { Product } from "../products-repo";
import type { Tx } from "./db";
import { db } from "./db";
import { inventoryMovements, products } from "./schema";

// Reused by other local/* repos (e.g. direct-sales-repo) that need to move
// principal stock and record the ledger entry inside their own transaction —
// same role as recordPrincipalMovement in the web repo's lib/db/queries/inventory.ts.
export async function recordProductMovement(
  tx: Tx,
  input: { productId: number; quantityDelta: number; type: MovementType; reason?: string | null; sourceType?: string | null },
): Promise<{ newStock: number }> {
  const product = await tx.query.products.findFirst({ where: eq(products.id, input.productId) });
  if (!product) throw new Error("Producto no encontrado");

  const result = applyMovement(product.stock, input.quantityDelta);
  if (!result.ok) throw new Error(result.reason);

  await tx
    .update(products)
    .set({ stock: result.newBalance, updatedAt: new Date().toISOString() })
    .where(eq(products.id, input.productId));

  await tx.insert(inventoryMovements).values({
    productId: input.productId,
    type: input.type,
    quantityDelta: input.quantityDelta,
    reason: input.reason ?? null,
    sourceType: input.sourceType ?? null,
  });

  return { newStock: result.newBalance };
}

function toProduct(row: typeof products.$inferSelect): Product {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    sku: row.sku,
    price: row.price,
    purchasePrice: row.purchasePrice,
    categoryId: row.categoryId,
    stock: row.stock,
    minStock: row.minStock,
    warrantyMonths: row.warrantyMonths,
    active: row.active,
    imageUri: row.imageUri,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

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

    return db.transaction((tx) =>
      recordProductMovement(tx, {
        productId: input.productId,
        quantityDelta: input.quantityDelta,
        type: "ajuste",
        reason: input.reason,
        sourceType: "manual",
      }),
    );
  },

  async getMovementsForProduct(productId: number) {
    const rows = await db
      .select()
      .from(inventoryMovements)
      .where(eq(inventoryMovements.productId, productId))
      .orderBy(desc(inventoryMovements.createdAt));
    return rows.map(toMovement);
  },

  async getRecentMovements(limit = 50) {
    const rows = await db.select().from(inventoryMovements).orderBy(desc(inventoryMovements.createdAt)).limit(limit);
    return rows.map(toMovement);
  },

  async getLowStock() {
    const rows = await db
      .select()
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
    const rows = await db.select().from(products).where(and(eq(products.active, true), eq(products.stock, 0)));
    return rows.map(toProduct);
  },
};
