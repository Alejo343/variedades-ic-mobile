import { describe, expect, it, vi } from "vitest";
import { createMigratedTestDb } from "./test-db";

// A settlement charges everything the seller still owes UP TO its date (same
// rule as the web, CLAUDE.md "Fase 10"): pending sales and losses on or before
// periodDate, each marked so no later settlement charges it again. Runs the
// real repo against SQLite with every migration applied; seeds, right before
// 0017, a settlement plus a same-day loss to cover that migration's backfill.

const { raw, db: proxy } = createMigratedTestDb({
  "0017": `
    INSERT INTO sellers (uuid, name, commission_type, commission_value) VALUES ('s1', 'Maria', 'percentage', 1000);
    INSERT INTO products (uuid, name, slug, sku, price) VALUES ('p1', 'Audifonos', 'audifonos', 'GEN-00001', 5000);
    INSERT INTO settlements (uuid, seller_id, period_date, total_sales, total_commission, total_losses, amount_due)
      VALUES ('old', 1, '2026-09-10', 0, 0, 3000, 3000);
    INSERT INTO seller_losses (uuid, seller_id, type, loss_date) VALUES ('l-old', 1, 'dano', '2026-09-10 12:00:00');
    INSERT INTO seller_loss_items (uuid, loss_id, product_id, quantity, unit_cost) VALUES ('li-old', 1, 1, 1, 3000);
  `,
});

vi.mock("./db", () => ({ get db() { return proxy; } }));

let n = 0;
function sale(saleDate: string, total: number, commission: number) {
  raw.exec(`INSERT INTO seller_sales (uuid, seller_id, sale_date, total_amount, commission_amount) VALUES ('sale${++n}', 1, '${saleDate}', ${total}, ${commission})`);
}
function loss(lossDate: string, unitCost: number) {
  const id = ++n;
  raw.exec(`INSERT INTO seller_losses (id, uuid, seller_id, type, loss_date) VALUES (${id + 100}, 'loss${id}', 1, 'perdida', '${lossDate}')`);
  raw.exec(`INSERT INTO seller_loss_items (uuid, loss_id, product_id, quantity, unit_cost) VALUES ('li${id}', ${id + 100}, 1, 1, ${unitCost})`);
}
const count = (sql: string) => (raw.prepare(sql).get() as { n: number }).n;

describe("localSettlementsRepo: todo lo pendiente hasta la fecha", async () => {
  const { localSettlementsRepo: repo } = await import("./settlements-repo");

  it("la migración 0017 liga las pérdidas ya liquidadas (regla vieja: mismo día)", () => {
    expect(raw.prepare(`SELECT settlement_id FROM seller_losses WHERE uuid = 'l-old'`).get()).toEqual({ settlement_id: 1 });
  });

  it("incluye lo pendiente de días anteriores, excluye lo posterior y no vuelve a cobrar lo liquidado", async () => {
    sale("2026-09-19 15:00:00", 5000, 500); // earlier day, still pending
    sale("2026-09-20 15:00:00", 5000, 500);
    loss("2026-09-20 16:00:00", 3000);
    sale("2026-09-22 10:00:00", 9000, 900); // after the period

    expect(await repo.preview(1, "2026-09-20")).toEqual({ totalSales: 10000, totalCommission: 1000, totalLosses: 3000, amountDue: 12000 });
    const created = await repo.create({ sellerId: 1, periodDate: "2026-09-20" });
    expect(created).toMatchObject({ totalSales: 10000, totalLosses: 3000, amountDue: 12000 });
    expect(count(`SELECT count(*) AS n FROM seller_sales WHERE settlement_id = ${created.id}`)).toBe(2);
    expect(count(`SELECT count(*) AS n FROM seller_losses WHERE settlement_id = ${created.id}`)).toBe(1);
  });

  it("lo que llega tarde entra en la siguiente liquidación", async () => {
    sale("2026-09-20 19:00:00", 7000, 700); // synced after day 20 was settled
    loss("2026-09-20 20:00:00", 1000);
    expect(await repo.preview(1, "2026-09-21")).toEqual({ totalSales: 7000, totalCommission: 700, totalLosses: 1000, amountDue: 7300 });
    await repo.create({ sellerId: 1, periodDate: "2026-09-21" });
    expect(count(`SELECT count(*) AS n FROM seller_sales WHERE settlement_id IS NULL`)).toBe(1); // only the day-22 sale
    expect(count(`SELECT count(*) AS n FROM seller_losses WHERE settlement_id IS NULL`)).toBe(0);
  });
});
