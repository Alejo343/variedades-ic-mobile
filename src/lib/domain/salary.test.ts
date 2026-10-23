import { describe, expect, it } from "vitest";
import {
  formatSalaryPeriod,
  isSalaryPeriodStart,
  nextSalaryStartDate,
  salaryPeriodEnd,
  salaryPeriods,
  salaryPeriodStart,
  sellerPayConfigError,
} from "./salary";

// 2026-10-19 is a Monday; 2026-10-23, a Friday; 2025-12-29, a Monday.

describe("salaryPeriodStart", () => {
  it("semanal: el lunes de esa semana", () => {
    expect(salaryPeriodStart("2026-10-23", "weekly")).toBe("2026-10-19");
    expect(salaryPeriodStart("2026-10-19", "weekly")).toBe("2026-10-19");
    // Sunday belongs to the week that started the Monday before.
    expect(salaryPeriodStart("2026-10-25", "weekly")).toBe("2026-10-19");
  });

  it("semanal: cruza mes y año", () => {
    expect(salaryPeriodStart("2026-11-01", "weekly")).toBe("2026-10-26");
    expect(salaryPeriodStart("2026-01-02", "weekly")).toBe("2025-12-29");
  });

  it("mensual: el día 1", () => {
    expect(salaryPeriodStart("2026-10-23", "monthly")).toBe("2026-10-01");
    expect(salaryPeriodStart("2026-10-01", "monthly")).toBe("2026-10-01");
  });
});

describe("salaryPeriodEnd", () => {
  it("semanal: el domingo", () => {
    expect(salaryPeriodEnd("2026-10-19", "weekly")).toBe("2026-10-25");
    expect(salaryPeriodEnd("2025-12-29", "weekly")).toBe("2026-01-04");
  });

  it("mensual: el último día del mes, con bisiestos", () => {
    expect(salaryPeriodEnd("2026-10-01", "monthly")).toBe("2026-10-31");
    expect(salaryPeriodEnd("2026-02-01", "monthly")).toBe("2026-02-28");
    expect(salaryPeriodEnd("2028-02-01", "monthly")).toBe("2028-02-29");
    expect(salaryPeriodEnd("2026-12-01", "monthly")).toBe("2026-12-31");
  });
});

describe("isSalaryPeriodStart", () => {
  it("acepta solo lunes (semanal) o día 1 (mensual)", () => {
    expect(isSalaryPeriodStart("2026-10-19", "weekly")).toBe(true);
    expect(isSalaryPeriodStart("2026-10-20", "weekly")).toBe(false);
    expect(isSalaryPeriodStart("2026-10-01", "monthly")).toBe(true);
    expect(isSalaryPeriodStart("2026-10-19", "monthly")).toBe(false);
  });

  it("rechaza fechas que no existen o mal formadas", () => {
    expect(isSalaryPeriodStart("2026-13-01", "monthly")).toBe(false);
    expect(isSalaryPeriodStart("2026-02-30", "weekly")).toBe(false);
    expect(isSalaryPeriodStart("2026-10-1", "monthly")).toBe(false);
    expect(isSalaryPeriodStart("", "weekly")).toBe(false);
  });
});

describe("formatSalaryPeriod", () => {
  it("semanal dentro del mismo mes", () => {
    expect(formatSalaryPeriod("2026-10-19", "weekly")).toBe("19–25 oct 2026");
  });

  it("semanal que cruza mes o año", () => {
    expect(formatSalaryPeriod("2026-10-26", "weekly")).toBe("26 oct – 1 nov 2026");
    expect(formatSalaryPeriod("2025-12-29", "weekly")).toBe("29 dic 2025 – 4 ene 2026");
  });

  it("mensual", () => {
    expect(formatSalaryPeriod("2026-10-01", "monthly")).toBe("Octubre 2026");
  });
});

