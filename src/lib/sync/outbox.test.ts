import { describe, expect, it, vi } from "vitest";
import { createMigratedTestDb } from "../data/local/test-db";

// enqueueOperation (sub-paso 10) writes the operation the server needs to
// apply, in the same transaction as the local change it describes. Contract:
// one row per call, a fresh opId (uuid), the payload round-trips through
// JSON exactly, and it can be called both with `db` and inside an existing
// transaction (so repos can enqueue alongside their own insert).

const { db: proxy } = createMigratedTestDb();
vi.mock("../data/local/db", () => ({ get db() { return proxy; } }));

// The test harness's db (sqlite-proxy driver) is a different Drizzle
// instantiation than the real expo-sqlite one enqueueOperation is typed
// against (same reason products-repo.test.ts etc. never call a Tx-typed
// export directly) — cast away the mismatch here since only runtime
// behavior is under test, not driver-level type compatibility.
type AnyDb = Parameters<typeof import("./outbox").enqueueOperation>[0];
const testDb = proxy as unknown as AnyDb;

describe("enqueueOperation", async () => {
  const { enqueueOperation, listOutbox, getOutboxCount, pendingUuidsForType } = await import("./outbox");
  const { onLocalWrite } = await import("./local-writes");

  it("avisa de la escritura local (para que la sync automática la suba enseguida)", async () => {
    let heard = 0;
    const unsubscribe = onLocalWrite(() => heard++);
    await enqueueOperation(testDb, "upsertCategory", { uuid: "notify" });
    unsubscribe();
    await enqueueOperation(testDb, "upsertCategory", { uuid: "notify-2" });
    expect(heard).toBe(1);
  });

  it("agrega una fila con opId propio y el payload intacto", async () => {
    const payload = { uuid: "abc", name: "ZZ", items: [{ uuid: "x", quantity: 2 }] };
    await enqueueOperation(testDb, "upsertCategory", payload);

    const rows = (await listOutbox()).filter((r) => r.type === "upsertCategory" && (r.payload as { uuid: string }).uuid === "abc");
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe("upsertCategory");
    expect(rows[0].payload).toEqual(payload);
    expect(rows[0].opId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("cada llamada genera un opId distinto y el conteo crece", async () => {
    await enqueueOperation(testDb, "createCashMovement", { uuid: "op2" });
    const rows = await listOutbox();
    expect(new Set(rows.map((r) => r.opId)).size).toBe(rows.length);
    expect(await getOutboxCount()).toBe(rows.length);
  });

  it("funciona dentro de una transacción existente", async () => {
    const before = await getOutboxCount();
    await proxy.transaction(async (tx) => {
      await enqueueOperation(tx as unknown as AnyDb, "createDirectSale", { uuid: "op3" });
    });
    expect(await getOutboxCount()).toBe(before + 1);
  });

  it("pendingUuidsForType solo trae los uuid del tipo pedido (sub-paso 13)", async () => {
    await enqueueOperation(testDb, "upsertProduct", { uuid: "prod-a" });
    await enqueueOperation(testDb, "upsertProduct", { uuid: "prod-b" });
    await enqueueOperation(testDb, "upsertCategory", { uuid: "cat-x" }); // otro tipo, no debe salir
    const pending = await pendingUuidsForType("upsertProduct");
    expect(pending.has("prod-a")).toBe(true);
    expect(pending.has("prod-b")).toBe(true);
    expect(pending.has("cat-x")).toBe(false);
  });
});
