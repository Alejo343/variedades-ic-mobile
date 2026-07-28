import { desc, eq } from "drizzle-orm";
import type { SellerLossInput } from "../../validations";
import type { SellerLoss, SellerLossItem, SellerLossesRepo } from "../seller-losses-repo";
import { recordSellerMovement } from "./inventory-repo";
import { db } from "./db";
import { sellerLosses, sellerLossItems } from "./schema";

function toLoss(row: typeof sellerLosses.$inferSelect): Omit<SellerLoss, "items"> {
  return {
    id: row.id,
    sellerId: row.sellerId,
    type: row.type as SellerLoss["type"],
    lossDate: row.lossDate,
    notes: row.notes,
    createdAt: row.createdAt,
  };
}

function toItem(row: typeof sellerLossItems.$inferSelect): SellerLossItem {
  return {
    id: row.id,
    lossId: row.lossId,
    productId: row.productId,
    quantity: row.quantity,
    unitCost: row.unitCost,
  };
}

async function withItems(rows: (typeof sellerLosses.$inferSelect)[]): Promise<SellerLoss[]> {
  const result: SellerLoss[] = [];
  for (const row of rows) {
    const items = await db.select().from(sellerLossItems).where(eq(sellerLossItems.lossId, row.id));
    result.push({ ...toLoss(row), items: items.map(toItem) });
  }
  return result;
}

export const localSellerLossesRepo: SellerLossesRepo = {
  async list() {
    const rows = await db.select().from(sellerLosses).orderBy(desc(sellerLosses.lossDate));
    return withItems(rows);
  },

  async listForSeller(sellerId: number) {
    const rows = await db.select().from(sellerLosses).where(eq(sellerLosses.sellerId, sellerId)).orderBy(desc(sellerLosses.lossDate));
    return withItems(rows);
  },

  async create(data: SellerLossInput) {
    return db.transaction(async (tx) => {
      const [loss] = await tx
        .insert(sellerLosses)
        .values({ sellerId: data.sellerId, type: data.type, notes: data.notes ?? null })
        .returning();

      const items: SellerLossItem[] = [];
      for (const item of data.items) {
        // Descuenta SOLO el inventario de este vendedor — el principal
        // nunca se toca, el costo lo asume el vendedor.
        await recordSellerMovement(tx, {
          sellerId: data.sellerId,
          productId: item.productId,
          quantityDelta: -item.quantity,
          type: data.type,
          sourceType: "seller_loss",
        });

        const [row] = await tx
          .insert(sellerLossItems)
          .values({ lossId: loss.id, productId: item.productId, quantity: item.quantity, unitCost: item.unitCost })
          .returning();
        items.push(toItem(row));
      }

      return { ...toLoss(loss), items };
    });
  },
};
