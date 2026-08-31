ALTER TABLE `posts` ADD `images` json DEFAULT ('[]') NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `avatarImageUrl` varchar(1024);