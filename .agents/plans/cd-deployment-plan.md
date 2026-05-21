# ServeTrack CD Deployment Plan — AWS EC2 + Vercel (PHP-FPM Edition)

> **Updated May 21, 2026** | Research-backed approach using industry-standard PHP-FPM (NOT `php artisan serve`)

## Executive Summary

This plan implements **zero-downtime atomic deployments** for a decoupled architecture:
- **Frontend**: Vercel (Angular 21 SPA) — auto-deploys from `main` branch
- **Backend**: AWS EC2 (Laravel 12 API) — atomic releases via GitHub Actions CD pipeline

**Architecture philosophy**: Keep PHP-FPM (production-grade, multi-threaded), use atomic symlinks for zero-downtime releases, eliminate the development-only `php artisan serve` server.

---

## Architecture Diagram

```
┌─────────────────┐     ┌──────────────────────────────────────┐
│  Vercel (Git)   │     │  AWS EC2 (ubuntu@54.179.45.198)      │
│                 │     │                                      │
│  servetrack.    │     │  api.servetrack.quantumapp.tech      │
│  quantumapp.tech│     │                                      │
│                 │     │  Nginx (reverse proxy on port 443)   │
│  Angular 21 SPA │     │        ↓                             │
│  (auto-build    │     │  PHP-FPM (127.0.0.1:9000)            │
│   on push main) │────▶│        ↓                             │
│                 │     │  MySQL 8.0 (localhost:3306)          │
└─────────────────┘     │                                      │
                        │  Atomic Releases:                    │
                        │  /var/www/servetrack/                │
                        │  ├── current → releases/20260521...  │
                        │  ├── releases/                       │
                        │  │   ├── 20260520.../                │
                        │  │   └── 20260521.../  (live)        │
                        │  └── shared/                         │
                        │      ├── .env                        │
                        │      └── storage/                    │
                        └──────────────────────────────────────┘
```

---

## Core Components

### 1. Nginx Configuration (`config/servetrack-nginx.conf`)

**Why PHP-FPM, not reverse proxy to `php artisan serve`?**
- ✅ **Production standard**: Used by 99%+ of Laravel deployments
- ✅ **Multi-threaded**: Handles concurrent requests; `php artisan serve` = single-threaded
- ✅ **Performance**: Battle-tested for production traffic
- ✅ **Security**: Purpose-built for production environments
- ❌ `php artisan serve` is development-only (Laravel docs confirm NOT for production)

**Current nginx config** (on EC2) uses PHP-FPM directly via `fastcgi_pass`. Keep this approach — it's correct.

**Replace `/etc/nginx/sites-available/api.servetrack.quantumapp.tech` with:**

```nginx
upstream php_fpm {
    server 127.0.0.1:9000;
}

server {
    listen 80;
    listen [::]:80;
    server_name api.servetrack.quantumapp.tech;

    # Certbot redirect to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.servetrack.quantumapp.tech;

    # SSL certs (managed by Certbot, DO NOT modify)
    ssl_certificate /etc/letsencrypt/live/api.servetrack.quantumapp.tech/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.servetrack.quantumapp.tech/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    root /var/www/servetrack/current/backend/public;
    index index.php;

    client_max_body_size 25m;
    charset utf-8;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # ACME challenge for Certbot renewal
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/html;
        default_type text/plain;
        allow all;
    }

    # Laravel routing
    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    # Deny access to hidden files
    location ~ /\. {
        deny all;
    }

    # PHP-FPM handler
    location ~ ^/index\.php(/|$) {
        fastcgi_pass php_fpm;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
        fastcgi_hide_header X-Powered-By;

        # FastCGI caching (optional, improves performance)
        fastcgi_cache_bypass $http_pragma $http_authorization;
        add_header X-Cache-Status $upstream_cache_status;
    }

    # Static file caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Favicon and robots.txt
    location = /favicon.ico { access_log off; log_not_found off; }
    location = /robots.txt  { access_log off; log_not_found off; }
}
```

**Key differences from typical nginx + Laravel config:**
- Uses `upstream php_fpm` to define the PHP-FPM socket/address
- `root` points to current release's public directory (updated by atomic deployment)
- `fastcgi_pass php_fpm` sends requests to PHP-FPM, NOT reverse proxy
- SSL managed by Certbot (DO NOT touch)

---

### 2. GitHub Actions Workflow (`.github/workflows/cd.yml`)

**Major changes from current:**

