import { and, desc, eq, sql } from "drizzle-orm";
import { applyMovement, type MovementType, validateAdjustmentReason } from "../../domain/inventory-movement";
import { enqueueOperation } from "../../sync/outbox";
import type { InventoryAdjustmentInput } from "../../validations";
import type { InventoryMovement, InventoryRepo } from "../inventory-repo";
import type { Tx } from "./db";
import { db } from "./db";
import { productColumns, toProduct } from "./products-repo";
import { inventoryMovements, products } from "./schema";

// Reused by other local/* repos (e.g. direct-sales-repo) that need to move
// principal stock and record the ledger entry inside their own transaction —
// same role as recordPrincipalMovement in the web repo's lib/db/queries/inventory.ts.
// Returns both uuids the caller needs to build its own outbox payload:
// productUuid comes free from the row this function already has to load to
// check the balance, so no extra query is needed for it.
export async function recordProductMovement(
  tx: Tx,
  input: { productId: number; quantityDelta: number; type: MovementType; reason?: string | null; sourceType?: string | null },
): Promise<{ newStock: number; productUuid: string; movementUuid: string; movementCreatedAt: string }> {
  const product = await tx.query.products.findFirst({ where: eq(products.id, input.productId) });
  if (!product) throw new Error("Producto no encontrado");

  const result = applyMovement(product.stock, input.quantityDelta);
  if (!result.ok) throw new Error(result.reason);

  await tx
    .update(products)
    .set({ stock: result.newBalance, updatedAt: new Date().toISOString() })
    .where(eq(products.id, input.productId));

  const [movement] = await tx
    .insert(inventoryMovements)
    .values({
      productId: input.productId,
      type: input.type,
      quantityDelta: input.quantityDelta,
      reason: input.reason ?? null,
      sourceType: input.sourceType ?? null,
    })
    .returning();

  return { newStock: result.newBalance, productUuid: product.uuid, movementUuid: movement.uuid, movementCreatedAt: movement.createdAt };
}

// Same role as recordProductMovement but for a seller's consigned inventory
// (ownerType: "seller") — never touches products.stock. The balance it
// validates against is the SUM of that seller's own ledger rows, not
// products.stock. Reused by seller-deliveries-repo (positive deltas, always
// succeed) and seller-sales-repo (negative deltas, fail-fast if insufficient).
export async function recordSellerMovement(
  tx: Tx,
  input: { sellerId: number; productId: number; quantityDelta: number; type: MovementType; sourceType?: string | null },
): Promise<{ newSellerStock: number; productUuid: string; movementUuid: string; movementCreatedAt: string }> {
  const [row] = await tx
    .select({ total: sql<number>`COALESCE(SUM(${inventoryMovements.quantityDelta}), 0)` })
    .from(inventoryMovements)
    .where(
      and(
        eq(inventoryMovements.ownerType, "seller"),
        eq(inventoryMovements.sellerId, input.sellerId),
        eq(inventoryMovements.productId, input.productId),
      ),
    );
  const current = row?.total ?? 0;

  const result = applyMovement(current, input.quantityDelta);
  if (!result.ok) throw new Error(result.reason);

  // Not otherwise needed here (unlike recordProductMovement, which loads the
  // product row anyway to check stock) — one extra lookup by primary key,
  // just for the uuid the caller's outbox payload needs.
  const product = await tx.query.products.findFirst({ where: eq(products.id, input.productId), columns: { uuid: true } });
  if (!product) throw new Error("Producto no encontrado");

  const [movement] = await tx
    .insert(inventoryMovements)
    .values({
      productId: input.productId,
      type: input.type,
      quantityDelta: input.quantityDelta,
      sourceType: input.sourceType ?? null,
      ownerType: "seller",
      sellerId: input.sellerId,
    })
    .returning();

  return { newSellerStock: result.newBalance, productUuid: product.uuid, movementUuid: movement.uuid, movementCreatedAt: movement.createdAt };
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

  async getRecentMovements(limit = 50) {
    const rows = await db.select().from(inventoryMovements).orderBy(desc(inventoryMovements.createdAt)).limit(limit);
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
    const rows = await db.select(productColumns).from(products).where(and(eq(products.active, true), eq(products.stock, 0)));
    return rows.map(toProduct);
  },
};
