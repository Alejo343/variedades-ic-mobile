PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_cash_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'efectivo' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	`sync_status` text DEFAULT 'local' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_cash_accounts`("id", "uuid", "name", "type", "active", "notes", "created_at", "updated_at", "sync_status") SELECT "id", "uuid", "name", "type", "active", "notes", "created_at", "updated_at", "sync_status" FROM `cash_accounts`;--> statement-breakpoint
DROP TABLE `cash_accounts`;--> statement-breakpoint
ALTER TABLE `__new_cash_accounts` RENAME TO `cash_accounts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `cash_accounts_uuid_unique` ON `cash_accounts` (`uuid`);--> statement-breakpoint
CREATE TABLE `__new_cash_movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`concept` text NOT NULL,
	`movement_date` text DEFAULT (current_timestamp) NOT NULL,
	`source_type` text,
	`source_id` integer,
	`account_id` integer NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`sync_status` text DEFAULT 'local' NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `cash_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "amount_positive" CHECK("__new_cash_movements"."amount" > 0)
);
--> statement-breakpoint
INSERT INTO `__new_cash_movements`("id", "uuid", "type", "amount", "concept", "movement_date", "source_type", "source_id", "account_id", "notes", "created_at", "sync_status") SELECT "id", "uuid", "type", "amount", "concept", "movement_date", "source_type", "source_id", "account_id", "notes", "created_at", "sync_status" FROM `cash_movements`;--> statement-breakpoint
DROP TABLE `cash_movements`;--> statement-breakpoint
ALTER TABLE `__new_cash_movements` RENAME TO `cash_movements`;--> statement-breakpoint
CREATE UNIQUE INDEX `cash_movements_uuid_unique` ON `cash_movements` (`uuid`);--> statement-breakpoint
CREATE TABLE `__new_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	`sync_status` text DEFAULT 'local' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_categories`("id", "uuid", "name", "slug", "description", "active", "created_at", "updated_at", "sync_status") SELECT "id", "uuid", "name", "slug", "description", "active", "created_at", "updated_at", "sync_status" FROM `categories`;--> statement-breakpoint
DROP TABLE `categories`;--> statement-breakpoint
ALTER TABLE `__new_categories` RENAME TO `categories`;--> statement-breakpoint
CREATE UNIQUE INDEX `categories_uuid_unique` ON `categories` (`uuid`);--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
CREATE TABLE `__new_direct_sale_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`sale_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price` integer NOT NULL,
	`subtotal` integer NOT NULL,
	FOREIGN KEY (`sale_id`) REFERENCES `direct_sales`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "quantity_positive" CHECK("__new_direct_sale_items"."quantity" > 0),
	CONSTRAINT "unit_price_not_negative" CHECK("__new_direct_sale_items"."unit_price" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_direct_sale_items`("id", "uuid", "sale_id", "product_id", "quantity", "unit_price", "subtotal") SELECT "id", "uuid", "sale_id", "product_id", "quantity", "unit_price", "subtotal" FROM `direct_sale_items`;--> statement-breakpoint
DROP TABLE `direct_sale_items`;--> statement-breakpoint
ALTER TABLE `__new_direct_sale_items` RENAME TO `direct_sale_items`;--> statement-breakpoint
CREATE UNIQUE INDEX `direct_sale_items_uuid_unique` ON `direct_sale_items` (`uuid`);--> statement-breakpoint
CREATE TABLE `__new_direct_sales` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`sale_date` text DEFAULT (current_timestamp) NOT NULL,
	`total_amount` integer DEFAULT 0 NOT NULL,
	`account_id` integer NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`sync_status` text DEFAULT 'local' NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `cash_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_direct_sales`("id", "uuid", "sale_date", "total_amount", "account_id", "notes", "created_at", "sync_status") SELECT "id", "uuid", "sale_date", "total_amount", "account_id", "notes", "created_at", "sync_status" FROM `direct_sales`;--> statement-breakpoint
