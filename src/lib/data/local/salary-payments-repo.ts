import { and, desc, eq } from "drizzle-orm";
import { formatSalaryPeriod, isSalaryPeriodStart, SALARY_PERIOD_ALREADY_PAID, type SalaryPeriod } from "../../domain/salary";
import { toSqliteUtcTimestamp } from "../../format";
import { enqueueOperation } from "../../sync/outbox";
import type { CreateSalaryPaymentInput, SalaryPayment, SalaryPaymentsRepo } from "../salary-payments-repo";
import { recordCashMovementTx } from "./cash-repo";
import { db } from "./db";
import { cashAccounts, salaryPayments, sellers } from "./schema";

function toPayment(row: typeof salaryPayments.$inferSelect): SalaryPayment {
  return {
    id: row.id,
    sellerId: row.sellerId,
    period: row.period as SalaryPeriod,
    periodStart: row.periodStart,
    amount: row.amount,
    accountId: row.accountId,
    paidAt: row.paidAt,
    notes: row.notes,
  };
}

// Same rule as the server (lib/db/queries/salary-payments.ts), which checks
// again with its own data and rejects a period another phone already paid.
export const localSalaryPaymentsRepo: SalaryPaymentsRepo = {
  async listForSeller(sellerId: number) {
    const rows = await db
      .select()
      .from(salaryPayments)
      .where(eq(salaryPayments.sellerId, sellerId))
      .orderBy(desc(salaryPayments.paidAt), desc(salaryPayments.id));
    return rows.map(toPayment);
  },

  async create(data: CreateSalaryPaymentInput) {
    return db.transaction(async (tx) => {
      const seller = await tx.query.sellers.findFirst({ where: eq(sellers.id, data.sellerId), columns: { uuid: true, name: true } });
      if (!seller) throw new Error("Vendedor no encontrado");
      const account = await tx.query.cashAccounts.findFirst({ where: eq(cashAccounts.id, data.accountId), columns: { uuid: true } });
      if (!account) throw new Error("Cuenta no encontrada");
      if (!isSalaryPeriodStart(data.periodStart, data.period)) {
        throw new Error(data.period === "weekly" ? "La semana debe empezar en lunes" : "El mes debe empezar el día 1");
      }
      if (!Number.isInteger(data.amount) || data.amount <= 0) throw new Error("El valor debe ser mayor que cero");

      const existing = await tx.query.salaryPayments.findFirst({
        where: and(
          eq(salaryPayments.sellerId, data.sellerId),
          eq(salaryPayments.period, data.period),
          eq(salaryPayments.periodStart, data.periodStart),
        ),
        columns: { id: true },
      });
      if (existing) throw new Error(SALARY_PERIOD_ALREADY_PAID);

      // toSqliteUtcTimestamp: paidAt travels in the outbox payload, and the
      // server rejects the "T...Z" shape (CLAUDE.md, bug of 2026-10-03).
      const paidAt = toSqliteUtcTimestamp(new Date());
      const [row] = await tx
        .insert(salaryPayments)
        .values({
          sellerId: data.sellerId,
          period: data.period,
          periodStart: data.periodStart,
          amount: data.amount,
          accountId: data.accountId,
          paidAt,
          notes: data.notes ?? null,
        })
        .returning();

      const movement = await recordCashMovementTx(tx, {
        type: "gasto",
        amount: data.amount,
        concept: `Sueldo ${seller.name} · ${formatSalaryPeriod(data.periodStart, data.period)}`,
        sourceType: "salary_payment",
        sourceId: row.id,
        accountId: data.accountId,
      });

      await enqueueOperation(tx, "createSalaryPayment", {
        uuid: row.uuid,
        sellerUuid: seller.uuid,
        period: data.period,
        periodStart: data.periodStart,
        amount: data.amount,
        accountUuid: account.uuid,
        paidAt,
        cashMovementUuid: movement.uuid,
        notes: row.notes,
      });

      return toPayment(row);
    });
  },
};
