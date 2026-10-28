import { describe, expect, it, vi } from "vitest";
import { SALE_ALREADY_VOIDED, SALE_COMMISSION_PAID, SALE_IN_SETTLEMENT } from "../../domain/sale-void";
import { todayLocalDateString } from "../../format";
import { createMigratedTestDb } from "./test-db";

// Voiding a sale (lib/domain/sale-void.ts) on the owner's phone: units back
// where they came from, an in-store sale's cash income removed, the sale kept
// and marked, the operation queued with one movement uuid per item — and
// voided sales out of commission payments and settlements.

const { raw, db: proxy } = createMigratedTestDb();
raw.exec(`
    INSERT INTO products (uuid, name, slug, sku, price, purchase_price, commission_bps, stock) VALUES ('prod-1', 'Audifonos', 'audifonos', 'AUD-00001', 5000, 3000, 1000, 20);
    INSERT INTO sellers (uuid, name, inventory_mode) VALUES ('sel-store', 'Tienda', 'store');
    INSERT INTO sellers (uuid, name) VALUES ('sel-cons', 'Viajero');
    INSERT INTO cash_accounts (uuid, name) VALUES ('acc-1', 'Caja');
  `);

vi.mock("./db", () => ({ get db() { return proxy; } }));

const id = (table: string, uuid: string) => (raw.prepare(`SELECT id FROM ${table} WHERE uuid = ?`).get(uuid) as { id: number }).id;
const productId = id("products", "prod-1");
const storeId = id("sellers", "sel-store");
const consId = id("sellers", "sel-cons");
const accountId = id("cash_accounts", "acc-1");
const stock = () => (raw.prepare("SELECT stock FROM products WHERE id = ?").get(productId) as { stock: number }).stock;
const sellerStock = () =>
  (raw.prepare("SELECT COALESCE(SUM(quantity_delta), 0) AS s FROM inventory_movements WHERE owner_type = 'seller' AND seller_id = ?").get(consId) as { s: number }).s;
const lastOp = () => {
  const row = raw.prepare("SELECT type, payload FROM sync_outbox ORDER BY id DESC LIMIT 1").get() as { type: string; payload: string };
  return { type: row.type, payload: JSON.parse(row.payload) as Record<string, unknown> };
};

raw.exec(`INSERT INTO inventory_movements (uuid, product_id, owner_type, seller_id, type, quantity_delta) VALUES ('deliv', ${productId}, 'seller', ${consId}, 'entrega_vendedor', 10)`);

