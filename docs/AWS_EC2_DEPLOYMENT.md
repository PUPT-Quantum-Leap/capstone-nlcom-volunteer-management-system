# ServeTrack AWS EC2 Deployment Guide

## Overview

This guide covers deploying ServeTrack to AWS EC2 using Docker Compose with:
- **Frontend**: Angular 21 (nginx)
- **Backend**: Laravel 12 (PHP-FPM)
- **Database**: MySQL 8.0
- **Reverse Proxy**: Nginx
- **SSL**: Let's Encrypt (Certbot)

---

## Prerequisites

- AWS account with EC2 access
- Domain name pointed to your EC2 instance
- GitHub repository with Actions enabled
- SSH key pair for EC2 access

---

## Part 1: EC2 Instance Setup

### 1.1 Launch EC2 Instance

1. **Instance Type**: `t2.micro` or `t3.micro` (Free Tier eligible)
2. **AMI**: Ubuntu Server 22.04 LTS
3. **Storage**: 20-30 GB gp3
4. **Security Group**: Open ports 22 (SSH), 80 (HTTP), 443 (HTTPS)

### 1.2 Connect and Install Docker

```bash
# Connect to EC2
ssh -i your-key.pem ubuntu@your-ec2-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Verify installation
docker --version
docker compose version

# Logout and login again for group changes
exit
```

### 1.3 Setup Application Directory

```bash
ssh -i your-key.pem ubuntu@your-ec2-ip

# Create app directory
sudo mkdir -p /opt/servetrack
sudo chown ubuntu:ubuntu /opt/servetrack
cd /opt/servetrack
```

---

## Part 2: Initial Deployment (Manual)

### 2.1 Clone Repository

```bash
cd /opt/servetrack
git clone https://github.com/YOUR_ORG/YOUR_REPO.git .
```

### 2.2 Configure Environment

```bash
# Copy and edit production environment
cp .env.production.example .env.production

# Edit with your values
nano .env.production
```

**Required changes in `.env.production`:**
```env
APP_KEY=base64:YOUR_GENERATED_KEY
APP_URL=https://yourdomain.com
FRONTEND_URL=https://yourdomain.com

DB_ROOT_PASSWORD=strong_root_password_here
DB_PASSWORD=strong_db_password_here

ADMIN_INVITE_CODE=strong_invite_code_here
ADMIN_ALLOWED_DOMAINS=yourdomain.com

SANCTUM_STATEFUL_DOMAINS=yourdomain.com
```

**Generate APP_KEY:**
```bash
# Temporary container to generate key
docker run --rm -v $(pwd)/servetrack-backend:/app -w /app php:8.2-cli php artisan key:generate --show
```

### 2.3 Start Services (HTTP Only)

```bash
# Build and start containers
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# Check status
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs -f
```

### 2.4 Verify HTTP Access

Visit `http://your-ec2-ip` - you should see the ServeTrack frontend.

---

## Part 3: SSL Setup with Let's Encrypt

### 3.1 Update DNS

Point your domain to your EC2 instance's public IP:
```
A Record: yourdomain.com → EC2_PUBLIC_IP
```

Wait for DNS propagation (check with `nslookup yourdomain.com`).

### 3.2 Obtain SSL Certificate

```bash
cd /opt/servetrack

# Stop nginx temporarily
docker compose -f docker-compose.prod.yml stop nginx

# Run certbot
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email \
  -d yourdomain.com

# Update nginx config for HTTPS
cd nginx/conf.d
cp default-ssl.conf.template default.conf

# Edit default.conf and replace 'yourdomain.com' with your actual domain
nano default.conf

# Restart nginx
cd /opt/servetrack
docker compose -f docker-compose.prod.yml start nginx
```

### 3.3 Verify HTTPS

Visit `https://yourdomain.com` - you should see the green lock icon.

---

## Part 4: GitHub Actions CD Pipeline Update

### 4.1 Current State

Your existing CD pipeline (`cd.yml`) uses:
- Build artifacts on GitHub Actions runner
- SSH to VPS
- Extract and deploy with systemd

### 4.2 Recommended Approach: SSH + Docker Compose

**Strategy**: Keep GitHub Actions SSH approach, but deploy via Docker Compose instead of systemd.

**Benefits**:
- Minimal changes to existing workflow
- No AWS-specific services needed (ECR, ECS)
- Works with Free Tier EC2
- Easy rollback via Docker images

### 4.3 Required Changes to `.github/workflows/cd.yml`

**High-level changes:**

1. **Remove systemd/nginx config deployment** (lines 120-150)
2. **Replace artifact packaging** with Docker image build
3. **Update deployment script** to use `docker compose`
4. **Add health check** for containerized services

**Key modifications:**

