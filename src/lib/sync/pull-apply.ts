import { eq } from 'drizzle-orm';
import type { AnySQLiteTable, SQLiteColumn } from 'drizzle-orm/sqlite-core';
import type { Tx } from '@/lib/data/local/db';
import {
  cashAccounts,
  cashMovements,
  categories,
  directSaleItems,
  directSales,
  distributors,
  inventoryMovements,
  productImages,
  products,
  purchaseOrderItems,
  purchaseOrders,
  purchasePayments,
  sellerDeliveries,
  sellerDeliveryItems,
  sellerLossItems,
  sellerLosses,
  sellerReturnItems,
  sellerReturns,
  sellerSaleItems,
  sellerSales,
  sellers,
  settlements,
} from '@/lib/data/local/schema';
import type { PullResponse } from './api';

// Applies one page of GET /api/sync/pull's response (sub-paso 11) inside a
// single transaction, so a page never lands half-written. The server is
// authoritative for every field it sends — including products.stock, which
// on this device becomes provisional the moment it goes offline (CLAUDE.md,
// "Fase 10"): a pulled row always overwrites the local one outright, never
// merges field by field. Local integer ids are NEVER touched by pull — only
// `uuid` identifies a row across devices; a row's own local id is assigned
// by SQLite on first insert and stays whatever it already was on update.

type Row = Record<string, unknown>;
// Every table this module touches has both columns — Drizzle's own table
// type is kept (not narrowed away) so `.from`/`.insert`/`.delete` still see
// a real table and infer properly; only `id`/`uuid` are asserted to exist.
type UuidTable = AnySQLiteTable & { id: SQLiteColumn; uuid: SQLiteColumn };

async function localId(tx: Tx, table: UuidTable, uuid: string): Promise<number> {
  const [row] = await tx.select({ id: table.id }).from(table).where(eq(table.uuid, uuid)).limit(1);
  if (!row) throw new Error(`El pull mandó una referencia a un uuid que este dispositivo no tiene: ${uuid}`);
  return row.id as number;
}

async function localIdNullable(tx: Tx, table: UuidTable, uuid: string | null | undefined): Promise<number | null> {
  if (!uuid) return null;
  const [row] = await tx.select({ id: table.id }).from(table).where(eq(table.uuid, uuid)).limit(1);
  return (row?.id as number | undefined) ?? null;
}

// Upserts by `uuid` (the row's sync identity) and returns its local id,
// whichever branch ran — every table here has both columns, same shape the
// generic helpers above rely on.
async function upsert(tx: Tx, table: UuidTable, uuid: string, values: Row): Promise<number> {
  const [row] = await tx
    .insert(table)
    .values({ uuid, ...values })
    .onConflictDoUpdate({ target: table.uuid, set: values })
    .returning({ id: table.id });
  return row.id as number;
}

// Own apply order, NOT the server's fetch order (that one's about paging by
// version, not about what a device can safely write first) — parents always
// before children. cash_movements goes last because its sourceUuid can point
// at direct_sales, settlements or purchase_payments, all three already done
// by then.
const TABLE_ORDER = [
  'categories', 'sellers', 'distributors', 'cash_accounts', 'products', 'product_images',
  'direct_sales', 'direct_sale_items', 'purchase_orders', 'purchase_order_items', 'purchase_payments',
  'seller_deliveries', 'seller_delivery_items', 'seller_returns', 'seller_return_items',
  'settlements', 'seller_losses', 'seller_loss_items', 'seller_sales', 'seller_sale_items',
  'inventory_movements', 'cash_movements',
] as const;

