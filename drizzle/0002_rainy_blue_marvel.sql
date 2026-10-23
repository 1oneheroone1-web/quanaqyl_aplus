CREATE TABLE `focus_sessions` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer NOT NULL,
	`planned_ms` integer NOT NULL,
	`focus_ms` integer NOT NULL,
	`completed` integer NOT NULL,
	PRIMARY KEY(`user_id`, `id`),
	CONSTRAINT "focus_valid_duration" CHECK("focus_sessions"."focus_ms" > 0 AND "focus_sessions"."focus_ms" <= "focus_sessions"."planned_ms" AND "focus_sessions"."planned_ms" BETWEEN 60000 AND 7200000),
	CONSTRAINT "focus_valid_dates" CHECK("focus_sessions"."ended_at" >= "focus_sessions"."started_at" AND "focus_sessions"."focus_ms" <= "focus_sessions"."ended_at" - "focus_sessions"."started_at"),
	CONSTRAINT "focus_valid_completion" CHECK("focus_sessions"."completed" IN (0,1) AND ("focus_sessions"."completed" = 0 OR "focus_sessions"."focus_ms" = "focus_sessions"."planned_ms"))
);
--> statement-breakpoint
CREATE INDEX `focus_sessions_user_date` ON `focus_sessions` (`user_id`,`ended_at`);--> statement-breakpoint
CREATE TABLE `focus_timers` (
	`user_id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`revision` integer NOT NULL,
	`request_id` text NOT NULL
);