#### Remove these steps (no longer needed):
- ❌ Setup Node.js — Vercel handles frontend
- ❌ Build Frontend — Vercel handles via Git integration
- ❌ Verify Frontend Build — N/A
- ❌ Prepare prod branch — old workaround, no longer needed
- ❌ "Testing Frontend via Nginx" — Vercel deploys separately

#### Fix `.env` domain variables (lines ~172–213):

| Variable | Current (broken) | New value | Reason |
|----------|-----------------|-----------|--------|
| `APP_URL` | `https://${{ secrets.APP_DOMAIN }}` | `https://api.servetrack.quantumapp.tech` | Hardcoded; backend runs on this domain |
| `FRONTEND_URL` | `${{ secrets.FRONTEND_URL }}` | `https://servetrack.quantumapp.tech` | Hardcoded; frontend is on Vercel subdomain |
| `SANCTUM_STATEFUL_DOMAINS` | `${{ secrets.APP_DOMAIN }}` | `servetrack.quantumapp.tech` | Must match Vercel domain (no /api suffix) |
| `CORS_ALLOWED_ORIGINS` | `https://${{ secrets.APP_DOMAIN }}` | `https://servetrack.quantumapp.tech` | Hardcoded Vercel frontend URL |
| `ADMIN_ALLOWED_DOMAINS` | `${{ secrets.APP_DOMAIN }}` | `servetrack.quantumapp.tech` | Hardcoded; used for admin-only routes |
| `SESSION_DOMAIN` | *(missing)* | `.quantumapp.tech` | **ADD THIS**: Cookie domain for cross-subdomain sharing |

#### Update backend health check (line ~284):

**Current:**
```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/up
```

**Changed to test via nginx:**
```bash
curl -s -o /dev/null -w "%{http_code}" https://api.servetrack.quantumapp.tech/up
```

Or **keep direct check** (if nginx is still warming up). Either works.

#### Update rollback step (line ~328):

No changes needed — rollback already finds 2nd-most-recent release and swaps symlink.

#### Keep as-is:
- ✅ Checkout main branch
- ✅ Setup PHP 8.2 + Composer cache
- ✅ `composer install --no-dev --optimize-autoloader`
- ✅ Create archive (backend/, config/, scripts/ only)
- ✅ SCP to EC2
- ✅ Deploy `.env` file to shared/
- ✅ Execute atomic deployment (deploy.sh)
- ✅ Rollback on failure

---

### 3. Deployment Script (`scripts/deploy.sh`)

**Minimal changes:**

Line ~111 — Update domain for SSL cert check:

```bash
# BEFORE:
if [ ! -f /etc/nginx/sites-available/servetrack ] || [ ! -d /etc/letsencrypt/live/servetrack.kaelvxdev.space ]; then

# AFTER:
if [ ! -f /etc/nginx/sites-available/servetrack ] || [ ! -d /etc/letsencrypt/live/api.servetrack.quantumapp.tech ]; then
```

**Add after nginx config update** (line ~115):

```bash
# Restart PHP-FPM (not systemd service for Laravel)
echo "Restarting PHP-FPM..."
sudo systemctl restart php8.3-fpm
```

**Everything else stays** — atomic symlink swap, migrations, cache warming, cleanup.

---

### 4. Verify files NOT modified

| File | Reason |
|------|--------|
| `config/servetrack-backend.service` | ❌ Remove/don't deploy this file (NOT used with PHP-FPM approach) |
| `scripts/deploy.sh` (mostly) | ✅ Only line 111 + PHP-FPM restart |
| All frontend files | ✅ Vercel handles entirely via Git |
| `servetrack-frontend/environments/prod.ts` | ✅ Already correct: `https://api.servetrack.quantumapp.tech/api` |
| Composer, CI workflows | ✅ Unchanged |

---

## GitHub Secrets Management

### Current Secrets (from `gh secret list`):

