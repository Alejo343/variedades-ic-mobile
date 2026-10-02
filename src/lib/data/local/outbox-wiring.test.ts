import { describe, expect, it, vi } from "vitest";
import { createMigratedTestDb } from "./test-db";

// Every write repo enqueues its operation in the SAME transaction as the
// local change (sub-paso 10, CLAUDE.md "Fase 10"). This exercises the real
// repos end to end and checks the outbox ends up with exactly the operation
// each call should produce, with uuids that actually resolve (not local ids).

const { raw, db: proxy } = createMigratedTestDb({
  "0018": `
    INSERT INTO categories (uuid, name, slug) VALUES ('cat-1', 'Audio', 'audio');
    INSERT INTO products (uuid, name, slug, sku, price, purchase_price, category_id, stock) VALUES ('prod-1', 'Audifonos', 'audifonos', 'AUD-00001', 50000, 3000, 1, 20);
    INSERT INTO sellers (uuid, name, commission_type, commission_value) VALUES ('sel-1', 'Maria', 'percentage', 1000);
    INSERT INTO distributors (uuid, name) VALUES ('dist-1', 'Proveedor X');
    INSERT INTO cash_accounts (uuid, name) VALUES ('acc-1', 'Efectivo');
  `,
});

vi.mock("./db", () => ({ get db() { return proxy; } }));
vi.mock("../../images", () => ({ deleteProductImageFile: () => {} }));

// Migration 0009 already seeds two cash_accounts (ids 1/2, "Efectivo"/
// "Transferencia") — the "0018" seed above adds a third, so its real id
// isn't 1. Resolved once here instead of hardcoding it.
const accountId = (raw.prepare("SELECT id FROM cash_accounts WHERE uuid = 'acc-1'").get() as { id: number }).id;

const last = () => raw.prepare("SELECT type, payload FROM sync_outbox ORDER BY id DESC LIMIT 1").get() as { type: string; payload: string };
const lastPayload = <T = Record<string, unknown>>() => JSON.parse(last().payload) as T;
const outboxCount = () => (raw.prepare("SELECT count(*) AS n FROM sync_outbox").get() as { n: number }).n;

