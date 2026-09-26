import { desc, eq, sql } from "drizzle-orm";
import { enqueueOperation } from "../../sync/outbox";
import type { SellerReturnInput } from "../../validations";
import type { SellerReturn, SellerReturnItem, SellerReturnsRepo } from "../seller-returns-repo";
import { recordProductMovement, recordSellerMovement } from "./inventory-repo";
import { db } from "./db";
import { sellers, sellerReturns, sellerReturnItems } from "./schema";

function toReturn(row: typeof sellerReturns.$inferSelect): Omit<SellerReturn, "items"> {
  return {
    id: row.id,
    sellerId: row.sellerId,
    returnDate: row.returnDate,
    notes: row.notes,
    createdAt: row.createdAt,
  };
}

function toItem(row: typeof sellerReturnItems.$inferSelect): SellerReturnItem {
  return {
    id: row.id,
    returnId: row.returnId,
    productId: row.productId,
    quantity: row.quantity,
  };
}

async function withItems(rows: (typeof sellerReturns.$inferSelect)[]): Promise<SellerReturn[]> {
  const result: SellerReturn[] = [];
  for (const row of rows) {
    const items = await db.select().from(sellerReturnItems).where(eq(sellerReturnItems.returnId, row.id));
    result.push({ ...toReturn(row), items: items.map(toItem) });
  }
  return result;
}

export const localSellerReturnsRepo: SellerReturnsRepo = {
  async list() {
    const rows = await db.select().from(sellerReturns).orderBy(desc(sellerReturns.returnDate));
    return withItems(rows);
  },

  async listForSeller(sellerId: number) {
    const rows = await db.select().from(sellerReturns).where(eq(sellerReturns.sellerId, sellerId)).orderBy(desc(sellerReturns.returnDate));
    return withItems(rows);
  },

  async create(data: SellerReturnInput) {
    return db.transaction(async (tx) => {
      const seller = await tx.query.sellers.findFirst({ where: eq(sellers.id, data.sellerId), columns: { uuid: true } });
      if (!seller) throw new Error("Vendedor no encontrado");

      const [ret] = await tx.insert(sellerReturns).values({ sellerId: data.sellerId, notes: data.notes ?? null }).returning();

      const items: SellerReturnItem[] = [];
      const outboxItems: { uuid: string; productUuid: string; quantity: number; sellerMovementUuid: string; principalMovementUuid: string }[] = [];

      for (const item of data.items) {
        // Descuenta SOLO el inventario de este vendedor — falla y hace
        // rollback si no tiene suficiente disponible.
        const fromSeller = await recordSellerMovement(tx, {
          sellerId: data.sellerId,
          productId: item.productId,
          quantityDelta: -item.quantity,
          type: "devolucion",
          sourceType: "seller_return",
        });

        // Segunda fila del mismo ledger: regresa al inventario principal.
        const toPrincipal = await recordProductMovement(tx, {
          productId: item.productId,
          quantityDelta: item.quantity,
          type: "devolucion",
          sourceType: "seller_return",
        });

        const [row] = await tx
          .insert(sellerReturnItems)
          .values({ returnId: ret.id, productId: item.productId, quantity: item.quantity })
          .returning();
        items.push(toItem(row));
        outboxItems.push({
          uuid: row.uuid,
          productUuid: toPrincipal.productUuid,
          quantity: item.quantity,
          sellerMovementUuid: fromSeller.movementUuid,
          principalMovementUuid: toPrincipal.movementUuid,
        });
      }

      await enqueueOperation(tx, "createSellerReturn", {
        uuid: ret.uuid,
        sellerUuid: seller.uuid,
        returnDate: ret.returnDate,
        notes: ret.notes,
        items: outboxItems,
      });

      return { ...toReturn(ret), items };
    });
  },

  async getReturnedProductsSummary() {
    const rows = await db
      .select({
        productId: sellerReturnItems.productId,
        totalQuantity: sql<number>`COALESCE(SUM(${sellerReturnItems.quantity}), 0)`,
      })
      .from(sellerReturnItems)
      .groupBy(sellerReturnItems.productId);
    return rows;
  },
};