describe("salaryPeriods", () => {
  it("desde la semana del inicio hasta la actual, la actual sin terminar", () => {
    // Started on a Wednesday: that week counts from its Monday.
    expect(salaryPeriods("2026-10-07", "weekly", "2026-10-23", [])).toEqual([
      { start: "2026-10-05", end: "2026-10-11", ended: true, paid: false },
      { start: "2026-10-12", end: "2026-10-18", ended: true, paid: false },
      { start: "2026-10-19", end: "2026-10-25", ended: false, paid: false },
    ]);
  });

  it("el último día del período todavía no está terminado", () => {
    expect(salaryPeriods("2026-10-19", "weekly", "2026-10-25", [])).toEqual([
      { start: "2026-10-19", end: "2026-10-25", ended: false, paid: false },
    ]);
    expect(salaryPeriods("2026-10-19", "weekly", "2026-10-26", [])[0].ended).toBe(true);
  });

  it("marca los pagados por su fecha de inicio", () => {
    const periods = salaryPeriods("2026-08-15", "monthly", "2026-10-23", ["2026-09-01"]);
    expect(periods.map((p) => [p.start, p.ended, p.paid])).toEqual([
      ["2026-08-01", true, false],
      ["2026-09-01", true, true],
      ["2026-10-01", false, false],
    ]);
  });

  it("vacío si el inicio es posterior a hoy", () => {
    expect(salaryPeriods("2026-11-02", "weekly", "2026-10-23", [])).toEqual([]);
  });

  it("cruza el año", () => {
    expect(salaryPeriods("2025-12-10", "monthly", "2026-01-05", []).map((p) => p.start)).toEqual(["2025-12-01", "2026-01-01"]);
  });
});

describe("sellerPayConfigError", () => {
  const salaried = { inventoryMode: "store", payType: "salary", salaryAmount: 300000, salaryPeriod: "weekly" } as const;

  it("comisión: no exige nada más", () => {
    expect(sellerPayConfigError({ inventoryMode: "consignment", payType: "commission", salaryAmount: null, salaryPeriod: null })).toBeNull();
    expect(sellerPayConfigError({ inventoryMode: "store", payType: "commission", salaryAmount: null, salaryPeriod: null })).toBeNull();
  });

  it("sueldo: válido con monto entero positivo y período", () => {
    expect(sellerPayConfigError(salaried)).toBeNull();
  });

  it("sueldo: solo para vendedores de tienda", () => {
    expect(sellerPayConfigError({ ...salaried, inventoryMode: "consignment" })).toMatch(/tienda/);
  });

  it("sueldo: exige monto mayor que cero y entero", () => {
    expect(sellerPayConfigError({ ...salaried, salaryAmount: null })).toMatch(/sueldo/);
    expect(sellerPayConfigError({ ...salaried, salaryAmount: 0 })).toMatch(/sueldo/);
    expect(sellerPayConfigError({ ...salaried, salaryAmount: 1500.5 })).toMatch(/sueldo/);
  });

  it("sueldo: exige semanal o mensual", () => {
    expect(sellerPayConfigError({ ...salaried, salaryPeriod: null })).toMatch(/semanal o mensual/);
  });
});

describe("nextSalaryStartDate", () => {
  const today = "2026-10-23";
  const salaried = { payType: "salary", salaryPeriod: "weekly", salaryStartDate: "2026-09-02" } as const;

  it("vendedor nuevo con sueldo: empieza hoy", () => {
    expect(nextSalaryStartDate(null, { payType: "salary", salaryPeriod: "monthly" }, today)).toBe(today);
  });

  it("pasa de comisión a sueldo: empieza hoy", () => {
    const current = { payType: "commission", salaryPeriod: null, salaryStartDate: null } as const;
    expect(nextSalaryStartDate(current, { payType: "salary", salaryPeriod: "weekly" }, today)).toBe(today);
  });

  it("cambia el período: vuelve a empezar hoy", () => {
    expect(nextSalaryStartDate(salaried, { payType: "salary", salaryPeriod: "monthly" }, today)).toBe(today);
  });

  it("mismo período (solo cambia el monto o nada): conserva la fecha", () => {
    expect(nextSalaryStartDate(salaried, { payType: "salary", salaryPeriod: "weekly" }, today)).toBe("2026-09-02");
  });

  it("sin sueldo: null", () => {
    expect(nextSalaryStartDate(salaried, { payType: "commission", salaryPeriod: null }, today)).toBeNull();
    expect(nextSalaryStartDate(null, { payType: "commission", salaryPeriod: null }, today)).toBeNull();
  });
});
