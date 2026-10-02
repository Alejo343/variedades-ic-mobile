import { wipeAllTables } from '@/lib/data/local/db';

// Discards all local data on this device's very first sync login (see
// session.ts#shouldWipeOnLogin — CLAUDE.md, "Fase 10": "El primer login en
// un celular borra su base local"). wipeAllTables just clears every table's
// rows on the already-open connection — it doesn't touch the file or the
// connection itself, so there's nothing to reopen and no app restart needed.
export async function wipeLocalDatabase(): Promise<void> {
  await wipeAllTables();
}
