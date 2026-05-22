# RSVP Auto-Close Cron Setup — AWS EC2

**Server:** `ubuntu@54.179.45.198:51767`  
**App Path:** `/var/www/servetrack/`  
**PHP:** 8.3.6 | **Laravel:** 12 | **Queue Driver:** database  
**Date Plan Created:** May 22, 2026  
**Last Reviewed:** May 22, 2026  
**Status:** ⏳ Planned — not yet implemented

---

## Current State

| Component | Status | Notes |
|-----------|--------|-------|
| App deployed | ✅ | 3 atomic releases, `current` symlink active |
| PHP-FPM | ✅ | `php8.3-fpm` active |
| Nginx | ✅ | Active with SSL via Let's Encrypt |
| `.env: QUEUE_CONNECTION` | ✅ | Set to `database` |
| `.env: MAIL_MAILER` | ✅ | Set to `smtp` |
| Supervisor | ❌ | Not installed |
| Crontab | ❌ | No entries |
| RSVP auto-close schedule in code | ✅ | `bootstrap/app.php:28` — runs every 3 min |
| `jobs` DB table | ✅ | Migration `0001_01_01_000002_create_jobs_table.php` exists |
| `failed_jobs` DB table | ❌ | No migration yet — will create |

---

## Architecture Diagram (After Setup)

```
Cron (every minute)
  └─→ php artisan schedule:run
        └─→ [Every 3 min] rsvp:close-expired
              └─→ RsvpAutoCloseService::closeExpiredRsvps()
                    ├─→ Query: RSVPs WHERE status=active AND cutoff passed
                    ├─→ For each: update status=closed + audit trail
                    └─→ Queue email notifications (jobs table)

Supervisor (always running)
  └─→ php artisan queue:work database
        └─→ Reads jobs table → delivers emails (queued mailables)
```

---

## Step-by-Step Implementation

### Step 1: SSH into EC2

```bash
ssh -i "Capstone-Production-VPS-keypair.pem" -p 51767 ubuntu@54.179.45.198
```

### Step 2: Verify the RSVP Command Works

```bash
cd /var/www/servetrack/current/backend
sudo -u www-data php artisan rsvp:close-expired
```

**Expected output:** `Checking for RSVP events that need to be auto-closed...` followed by either a count or "No RSVP events needed to be auto-closed."

### Step 3: Install Supervisor

```bash
sudo apt update
sudo apt install -y supervisor
sudo systemctl enable supervisor
sudo systemctl start supervisor
```

### Step 4: Create Queue Worker Config

```bash
sudo tee /etc/supervisor/conf.d/servetrack-queue-worker.conf << 'CONFIG'
[program:servetrack-queue-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/servetrack/current/backend/artisan queue:work database --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
numprocs=1
redirect_stderr=true
stdout_logfile=/var/log/supervisor/servetrack-queue-worker.log
stopwaitsecs=3600
user=www-data
CONFIG
```

**Notes:**
- `killasgroup=true` ensures child processes are killed on restart (matching Laravel docs example).
- `stopwaitsecs=3600` allows up to 1 hour for long-running jobs to finish before Supervisor kills them.
- `numprocs=1` is sufficient for initial deployment; scale up by increasing this value if queue backlog grows.

### Step 5: Start Supervisor Queue Worker

```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start servetrack-queue-worker:*
```

### Step 6: Verify Queue Worker Is Running

```bash
sudo supervisorctl status
```

**Expected output:**
```
servetrack-queue-worker:servetrack-queue-worker_00   RUNNING   pid 12345, uptime 0:00:XX
```

### Step 7: Create Failed Jobs Table

The `failed_jobs` table allows inspecting and retrying failed queue jobs.

```bash
cd /var/www/servetrack/current/backend
sudo -u www-data php artisan make:queue-failed-table
sudo -u www-data php artisan migrate --force
```

**Note:** The `jobs` table migration already exists (`0001_01_01_000002_create_jobs_table.php`) and was run during deployment migration steps.

### Step 8: Add Crontab Entry

```bash
sudo crontab -e
```

Add this line at the end of the file:

```
* * * * * cd /var/www/servetrack/current/backend && php artisan schedule:run >> /dev/null 2>&1
```

### Step 9: Verify Crontab

```bash
sudo crontab -l
```

**Expected output:**
```
* * * * * cd /var/www/servetrack/current/backend && php artisan schedule:run >> /dev/null 2>&1
```

### Step 10: End-to-End Verification

```bash
# 1. Run the auto-close command
sudo -u www-data php artisan rsvp:close-expired

# 2. Check supervisor logs for any errors
sudo tail -f /var/log/supervisor/servetrack-queue-worker.log

# 3. Check Laravel logs
sudo tail -f /var/www/servetrack/shared/backend/storage/logs/laravel.log

# 4. Verify cron is active
sudo systemctl status cron

# 5. Verify cron entry exists
sudo crontab -l
```

---

## Update `deploy.sh` for Supervisor Restart

After each deployment, the queue worker must be restarted to pick up new code.

**File:** `scripts/deploy.sh`

Add **after** the health check (currently line ~204, after `echo "✓ Backend health check passed..."` block and before `# Step 9: Cleanup`):

```bash
# Restart queue worker to pick up new code
echo "Restarting queue worker..."
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl restart servetrack-queue-worker:* || true
```

---

## Rollback Steps

If something goes wrong:

```bash
# Remove crontab
sudo crontab -e  # Delete or comment out the line

# Stop queue worker
sudo supervisorctl stop servetrack-queue-worker:*

# Remove supervisor config
sudo rm /etc/supervisor/conf.d/servetrack-queue-worker.conf
sudo supervisorctl reread
sudo supervisorctl update
```
