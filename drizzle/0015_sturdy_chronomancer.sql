ALTER TABLE `cash_accounts` ADD `uuid` text;--> statement-breakpoint
CREATE UNIQUE INDEX `cash_accounts_uuid_unique` ON `cash_accounts` (`uuid`);--> statement-breakpoint
ALTER TABLE `cash_movements` ADD `uuid` text;--> statement-breakpoint
CREATE UNIQUE INDEX `cash_movements_uuid_unique` ON `cash_movements` (`uuid`);--> statement-breakpoint
ALTER TABLE `categories` ADD `uuid` text;--> statement-breakpoint
CREATE UNIQUE INDEX `categories_uuid_unique` ON `categories` (`uuid`);--> statement-breakpoint
ALTER TABLE `direct_sale_items` ADD `uuid` text;--> statement-breakpoint
CREATE UNIQUE INDEX `direct_sale_items_uuid_unique` ON `direct_sale_items` (`uuid`);--> statement-breakpoint
ALTER TABLE `direct_sales` ADD `uuid` text;--> statement-breakpoint
CREATE UNIQUE INDEX `direct_sales_uuid_unique` ON `direct_sales` (`uuid`);--> statement-breakpoint
ALTER TABLE `distributors` ADD `uuid` text;--> statement-breakpoint
CREATE UNIQUE INDEX `distributors_uuid_unique` ON `distributors` (`uuid`);--> statement-breakpoint
ALTER TABLE `inventory_movements` ADD `uuid` text;--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_movements_uuid_unique` ON `inventory_movements` (`uuid`);--> statement-breakpoint
ALTER TABLE `product_images` ADD `uuid` text;--> statement-breakpoint
CREATE UNIQUE INDEX `product_images_uuid_unique` ON `product_images` (`uuid`);--> statement-breakpoint
ALTER TABLE `products` ADD `uuid` text;--> statement-breakpoint
CREATE UNIQUE INDEX `products_uuid_unique` ON `products` (`uuid`);--> statement-breakpoint
ALTER TABLE `purchase_order_items` ADD `uuid` text;--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_order_items_uuid_unique` ON `purchase_order_items` (`uuid`);--> statement-breakpoint
ALTER TABLE `purchase_orders` ADD `uuid` text;--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_orders_uuid_unique` ON `purchase_orders` (`uuid`);--> statement-breakpoint
ALTER TABLE `purchase_payments` ADD `uuid` text;--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_payments_uuid_unique` ON `purchase_payments` (`uuid`);--> statement-breakpoint
ALTER TABLE `seller_deliveries` ADD `uuid` text;--> statement-breakpoint
CREATE UNIQUE INDEX `seller_deliveries_uuid_unique` ON `seller_deliveries` (`uuid`);--> statement-breakpoint
ALTER TABLE `seller_delivery_items` ADD `uuid` text;--> statement-breakpoint
CREATE UNIQUE INDEX `seller_delivery_items_uuid_unique` ON `seller_delivery_items` (`uuid`);--> statement-breakpoint
ALTER TABLE `seller_loss_items` ADD `uuid` text;--> statement-breakpoint
CREATE UNIQUE INDEX `seller_loss_items_uuid_unique` ON `seller_loss_items` (`uuid`);--> statement-breakpoint
ALTER TABLE `seller_losses` ADD `uuid` text;--> statement-breakpoint
CREATE UNIQUE INDEX `seller_losses_uuid_unique` ON `seller_losses` (`uuid`);--> statement-breakpoint
ALTER TABLE `seller_return_items` ADD `uuid` text;--> statement-breakpoint
CREATE UNIQUE INDEX `seller_return_items_uuid_unique` ON `seller_return_items` (`uuid`);--> statement-breakpoint
ALTER TABLE `seller_returns` ADD `uuid` text;--> statement-breakpoint
CREATE UNIQUE INDEX `seller_returns_uuid_unique` ON `seller_returns` (`uuid`);--> statement-breakpoint
ALTER TABLE `seller_sale_items` ADD `uuid` text;--> statement-breakpoint
CREATE UNIQUE INDEX `seller_sale_items_uuid_unique` ON `seller_sale_items` (`uuid`);--> statement-breakpoint
ALTER TABLE `seller_sales` ADD `uuid` text;--> statement-breakpoint
CREATE UNIQUE INDEX `seller_sales_uuid_unique` ON `seller_sales` (`uuid`);--> statement-breakpoint
ALTER TABLE `sellers` ADD `uuid` text;--> statement-breakpoint
CREATE UNIQUE INDEX `sellers_uuid_unique` ON `sellers` (`uuid`);--> statement-breakpoint
ALTER TABLE `settlements` ADD `uuid` text;--> statement-breakpoint
CREATE UNIQUE INDEX `settlements_uuid_unique` ON `settlements` (`uuid`);--> statement-breakpoint
-- Hand-added backfill: a random v4 UUID for every existing row (randomblob is
-- evaluated per row). 0016 then makes the column NOT NULL.
UPDATE `cash_accounts` SET `uuid` = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE `uuid` IS NULL;
--> statement-breakpoint
UPDATE `cash_movements` SET `uuid` = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE `uuid` IS NULL;
--> statement-breakpoint
UPDATE `categories` SET `uuid` = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE `uuid` IS NULL;
--> statement-breakpoint
UPDATE `direct_sale_items` SET `uuid` = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE `uuid` IS NULL;
--> statement-breakpoint
UPDATE `direct_sales` SET `uuid` = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE `uuid` IS NULL;
--> statement-breakpoint
UPDATE `distributors` SET `uuid` = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE `uuid` IS NULL;
--> statement-breakpoint
UPDATE `inventory_movements` SET `uuid` = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE `uuid` IS NULL;
--> statement-breakpoint
UPDATE `product_images` SET `uuid` = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE `uuid` IS NULL;
--> statement-breakpoint
UPDATE `products` SET `uuid` = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE `uuid` IS NULL;
--> statement-breakpoint
UPDATE `purchase_order_items` SET `uuid` = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE `uuid` IS NULL;
--> statement-breakpoint
UPDATE `purchase_orders` SET `uuid` = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE `uuid` IS NULL;
--> statement-breakpoint
UPDATE `purchase_payments` SET `uuid` = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE `uuid` IS NULL;
--> statement-breakpoint
UPDATE `seller_deliveries` SET `uuid` = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE `uuid` IS NULL;
--> statement-breakpoint
UPDATE `seller_delivery_items` SET `uuid` = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE `uuid` IS NULL;
--> statement-breakpoint
UPDATE `seller_loss_items` SET `uuid` = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE `uuid` IS NULL;
--> statement-breakpoint
UPDATE `seller_losses` SET `uuid` = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE `uuid` IS NULL;
--> statement-breakpoint
UPDATE `seller_return_items` SET `uuid` = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE `uuid` IS NULL;
--> statement-breakpoint
UPDATE `seller_returns` SET `uuid` = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE `uuid` IS NULL;
--> statement-breakpoint
UPDATE `seller_sale_items` SET `uuid` = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE `uuid` IS NULL;
--> statement-breakpoint
UPDATE `seller_sales` SET `uuid` = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE `uuid` IS NULL;
--> statement-breakpoint
UPDATE `sellers` SET `uuid` = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE `uuid` IS NULL;
--> statement-breakpoint
UPDATE `settlements` SET `uuid` = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE `uuid` IS NULL;
