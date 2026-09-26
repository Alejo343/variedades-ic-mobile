import { describe, expect, it } from "vitest";
import { shouldRunOnConnectivityChange, withinThrottle } from "./triggers";

// Pure decision logic for the automatic sync triggers (sub-paso 12). The
// actual AppState/NetInfo wiring lives in hooks/use-auto-sync.ts and isn't
// unit-tested (native glue, same criterion as the rest of the project).

describe("withinThrottle", () => {
  it("bloquea un intento demasiado seguido del anterior", () => {
    expect(withinThrottle(1000, 1000 + 10_000, 30_000)).toBe(true);
  });

  it("deja pasar uno fuera de la ventana, o si nunca hubo uno antes", () => {
    expect(withinThrottle(1000, 1000 + 30_001, 30_000)).toBe(false);
    expect(withinThrottle(null, 1000, 30_000)).toBe(false);
  });
});

describe("shouldRunOnConnectivityChange", () => {
  it("dispara solo en la transición de sin internet a con internet", () => {
    expect(shouldRunOnConnectivityChange(false, true)).toBe(true);
    expect(shouldRunOnConnectivityChange(null, true)).toBe(true);
  });

  it("no dispara si ya estaba conectado, sigue desconectado, o se acaba de desconectar", () => {
    expect(shouldRunOnConnectivityChange(true, true)).toBe(false);
    expect(shouldRunOnConnectivityChange(false, false)).toBe(false);
    expect(shouldRunOnConnectivityChange(true, false)).toBe(false);
    expect(shouldRunOnConnectivityChange(null, false)).toBe(false);
  });
});
