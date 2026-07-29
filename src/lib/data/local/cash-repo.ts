import { desc, sql } from "drizzle-orm";
import type { CashMovementInput } from "../../validations";
import type { CashMovement, CashRepo } from "../cash-repo";
import type { Tx } from "./db";
import { db } from "./db";
import { cashMovements } from "./schema";

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
): Promise<CashMovement> {
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
  return toCashMovement(row);
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
    return db.transaction((tx) =>
      recordCashMovementTx(tx, {
        type: input.type,
        amount: input.amount,
        concept: input.concept,
        sourceType: "manual",
        accountId: input.accountId,
        notes: input.notes,
      }),
    );
  },
};
