CREATE TABLE `sync_rejections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`op_id` text NOT NULL,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`error` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
