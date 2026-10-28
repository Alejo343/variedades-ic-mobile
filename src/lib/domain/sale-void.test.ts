import { describe, expect, it } from "vitest";
import {
  countedSales,
  normalizeVoidReason,
  SALE_ALREADY_VOIDED,
  SALE_COMMISSION_PAID,
  SALE_IN_SETTLEMENT,
  saleVoidBlocker,
  VOID_REASON_MAX,
} from "./sale-void";

describe("saleVoidBlocker", () => {
  it("una venta sin anular, sin liquidar y sin comisión pagada se puede anular", () => {
    expect(saleVoidBlocker({ voidedAt: null })).toBeNull();
    expect(saleVoidBlocker({ voidedAt: null, settlementId: null })).toBeNull();
    expect(saleVoidBlocker({ voidedAt: null, commissionPaymentId: null })).toBeNull();
  });

  it("no se anula dos veces", () => {
    expect(saleVoidBlocker({ voidedAt: "2026-10-28 15:00:00" })).toBe(SALE_ALREADY_VOIDED);
    expect(saleVoidBlocker({ voidedAt: new Date(), settlementId: 3 })).toBe(SALE_ALREADY_VOIDED);
  });

  it("una venta de consignación ya liquidada no se anula", () => {
    expect(saleVoidBlocker({ voidedAt: null, settlementId: 3 })).toBe(SALE_IN_SETTLEMENT);
  });

  it("una venta de tienda con la comisión ya pagada no se anula", () => {
    expect(saleVoidBlocker({ voidedAt: null, commissionPaymentId: 9 })).toBe(SALE_COMMISSION_PAID);
  });
});

describe("normalizeVoidReason", () => {
  it("recorta y deja null si está vacío", () => {
    expect(normalizeVoidReason("  Cobré de más  ")).toBe("Cobré de más");
    expect(normalizeVoidReason("   ")).toBeNull();
    expect(normalizeVoidReason(undefined)).toBeNull();
    expect(normalizeVoidReason(null)).toBeNull();
  });

  it("corta un motivo demasiado largo", () => {
    expect(normalizeVoidReason("x".repeat(VOID_REASON_MAX + 10))).toHaveLength(VOID_REASON_MAX);
  });
});

describe("countedSales", () => {
  it("deja fuera las anuladas", () => {
    const sales = [{ id: 1, voidedAt: null }, { id: 2, voidedAt: "2026-10-28 10:00:00" }, { id: 3, voidedAt: null }];
    expect(countedSales(sales).map((s) => s.id)).toEqual([1, 3]);
  });
});