| Secret | Status | Action |
|--------|--------|--------|
| `VPS_HOST` | ✅ Exists | Verify = `54.179.45.198` |
| `VPS_USERNAME` | ✅ Exists | Verify = `ubuntu` |
| `VPS_SSH_KEY` | ✅ Exists | Verify = contents of `.pem` file |
| `VPS_SSH_PORT` | ✅ Exists | Verify = `51767` |
| `APP_DOMAIN` | ✅ Exists | **Update** → `servetrack.quantumapp.tech` |
| `FRONTEND_URL` | ✅ Exists | **Update** → `https://servetrack.quantumapp.tech` |
| `APP_KEY` | ✅ Exists | ✅ Keep unchanged |
| `DB_HOST`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` | ✅ Exist | ✅ Keep unchanged |
| `ADMIN_INVITE_CODE` | ✅ Exists | ✅ Keep unchanged |
| `VPS_SSH_KNOWN_HOSTS` | ✅ Exists | ✅ Keep unchanged |
| `MAIL_*` (MAILER, HOST, PORT, USERNAME, PASSWORD, FROM_ADDRESS) | ❌ Missing | ⏭️ Skip for now (SMTP not configured) |

### Secrets Rotation Schedule (Best Practice)

From **Blacksmith.sh** (2025 research):
- **Production secrets** (DB_PASSWORD, VPS_SSH_KEY): Rotate every **30 days**
- **High-risk secrets** (API keys): Rotate every **60 days**
- **Lower-risk** (misc configs): Rotate every **90 days**

**Suggested action**: Set up a calendar reminder to rotate secrets on **June 21, 2026** (30 days from now), then quarterly.

### Naming Convention (Best Practice)

Current naming is good. Following standard:
- `VPS_*` — VPS/infrastructure credentials
- `DB_*` — Database credentials
- `APP_*` — Application config
- `MAIL_*` — SMTP credentials
- `ADMIN_*` — Admin-specific settings

---

## One-Time Server Setup (Before First CD Run)

### Step 1: SSH into EC2

```bash
ssh -i "Capstone-Production-VPS-keypair.pem" -p 51767 ubuntu@54.179.45.198
```

### Step 2: Create atomic release structure

```bash
# Create shared directory (for .env and persistent storage)
sudo mkdir -p /var/www/servetrack/shared/backend/storage/framework/{cache/data,sessions,views}
sudo mkdir -p /var/www/servetrack/shared/backend/storage/logs
sudo mkdir -p /var/www/servetrack/shared/backend/storage/app/public
sudo mkdir -p /var/www/servetrack/releases

# Set permissions
sudo chown -R www-data:www-data /var/www/servetrack/shared
sudo chmod -R 775 /var/www/servetrack/shared/backend/storage
```

### Step 3: Archive old files (don't delete in case needed for reference)

```bash
# These will be replaced by atomic releases from CD pipeline
sudo mv /var/www/servetrack/backend /var/www/servetrack/backend.old
sudo mv /var/www/servetrack/servetrack-backend /var/www/servetrack/servetrack-backend.old
sudo mv /var/www/servetrack/servetrack-frontend /var/www/servetrack/servetrack-frontend.old

# Keep config/ and scripts/ for reference (they're in the archive anyway)
```

### Step 4: Copy existing `.env` to shared location

```bash
sudo cp /var/www/servetrack/backend.old/.env /var/www/servetrack/shared/.env
sudo chown root:www-data /var/www/servetrack/shared/.env
sudo chmod 640 /var/www/servetrack/shared/.env
```

### Step 5: Verify PHP-FPM is running

```bash
sudo systemctl status php8.3-fpm

# If not running:
sudo systemctl start php8.3-fpm
sudo systemctl enable php8.3-fpm  # Auto-start on reboot
```

### Step 6: Update Nginx config

```bash
# Backup current config
sudo cp /etc/nginx/sites-available/api.servetrack.quantumapp.tech \
        /etc/nginx/sites-available/api.servetrack.quantumapp.tech.bak

# Nginx config will be deployed from repo in first CD run,
# but you can update manually now if you want to test:
# sudo cp config/servetrack-nginx.conf /etc/nginx/sites-available/servetrack

# Test nginx syntax
sudo nginx -t

# Reload nginx (if config updated)
sudo systemctl reload nginx
```

### Step 7: Verify structure

```bash
# Expected directory tree after CD run:
ls -la /var/www/servetrack/
# Should show: current (symlink), releases/, shared/

cd /var/www/servetrack/current/backend
# Should show full Laravel app

# Verify shared symlinks work:
ls -la /var/www/servetrack/current/backend/.env
ls -la /var/www/servetrack/current/backend/storage
# Should both show symlinks → ../../shared/
```

---

## Atomic Deployment Backup System

The **`releases/` directory IS the backup**:

- Each deploy creates `/var/www/servetrack/releases/{YYYYMMDD_HHMMSS}/`
- The `current` symlink points to the active release
- `deploy.sh` keeps the last **5 releases** for rollback
- Older releases are automatically pruned

### Manual Rollback (if needed)

```bash
cd /var/www/servetrack/releases
ls -lt  # Show releases sorted by date