DROP TABLE `direct_sales`;--> statement-breakpoint
ALTER TABLE `__new_direct_sales` RENAME TO `direct_sales`;--> statement-breakpoint
CREATE UNIQUE INDEX `direct_sales_uuid_unique` ON `direct_sales` (`uuid`);--> statement-breakpoint
CREATE TABLE `__new_distributors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`name` text NOT NULL,
	`city` text,
	`phone` text,
	`notes` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	`sync_status` text DEFAULT 'local' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_distributors`("id", "uuid", "name", "city", "phone", "notes", "active", "created_at", "updated_at", "sync_status") SELECT "id", "uuid", "name", "city", "phone", "notes", "active", "created_at", "updated_at", "sync_status" FROM `distributors`;--> statement-breakpoint
DROP TABLE `distributors`;--> statement-breakpoint
ALTER TABLE `__new_distributors` RENAME TO `distributors`;--> statement-breakpoint
CREATE UNIQUE INDEX `distributors_uuid_unique` ON `distributors` (`uuid`);--> statement-breakpoint
CREATE TABLE `__new_inventory_movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`product_id` integer NOT NULL,
	`type` text NOT NULL,
	`quantity_delta` integer NOT NULL,
	`reason` text,
	`source_type` text,
	`owner_type` text DEFAULT 'principal' NOT NULL,
	`seller_id` integer,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`sync_status` text DEFAULT 'local' NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`seller_id`) REFERENCES `sellers`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "quantity_delta_not_zero" CHECK("__new_inventory_movements"."quantity_delta" <> 0)
);
--> statement-breakpoint
INSERT INTO `__new_inventory_movements`("id", "uuid", "product_id", "type", "quantity_delta", "reason", "source_type", "owner_type", "seller_id", "created_at", "sync_status") SELECT "id", "uuid", "product_id", "type", "quantity_delta", "reason", "source_type", "owner_type", "seller_id", "created_at", "sync_status" FROM `inventory_movements`;--> statement-breakpoint
DROP TABLE `inventory_movements`;--> statement-breakpoint
ALTER TABLE `__new_inventory_movements` RENAME TO `inventory_movements`;--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_movements_uuid_unique` ON `inventory_movements` (`uuid`);--> statement-breakpoint
CREATE TABLE `__new_product_images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`product_id` integer NOT NULL,
	`url` text NOT NULL,
	`alt` text,
	`display_order` integer DEFAULT 0 NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	`sync_status` text DEFAULT 'local' NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_product_images`("id", "uuid", "product_id", "url", "alt", "display_order", "is_primary", "created_at", "updated_at", "sync_status") SELECT "id", "uuid", "product_id", "url", "alt", "display_order", "is_primary", "created_at", "updated_at", "sync_status" FROM `product_images`;--> statement-breakpoint
DROP TABLE `product_images`;--> statement-breakpoint
ALTER TABLE `__new_product_images` RENAME TO `product_images`;--> statement-breakpoint
CREATE UNIQUE INDEX `product_images_uuid_unique` ON `product_images` (`uuid`);--> statement-breakpoint
CREATE UNIQUE INDEX `product_images_one_primary` ON `product_images` (`product_id`) WHERE "product_images"."is_primary" = 1;--> statement-breakpoint
CREATE TABLE `__new_products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`sku` text NOT NULL,
	`price` integer NOT NULL,
	`purchase_price` integer DEFAULT 0 NOT NULL,
	`category_id` integer,
	`distributor_code` text,
	`stock` integer DEFAULT 0 NOT NULL,
	`min_stock` integer DEFAULT 0 NOT NULL,
	`warranty_months` integer,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	`sync_status` text DEFAULT 'local' NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_products`("id", "uuid", "name", "slug", "description", "sku", "price", "purchase_price", "category_id", "distributor_code", "stock", "min_stock", "warranty_months", "active", "created_at", "updated_at", "sync_status") SELECT "id", "uuid", "name", "slug", "description", "sku", "price", "purchase_price", "category_id", "distributor_code", "stock", "min_stock", "warranty_months", "active", "created_at", "updated_at", "sync_status" FROM `products`;--> statement-breakpoint
