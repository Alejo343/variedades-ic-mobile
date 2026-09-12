ALTER TABLE `products` ADD `distributor_code` text;--> statement-breakpoint
CREATE UNIQUE INDEX `products_distributor_code_unique` ON `products` (`distributor_code`);