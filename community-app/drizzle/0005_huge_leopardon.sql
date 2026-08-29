CREATE TABLE `authIdentities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`provider` enum('google','kakao','apple') NOT NULL,
	`providerUserId` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `authIdentities_id` PRIMARY KEY(`id`),
	CONSTRAINT `authIdentities_provider_user_unique` UNIQUE(`provider`,`providerUserId`)
);
--> statement-breakpoint
ALTER TABLE `users` DROP INDEX `users_openId_unique`;--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `openId`;