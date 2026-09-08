CREATE TABLE `moderationLogs` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`targetType` enum('post','comment') NOT NULL,
	`boardId` int,
	`content` text NOT NULL,
	`reason` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `moderationLogs_id` PRIMARY KEY(`id`)
);