DROP TABLE `products`;--> statement-breakpoint
ALTER TABLE `__new_products` RENAME TO `products`;--> statement-breakpoint
CREATE UNIQUE INDEX `products_uuid_unique` ON `products` (`uuid`);--> statement-breakpoint
CREATE UNIQUE INDEX `products_slug_unique` ON `products` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `products_sku_unique` ON `products` (`sku`);--> statement-breakpoint
CREATE UNIQUE INDEX `products_distributor_code_unique` ON `products` (`distributor_code`);--> statement-breakpoint
CREATE TABLE `__new_purchase_order_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`order_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`quantity` integer NOT NULL,
	`unit_cost` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "quantity_positive" CHECK("__new_purchase_order_items"."quantity" > 0),
	CONSTRAINT "unit_cost_not_negative" CHECK("__new_purchase_order_items"."unit_cost" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_purchase_order_items`("id", "uuid", "order_id", "product_id", "quantity", "unit_cost") SELECT "id", "uuid", "order_id", "product_id", "quantity", "unit_cost" FROM `purchase_order_items`;--> statement-breakpoint
DROP TABLE `purchase_order_items`;--> statement-breakpoint
ALTER TABLE `__new_purchase_order_items` RENAME TO `purchase_order_items`;--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_order_items_uuid_unique` ON `purchase_order_items` (`uuid`);--> statement-breakpoint
CREATE TABLE `__new_purchase_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`distributor_id` integer,
	`status` text DEFAULT 'pendiente' NOT NULL,
	`purchase_type` text DEFAULT 'contado' NOT NULL,
	`order_date` text DEFAULT (current_timestamp) NOT NULL,
	`expected_date` text,
	`total_cost` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	`sync_status` text DEFAULT 'local' NOT NULL,
	FOREIGN KEY (`distributor_id`) REFERENCES `distributors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_purchase_orders`("id", "uuid", "distributor_id", "status", "purchase_type", "order_date", "expected_date", "total_cost", "notes", "created_at", "updated_at", "sync_status") SELECT "id", "uuid", "distributor_id", "status", "purchase_type", "order_date", "expected_date", "total_cost", "notes", "created_at", "updated_at", "sync_status" FROM `purchase_orders`;--> statement-breakpoint
DROP TABLE `purchase_orders`;--> statement-breakpoint
ALTER TABLE `__new_purchase_orders` RENAME TO `purchase_orders`;--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_orders_uuid_unique` ON `purchase_orders` (`uuid`);--> statement-breakpoint
CREATE TABLE `__new_purchase_payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`purchase_order_id` integer NOT NULL,
	`amount` integer NOT NULL,
	`paid_at` text DEFAULT (current_timestamp) NOT NULL,
	`account_id` integer NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`sync_status` text DEFAULT 'local' NOT NULL,
	FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `cash_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "amount_positive" CHECK("__new_purchase_payments"."amount" > 0)
);
--> statement-breakpoint
INSERT INTO `__new_purchase_payments`("id", "uuid", "purchase_order_id", "amount", "paid_at", "account_id", "notes", "created_at", "sync_status") SELECT "id", "uuid", "purchase_order_id", "amount", "paid_at", "account_id", "notes", "created_at", "sync_status" FROM `purchase_payments`;--> statement-breakpoint
DROP TABLE `purchase_payments`;--> statement-breakpoint
ALTER TABLE `__new_purchase_payments` RENAME TO `purchase_payments`;--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_payments_uuid_unique` ON `purchase_payments` (`uuid`);--> statement-breakpoint
CREATE TABLE `__new_seller_deliveries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`seller_id` integer NOT NULL,
	`delivery_date` text DEFAULT (current_timestamp) NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`sync_status` text DEFAULT 'local' NOT NULL,
	FOREIGN KEY (`seller_id`) REFERENCES `sellers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_seller_deliveries`("id", "uuid", "seller_id", "delivery_date", "notes", "created_at", "sync_status") SELECT "id", "uuid", "seller_id", "delivery_date", "notes", "created_at", "sync_status" FROM `seller_deliveries`;--> statement-breakpoint
DROP TABLE `seller_deliveries`;--> statement-breakpoint
ALTER TABLE `__new_seller_deliveries` RENAME TO `seller_deliveries`;--> statement-breakpoint
CREATE UNIQUE INDEX `seller_deliveries_uuid_unique` ON `seller_deliveries` (`uuid`);--> statement-breakpoint
CREATE TABLE `__new_seller_delivery_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`delivery_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`quantity` integer NOT NULL,
	`unit_cost` integer NOT NULL,
	FOREIGN KEY (`delivery_id`) REFERENCES `seller_deliveries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "quantity_positive" CHECK("__new_seller_delivery_items"."quantity" > 0),
	CONSTRAINT "unit_cost_not_negative" CHECK("__new_seller_delivery_items"."unit_cost" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_seller_delivery_items`("id", "uuid", "delivery_id", "product_id", "quantity", "unit_cost") SELECT "id", "uuid", "delivery_id", "product_id", "quantity", "unit_cost" FROM `seller_delivery_items`;--> statement-breakpoint
