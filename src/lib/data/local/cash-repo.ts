import { desc, eq, sql } from "drizzle-orm";
import { enqueueOperation } from "../../sync/outbox";
import type { CashMovementInput } from "../../validations";
import type { CashMovement, CashRepo } from "../cash-repo";
import type { Tx } from "./db";
import { db } from "./db";
import { cashAccounts, cashMovements } from "./schema";

function toCashMovement(row: typeof cashMovements.$inferSelect): CashMovement {
  return {
    id: row.id,
    type: row.type as CashMovement["type"],
    amount: row.amount,
    concept: row.concept,
    movementDate: row.movementDate,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    accountId: row.accountId,
    notes: row.notes,
    createdAt: row.createdAt,
  };
}

// Reused by other local/* repos (e.g. direct-sales-repo, purchase-payments-repo)
// that need to record an automatic cash entry inside their own transaction —
// same role as recordCashMovement in the web repo's lib/db/queries/cash.ts.
// Returns the row's own uuid too — internal callers need it for their outbox
// payload (e.g. createDirectSale's cashMovementUuid); it isn't part of the
// public CashMovement type the rest of the app reads.
export async function recordCashMovementTx(
  tx: Tx,
  input: {
    type: "ingreso" | "gasto";
    amount: number;
    concept: string;
    accountId: number;
    sourceType?: string | null;
    sourceId?: number | null;
    notes?: string | null;
  },
): Promise<CashMovement & { uuid: string }> {
  const [row] = await tx
    .insert(cashMovements)
    .values({
      type: input.type,
      amount: input.amount,
      concept: input.concept,
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId ?? null,
      accountId: input.accountId,
      notes: input.notes ?? null,
    })
    .returning();
  return { ...toCashMovement(row), uuid: row.uuid };
}

export const localCashRepo: CashRepo = {
  async list() {
    const rows = await db.select().from(cashMovements).orderBy(desc(cashMovements.movementDate));
    return rows.map(toCashMovement);
  },

  async getBalance() {
    const [row] = await db
      .select({
        balance: sql<number>`COALESCE(SUM(CASE WHEN ${cashMovements.type} = 'ingreso' THEN ${cashMovements.amount} ELSE -${cashMovements.amount} END), 0)`,
      })
      .from(cashMovements);
    return row?.balance ?? 0;
  },

  async recordMovement(input: CashMovementInput) {
    return db.transaction(async (tx) => {
      const movement = await recordCashMovementTx(tx, {
        type: input.type,
        amount: input.amount,
        concept: input.concept,
        sourceType: "manual",
        accountId: input.accountId,
        notes: input.notes,
      });
      const account = await tx.query.cashAccounts.findFirst({ where: eq(cashAccounts.id, input.accountId), columns: { uuid: true } });
      if (!account) throw new Error("Cuenta no encontrada");
      await enqueueOperation(tx, "createCashMovement", {
        uuid: movement.uuid,
        type: movement.type,
        amount: movement.amount,
        concept: movement.concept,
        movementDate: movement.movementDate,
        accountUuid: account.uuid,
        notes: movement.notes,
      });
      const { uuid: _uuid, ...cashMovement } = movement;
      return cashMovement;
    });
  },
};
