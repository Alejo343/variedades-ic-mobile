import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

// syncStatus is reserved for a future remote-sync phase (see CLAUDE.md) —
// not read or written by any logic yet beyond its "local" default.

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
  syncStatus: text("sync_status").notNull().default("local"),
});

export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  sku: text("sku").notNull().unique(),
  price: integer("price").notNull(),
  purchasePrice: integer("purchase_price").notNull().default(0),
  categoryId: integer("category_id").references(() => categories.id),
  stock: integer("stock").notNull().default(0),
  minStock: integer("min_stock").notNull().default(0),
  warrantyMonths: integer("warranty_months"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  imageUri: text("image_uri"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
  syncStatus: text("sync_status").notNull().default("local"),
});

// Real money accounts (e.g. "Efectivo", "Transferencia") — cash_movements,
// direct_sales and purchase_payments all reference one, so each account's
// balance (SUM of its own movements) reflects real money, not just a tag.
export const cashAccounts = sqliteTable("cash_accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  type: text("type").notNull().default("efectivo"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
  syncStatus: text("sync_status").notNull().default("local"),
});

export const sellers = sqliteTable("sellers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  phone: text("phone"),
  city: text("city"),
  commissionType: text("commission_type").notNull(),
  commissionValue: integer("commission_value").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
  syncStatus: text("sync_status").notNull().default("local"),
});

// ownerType/sellerId let the same ledger hold both the principal inventory
// and each seller's consigned inventory (Fase 4+) — sellerId is only set
// when ownerType is "seller".
export const inventoryMovements = sqliteTable(
  "inventory_movements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    type: text("type").notNull(),
    quantityDelta: integer("quantity_delta").notNull(),
    reason: text("reason"),
    sourceType: text("source_type"),
    ownerType: text("owner_type").notNull().default("principal"),
    sellerId: integer("seller_id").references(() => sellers.id),
    createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
    syncStatus: text("sync_status").notNull().default("local"),
  },
  (table) => [check("quantity_delta_not_zero", sql`${table.quantityDelta} <> 0`)],
);

// Every cash movement now always names the real account it moved money in
// or out of — accountId is NOT NULL because all sources (manual entries,
// direct sales, settlement payouts, purchase payments) require picking one.
export const cashMovements = sqliteTable(
  "cash_movements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    type: text("type").notNull(),
    amount: integer("amount").notNull(),
    concept: text("concept").notNull(),
    movementDate: text("movement_date").notNull().default(sql`(current_timestamp)`),
    sourceType: text("source_type"),
    sourceId: integer("source_id"),
    accountId: integer("account_id")
      .notNull()
      .references(() => cashAccounts.id),
    notes: text("notes"),
    createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
    syncStatus: text("sync_status").notNull().default("local"),
  },
  (table) => [check("amount_positive", sql`${table.amount} > 0`)],
);

export const directSales = sqliteTable("direct_sales", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  saleDate: text("sale_date").notNull().default(sql`(current_timestamp)`),
  totalAmount: integer("total_amount").notNull().default(0),
  accountId: integer("account_id")
    .notNull()
    .references(() => cashAccounts.id),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  syncStatus: text("sync_status").notNull().default("local"),
});

export const directSaleItems = sqliteTable(
  "direct_sale_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    saleId: integer("sale_id")
      .notNull()
      .references(() => directSales.id),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    quantity: integer("quantity").notNull(),
    unitPrice: integer("unit_price").notNull(),
    subtotal: integer("subtotal").notNull(),
  },
  (table) => [check("quantity_positive", sql`${table.quantity} > 0`), check("unit_price_not_negative", sql`${table.unitPrice} >= 0`)],
);

export const distributors = sqliteTable("distributors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  city: text("city"),
  phone: text("phone"),
  notes: text("notes"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
  syncStatus: text("sync_status").notNull().default("local"),
});

// totalCost is computed from purchase_order_items at creation (single cart
// form), not a manually-typed field — see CLAUDE.md "Alcance — Fase 8".
// No stockUpdated column: canTransitionPurchaseOrder already makes
// "recibido" terminal, which alone guards against receiving twice.
export const purchaseOrders = sqliteTable("purchase_orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  distributorId: integer("distributor_id").references(() => distributors.id),
  status: text("status").notNull().default("pendiente"),
  purchaseType: text("purchase_type").notNull().default("contado"),
  orderDate: text("order_date").notNull().default(sql`(current_timestamp)`),
  expectedDate: text("expected_date"),
  totalCost: integer("total_cost").notNull().default(0),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
  syncStatus: text("sync_status").notNull().default("local"),
});

// unitCost lives here, not on inventory_movements (which has no such
// column on mobile) — same criterion as seller_delivery_items/seller_loss_items.
export const purchaseOrderItems = sqliteTable(
  "purchase_order_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("order_id")
      .notNull()
      .references(() => purchaseOrders.id),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    quantity: integer("quantity").notNull(),
    unitCost: integer("unit_cost").notNull(),
  },
  (table) => [check("quantity_positive", sql`${table.quantity} > 0`), check("unit_cost_not_negative", sql`${table.unitCost} >= 0`)],
);

