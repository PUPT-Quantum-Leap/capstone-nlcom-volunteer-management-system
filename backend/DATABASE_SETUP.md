# Database Setup Guide

This guide explains how to set up the MySQL database and run migrations for the ServeTrack Backend application.

## Prerequisites

1. MySQL server installed and running
2. PHP with Laravel dependencies installed (`composer install`)
3. MySQL credentials configured in `.env` file

## Configuration

Before running migrations, make sure your `.env` file has the correct MySQL configuration:

```
env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=servetrack_backend
DB_USERNAME=your_username
DB_PASSWORD=your_password
```

## Option 1: Using the Artisan Command (Recommended)

Run the following command to create the database and run migrations in one step:

```
bash
php artisan db:setup
```

This will:
1. Create the database `servetrack_backend` with utf8mb4 charset
2. Run all migrations to create all tables

To also seed the database with initial data:

```
bash
php artisan db:setup --seed
```

## Option 2: Manual Setup

### Step 1: Create the Database

Run the SQL script in MySQL:

```
bash
mysql -u root -p < database/setup_database.sql
```

Or execute the SQL directly in your MySQL client:

```
sql
CREATE DATABASE IF NOT EXISTS servetrack_backend CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### Step 2: Run Migrations

After creating the database, run the migrations:

```
bash
php artisan migrate
```

This will create all the following tables:
- `users` (Laravel default)
- `coordinator`
- `admin`
- `availability`
- `training`
- `position`
- `skill`
- `experience`
- `lifegroup`
- `option`
- `poll`
- `volunteer`
- `volunteer_availability`
- `volunteer_training`
- `volunteer_position`
- `volunteer_skill`
- `volunteer_experience`
- `volunteer_lifegroup`
- `poll_option`
- `poll_vote`
- `sms_notification`
- `attendances`

## Troubleshooting

### "Access denied for user" error
- Check your MySQL credentials in `.env`
- Make sure MySQL server is running

### "Unknown database" error
- Run `php artisan db:setup` or the SQL script to create the database first

### Migration errors
- Make sure the database exists before running migrations
- Check that MySQL user has privileges to create tables

## Database Schema

The database uses:
- **Character Set**: utf8mb4
- **Collation**: utf8mb4_unicode_ci
- **Engine**: InnoDB (for MySQL)

All tables include proper foreign key constraints with cascading deletes and updates.
