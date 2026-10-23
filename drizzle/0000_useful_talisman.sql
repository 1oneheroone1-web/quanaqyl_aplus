CREATE TABLE `attempts` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`data` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `id`)
);
--> statement-breakpoint
CREATE TABLE `awards` (
	`user_id` text NOT NULL,
	`key` text NOT NULL,
	`amount` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `key`)
);
--> statement-breakpoint
CREATE TABLE `pauses` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`start` integer NOT NULL,
	`end` integer,
	PRIMARY KEY(`user_id`, `id`)
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`photo_key` text,
	`updated_at` integer NOT NULL
);
