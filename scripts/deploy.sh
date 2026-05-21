#!/usr/bin/env bash

set -euo pipefail

echo "=========================================="
echo "ServeTrack Atomic Symlink Deployment"
echo "Started at: $(date)"
echo "=========================================="

APP_DIR="/var/www/servetrack"
SHARED_DIR="$APP_DIR/shared"
RELEASES_DIR="$APP_DIR/releases"
CURRENT_DIR="$APP_DIR/current"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
NEW_RELEASE_DIR="$RELEASES_DIR/$TIMESTAMP"
PHP_FPM_SERVICE="${PHP_FPM_SERVICE:-php8.3-fpm}"
NGINX_SITE="/etc/nginx/sites-available/servetrack"
NGINX_SITE_ENABLED="/etc/nginx/sites-enabled/servetrack"
NGINX_SITE_BACKUP="$NGINX_SITE.backup.$TIMESTAMP"
SSL_CERT_DIR="/etc/letsencrypt/live/api.servetrack.quantumapp.tech"
HEALTH_URL_LOCAL="https://api.servetrack.quantumapp.tech/up"
MAX_WAIT_TIME="30"

# Track deployment state
ATOMIC_SWAP_COMPLETED=false
NGINX_CONFIG_UPDATED=false

handle_error() {
    echo "=========================================="
    echo "CRITICAL ERROR DETECTED DURING DEPLOYMENT!"
    echo "=========================================="
    
    if [ "$ATOMIC_SWAP_COMPLETED" = true ]; then
        echo "Error occurred AFTER atomic swap. Initiating full rollback..."
        # Find previous release
        PREV_RELEASE=$(ls -1dt "$RELEASES_DIR"/* | grep -v "$NEW_RELEASE_DIR" | head -n 1 || true)
        if [[ -n "$PREV_RELEASE" ]]; then
            echo "Rolling back to previous release: $PREV_RELEASE"
            sudo ln -nfs "$PREV_RELEASE" "$CURRENT_DIR"
            if [ "$NGINX_CONFIG_UPDATED" = true ] && [[ -f "$NGINX_SITE_BACKUP" ]]; then
                echo "Restoring previous nginx config: $NGINX_SITE_BACKUP"
                sudo cp "$NGINX_SITE_BACKUP" "$NGINX_SITE" || true
            fi
            sudo systemctl reload-or-restart "$PHP_FPM_SERVICE" || true
            sudo nginx -t && sudo systemctl reload nginx || true
            echo "Rollback complete. Please check the logs."
        else
            echo "CRITICAL: No previous release found to roll back to!"
        fi
        
        # Show some error logs
        sudo journalctl -u "$PHP_FPM_SERVICE" -n 50 --no-pager || true
    else
        echo "Error occurred BEFORE atomic swap. Live site is unaffected."
        if [ "$NGINX_CONFIG_UPDATED" = true ] && [[ -f "$NGINX_SITE_BACKUP" ]]; then
            echo "Restoring previous nginx config: $NGINX_SITE_BACKUP"
            sudo cp "$NGINX_SITE_BACKUP" "$NGINX_SITE" || true
        fi
        echo "Cleaning up failed release directory: $NEW_RELEASE_DIR"
        sudo rm -rf "$NEW_RELEASE_DIR" || true
    fi
    
    echo "Deployment Failed."
    exit 1
}

trap 'handle_error' ERR

echo "Deploying release: $TIMESTAMP"

# Step 1: Ensure directory structure
echo "Step 1: Ensuring shared and release directories exist..."
sudo mkdir -p "$SHARED_DIR/backend/storage/framework/cache/data"
sudo mkdir -p "$SHARED_DIR/backend/storage/framework/sessions"
sudo mkdir -p "$SHARED_DIR/backend/storage/framework/views"
sudo mkdir -p "$SHARED_DIR/backend/storage/logs"
sudo mkdir -p "$SHARED_DIR/backend/storage/app/public"
sudo mkdir -p "$RELEASES_DIR"
sudo chown -R "$USER":www-data "$APP_DIR"
sudo chmod -R 775 "$SHARED_DIR/backend/storage"
sudo chown -R www-data:www-data "$SHARED_DIR/backend/storage"

# Check for .env file
if [[ ! -f "$SHARED_DIR/.env" ]]; then
    echo "ERROR: Missing production environment file at $SHARED_DIR/.env"
    echo "Please create it manually on the VPS with your Laravel production secrets."
    false # Trigger trap
fi

# Step 2: Extract the build artifact
echo "Step 2: Extracting build artifact to $NEW_RELEASE_DIR..."
sudo mkdir -p "$NEW_RELEASE_DIR"
sudo tar -xzf /tmp/build.tar.gz -C "$NEW_RELEASE_DIR" --strip-components=1

# Step 3: Symlink Shared Assets
echo "Step 3: Symlinking persistent storage and environment..."
sudo ln -nfs "$SHARED_DIR/.env" "$NEW_RELEASE_DIR/backend/.env"
sudo rm -rf "$NEW_RELEASE_DIR/backend/storage"
sudo ln -nfs "$SHARED_DIR/backend/storage" "$NEW_RELEASE_DIR/backend/storage"

# Set correct ownership for the new release
sudo chown -R www-data:www-data "$NEW_RELEASE_DIR/backend"

# Step 4: Laravel Cache and Migrations
echo "Step 4: Running Laravel optimizations and migrations..."
cd "$NEW_RELEASE_DIR/backend"

# Link storage (public disk) if needed
sudo -u www-data php artisan storage:link || true

# Clear and rebuild caches
sudo -u www-data php artisan config:cache
sudo -u www-data php artisan route:cache
sudo -u www-data php artisan view:cache

# Run database migrations
sudo -u www-data php artisan migrate --force

# Step 5: Update and validate system configs before the atomic swap
echo "Step 5: Applying and validating Nginx configuration..."
if ! systemctl cat "$PHP_FPM_SERVICE" >/dev/null 2>&1; then
    echo "ERROR: PHP-FPM service not found: $PHP_FPM_SERVICE"
    false
fi

if ! systemctl is-active --quiet "$PHP_FPM_SERVICE"; then
    echo "ERROR: PHP-FPM service is not active: $PHP_FPM_SERVICE"
    false
fi

if [[ ! -d "$SSL_CERT_DIR" ]]; then
    echo "ERROR: Missing SSL certificate directory: $SSL_CERT_DIR"
    false
fi

if [[ -f "$NGINX_SITE" ]]; then
    sudo cp "$NGINX_SITE" "$NGINX_SITE_BACKUP"
fi

sudo cp "$NEW_RELEASE_DIR/config/servetrack-nginx.conf" "$NGINX_SITE"
NGINX_CONFIG_UPDATED=true
sudo ln -sf "$NGINX_SITE" "$NGINX_SITE_ENABLED"
sudo nginx -t

# Step 6: The Atomic Swap
echo "Step 6: Executing Atomic Swap..."
sudo ln -nfs "$NEW_RELEASE_DIR" "$CURRENT_DIR"
ATOMIC_SWAP_COMPLETED=true

# Step 7: Reload services after the new release is live
echo "Step 7: Reloading PHP-FPM and nginx..."
sudo systemctl reload-or-restart "$PHP_FPM_SERVICE"
sudo systemctl reload nginx

# Step 8: Health Check and Auto-Rollback
echo "Step 8: Waiting for backend health..."
sleep 3
ELAPSED=3
READY=false
while [[ "$ELAPSED" -lt "$MAX_WAIT_TIME" ]]; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL_LOCAL" || echo "000")
  if [[ "$HTTP_CODE" == 2* ]]; then
    READY=true
    echo "✓ Backend health check passed after ${ELAPSED}s (HTTP $HTTP_CODE)"
    break
  fi
  sleep 2
  ELAPSED=$((ELAPSED + 2))
  echo "  ... waiting (${ELAPSED}s/${MAX_WAIT_TIME}s) (HTTP $HTTP_CODE)"
done

if [[ "$READY" != "true" ]]; then
  echo "ERROR: Backend health check failed (HTTP $HTTP_CODE)!"
  false # Trigger trap
fi

# Step 9: Cleanup
echo "Step 9: Cleaning up old releases (keeping last 5)..."
ls -1dt "$RELEASES_DIR"/* | tail -n +6 | sudo xargs -r rm -rf || true
sudo rm -f /tmp/build.tar.gz /tmp/servetrack-launcher/deploy.sh || true

echo "=========================================="
echo "Deployment completed successfully!"
echo "Finished at: $(date)"
echo "Current Release: $TIMESTAMP"
echo "=========================================="
