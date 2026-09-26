import { desc, eq } from "drizzle-orm";
import { enqueueOperation } from "../../sync/outbox";
import type { DirectSaleInput } from "../../validations";
import type { DirectSale, DirectSaleItem, DirectSalesRepo } from "../direct-sales-repo";
import { recordCashMovementTx } from "./cash-repo";
import { db } from "./db";
import { cashAccounts, directSaleItems, directSales } from "./schema";
import { recordProductMovement } from "./inventory-repo";

function toItem(row: typeof directSaleItems.$inferSelect): DirectSaleItem {
  return {
    id: row.id,
    saleId: row.saleId,
    productId: row.productId,
    quantity: row.quantity,
    unitPrice: row.unitPrice,
    subtotal: row.subtotal,
  };
}

export const localDirectSalesRepo: DirectSalesRepo = {
  async list() {
    const sales = await db.select().from(directSales).orderBy(desc(directSales.saleDate));
    const result: DirectSale[] = [];
    for (const sale of sales) {
      const items = await db.select().from(directSaleItems).where(eq(directSaleItems.saleId, sale.id));
      result.push({
        id: sale.id,
        saleDate: sale.saleDate,
        totalAmount: sale.totalAmount,
        accountId: sale.accountId,
        notes: sale.notes,
        createdAt: sale.createdAt,
        items: items.map(toItem),
      });
    }
    return result;
  },

  async create(data: DirectSaleInput) {
    return db.transaction(async (tx) => {
      const account = await tx.query.cashAccounts.findFirst({ where: eq(cashAccounts.id, data.accountId), columns: { uuid: true } });
      if (!account) throw new Error("Cuenta no encontrada");

      const [sale] = await tx
        .insert(directSales)
        .values({ totalAmount: 0, accountId: data.accountId, notes: data.notes ?? null })
        .returning();

      let totalAmount = 0;
      const items: DirectSaleItem[] = [];
      const outboxItems: { uuid: string; productUuid: string; quantity: number; unitPrice: number; movementUuid: string }[] = [];

      for (const item of data.items) {
        // Throws (and rolls back the whole transaction) if stock is
        // insufficient — same fail-fast guarantee as recordAdjustment.
        const { productUuid, movementUuid } = await recordProductMovement(tx, {
          productId: item.productId,
          quantityDelta: -item.quantity,
          type: "venta",
          sourceType: "direct_sale",
        });

        const subtotal = item.quantity * item.unitPrice;
        totalAmount += subtotal;

        const [row] = await tx
          .insert(directSaleItems)
          .values({ saleId: sale.id, productId: item.productId, quantity: item.quantity, unitPrice: item.unitPrice, subtotal })
          .returning();
        items.push(toItem(row));
        outboxItems.push({ uuid: row.uuid, productUuid, quantity: item.quantity, unitPrice: item.unitPrice, movementUuid });
      }

      const [updated] = await tx.update(directSales).set({ totalAmount }).where(eq(directSales.id, sale.id)).returning();

      // cashMovementUuid stays absent when there's no income to record (a
      // free/zero-total sale) — the web's createDirectSale only requires it
      // when totalAmount > 0.
      let cashMovementUuid: string | undefined;
      if (totalAmount > 0) {
        const movement = await recordCashMovementTx(tx, {
          type: "ingreso",
          amount: totalAmount,
          concept: `Venta en local #${sale.id}`,
          sourceType: "direct_sale",
          sourceId: sale.id,
          accountId: data.accountId,
        });
        cashMovementUuid = movement.uuid;
      }

      await enqueueOperation(tx, "createDirectSale", {
        uuid: updated.uuid,
        saleDate: updated.saleDate,
        accountUuid: account.uuid,
        notes: updated.notes,
        cashMovementUuid,
        items: outboxItems,
      });

      return {
        id: updated.id,
        saleDate: updated.saleDate,
        totalAmount: updated.totalAmount,
        accountId: updated.accountId,
        notes: updated.notes,
        createdAt: updated.createdAt,
        items,
      };
    });
  },
};
