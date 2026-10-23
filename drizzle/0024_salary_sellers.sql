CREATE TABLE `salary_payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`seller_id` integer NOT NULL,
	`period` text NOT NULL,
	`period_start` text NOT NULL,
	`amount` integer NOT NULL,
	`account_id` integer NOT NULL,
	`paid_at` text DEFAULT (current_timestamp) NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`seller_id`) REFERENCES `sellers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `cash_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "salary_payments_amount_positive" CHECK("salary_payments"."amount" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `salary_payments_uuid_unique` ON `salary_payments` (`uuid`);--> statement-breakpoint
ALTER TABLE `sellers` ADD `pay_type` text DEFAULT 'commission' NOT NULL;--> statement-breakpoint
ALTER TABLE `sellers` ADD `salary_amount` integer;--> statement-breakpoint
ALTER TABLE `sellers` ADD `salary_period` text;--> statement-breakpoint
ALTER TABLE `sellers` ADD `salary_start_date` text;