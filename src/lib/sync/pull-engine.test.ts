import { afterEach, describe, expect, it, vi } from "vitest";
import { createMigratedTestDb } from "../data/local/test-db";

// pullServerChanges (sub-paso 11) repeats GET /api/sync/pull from the saved
// cursor while hasMore is true, applying and persisting the cursor one page
// at a time — so killing the app mid-sync loses at most the current page,
// never silently skips one.

const { raw, db: proxy } = createMigratedTestDb();
vi.mock("../data/local/db", () => ({ get db() { return proxy; } }));

const kv = new Map<string, string>();
vi.mock("expo-sqlite/kv-store", () => ({
  Storage: { getItemSync: (k: string) => kv.get(k) ?? null, setItemSync: (k: string, v: string) => kv.set(k, v) },
}));

afterEach(() => {
  kv.clear();
  vi.unstubAllGlobals();
});

describe("pullServerChanges", async () => {
  const { pullServerChanges } = await import("./pull-engine");
  const { getCursor } = await import("./cursor");

  it("pide páginas mientras hasMore sea true y guarda el cursor de cada una", async () => {
    let call = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      call++;
      expect(url).toContain(`since=${call === 1 ? 0 : 10}`);
      const body =
        call === 1
          ? { cursor: 10, hasMore: true, changes: { categories: [{ uuid: "cat-a", name: "A", slug: "a", description: null, active: true }] }, tombstones: [] }
          : { cursor: 20, hasMore: false, changes: { categories: [{ uuid: "cat-b", name: "B", slug: "b", description: null, active: true }] }, tombstones: [] };
      return new Response(JSON.stringify(body), { status: 200 });
    }));

    const summary = await pullServerChanges("tok");
    expect(summary).toEqual({ pages: 2, changed: 2 });
    expect(getCursor()).toBe(20);
    expect(raw.prepare("SELECT count(*) AS n FROM categories WHERE uuid IN ('cat-a', 'cat-b')").get()).toEqual({ n: 2 });
  });

  it("un error de red deja el cursor donde estaba, para reintentar desde ahí", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    const before = getCursor();
    const summary = await pullServerChanges("tok");
    expect(summary.error).toBeTruthy();
    expect(getCursor()).toBe(before);
  });
});
