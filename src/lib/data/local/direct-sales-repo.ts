import { and, desc, eq } from "drizzle-orm";
import { calculateCommission, type CommissionLine } from "../../domain/commission";
import { normalizeVoidReason, saleVoidBlocker } from "../../domain/sale-void";
import { toSqliteUtcTimestamp } from "../../format";
import { enqueueOperation } from "../../sync/outbox";
import type { DirectSaleInput } from "../../validations";
import type { DirectSale, DirectSaleItem, DirectSalesRepo } from "../direct-sales-repo";
import { recordCashMovementTx } from "./cash-repo";
import { db } from "./db";
import { productCommissionBps } from "./product-commission";
import { cashAccounts, cashMovements, directSaleItems, directSales, sellers } from "./schema";
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
        voidedAt: sale.voidedAt,
        voidReason: sale.voidReason,
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
      const commissionLines: CommissionLine[] = [];
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
        // A salaried seller earns no commission (lib/domain/salary.ts).
        if (seller && seller.payType !== "salary") {
          commissionLines.push({ quantity: item.quantity, unitPrice: item.unitPrice, commissionBps: await productCommissionBps(tx, item.productId) });
        }

        const [row] = await tx
          .insert(directSaleItems)
          .values({ saleId: sale.id, productId: item.productId, quantity: item.quantity, unitPrice: item.unitPrice, subtotal })
          .returning();
        items.push(toItem(row));
        outboxItems.push({ uuid: row.uuid, productUuid, quantity: item.quantity, unitPrice: item.unitPrice, movementUuid });
      }

      // Local estimate only: the server recomputes the commission with each
      // product's current percentage (on the line's already-discounted
      // unitPrice) and the next pull replaces this value.
      const commissionAmount = calculateCommission(commissionLines);
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
        voidedAt: updated.voidedAt,
        voidReason: updated.voidReason,
        notes: updated.notes,
        createdAt: updated.createdAt,
        items,
      };
    });
  },

  async voidSale(id: number, reason?: string | null) {
    await db.transaction(async (tx) => {
      const sale = await tx.query.directSales.findFirst({ where: eq(directSales.id, id) });
      if (!sale) throw new Error("Venta no encontrada");
      const blocker = saleVoidBlocker(sale);
      if (blocker) throw new Error(blocker);

      // Units back into the principal stock, one 'anulacion' movement per
      // item — the server writes the same rows with these uuids.
      const items = await tx.select().from(directSaleItems).where(eq(directSaleItems.saleId, id));
      const outboxItems: { itemUuid: string; movementUuid: string }[] = [];
      for (const item of items) {
        const { movementUuid } = await recordProductMovement(tx, {
          productId: item.productId,
          quantityDelta: item.quantity,
          type: "anulacion",
          sourceType: "direct_sale",
        });
        outboxItems.push({ itemUuid: item.uuid, movementUuid });
      }

      // The income goes away (the server deletes it too): balances and every
      // cash flow drop it with no special case.
      await tx.delete(cashMovements).where(and(eq(cashMovements.sourceType, "direct_sale"), eq(cashMovements.sourceId, id)));

      // toSqliteUtcTimestamp: it travels in the payload (CLAUDE.md, "Fechas").
      const voidedAt = toSqliteUtcTimestamp(new Date());
      const voidReason = normalizeVoidReason(reason);
      await tx.update(directSales).set({ voidedAt, voidReason }).where(eq(directSales.id, id));
      await enqueueOperation(tx, "voidDirectSale", { saleUuid: sale.uuid, voidedAt, reason: voidReason, items: outboxItems });
    });
  },
};
