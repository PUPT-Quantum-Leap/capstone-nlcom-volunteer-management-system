#!/usr/bin/env bash

set -euo pipefail

DOMAIN="servetrack.kaelvxdev.space"
APP_ROOT="/var/www/servetrack"

echo "Updating apt cache..."
sudo apt-get update

echo "Installing system packages..."
sudo apt-get install -y \
  nginx \
  mysql-server \
  git \
  curl \
  unzip \
  certbot \
  python3-certbot-nginx \
  rsync \
  php8.2 \
  php8.2-cli \
  php8.2-mbstring \
  php8.2-xml \
  php8.2-curl \
  php8.2-zip \
  php8.2-bcmath \
  php8.2-mysql \
  php8.2-intl

echo "Installing composer if missing..."
if ! command -v composer >/dev/null 2>&1; then
  cd /tmp
  php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');"
  php composer-setup.php --install-dir=/usr/local/bin --filename=composer
  rm -f composer-setup.php
fi

echo "Creating base app directories..."
sudo mkdir -p "$APP_ROOT"/frontend "$APP_ROOT"/backend "$APP_ROOT"/repo "$APP_ROOT"/scripts
sudo mkdir -p /etc/servetrack
sudo chown -R "$USER":"$USER" "$APP_ROOT"
sudo chmod 750 /etc/servetrack

echo "Enabling and starting services..."
sudo systemctl enable nginx
sudo systemctl enable mysql
sudo systemctl restart nginx
sudo systemctl restart mysql

echo "Configuring firewall..."
if command -v ufw >/dev/null 2>&1; then
  sudo ufw allow OpenSSH
  sudo ufw allow 'Nginx Full'
  sudo ufw --force enable
fi

echo "Bootstrap complete for $DOMAIN"
echo "Next steps:"
echo "1) Secure MySQL: sudo mysql_secure_installation"
echo "2) Create DB/user for ServeTrack"
echo "3) Configure /etc/nginx/sites-available/servetrack"
echo "4) Run certbot: sudo certbot --nginx -d $DOMAIN"
