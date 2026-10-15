import { describe, expect, it } from "vitest";
import { calculateCommission, formatCommissionPercent, lineCommission, parseCommissionPercent } from "./commission";

describe("lineCommission", () => {
  it("aplica el porcentaje del producto (puntos base) al subtotal de la línea", () => {
    expect(lineCommission({ quantity: 2, unitPrice: 25000, commissionBps: 1000 })).toBe(5000);
  });

  it("redondea al peso más cercano", () => {
    expect(lineCommission({ quantity: 1, unitPrice: 333, commissionBps: 333 })).toBe(11);
  });

  it("es cero con 0% o con precio cero", () => {
    expect(lineCommission({ quantity: 5, unitPrice: 50000, commissionBps: 0 })).toBe(0);
    expect(lineCommission({ quantity: 5, unitPrice: 0, commissionBps: 1500 })).toBe(0);
  });
});

describe("calculateCommission", () => {
  it("suma la comisión de cada producto con su propio porcentaje", () => {
    // 2 × 10.000 al 10% = 2.000; 1 × 30.000 al 15% = 4.500
    expect(
      calculateCommission([
        { quantity: 2, unitPrice: 10000, commissionBps: 1000 },
        { quantity: 1, unitPrice: 30000, commissionBps: 1500 },
      ]),
    ).toBe(6500);
  });

  it("redondea cada línea antes de sumar", () => {
    // 0,5 + 0,5: cada línea redondea a 1, total 2
    expect(
      calculateCommission([
        { quantity: 1, unitPrice: 50, commissionBps: 100 },
        { quantity: 1, unitPrice: 50, commissionBps: 100 },
      ]),
    ).toBe(2);
  });

  it("una venta sin líneas no genera comisión", () => {
    expect(calculateCommission([])).toBe(0);
  });
});

describe("parseCommissionPercent", () => {
  it("lee un porcentaje escrito como texto", () => {
    expect(parseCommissionPercent("15")).toBe(1500);
    expect(parseCommissionPercent("12,5")).toBe(1250);
    expect(parseCommissionPercent("12.5")).toBe(1250);
    expect(parseCommissionPercent(" 15 % ")).toBe(1500);
    expect(parseCommissionPercent("0")).toBe(0);
    expect(parseCommissionPercent("100")).toBe(10000);
  });

  it("lee un número como porcentaje", () => {
    expect(parseCommissionPercent(15)).toBe(1500);
    expect(parseCommissionPercent(12.5)).toBe(1250);
    expect(parseCommissionPercent(0)).toBe(0);
  });

  it("lee una celda de Excel con formato de porcentaje (15% llega como 0,15)", () => {
    expect(parseCommissionPercent(0.15)).toBe(1500);
    expect(parseCommissionPercent(0.125)).toBe(1250);
  });

  it("vacío no es un porcentaje", () => {
    expect(parseCommissionPercent("")).toBeNull();
    expect(parseCommissionPercent("  ")).toBeNull();
    expect(parseCommissionPercent(null)).toBeNull();
    expect(parseCommissionPercent(undefined)).toBeNull();
  });

  it("rechaza texto, negativos, más de 100% y más de dos decimales", () => {
    expect(parseCommissionPercent("abc")).toBeNull();
    expect(parseCommissionPercent("-5")).toBeNull();
    expect(parseCommissionPercent(-5)).toBeNull();
    expect(parseCommissionPercent("101")).toBeNull();
    expect(parseCommissionPercent(150)).toBeNull();
    expect(parseCommissionPercent("12,345")).toBeNull();
    expect(parseCommissionPercent(12.345)).toBeNull();
  });
});

describe("formatCommissionPercent", () => {
  it("muestra los puntos base como porcentaje con coma decimal", () => {
    expect(formatCommissionPercent(1500)).toBe("15%");
    expect(formatCommissionPercent(1250)).toBe("12,5%");
    expect(formatCommissionPercent(1234)).toBe("12,34%");
    expect(formatCommissionPercent(0)).toBe("0%");
  });
});
