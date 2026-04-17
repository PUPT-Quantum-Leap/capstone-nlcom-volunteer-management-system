#!/usr/bin/env bash
set -e

echo "=== ServeTrack Backend Container Starting ==="

# Wait for MySQL to be ready
if [ -n "${DB_HOST:-}" ]; then
    echo "Waiting for database (${DB_HOST}:${DB_PORT:-3306}) to be ready..."
    max_attempts=30
    attempt=1
    while ! nc -z "${DB_HOST}" "${DB_PORT:-3306}" 2>/dev/null; do
        if [ $attempt -ge $max_attempts ]; then
            echo "❌ ERROR: Database not ready after $max_attempts attempts"
            exit 1
        fi
        echo "  Attempt $attempt/$max_attempts..."
        sleep 1
        attempt=$((attempt + 1))
    done
    echo "✓ Database is ready"
fi

# Show PHP-FPM info
echo ""
echo "PHP-FPM Configuration:"
php-fpm --version
echo ""

# Start PHP-FPM in foreground mode
echo "Starting PHP-FPM..."
exec php-fpm
