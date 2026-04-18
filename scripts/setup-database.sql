CREATE DATABASE IF NOT EXISTS servetrack_backend CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'servetrack_user'@'localhost' IDENTIFIED BY 'CHANGE_ME_STRONG_PASSWORD';

GRANT ALL PRIVILEGES ON servetrack_backend.* TO 'servetrack_user'@'localhost';
FLUSH PRIVILEGES;
