CREATE TABLE `notifications` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('post_comment','post_like','marketing','announcement') NOT NULL,
	`title` varchar(255) NOT NULL,
	`body` text,
	`linkUrl` varchar(1024),
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `notifyPost` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `notifyPostAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `notifyMarketing` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `notifyMarketingAt` timestamp;