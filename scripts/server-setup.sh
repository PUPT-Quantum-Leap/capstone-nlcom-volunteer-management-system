#!/usr/bin/env bash

# ServeTrack Server File Structure Setup
# Run this on the VPS: curl https://raw.githubusercontent.com/.../setup.sh | sudo bash
# Or manually copy each section below

set -euo pipefail

echo "=========================================="
echo "ServeTrack Server Setup"
echo "=========================================="

# Step 1: Create directory structure
echo "Step 1: Creating directory structure..."
sudo mkdir -p /var/www/servetrack/releases
sudo mkdir -p /var/www/servetrack/shared/backend/storage/framework/cache/data
sudo mkdir -p /var/www/servetrack/shared/backend/storage/framework/sessions
sudo mkdir -p /var/www/servetrack/shared/backend/storage/framework/views
sudo mkdir -p /var/www/servetrack/shared/backend/storage/logs
sudo mkdir -p /var/www/servetrack/shared/backend/storage/app/public

# Step 2: Set ownership
echo "Step 2: Setting ownership to root:www-data..."
sudo chown -R root:www-data /var/www/servetrack

# Step 3: Set permissions
echo "Step 3: Setting permissions..."
sudo chmod -R 755 /var/www/servetrack
sudo chmod -R 775 /var/www/servetrack/shared/backend/storage

# Step 4: Verify structure
echo "Step 4: Verifying structure..."
ls -la /var/www/servetrack/
echo ""
ls -la /var/www/servetrack/shared/backend/storage/
echo ""

# Step 5: Display next steps
echo "=========================================="
echo "✅ Directory structure created successfully!"
echo "=========================================="
echo ""
echo "📝 NEXT STEPS:"
echo "1. Create /var/www/servetrack/shared/.env with your production config"
echo "   sudo nano /var/www/servetrack/shared/.env"
echo ""
echo "2. Secure the .env file:"
echo "   sudo chmod 640 /var/www/servetrack/shared/.env"
echo "   sudo chown root:www-data /var/www/servetrack/shared/.env"
echo ""
echo "3. Verify setup:"
echo "   sudo -u www-data test -r /var/www/servetrack/shared/.env && echo '.env readable ✓'"
echo "   sudo -u www-data test -w /var/www/servetrack/shared/backend/storage && echo 'storage writable ✓'"
