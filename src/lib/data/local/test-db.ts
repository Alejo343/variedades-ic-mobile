import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";

// Test-only harness: an in-memory SQLite (node:sqlite) with every drizzle/*.sql
// migration applied, exposed through Drizzle's sqlite-proxy driver so the real
// local/* repos can run under Node (expo-sqlite can't). `seedsBefore` maps a
// migration prefix ("0013") to SQL run right before it, to cover backfills.
//
// Mirrors the device exactly on two points that matter for table-rebuild
// migrations like 0016 (DROP TABLE of a parent + rename): foreign keys start
// off (expo-sqlite's Android build doesn't set SQLITE_DEFAULT_FOREIGN_KEYS),
// and each migration runs inside a transaction like Drizzle's migrator does,
// where SQLite ignores the PRAGMA foreign_keys=ON that drizzle-kit emits.
// Outside a transaction that PRAGMA takes effect, and the DROP TABLE
// cascades — e.g. deleting every product_images row.
export function createMigratedTestDb(seedsBefore: Record<string, string> = {}) {
  const raw = new DatabaseSync(":memory:", { enableForeignKeyConstraints: false });
  for (const f of fs.readdirSync("drizzle").filter((f) => f.endsWith(".sql")).sort()) {
    const seed = seedsBefore[f.slice(0, 4)];
    if (seed) raw.exec(seed);
    raw.exec("BEGIN");
    for (const stmt of fs.readFileSync(`drizzle/${f}`, "utf8").split("--> statement-breakpoint")) if (stmt.trim()) raw.exec(stmt);
    raw.exec("COMMIT");
  }
  const db = drizzle(async (sql, params, method) => {
    const stmt = raw.prepare(sql);
    if (method === "run") { stmt.run(...(params as never[])); return { rows: [] }; }
    stmt.setReturnArrays(true);
    const rows = stmt.all(...(params as never[])) as unknown as unknown[][];
    return { rows: method === "get" ? (rows[0] as never) : rows };
  }, { schema });
  return { raw, db };
}
