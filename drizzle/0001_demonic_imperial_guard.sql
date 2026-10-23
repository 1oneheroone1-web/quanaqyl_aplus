CREATE TABLE `shop_purchases` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`product_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price` integer NOT NULL,
	`total` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `id`),
	CONSTRAINT "shop_quantity_range" CHECK("shop_purchases"."quantity" BETWEEN 1 AND 10),
	CONSTRAINT "shop_positive_price" CHECK("shop_purchases"."unit_price" > 0),
	CONSTRAINT "shop_total_matches" CHECK("shop_purchases"."total" = "shop_purchases"."quantity" * "shop_purchases"."unit_price")
);
--> statement-breakpoint
CREATE INDEX `shop_purchases_user_date` ON `shop_purchases` (`user_id`,`created_at`);