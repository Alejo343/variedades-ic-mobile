CREATE TABLE `commission_payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`seller_id` integer NOT NULL,
	`period_date` text NOT NULL,
	`sale_count` integer NOT NULL,
	`total_commission` integer NOT NULL,
	`account_id` integer NOT NULL,
	`paid_at` text DEFAULT (current_timestamp) NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`sync_status` text DEFAULT 'local' NOT NULL,
	FOREIGN KEY (`seller_id`) REFERENCES `sellers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `cash_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `commission_payments_uuid_unique` ON `commission_payments` (`uuid`);--> statement-breakpoint
ALTER TABLE `direct_sales` ADD `commission_payment_id` integer REFERENCES commission_payments(id);