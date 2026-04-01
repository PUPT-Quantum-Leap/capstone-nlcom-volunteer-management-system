#!/bin/sh
set -e

composer install --no-interaction --prefer-dist

# Always use Docker env config
cp .env.docker .env

# Generate APP_KEY if not set
grep -q "APP_KEY=base64" .env || php artisan key:generate --no-interaction

# Fix permissions
chmod -R 775 storage bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache 2>/dev/null || true

php artisan migrate --force

exec "$@"
