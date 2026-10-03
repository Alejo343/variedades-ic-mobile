import { describe, expect, it, vi } from "vitest";

// session.ts pulls in expo-secure-store, expo-sqlite/kv-store and (via
// reset-local-db) expo-sqlite/db.ts — none of them load under plain Node.
// Only the pure exported function is under test here, so the native-backed
// pieces are stubbed out (same pattern as local/products-repo.test.ts).
vi.mock("expo-secure-store", () => ({ getItem: () => null, setItem: () => {}, deleteItemAsync: async () => {} }));
vi.mock("expo-sqlite/kv-store", () => ({ Storage: { getItemSync: () => null, setItemSync: () => {} } }));
vi.mock("./reset-local-db", () => ({ wipeLocalDatabase: async () => {} }));
const resetCursor = vi.fn();
vi.mock("./cursor", () => ({ resetCursor }));
vi.mock("./api", () => ({ loginRequest: vi.fn(), logoutRequest: vi.fn() }));

const { shouldWipeOnLogin, sessionStore } = await import("./session");

// The device wipes its local data exactly once — on its very first
// successful login ever (CLAUDE.md, "Fase 10": "El primer login en un
// celular borra su base local"). Logging back in later (e.g. after a manual
// logout, already-synced data on the device) must not wipe anything again.
describe("shouldWipeOnLogin", () => {
  it("borra en el primer login del dispositivo", () => {
    expect(shouldWipeOnLogin(false)).toBe(true);
  });

  it("no borra en logins siguientes", () => {
    expect(shouldWipeOnLogin(true)).toBe(false);
  });
});

// Bug real (sesión 2026-10-03): el wipe del primer login borraba las
// tablas pero dejaba el cursor de sync intacto en kv-store, así que el
// siguiente pull arrancaba desde donde un sync anterior (aunque fuera
// parcial) se había quedado, saltándose filas de versión menor.
describe("login resetea el cursor cuando borra (primer login)", () => {
  it("llama a resetCursor en el primer login", async () => {
    const { loginRequest } = await import("./api");
    vi.mocked(loginRequest).mockResolvedValue({
      ok: true,
      data: { token: "tok", user: { username: "u", name: "U", role: "owner" }, seller: null },
    });
    resetCursor.mockClear();

    const result = await sessionStore.login("u", "p");

    expect(result.ok).toBe(true);
    expect(resetCursor).toHaveBeenCalledTimes(1);
  });
});
