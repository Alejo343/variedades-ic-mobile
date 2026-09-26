import { describe, expect, it, vi } from "vitest";
import { createMigratedTestDb } from "../data/local/test-db";

// pendingStore (sub-paso 12) shows "N pendientes" without polling: it's a
// plain in-memory count, refreshed on demand (refreshPendingCount) from
// sync_outbox and pushed to subscribers — same subscribe/getSnapshot shape
// as theme-preference.ts, for useSyncExternalStore.

const { raw, db: proxy } = createMigratedTestDb();
vi.mock("../data/local/db", () => ({ get db() { return proxy; } }));

describe("pendingStore", async () => {
  const { pendingStore, refreshPendingCount } = await import("./pending");

  it("arranca en 0 y refleja lo que haya en sync_outbox al refrescar", async () => {
    expect(pendingStore.getSnapshot()).toBe(0);
    raw.exec(`INSERT INTO sync_outbox (op_id, type, payload) VALUES ('op-1', 'upsertCategory', '{}'), ('op-2', 'upsertCategory', '{}')`);
    await refreshPendingCount();
    expect(pendingStore.getSnapshot()).toBe(2);
  });

  it("notifica a quien esté suscrito", async () => {
    const listener = vi.fn();
    const unsubscribe = pendingStore.subscribe(listener);
    raw.exec(`DELETE FROM sync_outbox`);
    await refreshPendingCount();
    expect(listener).toHaveBeenCalled();
    expect(pendingStore.getSnapshot()).toBe(0);
    unsubscribe();
  });
});
