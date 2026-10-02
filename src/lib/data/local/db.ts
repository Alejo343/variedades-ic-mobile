import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/expo-sqlite";
import * as SQLite from "expo-sqlite";
import * as schema from "./schema";

const DB_NAME = "variedades-ic.db";

export let sqliteDb = SQLite.openDatabaseSync(DB_NAME);
export let db = drizzle(sqliteDb, { schema });

// Shared type for the transaction callback param, so other local/* repos can
// accept "db or the current tx" without redefining Drizzle's generics.
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// `db`/`sqliteDb` are live bindings (Babel rewrites every assignment to also
// update the module's exports), so reassigning them here is enough for every
// repo that already did `import { db } from './db'` to see the new
// connection — no need to touch any of them.
//
// What they CAN'T fix on their own is drizzle's `useMigrations()` hook
// (drizzle-orm/expo-sqlite/migrator): its effect has an empty dependency
// array, so it only ever migrates once per component mount, even if `db`
// changes under it. `generation` exists so app/_layout.tsx can force a full
// remount (via `key={generation}`) whenever the *connection itself* is
// replaced (backup import, which swaps the on-disk file) — clearing data
// with wipeAllTables below doesn't touch the connection, so it doesn't need
// this at all.
let generation = 0;
const listeners = new Set<() => void>();

export const dbStore = {
  getSnapshot(): number {
    return generation;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

// Closes the live connection without touching the on-disk file — for a
// caller that's about to replace the file itself (backup import).
export async function closeDb(): Promise<void> {
  await sqliteDb.closeAsync();
}

// Opens a new connection to whatever is on disk right now under DB_NAME and
// triggers the remount described above. Caller must have already closed the
// previous connection (closeDb) if the file was replaced while it was open.
export async function reopenDb(): Promise<void> {
  sqliteDb = SQLite.openDatabaseSync(DB_NAME);
  db = drizzle(sqliteDb, { schema });
  generation += 1;
  listeners.forEach((listener) => listener());
}

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
// celular borra su base local"). Unlike reopenDb, this never touches the
// file or the connection: the schema isn't changing, only the data, so
// there's nothing for app/_layout.tsx to remount and no risk of querying a
// stale connection.
export async function wipeAllTables(): Promise<void> {
  await db.transaction(async (tx) => {
    for (const table of dataTables) {
      await tx.delete(table);
    }
    await tx.run(sql`DELETE FROM sqlite_sequence`);
  });
}
