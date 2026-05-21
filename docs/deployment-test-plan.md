# ServeTrack Deployment Test Plan

## Pre-Flight Checks (before first deploy)

Run these on the VPS to verify setup:

```bash
# 1. Directory structure exists
ls -la /var/www/servetrack/releases/
ls -la /var/www/servetrack/shared/.env

# 2. .env is readable by www-data
sudo -u www-data head -1 /var/www/servetrack/shared/.env

# 3. PHP-FPM is running
systemctl status php8.3-fpm --no-pager | head -5

# 4. Nginx config is valid
sudo nginx -t

# 5. Services restart without issues
sudo systemctl reload php8.3-fpm
sudo systemctl reload nginx

# 6. Health endpoint works
curl -s -o /dev/null -w "%{http_code}" https://api.servetrack.quantumapp.tech/up
```

---

## Test Scenarios

### Test 1: Happy Path — Successful Deployment

1. Push a commit to `main` (or trigger `workflow_dispatch`)
2. Verify workflow completes green
3. On VPS:
   ```bash
   # Verify new release was created
   ls -la /var/www/servetrack/releases/
   
   # Verify current symlink points to latest
   readlink -f /var/www/servetrack/current
   
   # Verify .env symlink exists
   ls -la /var/www/servetrack/current/backend/.env
   
   # Verify storage symlink
   ls -la /var/www/servetrack/current/backend/storage
   
   # Verify Laravel cached config exists
   cat /var/www/servetrack/current/backend/bootstrap/cache/config.php > /dev/null && echo "cached config ✓"
   
   # Verify health endpoint returns 200
   curl -s -o /dev/null -w "%{http_code}" https://api.servetrack.quantumapp.tech/up
   ```

### Test 2: Rollback — If New Release Fails Health Check

1. Trigger deployment
2. Simulate failure during Step 8 (health check) by... (hard to simulate, but verify rollback logic):

   On VPS, check that rollback properly restores previous symlink:
   ```bash
   # After a failed deploy, verify:
   readlink -f /var/www/servetrack/current  
   # Should point to PREVIOUS release, not failed one
   
   # Verify failed release was cleaned up
   ls /var/www/servetrack/releases/
   # Failed release should NOT be present (cleaned up by error handler)
   ```

### Test 3: Missing `.env` — Deployment Should Fail Immediately

1. Remove `.env` on VPS: `sudo mv /var/www/servetrack/shared/.env /tmp/test-bak`
2. Trigger deployment
3. **Expected**: Workflow fails at "Verify Existing Environment File" step with:
   `ERROR: /var/www/servetrack/shared/.env is missing`
4. Restore: `sudo mv /tmp/test-bak /var/www/servetrack/shared/.env`

### Test 4: Nginx Config Failure — Deployment Should Halt Before Swap

1. Corrupt the nginx config in the archive (or simulate on VPS)
2. **Expected**: Step 5 (`sudo nginx -t`) fails → trap triggered → `ATOMIC_SWAP_COMPLETED=false`
3. **Result**: Live site unaffected, original nginx config preserved
4. Failed release directory cleaned up

### Test 5: PHP-FPM Not Running — Preflight Should Catch

1. Stop PHP-FPM: `sudo systemctl stop php8.3-fpm`
2. Trigger deployment
3. **Expected**: Fails at Step 1.5 preflight: `ERROR: PHP-FPM service is not active`
4. Restart: `sudo systemctl start php8.3-fpm`

### Test 6: Release Cleanup — Keeps Last 5

1. Deploy successfully 6+ times (or create dummy release dirs)
2. Verify: `ls -1 /var/www/servetrack/releases/ | wc -l` = 5

---

## Manual Verification Checklist

After each successful deployment:

- [ ] `curl -I https://api.servetrack.quantumapp.tech/up` returns `200`
- [ ] `readlink -f /var/www/servetrack/current` points to correct timestamp
- [ ] `cat /var/www/servetrack/current/backend/.env` outputs valid config (not empty)
- [ ] `sudo journalctl -u php8.3-fpm -n 10 --no-pager` shows no fatal errors
- [ ] Frontend at https://servetrack.quantumapp.tech loads and can reach API
- [ ] Release count: `ls -1 /var/www/servetrack/releases/ | wc -l` ≤ 5
