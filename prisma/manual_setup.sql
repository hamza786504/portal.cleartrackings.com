-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `role` ENUM('doctor', 'designer', 'admin') NOT NULL DEFAULT 'doctor',
    `firstName` VARCHAR(191) NULL,
    `lastName` VARCHAR(191) NULL,
    `isApproved` BOOLEAN NOT NULL DEFAULT false,
    `isSuspended` BOOLEAN NOT NULL DEFAULT false,
    `doctorDetails` JSON NULL,
    `designerDetails` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `designer_permissions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `designerId` INTEGER NOT NULL,
    `doctorId` INTEGER NOT NULL,

    UNIQUE INDEX `designer_permissions_designerId_doctorId_key`(`designerId`, `doctorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cases` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `doctorId` INTEGER NOT NULL,
    `patientName` VARCHAR(191) NOT NULL,
    `practiceName` VARCHAR(191) NOT NULL,
    `chiefComplaint` TEXT NOT NULL,
    `dob` VARCHAR(191) NOT NULL,
    `toothSystem` VARCHAR(191) NOT NULL DEFAULT 'FDI (recommended)',
    `impressionMethod` VARCHAR(191) NOT NULL,
    `impressionsTaken` JSON NOT NULL,
    `additionalRecords` JSON NOT NULL,
    `treatArches` VARCHAR(191) NOT NULL DEFAULT 'Both',
    `velocity` VARCHAR(191) NOT NULL DEFAULT '0.2',
    `otherVelocity` VARCHAR(191) NULL,
    `caseType` VARCHAR(191) NOT NULL,
    `wearSchedule` VARCHAR(191) NOT NULL,
    `retainer` VARCHAR(191) NOT NULL,
    `doNotMoveTeeth` JSON NOT NULL,
    `avoidAttachmentsTeeth` JSON NOT NULL,
    `teethForExtraction` JSON NOT NULL,
    `leaveSpacesOpen` JSON NOT NULL,
    `upperMidlineValue` VARCHAR(191) NULL,
    `upperMidlineGoal` VARCHAR(191) NULL,
    `lowerMidlineValue` VARCHAR(191) NULL,
    `lowerMidlineGoal` VARCHAR(191) NULL,
    `overjetValue` VARCHAR(191) NULL,
    `overjetGoal` VARCHAR(191) NULL,
    `overbiteValue` VARCHAR(191) NULL,
    `overbiteGoal` VARCHAR(191) NULL,
    `canineRelation` VARCHAR(191) NULL,
    `molarRelation` VARCHAR(191) NULL,
    `anteriorCrossbite` VARCHAR(191) NULL,
    `posteriorCrossbite` VARCHAR(191) NULL,
    `deciduousTeeth` VARCHAR(191) NULL,
    `ipr` VARCHAR(191) NULL,
    `engagers` VARCHAR(191) NULL,
    `spaceManagement` VARCHAR(191) NULL,
    `additionalInfo` TEXT NULL,
    `treatmentPlan` TEXT NOT NULL,
    `scanFiles` JSON NOT NULL,
    `patientImages` JSON NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `pickedById` INTEGER NULL,
    `designLink` VARCHAR(191) NOT NULL DEFAULT '',
    `deliveredAt` DATETIME(3) NULL,
    `approvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `messages` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `caseId` INTEGER NOT NULL,
    `senderId` INTEGER NOT NULL,
    `senderRole` VARCHAR(191) NOT NULL,
    `body` VARCHAR(2000) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `messages_caseId_createdAt_idx`(`caseId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `designer_permissions` ADD CONSTRAINT `designer_permissions_designerId_fkey` FOREIGN KEY (`designerId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `designer_permissions` ADD CONSTRAINT `designer_permissions_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cases` ADD CONSTRAINT `cases_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cases` ADD CONSTRAINT `cases_pickedById_fkey` FOREIGN KEY (`pickedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `messages_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `cases`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `messages_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
