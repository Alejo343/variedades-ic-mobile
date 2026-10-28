import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import {
  nextSalaryStartDate,
  PENDING_COMMISSION_BLOCKS_SALARY,
  sellerPayConfigError,
  type SalaryPeriod,
  type SellerPayType,
} from "../../domain/salary";
import { todayLocalDateString } from "../../format";
import { enqueueOperation } from "../../sync/outbox";
import type { CreateSellerInput, Seller, SellerInventoryLineWithSeller, SellersRepo, UpdateSellerInput } from "../sellers-repo";
import { db, type Tx } from "./db";
import { directSales, inventoryMovements, sellers } from "./schema";

function toSeller(row: typeof sellers.$inferSelect): Seller {
  return {
    id: row.id,
    uuid: row.uuid,
    name: row.name,
    phone: row.phone,
    city: row.city,
    inventoryMode: row.inventoryMode as Seller["inventoryMode"],
    payType: row.payType as SellerPayType,
    salaryAmount: row.salaryAmount,
    salaryPeriod: row.salaryPeriod as SalaryPeriod | null,
    salaryStartDate: row.salaryStartDate,
    active: row.active,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// See categories-repo.ts#toUpsertPayload — same "whole row, last write wins" contract.
function toUpsertPayload(row: typeof sellers.$inferSelect) {
  return {
    uuid: row.uuid,
    name: row.name,
    phone: row.phone,
    city: row.city,
    inventoryMode: row.inventoryMode,
    payType: row.payType,
    salaryAmount: row.salaryAmount,
    salaryPeriod: row.salaryPeriod,
    // The phone's own local day, so the server keeps the same first period.
    salaryStartDate: row.salaryStartDate,
    active: row.active,
    notes: row.notes,
  };
}

// Same rule as the server: a seller only becomes a 'store' seller with an
// empty consignment ledger, or those units would be stranded where no screen
// shows them.
async function hasConsignedStock(tx: Tx, sellerId: number) {
  const rows = await tx
    .select({ productId: inventoryMovements.productId })
    .from(inventoryMovements)
    .where(and(eq(inventoryMovements.ownerType, "seller"), eq(inventoryMovements.sellerId, sellerId)))
    .groupBy(inventoryMovements.productId)
    .having(sql`SUM(${inventoryMovements.quantityDelta}) <> 0`)
    .limit(1);
  return rows.length > 0;
}

async function hasPendingCommission(tx: Tx, sellerId: number) {
  const rows = await tx
    .select({ id: directSales.id })
    .from(directSales)
    .where(
      and(
        eq(directSales.sellerId, sellerId),
        isNull(directSales.commissionPaymentId),
        isNull(directSales.voidedAt),
        gt(directSales.commissionAmount, 0),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

// Same rule as the server (lib/db/queries/seller-pay.ts): the pay columns a
// save leaves on the seller (current = null for a new one). Absent fields keep
// the current value, a commission seller carries no salary fields, and the
// whole configuration is checked with lib/domain/salary.ts.
async function resolvePay(tx: Tx, current: typeof sellers.$inferSelect | null, data: UpdateSellerInput) {
  const currentPay = current
    ? { payType: current.payType as SellerPayType, salaryPeriod: current.salaryPeriod as SalaryPeriod | null, salaryStartDate: current.salaryStartDate }
    : null;
  const inventoryMode = data.inventoryMode ?? current?.inventoryMode ?? "consignment";
  const payType = data.payType ?? currentPay?.payType ?? "commission";
  const salaried = payType === "salary";
  const salaryAmount = salaried ? (data.salaryAmount !== undefined ? data.salaryAmount : (current?.salaryAmount ?? null)) : null;
  const salaryPeriod = salaried ? (data.salaryPeriod !== undefined ? data.salaryPeriod : (currentPay?.salaryPeriod ?? null)) : null;

  const error = sellerPayConfigError({ inventoryMode, payType, salaryAmount, salaryPeriod });
  if (error) throw new Error(error);
  if (salaried && current && currentPay?.payType !== "salary" && (await hasPendingCommission(tx, current.id))) {
    throw new Error(PENDING_COMMISSION_BLOCKS_SALARY);
  }
  const salaryStartDate = nextSalaryStartDate(currentPay, { payType, salaryPeriod }, todayLocalDateString());
  return { payType, salaryAmount, salaryPeriod, salaryStartDate };
}

export const localSellersRepo: SellersRepo = {
  async list() {
    const rows = await db.select().from(sellers).orderBy(sellers.name);
    return rows.map(toSeller);
  },

  async getById(id: number) {
    const row = await db.query.sellers.findFirst({ where: eq(sellers.id, id) });
    return row ? toSeller(row) : null;
  },

  async getByUuid(uuid: string) {
    const row = await db.query.sellers.findFirst({ where: eq(sellers.uuid, uuid) });
    return row ? toSeller(row) : null;
  },

  async create(data: CreateSellerInput) {
    return db.transaction(async (tx) => {
      const pay = await resolvePay(tx, null, data);
      const [row] = await tx
        .insert(sellers)
        .values({
          name: data.name,
          phone: data.phone ?? null,
          city: data.city ?? null,
          inventoryMode: data.inventoryMode ?? "consignment",
          ...pay,
          active: data.active ?? true,
          notes: data.notes ?? null,
        })
        .returning();
      await enqueueOperation(tx, "upsertSeller", toUpsertPayload(row));
      return toSeller(row);
    });
  },

  async update(id: number, data: UpdateSellerInput) {
    return db.transaction(async (tx) => {
      if (data.inventoryMode === "store") {
        const current = await tx.query.sellers.findFirst({ where: eq(sellers.id, id), columns: { inventoryMode: true } });
        if (current && current.inventoryMode !== "store" && (await hasConsignedStock(tx, id))) {
          throw new Error(
            "Este vendedor todavía tiene inventario en consignación. Registra la devolución antes de pasarlo a vendedor de tienda.",
          );
        }
      }
      const current = await tx.query.sellers.findFirst({ where: eq(sellers.id, id) });
      const pay = await resolvePay(tx, current ?? null, data);
      const [row] = await tx
        .update(sellers)
        .set({ ...data, ...pay, updatedAt: new Date().toISOString() })
        .where(eq(sellers.id, id))
        .returning();
      if (!row) throw new Error("Vendedor no encontrado");
      await enqueueOperation(tx, "upsertSeller", toUpsertPayload(row));
      return toSeller(row);
    });
  },

  async deactivate(id: number) {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .update(sellers)
        .set({ active: false, updatedAt: new Date().toISOString() })
        .where(eq(sellers.id, id))
        .returning();
      if (row) await enqueueOperation(tx, "upsertSeller", toUpsertPayload(row));
    });
  },

  async getInventory(sellerId: number) {
    const rows = await db
      .select({
        productId: inventoryMovements.productId,
        quantity: sql<number>`SUM(${inventoryMovements.quantityDelta})`,
      })
      .from(inventoryMovements)
      .where(and(eq(inventoryMovements.ownerType, "seller"), eq(inventoryMovements.sellerId, sellerId)))
      .groupBy(inventoryMovements.productId);
    return rows.filter((row) => row.quantity > 0);
  },

  async getAllInventory() {
    const rows = await db
      .select({
        sellerId: inventoryMovements.sellerId,
        productId: inventoryMovements.productId,
        quantity: sql<number>`SUM(${inventoryMovements.quantityDelta})`,
      })
      .from(inventoryMovements)
      .where(eq(inventoryMovements.ownerType, "seller"))
      .groupBy(inventoryMovements.sellerId, inventoryMovements.productId);
    return rows.filter((row) => row.sellerId !== null && row.quantity > 0) as SellerInventoryLineWithSeller[];
  },

  async getHoldingsOfProduct(productId: number) {
    const quantity = sql<number>`SUM(${inventoryMovements.quantityDelta})`;
    const rows = await db
      .select({ sellerId: inventoryMovements.sellerId, productId: inventoryMovements.productId, quantity })
      .from(inventoryMovements)
      .where(and(eq(inventoryMovements.ownerType, "seller"), eq(inventoryMovements.productId, productId)))
      .groupBy(inventoryMovements.sellerId, inventoryMovements.productId)
      .having(sql`${quantity} <> 0`)
      .orderBy(desc(quantity));
    return rows.filter((row) => row.sellerId !== null) as SellerInventoryLineWithSeller[];
  },

  async getHeldTotalsByProduct() {
    const quantity = sql<number>`SUM(${inventoryMovements.quantityDelta})`;
    return db
      .select({ productId: inventoryMovements.productId, quantity })
      .from(inventoryMovements)
      .where(eq(inventoryMovements.ownerType, "seller"))
      .groupBy(inventoryMovements.productId)
      .having(sql`${quantity} <> 0`);
  },
};
