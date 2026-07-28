import { describe, expect, it } from "vitest";
import { calculateCommission } from "./commission";

describe("calculateCommission", () => {
  it("calcula comisión por porcentaje (basis points)", () => {
    const commission = calculateCommission({ type: "percentage", value: 1000 }, 50000, 5);
    expect(commission).toBe(5000);
  });

  it("calcula comisión fija por unidad", () => {
    const commission = calculateCommission({ type: "fixed_per_unit", value: 500 }, 30000, 3);
    expect(commission).toBe(1500);
  });

  it("redondea el resultado de porcentaje al entero más cercano", () => {
    const commission = calculateCommission({ type: "percentage", value: 333 }, 333, 1);
    expect(commission).toBe(11);
  });

  it("devuelve cero cuando el valor de comisión es cero", () => {
    expect(calculateCommission({ type: "percentage", value: 0 }, 50000, 5)).toBe(0);
    expect(calculateCommission({ type: "fixed_per_unit", value: 0 }, 50000, 5)).toBe(0);
  });
});
