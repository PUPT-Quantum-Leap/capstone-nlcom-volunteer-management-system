#!/usr/bin/env bash

set -euo pipefail

echo "=========================================="
echo "ServeTrack Docker Deployment"
echo "Started at: $(date)"
echo "=========================================="

# Configuration from environment or defaults
DOCKER_HUB_USERNAME="${DOCKER_HUB_USERNAME:-}"
COMPOSE_FILE="docker-compose.prod.yml"
DEPLOY_PATH="${DEPLOY_PATH:-.}"
MAX_HEALTH_CHECK_ATTEMPTS=30
HEALTH_CHECK_INTERVAL=2

# Trap errors
trap 'echo "❌ Deployment failed at line $LINENO"; exit 1' ERR

# Validate Docker Hub username
if [ -z "$DOCKER_HUB_USERNAME" ]; then
    echo "⚠️  WARNING: DOCKER_HUB_USERNAME not set, using local images"
fi

echo ""
echo "Step 1: Pull latest code from repository..."
cd "$DEPLOY_PATH"
git fetch origin
git reset --hard origin/main
echo "✓ Repository updated"

echo ""
echo "Step 2: Pull latest Docker images..."
docker compose -f "$COMPOSE_FILE" pull
echo "✓ Images pulled successfully"

echo ""
echo "Step 3: Prepare environment files..."
if [ ! -f "servetrack-backend/.env" ]; then
    echo "  Creating .env from template..."
    cp servetrack-backend/.env.docker servetrack-backend/.env
    echo "  ⚠️  WARNING: .env file created from template"
    echo "  ⚠️  MANUAL ACTION REQUIRED: Edit servetrack-backend/.env with:"
    echo "     - DB_PASSWORD"
    echo "     - MYSQL_ROOT_PASSWORD"
    echo "     - ADMIN_INVITE_CODE"
    echo ""
    exit 1
fi

echo ""
echo "Step 4: Stop old containers (gracefully)..."
docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true
echo "✓ Old containers stopped"

echo ""
echo "Step 5: Start new containers..."
docker compose -f "$COMPOSE_FILE" up -d
echo "✓ New containers started"

echo ""
echo "Step 6: Wait for database to be ready..."
sleep 3

echo ""
echo "Step 7: Run database migrations..."
docker compose -f "$COMPOSE_FILE" exec -T backend php artisan migrate --force
echo "✓ Migrations completed"

echo ""
echo "Step 8: Optimize Laravel caches..."
docker compose -f "$COMPOSE_FILE" exec -T backend php artisan config:cache
docker compose -f "$COMPOSE_FILE" exec -T backend php artisan route:cache
docker compose -f "$COMPOSE_FILE" exec -T backend php artisan view:cache
echo "✓ Caches optimized"

echo ""
echo "Step 9: Health check (waiting up to $MAX_HEALTH_CHECK_ATTEMPTS seconds)..."
attempt=0
while [ $attempt -lt $MAX_HEALTH_CHECK_ATTEMPTS ]; do
    if docker compose -f "$COMPOSE_FILE" exec -T backend curl -sf http://localhost:9000/up >/dev/null 2>&1; then
        echo "✓ Backend health check passed"
        break
    fi
    echo "  Attempt $((attempt + 1))/$MAX_HEALTH_CHECK_ATTEMPTS..."
    sleep $HEALTH_CHECK_INTERVAL
    attempt=$((attempt + 1))
done

if [ $attempt -ge $MAX_HEALTH_CHECK_ATTEMPTS ]; then
    echo "❌ Backend health check failed after $MAX_HEALTH_CHECK_ATTEMPTS seconds"
    echo ""
    echo "Backend logs (last 50 lines):"
    docker compose -f "$COMPOSE_FILE" logs backend | tail -50
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ Deployment Completed Successfully!"
echo "Finished at: $(date)"
echo "=========================================="

echo ""
echo "Service Status:"
docker compose -f "$COMPOSE_FILE" ps

echo ""
echo "Access your app at: https://servetrack.kaelvxdev.space"
