-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Mar 02, 2026 at 04:02 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `nlcom_volunteer_management`
--

-- --------------------------------------------------------

--
-- Table structure for table `admin`
--

CREATE TABLE `admin` (
  `admin_id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `availability`
--

CREATE TABLE `availability` (
  `availability_id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `cache`
--

CREATE TABLE `cache` (
  `key` varchar(255) NOT NULL,
  `value` mediumtext NOT NULL,
  `expiration` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `cache`
--

INSERT INTO `cache` (`key`, `value`, `expiration`) VALUES
('laravel-cache-login:johnmatthewarroyow2@gmail.com|127.0.0.1', 'i:1;', 1772437817),
('laravel-cache-login:johnmatthewarroyow2@gmail.com|127.0.0.1:timer', 'i:1772437817;', 1772437817);

-- --------------------------------------------------------

--
-- Table structure for table `cache_locks`
--

CREATE TABLE `cache_locks` (
  `key` varchar(255) NOT NULL,
  `owner` varchar(255) NOT NULL,
  `expiration` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `coordinator`
--

CREATE TABLE `coordinator` (
  `coordinator_id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `experience`
--

CREATE TABLE `experience` (
  `experience_id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `failed_jobs`
--

CREATE TABLE `failed_jobs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` varchar(255) NOT NULL,
  `connection` text NOT NULL,
  `queue` text NOT NULL,
  `payload` longtext NOT NULL,
  `exception` longtext NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `jobs`
--

CREATE TABLE `jobs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `queue` varchar(255) NOT NULL,
  `payload` longtext NOT NULL,
  `attempts` tinyint(3) UNSIGNED NOT NULL,
  `reserved_at` int(10) UNSIGNED DEFAULT NULL,
  `available_at` int(10) UNSIGNED NOT NULL,
  `created_at` int(10) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `job_batches`
--

CREATE TABLE `job_batches` (
  `id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `total_jobs` int(11) NOT NULL,
  `pending_jobs` int(11) NOT NULL,
  `failed_jobs` int(11) NOT NULL,
  `failed_job_ids` longtext NOT NULL,
  `options` mediumtext DEFAULT NULL,
  `cancelled_at` int(11) DEFAULT NULL,
  `created_at` int(11) NOT NULL,
  `finished_at` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `lifegroup`
--

CREATE TABLE `lifegroup` (
  `lifegroup_id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `migrations`
--

CREATE TABLE `migrations` (
  `id` int(10) UNSIGNED NOT NULL,
  `migration` varchar(255) NOT NULL,
  `batch` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `migrations`
--

INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES
(1, '0001_01_01_000000_create_users_table', 1),
(2, '0001_01_01_000001_create_cache_table', 1),
(3, '0001_01_01_000002_create_jobs_table', 1),
(4, '2026_01_13_094924_create_personal_access_tokens_table', 1),
(5, '2026_02_28_125541_add_lockout_fields_to_users_table', 1),
(6, '2026_02_28_143453_create_volunteer_table', 1),
(7, '2026_02_28_143500_create_admin_table', 1),
(8, '2026_02_28_143501_create_coordinator_table', 1),
(9, '2026_02_28_143502_create_availability_table', 1),
(10, '2026_02_28_143503_create_experience_table', 1),
(11, '2026_02_28_143504_create_lifegroup_table', 1),
(12, '2026_02_28_143505_create_position_table', 1),
(13, '2026_02_28_143506_create_skill_table', 1),
(14, '2026_02_28_143507_create_training_table', 1),
(15, '2026_02_28_143508_create_option_table', 1),
(16, '2026_02_28_143509_create_poll_table', 1),
(17, '2026_02_28_143510_create_poll_option_table', 1),
(18, '2026_02_28_143511_create_poll_vote_table', 1),
(19, '2026_02_28_143512_create_sms_notification_table', 1),
(20, '2026_02_28_143513_create_volunteer_availability_table', 1),
(21, '2026_02_28_143514_create_volunteer_experience_table', 1),
(22, '2026_02_28_143515_create_volunteer_lifegroup_table', 1),
(23, '2026_02_28_143516_create_volunteer_position_table', 1),
(24, '2026_02_28_143517_create_volunteer_skill_table', 1),
(25, '2026_02_28_143518_create_volunteer_training_table', 1),
(26, '2026_02_28_143600_add_user_id_to_volunteer_table', 1);

-- --------------------------------------------------------

--
-- Table structure for table `option`
--

CREATE TABLE `option` (
  `option_id` bigint(20) UNSIGNED NOT NULL,
  `text` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `password_reset_tokens`
--

CREATE TABLE `password_reset_tokens` (
  `email` varchar(255) NOT NULL,
  `token` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `personal_access_tokens`
--

CREATE TABLE `personal_access_tokens` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `tokenable_type` varchar(255) NOT NULL,
  `tokenable_id` bigint(20) UNSIGNED NOT NULL,
  `name` text NOT NULL,
  `token` varchar(64) NOT NULL,
  `abilities` text DEFAULT NULL,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `personal_access_tokens`
--

INSERT INTO `personal_access_tokens` (`id`, `tokenable_type`, `tokenable_id`, `name`, `token`, `abilities`, `last_used_at`, `expires_at`, `created_at`, `updated_at`) VALUES
(1, 'App\\Models\\User', 1, 'auth-token', '7ab88f63187f21141b07fad0e29f4f402bcfe782292040470e6440eac5e856fc', '[\"*\"]', NULL, '2026-03-01 23:49:54', '2026-03-01 23:49:54', '2026-03-01 23:49:54'),
(2, 'App\\Models\\User', 1, 'auth-token', '1a2c0dafaf623216495c0910300dcf97d39d985a7c9abbfaae41ab642f5d8839', '[\"*\"]', NULL, '2026-03-02 00:04:18', '2026-03-02 00:04:18', '2026-03-02 00:04:18'),
(3, 'App\\Models\\User', 1, 'auth-token', 'e52569a827d2b4581e46b6d031119dbf29c2474e80ea108da962bb53acb8e257', '[\"*\"]', NULL, '2026-03-02 03:29:33', '2026-03-02 03:29:33', '2026-03-02 03:29:33'),
(4, 'App\\Models\\User', 1, 'auth-token', '0854e2dd3be7e0debc8f9cab66aacc75912b8fb081e765e70fd3eeacf4386307', '[\"*\"]', NULL, '2026-03-02 06:20:26', '2026-03-02 06:20:26', '2026-03-02 06:20:26'),
(5, 'App\\Models\\User', 1, 'auth-token', '976f999983c34034deeb4a3cb6f8aaa44b7e26f4572f000f722e1cee2231b14b', '[\"*\"]', NULL, '2026-03-02 06:24:53', '2026-03-02 06:24:53', '2026-03-02 06:24:53'),
(6, 'App\\Models\\User', 1, 'auth-token', '2056c9c6b9b8cfb6cad0a962c814da8140c10410d40df82b5f2f3e72e283720c', '[\"*\"]', NULL, '2026-03-02 06:25:00', '2026-03-02 06:25:00', '2026-03-02 06:25:00'),
(7, 'App\\Models\\User', 1, 'auth-token', '7c5d3be8fcc67ba2f4fcee2d0f7cf7671cf2ed4d665d833c817a8a892bdd355e', '[\"*\"]', NULL, '2026-03-02 06:25:08', '2026-03-02 06:25:08', '2026-03-02 06:25:08'),
(8, 'App\\Models\\User', 1, 'auth-token', 'c544b50e6d20b2d8cfd45573fedff99bd5194a8406aca27562a08d5937222d42', '[\"*\"]', NULL, '2026-03-02 06:28:12', '2026-03-02 06:28:12', '2026-03-02 06:28:12'),
(9, 'App\\Models\\User', 1, 'auth-token', '38f8403e05d2f2cc4cdf6ad38b50af776fd2504eb6096c814e0e012c40599863', '[\"*\"]', NULL, '2026-03-02 06:30:10', '2026-03-02 06:30:10', '2026-03-02 06:30:10'),
(10, 'App\\Models\\User', 1, 'auth-token', 'edd36b4cf797eaa1d28a1b701c2cc2b5958908b4682e6bc7d42e375de29ea814', '[\"*\"]', NULL, '2026-03-02 06:30:19', '2026-03-02 06:30:19', '2026-03-02 06:30:19');

-- --------------------------------------------------------

--
-- Table structure for table `poll`
--

CREATE TABLE `poll` (
  `poll_id` bigint(20) UNSIGNED NOT NULL,
  `title` varchar(100) NOT NULL,
  `vote_count` int(11) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `poll_option`
--

CREATE TABLE `poll_option` (
  `poll_option_id` bigint(20) UNSIGNED NOT NULL,
  `option_id` bigint(20) UNSIGNED NOT NULL,
  `poll_id` bigint(20) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `poll_vote`
--

CREATE TABLE `poll_vote` (
  `poll_vote_id` bigint(20) UNSIGNED NOT NULL,
  `volunteer_id` bigint(20) UNSIGNED NOT NULL,
  `poll_id` bigint(20) UNSIGNED NOT NULL,
  `voted_at` date NOT NULL,
  `sms_sent` tinyint(1) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `position`
--

CREATE TABLE `position` (
  `position_id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `position`
--

INSERT INTO `position` (`position_id`, `name`) VALUES
(1, 'Mobile Kitchen Operations');

-- --------------------------------------------------------

--
-- Table structure for table `sessions`
--

CREATE TABLE `sessions` (
  `id` varchar(255) NOT NULL,
  `user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `payload` longtext NOT NULL,
  `last_activity` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `skill`
--

CREATE TABLE `skill` (
  `skill_id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `skill`
--

INSERT INTO `skill` (`skill_id`, `name`) VALUES
(1, 'Reading');

-- --------------------------------------------------------

--
-- Table structure for table `sms_notification`
--

CREATE TABLE `sms_notification` (
  `sms_id` bigint(20) UNSIGNED NOT NULL,
  `volunteer_id` bigint(20) UNSIGNED NOT NULL,
  `poll_vote_id` bigint(20) UNSIGNED NOT NULL,
  `message` text NOT NULL,
  `sent_date` date NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `training`
--

CREATE TABLE `training` (
  `training_id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `training`
--

INSERT INTO `training` (`training_id`, `name`) VALUES
(1, 'Web Development'),
(2, 'Python Workshop');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `locked_until` timestamp NULL DEFAULT NULL,
  `failed_attempts` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `last_failed_at` timestamp NULL DEFAULT NULL,
  `remember_token` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `name`, `email`, `email_verified_at`, `password`, `locked_until`, `failed_attempts`, `last_failed_at`, `remember_token`, `created_at`, `updated_at`) VALUES
(1, 'John Matthew Arroyo', 'johnmatthewarroyo2@gmail.com', NULL, '$2y$12$eHcYTiLetHrbEteHd9YuVOAyD6U4nLONf8PCXacoI10exbYi5/Sqy', NULL, 0, NULL, NULL, '2026-03-01 02:22:06', '2026-03-02 00:04:18');

-- --------------------------------------------------------

--
-- Table structure for table `volunteer`
--

CREATE TABLE `volunteer` (
  `volunteer_id` bigint(20) UNSIGNED NOT NULL,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `first_name` varchar(50) NOT NULL,
  `last_name` varchar(50) NOT NULL,
  `facebook_name` varchar(100) NOT NULL,
  `facebook_id` int(11) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `birthdate` date NOT NULL,
  `address` varchar(255) NOT NULL,
  `mobile_number` varchar(15) NOT NULL,
  `educational_attainment` varchar(100) NOT NULL,
  `last_medical_examination` date NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `volunteer`
--

INSERT INTO `volunteer` (`volunteer_id`, `user_id`, `first_name`, `last_name`, `facebook_name`, `facebook_id`, `email`, `birthdate`, `address`, `mobile_number`, `educational_attainment`, `last_medical_examination`, `created_at`, `updated_at`) VALUES
(1, 1, 'John Matthew', 'Arroyo', 'Mista Ravioly', NULL, 'johnmatthewarroyo2@gmail.com', '2005-01-01', 'P-23A 9th 16th St. Villamor Air Base, Pasay City', '09087618689', 'senior-high', '2015-01-05', '2026-03-01 02:22:06', '2026-03-01 02:22:06');

-- --------------------------------------------------------

--
-- Table structure for table `volunteer_availability`
--

CREATE TABLE `volunteer_availability` (
  `volunteer_availability_id` bigint(20) UNSIGNED NOT NULL,
  `volunteer_id` bigint(20) UNSIGNED NOT NULL,
  `availability_id` bigint(20) UNSIGNED NOT NULL,
  `custom_description` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `volunteer_experience`
--

CREATE TABLE `volunteer_experience` (
  `volunteer_experience_id` bigint(20) UNSIGNED NOT NULL,
  `volunteer_id` bigint(20) UNSIGNED NOT NULL,
  `experience_id` bigint(20) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `volunteer_lifegroup`
--

CREATE TABLE `volunteer_lifegroup` (
  `volunteer_lifegroup_id` bigint(20) UNSIGNED NOT NULL,
  `volunteer_id` bigint(20) UNSIGNED NOT NULL,
  `lifegroup_id` bigint(20) UNSIGNED NOT NULL,
  `is_leader` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `volunteer_position`
--

CREATE TABLE `volunteer_position` (
  `volunteer_position_id` bigint(20) UNSIGNED NOT NULL,
  `volunteer_id` bigint(20) UNSIGNED NOT NULL,
  `position_id` bigint(20) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `volunteer_position`
--

INSERT INTO `volunteer_position` (`volunteer_position_id`, `volunteer_id`, `position_id`) VALUES
(1, 1, 1);

-- --------------------------------------------------------

--
-- Table structure for table `volunteer_skill`
--

CREATE TABLE `volunteer_skill` (
  `volunteer_skill_id` bigint(20) UNSIGNED NOT NULL,
  `volunteer_id` bigint(20) UNSIGNED NOT NULL,
  `skill_id` bigint(20) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `volunteer_skill`
--

INSERT INTO `volunteer_skill` (`volunteer_skill_id`, `volunteer_id`, `skill_id`) VALUES
(1, 1, 1);

-- --------------------------------------------------------

--
-- Table structure for table `volunteer_training`
--

CREATE TABLE `volunteer_training` (
  `volunteer_training_id` bigint(20) UNSIGNED NOT NULL,
  `volunteer_id` bigint(20) UNSIGNED NOT NULL,
  `training_id` bigint(20) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `volunteer_training`
--

INSERT INTO `volunteer_training` (`volunteer_training_id`, `volunteer_id`, `training_id`) VALUES
(1, 1, 1),
(2, 1, 2);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `admin`
--
ALTER TABLE `admin`
  ADD PRIMARY KEY (`admin_id`);

--
-- Indexes for table `availability`
--
ALTER TABLE `availability`
  ADD PRIMARY KEY (`availability_id`);

--
-- Indexes for table `cache`
--
ALTER TABLE `cache`
  ADD PRIMARY KEY (`key`);

--
-- Indexes for table `cache_locks`
--
ALTER TABLE `cache_locks`
  ADD PRIMARY KEY (`key`);

--
-- Indexes for table `coordinator`
--
ALTER TABLE `coordinator`
  ADD PRIMARY KEY (`coordinator_id`);

--
-- Indexes for table `experience`
--
ALTER TABLE `experience`
  ADD PRIMARY KEY (`experience_id`);

--
-- Indexes for table `failed_jobs`
--
ALTER TABLE `failed_jobs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`);

--
-- Indexes for table `jobs`
--
ALTER TABLE `jobs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `jobs_queue_index` (`queue`);

--
-- Indexes for table `job_batches`
--
ALTER TABLE `job_batches`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `lifegroup`
--
ALTER TABLE `lifegroup`
  ADD PRIMARY KEY (`lifegroup_id`);

--
-- Indexes for table `migrations`
--
ALTER TABLE `migrations`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `option`
--
ALTER TABLE `option`
  ADD PRIMARY KEY (`option_id`);

--
-- Indexes for table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  ADD PRIMARY KEY (`email`);

--
-- Indexes for table `personal_access_tokens`
--
ALTER TABLE `personal_access_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `personal_access_tokens_token_unique` (`token`),
  ADD KEY `personal_access_tokens_tokenable_type_tokenable_id_index` (`tokenable_type`,`tokenable_id`),
  ADD KEY `personal_access_tokens_expires_at_index` (`expires_at`);

--
-- Indexes for table `poll`
--
ALTER TABLE `poll`
  ADD PRIMARY KEY (`poll_id`);

--
-- Indexes for table `poll_option`
--
ALTER TABLE `poll_option`
  ADD PRIMARY KEY (`poll_option_id`),
  ADD KEY `idx_po_option_id` (`option_id`),
  ADD KEY `idx_po_poll_id` (`poll_id`);

--
-- Indexes for table `poll_vote`
--
ALTER TABLE `poll_vote`
  ADD PRIMARY KEY (`poll_vote_id`),
  ADD KEY `idx_pv_volunteer_id` (`volunteer_id`),
  ADD KEY `idx_pv_poll_id` (`poll_id`);

--
-- Indexes for table `position`
--
ALTER TABLE `position`
  ADD PRIMARY KEY (`position_id`);

--
-- Indexes for table `sessions`
--
ALTER TABLE `sessions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `sessions_user_id_index` (`user_id`),
  ADD KEY `sessions_last_activity_index` (`last_activity`);

--
-- Indexes for table `skill`
--
ALTER TABLE `skill`
  ADD PRIMARY KEY (`skill_id`);

--
-- Indexes for table `sms_notification`
--
ALTER TABLE `sms_notification`
  ADD PRIMARY KEY (`sms_id`),
  ADD KEY `idx_sn_volunteer_id` (`volunteer_id`),
  ADD KEY `idx_sn_poll_vote_id` (`poll_vote_id`);

--
-- Indexes for table `training`
--
ALTER TABLE `training`
  ADD PRIMARY KEY (`training_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `users_email_unique` (`email`);

--
-- Indexes for table `volunteer`
--
ALTER TABLE `volunteer`
  ADD PRIMARY KEY (`volunteer_id`),
  ADD KEY `volunteer_user_id_foreign` (`user_id`);

--
-- Indexes for table `volunteer_availability`
--
ALTER TABLE `volunteer_availability`
  ADD PRIMARY KEY (`volunteer_availability_id`),
  ADD KEY `idx_va_volunteer_id` (`volunteer_id`),
  ADD KEY `idx_va_availability_id` (`availability_id`);

--
-- Indexes for table `volunteer_experience`
--
ALTER TABLE `volunteer_experience`
  ADD PRIMARY KEY (`volunteer_experience_id`),
  ADD KEY `idx_ve_volunteer_id` (`volunteer_id`),
  ADD KEY `idx_ve_experience_id` (`experience_id`);

--
-- Indexes for table `volunteer_lifegroup`
--
ALTER TABLE `volunteer_lifegroup`
  ADD PRIMARY KEY (`volunteer_lifegroup_id`),
  ADD KEY `idx_vl_volunteer_id` (`volunteer_id`),
  ADD KEY `idx_vl_lifegroup_id` (`lifegroup_id`);

--
-- Indexes for table `volunteer_position`
--
ALTER TABLE `volunteer_position`
  ADD PRIMARY KEY (`volunteer_position_id`),
  ADD KEY `idx_vp_volunteer_id` (`volunteer_id`),
  ADD KEY `idx_vp_position_id` (`position_id`);

--
-- Indexes for table `volunteer_skill`
--
ALTER TABLE `volunteer_skill`
  ADD PRIMARY KEY (`volunteer_skill_id`),
  ADD KEY `idx_vs_volunteer_id` (`volunteer_id`),
  ADD KEY `idx_vs_skill_id` (`skill_id`);

--
-- Indexes for table `volunteer_training`
--
ALTER TABLE `volunteer_training`
  ADD PRIMARY KEY (`volunteer_training_id`),
  ADD KEY `idx_vt_volunteer_id` (`volunteer_id`),
  ADD KEY `idx_vt_training_id` (`training_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `admin`
--
ALTER TABLE `admin`
  MODIFY `admin_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `availability`
--
ALTER TABLE `availability`
  MODIFY `availability_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `coordinator`
--
ALTER TABLE `coordinator`
  MODIFY `coordinator_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `experience`
--
ALTER TABLE `experience`
  MODIFY `experience_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `failed_jobs`
--
ALTER TABLE `failed_jobs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `jobs`
--
ALTER TABLE `jobs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `lifegroup`
--
ALTER TABLE `lifegroup`
  MODIFY `lifegroup_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `migrations`
--
ALTER TABLE `migrations`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=27;

--
-- AUTO_INCREMENT for table `option`
--
ALTER TABLE `option`
  MODIFY `option_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `personal_access_tokens`
--
ALTER TABLE `personal_access_tokens`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `poll`
--
ALTER TABLE `poll`
  MODIFY `poll_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `poll_option`
--
ALTER TABLE `poll_option`
  MODIFY `poll_option_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `poll_vote`
--
ALTER TABLE `poll_vote`
  MODIFY `poll_vote_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `position`
--
ALTER TABLE `position`
  MODIFY `position_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `skill`
--
ALTER TABLE `skill`
  MODIFY `skill_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `sms_notification`
--
ALTER TABLE `sms_notification`
  MODIFY `sms_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `training`
--
ALTER TABLE `training`
  MODIFY `training_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `volunteer`
--
ALTER TABLE `volunteer`
  MODIFY `volunteer_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `volunteer_availability`
--
ALTER TABLE `volunteer_availability`
  MODIFY `volunteer_availability_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `volunteer_experience`
--
ALTER TABLE `volunteer_experience`
  MODIFY `volunteer_experience_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `volunteer_lifegroup`
--
ALTER TABLE `volunteer_lifegroup`
  MODIFY `volunteer_lifegroup_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `volunteer_position`
--
ALTER TABLE `volunteer_position`
  MODIFY `volunteer_position_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `volunteer_skill`
--
ALTER TABLE `volunteer_skill`
  MODIFY `volunteer_skill_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `volunteer_training`
--
ALTER TABLE `volunteer_training`
  MODIFY `volunteer_training_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `poll_option`
--
ALTER TABLE `poll_option`
  ADD CONSTRAINT `poll_option_option_id_foreign` FOREIGN KEY (`option_id`) REFERENCES `option` (`option_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `poll_option_poll_id_foreign` FOREIGN KEY (`poll_id`) REFERENCES `poll` (`poll_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `poll_vote`
--
ALTER TABLE `poll_vote`
  ADD CONSTRAINT `poll_vote_poll_id_foreign` FOREIGN KEY (`poll_id`) REFERENCES `poll` (`poll_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `poll_vote_volunteer_id_foreign` FOREIGN KEY (`volunteer_id`) REFERENCES `volunteer` (`volunteer_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `sms_notification`
--
ALTER TABLE `sms_notification`
  ADD CONSTRAINT `sms_notification_poll_vote_id_foreign` FOREIGN KEY (`poll_vote_id`) REFERENCES `poll_vote` (`poll_vote_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `sms_notification_volunteer_id_foreign` FOREIGN KEY (`volunteer_id`) REFERENCES `volunteer` (`volunteer_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `volunteer`
--
ALTER TABLE `volunteer`
  ADD CONSTRAINT `volunteer_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

--
-- Constraints for table `volunteer_availability`
--
ALTER TABLE `volunteer_availability`
  ADD CONSTRAINT `volunteer_availability_availability_id_foreign` FOREIGN KEY (`availability_id`) REFERENCES `availability` (`availability_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `volunteer_availability_volunteer_id_foreign` FOREIGN KEY (`volunteer_id`) REFERENCES `volunteer` (`volunteer_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `volunteer_experience`
--
ALTER TABLE `volunteer_experience`
  ADD CONSTRAINT `volunteer_experience_experience_id_foreign` FOREIGN KEY (`experience_id`) REFERENCES `experience` (`experience_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `volunteer_experience_volunteer_id_foreign` FOREIGN KEY (`volunteer_id`) REFERENCES `volunteer` (`volunteer_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `volunteer_lifegroup`
--
ALTER TABLE `volunteer_lifegroup`
  ADD CONSTRAINT `volunteer_lifegroup_lifegroup_id_foreign` FOREIGN KEY (`lifegroup_id`) REFERENCES `lifegroup` (`lifegroup_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `volunteer_lifegroup_volunteer_id_foreign` FOREIGN KEY (`volunteer_id`) REFERENCES `volunteer` (`volunteer_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `volunteer_position`
--
ALTER TABLE `volunteer_position`
  ADD CONSTRAINT `volunteer_position_position_id_foreign` FOREIGN KEY (`position_id`) REFERENCES `position` (`position_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `volunteer_position_volunteer_id_foreign` FOREIGN KEY (`volunteer_id`) REFERENCES `volunteer` (`volunteer_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `volunteer_skill`
--
ALTER TABLE `volunteer_skill`
  ADD CONSTRAINT `volunteer_skill_skill_id_foreign` FOREIGN KEY (`skill_id`) REFERENCES `skill` (`skill_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `volunteer_skill_volunteer_id_foreign` FOREIGN KEY (`volunteer_id`) REFERENCES `volunteer` (`volunteer_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `volunteer_training`
--
ALTER TABLE `volunteer_training`
  ADD CONSTRAINT `volunteer_training_training_id_foreign` FOREIGN KEY (`training_id`) REFERENCES `training` (`training_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `volunteer_training_volunteer_id_foreign` FOREIGN KEY (`volunteer_id`) REFERENCES `volunteer` (`volunteer_id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
