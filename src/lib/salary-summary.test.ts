import { describe, expect, it } from "vitest";
import { salarySummary } from "./salary-summary";

// 2026-10-19 is a Monday; 2026-10-23, a Friday.
const seller = { payType: "salary", salaryAmount: 300000, salaryPeriod: "weekly", salaryStartDate: "2026-10-07" } as const;

describe("salarySummary", () => {
  it("lo que se debe son los períodos terminados sin pagar; el actual se puede pagar pero no se debe todavía", () => {
    const summary = salarySummary(seller, [{ period: "weekly", periodStart: "2026-10-05" }], "2026-10-23");
    expect(summary?.unpaid.map((p) => p.start)).toEqual(["2026-10-12", "2026-10-19"]);
    expect(summary?.owed.map((p) => p.start)).toEqual(["2026-10-12"]);
    expect(summary?.owedAmount).toBe(300000);
  });

  it("solo cuenta los pagos del período configurado", () => {
    // A monthly payment from before a switch to weekly doesn't cover a week.
    const summary = salarySummary(seller, [{ period: "monthly", periodStart: "2026-10-01" }], "2026-10-23");
    expect(summary?.owed).toHaveLength(2);
  });

  it("al día: nada que deber", () => {
    const paid = ["2026-10-05", "2026-10-12", "2026-10-19"].map((periodStart) => ({ period: "weekly" as const, periodStart }));
    const summary = salarySummary(seller, paid, "2026-10-23");
    expect(summary).toMatchObject({ unpaid: [], owed: [], owedAmount: 0 });
  });

  it("null para un vendedor de comisión o con el sueldo incompleto", () => {
    expect(salarySummary({ payType: "commission", salaryAmount: null, salaryPeriod: null, salaryStartDate: null }, [], "2026-10-23")).toBeNull();
    expect(salarySummary({ ...seller, salaryStartDate: null }, [], "2026-10-23")).toBeNull();
  });
});
