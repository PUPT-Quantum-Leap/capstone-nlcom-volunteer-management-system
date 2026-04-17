# 🚀 ServeTrack Docker Deployment Guide

> **Domain:** servetrack.kaelvxdev.space  
> **Stack:** Angular 21 + Laravel 12 + MySQL 8.0 + Nginx (all in Docker)  
> **Target:** Hostinger KVM (1 vCPU, 4GB RAM, 50GB NVMe)

---

## 📋 Overview

This guide walks you through deploying ServeTrack to your Hostinger VPS using:

- **GitHub Actions** for CI/CD: Test → Build Docker images → Push to Docker Hub
- **SSH** for deployment: Pull images and run `docker-compose up`
- **Custom bash script** for orchestration: migrations, health checks, logging

### Architecture

```
GitHub (push to main)
    ↓
GitHub Actions (docker-deploy.yml)
  ├─ Run tests (frontend + backend)
  ├─ Build Docker images
  ├─ Push to Docker Hub
  └─ SSH to VPS → Run scripts/docker-deploy.sh
      ↓
VPS (docker-compose.prod.yml)
  ├─ Nginx (SSL)
  ├─ PHP-FPM Backend
  ├─ Angular Frontend
  └─ MySQL Database
```

---

## ✅ Phase 1: VPS Initial Setup (One-time)

### 1.1 Connect to VPS

```bash
ssh root@servetrack.kaelvxdev.space
# Or use your Hostinger panel for VNC/console access
```

### 1.2 Update System

```bash
apt update && apt upgrade -y
```

### 1.3 Install Docker & Docker Compose

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose plugin
apt install docker-compose-plugin -y

# Start Docker daemon
systemctl enable docker
systemctl start docker

# Verify installation
docker --version && docker compose version
```

### 1.4 Create Non-Root Deploy User

```bash
# Create deploy user
useradd -m -s /bin/bash deploy
usermod -aG docker deploy

# Set up sudo for docker (no password prompt)
echo "deploy ALL=(ALL) NOPASSWD: /usr/bin/docker, /usr/bin/docker-compose" | sudo tee /etc/sudoers.d/deploy-docker

# Verify
sudo -u deploy docker ps
```

### 1.5 Generate SSH Keys (Local Machine)

Run these commands on **your local machine**:

```bash
# Generate SSH key for VPS deployment
ssh-keygen -t ed25519 -N "" -f ~/.ssh/servetrack_vps -C "servetrack-deploy"

# Display public key (you'll need this next)
cat ~/.ssh/servetrack_vps.pub
```

### 1.6 Add SSH Public Key to VPS Deploy User

Back on the **VPS** (still as root):

```bash
# Create .ssh directory for deploy user
su - deploy
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Paste the public key from your local machine
echo "YOUR_PUBLIC_KEY_HERE" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Verify SSH works (from local machine)
ssh -i ~/.ssh/servetrack_vps deploy@servetrack.kaelvxdev.space whoami
# Should output: deploy
```

### 1.7 Get SSL Certificate (Before Docker Starts)

Back on **VPS** as root:

```bash
# Install Certbot
apt install certbot -y

# Get certificate for your domain
certbot certonly --standalone -d servetrack.kaelvxdev.space

# Verify certificate was created
ls -la /etc/letsencrypt/live/servetrack.kaelvxdev.space/
```

### 1.8 Clone Repository on VPS

As the **deploy** user:

```bash
su - deploy

# Create deploy directory
mkdir -p /home/deploy/servetrack
cd /home/deploy/servetrack

# Clone repo (HTTPS is fine for public repos)
git clone https://github.com/PUPT-Quantum-Leap/capstone-nlcom-volunteer-management-system.git .

# Verify key files exist
ls -la nginx.conf docker-compose.prod.yml scripts/docker-deploy.sh
```

### 1.9 Create Initial `.env` File

```bash
# Copy template
cp servetrack-backend/.env.docker servetrack-backend/.env

# Edit with your values
nano servetrack-backend/.env
```

**Important environment variables to set:**

```bash
# Set strong passwords (CHANGE THESE!)
DB_PASSWORD=YourStrongPassword123!
MYSQL_ROOT_PASSWORD=YourRootPassword456!

