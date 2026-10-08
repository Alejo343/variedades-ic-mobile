import { describe, expect, it, vi } from "vitest";
import { createMigratedTestDb } from "./test-db";

// A 'store' seller sells the principal inventory: their sale is a direct_sale
// tagged with them (stock from products.stock, income in the chosen account,
// commission with their config). A 'consignment' seller can't, can't receive
// deliveries once they're 'store', and can't become 'store' while holding
// consigned stock.

const { raw, db: proxy } = createMigratedTestDb();
raw.exec(`
    INSERT INTO products (uuid, name, slug, sku, price, purchase_price, stock) VALUES ('prod-1', 'Audifonos', 'audifonos', 'AUD-00001', 5000, 3000, 10);
    INSERT INTO sellers (uuid, name, commission_type, commission_value, inventory_mode) VALUES ('sel-store', 'Tienda', 'percentage', 1000, 'store');
    INSERT INTO sellers (uuid, name, commission_type, commission_value) VALUES ('sel-cons', 'Viajero', 'percentage', 1000);
    INSERT INTO cash_accounts (uuid, name) VALUES ('acc-1', 'Caja');
  `);

vi.mock("./db", () => ({ get db() { return proxy; } }));

const id = (table: string, uuid: string) => (raw.prepare(`SELECT id FROM ${table} WHERE uuid = ?`).get(uuid) as { id: number }).id;
const productId = id("products", "prod-1");
const storeId = id("sellers", "sel-store");
const consId = id("sellers", "sel-cons");
const accountId = id("cash_accounts", "acc-1");
const stock = () => (raw.prepare("SELECT stock FROM products WHERE id = ?").get(productId) as { stock: number }).stock;
const lastOp = () => {
  const row = raw.prepare("SELECT type, payload FROM sync_outbox ORDER BY id DESC LIMIT 1").get() as { type: string; payload: string };
  return { type: row.type, payload: JSON.parse(row.payload) as Record<string, unknown> };
};

describe("vendedor de tienda", async () => {
  const { localDirectSalesRepo } = await import("./direct-sales-repo");
  const { localSellersRepo } = await import("./sellers-repo");
  const { localSellerDeliveriesRepo } = await import("./seller-deliveries-repo");
  const { localSellerReturnsRepo } = await import("./seller-returns-repo");
  const { localCommissionPaymentsRepo } = await import("./commission-payments-repo");

  it("vende del inventario principal, entra a caja y lleva su comisión y su uuid al servidor", async () => {
    const sale = await localDirectSalesRepo.create({ accountId, sellerId: storeId, items: [{ productId, quantity: 3, unitPrice: 5000 }] });
    expect(stock()).toBe(7);
    expect(sale).toMatchObject({ sellerId: storeId, totalAmount: 15000, commissionAmount: 1500 });
    const income = raw.prepare("SELECT amount, account_id AS accountId FROM cash_movements WHERE source_type = 'direct_sale' AND source_id = ?").get(sale.id);
    expect(income).toEqual({ amount: 15000, accountId });
    expect(lastOp()).toMatchObject({ type: "createDirectSale", payload: { sellerUuid: "sel-store", accountUuid: "acc-1" } });
  });

  it("pagar comisiones: cubre lo pendiente hasta la fecha, sale de la cuenta elegida y no paga dos veces", async () => {
    // A second store sale dated later than the payment's cutoff: stays pending.
    const later = await localDirectSalesRepo.create({ accountId, sellerId: storeId, items: [{ productId, quantity: 1, unitPrice: 5000 }] });
    raw.exec(`UPDATE direct_sales SET sale_date = '2099-01-01 10:00:00' WHERE id = ${later.id}`);

    const today = new Date().toISOString().slice(0, 10);
    expect(await localCommissionPaymentsRepo.preview(storeId, today)).toEqual({ saleCount: 1, totalCommission: 1500 });

    const payment = await localCommissionPaymentsRepo.create({ sellerId: storeId, periodDate: today, accountId });
    expect(payment).toMatchObject({ saleCount: 1, totalCommission: 1500 });
    const expense = raw.prepare("SELECT type, amount, account_id AS accountId, uuid FROM cash_movements WHERE source_type = 'commission_payment' AND source_id = ?").get(payment.id) as Record<string, unknown>;
    expect(expense).toMatchObject({ type: "gasto", amount: 1500, accountId });
    expect(lastOp()).toMatchObject({
      type: "createCommissionPayment",
      payload: { sellerUuid: "sel-store", periodDate: today, accountUuid: "acc-1", cashMovementUuid: expense.uuid },
    });
    expect((lastOp().payload.paidAt as string)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);

    const laterRow = raw.prepare("SELECT commission_payment_id AS p FROM direct_sales WHERE id = ?").get(later.id) as { p: number | null };
    expect(laterRow.p).toBeNull();
    await expect(localCommissionPaymentsRepo.create({ sellerId: storeId, periodDate: today, accountId })).rejects.toThrow(/No hay comisiones pendientes/);
    expect(await localCommissionPaymentsRepo.listForSeller(storeId)).toHaveLength(1);
  });

  it("la venta del dueño no lleva vendedor ni comisión", async () => {
    const sale = await localDirectSalesRepo.create({ accountId, items: [{ productId, quantity: 1, unitPrice: 5000 }] });
    expect(sale).toMatchObject({ sellerId: null, commissionAmount: 0 });
    expect(lastOp().payload).not.toHaveProperty("sellerUuid");
  });

  it("un vendedor de consignación no puede registrar una venta en local", async () => {
    const before = stock();
    await expect(localDirectSalesRepo.create({ accountId, sellerId: consId, items: [{ productId, quantity: 1, unitPrice: 5000 }] })).rejects.toThrow(
      /consignación/,
    );
    expect(stock()).toBe(before);
  });

  it("no se le entrega mercancía a un vendedor de tienda", async () => {
    await expect(
      localSellerDeliveriesRepo.create({ sellerId: storeId, items: [{ productId, quantity: 1, unitCost: 3000 }] }),
    ).rejects.toThrow(/vendedor de tienda/);
  });

  it("pasar a tienda exige que no le quede inventario en consignación", async () => {
    await localSellerDeliveriesRepo.create({ sellerId: consId, items: [{ productId, quantity: 2, unitCost: 3000 }] });
    await expect(localSellersRepo.update(consId, { inventoryMode: "store" })).rejects.toThrow(/consignación/);

    await localSellerReturnsRepo.create({ sellerId: consId, items: [{ productId, quantity: 2 }] });
    const updated = await localSellersRepo.update(consId, { inventoryMode: "store" });
    expect(updated.inventoryMode).toBe("store");
    expect(lastOp()).toMatchObject({ type: "upsertSeller", payload: { uuid: "sel-cons", inventoryMode: "store" } });
  });
});
