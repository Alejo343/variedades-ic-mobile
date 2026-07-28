CREATE TABLE `seller_deliveries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`seller_id` integer NOT NULL,
	`delivery_date` text DEFAULT (current_timestamp) NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`sync_status` text DEFAULT 'local' NOT NULL,
	FOREIGN KEY (`seller_id`) REFERENCES `sellers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `seller_delivery_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`delivery_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`quantity` integer NOT NULL,
	`unit_cost` integer NOT NULL,
	FOREIGN KEY (`delivery_id`) REFERENCES `seller_deliveries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "quantity_positive" CHECK("seller_delivery_items"."quantity" > 0),
	CONSTRAINT "unit_cost_not_negative" CHECK("seller_delivery_items"."unit_cost" >= 0)
);
--> statement-breakpoint
ALTER TABLE `inventory_movements` ADD `owner_type` text DEFAULT 'principal' NOT NULL;--> statement-breakpoint
ALTER TABLE `inventory_movements` ADD `seller_id` integer REFERENCES sellers(id);