# Admin invite code for first user registration
ADMIN_INVITE_CODE=YourAdminCode789!
```

**Save the file** (Ctrl+X → Y → Enter in nano)

### 1.10 Make Deploy Script Executable

```bash
chmod +x /home/deploy/servetrack/scripts/docker-deploy.sh
```

---

## 📝 Phase 2: Set Up GitHub Actions Secrets

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**

Create these secrets:

| Secret Name | Value | Example |
|-----------|-------|---------|
| `DOCKER_HUB_USERNAME` | Your Docker Hub username (create free account at https://hub.docker.com) | `yourusername` |
| `VPS_HOST` | Your VPS IP or domain | `servetrack.kaelvxdev.space` |
| `VPS_USER` | Deploy user (from Phase 1.4) | `deploy` |
| `VPS_SSH_KEY` | Private SSH key (contents of `~/.ssh/servetrack_vps`) | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `VPS_SSH_PORT` | SSH port on VPS | `22` |
| `DEPLOY_PATH` | Path on VPS where repo cloned | `/home/deploy/servetrack` |

**How to add secrets:**

1. Click **New repository secret**
2. Name: `DOCKER_HUB_USERNAME`
3. Value: Your Docker Hub username
4. Click **Add secret**
5. Repeat for each secret above

---

## 🚀 Phase 3: First Deployment

### 3.1 Push to Main Branch

```bash
# From your local machine, in the repo
git push origin feature/vps-deployment-pipeline
```

Then **create a pull request** and **merge to main**.

### 3.2 Watch GitHub Actions

GitHub Actions will automatically:

1. ✅ Run frontend tests (npm test)
2. ✅ Run backend tests (php artisan test)
3. 🐳 Build frontend Docker image
4. 🐳 Build backend Docker image
5. 🔄 Push images to Docker Hub
6. 🔑 SSH to VPS
7. 📦 Run `/home/deploy/servetrack/scripts/docker-deploy.sh`

**View progress:** GitHub repo → **Actions** tab → Watch the workflow run

### 3.3 First Deployment Might Fail (Expected)

If the deployment stops with:

```
⚠️  WARNING: .env file created from template
⚠️  MANUAL ACTION REQUIRED: Edit servetrack-backend/.env with...
```

This is **normal** on first deployment. The script detected `.env` wasn't properly configured yet.

**Fix it:**

```bash
# SSH to VPS as deploy user
ssh -i ~/.ssh/servetrack_vps deploy@servetrack.kaelvxdev.space

# Edit .env
cd /home/deploy/servetrack
nano servetrack-backend/.env

# Set:
# DB_PASSWORD=YourStrongPassword123!
# MYSQL_ROOT_PASSWORD=YourRootPassword456!
# ADMIN_INVITE_CODE=YourAdminCode789!

# Save and exit (Ctrl+X → Y → Enter)
```

### 3.4 Trigger Deployment Again

Either:
- Make a commit and push to main (will auto-trigger)
- Or manually run workflow from GitHub Actions UI

```bash
# View logs
ssh -i ~/.ssh/servetrack_vps deploy@servetrack.kaelvxdev.space
cd /home/deploy/servetrack
docker compose -f docker-compose.prod.yml logs -f
```

---

## ✅ Phase 4: Verify Deployment

### 4.1 Check Services Running

```bash
ssh -i ~/.ssh/servetrack_vps deploy@servetrack.kaelvxdev.space
docker compose -f /home/deploy/servetrack/docker-compose.prod.yml ps
```

Should show:

```
CONTAINER ID   IMAGE                        STATUS
xxx            servetrack-nginx             Up 2 minutes
xxx            servetrack-frontend:latest   Up 2 minutes
xxx            servetrack-backend:latest    Up 2 minutes
xxx            mysql:8.0                    Up 2 minutes
```

### 4.2 Test the Application

```bash
# From your local machine or browser
curl https://servetrack.kaelvxdev.space
# Should return HTML of Angular app

# Test API endpoint
curl https://servetrack.kaelvxdev.space/api/health
# Should return JSON response
```

### 4.3 View Application

Open browser → `https://servetrack.kaelvxdev.space`

---

## 👤 Phase 5: Create Admin User

The first admin user must be registered with the `ADMIN_INVITE_CODE` from your `.env`.

### 5.1 Register Admin

1. Go to `https://servetrack.kaelvxdev.space/register`
2. Fill registration form
3. Enter `ADMIN_INVITE_CODE` when prompted
4. Submit

### 5.2 Verify Admin Created

