ALTER TABLE `direct_sales` ADD `voided_at` text;--> statement-breakpoint
ALTER TABLE `direct_sales` ADD `void_reason` text;--> statement-breakpoint
ALTER TABLE `seller_sales` ADD `voided_at` text;--> statement-breakpoint
ALTER TABLE `seller_sales` ADD `void_reason` text;