import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";
import { calculateSettlement } from "../../domain/settlement";
import { canTransitionSettlement, type SettlementStatus } from "../../domain/settlement-status";
import { endOfLocalDayUtc, toSqliteUtcTimestamp } from "../../format";
import { enqueueOperation } from "../../sync/outbox";
import type { SettlementInput } from "../../validations";
import type { Settlement, SettlementPreview, SettlementsRepo } from "../settlements-repo";
import { recordCashMovementTx } from "./cash-repo";
import { db } from "./db";
import type { Tx } from "./db";
import { cashAccounts, cashMovements, sellerLossItems, sellerLosses, sellers, sellerSales, settlements } from "./schema";

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
// settlementId marks keep anything from being charged twice — same rule as
// the web's lib/db/queries/settlements.ts (CLAUDE.md, "Fase 10").
const pendingSales = (sellerId: number, periodDate: string) =>
  and(eq(sellerSales.sellerId, sellerId), lt(sellerSales.saleDate, endOfLocalDayUtc(periodDate)), isNull(sellerSales.settlementId));
const pendingLosses = (sellerId: number, periodDate: string) =>
  and(eq(sellerLosses.sellerId, sellerId), lt(sellerLosses.lossDate, endOfLocalDayUtc(periodDate)), isNull(sellerLosses.settlementId));

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
      const seller = await tx.query.sellers.findFirst({ where: eq(sellers.id, data.sellerId), columns: { uuid: true } });
      if (!seller) throw new Error("Vendedor no encontrado");

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

      // No item-level detail needed here: the server recomputes the same
      // totals from its own (by-then-synced) sales/losses — see
      // CLAUDE.md, "Fase 10", sub-paso 7 parte 3c.
      await enqueueOperation(tx, "createSettlement", { uuid: row.uuid, sellerUuid: seller.uuid, periodDate: data.periodDate });

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

      const account = await tx.query.cashAccounts.findFirst({ where: eq(cashAccounts.id, accountId), columns: { uuid: true } });
      if (!account) throw new Error("Cuenta no encontrada");

      // toSqliteUtcTimestamp, no new Date().toISOString() — settledAt goes
      // straight into the outbox payload below, and the server's schema
      // rejects the "T...Z" shape (bug found live, sesión 2026-10-03).
      const [row] = await tx
        .update(settlements)
        .set({ status: "liquidada", settledAt: toSqliteUtcTimestamp(new Date()) })
        .where(eq(settlements.id, id))
        .returning();

      let cashMovementUuid: string | undefined;
      if (row.amountDue > 0) {
        const movement = await recordCashMovementTx(tx, {
          type: "ingreso",
          amount: row.amountDue,
          concept: `Liquidación vendedor #${row.sellerId} — ${row.periodDate}`,
          sourceType: "settlement",
          sourceId: row.id,
          accountId,
        });
        cashMovementUuid = movement.uuid;
      }

      await enqueueOperation(tx, "markSettlementSettled", {
        settlementUuid: row.uuid,
        accountUuid: account.uuid,
        settledAt: row.settledAt,
        cashMovementUuid,
      });

      return toSettlement(row);
    });
  },

  async resyncSettled(id: number) {
    await db.transaction(async (tx) => {
      const settlement = await tx.query.settlements.findFirst({ where: eq(settlements.id, id) });
      if (!settlement) throw new Error("Liquidación no encontrada");
      if (settlement.status !== "liquidada") throw new Error("Esta liquidación no está liquidada todavía");

      // Normalizes it in passing: a settlement written by the buggy
      // version of markSettled still has settledAt in "...T...Z" shape,
      // stuck that way until something rewrites it.
      const settledAt = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(settlement.settledAt ?? "")
        ? (settlement.settledAt as string)
        : toSqliteUtcTimestamp(new Date(settlement.settledAt ?? Date.now()));
      if (settledAt !== settlement.settledAt) {
        await tx.update(settlements).set({ settledAt }).where(eq(settlements.id, id));
      }

      const movement = await tx.query.cashMovements.findFirst({
        where: and(eq(cashMovements.sourceType, "settlement"), eq(cashMovements.sourceId, id)),
      });
      const account = movement
        ? await tx.query.cashAccounts.findFirst({ where: eq(cashAccounts.id, movement.accountId), columns: { uuid: true } })
        : null;
      // accountUuid is required by the server's schema — fail clearly here
      // instead of sending undefined and getting a less useful rejection.
      if (!account) throw new Error("No se encontró la cuenta de esta liquidación — no se puede reenviar");

      await enqueueOperation(tx, "markSettlementSettled", {
        settlementUuid: settlement.uuid,
        accountUuid: account.uuid,
        settledAt,
        cashMovementUuid: movement?.uuid,
      });
    });
  },
};