```bash
ssh -i ~/.ssh/servetrack_vps deploy@servetrack.kaelvxdev.space
docker compose -f /home/deploy/servetrack/docker-compose.prod.yml exec backend php artisan tinker

# In Tinker:
>>> \App\Models\User::all()
# Should show your admin user
>>> exit
```

---

## 🔄 Ongoing Deployments

After the first deployment, future deployments are **automatic**:

1. **Make code changes** locally
2. **Commit & push** to main
3. **GitHub Actions** automatically:
   - Runs tests
   - Builds Docker images
   - Pushes to Docker Hub
   - SSHes to VPS and runs deployment script
   - Runs migrations (if backend changed)
   - Health checks backend
4. **App updates** (typically 2-3 minutes)

### View Deployment Logs

**GitHub Actions:**
- Repo → Actions → Click latest workflow run

**VPS Deployment:**

```bash
ssh -i ~/.ssh/servetrack_vps deploy@servetrack.kaelvxdev.space
cd /home/deploy/servetrack

# View compose logs
docker compose -f docker-compose.prod.yml logs -f

# View just backend
docker compose -f docker-compose.prod.yml logs -f backend

# View migrations
docker compose -f docker-compose.prod.yml exec backend tail -f storage/logs/laravel.log
```

---

## 🛠️ Troubleshooting

### Backend won't start: "database not ready"

```bash
# Check MySQL is running
docker compose -f docker-compose.prod.yml ps mysql

# Restart MySQL
docker compose -f docker-compose.prod.yml restart mysql

# Wait 10 seconds, then restart backend
docker compose -f docker-compose.prod.yml restart backend
```

### SSL certificate issues (not HTTPS)

```bash
# Certbot should auto-renew, but force manual renewal
sudo certbot renew --force-renewal

# Restart Nginx
docker compose -f docker-compose.prod.yml restart nginx
```

### Need to run manual artisan commands

```bash
# SSH to VPS
ssh -i ~/.ssh/servetrack_vps deploy@servetrack.kaelvxdev.space

# Run any artisan command
docker compose -f /home/deploy/servetrack/docker-compose.prod.yml exec backend \
  php artisan <command>

# Examples:
# php artisan db:seed
# php artisan queue:work
# php artisan cache:clear
```

### View database

```bash
# SSH to VPS
ssh -i ~/.ssh/servetrack_vps deploy@servetrack.kaelvxdev.space

# Connect to MySQL
docker compose -f /home/deploy/servetrack/docker-compose.prod.yml exec mysql \
  mysql -u servetrack -p servetrack

# Enter password (from MYSQL_PASSWORD in .env)
```

---

## 📦 File Structure on VPS

After first deployment:

```
/home/deploy/servetrack/
├── docker-compose.prod.yml
├── nginx.conf
├── servetrack-backend/
│   ├── .env                    # ← Production secrets (you set these)
│   ├── .env.docker
│   ├── docker-entrypoint.prod.sh
│   ├── app/
│   ├── config/
│   ├── routes/
│   └── storage/                # ← Persistent (mounts from Docker volume)
├── servetrack-frontend/
│   ├── nginx.conf
│   ├── dist/                   # ← Built app (from Docker)
│   └── Dockerfile.prod
└── scripts/
    └── docker-deploy.sh
```

---

## 🔒 Security Notes

- **Never commit `.env`** to Git (it's in `.gitignore`)
- **Rotate admin invite code** after first deployment
- **SSL certificates** auto-renew monthly (Certbot handles this)
- **Database password** is in `.env`, only readable by deploy user
- **GitHub secrets** are encrypted and never shown in logs

---

## 📞 Support

If deployment fails:

1. **Check GitHub Actions logs** (most detailed)
2. **SSH to VPS** and check `docker compose logs`
3. **Check SSL cert:** `sudo certbot certificates`
4. **Restart everything:** `docker compose down && docker compose up -d`

---

## ✨ What's Deployed

- ✅ Angular 21 SPA (hosted in Nginx)
- ✅ Laravel 12 API (PHP-FPM)
- ✅ MySQL 8.0 (persistent data)
- ✅ SSL/HTTPS (Let's Encrypt)
- ✅ Auto-scaling migrations
- ✅ Health checks
- ✅ Persistent storage
- ✅ Automatic restarts on failure

**Next steps after deployment:**
1. Create admin user via web UI
2. Configure any custom settings
3. Seed data if needed
4. Test all features

---

**Deployment complete!** 🎉  
Your app is live at: https://servetrack.kaelvxdev.space
