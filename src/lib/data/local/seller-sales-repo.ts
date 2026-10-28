import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { calculateCommission, type CommissionLine } from "../../domain/commission";
import { normalizeVoidReason, saleVoidBlocker } from "../../domain/sale-void";
import { toSqliteUtcTimestamp } from "../../format";
import { enqueueOperation } from "../../sync/outbox";
import type { SellerSaleInput } from "../../validations";
import type { SellerSale, SellerSaleItem, SellerSalesRepo } from "../seller-sales-repo";
import { productCommissionBps } from "./product-commission";
import { recordSellerMovement } from "./stock-movements";
import { db } from "./db";
import { directSales, sellers, sellerSaleItems, sellerSales } from "./schema";

function toSale(row: typeof sellerSales.$inferSelect): Omit<SellerSale, "items"> {
  return {
    id: row.id,
    sellerId: row.sellerId,
    saleDate: row.saleDate,
    totalAmount: row.totalAmount,
    commissionAmount: row.commissionAmount,
    settlementId: row.settlementId,
    voidedAt: row.voidedAt,
    voidReason: row.voidReason,
    notes: row.notes,
    createdAt: row.createdAt,
  };
}

function toItem(row: typeof sellerSaleItems.$inferSelect): SellerSaleItem {
  return {
    id: row.id,
    saleId: row.saleId,
    productId: row.productId,
    quantity: row.quantity,
    unitPrice: row.unitPrice,
    subtotal: row.subtotal,
  };
}

async function withItems(rows: (typeof sellerSales.$inferSelect)[]): Promise<SellerSale[]> {
  const result: SellerSale[] = [];
  for (const row of rows) {
    const items = await db.select().from(sellerSaleItems).where(eq(sellerSaleItems.saleId, row.id));
    result.push({ ...toSale(row), items: items.map(toItem) });
  }
  return result;
}

