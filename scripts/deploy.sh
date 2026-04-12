#!/usr/bin/env bash

set -euo pipefail

echo "=========================================="
echo "ServeTrack Deployment Script"
echo "Started at: $(date)"
echo "=========================================="

APP_DIR="/var/www/servetrack"
BACKUP_DIR="/var/www/servetrack-backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

FRONTEND_DIR="$APP_DIR/frontend"
BACKEND_DIR="$APP_DIR/backend"

REPO_URL="${SERVETRACK_REPO_URL:-}"
REPO_BRANCH="${SERVETRACK_DEPLOY_BRANCH:-prod}"

BACKEND_SERVICE="servetrack-backend"

HEALTH_URL_LOCAL="http://127.0.0.1:8000/up"
MAX_WAIT_TIME="30"

if [[ -z "$REPO_URL" ]]; then
  echo "ERROR: SERVETRACK_REPO_URL is required (e.g. git@github.com:org/repo.git)"
  exit 1
fi

echo ""
echo "Step 0: Ensuring directories exist..."
sudo mkdir -p "$APP_DIR" "$BACKUP_DIR" "$FRONTEND_DIR" "$BACKEND_DIR"
sudo chown -R "$USER":"$USER" "$APP_DIR" "$BACKUP_DIR"

echo ""
echo "Step 1: Creating backup of current deployment..."
mkdir -p "$BACKUP_DIR/$TIMESTAMP"
if [[ -d "$FRONTEND_DIR" ]]; then
  tar -czf "$BACKUP_DIR/$TIMESTAMP/frontend.tgz" -C "$APP_DIR" frontend 2>/dev/null || true
fi
if [[ -d "$BACKEND_DIR" ]]; then
  tar -czf "$BACKUP_DIR/$TIMESTAMP/backend.tgz" -C "$APP_DIR" backend 2>/dev/null || true
fi

echo ""
echo "Step 2: Fetching latest build artifacts..."
if [[ ! -d "$APP_DIR/repo/.git" ]]; then
  mkdir -p "$APP_DIR/repo"
  git clone "$REPO_URL" "$APP_DIR/repo"
fi

cd "$APP_DIR/repo"
git fetch origin "$REPO_BRANCH"
git checkout "$REPO_BRANCH"
git reset --hard "origin/$REPO_BRANCH"

if [[ -x "scripts/deploy.sh" && "$(realpath "scripts/deploy.sh")" != "$(realpath "$0")" ]]; then
  echo ""
  echo "Switching to latest deploy script from repo..."
  exec sudo -E bash "$(pwd)/scripts/deploy.sh"
fi

echo ""
echo "Step 3: Deploying frontend dist..."
if [[ ! -d "servetrack-frontend/dist" ]]; then
  echo "ERROR: Expected Angular build at servetrack-frontend/dist"
  exit 1
fi

FRONTEND_BUILD_DIR=""
if [[ -f "servetrack-frontend/dist/servetrack-frontend/browser/index.html" ]]; then
  FRONTEND_BUILD_DIR="servetrack-frontend/dist/servetrack-frontend/browser"
elif [[ -f "servetrack-frontend/dist/browser/index.html" ]]; then
  FRONTEND_BUILD_DIR="servetrack-frontend/dist/browser"
elif [[ -f "servetrack-frontend/dist/servetrack-frontend/index.html" ]]; then
  FRONTEND_BUILD_DIR="servetrack-frontend/dist/servetrack-frontend"
elif [[ -f "servetrack-frontend/dist/index.html" ]]; then
  FRONTEND_BUILD_DIR="servetrack-frontend/dist"
fi

if [[ -z "$FRONTEND_BUILD_DIR" ]]; then
  echo "ERROR: Could not locate built index.html under servetrack-frontend/dist"
  echo "Found:"; ls -la servetrack-frontend/dist || true
  exit 1
fi