export const purchasePayments = sqliteTable(
  "purchase_payments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    purchaseOrderId: integer("purchase_order_id")
      .notNull()
      .references(() => purchaseOrders.id),
    amount: integer("amount").notNull(),
    paidAt: text("paid_at").notNull().default(sql`(current_timestamp)`),
    accountId: integer("account_id")
      .notNull()
      .references(() => cashAccounts.id),
    notes: text("notes"),
    createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
    syncStatus: text("sync_status").notNull().default("local"),
  },
  (table) => [check("amount_positive", sql`${table.amount} > 0`)],
);

export const sellerDeliveries = sqliteTable("seller_deliveries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sellerId: integer("seller_id")
    .notNull()
    .references(() => sellers.id),
  deliveryDate: text("delivery_date").notNull().default(sql`(current_timestamp)`),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  syncStatus: text("sync_status").notNull().default("local"),
});

export const sellerDeliveryItems = sqliteTable(
  "seller_delivery_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    deliveryId: integer("delivery_id")
      .notNull()
      .references(() => sellerDeliveries.id),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    quantity: integer("quantity").notNull(),
    unitCost: integer("unit_cost").notNull(),
  },
  (table) => [check("quantity_positive", sql`${table.quantity} > 0`), check("unit_cost_not_negative", sql`${table.unitCost} >= 0`)],
);

export const sellerReturns = sqliteTable("seller_returns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sellerId: integer("seller_id")
    .notNull()
    .references(() => sellers.id),
  returnDate: text("return_date").notNull().default(sql`(current_timestamp)`),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  syncStatus: text("sync_status").notNull().default("local"),
});

// No price/cost — a return isn't a monetary transaction, just units moving
// from the seller's consigned inventory back into the principal one.
export const sellerReturnItems = sqliteTable(
  "seller_return_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    returnId: integer("return_id")
      .notNull()
      .references(() => sellerReturns.id),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    quantity: integer("quantity").notNull(),
  },
  (table) => [check("quantity_positive", sql`${table.quantity} > 0`)],
);

// type lives on the header (perdida/dano/robo) — one loss report is a single
// incident, same criterion as direct_sales/seller_deliveries/seller_sales
// keeping transaction-level attributes out of the item rows.
export const sellerLosses = sqliteTable("seller_losses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sellerId: integer("seller_id")
    .notNull()
    .references(() => sellers.id),
  type: text("type").notNull(),
  lossDate: text("loss_date").notNull().default(sql`(current_timestamp)`),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  syncStatus: text("sync_status").notNull().default("local"),
});

export const sellerLossItems = sqliteTable(
  "seller_loss_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    lossId: integer("loss_id")
      .notNull()
      .references(() => sellerLosses.id),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    quantity: integer("quantity").notNull(),
    unitCost: integer("unit_cost").notNull(),
  },
  (table) => [check("quantity_positive", sql`${table.quantity} > 0`), check("unit_cost_not_negative", sql`${table.unitCost} >= 0`)],
);

// periodDate is a plain 'YYYY-MM-DD' string (no time) — settlements-repo
// compares it against saleDate/lossDate (full timestamps) via SQLite's
// DATE(...) to extract just the date part.
export const settlements = sqliteTable(
  "settlements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sellerId: integer("seller_id")
      .notNull()
      .references(() => sellers.id),
    periodDate: text("period_date").notNull(),
    totalSales: integer("total_sales").notNull(),
    totalCommission: integer("total_commission").notNull(),
    totalLosses: integer("total_losses").notNull(),
    amountDue: integer("amount_due").notNull(),
    status: text("status").notNull().default("pendiente"),
    settledAt: text("settled_at"),
    createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
    syncStatus: text("sync_status").notNull().default("local"),
  },
  (table) => [unique("settlements_seller_period_unique").on(table.sellerId, table.periodDate)],
);

// settlementId was deferred until this phase (added now that `settlements`
// exists), same pattern as ownerType/sellerId being added to
// inventory_movements in Fase 4 once `sellers` existed.
export const sellerSales = sqliteTable("seller_sales", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sellerId: integer("seller_id")
    .notNull()
    .references(() => sellers.id),
  saleDate: text("sale_date").notNull().default(sql`(current_timestamp)`),
  totalAmount: integer("total_amount").notNull().default(0),
  commissionAmount: integer("commission_amount").notNull().default(0),
  settlementId: integer("settlement_id").references(() => settlements.id),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  syncStatus: text("sync_status").notNull().default("local"),
});

export const sellerSaleItems = sqliteTable(
  "seller_sale_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    saleId: integer("sale_id")
      .notNull()
      .references(() => sellerSales.id),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    quantity: integer("quantity").notNull(),
    unitPrice: integer("unit_price").notNull(),
    subtotal: integer("subtotal").notNull(),
  },
  (table) => [check("quantity_positive", sql`${table.quantity} > 0`), check("unit_price_not_negative", sql`${table.unitPrice} >= 0`)],
);
