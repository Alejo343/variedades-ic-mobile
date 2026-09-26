import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/data/local/db';
import { syncOutbox, syncRejections } from '@/lib/data/local/schema';
import { pushRequest, type PushOperation } from './api';
import { listOutbox } from './outbox';

// Drains sync_outbox against POST /api/sync/push (sub-paso 11). Batches of
// 100 (the server's own cap on operations per request — see lib/sync/push.ts
// there). Per result:
// - applied/rejected: the operation is resolved, one way or the other —
//   removed from the outbox. A rejection additionally gets logged to
//   sync_rejections so the owner can see and act on it later (the plan's
//   "operaciones rechazadas visibles") — it's the server's own message, in
//   Spanish already, same as every other error surfaced in this app.
// - error/skipped: NOT resolved — left in the outbox for the next sync to
//   retry, and this device stops sending any batch after this one (later
//   operations may depend on ones that never got a real answer).

export type PushSummary = { applied: number; rejected: number; pendingAfter: number; error?: string };

const BATCH_SIZE = 100;

export async function pushPendingOperations(token: string): Promise<PushSummary> {
  const outbox = await listOutbox();
  let applied = 0;
  let rejected = 0;

  for (let i = 0; i < outbox.length; i += BATCH_SIZE) {
    const batch = outbox.slice(i, i + BATCH_SIZE);
    const operations: PushOperation[] = batch.map((row) => ({ id: row.opId, type: row.type, payload: row.payload }));

    const response = await pushRequest(token, operations);
    if (!response.ok) return { applied, rejected, pendingAfter: await pendingCount(), error: response.error };

    const resolvedOpIds: string[] = [];
    let stoppedEarly = false;
    for (const [index, result] of response.data.results.entries()) {
      if (result.status === 'applied') {
        applied++;
        resolvedOpIds.push(result.id);
      } else if (result.status === 'rejected') {
        rejected++;
        resolvedOpIds.push(result.id);
        const row = batch[index];
        await db.insert(syncRejections).values({ opId: result.id, type: row.type, payload: JSON.stringify(row.payload), error: result.error ?? 'Rechazado por el servidor' });
      } else {
        // 'error' or 'skipped': leave these (and everything after them,
        // which the server never even tried) in the outbox for next time.
        stoppedEarly = true;
        break;
      }
    }

    if (resolvedOpIds.length) await db.delete(syncOutbox).where(inArray(syncOutbox.opId, resolvedOpIds));
    if (stoppedEarly) break;
  }

  return { applied, rejected, pendingAfter: await pendingCount() };
}

async function pendingCount(): Promise<number> {
  const rows = await db.select({ opId: syncOutbox.opId }).from(syncOutbox);
  return rows.length;
}

export async function listRejections() {
  return db.select().from(syncRejections).orderBy(syncRejections.id);
}

export async function dismissRejection(id: number): Promise<void> {
  await db.delete(syncRejections).where(eq(syncRejections.id, id));
}
