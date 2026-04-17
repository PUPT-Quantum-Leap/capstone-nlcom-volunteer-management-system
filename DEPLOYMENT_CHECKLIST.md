# 🎯 ServeTrack Docker Deployment Checklist

## ✅ What Was Created

### Configuration Files
- ✅ `nginx.conf` — Reverse proxy, SSL termination, SPA routing
- ✅ `servetrack-frontend/nginx.conf` — SPA routing config
- ✅ `servetrack-backend/.env.docker` — Production environment template
- ✅ `servetrack-backend/docker-entrypoint.prod.sh` — Container startup script

### Infrastructure
- ✅ `docker-compose.prod.yml` — Updated with explicit image names, SSL mounts, health checks
- ✅ `.github/workflows/docker-deploy.yml` — Automated CI/CD pipeline
- ✅ `scripts/docker-deploy.sh` — SSH deployment script
- ✅ `DOCKER_DEPLOYMENT_GUIDE.md` — Complete deployment walkthrough

### Technology Stack
```
GitHub Actions          CI/CD Pipeline
     ↓
Docker Hub Registry     Image Storage (public)
     ↓
Hostinger VPS           Running Containers
  ├─ Nginx (443/80)
  ├─ Angular SPA
  ├─ PHP-FPM Backend
  └─ MySQL 8.0
```

---

## 🚀 Quick Start (VPS Setup)

### Phase 1: System Prep (15 mins)
```bash
ssh root@servetrack.kaelvxdev.space

# Install Docker
curl -fsSL https://get.docker.com | sh
apt install docker-compose-plugin -y
systemctl enable docker

# Create deploy user
useradd -m -s /bin/bash deploy
usermod -aG docker deploy
echo "deploy ALL=(ALL) NOPASSWD: /usr/bin/docker, /usr/bin/docker-compose" | sudo tee /etc/sudoers.d/deploy-docker

# Get SSL certificate
apt install certbot -y
certbot certonly --standalone -d servetrack.kaelvxdev.space
```

### Phase 2: Git & SSH Setup (10 mins)

**Local machine:**
```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/servetrack_vps -C "servetrack-deploy"
cat ~/.ssh/servetrack_vps.pub  # Copy this
```

**VPS (as deploy user):**
```bash
su - deploy
mkdir -p ~/.ssh
echo "YOUR_PUBLIC_KEY_HERE" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
exit
```

**VPS (clone repo):**
```bash
su - deploy
mkdir -p /home/deploy/servetrack
cd /home/deploy/servetrack
git clone https://github.com/PUPT-Quantum-Leap/capstone-nlcom-volunteer-management-system.git .
chmod +x scripts/docker-deploy.sh
```

### Phase 3: Configure Secrets (5 mins)

Edit `.env` file on VPS:
```bash
su - deploy
cd /home/deploy/servetrack
cp servetrack-backend/.env.docker servetrack-backend/.env
nano servetrack-backend/.env

# Set these values:
# DB_PASSWORD=YourStrongPassword123!
# MYSQL_ROOT_PASSWORD=YourRootPassword456!
# ADMIN_INVITE_CODE=YourAdminCode789!
```

### Phase 4: GitHub Secrets (5 mins)

GitHub Repo → Settings → Secrets and Variables → Actions

| Secret | Value |
|--------|-------|
| `DOCKER_HUB_USERNAME` | Your Docker Hub username |
| `VPS_HOST` | servetrack.kaelvxdev.space |
| `VPS_USER` | deploy |
| `VPS_SSH_KEY` | Content of ~/.ssh/servetrack_vps |
| `VPS_SSH_PORT` | 22 |
| `DEPLOY_PATH` | /home/deploy/servetrack |

---

## 🔄 Deployment Workflow

### Automatic Deployments
1. **Push to main** branch
2. GitHub Actions runs:
   - Frontend tests (npm test)
   - Backend tests (php artisan test)
   - Build Docker images
   - Push to Docker Hub
   - SSH to VPS
   - Run `scripts/docker-deploy.sh`
