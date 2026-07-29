import { and, desc, eq, isNotNull, ne, sql } from "drizzle-orm";
import type { PurchasePaymentInput } from "../../validations";
import type { AccountsPayableLine, PurchaseOrderBalance, PurchasePayment, PurchasePaymentsRepo } from "../purchase-payments-repo";
import { recordCashMovementTx } from "./cash-repo";
import { db } from "./db";
import type { Tx } from "./db";
import { purchaseOrders, purchasePayments } from "./schema";

function toPayment(row: typeof purchasePayments.$inferSelect): PurchasePayment {
  return {
    id: row.id,
    purchaseOrderId: row.purchaseOrderId,
    amount: row.amount,
    paidAt: row.paidAt,
    accountId: row.accountId,
    notes: row.notes,
    createdAt: row.createdAt,
  };
}

async function computeBalance(dbOrTx: typeof db | Tx, purchaseOrderId: number): Promise<PurchaseOrderBalance> {
  const order = await dbOrTx.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.id, purchaseOrderId) });
  if (!order) throw new Error("Pedido no encontrado");

  const [row] = await dbOrTx
    .select({ totalPaid: sql<number>`COALESCE(SUM(${purchasePayments.amount}), 0)` })
    .from(purchasePayments)
    .where(eq(purchasePayments.purchaseOrderId, purchaseOrderId));

  const totalPaid = row?.totalPaid ?? 0;
  return { totalCost: order.totalCost, totalPaid, pending: order.totalCost - totalPaid };
}

export const localPurchasePaymentsRepo: PurchasePaymentsRepo = {
  async listForOrder(purchaseOrderId: number) {
    const rows = await db
      .select()
      .from(purchasePayments)
      .where(eq(purchasePayments.purchaseOrderId, purchaseOrderId))
      .orderBy(desc(purchasePayments.paidAt));
    return rows.map(toPayment);
  },

  async getBalance(purchaseOrderId: number) {
    return computeBalance(db, purchaseOrderId);
  },

  async create(purchaseOrderId: number, data: PurchasePaymentInput) {
    return db.transaction(async (tx) => {
      const order = await tx.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.id, purchaseOrderId) });
      if (!order) throw new Error("Pedido no encontrado");
      if (order.purchaseType !== "credito") throw new Error("Este pedido no es a crédito");
      if (order.status === "cancelado") throw new Error("No se puede pagar un pedido cancelado");

      const balance = await computeBalance(tx, purchaseOrderId);
      if (data.amount > balance.pending) {
        throw new Error(`Saldo insuficiente: hay ${balance.pending} pendiente, se intentó pagar ${data.amount}`);
      }

      const [row] = await tx
        .insert(purchasePayments)
        .values({ purchaseOrderId, amount: data.amount, accountId: data.accountId, notes: data.notes ?? null })
        .returning();

      // Fixes a real gap found while designing the accounts model: paying a
      // distributor used to not touch cash_movements at all, so an
      // account's balance would silently omit money paid out here.
      await recordCashMovementTx(tx, {
        type: "gasto",
        amount: data.amount,
        concept: `Pago pedido de compra #${purchaseOrderId}`,
        sourceType: "purchase_payment",
        sourceId: row.id,
        accountId: data.accountId,
      });

      return toPayment(row);
    });
  },

  async getAccountsPayableSummary() {
    const creditRows = await db
      .select({
        distributorId: purchaseOrders.distributorId,
        totalCost: sql<number>`COALESCE(SUM(${purchaseOrders.totalCost}), 0)`,
      })
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.purchaseType, "credito"), isNotNull(purchaseOrders.distributorId), ne(purchaseOrders.status, "cancelado")))
      .groupBy(purchaseOrders.distributorId);

    const paidRows = await db
      .select({
        distributorId: purchaseOrders.distributorId,
        totalPaid: sql<number>`COALESCE(SUM(${purchasePayments.amount}), 0)`,
      })
      .from(purchasePayments)
      .innerJoin(purchaseOrders, eq(purchasePayments.purchaseOrderId, purchaseOrders.id))
      .where(and(isNotNull(purchaseOrders.distributorId), ne(purchaseOrders.status, "cancelado")))
      .groupBy(purchaseOrders.distributorId);

    const paidByDistributor = new Map(paidRows.map((r) => [r.distributorId, r.totalPaid]));

    const result: AccountsPayableLine[] = [];
    for (const row of creditRows) {
      if (row.distributorId === null) continue;
      const pending = row.totalCost - (paidByDistributor.get(row.distributorId) ?? 0);
      if (pending > 0) result.push({ distributorId: row.distributorId, pending });
    }
    return result;
  },
};
