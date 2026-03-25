# ServeTrack VPS Deployment Guide

> NLCom Volunteer Management System - Production Deployment

This guide covers deploying the ServeTrack application (Angular 21 frontend + Laravel 12 backend + MySQL) on a single VPS.

---

## Table of Contents

1. [Server Requirements](#server-requirements)
2. [Server Setup](#server-setup)
3. [Software Installation](#software-installation)
4. [Database Setup](#database-setup)
5. [Application Deployment](#application-deployment)
6. [Nginx Configuration](#nginx-configuration)
7. [Queue Worker Setup](#queue-worker-setup)
8. [SSL Certificate](#ssl-certificate)
9. [Environment Variables](#environment-variables)
10. [Deployment Script](#deployment-script)
11. [Maintenance](#maintenance)

---

## Server Requirements

| Resource | Minimum | Recommended |
|----------|---------|--------------|
| RAM | 2 GB | 4 GB |
| CPU | 1 vCPU | 2 vCPU |
| Storage | 25 GB | 50 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

**Estimated Cost**: $15-20/month (Hostinger VPS KVM)

---

## Server Setup

### 1. Initialize Server

```bash
# Connect via SSH
ssh root@your-server-ip

# Update system
apt update && apt upgrade -y

# Create deployment user (recommended for security)
adduser deploy
usermod -aG sudo deploy

# Switch to deploy user
su - deploy
```

### 2. Set Up Firewall

```bash
# Enable UFW
sudo ufw enable

# Allow SSH (important!)
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Check status
sudo ufw status
```

---

## Software Installation

### 1. Install Nginx

```bash
sudo apt install nginx -y
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 2. Install PHP 8.2+

```bash
# Add Ondrej PHP repository
sudo apt install software-properties-common -y
sudo add-apt-repository ppa:ondrej/php -y
sudo apt update

# Install PHP and required extensions
sudo apt install -y php8.2 php8.2-fpm php8.2-mysql php8.2-curl php8.2-gd php8.2-mbstring php8.2-xml php8.2-bcmath php8.2-zip php8.2-intl
```

### 3. Install Composer

```bash
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer
sudo chmod +x /usr/local/bin/composer
```

### 4. Install Node.js 20

```bash
# Add Node.js repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js
sudo apt install -y nodejs

# Verify
node -v
npm -v
```

### 5. Install MySQL 8.0

```bash
sudo apt install mysql-server -y
sudo systemctl enable mysql
sudo systemctl start mysql

# Secure MySQL installation
sudo mysql_sec_installation
```

---

## Database Setup

### 1. Create Database and User

```bash
sudo mysql
```

```sql
-- In MySQL shell
CREATE DATABASE nlcom_volunteer_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'nlcom_user'@'localhost' IDENTIFIED BY 'your-secure-password-here';
GRANT ALL PRIVILEGES ON nlcom_volunteer_db.* TO 'nlcom_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 2. Import Database Schema

```bash
# Upload and import your SQL file
sudo mysql -u nlcom_user -p nlcom_volunteer_db < /path/to/nlcom_volunteer_management.sql
```

---

## Application Deployment

### 1. Create Application Directory

```bash
sudo mkdir -p /var/www/servetrack
sudo chown -R deploy:deploy /var/www/servetrack
```

### 2. Clone Repository

```bash
cd /var/www/servetrack

# If using GitHub (replace with your repo)
git clone https://github.com/YOUR_ORG/capstone-nlcom-volunteer-management-system.git .

# Or upload files via FTP/SFTP
```

### 3. Directory Structure

```
/var/www/servetrack/
├── servetrack-backend/    # Laravel API
└── servetrack-frontend/     # Angular app (build output)
```

### 4. Backend Setup

```bash
cd /var/www/servetrack/servetrack-backend

# Install PHP dependencies
composer install --no-dev --optimize-autoloader

# Copy environment file
cp .env.example .env

# Generate application key
php artisan key:generate
```

### 5. Frontend Build

```bash
cd /var/www/servetrack/servetrack-frontend

# Install Node dependencies
npm install

# Production build
npm run build

# The build output will be in dist/servetrack-frontend/browser
```

---

## Nginx Configuration

### Create Nginx Config

```bash
sudo nano /etc/nginx/sites-available/servetrack
```

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Frontend (Angular static files)
    root /var/www/servetrack/servetrack-frontend/dist/servetrack-frontend/browser;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Frontend routes - serve index.html for Angular routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Laravel API
    location /api/ {
        alias /var/www/servetrack/servetrack-backend/public/;
        
        try_files $uri $uri/ /api/index.php?$query_string;
        
        fastcgi_pass unix:/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME /var/www/servetrack/servetrack-backend/public/index.php;
        include fastcgi_params;
    }

    # Storage links
    location /storage {
        alias /var/www/servetrack/servetrack-backend/storage/app/public;
    }

    # Deny access to hidden files
    location ~ /\. {
        deny all;
    }

    # PHP-FPM configuration
    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.2-fpm.sock;
    }
}
```

### Enable Site

```bash
sudo ln -s /etc/nginx/sites-available/servetrack /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default  # Remove default
sudo nginx -t  # Test configuration
sudo systemctl reload nginx
```

---

## Environment Variables

Edit the Laravel `.env` file:

```bash
cd /var/www/servetrack/servetrack-backend
nano .env
```

```env
APP_NAME=ServeTrack
APP_ENV=production
APP_DEBUG=false
APP_URL=https://your-domain.com

# Database
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=nlcom_volunteer_db
DB_USERNAME=nlcom_user
DB_PASSWORD=your-secure-password-here

# Mail (configure for your SMTP)
MAIL_MAILER=smtp
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS=noreply@your-domain.com
MAIL_FROM_NAME="${APP_NAME}"

# Security - INVITE CODE (CHANGE THIS!)
ADMIN_INVITE_CODE=your-secure-invite-code-here

# Security - ALLOWED DOMAINS (comma-separated)
ADMIN_ALLOWED_DOMAINS=nlcom.com,company.com

# Sanctum
SANCTUM_STATEFUL_DOMAINS=your-domain.com
SESSION_DOMAIN=.your-domain.com
```

### Important Security Steps

```bash
# Set proper permissions
sudo chown -R www-data:www-data /var/www/servetrack/servetrack-backend
sudo chmod -R 755 /var/www/servetrack/servetrack-backend/storage
sudo chmod -R 755 /var/www/servetrack/servetrack-backend/bootstrap/cache

# Generate JWT secret (if using JWT auth)
php artisan jwt:secret
```

---

## Queue Worker Setup

Laravel needs a queue worker for background jobs (notifications, etc.):

### Create Supervisor Config

```bash
sudo nano /etc/supervisor/conf.d/servetrack-worker.conf
```

```ini
[program:servetrack-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/servetrack/servetrack-backend/artisan queue:work --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=www-data
numprocs=2
redirect_stderr=true
stdout_logfile=/var/log/servetrack-worker.log
stopwaitsecs=3600
```

### Start Supervisor

```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start servetrack-worker
```

---

## SSL Certificate

### Install Certbot

```bash
sudo apt install certbot python3-certbot-nginx -y
```

### Generate SSL Certificate

```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

### Auto-Renewal

Certbot sets up auto-renewal by default. Test it:

```bash
sudo certbot renew --dry-run
```

---

## Deployment Script

Create a deployment script for easy updates:

```bash
nano /var/www/servetrack/deploy.sh
```

```bash
#!/bin/bash

set -e

echo "🚀 Starting deployment..."

cd /var/www/servetrack

# Pull latest code
echo "📦 Pulling latest code..."
git pull origin main

# Backend
echo "🔧 Updating backend..."
cd servetrack-backend
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Frontend
echo "🎨 Building frontend..."
cd ../servetrack-frontend
npm install
npm run build

# Set permissions
sudo chown -R www-data:www-data /var/www/servetrack/servetrack-backend
sudo chown -R www-data:www-data /var/www/servetrack/servetrack-frontend/dist

# Restart queue worker
sudo supervisorctl restart servetrack-worker

echo "✅ Deployment complete!"
```

```bash
# Make executable
chmod +x /var/www/servetrack/deploy.sh
```

---

## Maintenance

### Useful Commands

```bash
# View Laravel logs
tail -f /var/www/servetrack/servetrack-backend/storage/logs/laravel.log

# View queue worker logs
tail -f /var/log/servetrack-worker.log

# Restart PHP-FPM
sudo systemctl restart php8.2-fpm

# Restart Nginx
sudo systemctl restart nginx

# Clear Laravel caches
php artisan optimize:clear
```

### Backup Script

```bash
#!/bin/bash
# /var/www/servetrack/backup.sh

BACKUP_DIR="/var/backups/servetrack"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
mysqldump -u nlcom_user -p nlcom_volunteer_db > $BACKUP_DIR/db_$DATE.sql

# Compress
tar -czf $BACKUP_DIR/full_backup_$DATE.tar.gz /var/www/servetrack

# Keep only last 7 backups
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
```

Add to crontab:
```bash
crontab -e
# Add: 0 2 * * * /var/www/servetrack/backup.sh
```

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| 502 Bad Gateway | Check PHP-FPM status: `sudo systemctl status php8.2-fpm` |
| Database connection failed | Verify `.env` DB credentials |
| Angular routes return 404 | Ensure `try_files $uri $uri/ /index.html;` is set |
| Queue not processing | Check Supervisor: `sudo supervisorctl status` |
| SSL not working | Check Certbot: `sudo certbot certificates` |

### Check Logs

```bash
# Nginx error log
sudo tail -f /var/log/nginx/error.log

# Laravel log
sudo tail -f /var/www/servetrack/servetrack-backend/storage/logs/laravel.log

# PHP-FPM log
sudo tail -f /var/log/php8.2-fpm.log
```

---

## Security Checklist

- [ ] Change default SSH port (optional)
- [ ] Set up UFW firewall
- [ ] Disable root login via SSH
- [ ] Use strong passwords
- [ ] Enable auto-updates
- [ ] Set `APP_DEBUG=false` in production
- [ ] Use HTTPS (SSL cert)
- [ ] Regular backups

---

## Support

For issues, check:
1. Laravel logs: `/var/www/servetrack/servetrack-backend/storage/logs/`
2. Nginx error logs
3. Queue worker logs