3. **App live** in ~3-5 minutes

### What the Deploy Script Does
1. Pull latest code
2. Pull latest Docker images from Docker Hub
3. Stop old containers
4. Start new containers
5. Run database migrations
6. Clear caches
7. Health check backend
8. Report status

---

## 📝 Files Summary

| File | Purpose | Modified |
|------|---------|----------|
| `nginx.conf` | Main reverse proxy, SSL, API routing | ✨ NEW |
| `servetrack-frontend/nginx.conf` | SPA routing inside container | ✨ NEW |
| `servetrack-backend/.env.docker` | Production env template | ✏️ UPDATED |
| `servetrack-backend/docker-entrypoint.prod.sh` | Container startup script | ✨ NEW |
| `docker-compose.prod.yml` | Docker Compose configuration | ✏️ UPDATED |
| `.github/workflows/docker-deploy.yml` | GitHub Actions CI/CD | ✨ NEW |
| `scripts/docker-deploy.sh` | SSH deployment script | ✨ NEW |

---

## 🔐 Security Features

- ✅ SSL/HTTPS (Let's Encrypt, auto-renewal)
- ✅ Production Laravel (APP_DEBUG=false)
- ✅ Non-root Docker user (deploy user)
- ✅ SSH key authentication
- ✅ Health checks
- ✅ Secrets in GitHub Actions (encrypted)
- ✅ `.env` never committed to Git

---

## 🐛 Troubleshooting Commands

### Check if deployment is running
```bash
ssh -i ~/.ssh/servetrack_vps deploy@servetrack.kaelvxdev.space
docker compose -f /home/deploy/servetrack/docker-compose.prod.yml ps
```

### View logs
```bash
docker compose -f docker-compose.prod.yml logs -f backend
```

### Manually trigger deployment
```bash
cd /home/deploy/servetrack
bash scripts/docker-deploy.sh
```

### Check database connection
```bash
docker compose -f docker-compose.prod.yml exec backend php artisan migrate --dry-run
```

### Restart all services
```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

---

## 📊 Expected Output After First Deploy

```
Step 1: Pull latest code from repository...
✓ Repository updated

Step 2: Pull latest Docker images...
✓ Images pulled successfully

Step 3: Prepare environment files...

Step 4: Stop old containers (gracefully)...
✓ Old containers stopped

Step 5: Start new containers...
✓ New containers started

Step 6: Wait for database to be ready...

Step 7: Run database migrations...
✓ Migrations completed

Step 8: Optimize Laravel caches...
✓ Caches optimized

Step 9: Health check...
✓ Backend health check passed

✅ Deployment Completed Successfully!

Service Status:
CONTAINER ID   IMAGE                        STATUS
xxx            servetrack-nginx             Up 2 minutes
xxx            servetrack-frontend:latest   Up 2 minutes
xxx            servetrack-backend:latest    Up 2 minutes
xxx            mysql:8.0                    Up 2 minutes
```

---

## 🎉 What's Next?

1. **Create admin user** via web UI
2. **Test the application** at https://servetrack.kaelvxdev.space
3. **Monitor logs** with `docker compose logs -f`
4. **Set up backups** (optional)
5. **Configure custom domain** SSL (already done with Let's Encrypt)

---

## 📞 Quick Reference

**Domain:** servetrack.kaelvxdev.space  
**SSH Command:** `ssh -i ~/.ssh/servetrack_vps deploy@servetrack.kaelvxdev.space`  
**Docker Compose:** `/home/deploy/servetrack/docker-compose.prod.yml`  
**Logs Location:** VPS `/home/deploy/servetrack/`  
**Database Name:** servetrack  
**Admin Code:** Set in your `.env` file

---

**Status:** ✅ Ready for deployment  
**Last Updated:** 2026-04-17  
**Version:** 1.0.0
