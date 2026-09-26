import { describe, expect, it, vi } from "vitest";

// session.ts pulls in expo-secure-store, expo-sqlite/kv-store and (via
// reset-local-db) expo-sqlite/db.ts — none of them load under plain Node.
// Only the pure exported function is under test here, so the native-backed
// pieces are stubbed out (same pattern as local/products-repo.test.ts).
vi.mock("expo-secure-store", () => ({ getItem: () => null, setItem: () => {}, deleteItemAsync: async () => {} }));
vi.mock("expo-sqlite/kv-store", () => ({ Storage: { getItemSync: () => null, setItemSync: () => {} } }));
vi.mock("./reset-local-db", () => ({ wipeLocalDatabase: async () => {} }));

const { shouldWipeOnLogin } = await import("./session");

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
