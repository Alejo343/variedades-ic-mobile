import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { toSqliteUtcTimestamp } from "../../format";
import { enqueueOperation } from "../../sync/outbox";
import type { CommissionPayment, CommissionPaymentsRepo, CreateCommissionPaymentInput } from "../commission-payments-repo";
import { recordCashMovementTx } from "./cash-repo";
import { db, type Tx } from "./db";
import { cashAccounts, commissionPayments, directSales, sellers } from "./schema";

// Same rule as the server (lib/db/queries/commission-payments.ts): every
// in-store sale of the seller on or before periodDate not yet paid. Like the
// settlements preview, DATE() runs on the UTC text — the server recomputes the
// real total in its own time zone when the operation syncs.
const pendingSales = (sellerId: number, periodDate: string) =>
  and(eq(directSales.sellerId, sellerId), sql`DATE(${directSales.saleDate}) <= ${periodDate}`, isNull(directSales.commissionPaymentId));

async function pending(dbOrTx: typeof db | Tx, sellerId: number, periodDate: string) {
  const [row] = await dbOrTx
    .select({
      saleCount: sql<number>`COUNT(*)`,
      totalCommission: sql<number>`COALESCE(SUM(${directSales.commissionAmount}), 0)`,
    })
    .from(directSales)
    .where(pendingSales(sellerId, periodDate));
  return { saleCount: row?.saleCount ?? 0, totalCommission: row?.totalCommission ?? 0 };
}

function toPayment(row: typeof commissionPayments.$inferSelect): CommissionPayment {
  return {
    id: row.id,
    sellerId: row.sellerId,
    periodDate: row.periodDate,
    saleCount: row.saleCount,
    totalCommission: row.totalCommission,
    accountId: row.accountId,
    paidAt: row.paidAt,
    notes: row.notes,
  };
}

export const localCommissionPaymentsRepo: CommissionPaymentsRepo = {
  async listForSeller(sellerId: number) {
    const rows = await db
      .select()
      .from(commissionPayments)
      .where(eq(commissionPayments.sellerId, sellerId))
      .orderBy(desc(commissionPayments.paidAt));
    return rows.map(toPayment);
  },

  preview(sellerId: number, periodDate: string) {
    return pending(db, sellerId, periodDate);
  },

  async create(data: CreateCommissionPaymentInput) {
    return db.transaction(async (tx) => {
      const seller = await tx.query.sellers.findFirst({ where: eq(sellers.id, data.sellerId), columns: { uuid: true, name: true } });
      if (!seller) throw new Error("Vendedor no encontrado");
      const account = await tx.query.cashAccounts.findFirst({ where: eq(cashAccounts.id, data.accountId), columns: { uuid: true } });
      if (!account) throw new Error("Cuenta no encontrada");

      const { saleCount, totalCommission } = await pending(tx, data.sellerId, data.periodDate);
      if (totalCommission <= 0) throw new Error("No hay comisiones pendientes hasta esa fecha");

      // toSqliteUtcTimestamp: paidAt travels in the outbox payload, and the
      // server rejects the "T...Z" shape (CLAUDE.md, bug of 2026-10-03).
      const paidAt = toSqliteUtcTimestamp(new Date());
      const [row] = await tx
        .insert(commissionPayments)
        .values({
          sellerId: data.sellerId,
          periodDate: data.periodDate,
          saleCount,
          totalCommission,
          accountId: data.accountId,
          paidAt,
          notes: data.notes ?? null,
        })
        .returning();

      await tx.update(directSales).set({ commissionPaymentId: row.id }).where(pendingSales(data.sellerId, data.periodDate));

      const movement = await recordCashMovementTx(tx, {
        type: "gasto",
        amount: totalCommission,
        concept: `Comisiones ${seller.name} hasta ${data.periodDate}`,
        sourceType: "commission_payment",
        sourceId: row.id,
        accountId: data.accountId,
      });

      // The server recomputes what's pending with its own data; this device's
      // totals are replaced on the next pull.
      await enqueueOperation(tx, "createCommissionPayment", {
        uuid: row.uuid,
        sellerUuid: seller.uuid,
        periodDate: data.periodDate,
        accountUuid: account.uuid,
        paidAt,
        cashMovementUuid: movement.uuid,
        notes: row.notes,
      });

      return toPayment(row);
    });
  },
};
