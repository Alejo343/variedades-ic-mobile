import { eq, sql } from "drizzle-orm";
import type { CashAccountsRepo, CashAccount, CashAccountWithBalance, CreateCashAccountInput, UpdateCashAccountInput } from "../cash-accounts-repo";
import { db } from "./db";
import { cashAccounts, cashMovements } from "./schema";

function toCashAccount(row: typeof cashAccounts.$inferSelect): CashAccount {
  return {
    id: row.id,
    name: row.name,
    type: row.type as CashAccount["type"],
    active: row.active,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const localCashAccountsRepo: CashAccountsRepo = {
  async list() {
    const rows = await db.select().from(cashAccounts).orderBy(cashAccounts.name);
    return rows.map(toCashAccount);
  },

  async getById(id: number) {
    const row = await db.query.cashAccounts.findFirst({ where: eq(cashAccounts.id, id) });
    return row ? toCashAccount(row) : null;
  },

  async create(data: CreateCashAccountInput) {
    const [row] = await db
      .insert(cashAccounts)
      .values({ name: data.name, type: data.type, notes: data.notes ?? null, active: data.active ?? true })
      .returning();
    return toCashAccount(row);
  },

  async update(id: number, data: UpdateCashAccountInput) {
    const [row] = await db
      .update(cashAccounts)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(cashAccounts.id, id))
      .returning();
    if (!row) throw new Error("Cuenta no encontrada");
    return toCashAccount(row);
  },

  async deactivate(id: number) {
    await db
      .update(cashAccounts)
      .set({ active: false, updatedAt: new Date().toISOString() })
      .where(eq(cashAccounts.id, id));
  },

  async listWithBalances(): Promise<CashAccountWithBalance[]> {
    const accounts = await db.select().from(cashAccounts).orderBy(cashAccounts.name);
    const balanceRows = await db
      .select({
        accountId: cashMovements.accountId,
        balance: sql<number>`COALESCE(SUM(CASE WHEN ${cashMovements.type} = 'ingreso' THEN ${cashMovements.amount} ELSE -${cashMovements.amount} END), 0)`,
      })
      .from(cashMovements)
      .groupBy(cashMovements.accountId);

    const balanceByAccount = new Map(balanceRows.map((r) => [r.accountId, r.balance]));
    return accounts.map((row) => ({ ...toCashAccount(row), balance: balanceByAccount.get(row.id) ?? 0 }));
  },
};
