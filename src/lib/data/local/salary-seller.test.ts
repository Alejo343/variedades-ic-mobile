import { describe, expect, it, vi } from "vitest";
import { todayLocalDateString } from "../../format";
import { createMigratedTestDb } from "./test-db";

// A salaried store seller (lib/domain/salary.ts): sells like any store seller
// but their sales carry no commission, and the owner pays the salary one
// period at a time — an expense in the chosen account.

const { raw, db: proxy } = createMigratedTestDb();
raw.exec(`
    INSERT INTO products (uuid, name, slug, sku, price, purchase_price, commission_bps, stock) VALUES ('prod-1', 'Audifonos', 'audifonos', 'AUD-00001', 5000, 3000, 1000, 50);
    INSERT INTO sellers (uuid, name, inventory_mode) VALUES ('sel-com', 'Comision', 'store');
    INSERT INTO sellers (uuid, name) VALUES ('sel-cons', 'Viajero');
    INSERT INTO cash_accounts (uuid, name) VALUES ('acc-1', 'Caja');
  `);

vi.mock("./db", () => ({ get db() { return proxy; } }));

const id = (table: string, uuid: string) => (raw.prepare(`SELECT id FROM ${table} WHERE uuid = ?`).get(uuid) as { id: number }).id;
const productId = id("products", "prod-1");
const commissionSellerId = id("sellers", "sel-com");
const consId = id("sellers", "sel-cons");
const accountId = id("cash_accounts", "acc-1");
const lastOp = () => {
  const row = raw.prepare("SELECT type, payload FROM sync_outbox ORDER BY id DESC LIMIT 1").get() as { type: string; payload: string };
  return { type: row.type, payload: JSON.parse(row.payload) as Record<string, unknown> };
};
const today = todayLocalDateString();
const salary = { inventoryMode: "store", payType: "salary", salaryAmount: 300000, salaryPeriod: "weekly" } as const;

