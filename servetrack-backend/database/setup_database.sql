-- Setup script for servetrack_backend database
-- Run this script first before running php artisan migrate

CREATE DATABASE IF NOT EXISTS servetrack_backend CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE servetrack_backend;

-- The database is now ready
-- Run the following command to create all tables:
-- php artisan migrate