DROP TABLE `seller_delivery_items`;--> statement-breakpoint
ALTER TABLE `__new_seller_delivery_items` RENAME TO `seller_delivery_items`;--> statement-breakpoint
CREATE UNIQUE INDEX `seller_delivery_items_uuid_unique` ON `seller_delivery_items` (`uuid`);--> statement-breakpoint
CREATE TABLE `__new_seller_loss_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`loss_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`quantity` integer NOT NULL,
	`unit_cost` integer NOT NULL,
	FOREIGN KEY (`loss_id`) REFERENCES `seller_losses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "quantity_positive" CHECK("__new_seller_loss_items"."quantity" > 0),
	CONSTRAINT "unit_cost_not_negative" CHECK("__new_seller_loss_items"."unit_cost" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_seller_loss_items`("id", "uuid", "loss_id", "product_id", "quantity", "unit_cost") SELECT "id", "uuid", "loss_id", "product_id", "quantity", "unit_cost" FROM `seller_loss_items`;--> statement-breakpoint
DROP TABLE `seller_loss_items`;--> statement-breakpoint
ALTER TABLE `__new_seller_loss_items` RENAME TO `seller_loss_items`;--> statement-breakpoint
CREATE UNIQUE INDEX `seller_loss_items_uuid_unique` ON `seller_loss_items` (`uuid`);--> statement-breakpoint
CREATE TABLE `__new_seller_losses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`seller_id` integer NOT NULL,
	`type` text NOT NULL,
	`loss_date` text DEFAULT (current_timestamp) NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`sync_status` text DEFAULT 'local' NOT NULL,
	FOREIGN KEY (`seller_id`) REFERENCES `sellers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_seller_losses`("id", "uuid", "seller_id", "type", "loss_date", "notes", "created_at", "sync_status") SELECT "id", "uuid", "seller_id", "type", "loss_date", "notes", "created_at", "sync_status" FROM `seller_losses`;--> statement-breakpoint
DROP TABLE `seller_losses`;--> statement-breakpoint
ALTER TABLE `__new_seller_losses` RENAME TO `seller_losses`;--> statement-breakpoint
CREATE UNIQUE INDEX `seller_losses_uuid_unique` ON `seller_losses` (`uuid`);--> statement-breakpoint
CREATE TABLE `__new_seller_return_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`return_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`quantity` integer NOT NULL,
	FOREIGN KEY (`return_id`) REFERENCES `seller_returns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "quantity_positive" CHECK("__new_seller_return_items"."quantity" > 0)
);
--> statement-breakpoint
INSERT INTO `__new_seller_return_items`("id", "uuid", "return_id", "product_id", "quantity") SELECT "id", "uuid", "return_id", "product_id", "quantity" FROM `seller_return_items`;--> statement-breakpoint
DROP TABLE `seller_return_items`;--> statement-breakpoint
ALTER TABLE `__new_seller_return_items` RENAME TO `seller_return_items`;--> statement-breakpoint
CREATE UNIQUE INDEX `seller_return_items_uuid_unique` ON `seller_return_items` (`uuid`);--> statement-breakpoint
CREATE TABLE `__new_seller_returns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`seller_id` integer NOT NULL,
	`return_date` text DEFAULT (current_timestamp) NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`sync_status` text DEFAULT 'local' NOT NULL,
	FOREIGN KEY (`seller_id`) REFERENCES `sellers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_seller_returns`("id", "uuid", "seller_id", "return_date", "notes", "created_at", "sync_status") SELECT "id", "uuid", "seller_id", "return_date", "notes", "created_at", "sync_status" FROM `seller_returns`;--> statement-breakpoint
DROP TABLE `seller_returns`;--> statement-breakpoint
ALTER TABLE `__new_seller_returns` RENAME TO `seller_returns`;--> statement-breakpoint
CREATE UNIQUE INDEX `seller_returns_uuid_unique` ON `seller_returns` (`uuid`);--> statement-breakpoint
CREATE TABLE `__new_seller_sale_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`sale_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price` integer NOT NULL,
	`subtotal` integer NOT NULL,
	FOREIGN KEY (`sale_id`) REFERENCES `seller_sales`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "quantity_positive" CHECK("__new_seller_sale_items"."quantity" > 0),
	CONSTRAINT "unit_price_not_negative" CHECK("__new_seller_sale_items"."unit_price" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_seller_sale_items`("id", "uuid", "sale_id", "product_id", "quantity", "unit_price", "subtotal") SELECT "id", "uuid", "sale_id", "product_id", "quantity", "unit_price", "subtotal" FROM `seller_sale_items`;--> statement-breakpoint
DROP TABLE `seller_sale_items`;--> statement-breakpoint
ALTER TABLE `__new_seller_sale_items` RENAME TO `seller_sale_items`;--> statement-breakpoint
CREATE UNIQUE INDEX `seller_sale_items_uuid_unique` ON `seller_sale_items` (`uuid`);--> statement-breakpoint
CREATE TABLE `__new_seller_sales` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`seller_id` integer NOT NULL,
	`sale_date` text DEFAULT (current_timestamp) NOT NULL,
	`total_amount` integer DEFAULT 0 NOT NULL,
	`commission_amount` integer DEFAULT 0 NOT NULL,
	`settlement_id` integer,
	`notes` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`sync_status` text DEFAULT 'local' NOT NULL,
	FOREIGN KEY (`seller_id`) REFERENCES `sellers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_seller_sales`("id", "uuid", "seller_id", "sale_date", "total_amount", "commission_amount", "settlement_id", "notes", "created_at", "sync_status") SELECT "id", "uuid", "seller_id", "sale_date", "total_amount", "commission_amount", "settlement_id", "notes", "created_at", "sync_status" FROM `seller_sales`;--> statement-breakpoint
DROP TABLE `seller_sales`;--> statement-breakpoint
ALTER TABLE `__new_seller_sales` RENAME TO `seller_sales`;--> statement-breakpoint
CREATE UNIQUE INDEX `seller_sales_uuid_unique` ON `seller_sales` (`uuid`);--> statement-breakpoint
CREATE TABLE `__new_sellers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`city` text,
	`commission_type` text NOT NULL,
	`commission_value` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	`sync_status` text DEFAULT 'local' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_sellers`("id", "uuid", "name", "phone", "city", "commission_type", "commission_value", "active", "notes", "created_at", "updated_at", "sync_status") SELECT "id", "uuid", "name", "phone", "city", "commission_type", "commission_value", "active", "notes", "created_at", "updated_at", "sync_status" FROM `sellers`;--> statement-breakpoint
DROP TABLE `sellers`;--> statement-breakpoint
ALTER TABLE `__new_sellers` RENAME TO `sellers`;--> statement-breakpoint
CREATE UNIQUE INDEX `sellers_uuid_unique` ON `sellers` (`uuid`);--> statement-breakpoint
CREATE TABLE `__new_settlements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`seller_id` integer NOT NULL,
	`period_date` text NOT NULL,
	`total_sales` integer NOT NULL,
	`total_commission` integer NOT NULL,
	`total_losses` integer NOT NULL,
	`amount_due` integer NOT NULL,
	`status` text DEFAULT 'pendiente' NOT NULL,
	`settled_at` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`sync_status` text DEFAULT 'local' NOT NULL,
	FOREIGN KEY (`seller_id`) REFERENCES `sellers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_settlements`("id", "uuid", "seller_id", "period_date", "total_sales", "total_commission", "total_losses", "amount_due", "status", "settled_at", "created_at", "sync_status") SELECT "id", "uuid", "seller_id", "period_date", "total_sales", "total_commission", "total_losses", "amount_due", "status", "settled_at", "created_at", "sync_status" FROM `settlements`;--> statement-breakpoint
DROP TABLE `settlements`;--> statement-breakpoint
ALTER TABLE `__new_settlements` RENAME TO `settlements`;--> statement-breakpoint
CREATE UNIQUE INDEX `settlements_uuid_unique` ON `settlements` (`uuid`);--> statement-breakpoint
CREATE UNIQUE INDEX `settlements_seller_period_unique` ON `settlements` (`seller_id`,`period_date`);