import { describe, expect, it, vi } from "vitest";
import { createMigratedTestDb } from "./test-db";

// The owner sees what sellers hold of a product: derived from the
// inventory_movements ledger (ownerType 'seller'), never from products.stock.

const { raw, db: proxy } = createMigratedTestDb();
raw.exec(`
    INSERT INTO products (uuid, name, slug, sku, price, stock) VALUES ('prod-1', 'Audifonos', 'audifonos', 'AUD-00001', 5000, 0);
    INSERT INTO products (uuid, name, slug, sku, price, stock) VALUES ('prod-2', 'Cable', 'cable', 'CAB-00001', 1000, 10);
    INSERT INTO products (uuid, name, slug, sku, price, stock) VALUES ('prod-3', 'Forro', 'forro', 'FOR-00001', 2000, 4);
    INSERT INTO sellers (uuid, name) VALUES ('sel-a', 'Ana');
    INSERT INTO sellers (uuid, name) VALUES ('sel-b', 'Beto');
    INSERT INTO sellers (uuid, name) VALUES ('sel-c', 'Caro');
  `);

vi.mock("./db", () => ({ get db() { return proxy; } }));

const id = (table: string, uuid: string) => (raw.prepare(`SELECT id FROM ${table} WHERE uuid = ?`).get(uuid) as { id: number }).id;
const audifonos = id("products", "prod-1");
const cable = id("products", "prod-2");
const forro = id("products", "prod-3");
const ana = id("sellers", "sel-a");
const beto = id("sellers", "sel-b");
const caro = id("sellers", "sel-c");

let n = 0;
function move(productId: number, quantityDelta: number, owner: "principal" | "seller", sellerId: number | null) {
  raw
    .prepare("INSERT INTO inventory_movements (uuid, product_id, type, quantity_delta, owner_type, seller_id) VALUES (?, ?, 'ajuste', ?, ?, ?)")
    .run(`mov-${++n}`, productId, quantityDelta, owner, sellerId);
}

// Audifonos: Ana got 10 and sold 3 (7), Beto got 2 and sold 5 offline (-3),
// Caro got 4 and returned 4 (0). Principal moves don't count.
move(audifonos, 10, "seller", ana);
move(audifonos, -3, "seller", ana);
move(audifonos, 2, "seller", beto);
move(audifonos, -5, "seller", beto);
move(audifonos, 4, "seller", caro);
move(audifonos, -4, "seller", caro);
move(audifonos, -10, "principal", null);
// Cable: only Beto, 6.
move(cable, 6, "seller", beto);
// Forro: only principal stock.
move(forro, 4, "principal", null);

describe("lo que tienen los vendedores de un producto", async () => {
  const { localSellersRepo } = await import("./sellers-repo");

  it("lista cada vendedor con su saldo, incluidos los negativos, sin los que están en cero", async () => {
    expect(await localSellersRepo.getHoldingsOfProduct(audifonos)).toEqual([
      { sellerId: ana, productId: audifonos, quantity: 7 },
      { sellerId: beto, productId: audifonos, quantity: -3 },
    ]);
  });

  it("un producto que ningún vendedor tiene devuelve una lista vacía", async () => {
    expect(await localSellersRepo.getHoldingsOfProduct(forro)).toEqual([]);
  });

  it("totales por producto: suma neta de todos los vendedores, sin los productos en cero", async () => {
    const totals = await localSellersRepo.getHeldTotalsByProduct();
    expect([...totals].sort((a, b) => a.productId - b.productId)).toEqual([
      { productId: audifonos, quantity: 4 },
      { productId: cable, quantity: 6 },
    ]);
  });
});
