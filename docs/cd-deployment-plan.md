# ServeTrack CD Deployment Plan — AWS EC2 + Vercel

## Architecture
```
┌─────────────────┐     ┌─────────────────────────────┐
│  Vercel (Git)   │     │  AWS EC2 (ubuntu@54.179…)   │
│                 │     │                             │
│  servetrack.    │     │  api.servetrack.            │
│  quantumapp.tech│     │  quantumapp.tech            │
│                 │     │                             │
│  Angular SPA    │────▶│  Laravel API (port 8000)    │
│  (auto-build    │     │  nginx reverse proxy        │
│   on push main) │     │  systemd: servetrack-backend│
└─────────────────┘     └─────────────────────────────┘
```

## Files to Modify (3)

### 1. `.github/workflows/cd.yml`

**Remove these steps entirely (~40 lines):**
- `Setup Node.js` — Vercel handles frontend
- `Build Frontend` (`npm ci` + `npm run build`)
- `Verify Frontend Build`
- `Prepare prod branch` — was Hostinger KVM1 workaround (orphan branch + push)
- Frontend copy from archive creation
- `Testing Frontend via Nginx` health check step

**Fix `.env` domains** (lines 172–213):

| Variable | Current (broken) | New value |
|----------|-----------------|-----------|
| `APP_URL` | `https://${{ secrets.APP_DOMAIN }}` | `https://api.servetrack.quantumapp.tech` |
| `FRONTEND_URL` | `${{ secrets.FRONTEND_URL }}` | `https://servetrack.quantumapp.tech` |
| `SANCTUM_STATEFUL_DOMAINS` | `${{ secrets.APP_DOMAIN }}` | `servetrack.quantumapp.tech` |
| `CORS_ALLOWED_ORIGINS` | `https://${{ secrets.APP_DOMAIN }}` | `https://servetrack.quantumapp.tech` |
| `ADMIN_ALLOWED_DOMAINS` | `${{ secrets.APP_DOMAIN }}` | `servetrack.quantumapp.tech` |

**Keep with updated secrets:**
- `Setup PHP 8.2` + Composer cache — same
- `composer install --no-dev` — same
- `Create Build Archive` — only `backend/`, `config/`, `scripts/`
- `Transfer Archive` — SCP to EC2 (secrets updated)
- `Deploy Environment File` — SSH, create `.env`
- `Execute Atomic Deployment` — SSH, run deploy.sh — same
- `Verify Deployment` — health check `http://127.0.0.1:8000/up` — same
- `Rollback on Verification Failure` — same

### 2. `config/servetrack-nginx.conf`

Replace entire file with API-only reverse proxy:

```nginx
server {
    listen 80;
    server_name api.servetrack.quantumapp.tech;

    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/html;
        default_type text/plain;
        allow all;
    }

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    location ~ /\. { deny all; }
}
```

Key removals vs current:
- No `root` or `index` — SPA not served here
- No `try_files $uri /index.html` — SPA routing on Vercel
- No location blocks for `/api/`, `/sanctum/`, `/up` — all proxy to Laravel via single `/`
- No static asset cache block — assets served by Vercel

### 3. `scripts/deploy.sh`

**Line 111 — domain change only:**

```bash
# Before:
if [ ! -f /etc/nginx/sites-available/servetrack ] || [ ! -d /etc/letsencrypt/live/servetrack.kaelvxdev.space ]; then

# After:
if [ ! -f /etc/nginx/sites-available/servetrack ] || [ ! -d /etc/letsencrypt/live/api.servetrack.quantumapp.tech ]; then
```

Everything else in deploy.sh stays — the atomic symlink flow, shared assets, migrations, health check, cleanup. The backup system (last 5 releases in `/var/www/servetrack/releases/`) is untouched.

## GitHub Secrets to Update

| Secret | Value |
|--------|-------|
| `VPS_HOST` | `54.179.45.198` |
| `VPS_USERNAME` | `ubuntu` |
| `VPS_SSH_KEY` | contents of `Capstone-Production-VPS-keypair.pem` |
| `VPS_SSH_PORT` | `51767` |
| `APP_DOMAIN` | `servetrack.quantumapp.tech` |
| `FRONTEND_URL` | `https://servetrack.quantumapp.tech` |

All other secrets (`APP_KEY`, `DB_HOST`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`, `ADMIN_INVITE_CODE`, `MAIL_*`) stay unchanged.

## One-Time Server Setup (before first CD run)

The deploy script expects `shared/` and `releases/` directories:

```bash
ssh -i "Capstone-Production-VPS-keypair.pem" -p 51767 ubuntu@54.179.45.198

# Create shared directory structure
sudo mkdir -p /var/www/servetrack/shared/backend/storage
sudo chown -R www-data:www-data /var/www/servetrack/shared

# Remove old cloned files that clash with releases/ structure
# (keep config/ scripts/ for reference, move backend/ out of the way)
sudo mv /var/www/servetrack/backend /var/www/servetrack/backend.old
sudo mv /var/www/servetrack/servetrack-backend /var/www/servetrack/servetrack-backend.old
sudo mv /var/www/servetrack/servetrack-frontend /var/www/servetrack/servetrack-frontend.old
```

The first CD run will:
1. Create `/var/www/servetrack/shared/.env`
2. Transfer `build.tar.gz` to `/tmp/`
3. Run `deploy.sh` → creates `releases/{timestamp}/`, extracts, migrates, swaps `current` symlink

## Backup System (Already Working)

The `releases/` directory IS the backup system:
- Each deploy creates `/var/www/servetrack/releases/{YYYYMMDD_HHMMSS}/`
- `current` symlink points to the active release
- Old releases beyond the last 5 are pruned by `deploy.sh`
- `cd.yml` rollback: finds the 2nd-most-recent release and swaps `current` to it

## Files NOT Modified

| File | Reason |
|------|--------|
| `config/servetrack-backend.service` | Still correct — runs `php artisan serve` on `127.0.0.1:8000` |
| `scripts/deploy.sh` (except line 111) | Already frontend-agnostic |
| All frontend files | Vercel handles via Git integration |
| Frontend `environment.prod.ts` | Already points to `https://api.servetrack.quantumapp.tech/api` ✓ |
| Composer deps, CI workflow | Unrelated |
