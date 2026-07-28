import { describe, expect, it } from "vitest";
import { calculateSettlement } from "./settlement";

describe("calculateSettlement", () => {
  it("calcula el monto a entregar: ventas - comisión + pérdidas", () => {
    const result = calculateSettlement({ totalSales: 100000, totalCommission: 10000, totalLosses: 5000 });
    expect(result).toEqual({ amountDue: 95000 });
  });

  it("funciona sin pérdidas", () => {
    const result = calculateSettlement({ totalSales: 50000, totalCommission: 5000, totalLosses: 0 });
    expect(result).toEqual({ amountDue: 45000 });
  });

  it("funciona sin ventas (solo pérdidas)", () => {
    const result = calculateSettlement({ totalSales: 0, totalCommission: 0, totalLosses: 3000 });
    expect(result).toEqual({ amountDue: 3000 });
  });
});
