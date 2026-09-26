import { db } from '@/lib/data/local/db';
import { pullRequest } from './api';
import { getCursor, setCursor } from './cursor';
import { applyPullPage } from './pull-apply';

export type PullSummary = { pages: number; error?: string };

// Repeats GET /api/sync/pull from the saved cursor while hasMore is true
// (sub-paso 11). Each page is applied in its own transaction and the cursor
// is only advanced after that transaction commits — if the app is killed
// mid-sync, the next attempt just re-requests the same page instead of
// silently skipping data.
export async function pullServerChanges(token: string): Promise<PullSummary> {
  let pages = 0;
  for (;;) {
    const since = getCursor();
    const response = await pullRequest(token, since);
    if (!response.ok) return { pages, error: response.error };

    const page = response.data;
    await db.transaction((tx) => applyPullPage(tx, page));
    setCursor(page.cursor);
    pages++;

    if (!page.hasMore) return { pages };
  }
}
