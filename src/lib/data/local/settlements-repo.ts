import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { calculateSettlement } from "../../domain/settlement";
import { canTransitionSettlement, type SettlementStatus } from "../../domain/settlement-status";
import type { SettlementInput } from "../../validations";
import type { Settlement, SettlementPreview, SettlementsRepo } from "../settlements-repo";
import { recordCashMovementTx } from "./cash-repo";
import { db } from "./db";
import type { Tx } from "./db";
import { sellerLossItems, sellerLosses, sellerSales, settlements } from "./schema";

function toSettlement(row: typeof settlements.$inferSelect): Settlement {
  return {
    id: row.id,
    sellerId: row.sellerId,
    periodDate: row.periodDate,
    totalSales: row.totalSales,
    totalCommission: row.totalCommission,
    totalLosses: row.totalLosses,
    amountDue: row.amountDue,
    status: row.status as SettlementStatus,
    settledAt: row.settledAt,
    createdAt: row.createdAt,
  };
}

// A settlement charges everything the seller still owes UP TO its date: every
// sale and loss on or before periodDate that no earlier settlement included.
// Anything that arrived late (e.g. a seller's phone that synced after the day
// was settled) lands in the next settlement instead of being lost, and the
// settlementId marks keep anything from being charged twice. Same rule as the
// web's lib/db/queries/settlements.ts (CLAUDE.md, "Fase 10").
const pendingSales = (sellerId: number, periodDate: string) =>
  and(eq(sellerSales.sellerId, sellerId), sql`DATE(${sellerSales.saleDate}) <= ${periodDate}`, isNull(sellerSales.settlementId));
const pendingLosses = (sellerId: number, periodDate: string) =>
  and(eq(sellerLosses.sellerId, sellerId), sql`DATE(${sellerLosses.lossDate}) <= ${periodDate}`, isNull(sellerLosses.settlementId));

async function aggregatePeriod(dbOrTx: typeof db | Tx, sellerId: number, periodDate: string): Promise<SettlementPreview> {
  const [salesRow] = await dbOrTx
    .select({
      totalSales: sql<number>`COALESCE(SUM(${sellerSales.totalAmount}), 0)`,
      totalCommission: sql<number>`COALESCE(SUM(${sellerSales.commissionAmount}), 0)`,
    })
    .from(sellerSales)
    .where(pendingSales(sellerId, periodDate));

  const [lossRow] = await dbOrTx
    .select({
      totalLosses: sql<number>`COALESCE(SUM(${sellerLossItems.quantity} * ${sellerLossItems.unitCost}), 0)`,
    })
    .from(sellerLossItems)
    .innerJoin(sellerLosses, eq(sellerLossItems.lossId, sellerLosses.id))
    .where(pendingLosses(sellerId, periodDate));

  const totals = {
    totalSales: salesRow?.totalSales ?? 0,
    totalCommission: salesRow?.totalCommission ?? 0,
    totalLosses: lossRow?.totalLosses ?? 0,
  };
  const { amountDue } = calculateSettlement(totals);
  return { ...totals, amountDue };
}

export const localSettlementsRepo: SettlementsRepo = {
  async list() {
    const rows = await db.select().from(settlements).orderBy(desc(settlements.periodDate));
    return rows.map(toSettlement);
  },

  async getById(id: number) {
    const row = await db.query.settlements.findFirst({ where: eq(settlements.id, id) });
    return row ? toSettlement(row) : null;
  },

  async preview(sellerId: number, periodDate: string) {
    return aggregatePeriod(db, sellerId, periodDate);
  },

  async create(data: SettlementInput) {
    return db.transaction(async (tx) => {
      const existing = await tx.query.settlements.findFirst({
        where: and(eq(settlements.sellerId, data.sellerId), eq(settlements.periodDate, data.periodDate)),
      });
      if (existing) throw new Error("Ya existe una liquidación para este vendedor en esta fecha");

      const totals = await aggregatePeriod(tx, data.sellerId, data.periodDate);

      const [row] = await tx
        .insert(settlements)
        .values({
          sellerId: data.sellerId,
          periodDate: data.periodDate,
          totalSales: totals.totalSales,
          totalCommission: totals.totalCommission,
          totalLosses: totals.totalLosses,
          amountDue: totals.amountDue,
        })
        .returning();

      await tx.update(sellerSales).set({ settlementId: row.id }).where(pendingSales(data.sellerId, data.periodDate));
      await tx.update(sellerLosses).set({ settlementId: row.id }).where(pendingLosses(data.sellerId, data.periodDate));

      return toSettlement(row);
    });
  },

  async markSettled(id: number, accountId: number) {
    return db.transaction(async (tx) => {
      const existing = await tx.query.settlements.findFirst({ where: eq(settlements.id, id) });
      if (!existing) throw new Error("Liquidación no encontrada");

      if (!canTransitionSettlement(existing.status as SettlementStatus, "liquidada")) {
        throw new Error(`No se puede liquidar una liquidación en estado '${existing.status}'`);
      }

      const [row] = await tx
        .update(settlements)
        .set({ status: "liquidada", settledAt: new Date().toISOString() })
        .where(eq(settlements.id, id))
        .returning();

      if (row.amountDue > 0) {
        await recordCashMovementTx(tx, {
          type: "ingreso",
          amount: row.amountDue,
          concept: `Liquidación vendedor #${row.sellerId} — ${row.periodDate}`,
          sourceType: "settlement",
          sourceId: row.id,
          accountId,
        });
      }

      return toSettlement(row);
    });
  },
};
