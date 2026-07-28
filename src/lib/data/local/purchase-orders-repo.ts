import { desc, eq } from "drizzle-orm";
import { canTransitionPurchaseOrder, type PurchaseOrderStatus } from "../../domain/order-status";
import type { PurchaseOrderInput } from "../../validations";
import type { PurchaseOrder, PurchaseOrderItem, PurchaseOrdersRepo } from "../purchase-orders-repo";
import { recordProductMovement } from "./inventory-repo";
import { db } from "./db";
import { purchaseOrders, purchaseOrderItems } from "./schema";

function toOrder(row: typeof purchaseOrders.$inferSelect): Omit<PurchaseOrder, "items"> {
  return {
    id: row.id,
    distributorId: row.distributorId,
    status: row.status as PurchaseOrderStatus,
    purchaseType: row.purchaseType as PurchaseOrder["purchaseType"],
    orderDate: row.orderDate,
    expectedDate: row.expectedDate,
    totalCost: row.totalCost,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toItem(row: typeof purchaseOrderItems.$inferSelect): PurchaseOrderItem {
  return {
    id: row.id,
    orderId: row.orderId,
    productId: row.productId,
    quantity: row.quantity,
    unitCost: row.unitCost,
  };
}

async function withItems(rows: (typeof purchaseOrders.$inferSelect)[]): Promise<PurchaseOrder[]> {
  const result: PurchaseOrder[] = [];
  for (const row of rows) {
    const items = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.orderId, row.id));
    result.push({ ...toOrder(row), items: items.map(toItem) });
  }
  return result;
}

function requireTransition(from: PurchaseOrderStatus, to: PurchaseOrderStatus) {
  if (!canTransitionPurchaseOrder(from, to)) {
    throw new Error(`No se puede pasar un pedido de '${from}' a '${to}'`);
  }
}

export const localPurchaseOrdersRepo: PurchaseOrdersRepo = {
  async list() {
    const rows = await db.select().from(purchaseOrders).orderBy(desc(purchaseOrders.orderDate));
    return withItems(rows);
  },

  async getById(id: number) {
    const row = await db.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.id, id) });
    if (!row) return null;
    const [order] = await withItems([row]);
    return order;
  },

  async create(data: PurchaseOrderInput) {
    return db.transaction(async (tx) => {
      const [order] = await tx
        .insert(purchaseOrders)
        .values({
          distributorId: data.distributorId ?? null,
          purchaseType: data.purchaseType ?? "contado",
          expectedDate: data.expectedDate ?? null,
          notes: data.notes ?? null,
        })
        .returning();

      let totalCost = 0;
      const items: PurchaseOrderItem[] = [];
      for (const item of data.items) {
        totalCost += item.quantity * item.unitCost;
        const [row] = await tx
          .insert(purchaseOrderItems)
          .values({ orderId: order.id, productId: item.productId, quantity: item.quantity, unitCost: item.unitCost })
          .returning();
        items.push(toItem(row));
      }

      const [updated] = await tx.update(purchaseOrders).set({ totalCost }).where(eq(purchaseOrders.id, order.id)).returning();

      return { ...toOrder(updated), items };
    });
  },

  async markInTransit(id: number) {
    return db.transaction(async (tx) => {
      const existing = await tx.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.id, id) });
      if (!existing) throw new Error("Pedido no encontrado");
      requireTransition(existing.status as PurchaseOrderStatus, "en_viaje");

      const [row] = await tx
        .update(purchaseOrders)
        .set({ status: "en_viaje", updatedAt: new Date().toISOString() })
        .where(eq(purchaseOrders.id, id))
        .returning();
      const items = await tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.orderId, id));
      return { ...toOrder(row), items: items.map(toItem) };
    });
  },

  async markReceived(id: number) {
    return db.transaction(async (tx) => {
      const existing = await tx.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.id, id) });
      if (!existing) throw new Error("Pedido no encontrado");
      requireTransition(existing.status as PurchaseOrderStatus, "recibido");

      const items = await tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.orderId, id));
      for (const item of items) {
        await recordProductMovement(tx, {
          productId: item.productId,
          quantityDelta: item.quantity,
          type: "compra",
          sourceType: "purchase_order",
        });
      }

      const [row] = await tx
        .update(purchaseOrders)
        .set({ status: "recibido", updatedAt: new Date().toISOString() })
        .where(eq(purchaseOrders.id, id))
        .returning();
      return { ...toOrder(row), items: items.map(toItem) };
    });
  },

  async cancel(id: number) {
    return db.transaction(async (tx) => {
      const existing = await tx.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.id, id) });
      if (!existing) throw new Error("Pedido no encontrado");
      requireTransition(existing.status as PurchaseOrderStatus, "cancelado");

      const [row] = await tx
        .update(purchaseOrders)
        .set({ status: "cancelado", updatedAt: new Date().toISOString() })
        .where(eq(purchaseOrders.id, id))
        .returning();
      const items = await tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.orderId, id));
      return { ...toOrder(row), items: items.map(toItem) };
    });
  },
};
