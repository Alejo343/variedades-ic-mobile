import { describe, expect, it } from "vitest";
import { applyMovement, validateAdjustmentReason } from "./inventory-movement";

describe("applyMovement", () => {
  it("suma el saldo cuando el delta es positivo", () => {
    const result = applyMovement(10, 5);
    expect(result).toEqual({ ok: true, newBalance: 15 });
  });

  it("resta el saldo cuando el delta es negativo", () => {
    const result = applyMovement(10, -4);
    expect(result).toEqual({ ok: true, newBalance: 6 });
  });

  it("permite descontar exactamente todo el saldo (límite exacto)", () => {
    const result = applyMovement(5, -5);
    expect(result).toEqual({ ok: true, newBalance: 0 });
  });

  it("rechaza un delta negativo que dejaría el saldo por debajo de cero", () => {
    const result = applyMovement(3, -4);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("Stock insuficiente");
    }
  });

  it("rechaza un delta de cero", () => {
    const result = applyMovement(10, 0);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("cero");
    }
  });
});

describe("validateAdjustmentReason", () => {
  it("exige motivo cuando el tipo es ajuste", () => {
    expect(validateAdjustmentReason("ajuste", null)).toBe(false);
    expect(validateAdjustmentReason("ajuste", "")).toBe(false);
    expect(validateAdjustmentReason("ajuste", "   ")).toBe(false);
  });

  it("acepta un ajuste con motivo no vacío", () => {
    expect(validateAdjustmentReason("ajuste", "Conteo físico mensual")).toBe(true);
  });

  it("no exige motivo para otros tipos de movimiento", () => {
    expect(validateAdjustmentReason("compra", null)).toBe(true);
    expect(validateAdjustmentReason("venta", undefined)).toBe(true);
  });
});
