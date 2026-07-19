CREATE TABLE `cash_movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`concept` text NOT NULL,
	`movement_date` text DEFAULT (current_timestamp) NOT NULL,
	`source_type` text,
	`source_id` integer,
	`notes` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`sync_status` text DEFAULT 'local' NOT NULL,
	CONSTRAINT "amount_positive" CHECK("cash_movements"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE `direct_sale_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sale_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price` integer NOT NULL,
	`subtotal` integer NOT NULL,
	FOREIGN KEY (`sale_id`) REFERENCES `direct_sales`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "quantity_positive" CHECK("direct_sale_items"."quantity" > 0),
	CONSTRAINT "unit_price_not_negative" CHECK("direct_sale_items"."unit_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE `direct_sales` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sale_date` text DEFAULT (current_timestamp) NOT NULL,
	`total_amount` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`sync_status` text DEFAULT 'local' NOT NULL
);
