import migrations from "@drizzle/migrations";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { db } from "./db";

export function useDatabaseMigrations() {
  return useMigrations(db, migrations);
}
