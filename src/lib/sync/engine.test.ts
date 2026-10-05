import { describe, expect, it, vi } from "vitest";

// runSync orchestrates one sync round: photos, then push, then pull — never
// in another order, so the pull sees a server that already has whatever
// this device just sent, and a product's images travel already uploaded.
// No session, no network calls at all.

let sessionState: { status: "authenticated"; session: { token: string } } | { status: "unauthenticated" } = { status: "unauthenticated" };
let photoError: string | undefined;
let pushResult = { applied: 2, rejected: 1, pendingAfter: 0 };
let pullResult: { pages: number; changed: number; error?: string } = { pages: 3, changed: 5 };
const calls: string[] = [];

vi.mock("./session", () => ({ sessionStore: { getSnapshot: () => sessionState } }));
vi.mock("./cursor", () => ({ setLastSyncAt: () => calls.push("setLastSyncAt") }));
vi.mock("./data-version", () => ({ bumpDataVersion: () => calls.push("bumpDataVersion") }));
vi.mock("./pending", () => ({ refreshPendingCount: async () => calls.push("refreshPendingCount") }));
vi.mock("./photo-upload", () => ({
  uploadPendingProductPhotos: async () => { calls.push("photos"); return { uploaded: 0, productsSynced: 0, ...(photoError ? { error: photoError } : {}) }; },
}));
vi.mock("./push-engine", () => ({
  pushPendingOperations: async () => { calls.push("push"); return pushResult; },
}));
vi.mock("./pull-engine", () => ({
  pullServerChanges: async () => { calls.push("pull"); return pullResult; },
}));

describe("runSync", async () => {
  const { runSync } = await import("./engine");

  it("sin sesión no llama a la red", async () => {
    sessionState = { status: "unauthenticated" };
    calls.length = 0;
    const result = await runSync();
    expect(result).toEqual({ status: "skipped-no-session" });
    expect(calls).toEqual([]);
  });

  it("con sesión: fotos, luego push, luego pull, y guarda la hora de la última sincronización", async () => {
    sessionState = { status: "authenticated", session: { token: "tok" } };
    photoError = undefined;
    calls.length = 0;
    const result = await runSync();
    expect(result).toEqual({ status: "ok", pushed: 2, rejected: 1, pulledPages: 3 });
    expect(calls).toEqual(["photos", "push", "pull", "setLastSyncAt", "refreshPendingCount", "bumpDataVersion"]);
  });

  it("una foto que falla no detiene el resto: push y pull igual corren, y el error queda visible", async () => {
    sessionState = { status: "authenticated", session: { token: "tok" } };
    photoError = "No se pudo subir la foto";
    calls.length = 0;
    const result = await runSync();
    expect(result).toEqual({ status: "ok", pushed: 2, rejected: 1, pulledPages: 3, photoUploadError: "No se pudo subir la foto" });
    expect(calls).toEqual(["photos", "push", "pull", "setLastSyncAt", "refreshPendingCount", "bumpDataVersion"]);
  });

  it("sin cambios en el push ni en el pull, no hace recargar las pantallas", async () => {
    sessionState = { status: "authenticated", session: { token: "tok" } };
    photoError = undefined;
    pushResult = { applied: 0, rejected: 0, pendingAfter: 0 };
    pullResult = { pages: 1, changed: 0 };
    calls.length = 0;
    await runSync();
    expect(calls).not.toContain("bumpDataVersion");
  });

  it("solo el pull trajo cambios: recarga las pantallas", async () => {
    sessionState = { status: "authenticated", session: { token: "tok" } };
    pushResult = { applied: 0, rejected: 0, pendingAfter: 0 };
    pullResult = { pages: 1, changed: 4 };
    calls.length = 0;
    await runSync();
    expect(calls).toContain("bumpDataVersion");
  });

  it("solo el push resolvió operaciones (cambian los '(pendiente)'): recarga las pantallas", async () => {
    sessionState = { status: "authenticated", session: { token: "tok" } };
    pushResult = { applied: 1, rejected: 0, pendingAfter: 0 };
    pullResult = { pages: 1, changed: 0 };
    calls.length = 0;
    await runSync();
    expect(calls).toContain("bumpDataVersion");
  });

  it("un pull que falla después de aplicar páginas igual recarga lo ya aplicado", async () => {
    sessionState = { status: "authenticated", session: { token: "tok" } };
    pushResult = { applied: 0, rejected: 0, pendingAfter: 0 };
    pullResult = { pages: 1, changed: 3, error: "Sin conexión" };
    calls.length = 0;
    const result = await runSync();
    expect(result.status).toBe("error");
    expect(calls).toContain("bumpDataVersion");
    pushResult = { applied: 2, rejected: 1, pendingAfter: 0 };
    pullResult = { pages: 3, changed: 5 };
  });

  it("dos llamadas a la vez comparten la misma corrida en vez de pisarse", async () => {
    sessionState = { status: "authenticated", session: { token: "tok" } };
    photoError = undefined;
    calls.length = 0;
    const [a, b] = await Promise.all([runSync(), runSync()]);
    expect(a).toEqual(b);
    expect(calls.filter((c) => c === "push")).toHaveLength(1);
  });
});
