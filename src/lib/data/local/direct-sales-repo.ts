import { desc, eq } from "drizzle-orm";
import type { DirectSaleInput } from "../../validations";
import type { DirectSale, DirectSaleItem, DirectSalesRepo } from "../direct-sales-repo";
import { recordCashMovementTx } from "./cash-repo";
import { db } from "./db";
import { directSaleItems, directSales } from "./schema";
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
        notes: sale.notes,
        createdAt: sale.createdAt,
        items: items.map(toItem),
      });
    }
    return result;
  },

  async create(data: DirectSaleInput) {
    return db.transaction(async (tx) => {
      const [sale] = await tx.insert(directSales).values({ totalAmount: 0, notes: data.notes ?? null }).returning();

      let totalAmount = 0;
      const items: DirectSaleItem[] = [];

      for (const item of data.items) {
        // Throws (and rolls back the whole transaction) if stock is
        // insufficient — same fail-fast guarantee as recordAdjustment.
        await recordProductMovement(tx, {
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
      }

      const [updated] = await tx.update(directSales).set({ totalAmount }).where(eq(directSales.id, sale.id)).returning();

      if (totalAmount > 0) {
        await recordCashMovementTx(tx, {
          type: "ingreso",
          amount: totalAmount,
          concept: `Venta en local #${sale.id}`,
          sourceType: "direct_sale",
          sourceId: sale.id,
        });
      }

      return {
        id: updated.id,
        saleDate: updated.saleDate,
        totalAmount: updated.totalAmount,
        notes: updated.notes,
        createdAt: updated.createdAt,
        items,
      };
    });
  },
};
