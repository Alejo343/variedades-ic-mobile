import { desc, eq } from "drizzle-orm";
import { enqueueOperation } from "../../sync/outbox";
import type { SellerLossInput } from "../../validations";
import type { SellerLoss, SellerLossItem, SellerLossesRepo } from "../seller-losses-repo";
import { recordSellerMovement } from "./stock-movements";
import { db } from "./db";
import { sellers, sellerLosses, sellerLossItems } from "./schema";

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
      const seller = await tx.query.sellers.findFirst({ where: eq(sellers.id, data.sellerId), columns: { uuid: true } });
      if (!seller) throw new Error("Vendedor no encontrado");

      const [loss] = await tx
        .insert(sellerLosses)
        .values({ sellerId: data.sellerId, type: data.type, notes: data.notes ?? null })
        .returning();

      const items: SellerLossItem[] = [];
      const outboxItems: { uuid: string; productUuid: string; quantity: number; unitCost: number; movementUuid: string }[] = [];

      for (const item of data.items) {
        // Descuenta SOLO el inventario de este vendedor — el principal
        // nunca se toca, el costo lo asume el vendedor.
        const { productUuid, movementUuid } = await recordSellerMovement(tx, {
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
        // unitCost travels here too, even though a seller's push handler
        // ignores it and prices the loss from the server's own
        // purchase_price — an owner's phone (the only device allowed to set
        // its own price, per lib/domain/sync-permissions) sends it for real.
        outboxItems.push({ uuid: row.uuid, productUuid, quantity: item.quantity, unitCost: item.unitCost, movementUuid });
      }

      await enqueueOperation(tx, "createSellerLoss", {
        uuid: loss.uuid,
        sellerUuid: seller.uuid,
        type: loss.type,
        lossDate: loss.lossDate,
        notes: loss.notes,
        items: outboxItems,
      });

      return { ...toLoss(loss), items };
    });
  },
};
