---
name: production-docker-plan
description: Detailed plan to create production‑ready Docker images and deployment for ServeTrack.
type: project
---

# Goal
Replace the current development‑only Docker setup with a production‑ready multi‑stage Docker configuration that can be deployed on a Hostinger VPS (Ubuntu 24.04 recommended).

## 1. Backend (Laravel) – Production Dockerfile
1. **Base image**: `php:8.2-fpm-alpine` (lightweight, includes FPM).
2. **Multi‑stage build**:
   - **Builder stage**: install build dependencies, copy composer files, run `composer install --no-dev --optimize-autoloader`.
   - **Production stage**: copy only the vendor folder and app code, set proper permissions, expose port 9000 (FPM).
3. **Entry point**: Use `docker-php-entrypoint` (provided by official image) – no custom script needed.
4. **Environment**: `.env.docker` will be copied as `.env` at runtime; ensure secrets are injected via Docker‑compose env‑file or Docker secrets.
5. **Migrations**: Run `php artisan migrate --force` via an **init container** in compose (or a one‑off command).

## 2. Frontend (Angular) – Production Dockerfile
1. **Multi‑stage build**:
   - **Builder stage**: `node:22-alpine` – copy `package*.json`, run `npm ci`, then `npm run build` (produces `dist/` folder).
   - **Production stage**: `nginx:alpine` – copy built `dist/` into `/usr/share/nginx/html`.
2. **Nginx config**: Add a simple config that serves SPA, rewrites all routes to `index.html`, and proxies `/api/*` to the backend service (via Docker network name `backend:8000`).
3. **Expose port** 80.

## 3. Reverse Proxy – Nginx (single container)
Instead of two separate Nginx containers, we can have a **gateway** container that:
- Serves the Angular static files (from the frontend image via a volume or a copy step).
- Proxy `/api` to the backend FPM service.
- Handles SSL termination (optional – can be done at Hostinger level with Let’s Encrypt).

### Options:
- **Option A**: Keep separate `frontend` (nginx) and `backend` (php‑fpm) services, connect via Docker network. Simpler, each service independently scalable.
- **Option B**: Single Nginx container acting as front‑end for both, mounting the Angular build as a static directory and proxying to backend. Slightly more complex but reduces one container.
We'll adopt **Option A** (mirrors existing compose) for clarity.

## 4. Docker‑Compose – Production Profile
Create a new compose file (or profile) `docker-compose.prod.yml` with:
```yaml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - frontend_build:/usr/share/nginx/html:ro
    depends_on:
      - backend
    networks: [servetrack]

  backend:
    build:
      context: ./servetrack-backend
      dockerfile: Dockerfile.prod
    env_file:
      - ./servetrack-backend/.env.docker
    volumes:
      - ./servetrack-backend:/var/www:ro
    networks: [servetrack]

  frontend:
    build:
      context: ./servetrack-frontend
      dockerfile: Dockerfile.prod
    volumes:
      - frontend_build:/app/dist
    networks: [servetrack]

  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: ${MYSQL_DATABASE}
      MYSQL_USER: ${MYSQL_USER}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
    volumes:
      - mysql_data:/var/lib/mysql
    networks: [servetrack]

volumes:
  frontend_build:
  mysql_data:

networks:
  servetrack:
    driver: bridge
```
Include an **init service** for migrations:
```yaml
  migrate:
    image: backend
    command: php artisan migrate --force
    depends_on:
      - mysql
    networks: [servetrack]
    restart: "no"
```
Run it once after `docker compose up -d`.

## 5. Nginx Config (frontend)
Create `nginx/conf.d/default.conf`:
```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://backend:9000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
Adjust the backend port if you expose php‑fpm on a different port.

## 6. Environment & Secrets
- Keep `.env.docker` for non‑secret values (APP_NAME, DB_HOST, etc.).
- Pass secrets via Docker‑compose environment variables or a `.env` file that is **not** committed.
- On Hostinger, set these env vars in the Docker‑compose deployment process or via a `.env.prod` file.

## 7. Build & Deploy Steps (User workflow)
1. `docker compose -f docker-compose.prod.yml build`
2. `docker compose -f docker-compose.prod.yml up -d`
3. Run migration init container: `docker compose -f docker-compose.prod.yml run --rm migrate`
4. Verify the site at `http://<vps-ip>`.
5. (Optional) Install Certbot on the VPS and configure SSL on the Nginx container (or use Hostinger's SSL service).

## 8. Testing Locally
- Use `docker compose -f docker-compose.prod.yml up --build` on a local machine to ensure everything works before pushing to the VPS.
- Run Laravel Pest tests and Angular Vitest inside the containers (add a `test` service if needed).

---
**Next steps**
- Create `Dockerfile.prod` for backend and frontend.
- Add Nginx config and the production compose file.
- Verify migrations and environment handling.
- Document the deployment commands for the VPS.

Let me know if you’d like to adjust any part of this plan before I start implementing it.