sudo rm -rf "$FRONTEND_DIR"/*
sudo cp -R "$FRONTEND_BUILD_DIR"/* "$FRONTEND_DIR/"

echo ""
echo "Step 4: Deploying backend..."
if [[ ! -f "servetrack-backend/artisan" ]]; then
  echo "ERROR: Expected Laravel app at servetrack-backend/artisan"
  exit 1
fi

rsync -a --delete --exclude ".env" --exclude "storage" --exclude "bootstrap/cache" servetrack-backend/ "$BACKEND_DIR/"

sudo chown -R www-data:www-data "$BACKEND_DIR"

echo ""
echo "Step 5: Ensuring backend writable paths..."
mkdir -p "$BACKEND_DIR/storage" "$BACKEND_DIR/bootstrap/cache"
chmod -R ug+rwX "$BACKEND_DIR/storage" "$BACKEND_DIR/bootstrap/cache" || true
sudo chown -R www-data:www-data "$BACKEND_DIR/storage" "$BACKEND_DIR/bootstrap/cache"

echo ""
echo "Step 6: Wiring environment file..."
if [[ -f "/etc/servetrack/backend.env" ]]; then
  sudo cp "/etc/servetrack/backend.env" "$BACKEND_DIR/.env"
else
  echo "ERROR: /etc/servetrack/backend.env not found (CD should deploy it)"
  exit 1
fi

sudo chown www-data:www-data "$BACKEND_DIR/.env"
sudo chmod 640 "$BACKEND_DIR/.env"

if ! grep -q '^APP_KEY=.' "$BACKEND_DIR/.env"; then
  echo "ERROR: APP_KEY is missing/empty in $BACKEND_DIR/.env"
  exit 1
fi

echo ""
echo "Step 7: Installing PHP dependencies..."
cd "$BACKEND_DIR"
composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader

if [[ ! -f "$BACKEND_DIR/vendor/autoload.php" ]]; then
  echo "ERROR: composer install did not produce vendor/autoload.php"
  exit 1
fi

echo ""
echo "Step 8: Optimizing Laravel + migrating..."
php artisan storage:link || true
php artisan config:cache || true
php artisan route:cache || true
php artisan view:cache || true
php artisan migrate --force

echo ""
echo "Step 9: Restarting backend service..."
sudo systemctl daemon-reload
sudo systemctl restart "$BACKEND_SERVICE"

echo ""
echo "Step 10: Updating Nginx configuration (if present)..."
if [[ -f "$APP_DIR/repo/config/servetrack-nginx.conf" ]]; then
  sudo cp "$APP_DIR/repo/config/servetrack-nginx.conf" /etc/nginx/sites-available/servetrack
  sudo ln -sf /etc/nginx/sites-available/servetrack /etc/nginx/sites-enabled/servetrack
  sudo nginx -t
  sudo systemctl reload nginx
fi

echo ""
echo "Step 11: Waiting for backend health..."
sleep 3
ELAPSED=3
READY=false
while [[ "$ELAPSED" -lt "$MAX_WAIT_TIME" ]]; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL_LOCAL" 2>/dev/null || echo "000")
  if [[ "$HTTP_CODE" != "000" && "$HTTP_CODE" != "502" && "$HTTP_CODE" != "503" ]]; then
    READY=true
    echo "✓ Backend health check passed after ${ELAPSED}s (HTTP $HTTP_CODE)"
    break
  fi
  sleep 2
  ELAPSED=$((ELAPSED + 2))
  echo "  ... waiting (${ELAPSED}s/${MAX_WAIT_TIME}s)"
done

if [[ "$READY" != "true" ]]; then
  echo "ERROR: Backend did not become healthy (URL: $HEALTH_URL_LOCAL)"
  sudo journalctl -u "$BACKEND_SERVICE" -n 100 --no-pager || true
  exit 1
fi

echo ""
echo "Step 12: Cleanup old backups (keeping last 5)..."
cd "$BACKUP_DIR"
ls -t | tail -n +6 | xargs -r rm -rf

echo ""
echo "=========================================="
echo "Deployment completed successfully!"
echo "Finished at: $(date)"
echo "=========================================="

echo "Service Status:"
systemctl is-active "$BACKEND_SERVICE" && echo "✓ Backend: Running" || echo "✗ Backend: Not running"
systemctl is-active nginx && echo "✓ Nginx: Running" || echo "✗ Nginx: Not running"
