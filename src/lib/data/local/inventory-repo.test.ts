import { describe, expect, it, vi } from "vitest";
import { createMigratedTestDb } from "./test-db";

// The Inventario screen is the shop's own (principal) inventory:
// - recent movements must not include the seller ledger rows (a delivery used
//   to show as -3 and +3, a seller's sale as if it left the shop);
// - "agotados" must include negative stock, which sync allows (an offline sale
//   of the last unit), not only exactly 0.

const { raw, db: proxy } = createMigratedTestDb();
raw.exec(`
  INSERT INTO products (uuid, name, slug, sku, price, stock, min_stock) VALUES ('p-ok', 'Normal', 'normal', 'GEN-00001', 100, 10, 2);
  INSERT INTO products (uuid, name, slug, sku, price, stock, min_stock) VALUES ('p-zero', 'Cero', 'cero', 'GEN-00002', 100, 0, 0);
  INSERT INTO products (uuid, name, slug, sku, price, stock, min_stock) VALUES ('p-neg', 'Negativo', 'negativo', 'GEN-00003', 100, -2, 0);
  INSERT INTO products (uuid, name, slug, sku, price, stock, min_stock, active) VALUES ('p-off', 'Inactivo', 'inactivo', 'GEN-00004', 100, -1, 0, 0);
  INSERT INTO sellers (uuid, name, commission_type, commission_value) VALUES ('s-1', 'Viajero', 'percentage', 1000);
`);

vi.mock("./db", () => ({ get db() { return proxy; } }));
vi.mock("../../images", () => ({ deleteProductImageFile: () => {} }));

const id = (table: string, uuid: string) => (raw.prepare(`SELECT id FROM ${table} WHERE uuid = ?`).get(uuid) as { id: number }).id;

describe("localInventoryRepo — inventario principal", async () => {
  const { localInventoryRepo } = await import("./inventory-repo");
  const productId = id("products", "p-ok");
  const sellerId = id("sellers", "s-1");
  raw.exec(`
    INSERT INTO inventory_movements (uuid, product_id, type, quantity_delta, owner_type, created_at) VALUES ('m-1', ${productId}, 'entrega_vendedor', -3, 'principal', '2026-10-01 10:00:00');
    INSERT INTO inventory_movements (uuid, product_id, type, quantity_delta, owner_type, seller_id, created_at) VALUES ('m-2', ${productId}, 'entrega_vendedor', 3, 'seller', ${sellerId}, '2026-10-01 10:00:00');
    INSERT INTO inventory_movements (uuid, product_id, type, quantity_delta, owner_type, seller_id, created_at) VALUES ('m-3', ${productId}, 'venta', -1, 'seller', ${sellerId}, '2026-10-02 10:00:00');
    INSERT INTO inventory_movements (uuid, product_id, type, quantity_delta, reason, owner_type, created_at) VALUES ('m-4', ${productId}, 'ajuste', 5, 'Conteo', 'principal', '2026-10-03 10:00:00');
  `);

  it("los movimientos recientes son solo los de la tienda, del más nuevo al más viejo", async () => {
    const movements = await localInventoryRepo.getRecentMovements(10);
    expect(movements.map((m) => [m.type, m.quantityDelta])).toEqual([
      ["ajuste", 5],
      ["entrega_vendedor", -3],
    ]);
  });

  it("agotados incluye stock 0 y negativo, solo de productos activos", async () => {
    const out = await localInventoryRepo.getOutOfStock();
    expect(out.map((p) => p.name).sort()).toEqual(["Cero", "Negativo"]);
  });
});
