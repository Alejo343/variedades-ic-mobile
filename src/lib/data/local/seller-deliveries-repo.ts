import { desc, eq } from "drizzle-orm";
import type { SellerDeliveryInput } from "../../validations";
import type { SellerDelivery, SellerDeliveryItem, SellerDeliveriesRepo } from "../seller-deliveries-repo";
import { recordProductMovement, recordSellerMovement } from "./inventory-repo";
import { db } from "./db";
import { sellerDeliveries, sellerDeliveryItems } from "./schema";

function toDelivery(row: typeof sellerDeliveries.$inferSelect): Omit<SellerDelivery, "items"> {
  return {
    id: row.id,
    sellerId: row.sellerId,
    deliveryDate: row.deliveryDate,
    notes: row.notes,
    createdAt: row.createdAt,
  };
}

function toItem(row: typeof sellerDeliveryItems.$inferSelect): SellerDeliveryItem {
  return {
    id: row.id,
    deliveryId: row.deliveryId,
    productId: row.productId,
    quantity: row.quantity,
    unitCost: row.unitCost,
  };
}

async function withItems(rows: (typeof sellerDeliveries.$inferSelect)[]): Promise<SellerDelivery[]> {
  const result: SellerDelivery[] = [];
  for (const row of rows) {
    const items = await db.select().from(sellerDeliveryItems).where(eq(sellerDeliveryItems.deliveryId, row.id));
    result.push({ ...toDelivery(row), items: items.map(toItem) });
  }
  return result;
}

export const localSellerDeliveriesRepo: SellerDeliveriesRepo = {
  async list() {
    const rows = await db.select().from(sellerDeliveries).orderBy(desc(sellerDeliveries.deliveryDate));
    return withItems(rows);
  },

  async listForSeller(sellerId: number) {
    const rows = await db
      .select()
      .from(sellerDeliveries)
      .where(eq(sellerDeliveries.sellerId, sellerId))
      .orderBy(desc(sellerDeliveries.deliveryDate));
    return withItems(rows);
  },

  async create(data: SellerDeliveryInput) {
    return db.transaction(async (tx) => {
      const [delivery] = await tx.insert(sellerDeliveries).values({ sellerId: data.sellerId, notes: data.notes ?? null }).returning();

      const items: SellerDeliveryItem[] = [];
      for (const item of data.items) {
        // Descuenta el inventario principal — falla y hace rollback si no
        // alcanza el stock, mismo criterio fail-fast que direct-sales-repo.
        await recordProductMovement(tx, {
          productId: item.productId,
          quantityDelta: -item.quantity,
          type: "entrega_vendedor",
          sourceType: "seller_delivery",
        });

        // Segunda fila del mismo ledger: entra al inventario del vendedor.
        // No toca products.stock — el inventario del vendedor se deriva del
        // ledger (ownerType: 'seller').
        await recordSellerMovement(tx, {
          sellerId: data.sellerId,
          productId: item.productId,
          quantityDelta: item.quantity,
          type: "entrega_vendedor",
          sourceType: "seller_delivery",
        });

        const [row] = await tx
          .insert(sellerDeliveryItems)
          .values({ deliveryId: delivery.id, productId: item.productId, quantity: item.quantity, unitCost: item.unitCost })
          .returning();
        items.push(toItem(row));
      }

      return { ...toDelivery(delivery), items };
    });
  },
};
