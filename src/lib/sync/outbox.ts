import { asc, count } from 'drizzle-orm';
import { db, type Tx } from '@/lib/data/local/db';
import { syncOutbox } from '@/lib/data/local/schema';
import type { SyncOperationType } from './operation-types';

// The queue every write repo feeds (sub-paso 10, see CLAUDE.md "Fase 10").
// `enqueueOperation` is called from inside the SAME Drizzle transaction as
// the local insert/update it describes — either always succeeds together, or
// (if the transaction rolls back) neither does. `payload` is whatever shape
// the matching web handler expects (documented per operation in CLAUDE.md,
// "Sub-paso 7" notes); this module doesn't validate it — that's the job of
// each repo that builds it, mirroring the server's zod schema by hand.

export type OutboxRow = { id: number; opId: string; type: SyncOperationType; payload: unknown; createdAt: string };

export async function enqueueOperation(dbOrTx: typeof db | Tx, type: SyncOperationType, payload: unknown): Promise<void> {
  await dbOrTx.insert(syncOutbox).values({ type, payload: JSON.stringify(payload) });
}

function toRow(row: typeof syncOutbox.$inferSelect): OutboxRow {
  return { id: row.id, opId: row.opId, type: row.type as SyncOperationType, payload: JSON.parse(row.payload), createdAt: row.createdAt };
}

// Oldest first — sub-paso 11 pushes in the order operations actually happened.
export async function listOutbox(): Promise<OutboxRow[]> {
  const rows = await db.select().from(syncOutbox).orderBy(asc(syncOutbox.id));
  return rows.map(toRow);
}

export async function getOutboxCount(): Promise<number> {
  const [row] = await db.select({ n: count() }).from(syncOutbox);
  return row?.n ?? 0;
}

// The uuids with an operation of `type` still queued (sub-paso 13): what a
// product/etc list uses to show "(pendiente de sincronizar)" — a number the
// server hasn't confirmed yet (the SKU it assigns, a photo it hasn't seen)
// might still change once this operation actually goes through.
export async function pendingUuidsForType(type: SyncOperationType): Promise<Set<string>> {
  const rows = await listOutbox();
  const uuids = rows
    .filter((row) => row.type === type)
    .map((row) => (row.payload as { uuid?: unknown }).uuid)
    .filter((uuid): uuid is string => typeof uuid === 'string');
  return new Set(uuids);
}
