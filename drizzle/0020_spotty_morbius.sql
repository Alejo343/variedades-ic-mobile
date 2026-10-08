ALTER TABLE `direct_sales` ADD `seller_id` integer REFERENCES sellers(id);--> statement-breakpoint
ALTER TABLE `direct_sales` ADD `commission_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sellers` ADD `inventory_mode` text DEFAULT 'consignment' NOT NULL;