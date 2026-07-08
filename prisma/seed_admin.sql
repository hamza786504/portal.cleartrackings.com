-- Creates the admin@gmail.com / Admin@123 account directly.
-- Run in phpMyAdmin's SQL tab after manual_setup.sql has been applied.
INSERT INTO `users` (`email`, `password`, `role`, `firstName`, `lastName`, `isApproved`, `isSuspended`, `createdAt`, `updatedAt`)
VALUES ('admin@gmail.com', '$2b$10$6A8nISvg1hkfQ3BTwpCZHecK9EmCo7UZrKgJyfwyXCWBo4zFMHgH.', 'admin', 'Admin', '', 1, 0, NOW(3), NOW(3));
