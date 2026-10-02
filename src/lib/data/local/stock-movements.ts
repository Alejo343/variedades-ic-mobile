import { and, eq, sql } from "drizzle-orm";
import { applyMovement, type MovementType } from "../../domain/inventory-movement";
import type { Tx } from "./db";
import { inventoryMovements, products } from "./schema";

// Shared by every repo that moves stock (products-repo's initial-stock
// adjustment, inventory-repo's manual adjustment, direct/seller sales,
// deliveries, returns, losses, purchase orders) — split out of
// inventory-repo.ts on purpose: products-repo.ts needs recordProductMovement
// too, and importing it from inventory-repo.ts (which itself imports
// productColumns/toProduct from products-repo.ts) made a require cycle. No
// repo here imports from products-repo.ts or inventory-repo.ts.

// Reused by other local/* repos that need to move principal stock and record
// the ledger entry inside their own transaction — same role as
// recordPrincipalMovement in the web repo's lib/db/queries/inventory.ts.
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