async function applyRow(tx: Tx, table: string, row: Row): Promise<void> {
  const uuid = row.uuid as string;
  switch (table) {
    case 'categories':
      await upsert(tx, categories, uuid, { name: row.name, slug: row.slug, description: row.description, active: row.active });
      return;
    case 'sellers':
      await upsert(tx, sellers, uuid, {
        name: row.name, phone: row.phone, city: row.city, commissionType: row.commissionType,
        commissionValue: row.commissionValue, active: row.active, notes: row.notes,
      });
      return;
    case 'distributors':
      await upsert(tx, distributors, uuid, { name: row.name, city: row.city, phone: row.phone, notes: row.notes, active: row.active });
      return;
    case 'cash_accounts':
      await upsert(tx, cashAccounts, uuid, { name: row.name, type: row.type, active: row.active, notes: row.notes });
      return;
    case 'products': {
      const categoryId = await localIdNullable(tx, categories, row.categoryUuid as string | null);
      await upsert(tx, products, uuid, {
        name: row.name, slug: row.slug, description: row.description, sku: row.sku, price: row.price,
        purchasePrice: row.purchasePrice, categoryId, distributorCode: row.distributorCode, stock: row.stock,
        minStock: row.minStock, warrantyMonths: row.warrantyMonths, active: row.active, updatedAt: row.updatedAt,
      });
      return;
    }
    case 'product_images': {
      const productId = await localId(tx, products, row.productUuid as string);
      await upsert(tx, productImages, uuid, { productId, url: row.url, alt: row.alt, displayOrder: row.displayOrder, isPrimary: row.isPrimary });
      return;
    }
    case 'direct_sales': {
      const accountId = await localId(tx, cashAccounts, row.accountUuid as string);
      await upsert(tx, directSales, uuid, { saleDate: row.saleDate, totalAmount: row.totalAmount, accountId, notes: row.notes });
      return;
    }
    case 'direct_sale_items': {
      const saleId = await localId(tx, directSales, row.saleUuid as string);
      const productId = await localId(tx, products, row.productUuid as string);
      await upsert(tx, directSaleItems, uuid, { saleId, productId, quantity: row.quantity, unitPrice: row.unitPrice, subtotal: row.subtotal });
      return;
    }
    case 'purchase_orders': {
      const distributorId = await localIdNullable(tx, distributors, row.distributorUuid as string | null);
      await upsert(tx, purchaseOrders, uuid, {
        distributorId, status: row.status, purchaseType: row.purchaseType, orderDate: row.orderDate,
        expectedDate: row.expectedDate, totalCost: row.totalCost, notes: row.notes, updatedAt: row.updatedAt,
      });
      return;
    }
    case 'purchase_order_items': {
      const orderId = await localId(tx, purchaseOrders, row.orderUuid as string);
      const productId = await localId(tx, products, row.productUuid as string);
      await upsert(tx, purchaseOrderItems, uuid, { orderId, productId, quantity: row.quantity, unitCost: row.unitCost });
      return;
    }
    case 'purchase_payments': {
      const purchaseOrderId = await localId(tx, purchaseOrders, row.purchaseOrderUuid as string);
      const accountId = await localId(tx, cashAccounts, row.accountUuid as string);
      await upsert(tx, purchasePayments, uuid, { purchaseOrderId, amount: row.amount, paidAt: row.paidAt, accountId, notes: row.notes });
      return;
    }
    case 'seller_deliveries': {
      const sellerId = await localId(tx, sellers, row.sellerUuid as string);
      await upsert(tx, sellerDeliveries, uuid, { sellerId, deliveryDate: row.deliveryDate, notes: row.notes });
      return;
    }
    case 'seller_delivery_items': {
      const deliveryId = await localId(tx, sellerDeliveries, row.deliveryUuid as string);
      const productId = await localId(tx, products, row.productUuid as string);
      await upsert(tx, sellerDeliveryItems, uuid, { deliveryId, productId, quantity: row.quantity, unitCost: row.unitCost });
      return;
    }
    case 'seller_returns': {
      const sellerId = await localId(tx, sellers, row.sellerUuid as string);
      await upsert(tx, sellerReturns, uuid, { sellerId, returnDate: row.returnDate, notes: row.notes });
      return;
    }
    case 'seller_return_items': {
      const returnId = await localId(tx, sellerReturns, row.returnUuid as string);
      const productId = await localId(tx, products, row.productUuid as string);
      await upsert(tx, sellerReturnItems, uuid, { returnId, productId, quantity: row.quantity });
      return;
    }
    case 'settlements': {
      const sellerId = await localId(tx, sellers, row.sellerUuid as string);
      await upsert(tx, settlements, uuid, {
        sellerId, periodDate: row.periodDate, totalSales: row.totalSales, totalCommission: row.totalCommission,
        totalLosses: row.totalLosses, amountDue: row.amountDue, status: row.status, settledAt: row.settledAt,
      });
      return;
    }
    case 'seller_losses': {
      const sellerId = await localId(tx, sellers, row.sellerUuid as string);
      const settlementId = await localIdNullable(tx, settlements, row.settlementUuid as string | null);
      await upsert(tx, sellerLosses, uuid, { sellerId, type: row.type, lossDate: row.lossDate, settlementId, notes: row.notes });
      return;
    }
    case 'seller_loss_items': {
      const lossId = await localId(tx, sellerLosses, row.lossUuid as string);
      const productId = await localId(tx, products, row.productUuid as string);
      await upsert(tx, sellerLossItems, uuid, { lossId, productId, quantity: row.quantity, unitCost: row.unitCost });
      return;
    }
    case 'seller_sales': {
      const sellerId = await localId(tx, sellers, row.sellerUuid as string);
      const settlementId = await localIdNullable(tx, settlements, row.settlementUuid as string | null);
      await upsert(tx, sellerSales, uuid, {
        sellerId, saleDate: row.saleDate, totalAmount: row.totalAmount, commissionAmount: row.commissionAmount,
        settlementId, notes: row.notes,
      });
      return;
    }
    case 'seller_sale_items': {
      const saleId = await localId(tx, sellerSales, row.saleUuid as string);
      const productId = await localId(tx, products, row.productUuid as string);
      await upsert(tx, sellerSaleItems, uuid, { saleId, productId, quantity: row.quantity, unitPrice: row.unitPrice, subtotal: row.subtotal });
      return;
    }
    case 'inventory_movements': {
      const productId = await localId(tx, products, row.productUuid as string);
      const sellerId = await localIdNullable(tx, sellers, row.sellerUuid as string | null);
      await upsert(tx, inventoryMovements, uuid, {
        productId, type: row.type, quantityDelta: row.quantityDelta, reason: row.reason,
        sourceType: row.sourceType, ownerType: row.ownerType, sellerId,
      });
      return;
    }
    case 'cash_movements': {
      const accountId = await localId(tx, cashAccounts, row.accountUuid as string);
      // sourceUuid is polymorphic — which table it points into depends on
      // sourceType, and only these three ever set it on the server's pull.
      const sourceTables = { direct_sale: directSales, settlement: settlements, purchase_payment: purchasePayments } as const;
      const sourceTable = sourceTables[row.sourceType as keyof typeof sourceTables];
      const sourceId = sourceTable ? await localIdNullable(tx, sourceTable, row.sourceUuid as string | null) : null;
      await upsert(tx, cashMovements, uuid, {
        type: row.type, amount: row.amount, concept: row.concept, movementDate: row.movementDate,
        sourceType: row.sourceType, sourceId, accountId, notes: row.notes,
      });
      return;
    }
    default:
      // A table this device doesn't know how to apply yet — ignored rather
      // than failing the whole page; new tables get added here explicitly.
      return;
  }
}

