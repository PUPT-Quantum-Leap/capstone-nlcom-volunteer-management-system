# ServeTrack Dockerization Plan

## Phase 1: Local Development Docker

### Architecture

```
Developer Machine
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  ┌──────────────┐   ┌──────────────┐   ┌───────────────┐ │
│  │  Node 22     │──▶│  PHP 8.2     │──▶│  MySQL 8.0    │ │
│  │  ng serve    │   │  artisan     │   │  (persisted)  │ │
│  │  :4200       │   │  serve :8000 │   │  :3306        │ │
│  └──────────────┘   └──────────────┘   └───────────────┘ │
│   (bind-mount)        (bind-mount)                        │
└────────────────────────────────────────────────────────────┘
```

### Files to Create (7 files)

| #  | File                                  | Purpose                          |
|----|---------------------------------------|----------------------------------|
| 1  | `servetrack-frontend/.dockerignore`   | Exclude node_modules, dist       |
| 2  | `servetrack-frontend/Dockerfile`      | Node 22 + `ng serve`             |
| 3  | `servetrack-backend/.dockerignore`    | Exclude vendor, storage/logs     |
| 4  | `servetrack-backend/Dockerfile`       | PHP 8.2 + Composer + entrypoint  |
| 5  | `servetrack-backend/entrypoint.sh`    | Install deps, key:generate, perms|
| 6  | `servetrack-backend/.env.docker`      | Docker-specific env vars         |
| 7  | `docker-compose.yml`                  | 3 services + volumes + network   |

### Service Details

**Frontend Container**
- Base: `node:22-alpine`
- Workdir: `/app`
- Bind-mount: `./servetrack-frontend:/app` (source code for live edits)
- Named volume: `frontend_node_modules` (excluded from bind-mount to keep host clean)
- Command: `npm start` (runs `ng serve --host 0.0.0.0 --poll 2000` via package.json)
- Port: `4200:4200`
- Environment: `CHOKIDAR_USEPOLLING=true` (ensures file watcher works in Docker on all OS)

**Backend Container**
- Base: `php:8.2-cli`
- Extensions: `pdo_mysql`, `bcmath`, `gd`, `xml`, `zip`, `intl`
- Composer installed globally
- Bind-mount: `./servetrack-backend:/var/www`
- Named volume: `backend_vendor` (excluded from bind-mount)
- Port: `8000:8000`
- Entrypoint: `entrypoint.sh` handles composer install, APP_KEY, permissions, migrations
- Command: `php artisan serve --host=0.0.0.0 --port=8000`
- Environment: loaded from `servetrack-backend/.env.docker`

**MySQL Container**
- Image: `mysql:8.0`
- Named volume: `mysql_data` for persistence
- Port: `3306:3306` (accessible from host for tools like TablePlus)
- Healthcheck: `mysqladmin ping`

### docker-compose.yml

```yaml
services:
  frontend:
    build:
      context: ./servetrack-frontend
      dockerfile: Dockerfile
    ports:
      - "4200:4200"
    volumes:
      - ./servetrack-frontend:/app
      - frontend_node_modules:/app/node_modules
    environment:
      - CHOKIDAR_USEPOLLING=true
    networks: [servetrack]
    depends_on:
      backend:
        condition: service_started

  backend:
    build:
      context: ./servetrack-backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    volumes:
      - ./servetrack-backend:/var/www
      - backend_vendor:/var/www/vendor
    env_file:
      - ./servetrack-backend/.env.docker
    networks: [servetrack]
    depends_on:
      mysql:
        condition: service_healthy

  mysql:
    image: mysql:8.0
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    environment:
      MYSQL_ROOT_PASSWORD: rootsecret
      MYSQL_DATABASE: servetrack
      MYSQL_USER: servetrack
      MYSQL_PASSWORD: secret
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks: [servetrack]

networks:
  servetrack:
    driver: bridge

volumes:
  frontend_node_modules:
  backend_vendor:
  mysql_data:
```

### Dockerfile Details

**`servetrack-frontend/Dockerfile`**

```dockerfile
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 4200

CMD ["npm", "start"]
```

> **Note:** `start` script in `package.json` must be:
> ```json
> "start": "ng serve --host 0.0.0.0 --poll 2000"
> ```

**`servetrack-backend/Dockerfile`**

```dockerfile
FROM php:8.2-cli

RUN apt-get update && apt-get install -y \
    git curl zip unzip \
    libpng-dev libxml2-dev libzip-dev libicu-dev \
    && docker-php-ext-install pdo_mysql bcmath gd xml zip intl \
    && rm -rf /var/lib/apt/lists/*

RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

WORKDIR /var/www

COPY . .
RUN composer install --no-dev --optimize-autoloader --no-interaction

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]
```

**`servetrack-backend/entrypoint.sh`**