```yaml
# OLD: Build artifacts separately
- name: Build Frontend
  run: npm ci && npm run build

- name: Build Backend  
  run: composer install --no-dev

# NEW: Build Docker images
- name: Build Docker Images
  run: |
    docker compose -f docker-compose.prod.yml build

# OLD: Package artifacts as tarball
- name: Create Build Archive
  run: tar -czf build.tar.gz frontend/ backend/

# NEW: Save images as tarball (or push to registry)
- name: Export Docker Images
  run: |
    docker save servetrack-frontend servetrack-backend | gzip > images.tar.gz

# OLD: SSH and extract tarball
- name: Deploy to VPS
  run: |
    scp build.tar.gz user@host:/tmp/
    ssh user@host "cd /var/www && tar -xzf /tmp/build.tar.gz"

# NEW: SSH and load images, then docker compose up
- name: Deploy to EC2
  run: |
    scp images.tar.gz ubuntu@ec2:/opt/servetrack/
    ssh ubuntu@ec2 "cd /opt/servetrack && \
      docker load < images.tar.gz && \
      docker compose -f docker-compose.prod.yml up -d"
```

### 4.4 Alternative: Direct Build on EC2

**Simpler approach** (recommended for Free Tier to save bandwidth):

```yaml
- name: Deploy to EC2
  uses: appleboy/ssh-action@v1.0.3
  with:
    host: ${{ secrets.EC2_HOST }}
    username: ubuntu
    key: ${{ secrets.EC2_SSH_KEY }}
    script: |
      cd /opt/servetrack
      git pull origin main
      docker compose -f docker-compose.prod.yml build
      docker compose -f docker-compose.prod.yml up -d --force-recreate
      docker compose -f docker-compose.prod.yml exec -T backend php artisan migrate --force
```

**Pros**: No image transfer, builds directly on EC2  
**Cons**: Longer downtime during build, uses EC2 CPU

### 4.5 GitHub Secrets to Update

Add these secrets to your GitHub repository:

```
EC2_HOST=your-ec2-public-ip-or-domain
EC2_SSH_KEY=your-private-key-content
EC2_SSH_PORT=22
```

Remove old secrets (if any):
```
VPS_HOST (replaced by EC2_HOST)
VPS_USERNAME (now 'ubuntu')
VPS_SSH_KEY (replaced by EC2_SSH_KEY)
```

### 4.6 Rollback Strategy

**Manual rollback:**
```bash
# List recent images
docker images | grep servetrack

# Rollback to previous image
docker compose -f docker-compose.prod.yml down
docker tag servetrack-backend:previous servetrack-backend:latest
docker compose -f docker-compose.prod.yml up -d
```

**Automated rollback** (add to workflow):
```yaml
- name: Rollback on Failure
  if: failure()
  run: |
    ssh ubuntu@ec2 "cd /opt/servetrack && \
      docker compose -f docker-compose.prod.yml down && \
      docker compose -f docker-compose.prod.yml up -d"
```

---

## Part 5: Maintenance

### 5.1 View Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f backend
```

### 5.2 Database Backup

```bash
# Backup
docker compose -f docker-compose.prod.yml exec mysql \
  mysqldump -u root -p$DB_ROOT_PASSWORD servetrack > backup.sql

# Restore
docker compose -f docker-compose.prod.yml exec -T mysql \
  mysql -u root -p$DB_ROOT_PASSWORD servetrack < backup.sql
```

### 5.3 SSL Certificate Renewal

Certbot container auto-renews every 12 hours. Manual renewal:

```bash
docker compose -f docker-compose.prod.yml run --rm certbot renew
docker compose -f docker-compose.prod.yml restart nginx
```

### 5.4 Update Application

```bash
cd /opt/servetrack
git pull origin main
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d --force-recreate
```

---

## Part 6: Troubleshooting

### Backend not starting

```bash
# Check logs
docker compose -f docker-compose.prod.yml logs backend

# Common issues:
# - APP_KEY not set → regenerate
# - MySQL not ready → wait 30s and restart
# - Permission errors → check storage volume
```

### Nginx 502 Bad Gateway

```bash
# Check backend is running
docker compose -f docker-compose.prod.yml ps

# Check backend health
docker compose -f docker-compose.prod.yml exec backend php artisan up

# Restart backend
docker compose -f docker-compose.prod.yml restart backend
```

### SSL certificate issues

```bash
# Check certificate files
docker compose -f docker-compose.prod.yml exec nginx ls -la /etc/letsencrypt/live/

# Renew manually
docker compose -f docker-compose.prod.yml run --rm certbot renew --force-renewal
```

---

## Part 7: Cost Optimization

### Free Tier Limits (12 months)
- **EC2**: 750 hours/month of t2.micro or t3.micro
- **EBS**: 30 GB storage
- **Data Transfer**: 100 GB/month outbound

### After Free Tier
- **t3.micro**: ~$7.50/month
- **EBS 30GB**: ~$3/month
- **Total**: ~$10-12/month

### Reduce Costs
1. Stop instance when not in use (dev/staging)
2. Use AWS Lightsail ($3.50/month for 512MB RAM)
3. Optimize Docker images (already done with Alpine)

---

## Next Steps

1. ✅ Complete manual deployment (Parts 1-3)
2. ⏳ Update GitHub Actions workflow (Part 4)
3. ⏳ Test automated deployment
4. ⏳ Setup monitoring (CloudWatch, Uptime Robot)
5. ⏳ Configure automated backups

---

## Support

- **GitHub Issues**: [Your Repo Issues](https://github.com/YOUR_ORG/YOUR_REPO/issues)
- **AWS Documentation**: [EC2 User Guide](https://docs.aws.amazon.com/ec2/)
- **Docker Compose**: [Official Docs](https://docs.docker.com/compose/)
