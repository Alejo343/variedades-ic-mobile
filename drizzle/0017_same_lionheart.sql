ALTER TABLE `seller_losses` ADD `settlement_id` integer REFERENCES settlements(id);--> statement-breakpoint
-- Hand-added backfill: losses already charged by an existing settlement (the
-- old rule: same seller, same day) get linked to it, so the new rule (every
-- pending loss up to the settlement date) never charges them again.
UPDATE `seller_losses` SET `settlement_id` = (SELECT s.`id` FROM `settlements` s WHERE s.`seller_id` = `seller_losses`.`seller_id` AND s.`period_date` = DATE(`seller_losses`.`loss_date`)) WHERE `settlement_id` IS NULL;