const TOMBSTONE_TABLES: Record<string, UuidTable> = {
  categories, sellers, distributors, cash_accounts: cashAccounts, products, product_images: productImages,
  direct_sales: directSales, direct_sale_items: directSaleItems, purchase_orders: purchaseOrders,
  purchase_order_items: purchaseOrderItems, purchase_payments: purchasePayments,
  seller_deliveries: sellerDeliveries, seller_delivery_items: sellerDeliveryItems,
  seller_returns: sellerReturns, seller_return_items: sellerReturnItems,
  settlements, seller_losses: sellerLosses, seller_loss_items: sellerLossItems,
  seller_sales: sellerSales, seller_sale_items: sellerSaleItems,
  inventory_movements: inventoryMovements, cash_movements: cashMovements,
};

export async function applyPullPage(tx: Tx, page: Pick<PullResponse, 'changes' | 'tombstones'>): Promise<void> {
  for (const table of TABLE_ORDER) {
    const rows = page.changes[table];
    if (!rows?.length) continue;
    for (const row of rows) await applyRow(tx, table, row);
  }
  for (const tombstone of page.tombstones) {
    const table = TOMBSTONE_TABLES[tombstone.table];
    if (table) await tx.delete(table).where(eq(table.uuid, tombstone.uuid));
  }
}
