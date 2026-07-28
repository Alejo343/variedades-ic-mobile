CREATE TABLE `settlements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
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
CREATE UNIQUE INDEX `settlements_seller_period_unique` ON `settlements` (`seller_id`,`period_date`);--> statement-breakpoint
ALTER TABLE `seller_sales` ADD `settlement_id` integer REFERENCES settlements(id);