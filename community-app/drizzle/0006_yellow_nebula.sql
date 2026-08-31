CREATE TABLE `inquiries` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`category` enum('general','bug','suggestion','report_abuse','account') NOT NULL DEFAULT 'general',
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`status` enum('pending','answered') NOT NULL DEFAULT 'pending',
	`adminReply` text,
	`repliedBy` int,
	`repliedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inquiries_id` PRIMARY KEY(`id`)
);
