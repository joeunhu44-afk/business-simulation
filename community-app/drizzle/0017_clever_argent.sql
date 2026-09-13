CREATE TABLE `boardFavorites` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`boardId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `boardFavorites_id` PRIMARY KEY(`id`),
	CONSTRAINT `boardFavorites_user_board_unique` UNIQUE(`userId`,`boardId`)
);