describe("anular ventas en el celular", async () => {
  const { localDirectSalesRepo } = await import("./direct-sales-repo");
  const { localSellerSalesRepo } = await import("./seller-sales-repo");
  const { localCommissionPaymentsRepo } = await import("./commission-payments-repo");
  const { localSettlementsRepo } = await import("./settlements-repo");

  it("venta en local: devuelve el stock, quita el ingreso de caja, marca la venta y encola la anulación", async () => {
    const before = stock();
    const sale = await localDirectSalesRepo.create({ accountId, items: [{ productId, quantity: 3, unitPrice: 5000 }] });
    expect(stock()).toBe(before - 3);
    expect(raw.prepare("SELECT COUNT(*) AS n FROM cash_movements WHERE source_type = 'direct_sale' AND source_id = ?").get(sale.id)).toEqual({ n: 1 });

    await localDirectSalesRepo.voidSale(sale.id, "  Cobré de más ");

    expect(stock()).toBe(before);
    expect(raw.prepare("SELECT COUNT(*) AS n FROM cash_movements WHERE source_type = 'direct_sale' AND source_id = ?").get(sale.id)).toEqual({ n: 0 });
    const row = raw.prepare("SELECT voided_at AS voidedAt, void_reason AS voidReason, uuid FROM direct_sales WHERE id = ?").get(sale.id) as Record<string, string>;
    expect(row.voidedAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(row.voidReason).toBe("Cobré de más");

    const item = raw.prepare("SELECT uuid FROM direct_sale_items WHERE sale_id = ?").get(sale.id) as { uuid: string };
    const op = lastOp();
    expect(op.type).toBe("voidDirectSale");
    expect(op.payload).toMatchObject({ saleUuid: row.uuid, voidedAt: row.voidedAt, reason: "Cobré de más" });
    const [opItem] = op.payload.items as { itemUuid: string; movementUuid: string }[];
    expect(opItem.itemUuid).toBe(item.uuid);
    const movement = raw.prepare("SELECT type, quantity_delta AS q, owner_type AS owner FROM inventory_movements WHERE uuid = ?").get(opItem.movementUuid);
    expect(movement).toEqual({ type: "anulacion", q: 3, owner: "principal" });

    const listed = (await localDirectSalesRepo.list()).find((s) => s.id === sale.id)!;
    expect(listed).toMatchObject({ voidedAt: row.voidedAt, voidReason: "Cobré de más" });
  });

  it("no se anula dos veces", async () => {
    const sale = await localDirectSalesRepo.create({ accountId, items: [{ productId, quantity: 1, unitPrice: 5000 }] });
    await localDirectSalesRepo.voidSale(sale.id);
    const before = stock();
    await expect(localDirectSalesRepo.voidSale(sale.id)).rejects.toThrow(SALE_ALREADY_VOIDED);
    expect(stock()).toBe(before);
  });

  it("venta de tienda: anulada no se paga como comisión; con la comisión pagada no se anula", async () => {
    const today = todayLocalDateString();
    const voided = await localDirectSalesRepo.create({ accountId, sellerId: storeId, items: [{ productId, quantity: 1, unitPrice: 5000 }] });
    const kept = await localDirectSalesRepo.create({ accountId, sellerId: storeId, items: [{ productId, quantity: 2, unitPrice: 5000 }] });
    await localDirectSalesRepo.voidSale(voided.id);
    expect(await localCommissionPaymentsRepo.preview(storeId, today)).toEqual({ saleCount: 1, totalCommission: 1000 });

    await localCommissionPaymentsRepo.create({ sellerId: storeId, periodDate: today, accountId });
    const voidedRow = raw.prepare("SELECT commission_payment_id AS p FROM direct_sales WHERE id = ?").get(voided.id) as { p: number | null };
    expect(voidedRow.p).toBeNull();
    await expect(localDirectSalesRepo.voidSale(kept.id)).rejects.toThrow(SALE_COMMISSION_PAID);
  });

  it("venta de consignación: devuelve las unidades al vendedor, no entra a la liquidación, y ya liquidada no se anula", async () => {
    const today = todayLocalDateString();
    const before = sellerStock();
    const voided = await localSellerSalesRepo.create({ sellerId: consId, items: [{ productId, quantity: 2, unitPrice: 5000 }] });
    expect(sellerStock()).toBe(before - 2);
    await localSellerSalesRepo.voidSale(voided.id, null);
    expect(sellerStock()).toBe(before);
    expect(lastOp().type).toBe("voidSellerSale");

    const kept = await localSellerSalesRepo.create({ sellerId: consId, items: [{ productId, quantity: 1, unitPrice: 5000 }] });
    expect((await localSettlementsRepo.preview(consId, today)).totalSales).toBe(5000);
    await localSettlementsRepo.create({ sellerId: consId, periodDate: today });
    const voidedRow = raw.prepare("SELECT settlement_id AS s FROM seller_sales WHERE id = ?").get(voided.id) as { s: number | null };
    expect(voidedRow.s).toBeNull();
    await expect(localSellerSalesRepo.voidSale(kept.id)).rejects.toThrow(SALE_IN_SETTLEMENT);

    const listed = (await localSellerSalesRepo.list()).find((s) => s.id === kept.id)!;
    expect(listed.settlementId).not.toBeNull();
  });

  it("los resúmenes de ventas por vendedor no cuentan las anuladas", async () => {
    const summary = await localSellerSalesRepo.getSummaryBySeller();
    const cons = summary.find((l) => l.sellerId === consId)!;
    expect(cons).toMatchObject({ count: 1, totalAmount: 5000 });
  });
});
