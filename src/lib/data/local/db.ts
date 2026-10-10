import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/expo-sqlite";
import * as SQLite from "expo-sqlite";
import * as schema from "./schema";

const DB_NAME = "variedades-ic.db";

export const sqliteDb = SQLite.openDatabaseSync(DB_NAME);
export const db = drizzle(sqliteDb, { schema });

// Shared type for the transaction callback param, so other local/* repos can
// accept "db or the current tx" without redefining Drizzle's generics.
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Every table that holds actual business data, children before parents —
// order doesn't matter to SQLite today (no table here runs with PRAGMA
// foreign_keys on, see schema.ts's note on productImages' cascade), but
// keeps this correct if that ever changes.
const dataTables = [
  schema.sellerSaleItems,
  schema.sellerSales,
  schema.settlements,
  schema.sellerLossItems,
  schema.sellerLosses,
  schema.sellerReturnItems,
  schema.sellerReturns,
  schema.sellerDeliveryItems,
  schema.sellerDeliveries,
  schema.purchasePayments,
  schema.purchaseOrderItems,
  schema.purchaseOrders,
  schema.distributors,
  schema.directSaleItems,
  schema.directSales,
  schema.cashMovements,
  schema.inventoryMovements,
  schema.sellers,
  schema.cashAccounts,
  schema.productImages,
  schema.products,
  schema.categories,
  schema.syncRejections,
  schema.syncOutbox,
];

// Deletes every row from every table on the LIVE connection and resets the
// autoincrement counters so new ids start fresh at 1 — used by the sync
// login's first-time wipe (CLAUDE.md, "Fase 10": "El primer login en un
// celular borra su base local"). It never touches the file or the
// connection: the schema isn't changing, only the data, so the app keeps the
// one connection it opened at startup.
export async function wipeAllTables(): Promise<void> {
  await db.transaction(async (tx) => {
    for (const table of dataTables) {
      await tx.delete(table);
    }
    await tx.run(sql`DELETE FROM sqlite_sequence`);
  });
}