# Point current to a previous release
sudo ln -nfs /var/www/servetrack/releases/20260520_150000 /var/www/servetrack/current

# Restart PHP-FPM
sudo systemctl restart php8.3-fpm
```

---

## Deployment Flow (Step by Step)

1. **Developer** pushes to `main` branch
2. **GitHub Actions** triggers on push
3. **CD Workflow**:
   - Checkout code
   - Install Composer dependencies (`--no-dev`)
   - Create archive: `staging/backend/`, `staging/config/`, `staging/scripts/`
   - SCP archive to EC2 `/tmp/build.tar.gz`
   - SSH: Create `.env` in `/var/www/servetrack/shared/`
   - SSH: Run `deploy.sh`
4. **deploy.sh** (on EC2):
   - Extract archive to `/var/www/servetrack/releases/{timestamp}/`
   - Symlink `.env` and `storage/` from shared/
   - Run `php artisan migrate --force`
   - Run `php artisan optimize` (cache config, routes, views, events)
   - **Atomic swap**: Update `current` symlink to new release
   - Restart PHP-FPM
   - Health check on `/up`
   - Cleanup old releases (keep last 5)
5. **On success**: 🎉 Live!
6. **On failure**: Rollback to previous release automatically

---

## Verification Checklist (Before First CD Run)

- [ ] `.env` exists at `/var/www/servetrack/shared/.env`
- [ ] `shared/backend/storage/` exists with proper permissions
- [ ] `releases/` directory exists and is empty
- [ ] `current` symlink doesn't exist yet (will be created by deploy.sh)
- [ ] PHP-FPM running: `sudo systemctl is-active php8.3-fpm`
- [ ] Nginx running: `sudo systemctl is-active nginx`
- [ ] SSL certs exist: `ls /etc/letsencrypt/live/api.servetrack.quantumapp.tech/`
- [ ] GitHub secrets updated (VPS_HOST, VPS_USERNAME, VPS_SSH_PORT, VPS_SSH_KEY)
- [ ] GitHub secrets verified (APP_DOMAIN, FRONTEND_URL)

---

## Troubleshooting

### "PHP-FPM is not responding"
```bash
sudo systemctl status php8.3-fpm
sudo systemctl restart php8.3-fpm
sudo tail -f /var/log/php8.3-fpm.log
```

### "Symlink swap failed"
```bash
# Check if releases dir exists and is writable
ls -la /var/www/servetrack/releases/

# Check nginx access to current directory
sudo -u www-data test -r /var/www/servetrack/current && echo "Readable" || echo "NOT readable"
```

### "500 Internal Server Error"
```bash
# Check Laravel logs
sudo tail -f /var/www/servetrack/current/backend/storage/logs/laravel.log

# Check PHP-FPM errors
sudo tail -f /var/log/php8.3-fpm.log
```

### "Database migration failed"
```bash
# SSH to server and run manually to debug
cd /var/www/servetrack/current/backend
php artisan migrate --force --verbose
```

---

## Research References

This plan is based on industry best practices from:
- **Steve Grunwell** (2019): "Atomic Deployments from Scratch" — symlink swap pattern
- **DeployHQ** (2026): "Zero-Downtime Laravel Deployments" — atomic releases
- **Laravel Docs** (2025): Deployment guide — PHP-FPM recommended, `php artisan serve` NOT for production
- **Blacksmith.sh** (2025): GitHub Secrets best practices — rotation, access control
- **Stack Overflow** (recurring): "php artisan serve is NOT to be used in production"

**Key decision: PHP-FPM (production) vs. `php artisan serve` (development)**
- PHP-FPM: Multi-threaded, handles concurrent requests, industry standard
- `php artisan serve`: Single-threaded, sequential requests, development only

---

## Next Steps

1. **Update GitHub secrets** → Verify APP_DOMAIN and FRONTEND_URL are correct
2. **Run one-time server setup** → Create shared/ and releases/ directories
3. **Update `.github/workflows/cd.yml`** → Remove frontend build, fix env vars, update health checks
4. **Update `config/servetrack-nginx.conf`** → PHP-FPM config (already matches current setup mostly)
5. **Update `scripts/deploy.sh`** → Line 111 + PHP-FPM restart
6. **Push to main** → First CD run!
7. **Verify**: Test admin signup and volunteer signup end-to-end
8. **Monitor**: First few deployments; check logs for any issues

---

**Document version**: 2.0 (PHP-FPM Edition)  
**Updated**: May 21, 2026  
**Status**: Ready for implementation
