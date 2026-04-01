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

### Files to Create (5 files)

| #  | File                                  | Purpose                                        |
|----|---------------------------------------|------------------------------------------------|
| 1  | `servetrack-frontend/.dockerignore`   | Exclude node_modules, dist                     |
| 2  | `servetrack-frontend/Dockerfile`      | Node 22 + `ng serve` with HMR                 |
| 3  | `servetrack-backend/.dockerignore`    | Exclude vendor, storage/logs                   |
| 4  | `servetrack-backend/Dockerfile`       | PHP 8.2 CLI + extensions + Composer            |
| 5  | `docker-compose.yml`                  | All 3 services with bind-mounts                |

### Service Details

**Frontend Container**
- Base: `node:22-alpine`
- Workdir: `/app`
- Bind-mount: `./servetrack-frontend:/app` (source code for live edits)
- Named volume: `frontend_node_modules` (excluded from bind-mount to keep host clean)
- Command: `npm start` (runs `ng serve --host 0.0.0.0 --poll 2000`)
- Port: `4200:4200`
- Environment: `CHOKIDAR_USEPOLLING=true` (ensures file watcher works in Docker on all OS)

**Backend Container**
- Base: `php:8.2-cli`
- Extensions: `pdo_mysql`, `bcmath`, `gd`, `xml`, `zip`, `intl`
- Composer installed globally
- Bind-mount: `./servetrack-backend:/var/www`
- Port: `8000:8000`
- Command: `php artisan serve --host=0.0.0.0 --port=8000`
- Entrypoint runs: `composer install`, key generation

**MySQL Container**
- Image: `mysql:8.0`
- Named volume: `mysql_data` for persistence
- Port: `3306:3306` (accessible from host for tools like TablePlus)
- Healthcheck: `mysqladmin ping`

### docker-compose.yml Structure

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
    environment:
      - DB_HOST=mysql
      - DB_DATABASE=servetrack
      - DB_USERNAME=servetrack
      - DB_PASSWORD=secret
      - APP_ENV=local
      - APP_DEBUG=true
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
CMD ["npm", "start", "--", "--host", "0.0.0.0", "--poll", "2000"]
```

**`servetrack-backend/Dockerfile`**

```dockerfile
FROM php:8.2-cli
RUN apt-get update && apt-get install -y git curl zip unzip \
    libpng-dev libxml2-dev libzip-dev libicu-dev \
    && docker-php-ext-install pdo_mysql bcmath gd xml zip intl
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
WORKDIR /var/www
COPY . .
RUN composer install
EXPOSE 8000
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]
```

### Usage

```bash
# Start everything
docker compose up -d --build

# First-time setup
docker compose exec backend php artisan key:generate
docker compose exec backend php artisan migrate:fresh --seed

# Access
# Frontend:  http://localhost:4200
# Backend:   http://localhost:8000/api
# MySQL:     localhost:3306

# View logs
docker compose logs -f frontend
docker compose logs -f backend

# Stop
docker compose down

# Reset everything (including DB)
docker compose down -v
```

### Implementation Order

1. Create `servetrack-frontend/.dockerignore`
2. Create `servetrack-frontend/Dockerfile` (Node 22 + ng serve)
3. Create `servetrack-backend/.dockerignore`
4. Create `servetrack-backend/Dockerfile` (PHP 8.2 CLI + Composer)
5. Create `docker-compose.yml` (3 services + volumes)
6. Test: `docker compose config` — validate YAML syntax
7. Test: `docker compose build` — verify images build successfully
8. Test: `docker compose up -d` — verify all services start
9. Verify: Open `http://localhost:4200`, test login, test API calls

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
| 7  | `.env.docker`                                 | Docker env template                 |

### Production Usage

```bash
# Copy and edit environment
cp .env.docker .env
# Edit: DOMAIN, DB_PASSWORD, MYSQL_ROOT_PASSWORD, APP_KEY

# Build and start
docker compose -f docker-compose.prod.yml up -d --build

# First-time setup
docker compose -f docker-compose.prod.yml exec backend php artisan key:generate
docker compose -f docker-compose.prod.yml exec backend php artisan migrate --seed
docker compose -f docker-compose.prod.yml exec backend php artisan storage:link
```
