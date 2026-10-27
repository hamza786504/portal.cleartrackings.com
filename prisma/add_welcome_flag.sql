-- Adds the flag behind the one-time welcome banner on the doctor/designer dashboards.
-- Run once on every database (local and Hostinger) via phpMyAdmin → SQL.
ALTER TABLE `users`
    ADD COLUMN `hasSeenWelcome` BOOLEAN NOT NULL DEFAULT false AFTER `resetOtpAttempts`;

-- Existing accounts are not new signups, so they should never see the welcome banner
UPDATE `users` SET `hasSeenWelcome` = true;
