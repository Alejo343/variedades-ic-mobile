import { describe, expect, it, vi } from "vitest";

// runSync (sub-paso 11) orchestrates one sync round: push first, then pull —
// never the other way, so the pull sees a server that already has whatever
// this device just sent. No session, no network calls at all.

let sessionState: { status: "authenticated"; session: { token: string } } | { status: "unauthenticated" } = { status: "unauthenticated" };
const calls: string[] = [];

vi.mock("./session", () => ({ sessionStore: { getSnapshot: () => sessionState } }));
vi.mock("./cursor", () => ({ setLastSyncAt: () => calls.push("setLastSyncAt") }));
vi.mock("./pending", () => ({ refreshPendingCount: async () => calls.push("refreshPendingCount") }));
vi.mock("./push-engine", () => ({
  pushPendingOperations: async () => { calls.push("push"); return { applied: 2, rejected: 1, pendingAfter: 0 }; },
}));
vi.mock("./pull-engine", () => ({
  pullServerChanges: async () => { calls.push("pull"); return { pages: 3 }; },
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

  it("con sesión: push antes que pull, y guarda la hora de la última sincronización", async () => {
    sessionState = { status: "authenticated", session: { token: "tok" } };
    calls.length = 0;
    const result = await runSync();
    expect(result).toEqual({ status: "ok", pushed: 2, rejected: 1, pulledPages: 3 });
    expect(calls).toEqual(["push", "pull", "setLastSyncAt", "refreshPendingCount"]);
  });

  it("dos llamadas a la vez comparten la misma corrida en vez de pisarse", async () => {
    sessionState = { status: "authenticated", session: { token: "tok" } };
    calls.length = 0;
    const [a, b] = await Promise.all([runSync(), runSync()]);
    expect(a).toEqual(b);
    expect(calls.filter((c) => c === "push")).toHaveLength(1);
  });
});
