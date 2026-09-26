CREATE TABLE `product_images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`url` text NOT NULL,
	`alt` text,
	`display_order` integer DEFAULT 0 NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	`sync_status` text DEFAULT 'local' NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_images_one_primary` ON `product_images` (`product_id`) WHERE "product_images"."is_primary" = 1;--> statement-breakpoint
-- Hand-written backfill: every product's single photo becomes its primary image
-- (added manually; the column itself is dropped in the next migration).
INSERT INTO `product_images` (`product_id`, `url`, `display_order`, `is_primary`)
SELECT `id`, `image_uri`, 0, 1 FROM `products`
WHERE `image_uri` IS NOT NULL AND `image_uri` != '';
