import { describe, expect, it, vi } from "vitest";

// In-memory stand-in for expo-sqlite/kv-store — same pattern as
// local/products-repo.test.ts's mock of ./db.
const store = new Map<string, string>();
vi.mock("expo-sqlite/kv-store", () => ({
  Storage: {
    getItemSync: (key: string) => store.get(key) ?? null,
    setItemSync: (key: string, value: string) => store.set(key, value),
  },
}));

const { getCursor, setCursor, resetCursor } = await import("./cursor");

// resetCursor (bug real encontrado en vivo, sesión 2026-10-03): cualquier
// flujo que reemplaza los datos locales por completo (wipe del primer
// login, importar un respaldo) debe poder llevar el cursor de vuelta a 0,
// o el siguiente pull arranca desde donde se había quedado un dispositivo
// que ya había sincronizado antes — saltándose todo lo de versión menor.
describe("resetCursor", () => {
  it("vuelve el cursor a 0 sin importar en qué quedó", () => {
    setCursor(48);
    expect(getCursor()).toBe(48);
    resetCursor();
    expect(getCursor()).toBe(0);
  });
});
