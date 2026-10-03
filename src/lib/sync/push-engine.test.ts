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

const { pushPendingOperations, retryRejection } = await import("./push-engine");

describe("pushPendingOperations", () => {

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

// retryRejection (bug real encontrado en vivo, sesión 2026-10-03): un
// rechazo que ya consumió su opId original no se reenvía solo — esto lo
// reencola bajo uno nuevo, arreglando el formato de fecha si esa fue la
// causa (new Date().toISOString() en vez del formato de SQLite).
describe("retryRejection", () => {
  it("reencola corrigiendo una fecha con formato ISO y quita el rechazo", async () => {
    const rejectedPayload = { uuid: "stl-1", accountUuid: "acc-1", settledAt: "2026-10-03T16:30:00.000Z" };
    raw.exec(
      `INSERT INTO sync_rejections (op_id, type, payload, error) VALUES ('old-op', 'markSettlementSettled', '${JSON.stringify(rejectedPayload)}', 'Fecha con formato inválido')`,
    );
    const [rejection] = raw.prepare("SELECT id FROM sync_rejections").all() as { id: number }[];

    await retryRejection(rejection.id);

    expect(raw.prepare("SELECT * FROM sync_rejections").all()).toEqual([]);
    const [queued] = raw.prepare("SELECT op_id, type, payload FROM sync_outbox").all() as { op_id: string; type: string; payload: string }[];
    expect(queued.type).toBe("markSettlementSettled");
    expect(queued.op_id).not.toBe("old-op");
    const payload = JSON.parse(queued.payload);
    expect(payload).toMatchObject({ uuid: "stl-1", accountUuid: "acc-1", settledAt: "2026-10-03 16:30:00" });
  });

  it("no toca un campo que no tiene la forma ISO con milisegundos y Z", async () => {
    const rejectedPayload = { uuid: "x", periodDate: "2026-10-03", reason: "Producto no existe en el servidor" };
    raw.exec(
      `INSERT INTO sync_rejections (op_id, type, payload, error) VALUES ('old-op-2', 'createSettlement', '${JSON.stringify(rejectedPayload)}', 'algo distinto')`,
    );
    const [rejection] = raw.prepare("SELECT id FROM sync_rejections").all() as { id: number }[];

    await retryRejection(rejection.id);

    const [queued] = raw.prepare("SELECT payload FROM sync_outbox").all() as { payload: string }[];
    expect(JSON.parse(queued.payload)).toEqual(rejectedPayload);
  });
});
