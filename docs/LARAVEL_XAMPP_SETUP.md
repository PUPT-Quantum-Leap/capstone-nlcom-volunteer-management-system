# Laravel + XAMPP Setup Guide

## Prerequisites
- XAMPP installed with Apache + MariaDB/MySQL running
- PHP 8.2+ 
- Composer installed
- Node.js 22.x + npm

## Step 1: Database Setup

### Create Database in XAMPP
1. Open `http://localhost/phpmyadmin`
2. Click "New" to create database
3. Name: `nlcom_volunteer_management`
4. Click "Create"

### Import Existing Data
1. Select the `nlcom_volunteer_management` database
2. Click "Import" tab
3. Choose file: `documents/nlcom_volunteer_management.sql`
4. Click "Go"

## Step 2: Laravel Backend Setup

### Install Dependencies
```bash
cd servetrack-backend
composer install --no-dev
npm install
```

### Configure Environment
```bash
cp .env.example .env
php artisan key:generate
```

### Update .env File
Edit `.env` and ensure database settings:
```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=nlcom_volunteer_management
DB_USERNAME=root
DB_PASSWORD=
```

### Run Laravel Migrations
```bash
php artisan migrate
```

### Test Connection
```bash
php artisan tinker --execute="DB::connection()->getPdo(); echo 'Connected!';"
```

## Step 3: Frontend Setup

```bash
cd servetrack-frontend
npm install
```

## Step 4: Start Application

### Terminal 1 - Backend Server
```bash
cd servetrack-backend
php artisan serve
```
*API runs at: http://127.0.0.1:8000*

### Terminal 2 - Frontend Server
```bash
cd servetrack-frontend
npm start
```
*Frontend runs at: http://localhost:4200*

## Troubleshooting

### "Migration table not found"
```bash
php artisan migrate
```

### "Could not open input file: artisan"
Make sure you're in the `servetrack-backend` directory

### Database connection errors
1. Ensure XAMPP MySQL service is running
2. Check database name in `.env` matches exactly
3. Verify username/password (default: root, no password)

### Frontend build errors
```bash
cd servetrack-frontend
npm install
npm start
```

## Verify Everything Works

1. **Backend Test**: Open http://127.0.0.1:8000 in browser
2. **Frontend Test**: Open http://localhost:4200 (after build completes)
3. **Database Test**: Check tables in phpMyAdmin

## Project Structure
```
capstone-nlcom-volunteer-management-system/
├── servetrack-backend/     # Laravel API
├── servetrack-frontend/    # Angular SPA  
├── documents/              # SQL files
└── docs/                   # Documentation
```

## Quick Commands Reference
```bash
# Backend
cd servetrack-backend
php artisan serve                    # Start server
php artisan migrate                  # Run migrations
php artisan tinker                   # Test database

# Frontend  
cd servetrack-frontend
npm start                           # Start dev server
npm install                         # Install dependencies
```

## Success Indicators
✅ Backend shows "Laravel" welcome page at http://127.0.0.1:8000
✅ Frontend loads Angular app at http://localhost:4200  
✅ Database contains both your tables and Laravel system tables
✅ No connection errors in terminal
