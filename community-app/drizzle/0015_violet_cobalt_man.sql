ALTER TABLE `users` MODIFY COLUMN `status` enum('active','blocked','pending') NOT NULL DEFAULT 'active';--> statement-breakpoint
ALTER TABLE `users` ADD `approvalNote` varchar(255);