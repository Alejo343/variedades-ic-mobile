import { drizzle } from "drizzle-orm/expo-sqlite";
import * as SQLite from "expo-sqlite";
import * as schema from "./schema";

export const sqliteDb = SQLite.openDatabaseSync("variedades-ic.db");
export const db = drizzle(sqliteDb, { schema });

// Shared type for the transaction callback param, so other local/* repos can
// accept "db or the current tx" without redefining Drizzle's generics.
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
