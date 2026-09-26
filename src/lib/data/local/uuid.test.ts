import { describe, expect, it, vi } from "vitest";
import { createMigratedTestDb } from "./test-db";

// Contract of the sync identity (CLAUDE.md, "Fase 10", sub-paso 1): every
// table has a NOT NULL, unique, v4 `uuid` — backfilled for rows that existed
// before 0015, and filled by Drizzle on every insert the repos make.

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const { raw, db: proxy } = createMigratedTestDb({
  "0015": `
    INSERT INTO categories (name, slug) VALUES ('Audio', 'audio');
    INSERT INTO products (name, slug, sku, price, category_id, stock) VALUES ('Audifonos', 'audifonos', 'AUD-00001', 50000, 1, 5);
    INSERT INTO products (name, slug, sku, price, stock) VALUES ('Cable', 'cable', 'GEN-00001', 8000, 5);
    INSERT INTO product_images (product_id, url, is_primary) VALUES (1, 'file:///a.jpg', 1);
    INSERT INTO sellers (name, commission_type, commission_value) VALUES ('Maria', 'percentage', 1500);
    INSERT INTO direct_sales (total_amount, account_id) VALUES (50000, 1);
    INSERT INTO direct_sale_items (sale_id, product_id, quantity, unit_price, subtotal) VALUES (1, 1, 1, 50000, 50000);
    INSERT INTO inventory_movements (product_id, type, quantity_delta) VALUES (1, 'venta', -1);
  `,
});

vi.mock("./db", () => ({ get db() { return proxy; } }));
vi.mock("../../images", () => ({ deleteProductImageFile: () => {} }));

// sync_outbox (sub-paso 10) and sync_rejections (sub-paso 11) are
// deliberately excluded: they're local-only bookkeeping, not rows the
// server itself stores, so neither has a uuid/sync_version of its own — see
// their comments in schema.ts.
const tables = (raw.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%' AND name NOT IN ('sync_outbox', 'sync_rejections')").all() as { name: string }[]).map((t) => t.name);
const uuidsOf = (table: string) => (raw.prepare(`SELECT uuid FROM ${table}`).all() as { uuid: string | null }[]).map((r) => r.uuid);

describe("uuid de sincronización", async () => {
  const { localDirectSalesRepo } = await import("./direct-sales-repo");

  it("todas las tablas tienen la columna", () => {
    expect(tables).toHaveLength(22);
    for (const t of tables) expect(uuidsOf(t), t).toBeDefined();
  });

  it("las filas previas a la migración quedan con un v4 distinto cada una", () => {
    const backfilled = ["cash_accounts", "categories", "products", "product_images", "sellers", "direct_sales", "direct_sale_items", "inventory_movements"];
    for (const t of backfilled) {
      const uuids = uuidsOf(t);
      expect(uuids.length, t).toBeGreaterThan(0);
      for (const u of uuids) expect(u, t).toMatch(V4);
      expect(new Set(uuids).size, t).toBe(uuids.length);
    }
    expect(uuidsOf("cash_accounts")).toHaveLength(2); // the two seeded by 0009
  });

  it("uuid es NOT NULL y único a nivel de base de datos", () => {
    expect(() => raw.exec("INSERT INTO categories (uuid, name, slug) VALUES (NULL, 'X', 'x')")).toThrow(/NOT NULL/);
    const [existing] = uuidsOf("categories");
    expect(() => raw.exec(`INSERT INTO categories (uuid, name, slug) VALUES ('${existing}', 'Y', 'y')`)).toThrow(/UNIQUE/);
  });

  it("reconstruir las tablas conserva los CHECK", () => {
    expect(() => raw.exec("INSERT INTO direct_sale_items (uuid, sale_id, product_id, quantity, unit_price, subtotal) VALUES ('u', 1, 1, 0, 1, 0)")).toThrow(/CHECK/);
  });

  it("un insert por el repo genera uuid en cada fila que crea (venta, items, movimientos, caja)", async () => {
    const sale = await localDirectSalesRepo.create({ accountId: 1, items: [{ productId: 1, quantity: 1, unitPrice: 50000 }, { productId: 2, quantity: 2, unitPrice: 8000 }] });
    const created = [
      ...(raw.prepare("SELECT uuid FROM direct_sales WHERE id = ?").all(sale.id) as { uuid: string }[]),
      ...(raw.prepare("SELECT uuid FROM direct_sale_items WHERE sale_id = ?").all(sale.id) as { uuid: string }[]),
      ...(raw.prepare("SELECT uuid FROM inventory_movements WHERE source_type = 'direct_sale'").all() as { uuid: string }[]),
      ...(raw.prepare("SELECT uuid FROM cash_movements WHERE source_id = ?").all(sale.id) as { uuid: string }[]),
    ].map((r) => r.uuid);
    expect(created).toHaveLength(1 + 2 + 2 + 1);
    for (const u of created) expect(u).toMatch(V4);
    expect(new Set(created).size).toBe(created.length);
  });
});
