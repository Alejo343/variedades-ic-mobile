CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	`sync_status` text DEFAULT 'local' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
CREATE TABLE `inventory_movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`type` text NOT NULL,
	`quantity_delta` integer NOT NULL,
	`reason` text,
	`source_type` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`sync_status` text DEFAULT 'local' NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "quantity_delta_not_zero" CHECK("inventory_movements"."quantity_delta" <> 0)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`sku` text NOT NULL,
	`price` integer NOT NULL,
	`purchase_price` integer DEFAULT 0 NOT NULL,
	`category_id` integer,
	`stock` integer DEFAULT 0 NOT NULL,
	`min_stock` integer DEFAULT 0 NOT NULL,
	`warranty_months` integer,
	`active` integer DEFAULT true NOT NULL,
	`image_uri` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	`sync_status` text DEFAULT 'local' NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_slug_unique` ON `products` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `products_sku_unique` ON `products` (`sku`);