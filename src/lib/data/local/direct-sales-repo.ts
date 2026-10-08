import { desc, eq } from "drizzle-orm";
import { calculateCommission, type CommissionConfig } from "../../domain/commission";
import { enqueueOperation } from "../../sync/outbox";
import type { DirectSaleInput } from "../../validations";
import type { DirectSale, DirectSaleItem, DirectSalesRepo } from "../direct-sales-repo";
import { recordCashMovementTx } from "./cash-repo";
import { db } from "./db";
import { cashAccounts, directSaleItems, directSales, sellers } from "./schema";
import { recordProductMovement } from "./stock-movements";

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
        sellerId: sale.sellerId,
        commissionAmount: sale.commissionAmount,
        commissionPaymentId: sale.commissionPaymentId,
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

      // A 'store' seller sells the principal inventory; a consignment seller
      // never records a direct sale (they sell their own stock instead).
      const seller =
        data.sellerId === undefined ? undefined : await tx.query.sellers.findFirst({ where: eq(sellers.id, data.sellerId) });
      if (data.sellerId !== undefined && !seller) throw new Error("Vendedor no encontrado");
      if (seller && seller.inventoryMode !== "store") {
        throw new Error("Este vendedor es de consignación: solo puede vender su propio inventario");
      }

      const [sale] = await tx
        .insert(directSales)
        .values({ totalAmount: 0, accountId: data.accountId, sellerId: seller?.id ?? null, notes: data.notes ?? null })
        .returning();

      let totalAmount = 0;
      let totalQuantity = 0;
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
        totalQuantity += item.quantity;

        const [row] = await tx
          .insert(directSaleItems)
          .values({ saleId: sale.id, productId: item.productId, quantity: item.quantity, unitPrice: item.unitPrice, subtotal })
          .returning();
        items.push(toItem(row));
        outboxItems.push({ uuid: row.uuid, productUuid, quantity: item.quantity, unitPrice: item.unitPrice, movementUuid });
      }

      // Local estimate only: the server recomputes the commission with the
      // seller's current config and the next pull replaces this value.
      const commissionAmount = seller
        ? calculateCommission(
            { type: seller.commissionType as CommissionConfig["type"], value: seller.commissionValue },
            totalAmount,
            totalQuantity,
          )
        : 0;
      const [updated] = await tx
        .update(directSales)
        .set({ totalAmount, commissionAmount })
        .where(eq(directSales.id, sale.id))
        .returning();

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
        sellerUuid: seller?.uuid,
        notes: updated.notes,
        cashMovementUuid,
        items: outboxItems,
      });

      return {
        id: updated.id,
        saleDate: updated.saleDate,
        totalAmount: updated.totalAmount,
        accountId: updated.accountId,
        sellerId: updated.sellerId,
        commissionAmount: updated.commissionAmount,
        commissionPaymentId: updated.commissionPaymentId,
        notes: updated.notes,
        createdAt: updated.createdAt,
        items,
      };
    });
  },
};
