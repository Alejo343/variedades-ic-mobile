import * as SQLite from 'expo-sqlite';
import { sqliteDb } from '@/lib/data/local/db';

const DB_NAME = 'variedades-ic.db';

// Discards all local data on this device's very first sync login (see
// session.ts#shouldWipeOnLogin — CLAUDE.md, "Fase 10": "El primer login en
// un celular borra su base local"). Same close-then-delete pattern already
// used by more/backup.tsx's import flow, for the same reason: the
// module-level `sqliteDb` connection in lib/data/local/db.ts can't be
// reopened in place once its file is gone, so the app has to restart before
// it can touch the (now empty, freshly migrated on next launch) database
// again.
export async function wipeLocalDatabase(): Promise<void> {
  await sqliteDb.closeAsync();
  await SQLite.deleteDatabaseAsync(DB_NAME);
}