export const localSellerSalesRepo: SellerSalesRepo = {
  async list() {
    const rows = await db.select().from(sellerSales).orderBy(desc(sellerSales.saleDate));
    return withItems(rows);
  },

  async listForSeller(sellerId: number) {
    const rows = await db.select().from(sellerSales).where(eq(sellerSales.sellerId, sellerId)).orderBy(desc(sellerSales.saleDate));
    return withItems(rows);
  },

  async create(data: SellerSaleInput) {
    return db.transaction(async (tx) => {
      const seller = await tx.query.sellers.findFirst({ where: eq(sellers.id, data.sellerId) });
      if (!seller) throw new Error("Vendedor no encontrado");

      const [sale] = await tx
        .insert(sellerSales)
        .values({ sellerId: data.sellerId, totalAmount: 0, commissionAmount: 0, notes: data.notes ?? null })
        .returning();

      let totalAmount = 0;
      const commissionLines: CommissionLine[] = [];
      const items: SellerSaleItem[] = [];
      const outboxItems: { uuid: string; productUuid: string; quantity: number; unitPrice: number; movementUuid: string }[] = [];

      for (const item of data.items) {
        // Descuenta SOLO el inventario de este vendedor — nunca el
        // principal. Falla y hace rollback si no tiene suficiente disponible.
        const { productUuid, movementUuid } = await recordSellerMovement(tx, {
          sellerId: data.sellerId,
          productId: item.productId,
          quantityDelta: -item.quantity,
          type: "venta",
          sourceType: "seller_sale",
        });

        const subtotal = item.quantity * item.unitPrice;
        totalAmount += subtotal;
        commissionLines.push({ quantity: item.quantity, unitPrice: item.unitPrice, commissionBps: await productCommissionBps(tx, item.productId) });

        const [row] = await tx
          .insert(sellerSaleItems)
          .values({ saleId: sale.id, productId: item.productId, quantity: item.quantity, unitPrice: item.unitPrice, subtotal })
          .returning();
        items.push(toItem(row));
        outboxItems.push({ uuid: row.uuid, productUuid, quantity: item.quantity, unitPrice: item.unitPrice, movementUuid });
      }

      // Each product's own percentage (domain/commission.ts).
      const commissionAmount = calculateCommission(commissionLines);

      // A diferencia de direct-sales-repo, esto no genera un ingreso en
      // cash_movements: el dinero de la venta lo retiene el vendedor hasta
      // que liquide (Fase 7).
      const [updated] = await tx
        .update(sellerSales)
        .set({ totalAmount, commissionAmount })
        .where(eq(sellerSales.id, sale.id))
        .returning();

      // commissionAmount/totalAmount aren't sent: the server recomputes both
      // from each product's current commission, then the phone's next
      // pull replaces this local estimate (CLAUDE.md, "Fase 10", sub-paso 7
      // parte 2).
      await enqueueOperation(tx, "createSellerSale", {
        uuid: updated.uuid,
        sellerUuid: seller.uuid,
        saleDate: updated.saleDate,
        notes: updated.notes,
        items: outboxItems,
      });

      return { ...toSale(updated), items };
    });
  },

  async voidSale(id: number, reason?: string | null) {
    await db.transaction(async (tx) => {
      const sale = await tx.query.sellerSales.findFirst({ where: eq(sellerSales.id, id) });
      if (!sale) throw new Error("Venta no encontrada");
      const blocker = saleVoidBlocker(sale);
      if (blocker) throw new Error(blocker);

      // Units back into the seller's inventory; no cash to undo (the money
      // only reaches the shop when the seller settles).
      const items = await tx.select().from(sellerSaleItems).where(eq(sellerSaleItems.saleId, id));
      const outboxItems: { itemUuid: string; movementUuid: string }[] = [];
      for (const item of items) {
        const { movementUuid } = await recordSellerMovement(tx, {
          sellerId: sale.sellerId,
          productId: item.productId,
          quantityDelta: item.quantity,
          type: "anulacion",
          sourceType: "seller_sale",
        });
        outboxItems.push({ itemUuid: item.uuid, movementUuid });
      }

      const voidedAt = toSqliteUtcTimestamp(new Date());
      const voidReason = normalizeVoidReason(reason);
      await tx.update(sellerSales).set({ voidedAt, voidReason }).where(eq(sellerSales.id, id));
      await enqueueOperation(tx, "voidSellerSale", { saleUuid: sale.uuid, voidedAt, reason: voidReason, items: outboxItems });
    });
  },

  async getSummaryBySeller() {
    const [consignment, store] = await Promise.all([
      db
        .select({
          sellerId: sellerSales.sellerId,
          count: sql<number>`COUNT(*)`,
          totalAmount: sql<number>`COALESCE(SUM(${sellerSales.totalAmount}), 0)`,
          totalCommission: sql<number>`COALESCE(SUM(${sellerSales.commissionAmount}), 0)`,
        })
        .from(sellerSales)
        .where(isNull(sellerSales.voidedAt))
        .groupBy(sellerSales.sellerId),
      db
        .select({
          sellerId: directSales.sellerId,
          count: sql<number>`COUNT(*)`,
          totalAmount: sql<number>`COALESCE(SUM(${directSales.totalAmount}), 0)`,
          totalCommission: sql<number>`COALESCE(SUM(${directSales.commissionAmount}), 0)`,
        })
        .from(directSales)
        .where(and(isNotNull(directSales.sellerId), isNull(directSales.voidedAt)))
        .groupBy(directSales.sellerId),
    ]);

    const bySeller = new Map(consignment.map((row) => [row.sellerId, { ...row }]));
    for (const row of store) {
      const sellerId = row.sellerId!;
      const line = bySeller.get(sellerId) ?? { sellerId, count: 0, totalAmount: 0, totalCommission: 0 };
      line.count += row.count;
      line.totalAmount += row.totalAmount;
      line.totalCommission += row.totalCommission;
      bySeller.set(sellerId, line);
    }
    return [...bySeller.values()];
  },
};
