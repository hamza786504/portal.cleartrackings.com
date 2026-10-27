-- Adds the table behind the admin dashboard notification bell.
-- Run once on every database (local and Hostinger) via phpMyAdmin → SQL.
CREATE TABLE `admin_notifications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `caseId` INTEGER NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `admin_notifications_isRead_createdAt_idx`(`isRead`, `createdAt`),
    INDEX `admin_notifications_caseId_fkey`(`caseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `admin_notifications` ADD CONSTRAINT `admin_notifications_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `cases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
