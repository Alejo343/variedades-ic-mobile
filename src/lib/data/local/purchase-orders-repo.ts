import { desc, eq } from "drizzle-orm";
import { canTransitionPurchaseOrder, type PurchaseOrderStatus } from "../../domain/order-status";
import { toSqliteUtcTimestamp } from "../../format";
import { enqueueOperation } from "../../sync/outbox";
import type { PurchaseOrderInput } from "../../validations";
import type { PurchaseOrder, PurchaseOrderItem, PurchaseOrdersRepo } from "../purchase-orders-repo";
import { recordProductMovement } from "./stock-movements";
import { db } from "./db";
import { distributors, products, purchaseOrders, purchaseOrderItems } from "./schema";

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
      const distributorUuid = data.distributorId
        ? (await tx.query.distributors.findFirst({ where: eq(distributors.id, data.distributorId), columns: { uuid: true } }))?.uuid ?? null
        : null;

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
      const outboxItems: { uuid: string; productUuid: string; quantity: number; unitCost: number }[] = [];
      for (const item of data.items) {
        totalCost += item.quantity * item.unitCost;
        const product = await tx.query.products.findFirst({ where: eq(products.id, item.productId), columns: { uuid: true } });
        if (!product) throw new Error("Producto no encontrado");
        const [row] = await tx
          .insert(purchaseOrderItems)
          .values({ orderId: order.id, productId: item.productId, quantity: item.quantity, unitCost: item.unitCost })
          .returning();
        items.push(toItem(row));
        outboxItems.push({ uuid: row.uuid, productUuid: product.uuid, quantity: item.quantity, unitCost: item.unitCost });
      }

      const [updated] = await tx.update(purchaseOrders).set({ totalCost }).where(eq(purchaseOrders.id, order.id)).returning();

      await enqueueOperation(tx, "createPurchaseOrder", {
        uuid: updated.uuid,
        distributorUuid,
        purchaseType: updated.purchaseType,
        orderDate: updated.orderDate,
        expectedDate: updated.expectedDate,
        notes: updated.notes,
        items: outboxItems,
      });

      return { ...toOrder(updated), items };
    });
  },

  async markInTransit(id: number) {
    return db.transaction(async (tx) => {
      const existing = await tx.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.id, id) });
      if (!existing) throw new Error("Pedido no encontrado");
      requireTransition(existing.status as PurchaseOrderStatus, "en_viaje");

      // toSqliteUtcTimestamp, no new Date().toISOString() — updatedAt feeds
      // occurredAt below, straight into the outbox payload (same bug as
      // settlements-repo.ts#markSettled, found live sesión 2026-10-03).
      const [row] = await tx
        .update(purchaseOrders)
        .set({ status: "en_viaje", updatedAt: toSqliteUtcTimestamp(new Date()) })
        .where(eq(purchaseOrders.id, id))
        .returning();
      const items = await tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.orderId, id));
      await enqueueOperation(tx, "transitionPurchaseOrder", { purchaseOrderUuid: row.uuid, to: "en_viaje", occurredAt: row.updatedAt });
      return { ...toOrder(row), items: items.map(toItem) };
    });
  },

  async markReceived(id: number) {
    return db.transaction(async (tx) => {
      const existing = await tx.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.id, id) });
      if (!existing) throw new Error("Pedido no encontrado");
      requireTransition(existing.status as PurchaseOrderStatus, "recibido");

      const items = await tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.orderId, id));
      const receivedMovements: { itemUuid: string; movementUuid: string }[] = [];
      for (const item of items) {
        const { movementUuid } = await recordProductMovement(tx, {
          productId: item.productId,
          quantityDelta: item.quantity,
          type: "compra",
          sourceType: "purchase_order",
        });
        receivedMovements.push({ itemUuid: item.uuid, movementUuid });
      }

      const [row] = await tx
        .update(purchaseOrders)
        .set({ status: "recibido", updatedAt: toSqliteUtcTimestamp(new Date()) })
        .where(eq(purchaseOrders.id, id))
        .returning();
      await enqueueOperation(tx, "transitionPurchaseOrder", {
        purchaseOrderUuid: row.uuid,
        to: "recibido",
        occurredAt: row.updatedAt,
        receivedMovements,
      });
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
        .set({ status: "cancelado", updatedAt: toSqliteUtcTimestamp(new Date()) })
        .where(eq(purchaseOrders.id, id))
        .returning();
      const items = await tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.orderId, id));
      await enqueueOperation(tx, "transitionPurchaseOrder", { purchaseOrderUuid: row.uuid, to: "cancelado", occurredAt: row.updatedAt });
      return { ...toOrder(row), items: items.map(toItem) };
    });
  },
};