```sh
#!/bin/sh
set -e

composer install --no-interaction --prefer-dist

if [ ! -f .env ]; then
    cp .env.docker .env
fi

# Generate APP_KEY if not set
grep -q "APP_KEY=base64" .env || php artisan key:generate --no-interaction

# Fix permissions
chmod -R 775 storage bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache 2>/dev/null || true

php artisan migrate --force

exec "$@"
```

**`servetrack-backend/.env.docker`**

```
APP_NAME=ServeTrack
APP_ENV=local
APP_DEBUG=true
APP_URL=http://localhost:8000

LOG_CHANNEL=stack
LOG_LEVEL=debug

DB_CONNECTION=mysql
DB_HOST=mysql
DB_PORT=3306
DB_DATABASE=servetrack
DB_USERNAME=servetrack
DB_PASSWORD=secret

BROADCAST_DRIVER=log
CACHE_DRIVER=file
FILESYSTEM_DISK=local
QUEUE_CONNECTION=sync
SESSION_DRIVER=file
SESSION_LIFETIME=120

ADMIN_INVITE_CODE=ChangeMe123!
ADMIN_ALLOWED_DOMAINS=example.com
```

### Usage

```bash
# Start everything (first time)
docker compose up -d --build

# Seed the database
docker compose exec backend php artisan db:seed

# Access
# Frontend:  http://localhost:4200
# Backend:   http://localhost:8000/api
# MySQL:     localhost:3306

# View logs
docker compose logs -f frontend
docker compose logs -f backend

# Stop
docker compose down

# Stop and remove DB data
docker compose down -v
```

### What the Entrypoint Handles Automatically

| Concern          | Solution                                              |
|------------------|-------------------------------------------------------|
| APP_KEY missing  | `php artisan key:generate` runs on every start        |
| storage/ perms   | `chmod -R 775` + `chown` on every start              |
| .env missing     | Copies `.env.docker` as `.env` if none exists         |
| vendor/ missing  | `composer install` runs on every start                |
| Migrations       | `php artisan migrate --force` on every start          |

### Key Considerations

| Concern              | Approach                                                                  |
|----------------------|---------------------------------------------------------------------------|
| File watching        | `CHOKIDAR_USEPOLLING=true` + `--poll 2000` for cross-OS HMR              |
| node_modules         | Named volume `frontend_node_modules` keeps host clean                     |
| vendor               | Named volume `backend_vendor` keeps host clean                            |
| DB persistence       | Named volume `mysql_data` survives `docker compose down`                  |
| Source changes        | Bind-mounts mean edits on host reflect immediately in containers           |
| Frontend → Backend   | Angular calls `http://localhost:8000/api` (already in `environment.ts`)   |
| CORS                 | Laravel CORS middleware already configured in `bootstrap/app.php`         |
| Named network        | `servetrack` bridge network for inter-service communication               |
| .env conflict        | Separate `.env.docker` avoids conflicts with host `.env`                  |

---

## Phase 2: Production Docker (VPS)

_To be implemented after Phase 1 is working._

### Architecture (Production VPS)

```
Internet
   │
   ▼
┌──────────────────────────────────────────────────────────┐
│  Caddy (:80/:443)  ← Auto HTTPS, Let's Encrypt          │
│  ┌────────────────────┐  ┌─────────────────────────────┐ │
│  │  /api/*  ──────────▶│  │  Frontend (Nginx static)    │ │
│  │                    │  │  /  → Angular build          │ │
│  └────────────────────┘  └─────────────────────────────┘ │
└──────────┬───────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────┐
│  PHP-FPM 8.2 (Laravel)  ◄──►  MySQL 8.0                 │
└──────────────────────────────────────────────────────────┘
```

### Production Files (to create later)

| #  | File                                          | Purpose                             |
|----|-----------------------------------------------|-------------------------------------|
| 1  | `servetrack-frontend/Dockerfile.prod`         | Multi-stage: Node build → Nginx     |
| 2  | `servetrack-frontend/nginx-prod.conf`         | SPA routing + API proxy             |
| 3  | `servetrack-backend/Dockerfile.prod`          | PHP 8.2-FPM + optimized Composer    |
| 4  | `servetrack-backend/docker/nginx.conf`        | Nginx config for Laravel fastcgi    |
| 5  | `Caddyfile`                                   | Reverse proxy + auto HTTPS          |
| 6  | `docker-compose.prod.yml`                     | Production services                 |
| 7  | `.env.production`                             | Production env template             |

### Production Usage

```bash
# Copy and edit environment
cp .env.production .env
# Edit: DOMAIN, DB_PASSWORD, MYSQL_ROOT_PASSWORD

# Build and start
docker compose -f docker-compose.prod.yml up -d --build

# First-time setup
docker compose -f docker-compose.prod.yml exec backend php artisan migrate --seed
docker compose -f docker-compose.prod.yml exec backend php artisan storage:link
```