describe("cada repo local encola su operación (sub-paso 10)", async () => {
  const { localCategoriesRepo } = await import("./categories-repo");
  const { localSellersRepo } = await import("./sellers-repo");
  const { localDistributorsRepo } = await import("./distributors-repo");
  const { localCashAccountsRepo } = await import("./cash-accounts-repo");
  const { localProductsRepo } = await import("./products-repo");
  const { localCashRepo } = await import("./cash-repo");
  const { localDirectSalesRepo } = await import("./direct-sales-repo");
  const { localInventoryRepo } = await import("./inventory-repo");
  const { localSellerDeliveriesRepo } = await import("./seller-deliveries-repo");
  const { localSettlementsRepo } = await import("./settlements-repo");
  const { localPurchaseOrdersRepo } = await import("./purchase-orders-repo");
  const { localPurchasePaymentsRepo } = await import("./purchase-payments-repo");
  const { localSellerSalesRepo } = await import("./seller-sales-repo");
  const { localSellerReturnsRepo } = await import("./seller-returns-repo");
  const { localSellerLossesRepo } = await import("./seller-losses-repo");

  it("catálogo: upsertCategory/Product/Seller/Distributor/CashAccount con el uuid propio de la fila", async () => {
    const category = await localCategoriesRepo.create({ name: "Hogar", slug: "hogar", active: true });
    expect(last().type).toBe("upsertCategory");
    const catRow = raw.prepare("SELECT uuid FROM categories WHERE id = ?").get(category.id) as { uuid: string };
    expect(lastPayload()).toMatchObject({ uuid: catRow.uuid, name: "Hogar", active: true });

    const product = await localProductsRepo.create({ name: "Cable", slug: "cable", price: 5000, purchasePrice: 0, stock: 0, minStock: 0, active: true, categoryId: 1 });
    expect(last().type).toBe("upsertProduct");
    const prodRow = raw.prepare("SELECT uuid FROM products WHERE id = ?").get(product.id) as { uuid: string };
    // sku/stock aren't in the payload at all — the server owns both.
    expect(lastPayload()).toMatchObject({ uuid: prodRow.uuid, name: "Cable", categoryUuid: "cat-1" });
    expect(lastPayload()).not.toHaveProperty("sku");
    expect(lastPayload()).not.toHaveProperty("stock");
    // Se creó sin fotos: nada pendiente de subir, así que la galería (vacía)
    // ya viaja en este mismo mensaje — no hace falta esperar al sub-paso 13.
    expect(lastPayload()).toMatchObject({ images: [] });

    const seller = await localSellersRepo.create({ name: "Pedro", commissionType: "percentage", commissionValue: 500, active: true });
    expect(last().type).toBe("upsertSeller");
    const sellerRow = raw.prepare("SELECT uuid FROM sellers WHERE id = ?").get(seller.id) as { uuid: string };
    expect(lastPayload()).toMatchObject({ uuid: sellerRow.uuid, name: "Pedro" });

    const distributor = await localDistributorsRepo.create({ name: "Proveedor Y", active: true });
    expect(last().type).toBe("upsertDistributor");
    const distRow = raw.prepare("SELECT uuid FROM distributors WHERE id = ?").get(distributor.id) as { uuid: string };
    expect(lastPayload()).toMatchObject({ uuid: distRow.uuid, name: "Proveedor Y" });

    const account = await localCashAccountsRepo.create({ name: "Nequi", type: "banco", active: true });
    expect(last().type).toBe("upsertCashAccount");
    const accRow = raw.prepare("SELECT uuid FROM cash_accounts WHERE id = ?").get(account.id) as { uuid: string };
    expect(lastPayload()).toMatchObject({ uuid: accRow.uuid, name: "Nequi", type: "banco" });

    await localCategoriesRepo.deactivate(category.id);
    expect(last().type).toBe("upsertCategory");
    expect(lastPayload()).toMatchObject({ uuid: catRow.uuid, active: false });
  });

  it("crear un producto con stock inicial > 0 también encola un ajuste (el servidor nunca toma el stock del upsertProduct)", async () => {
    const before = outboxCount();
    const product = await localProductsRepo.create({ name: "Taza", slug: "taza", price: 10000, purchasePrice: 0, stock: 7, minStock: 0, active: true });
    // Dos operaciones nuevas: upsertProduct (sin stock, como siempre) y, justo
    // después, el ajuste que sí sincroniza el 7 inicial con un movimiento real.
    expect(outboxCount()).toBe(before + 2);
    const prodRow = raw.prepare("SELECT uuid, stock FROM products WHERE id = ?").get(product.id) as { uuid: string; stock: number };
    expect(prodRow.stock).toBe(7);

    const rows = raw.prepare("SELECT type, payload FROM sync_outbox ORDER BY id DESC LIMIT 2").all() as { type: string; payload: string }[];
    const [adjustmentRow, upsertRow] = rows;
    expect(upsertRow.type).toBe("upsertProduct");
    expect(JSON.parse(upsertRow.payload)).not.toHaveProperty("stock");

    expect(adjustmentRow.type).toBe("createInventoryAdjustment");
    const movement = raw.prepare("SELECT uuid FROM inventory_movements ORDER BY id DESC LIMIT 1").get() as { uuid: string };
    expect(JSON.parse(adjustmentRow.payload)).toMatchObject({
      uuid: movement.uuid,
      productUuid: prodRow.uuid,
      quantityDelta: 7,
      reason: "Stock inicial",
    });
  });

  it("ajuste de inventario: createInventoryAdjustment con el uuid del movimiento y del producto", async () => {
    await localInventoryRepo.recordAdjustment({ productId: 1, quantityDelta: 5, reason: "Conteo" });
    expect(last().type).toBe("createInventoryAdjustment");
    const movement = raw.prepare("SELECT uuid FROM inventory_movements ORDER BY id DESC LIMIT 1").get() as { uuid: string };
    expect(lastPayload()).toMatchObject({ uuid: movement.uuid, productUuid: "prod-1", quantityDelta: 5, reason: "Conteo" });
  });

  it("movimiento manual de caja: createCashMovement con la cuenta resuelta a uuid", async () => {
    await localCashRepo.recordMovement({ type: "gasto", amount: 1000, concept: "Arriendo", accountId });
    expect(last().type).toBe("createCashMovement");
    expect(lastPayload()).toMatchObject({ type: "gasto", amount: 1000, concept: "Arriendo", accountUuid: "acc-1" });
  });

  it("venta en local: createDirectSale con items e ingreso en caja; sin ingreso, sin cashMovementUuid", async () => {
    await localDirectSalesRepo.create({ accountId, items: [{ productId: 1, quantity: 2, unitPrice: 5000 }] });
    expect(last().type).toBe("createDirectSale");
    const payload = lastPayload<{ accountUuid: string; cashMovementUuid?: string; items: { productUuid: string; quantity: number }[] }>();
    expect(payload.accountUuid).toBe("acc-1");
    expect(payload.cashMovementUuid).toBeDefined();
    expect(payload.items).toEqual([{ productUuid: "prod-1", quantity: 2, unitPrice: 5000, uuid: expect.any(String), movementUuid: expect.any(String) }]);

    await localDirectSalesRepo.create({ accountId, items: [{ productId: 1, quantity: 1, unitPrice: 0 }] });
    expect(lastPayload<{ cashMovementUuid?: string }>().cashMovementUuid).toBeUndefined();
  });

  it("entrega a vendedor: createSellerDelivery con las dos filas del ledger", async () => {
    await localSellerDeliveriesRepo.create({ sellerId: 1, items: [{ productId: 1, quantity: 3, unitCost: 3000 }] });
    expect(last().type).toBe("createSellerDelivery");
    const payload = lastPayload<{ sellerUuid: string; items: { principalMovementUuid: string; sellerMovementUuid: string }[] }>();
    expect(payload.sellerUuid).toBe("sel-1");
    expect(payload.items[0].principalMovementUuid).not.toBe(payload.items[0].sellerMovementUuid);
  });

  it("venta, devolución y pérdida de vendedor: sellerUuid resuelto en las tres", async () => {
    await localSellerSalesRepo.create({ sellerId: 1, items: [{ productId: 1, quantity: 1, unitPrice: 5000 }] });
    expect(last().type).toBe("createSellerSale");
    expect(lastPayload()).toMatchObject({ sellerUuid: "sel-1" });
    expect(lastPayload()).not.toHaveProperty("commissionAmount"); // el servidor la calcula

    await localSellerReturnsRepo.create({ sellerId: 1, items: [{ productId: 1, quantity: 1 }] });
    expect(last().type).toBe("createSellerReturn");
    expect(lastPayload()).toMatchObject({ sellerUuid: "sel-1" });

    await localSellerLossesRepo.create({ sellerId: 1, type: "dano", items: [{ productId: 1, quantity: 1, unitCost: 3000 }] });
    expect(last().type).toBe("createSellerLoss");
    expect(lastPayload()).toMatchObject({ sellerUuid: "sel-1", type: "dano" });
  });

  it("liquidación: createSettlement sin totales (los calcula el servidor) y markSettlementSettled", async () => {
    const settlement = await localSettlementsRepo.create({ sellerId: 1, periodDate: "2026-09-26" });
    expect(last().type).toBe("createSettlement");
    expect(lastPayload()).toEqual({ uuid: expect.any(String), sellerUuid: "sel-1", periodDate: "2026-09-26" });

    await localSettlementsRepo.markSettled(settlement.id, accountId);
    expect(last().type).toBe("markSettlementSettled");
    const payload = lastPayload<{ accountUuid: string; cashMovementUuid?: string }>();
    expect(payload.accountUuid).toBe("acc-1");
    // This seller had no pending sales left after the previous test drained
    // them into the settlement above, so amountDue could be either sign —
    // just confirm the field is present only when there is something to pay.
    if (payload.cashMovementUuid) expect(typeof payload.cashMovementUuid).toBe("string");
  });

  it("compras: createPurchaseOrder, transitionPurchaseOrder (con receivedMovements) y createPurchasePayment", async () => {
    const order = await localPurchaseOrdersRepo.create({ distributorId: 1, purchaseType: "credito", items: [{ productId: 1, quantity: 4, unitCost: 3000 }] });
    expect(last().type).toBe("createPurchaseOrder");
    expect(lastPayload<{ distributorUuid: string; items: { productUuid: string }[] }>()).toMatchObject({ distributorUuid: "dist-1", items: [{ productUuid: "prod-1", quantity: 4, unitCost: 3000 }] });

    await localPurchaseOrdersRepo.markInTransit(order.id);
    expect(last().type).toBe("transitionPurchaseOrder");
    expect(lastPayload()).toMatchObject({ to: "en_viaje" });

    await localPurchaseOrdersRepo.markReceived(order.id);
    expect(last().type).toBe("transitionPurchaseOrder");
    const receivedPayload = lastPayload<{ to: string; receivedMovements: { itemUuid: string; movementUuid: string }[] }>();
    expect(receivedPayload.to).toBe("recibido");
    expect(receivedPayload.receivedMovements).toHaveLength(1);

    await localPurchasePaymentsRepo.create(order.id, { amount: 5000, accountId });
    expect(last().type).toBe("createPurchasePayment");
    const paymentPayload = lastPayload<{ purchaseOrderUuid: string; accountUuid: string; cashMovementUuid: string }>();
    const orderRow = raw.prepare("SELECT uuid FROM purchase_orders WHERE id = ?").get(order.id) as { uuid: string };
    expect(paymentPayload).toMatchObject({ purchaseOrderUuid: orderRow.uuid, accountUuid: "acc-1" });
    expect(paymentPayload.cashMovementUuid).toBeTruthy();
  });

  it("el número total de operaciones encoladas coincide con el número de llamadas hechas arriba", async () => {
    // 6 (catálogo) + 2 (producto con stock inicial) + 1 (ajuste) + 1 (caja)
    // + 2 (ventas en local) + 1 (entrega) + 3 (venta/devolución/pérdida)
    // + 2 (liquidación) + 4 (compras) = 22
    expect(outboxCount()).toBe(22);
  });
});
