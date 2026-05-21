# ServeTrack Deployment Verification Checklist

**Architecture**: AWS EC2 (Backend) + Vercel (Frontend)  
**Last Updated**: May 21, 2026

---

## Pre-Deployment Server Setup (One-Time)

### 1. SSH Access
```bash
ssh -i "Capstone-Production-VPS-keypair.pem" -p 51767 ubuntu@54.179.45.198
```

### 2. Create Atomic Release Structure
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

### 3. Archive Old Files
```bash
# These will be replaced by atomic releases from CD pipeline
sudo mv /var/www/servetrack/backend /var/www/servetrack/backend.old 2>/dev/null || true
sudo mv /var/www/servetrack/servetrack-backend /var/www/servetrack/servetrack-backend.old 2>/dev/null || true
sudo mv /var/www/servetrack/servetrack-frontend /var/www/servetrack/servetrack-frontend.old 2>/dev/null || true
```

### 4. Copy Existing .env to Shared Location
```bash
# If you have an existing .env, copy it
sudo cp /var/www/servetrack/backend.old/.env /var/www/servetrack/shared/.env 2>/dev/null || true
sudo chown root:www-data /var/www/servetrack/shared/.env
sudo chmod 640 /var/www/servetrack/shared/.env
```

### 5. Verify PHP-FPM is Running
```bash
sudo systemctl status php8.3-fpm

# If not running:
sudo systemctl start php8.3-fpm
sudo systemctl enable php8.3-fpm  # Auto-start on reboot
```

### 6. Verify Directory Structure
```bash
# Expected structure:
ls -la /var/www/servetrack/
# Should show: releases/, shared/

# After first deployment, should also show:
# current -> releases/{timestamp}/
```

---

## GitHub Secrets Verification

### Required Secrets
- [ ] `VPS_HOST` = `54.179.45.198`
- [ ] `VPS_USERNAME` = `ubuntu`
- [ ] `VPS_SSH_KEY` = contents of `Capstone-Production-VPS-keypair.pem`
- [ ] `VPS_SSH_PORT` = `51767`
- [ ] `VPS_SSH_KNOWN_HOSTS` = (generated from `ssh-keyscan`)
- [ ] `APP_KEY` = Laravel encryption key (base64:...)
- [ ] `DB_HOST` = MySQL host
- [ ] `DB_DATABASE` = Database name
- [ ] `DB_USERNAME` = Database user
- [ ] `DB_PASSWORD` = Database password
- [ ] `ADMIN_INVITE_CODE` = Admin registration code

### Verify Secrets
```bash
# List all secrets (values are hidden)
gh secret list --repo PUPT-Quantum-Leap/capstone-nlcom-volunteer-management-system
```

---

## Pre-Deployment Checklist

### Server Verification
- [ ] `.env` exists at `/var/www/servetrack/shared/.env`
- [ ] `shared/backend/storage/` exists with proper permissions (775, www-data:www-data)
- [ ] `releases/` directory exists
- [ ] PHP-FPM running: `sudo systemctl is-active php8.3-fpm`
- [ ] Nginx running: `sudo systemctl is-active nginx`
- [ ] SSL certs exist: `ls /etc/letsencrypt/live/api.servetrack.quantumapp.tech/`
- [ ] MySQL running: `sudo systemctl is-active mysql`

### GitHub Verification
- [ ] All required secrets are set
- [ ] CD workflow file (`.github/workflows/cd.yml`) is updated
- [ ] Deploy script (`scripts/deploy.sh`) is updated
- [ ] Nginx config (`config/servetrack-nginx.conf`) is updated

### Code Verification
- [ ] All tests pass locally: `cd servetrack-backend && php artisan test`
- [ ] No uncommitted changes: `git status`
- [ ] On `main` branch: `git branch --show-current`

---

## Deployment Process

### 1. Trigger Deployment
```bash
# Push to main branch
git push origin main

# Or manually trigger via GitHub Actions UI
```

### 2. Monitor Deployment
```bash
# Watch GitHub Actions workflow
gh run watch

# Or view in browser:
# https://github.com/PUPT-Quantum-Leap/capstone-nlcom-volunteer-management-system/actions
```

