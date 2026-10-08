import { describe, expect, it, vi } from "vitest";
import { createMigratedTestDb } from "../data/local/test-db";

// applyPullPage (sub-paso 11) turns one server pull page into local rows,
// entirely by uuid — never by the id the server happens to use, which this
// device doesn't even receive. One page here exercises every table's own
// apply order (a child's parent must already exist locally by the time the
// child is applied) plus a tombstone deleting a row that arrived earlier.

const { raw, db: proxy } = createMigratedTestDb();
vi.mock("../data/local/db", () => ({ get db() { return proxy; } }));

// Same driver-level type mismatch as outbox.test.ts (the test harness's
// sqlite-proxy driver isn't the same Drizzle instantiation applyPullPage is
// typed against) — cast away, only runtime behavior is under test here.
type AnyTx = Parameters<typeof import("./pull-apply").applyPullPage>[0];

const one = (sql: string, ...params: (string | number)[]) => raw.prepare(sql).get(...params) as Record<string, unknown>;
const uuidOf = (table: string, id: number) => (one(`SELECT uuid FROM ${table} WHERE id = ?`, id) as { uuid: string }).uuid;

describe("applyPullPage: aplica un lote completo del servidor", async () => {
  const { applyPullPage } = await import("./pull-apply");

  const page = {
    changes: {
      categories: [{ uuid: "cat-1", name: "Tecnología", slug: "tec", description: null, active: true }],
      sellers: [{ uuid: "sel-1", name: "Maria", phone: null, city: "Bogotá", commissionType: "percentage", commissionValue: 1000, inventoryMode: "store", active: true, notes: null }],
      cash_accounts: [{ uuid: "acc-1", name: "Efectivo", type: "efectivo", active: true, notes: null }],
      products: [{
        uuid: "prod-1", name: "Audífonos", slug: "audifonos", description: null, sku: "TEC-00001", price: 50000,
        purchasePrice: 30000, categoryUuid: "cat-1", distributorCode: null, stock: 17, minStock: 2, warrantyMonths: null,
        active: true, updatedAt: "2026-09-26 10:00:00",
      }],
      product_images: [
        { uuid: "img-1", productUuid: "prod-1", url: "/uploads/products/a.webp", alt: null, displayOrder: 0, isPrimary: true },
        { uuid: "img-2", productUuid: "prod-1", url: "/uploads/products/b.webp", alt: null, displayOrder: 1, isPrimary: false },
      ],
      commission_payments: [{
        uuid: "cp-1", sellerUuid: "sel-1", periodDate: "2026-09-26", saleCount: 1, totalCommission: 1500,
        accountUuid: "acc-1", paidAt: "2026-09-26 20:00:00", notes: null,
      }],
      direct_sales: [{
        uuid: "sale-1", saleDate: "2026-09-26 11:00:00", totalAmount: 15000, accountUuid: "acc-1",
        sellerUuid: "sel-1", commissionAmount: 1500, commissionPaymentUuid: "cp-1", notes: null,
      }],
      direct_sale_items: [{ uuid: "item-1", saleUuid: "sale-1", productUuid: "prod-1", quantity: 1, unitPrice: 15000, subtotal: 15000 }],
      settlements: [{
        uuid: "set-1", sellerUuid: "sel-1", periodDate: "2026-09-25", totalSales: 5000, totalCommission: 500,
        totalLosses: 0, amountDue: 4500, status: "liquidada", settledAt: "2026-09-26 09:00:00",
      }],
      seller_sales: [{ uuid: "ssale-1", sellerUuid: "sel-1", saleDate: "2026-09-25 12:00:00", totalAmount: 5000, commissionAmount: 500, settlementUuid: "set-1", notes: null }],
      inventory_movements: [{ uuid: "mov-1", productUuid: "prod-1", type: "venta", quantityDelta: -1, reason: null, sourceType: "direct_sale", ownerType: "principal", sellerUuid: null, createdAt: "2026-09-26 11:00:00" }],
      cash_movements: [{ uuid: "cash-1", type: "ingreso", amount: 15000, concept: "Venta en local #9", movementDate: "2026-09-26 11:00:00", sourceType: "direct_sale", sourceUuid: "sale-1", accountUuid: "acc-1", notes: null }],
    },
    tombstones: [{ table: "product_images", uuid: "img-2" }],
  };

  it("crea todo lo del padre antes del hijo y resuelve cada referencia a un id local, nunca al del servidor", async () => {
    await proxy.transaction((tx) => applyPullPage(tx as unknown as AnyTx, page));

    const category = one("SELECT id FROM categories WHERE uuid = 'cat-1'");
    const product = one("SELECT id, category_id, stock FROM products WHERE uuid = 'prod-1'");
    expect(product.category_id).toBe(category.id);
    expect(product.stock).toBe(17); // el servidor manda, no un valor local

    const account = one("SELECT id FROM cash_accounts WHERE uuid = 'acc-1'");
    const sale = one("SELECT id, account_id FROM direct_sales WHERE uuid = 'sale-1'");
    // A store seller's in-store sale keeps who sold it and their commission.
    expect(one("SELECT inventory_mode FROM sellers WHERE uuid = 'sel-1'")).toEqual({ inventory_mode: "store" });
    const saleSeller = one("SELECT seller_id, commission_amount FROM direct_sales WHERE uuid = 'sale-1'");
    expect(uuidOf("sellers", saleSeller.seller_id as number)).toBe("sel-1");
    expect(saleSeller.commission_amount).toBe(1500);
    const paidBy = one("SELECT commission_payment_id FROM direct_sales WHERE uuid = 'sale-1'").commission_payment_id as number;
    expect(uuidOf("commission_payments", paidBy)).toBe("cp-1");
    expect(sale.account_id).toBe(account.id);

    const saleItem = one("SELECT sale_id, product_id, subtotal FROM direct_sale_items WHERE uuid = 'item-1'");
    expect(saleItem.sale_id).toBe(sale.id);
    expect(saleItem.product_id).toBe(product.id);

    const seller = one("SELECT id FROM sellers WHERE uuid = 'sel-1'");
    const settlement = one("SELECT id, seller_id FROM settlements WHERE uuid = 'set-1'");
    expect(settlement.seller_id).toBe(seller.id);

    const sellerSale = one("SELECT settlement_id FROM seller_sales WHERE uuid = 'ssale-1'");
    expect(sellerSale.settlement_id).toBe(settlement.id);

    const movement = one("SELECT product_id, seller_id FROM inventory_movements WHERE uuid = 'mov-1'");
    expect(movement.product_id).toBe(product.id);
    expect(movement.seller_id).toBeNull();

    // El sourceUuid polimórfico se resolvió contra direct_sales, no un id que
    // por casualidad coincidiera con otra tabla.
    const cashMovement = one("SELECT account_id, source_id FROM cash_movements WHERE uuid = 'cash-1'");
    expect(cashMovement.account_id).toBe(account.id);
    expect(cashMovement.source_id).toBe(sale.id);

    // La foto quitada por el dueño en otro dispositivo desapareció aquí también.
    expect(raw.prepare("SELECT id FROM product_images WHERE uuid = 'img-2'").get()).toBeUndefined();
    expect(one("SELECT id FROM product_images WHERE uuid = 'img-1'")).toBeDefined();
  });

  it("una segunda página que actualiza la misma fila hace update, no crea otra", async () => {
    await proxy.transaction((tx) => applyPullPage(tx as unknown as AnyTx, {
      changes: { categories: [{ uuid: "cat-1", name: "Tecnología y hogar", slug: "tec", description: "actualizada", active: true }] },
      tombstones: [],
    }));
    expect(raw.prepare("SELECT count(*) AS n FROM categories WHERE uuid = 'cat-1'").get()).toEqual({ n: 1 });
    expect(one("SELECT name, description FROM categories WHERE uuid = 'cat-1'")).toEqual({ name: "Tecnología y hogar", description: "actualizada" });
  });

  it("una referencia a un uuid que este dispositivo no tiene rechaza la página completa", async () => {
    await expect(
      proxy.transaction((tx) => applyPullPage(tx as unknown as AnyTx, {
        changes: { product_images: [{ uuid: "img-99", productUuid: "no-existe", url: "/x.webp", alt: null, displayOrder: 0, isPrimary: true }] },
        tombstones: [],
      })),
    ).rejects.toThrow(/no tiene/);
    expect(raw.prepare("SELECT id FROM product_images WHERE uuid = 'img-99'").get()).toBeUndefined();
  });

  it("una lápida de una fila que nunca llegó a este dispositivo no hace nada", async () => {
    await proxy.transaction((tx) => applyPullPage(tx as unknown as AnyTx, { changes: {}, tombstones: [{ table: "sellers", uuid: uuidOf("sellers", 1) + "-nope" }] }));
    expect(raw.prepare("SELECT id FROM sellers").get()).toBeDefined(); // sigue existiendo, nada se rompió
  });
});
