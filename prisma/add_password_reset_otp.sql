-- Adds the columns used by the OTP-based "forgot password" flow.
-- Run once on every database (local and Hostinger) via phpMyAdmin → SQL.
ALTER TABLE `users`
    ADD COLUMN `resetOtpHash` VARCHAR(191) NULL AFTER `passwordResetRequested`,
    ADD COLUMN `resetOtpExpiresAt` DATETIME(3) NULL AFTER `resetOtpHash`,
    ADD COLUMN `resetOtpSentAt` DATETIME(3) NULL AFTER `resetOtpExpiresAt`,
    ADD COLUMN `resetOtpAttempts` INTEGER NOT NULL DEFAULT 0 AFTER `resetOtpSentAt`;
