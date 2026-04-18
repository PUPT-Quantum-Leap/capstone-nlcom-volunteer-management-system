# DEPLOYMENT-CRITICAL INFORMATION

## QUICK DEPLOY GUIDE

### Prerequisites Checklist
```
✓ Ubuntu 22.04 LTS VPS with 2GB+ RAM
✓ SSH access to server
✓ Docker & Docker Compose installed
✓ Domain name (with DNS pointing to VPS IP)
✓ SSL certificate (or use Let's Encrypt)
```

### Environment Variables to Set (Before Deployment)

**Backend (.env file in servetrack-backend/):**
```bash
APP_NAME=ServeTrack
APP_ENV=production
APP_KEY=base64:xxxxx          # Generate: php artisan key:generate
APP_DEBUG=false
APP_URL=https://yourdomain.com

# Database
DB_CONNECTION=mysql
DB_HOST=mysql                  # Docker service name
DB_PORT=3306
DB_DATABASE=servetrack
DB_USERNAME=servetrack
DB_PASSWORD=your_secure_password

# Security
ADMIN_INVITE_CODE=YourSecureCode123!
ADMIN_ALLOWED_DOMAINS=yourdomain.com

# Optional but Recommended
REDIS_HOST=redis
QUEUE_CONNECTION=redis
CACHE_DRIVER=redis

# Email Configuration
MAIL_MAILER=smtp
MAIL_HOST=your-smtp-host
MAIL_PORT=587
MAIL_USERNAME=your-email@example.com
MAIL_PASSWORD=your-app-password
MAIL_ENCRYPTION=tls

# OAuth (if using Facebook login)
FACEBOOK_APP_ID=your_app_id
FACEBOOK_APP_SECRET=your_app_secret

# Twilio (if using SMS)
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE=+1234567890
```

### Docker Compose Production Deploy Steps

```bash
# 1. Clone repository
git clone https://github.com/PUPT-Quantum-Leap/capstone-nlcom-volunteer-management-system.git
cd capstone-nlcom-volunteer-management-system

# 2. Configure environment
cp servetrack-backend/.env.example servetrack-backend/.env
# Edit .env with your production values

# 3. Build images
docker-compose -f docker-compose.prod.yml build

# 4. Start services (migrations run automatically)
docker-compose -f docker-compose.prod.yml up -d

# 5. Verify deployment
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs migrate

# 6. Test endpoints
curl http://localhost/api/health    # If no reverse proxy
curl https://yourdomain.com/        # Through Nginx

# 7. Stop/Restart services
docker-compose -f docker-compose.prod.yml stop
docker-compose -f docker-compose.prod.yml restart
```

---

## CRITICAL DEPLOYMENT INFORMATION

### Database Migrations
- **Automatic:** Runs via separate `migrate` service on first deploy
- **Location:** servetrack-backend/database/migrations/
- **Total:** 38 migration files
- **Key Tables:**
  - users (with soft deletes)
  - volunteers (with soft deletes)
  - volunteer_availability, volunteer_skill, volunteer_training (many-to-many)
  - attendances (with performance indexes)
  - rsvp, rsvp_option, rsvp_vote (formerly polls)
  - emergency_contacts
  - profile_change_logs (audit trail)

### Services & Ports

**Docker Compose Services:**
```
nginx      → Port 80 (HTTP), 443 (HTTPS)
frontend   → Internal only (served via Nginx)
backend    → Port 9000 internal (PHP-FPM)
mysql      → Port 3306 internal only
```

**Development vs Production:**
- **Dev:** All services exposed for testing (ports 4200, 8000, 3306)
- **Prod:** Only Nginx exposed (port 80/443); others internal only

### File Permissions & Ownership

**Backend directories needing write access:**
```bash
storage/        - Logs, cache, uploads
bootstrap/cache - Configuration cache
```

**Docker automatically handles via:**
```
chown -R www-data:www-data storage bootstrap/cache
chmod -R 775 storage bootstrap/cache
```

### Database Backup Strategy

**Before deployment:**
```bash
# Export current database
mysqldump -u root -p servetrack > backup_$(date +%Y%m%d).sql

# Inside Docker container
docker-compose exec mysql mysqldump -u root -p${MYSQL_ROOT_PASSWORD} servetrack > backup.sql
```

**Regular backups:**
```bash
# Setup cron job (on host machine)
0 2 * * * docker-compose -f docker-compose.prod.yml exec mysql mysqldump -u root -p${MYSQL_ROOT_PASSWORD} servetrack > /backups/db_$(date +\%Y\%m\%d).sql
```

### SSL/HTTPS Setup

**Option 1: Let's Encrypt with Certbot**
```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Generate certificate
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Update nginx.conf with certificate paths
ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

# Auto-renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

**Option 2: Manual certificates**
- Place in `/etc/nginx/ssl/` directory
- Update nginx.conf with paths

### Nginx Configuration

**Important:** Create `nginx.conf` in project root:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    root /usr/share/nginx/html;
    index index.html;

    location /api {
        proxy_pass http://backend:9000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Monitoring & Logs

**View logs:**
```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f nginx
docker-compose -f docker-compose.prod.yml logs -f mysql

# Inside backend container
docker-compose exec backend tail -f storage/logs/laravel.log
```

**Health checks:**
```bash
# API health
curl http://localhost/api/health

# Database connection
docker-compose exec backend php artisan db:check

