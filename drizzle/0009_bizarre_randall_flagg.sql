CREATE TABLE `cash_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'efectivo' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	`sync_status` text DEFAULT 'local' NOT NULL
);
--> statement-breakpoint
-- Seed default accounts (ids 1/2 are relied on by the next migration's
-- backfill of cash_movements/direct_sales/purchase_payments).
INSERT INTO `cash_accounts` (`id`, `name`, `type`) VALUES (1, 'Efectivo', 'efectivo');
--> statement-breakpoint
INSERT INTO `cash_accounts` (`id`, `name`, `type`) VALUES (2, 'Transferencia', 'banco');
