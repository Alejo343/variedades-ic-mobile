ALTER TABLE `cash_movements` ADD `payment_method` text;--> statement-breakpoint
ALTER TABLE `direct_sales` ADD `payment_method` text DEFAULT 'efectivo' NOT NULL;