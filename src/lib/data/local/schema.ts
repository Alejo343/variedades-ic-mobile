import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
    createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
    syncStatus: text("sync_status").notNull().default("local"),
  },
  (table) => [check("quantity_delta_not_zero", sql`${table.quantityDelta} <> 0`)],
);

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
