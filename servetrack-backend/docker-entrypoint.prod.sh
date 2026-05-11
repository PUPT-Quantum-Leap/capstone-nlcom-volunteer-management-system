#!/bin/sh
set -e

echo "Starting ServeTrack Backend..."

# Wait for MySQL to be ready
until php artisan db:show 2>/dev/null; do
  echo "Waiting for MySQL..."
  sleep 2
done

echo "Running migrations..."
php artisan migrate --force

echo "Optimizing application..."
php artisan config:cache
php artisan route:cache
php artisan view:cache

echo "Linking storage..."
php artisan storage:link || true

echo "Backend ready!"
exec "$@"
