ALTER TABLE `users` ADD `termsAgreedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `termsVersion` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD `privacyAgreedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `privacyVersion` varchar(32);