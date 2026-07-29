PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_cash_movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
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
INSERT INTO `__new_cash_movements`("id", "type", "amount", "concept", "movement_date", "source_type", "source_id", "account_id", "notes", "created_at", "sync_status") SELECT "id", "type", "amount", "concept", "movement_date", "source_type", "source_id", "account_id", "notes", "created_at", "sync_status" FROM `cash_movements`;--> statement-breakpoint
DROP TABLE `cash_movements`;--> statement-breakpoint
ALTER TABLE `__new_cash_movements` RENAME TO `cash_movements`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_direct_sales` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sale_date` text DEFAULT (current_timestamp) NOT NULL,
	`total_amount` integer DEFAULT 0 NOT NULL,
	`account_id` integer NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`sync_status` text DEFAULT 'local' NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `cash_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_direct_sales`("id", "sale_date", "total_amount", "account_id", "notes", "created_at", "sync_status") SELECT "id", "sale_date", "total_amount", "account_id", "notes", "created_at", "sync_status" FROM `direct_sales`;--> statement-breakpoint
DROP TABLE `direct_sales`;--> statement-breakpoint
ALTER TABLE `__new_direct_sales` RENAME TO `direct_sales`;--> statement-breakpoint
CREATE TABLE `__new_purchase_payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
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
INSERT INTO `__new_purchase_payments`("id", "purchase_order_id", "amount", "paid_at", "account_id", "notes", "created_at", "sync_status") SELECT "id", "purchase_order_id", "amount", "paid_at", "account_id", "notes", "created_at", "sync_status" FROM `purchase_payments`;--> statement-breakpoint
DROP TABLE `purchase_payments`;--> statement-breakpoint
ALTER TABLE `__new_purchase_payments` RENAME TO `purchase_payments`;