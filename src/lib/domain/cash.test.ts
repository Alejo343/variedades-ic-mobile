import { describe, expect, it } from "vitest";
import { isBusinessCashMovement, isCashAdjustment, isCashTransfer, planCashTransfer, summarizeCashFlow } from "./cash";

describe("isCashAdjustment", () => {
  it("solo el origen 'ajuste' es ajuste", () => {
    expect(isCashAdjustment({ sourceType: "ajuste" })).toBe(true);
    expect(isCashAdjustment({ sourceType: "manual" })).toBe(false);
    expect(isCashAdjustment({ sourceType: null })).toBe(false);
  });
});

describe("summarizeCashFlow", () => {
  it("separa ajustes de ingresos y gastos, pero todos mueven el saldo", () => {
    const s = summarizeCashFlow([
      { type: "ingreso", amount: 500000, sourceType: "ajuste" }, // saldo inicial
      { type: "ingreso", amount: 30000, sourceType: "direct_sale" },
      { type: "gasto", amount: 10000, sourceType: "manual" },
      { type: "gasto", amount: 2000, sourceType: "ajuste" }, // faltante en arqueo
    ]);
    expect(s).toEqual({ income: 30000, expense: 10000, adjustments: 498000, transfers: 0, balanceChange: 518000 });
  });

  it("sin movimientos todo es cero", () => {
    expect(summarizeCashFlow([])).toEqual({ income: 0, expense: 0, adjustments: 0, transfers: 0, balanceChange: 0 });
  });
});

describe("transferencias entre cuentas", () => {
  it("solo el origen 'transferencia' es transferencia, y ni ella ni un ajuste son del negocio", () => {
    expect(isCashTransfer({ sourceType: "transferencia" })).toBe(true);
    expect(isCashTransfer({ sourceType: "ajuste" })).toBe(false);
    expect(isBusinessCashMovement({ sourceType: "transferencia" })).toBe(false);
    expect(isBusinessCashMovement({ sourceType: "ajuste" })).toBe(false);
    expect(isBusinessCashMovement({ sourceType: "direct_sale" })).toBe(true);
    expect(isBusinessCashMovement({ sourceType: null })).toBe(true);
  });

  it("no cuentan como ingreso ni gasto; las dos patas se anulan en el total", () => {
    const s = summarizeCashFlow([
      { type: "ingreso", amount: 30000, sourceType: "direct_sale" },
      { type: "gasto", amount: 100000, sourceType: "transferencia" },
      { type: "ingreso", amount: 100000, sourceType: "transferencia" },
    ]);
    expect(s).toEqual({ income: 30000, expense: 0, adjustments: 0, transfers: 0, balanceChange: 30000 });
  });

  it("vista desde una sola cuenta, la transferencia sí mueve su saldo", () => {
    const s = summarizeCashFlow([{ type: "gasto", amount: 100000, sourceType: "transferencia" }]);
    expect(s).toEqual({ income: 0, expense: 0, adjustments: 0, transfers: -100000, balanceChange: -100000 });
  });
});

describe("planCashTransfer", () => {
  it("arma un gasto en la cuenta de origen y un ingreso en la de destino, con el mismo concepto", () => {
    const plan = planCashTransfer({
      from: { id: 1, name: "Efectivo" },
      to: { id: 2, name: "Nequi" },
      amount: 100000,
    });
    expect(plan).toEqual({
      ok: true,
      movements: [
        { type: "gasto", amount: 100000, accountId: 1, concept: "Transferencia: Efectivo → Nequi", sourceType: "transferencia" },
        { type: "ingreso", amount: 100000, accountId: 2, concept: "Transferencia: Efectivo → Nequi", sourceType: "transferencia" },
      ],
    });
  });

  it("rechaza la misma cuenta y montos que no sean enteros positivos", () => {
    expect(planCashTransfer({ from: { id: 1, name: "A" }, to: { id: 1, name: "A" }, amount: 5 })).toEqual({
      ok: false,
      reason: "La cuenta de origen y la de destino deben ser distintas",
    });
    expect(planCashTransfer({ from: { id: 1, name: "A" }, to: { id: 2, name: "B" }, amount: 0 })).toEqual({
      ok: false,
      reason: "El monto debe ser mayor a 0",
    });
    expect(planCashTransfer({ from: { id: 1, name: "A" }, to: { id: 2, name: "B" }, amount: 1.5 }).ok).toBe(false);
  });
});