### 3. SSH to Server During Deployment (Optional)
```bash
ssh -i "Capstone-Production-VPS-keypair.pem" -p 51767 ubuntu@54.179.45.198

# Watch logs
sudo journalctl -u php8.3-fpm -f
```

---

## Post-Deployment Verification

### 1. Check Services
```bash
ssh -i "Capstone-Production-VPS-keypair.pem" -p 51767 ubuntu@54.179.45.198

# Verify services are running
sudo systemctl is-active php8.3-fpm nginx mysql

# Check PHP-FPM logs
sudo journalctl -u php8.3-fpm -n 50 --no-pager

# Check nginx logs
sudo tail -f /var/log/nginx/error.log
```

### 2. Verify Deployment Structure
```bash
# Check current symlink points to latest release
ls -la /var/www/servetrack/current

# Check releases directory
ls -lt /var/www/servetrack/releases/

# Verify shared symlinks
ls -la /var/www/servetrack/current/backend/.env
ls -la /var/www/servetrack/current/backend/storage
```

### 3. Test Backend Health
```bash
# From server
curl -I https://api.servetrack.quantumapp.tech/up

# From local machine
curl -I https://api.servetrack.quantumapp.tech/up

# Expected: HTTP/2 200
```

### 4. Test Frontend (Vercel)
```bash
# From local machine
curl -I https://servetrack.quantumapp.tech

# Expected: HTTP/2 200
```

### 5. Test End-to-End Flow
- [ ] Visit https://servetrack.quantumapp.tech
- [ ] Frontend loads without errors (check browser console)
- [ ] Login page loads
- [ ] Test login with valid credentials
- [ ] Test API calls work (check Network tab)
- [ ] Test volunteer signup flow
- [ ] Test admin dashboard access

### 6. Check Laravel Logs
```bash
ssh -i "Capstone-Production-VPS-keypair.pem" -p 51767 ubuntu@54.179.45.198

# Check Laravel logs
sudo tail -f /var/www/servetrack/current/backend/storage/logs/laravel.log
```

---

## Rollback Procedure

### Automatic Rollback
If deployment fails, GitHub Actions will automatically rollback to the previous release.

### Manual Rollback
```bash
ssh -i "Capstone-Production-VPS-keypair.pem" -p 51767 ubuntu@54.179.45.198

# List releases
cd /var/www/servetrack/releases
ls -lt

# Point current to a previous release
sudo ln -nfs /var/www/servetrack/releases/{YYYYMMDD_HHMMSS} /var/www/servetrack/current

# Restart PHP-FPM
sudo systemctl restart php8.3-fpm

# Reload nginx
sudo nginx -t && sudo systemctl reload nginx

# Verify
curl -I https://api.servetrack.quantumapp.tech/up
```

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

# Check nginx errors
sudo tail -f /var/log/nginx/error.log
```

### "Database migration failed"
```bash
# SSH to server and run manually to debug
cd /var/www/servetrack/current/backend
sudo -u www-data php artisan migrate --force --verbose
```

### "Permission denied on storage/"
```bash
# Fix storage permissions
sudo chown -R www-data:www-data /var/www/servetrack/shared/backend/storage
sudo chmod -R 775 /var/www/servetrack/shared/backend/storage
```

---

## Secrets Rotation Schedule

**Production secrets should be rotated every 30 days.**

### Next Rotation Date: June 21, 2026

### Secrets to Rotate:
- [ ] `DB_PASSWORD` (MySQL root password)
- [ ] `VPS_SSH_KEY` (EC2 keypair)
- [ ] `APP_KEY` (Laravel encryption key)
- [ ] `ADMIN_INVITE_CODE` (Admin registration code)

### Rotation Procedure:
1. Generate new secret value
2. Update on server (`.env` file or system config)
3. Update GitHub secret
4. Test deployment
5. Document rotation date

---

## Emergency Contacts

- **DevOps Lead**: [Your Name]
- **Backend Lead**: [Your Name]
- **AWS Account**: [Account ID]
- **Vercel Account**: [Account Email]

---

## Deployment History

| Date | Release | Status | Notes |
|------|---------|--------|-------|
| 2026-05-21 | Initial | Pending | First deployment with PHP-FPM |

---

**Document Version**: 1.0  
**Last Updated**: May 21, 2026