# Queue status
docker-compose exec backend php artisan queue:work --daemon
```

### Security Hardening

**Firewall rules:**
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp          # SSH
sudo ufw allow 80/tcp          # HTTP
sudo ufw allow 443/tcp         # HTTPS
sudo ufw enable
```

**Database security:**
- ✓ Non-root MySQL user (servetrack:secret)
- ✓ Limited database privileges
- ✓ No external MySQL exposure (internal only)
- ✓ Strong root password: MYSQL_ROOT_PASSWORD env var

**API security:**
- ✓ Sanctum token authentication
- ✓ CORS configured
- ✓ Rate limiting available
- ✓ Authorization policies enforced

**Environment security:**
- ✓ .env NOT committed to git
- ✓ Secrets in GitHub Actions only
- ✓ APP_KEY should be unique per environment
- ✓ ADMIN_INVITE_CODE should be changed

### Performance Optimization

**Frontend (Angular):**
- Production build: `npm run build -- --configuration=production`
- Bundle size: 2.6MB (optimized)
- Assets: Minified, tree-shaken, hashed

**Backend (Laravel):**
- Cache: `CACHE_DRIVER=redis` (recommended for production)
- Queue: `QUEUE_CONNECTION=redis` (for background jobs)
- Database: Indexes on attendance queries
- Code: Eager loading to prevent N+1 queries

**MySQL:**
- Connection pooling
- Query optimization
- Indexes on frequently queried columns

---

## ROLLBACK PROCEDURE

**If deployment fails:**

```bash
# Stop current deployment
docker-compose -f docker-compose.prod.yml down

# Go back to previous version
git checkout previous_commit_hash
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# If database migrations caused issues
# Edit .env to skip migrations and revert manually
docker-compose exec mysql mysql -u root -p < backup_$(date +%Y%m%d).sql
```

---

## MONITORING CHECKLIST (Post-Deploy)

After deployment, verify:

- [ ] Nginx responding on port 80/443
- [ ] Frontend loads without errors
- [ ] API endpoints responding (status 200)
- [ ] Database queries working
- [ ] Authentication flow functional (login/signup)
- [ ] Admin dashboard accessible
- [ ] Volunteer dashboard visible
- [ ] RSVP/Poll features working
- [ ] No error logs in storage/logs/
- [ ] SSL certificate valid
- [ ] Performance acceptable (< 2s load time)
- [ ] Backups running on schedule
- [ ] Monitoring alerts configured

---

## TROUBLESHOOTING

**Migration fails:**
```bash
# Check database connection
docker-compose -f docker-compose.prod.yml exec mysql mysql -u servetrack -p

# View migration status
docker-compose -f docker-compose.prod.yml exec backend php artisan migrate:status

# Rollback last migration
docker-compose -f docker-compose.prod.yml exec backend php artisan migrate:rollback --step=1
```

**Frontend shows blank page:**
```bash
# Check browser console for errors
# Verify API URL in environment.prod.ts matches backend

# Rebuild frontend
docker-compose -f docker-compose.prod.yml build frontend
docker-compose -f docker-compose.prod.yml restart frontend
```

**Backend giving 500 errors:**
```bash
# Check Laravel logs
docker-compose exec backend tail -f storage/logs/laravel.log

# Clear cache
docker-compose exec backend php artisan cache:clear
docker-compose exec backend php artisan config:clear

# Check APP_KEY is set
docker-compose exec backend php artisan key:generate
```

**Database connection issues:**
```bash
# Verify MySQL is running
docker-compose -f docker-compose.prod.yml exec mysql mysqladmin ping

# Check credentials in .env
# Verify DB_HOST=mysql (not localhost)

# Test connection from backend
docker-compose exec backend php artisan db:check
```

---

## SCALING RECOMMENDATIONS

**For higher traffic:**

1. **Separate MySQL to dedicated container/server**
   - Current: Single VPS
   - Recommended: Separate database server

2. **Add Redis for caching/queues**
   - Reduces database load
   - Improves response times
   - Enables background jobs

3. **Load balancing**
   - Multiple backend containers
   - Nginx load balancing
   - Stateless API design ✓

4. **CDN for frontend assets**
   - CloudFlare, AWS CloudFront
   - Reduces server bandwidth
   - Faster global delivery

5. **Database replication**
   - Master-slave setup
   - Read replicas for queries
   - Backup retention

---

## MAINTENANCE SCHEDULE

**Daily:**
- Monitor logs for errors
- Check disk space usage
- Verify services running

**Weekly:**
- Database backup verification
- Performance metrics review
- Security updates check

**Monthly:**
- Full security audit
- Dependency updates
- Performance optimization review
- User-facing feature testing

**Quarterly:**
- Disaster recovery drill
- Load testing
- Architecture review
- Backup restoration test

---

## DEPLOYMENT QUICK STATS

| Metric | Value |
|--------|-------|
| Build time | ~10-15 minutes |
| Migration time | ~30-60 seconds |
| Frontend build size | 2.6 MB |
| Startup time | ~2-3 minutes |
| Expected uptime | 99.9%+ |
| Recommended monitoring | DataDog, New Relic, or Sentry |
| Backup retention | 30 days minimum |
| Recovery time objective (RTO) | < 1 hour |
| Recovery point objective (RPO) | < 15 minutes |

---

**Document Version:** 1.0  
**Last Updated:** 2026-04-12  
**Applicable to:** ServeTrack v1.0 (Angular 21 + Laravel 12)
