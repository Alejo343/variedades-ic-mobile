ALTER TABLE `cash_movements` ADD `account_id` integer REFERENCES cash_accounts(id);--> statement-breakpoint
ALTER TABLE `direct_sales` ADD `account_id` integer REFERENCES cash_accounts(id);--> statement-breakpoint
ALTER TABLE `purchase_payments` ADD `account_id` integer REFERENCES cash_accounts(id);--> statement-breakpoint
-- Backfill: map the old free-text payment_method/method columns to the
-- seeded accounts (1 = Efectivo, 2 = Transferencia). Anything that doesn't
-- match exactly (NULL, or free text typed into purchase_payments.method)
-- defaults to Efectivo — acceptable because current on-device data is test
-- data (confirmed with the user before writing this migration).
UPDATE `cash_movements` SET `account_id` = 2 WHERE `payment_method` = 'transferencia';--> statement-breakpoint
UPDATE `cash_movements` SET `account_id` = 1 WHERE `account_id` IS NULL;--> statement-breakpoint
UPDATE `direct_sales` SET `account_id` = 2 WHERE `payment_method` = 'transferencia';--> statement-breakpoint
UPDATE `direct_sales` SET `account_id` = 1 WHERE `account_id` IS NULL;--> statement-breakpoint
UPDATE `purchase_payments` SET `account_id` = 2 WHERE `method` = 'transferencia';--> statement-breakpoint
UPDATE `purchase_payments` SET `account_id` = 1 WHERE `account_id` IS NULL;