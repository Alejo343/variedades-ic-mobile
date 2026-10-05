import { db } from '@/lib/data/local/db';
import { pullRequest, type PullResponse } from './api';
import { getCursor, setCursor } from './cursor';
import { applyPullPage } from './pull-apply';

// `changed`: rows + tombstones applied across all pages — what tells the
// engine whether any open screen needs to reload (data-version.ts). An empty
// periodic pull must not make every screen re-query for nothing.
export type PullSummary = { pages: number; changed: number; error?: string };

function countChanges(page: PullResponse): number {
  let n = page.tombstones.length;
  for (const rows of Object.values(page.changes)) n += rows.length;
  return n;
}

// Repeats GET /api/sync/pull from the saved cursor while hasMore is true
// (sub-paso 11). Each page is applied in its own transaction and the cursor
// is only advanced after that transaction commits — if the app is killed
// mid-sync, the next attempt just re-requests the same page instead of
// silently skipping data.
export async function pullServerChanges(token: string): Promise<PullSummary> {
  let pages = 0;
  let changed = 0;
  for (;;) {
    const since = getCursor();
    const response = await pullRequest(token, since);
    if (!response.ok) return { pages, changed, error: response.error };

    const page = response.data;
    await db.transaction((tx) => applyPullPage(tx, page));
    setCursor(page.cursor);
    pages++;
    changed += countChanges(page);

    if (!page.hasMore) return { pages, changed };
  }
}
