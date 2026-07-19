import { describe, expect, it } from "vitest";
import { deductStock, receiveStock } from "./stock";

describe("receiveStock", () => {
  it("suma la cantidad recibida al stock actual", () => {
    expect(receiveStock(10, 5)).toBe(15);
  });

  it("funciona partiendo de stock en cero", () => {
    expect(receiveStock(0, 3)).toBe(3);
  });
});

describe("deductStock", () => {
  it("descuenta la cantidad cuando hay stock suficiente", () => {
    const result = deductStock(10, 4);
    expect(result).toEqual({ ok: true, newStock: 6 });
  });

  it("permite descontar exactamente todo el stock (límite exacto)", () => {
    const result = deductStock(5, 5);
    expect(result).toEqual({ ok: true, newStock: 0 });
  });

  it("rechaza cuando la cantidad supera el stock disponible", () => {
    const result = deductStock(3, 4);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("Stock insuficiente");
    }
  });

  it("rechaza cuando el stock actual es cero", () => {
    const result = deductStock(0, 1);
    expect(result.ok).toBe(false);
  });
});
