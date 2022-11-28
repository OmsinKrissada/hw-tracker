-- CreateTable
CREATE TABLE `homework` (
    `id` VARCHAR(191) NOT NULL,
    `sub_id` VARCHAR(7) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deleted_at` DATETIME(3) NULL,
    `due_date` DATETIME(3) NULL,
    `detail` VARCHAR(300) NULL,
    `author_nickname` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
