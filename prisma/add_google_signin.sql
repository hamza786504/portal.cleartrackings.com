-- Adds the columns used by "Sign in with Google" (designers).
-- Run once on every database (local and Hostinger) via phpMyAdmin → SQL.
ALTER TABLE `users`
    ADD COLUMN `authProvider` ENUM('local', 'google') NOT NULL DEFAULT 'local' AFTER `password`,
    ADD COLUMN `googleId` VARCHAR(191) NULL AFTER `authProvider`,
    ADD UNIQUE INDEX `users_googleId_key`(`googleId`);