describe("vendedor de tienda con sueldo", async () => {
  const { localSellersRepo } = await import("./sellers-repo");
  const { localDirectSalesRepo } = await import("./direct-sales-repo");
  const { localCommissionPaymentsRepo } = await import("./commission-payments-repo");
  const { localSalaryPaymentsRepo } = await import("./salary-payments-repo");

  const created = await localSellersRepo.create({ name: "Ana", active: true, ...salary });

  it("crear con sueldo: empieza hoy y viaja completo al servidor", () => {
    expect(created).toMatchObject({ payType: "salary", salaryAmount: 300000, salaryPeriod: "weekly", salaryStartDate: today });
    expect(lastOp()).toMatchObject({
      type: "upsertSeller",
      payload: { uuid: created.uuid, inventoryMode: "store", payType: "salary", salaryAmount: 300000, salaryPeriod: "weekly", salaryStartDate: today },
    });
  });

  it("rechaza sueldo para consignación o sin monto", async () => {
    await expect(localSellersRepo.create({ name: "X", active: true, ...salary, inventoryMode: "consignment" })).rejects.toThrow(/tienda/);
    await expect(localSellersRepo.create({ name: "X", active: true, ...salary, salaryAmount: null })).rejects.toThrow(/sueldo/);
    await expect(localSellersRepo.update(consId, { payType: "salary", salaryAmount: 1000, salaryPeriod: "weekly" })).rejects.toThrow(/tienda/);
  });

  it("cambiar solo el monto conserva el inicio; cambiar el período lo reinicia hoy", async () => {
    raw.exec(`UPDATE sellers SET salary_start_date = '2026-01-07' WHERE id = ${created.id}`);
    expect(await localSellersRepo.update(created.id, { salaryAmount: 320000 })).toMatchObject({ salaryAmount: 320000, salaryStartDate: "2026-01-07" });
    expect(await localSellersRepo.update(created.id, { active: true })).toMatchObject({ payType: "salary", salaryStartDate: "2026-01-07" });
    expect(await localSellersRepo.update(created.id, { salaryPeriod: "monthly" })).toMatchObject({ salaryPeriod: "monthly", salaryStartDate: today });
    await localSellersRepo.update(created.id, { salaryPeriod: "weekly", salaryAmount: 300000 });
  });

  it("su venta no lleva comisión", async () => {
    const sale = await localDirectSalesRepo.create({ accountId, sellerId: created.id, items: [{ productId, quantity: 2, unitPrice: 5000 }] });
    expect(sale).toMatchObject({ totalAmount: 10000, commissionAmount: 0 });
  });

  it("pasar a sueldo exige haber pagado sus comisiones", async () => {
    await localDirectSalesRepo.create({ accountId, sellerId: commissionSellerId, items: [{ productId, quantity: 1, unitPrice: 5000 }] });
    await expect(localSellersRepo.update(commissionSellerId, salary)).rejects.toThrow(/comisiones sin pagar/);
    await localCommissionPaymentsRepo.create({ sellerId: commissionSellerId, periodDate: today, accountId });
    expect(await localSellersRepo.update(commissionSellerId, salary)).toMatchObject({ payType: "salary", salaryStartDate: today });
  });

  it("volver a comisión borra los datos del sueldo", async () => {
    expect(await localSellersRepo.update(commissionSellerId, { payType: "commission" })).toMatchObject({
      payType: "commission", salaryAmount: null, salaryPeriod: null, salaryStartDate: null,
    });
  });

  it("pagar sueldo: un período con el monto dado, sale de la cuenta y viaja con sus uuid", async () => {
    const payment = await localSalaryPaymentsRepo.create({
      sellerId: created.id, period: "weekly", periodStart: "2026-10-12", amount: 280000, accountId, notes: "descontado 1 día",
    });
    expect(payment).toMatchObject({ sellerId: created.id, period: "weekly", periodStart: "2026-10-12", amount: 280000, notes: "descontado 1 día" });
    const expense = raw
      .prepare("SELECT type, amount, account_id AS accountId, concept, uuid FROM cash_movements WHERE source_type = 'salary_payment' AND source_id = ?")
      .get(payment.id) as Record<string, unknown>;
    expect(expense).toMatchObject({ type: "gasto", amount: 280000, accountId, concept: "Sueldo Ana · 12–18 oct 2026" });
    const op = lastOp();
    expect(op).toMatchObject({
      type: "createSalaryPayment",
      payload: { sellerUuid: created.uuid, period: "weekly", periodStart: "2026-10-12", amount: 280000, accountUuid: "acc-1", cashMovementUuid: expense.uuid, notes: "descontado 1 día" },
    });
    expect(op.payload.paidAt as string).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it("no paga dos veces el mismo período ni uno que no empieza en lunes", async () => {
    const base = { sellerId: created.id, period: "weekly", amount: 300000, accountId } as const;
    await expect(localSalaryPaymentsRepo.create({ ...base, periodStart: "2026-10-12" })).rejects.toThrow(/ya está pagado/);
    await expect(localSalaryPaymentsRepo.create({ ...base, periodStart: "2026-10-14" })).rejects.toThrow(/lunes/);
    await expect(localSalaryPaymentsRepo.create({ ...base, periodStart: "2026-10-19", amount: 0 })).rejects.toThrow(/mayor que cero/);
  });

  it("lista sus pagos, el más reciente primero", async () => {
    await localSalaryPaymentsRepo.create({ sellerId: created.id, period: "weekly", periodStart: "2026-10-05", amount: 300000, accountId });
    raw.exec(`UPDATE salary_payments SET paid_at = '2026-10-13 10:00:00' WHERE period_start = '2026-10-12'`);
    raw.exec(`UPDATE salary_payments SET paid_at = '2026-10-06 10:00:00' WHERE period_start = '2026-10-05'`);
    expect((await localSalaryPaymentsRepo.listForSeller(created.id)).map((p) => p.periodStart)).toEqual(["2026-10-12", "2026-10-05"]);
  });
});
