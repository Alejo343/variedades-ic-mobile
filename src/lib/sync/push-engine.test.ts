import { afterEach, describe, expect, it, vi } from "vitest";
import { createMigratedTestDb } from "../data/local/test-db";

// pushPendingOperations (sub-paso 11) drains sync_outbox against the server.
// Contract: applied/rejected resolve an operation (removed from the outbox);
// a rejection is also logged to sync_rejections so the owner can see it;
// error/skipped stop the batch there, leaving that operation and everything
// after it queued for the next sync.

const { raw, db: proxy } = createMigratedTestDb();
vi.mock("../data/local/db", () => ({ get db() { return proxy; } }));

const seedOutbox = (opId: string, type: string, payload: unknown) =>
  raw.exec(`INSERT INTO sync_outbox (op_id, type, payload) VALUES ('${opId}', '${type}', '${JSON.stringify(payload)}')`);
const outboxOpIds = () => (raw.prepare("SELECT op_id FROM sync_outbox ORDER BY id").all() as { op_id: string }[]).map((r) => r.op_id);
const rejections = () => raw.prepare("SELECT op_id, type, error FROM sync_rejections ORDER BY id").all();

afterEach(() => {
  raw.exec("DELETE FROM sync_outbox; DELETE FROM sync_rejections;");
  vi.unstubAllGlobals();
});

describe("pushPendingOperations", async () => {
  const { pushPendingOperations } = await import("./push-engine");

  it("aplicada y rechazada se resuelven; rechazada queda visible con el mensaje del servidor", async () => {
    seedOutbox("op-1", "upsertCategory", { uuid: "op-1", name: "X" });
    seedOutbox("op-2", "createDirectSale", { uuid: "op-2" });

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      results: [
        { id: "op-1", status: "applied" },
        { id: "op-2", status: "rejected", error: "Producto no existe en el servidor" },
      ],
    }), { status: 200 })));

    const summary = await pushPendingOperations("tok");
    expect(summary).toMatchObject({ applied: 1, rejected: 1, pendingAfter: 0 });
    expect(outboxOpIds()).toEqual([]);
    expect(rejections()).toEqual([{ op_id: "op-2", type: "createDirectSale", error: "Producto no existe en el servidor" }]);
  });

  it("un error del servidor detiene el lote: nada después de él se resuelve", async () => {
    seedOutbox("op-3", "upsertCategory", { uuid: "op-3" });
    seedOutbox("op-4", "createDirectSale", { uuid: "op-4" });
    seedOutbox("op-5", "createDirectSale", { uuid: "op-5" });

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      results: [
        { id: "op-3", status: "applied" },
        { id: "op-4", status: "error", error: "Error inesperado del servidor; se reintentará" },
        { id: "op-5", status: "skipped" },
      ],
    }), { status: 200 })));

    const summary = await pushPendingOperations("tok");
    expect(summary).toMatchObject({ applied: 1, rejected: 0, pendingAfter: 2 });
    expect(outboxOpIds()).toEqual(["op-4", "op-5"]);
  });

  it("sin conexión: no revienta, deja todo pendiente y reporta el error", async () => {
    seedOutbox("op-6", "upsertCategory", { uuid: "op-6" });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));

    const summary = await pushPendingOperations("tok");
    expect(summary.error).toBeTruthy();
    expect(summary.pendingAfter).toBe(1);
    expect(outboxOpIds()).toEqual(["op-6"]);
  });

  it("reenviar la misma operación (duplicate) también la resuelve", async () => {
    seedOutbox("op-7", "upsertCategory", { uuid: "op-7" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      results: [{ id: "op-7", status: "applied", duplicate: true }],
    }), { status: 200 })));

    const summary = await pushPendingOperations("tok");
    expect(summary.applied).toBe(1);
    expect(outboxOpIds()).toEqual([]);
  });
});
