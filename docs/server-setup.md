# ServeTrack Server Setup Guide

## One-time Server Initialization

Run these commands **once** on the VPS before the first deployment.

### 1. Create Directory Structure

```bash
sudo mkdir -p /var/www/servetrack/{releases,shared/backend/storage/{framework/{cache/data,sessions,views},logs,app/public}}
```

### 2. Create Deployment User

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG www-data deploy
```

### 3. Set Ownership and Permissions

```bash
sudo chown -R root:www-data /var/www/servetrack
sudo chmod -R 775 /var/www/servetrack/shared/backend/storage
sudo chmod -R 775 /var/www/servetrack/shared/backend/storage/bootstrap/cache
```

### 4. Create `.env` File

```bash
sudo nano /var/www/servetrack/shared/.env
```

Paste your production `.env` contents. **Minimum required variables:**

```
APP_NAME=ServeTrack
APP_ENV=production
APP_DEBUG=false
APP_KEY=base64:your-generated-key
APP_URL=https://api.servetrack.quantumapp.tech
FRONTEND_URL=https://servetrack.quantumapp.tech
DB_CONNECTION=mysql
DB_HOST=your-db-host
DB_PORT=3306
DB_DATABASE=your-db-name
DB_USERNAME=your-db-user
DB_PASSWORD=your-db-password
CACHE_STORE=file
QUEUE_CONNECTION=database
SESSION_DRIVER=database
SESSION_DOMAIN=.servetrack.quantumapp.tech
SANCTUM_STATEFUL_DOMAINS=servetrack.quantumapp.tech
```

**Generate APP_KEY if missing:**
```bash
php -r "echo 'base64:' . base64_encode(random_bytes(32)) . PHP_EOL;"
```

### 5. Secure `.env` Permissions

```bash
sudo chmod 640 /var/www/servetrack/shared/.env
sudo chown root:www-data /var/www/servetrack/shared/.env
```

### 6. Verify Setup

```bash
ls -la /var/www/servetrack/
ls -la /var/www/servetrack/shared/
sudo -u www-data test -r /var/www/servetrack/shared/.env && echo ".env readable by www-data ✓"
sudo -u www-data test -w /var/www/servetrack/shared/backend/storage && echo "storage writable by www-data ✓"
```

---

## Deploy History

| Date | Release Timestamp | Status | Notes |
|------|-------------------|--------|-------|
| — | — | — | — |
