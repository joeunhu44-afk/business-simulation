CREATE TABLE `adBanners` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`imageUrl` varchar(1024) NOT NULL,
	`linkUrl` varchar(1024) NOT NULL,
	`position` enum('home_top','board_top') NOT NULL DEFAULT 'home_top',
	`targetBoardId` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`displayOrder` int NOT NULL DEFAULT 0,
	`clickCount` int NOT NULL DEFAULT 0,
	`impressionCount` int NOT NULL DEFAULT 0,
	`startsAt` timestamp,
	`endsAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `adBanners_id` PRIMARY KEY(`id`)
);
