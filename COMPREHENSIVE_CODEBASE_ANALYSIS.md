# ServeTrack Codebase - Comprehensive Analysis

**Volunteer Management System: Angular 21 + Laravel 12**

---

## EXECUTIVE SUMMARY

ServeTrack is a production-ready monorepo with:
- **Angular 21** frontend SPA (TypeScript 5.9)
- **Laravel 12** REST API backend (PHP 8.2+)
- **MySQL 8.0** relational database
- **Docker Compose** for development and production
- **GitHub Actions** CI/CD with automated testing
- **38 database migrations** for volunteer management features
- **Comprehensive security** with Gitleaks, Sanctum, role-based access

---

## 1. KEY DIRECTORIES & PURPOSES

### Root Structure
```
capstone-nlcom-volunteer-management-system/
├── servetrack-frontend/        # Angular 21 SPA (port 4200)
├── servetrack-backend/         # Laravel 12 API (port 8000)
├── .github/workflows/          # 5 CI/CD pipelines
├── docs/                       # 19 documentation files
├── docker-compose.yml          # Development containers
├── docker-compose.prod.yml     # Production containers
├── AGENTS.md                   # Development guidelines
├── .husky/                     # Git hooks (pre-commit)
└── .gitleaks.toml             # Secret scanning config
```

### Frontend Structure (src/app)
- `admin-dashboard/` - Admin panel features
- `auth/` - Login, signup, OAuth flows
- `volunteer-dashboard/` - Volunteer UI features
- `rsvp/` - Poll and RSVP functionality
- `incident-command-system/` - ICS features
- `components/` - Shared UI components
- `services/` - HTTP API services
- `guards/` - Route protection
- `interceptors/` - HTTP interceptors
- `models/` - TypeScript interfaces
- `validators/` - Form validation rules

### Backend Structure (app/)
- `Http/` - Controllers, Form Requests, API Resources
- `Models/` - 15+ Eloquent models with relationships
- `Services/` - Business logic services
- `Jobs/` - Queued background jobs
- `Policies/` - Authorization policies
- `Observers/` - Model lifecycle observers
- `Console/` - Artisan commands
- `Constants/` - Enums and application constants

---

## 2. TECHNOLOGY STACK

### Frontend Stack
| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | Angular | 21.2.4 |
| Language | TypeScript | 5.9.2 |
| Testing | Vitest | 4.0.18 |
| Test Plugin | @analogjs/vitest-angular | 2.3.1 |
| HTTP Client | RxJS | 7.8.0 |
| Styling | Tailwind CSS | 3/4 |
| Build Tool | Angular CLI | 21.2.2 |
| Linting | ESLint, angular-eslint | 9.39.2 / 21.3.0 |
| Code Format | Prettier | Built-in |
| Runtime | Node.js | 22.x |
| Package Mgr | npm | 11.6.3 |

**Direct Dependencies (5):**
```
@angular/common, @angular/core, @angular/forms
@angular/router, rxjs, tslib
```

**Dev Dependencies (18):** Angular build tools, Vitest, ESLint, TypeScript compiler

### Backend Stack
| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | Laravel | 12.0 |
| Language | PHP | 8.2+ |
| Database | MySQL | 8.0 |
| Authentication | Laravel Sanctum | 4.0 |
| Testing | Pest | 3.8 |
| Test Plugin | pest-plugin-laravel | 3.2 |
| Code Format | Laravel Pint | Latest |
| Data Gen | Faker | 1.23 |
| Package Mgr | Composer | 2.x |
| Build Tool | Vite | Latest |
| Styling | Tailwind CSS | 4 |
| External APIs | Facebook SDK, Twilio SDK | Latest |

**Direct Dependencies (7):**
```
laravel/framework, laravel/sanctum, laravel/tinker
laravel/boost, facebook/graph-sdk, twilio/sdk, php 8.2+
```

**Dev Dependencies (8):** Pest, Pint, Faker, Mockery, Collision, Sail, Pail

---

## 3. CONFIGURATION FILES INVENTORY

### Docker Configuration
| File | Purpose | Environment |
|------|---------|-------------|
| `docker-compose.yml` | 3-service dev setup | Development |
| `docker-compose.prod.yml` | 4-service + migrate | Production |
| `servetrack-frontend/Dockerfile` | Node 22 dev image | Development |
| `servetrack-frontend/Dockerfile.prod` | Nginx Alpine image | Production |
| `servetrack-backend/Dockerfile` | PHP 8.2-CLI image | Development |
| `servetrack-backend/Dockerfile.prod` | PHP 8.2-FPM Alpine | Production |
| `.dockerignore` (both) | Exclude from image | Both |

### Environment Configuration
| File | Purpose |
|------|---------|
| `.env.example` | Template (backend) |
| `.env.docker` | Docker-specific config (backend) |
| `.env` | Local development (backend, NOT in git) |
| `src/environments/environment.ts` | Frontend dev config |
| `src/environments/environment.prod.ts` | Frontend prod config |

### Build & Tool Configuration
| File | Tool |
|------|------|
| `angular.json` | Angular CLI |
| `tsconfig.json` | TypeScript |
| `vitest.config.ts` | Vitest test runner |
| `eslint.config.js` | ESLint |
| `composer.json` | Composer |
| `package.json` (2x) | npm |
| `phpunit.xml` | Pest testing |
| `vite.config.js` | Vite bundler |

### Security & Git
| File | Purpose |
|------|---------|
| `.gitleaks.toml` | Secret detection rules |
| `.github/dependabot.yml` | Dependency updates |
| `.husky/pre-commit` | Git hook script |
| `.gitignore` | Excluded files |

---

## 4. CI/CD & DEPLOYMENT CONFIGURATION

### GitHub Actions Workflows

**ci.yml** - Main CI Pipeline
- Triggers: PR to main, push to main, manual dispatch
- Change detection: Detects frontend/backend changes
- Frontend Check:
  - Node 22, npm cache
  - Build: `npm run build`
  - Test: `npm test` (Vitest)
  - Coverage reporting
- Backend Check:
  - PHP 8.2 with extensions (mbstring, xml, ctype, iconv, intl, pdo_sqlite, dom, filter, gd, json, pdo, zip)
  - Composer install with cache
  - Environment: SQLite :memory: database
  - Format check: `vendor/bin/pint --test`
  - Tests: `php artisan test` (Pest)
- Summary: Ensures all checks pass

**gitleaks.yml** - Security Scanning
- Scans all pushes and PRs for secrets
- Blocks commits with exposed credentials
- Uploads SARIF reports

**Other Workflows:**
- `opencode-review.yml` - Code review automation
- `greet.yml` - Welcome message
- `opencode.yml` - OpenCode integration

### Docker Compose Services

**Development (docker-compose.yml)**
```
frontend   Node 22-Alpine      Angular dev server    :4200
backend    PHP 8.2-CLI         Laravel artisan serve :8000
mysql      MySQL 8.0           Database              :3306 (internal)

Volumes:
  frontend_node_modules - Persist npm packages
  backend_vendor        - Persist Composer packages
  mysql_data            - Persist database

Network: servetrack (bridge)
```

**Production (docker-compose.prod.yml)**
```
nginx      Nginx Alpine        Reverse proxy         :80
backend    PHP 8.2-FPM Alpine  Laravel app           :9000
frontend   Nginx Alpine        Static files          (internal)
mysql      MySQL 8.0           Database              :3306 (internal)
migrate    PHP 8.2-FPM Alpine  Run migrations        (one-time)

Restart: unless-stopped
```

### Deployment Scripts
- `entrypoint.sh` - Backend dev startup
- Docker entry in Dockerfile.prod - Production startup
- `start-fullstack-dev.ps1` - PowerShell dev startup

---

## 5. ENVIRONMENT VARIABLES

### Critical Variables (Must Configure)

**Backend .env / .env.docker**
```
# Core
APP_NAME=ServeTrack
APP_ENV=local|production
APP_KEY=base64:xxxxx (MUST GENERATE)
APP_DEBUG=true|false
APP_URL=http://localhost:8000

# Database
DB_CONNECTION=mysql
DB_HOST=127.0.0.1 (dev) or mysql (Docker)
DB_PORT=3306
DB_DATABASE=servetrack_backend
DB_USERNAME=root
DB_PASSWORD=

# Security
ADMIN_INVITE_CODE=ChangeMe123! (IMPORTANT!)
ADMIN_ALLOWED_DOMAINS=example.com

# Optional but Important
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=null
QUEUE_CONNECTION=sync|redis
CACHE_DRIVER=file|redis
SESSION_DRIVER=file|redis

# Mail/SMS
MAIL_MAILER=smtp|log
MAIL_HOST=mailpit|smtp.provider
MAIL_PORT=1025|587
MAIL_USERNAME=null|email
MAIL_PASSWORD=null|password
MAIL_ENCRYPTION=null|tls
MAIL_FROM_ADDRESS=hello@example.com
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE=

# OAuth
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
```

**Frontend** - src/environments/environment.ts:
- API URL endpoint
- Feature flags
- Third-party API keys

**CI/CD Environment Overrides:**
```
APP_ENV=testing
DB_CONNECTION=sqlite
DB_DATABASE=:memory:
CACHE_STORE=array
SESSION_DRIVER=array
QUEUE_CONNECTION=sync
```

---

## 6. DATABASE MIGRATIONS

### Total: 38 Migration Files

**Core Infrastructure (4)**
- `create_users_table` - User authentication
- `create_cache_table` - Cache storage
- `create_jobs_table` - Job queue
- `create_personal_access_tokens_table` - Sanctum tokens

**User Management (7)**
- `add_lockout_fields_to_users_table` - Login attempt tracking
- `add_user_id_to_volunteer_table` - User-Volunteer link
- `add_role_to_users_table` - Role assignment
- `fix_admin_table_schema` - Admin schema correction
- `add_soft_deletes_to_users_table` - Soft delete support
- `add_emergency_contact_id_to_volunteer_table` - Emergency contact link
- `create_emergency_contacts_table` - Emergency contact storage

**Core Models (16)**
- `create_volunteer_table` - Main volunteer record
- `create_admin_table` - Admin users
- `create_coordinator_table` - Coordinators
- `create_availability_table` - Availability templates
- `create_experience_table` - Experience levels
- `create_lifegroup_table` - Life group assignments
- `create_position_table` - Volunteer positions
- `create_skill_table` - Required skills
- `create_training_table` - Training requirements
- `create_option_table` - General options
- `create_sms_notification_table` - SMS logs
- `create_poll_table` → `rename_poll_tables_to_rsvp` - Poll/RSVP system
- `create_poll_option_table` - Poll options
- `create_poll_vote_table` - Poll votes
- `create_attendances_table` - Event attendance
- `create_profile_change_logs_table` - Audit trail

**Junction Tables (6)**
- `create_volunteer_availability_table` - Volunteer availability mappings
- `create_volunteer_experience_table` - Volunteer experience levels
- `create_volunteer_lifegroup_table` - Volunteer life group assignments
- `create_volunteer_position_table` - Volunteer position assignments
- `create_volunteer_skill_table` - Volunteer skills
- `create_volunteer_training_table` - Volunteer training completion

**Enhancements (5)**
- `expand_position_name_column` - Longer position names
- `add_profile_photo_to_volunteer_table` - Profile photos
- `add_indexes_to_attendances_table` - Performance indexes
- `add_soft_deletes_to_volunteer_table` - Soft delete support
- `rename_poll_tables_to_rsvp` - Renamed poll tables to RSVP

### Key Database Features
✓ Soft deletes on Volunteer & User models (audit trail)
✓ Profile change logging for audit compliance
✓ Complex many-to-many relationships for flexibility
✓ Performance indexes on attendance queries
✓ Cascading deletes configured appropriately

---

## 7. CI/CD PIPELINE DETAILS

### Trigger Conditions
- Pull requests to `main` branch
- Pushes to `main` branch
- Manual workflow dispatch via GitHub UI

### Change Detection
- **Frontend trigger:** Changes in `servetrack-frontend/**`
- **Backend trigger:** Changes in `servetrack-backend/**`
- **Independent execution:** Only affected app's tests run
- **Optimization:** Skip tests if no relevant changes

### Frontend Check (Angular 21 + Vitest)
1. Setup: Node 22, npm cache from package-lock.json
2. Install: `npm ci` (clean install)
3. Build: `npm run build --if-present`
4. Test: `npm test` (CI=true flag)
5. Coverage: Vitest v8 coverage reports
6. Environment: jsdom for DOM testing

### Backend Check (Laravel 12 + Pest)
1. Setup: PHP 8.2 with extensions:
   - Database: pdo_sqlite
   - Images: gd
   - Data: mbstring, xml, intl, json
   - Archives: zip
   - Web: dom, filter
   - Math: bcmath
2. Composer: Install with caching
3. Node Setup: Install frontend assets
4. Environment: Copy .env.example, generate APP_KEY
5. Database: SQLite :memory: (no MySQL needed in CI)
6. Migrate: `php artisan migrate --force`
7. Format: `vendor/bin/pint --test` (no auto-fix in CI)
8. Tests: `php artisan test` (Pest)
9. Coverage: Must meet 80% requirement

### Git Hooks (Husky - Pre-Commit)
1. **Gitleaks:** Scan for hardcoded secrets (optional if installed)
   - Blocks commit if secrets found
   - Can be installed from GitHub releases
2. **Laravel Pint:** Format staged PHP files
   - Only formats files staged for commit
   - Runs from `servetrack-backend` directory
   - Auto-formats code to PSR-12 standard
3. **Re-staging:** Adds formatted files back
   - Only re-stages originally staged files
   - Prevents accidental additions

### Success Criteria
✓ No Gitleaks secrets detected
✓ Frontend builds without errors
✓ All frontend tests passing
✓ Backend code meets Pint formatting rules
✓ All backend tests passing (>80% coverage)
✓ No dependency vulnerabilities (Dependabot)

---

## 8. DEPENDENCIES & VERSIONS

### Frontend Dependencies

**Total Packages:** ~500+ (including transitive)
**Lock File:** 11,223 lines
**Direct Dependencies:** 5
**Dev Dependencies:** 18

**Core Packages:**
```
@angular/common: ^21.2.4
@angular/core: ^21.2.4
@angular/forms: ^21.2.4
@angular/router: ^21.2.4
rxjs: ~7.8.0
tslib: ^2.3.0
```

**Dev Packages:**
```
@angular/build: ^21.2.2
@angular/cli: ^21.2.2
@angular/compiler: ^21.2.4
@angular/compiler-cli: ^21.2.4
@angular/language-service: ^21.2.4
@angular/platform-browser-dynamic: ^21.2.4
@analogjs/vite-plugin-angular: ^2.3.0
@analogjs/vitest-angular: ^2.3.1
@vitest/coverage-v8: ^4.0.18
angular-eslint: 21.3.0
eslint: ^9.39.2
jsdom: ^29.0.1
typescript: ~5.9.2
typescript-eslint: 8.50.1
vitest: ^4.0.18
```

**Overrides:** undici, ajv, hono, flatted

### Backend Dependencies

**Total Packages:** ~300+ (including transitive)
**Lock File:** 9,763 lines
**Direct Dependencies:** 7
**Dev Dependencies:** 8

**Core Packages:**
```
laravel/framework: ^12.0
laravel/sanctum: ^4.0
laravel/tinker: ^2.10.1
laravel/boost: *
facebook/graph-sdk: *
twilio/sdk: *
php: ^8.2
```

**Dev Packages:**
```
fakerphp/faker: ^1.23
laravel/pail: ^1.2.2
laravel/pint: *
laravel/sail: ^1.41
mockery/mockery: ^1.6
nunomaduro/collision: ^8.6
pestphp/pest: ^3.8
pestphp/pest-plugin-laravel: ^3.2
```

### Version Requirements
✓ Node.js 22.x is REQUIRED for both apps
✓ npm 11.6.3 is locked in root package.json
✓ PHP 8.2+ with extensions: pdo_mysql, bcmath, gd, xml, zip, intl
✓ Composer 2.x required
✓ MySQL 8.0 compatible

---

## 9. BUILD ARTIFACTS & OUTPUT

### Frontend Build Output
- **Location:** `servetrack-frontend/dist/`
- **Size:** 2.6 MB
- **Contents:** Compiled Angular app, minified bundles, optimized assets
- **Build Time:** ~30-60 seconds
- **Optimization:**
  - Tree-shaking enabled
  - Code minification enabled
  - Output hashing on all assets
  - Source maps in development
  - Critical CSS inlined in production
  
**Budget Limits:**
- Initial bundle: 1-2 MB (warning-error)
- Component styles: 50-100 kB (warning-error)

**Build Command:** `npm run build -- --configuration=production`

### Backend Build Output
- **Location:** `servetrack-backend/storage/`
- **Size:** 3.5 MB
- **Contents:** Application logs, cache files, uploaded files
- **Note:** No build artifacts (interpreted language)

### Docker Image Outputs
- **Frontend:** nginx:alpine serving compiled Angular app
- **Backend:** php:8.2-fpm with Laravel application
- **Multi-stage builds:** Optimized for size and security
- **Production images:** Alpine-based for minimal size

---

## 10. SPECIAL SETUP REQUIREMENTS

### System Requirements

**Minimum:**
- RAM: 2 GB
- CPU: 1 vCPU
- Storage: 25 GB
- OS: Ubuntu 22.04 LTS

**Recommended:**
- RAM: 4 GB
- CPU: 2+ vCPU
- Storage: 50 GB SSD
- OS: Ubuntu 22.04 LTS
- Estimated Cost: $15-20/month (Hostinger VPS KVM)

### Local Development Setup
1. **PHP 8.2+** with extensions: pdo_mysql, bcmath, gd, xml, zip, intl
2. **Composer 2.x**
3. **Node.js 22.x** with npm 11.6.3
4. **MySQL 8.0+** (or Docker)
5. **Git**
6. (Optional) **Docker & Docker Compose** for containerized dev

### First-Time Setup

```bash
# Root level
npm install

# Backend setup
cd servetrack-backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
npm install  # For Vite assets

# Frontend setup
cd ../servetrack-frontend
npm install
```

### Development Startup

```bash
# Terminal 1 - Backend
cd servetrack-backend
composer run dev
# Runs: php artisan serve + queue:listen + npm run dev concurrently
# Available at http://localhost:8000

# Terminal 2 - Frontend
cd servetrack-frontend
npm start
# Dev server at http://localhost:4200
```

### Docker Quick Start

```bash
# Development
docker-compose up

# Production-like setup
docker-compose -f docker-compose.prod.yml up
```

### Key Verification Checkpoints
✓ `.env` file created with `APP_KEY=base64:xxxxx` generated
✓ Database connection verified (MySQL running)
✓ Migrations run successfully (`php artisan migrate`)
✓ Node/npm versions: `22.x` and `11.6.3`
✓ PHP version: `8.2+` with required extensions
✓ Composer dependencies installed
✓ Frontend server running on `http://localhost:4200`
✓ Backend server running on `http://localhost:8000`
✓ No git errors or uncommitted changes

---

## 11. SECURITY FEATURES

### Code Security
✓ **Gitleaks:** Prevents hardcoded secrets in commits
✓ **Pre-commit hooks:** Automated code quality checks
✓ **Laravel Pint:** Code style enforcement (PSR-12)
✓ **Dependabot:** Automated dependency updates
✓ **SARIF reports:** Vulnerability tracking

### Authentication & Authorization
✓ **Laravel Sanctum:** Token-based API authentication
✓ **Admin registration:** Invite code required (ADMIN_INVITE_CODE)
✓ **Role-based access:** Admin, Coordinator, Volunteer roles
✓ **OAuth integration:** Facebook login support
✓ **Authorization policies:** Eloquent policies in place

### Application Security
✓ **CORS configuration:** API endpoint protection
✓ **Form Requests:** Input validation and authorization
✓ **Soft deletes:** Audit trail maintained
✓ **Profile change logging:** Change tracking
✓ **Rate limiting:** Configurable limits
✓ **Password hashing:** bcrypt via Laravel

### Deployment Security
✓ **Environment variables:** Not committed to git
✓ **Secrets in GitHub:** Used via Actions secrets
✓ **Docker:** Non-root user configuration
✓ **Firewall:** UFW configuration documented
✓ **SSL/HTTPS:** Required for production
✓ **Database user:** Limited privileges via configuration
✓ **Admin domains:** Whitelist configured (ADMIN_ALLOWED_DOMAINS)

---

## 12. DEPLOYMENT CHECKLIST

### Pre-Deployment
- [ ] All tests passing: `npm test` + `php artisan test`
- [ ] Code formatted: `./vendor/bin/pint`, `prettier`
- [ ] No Gitleaks warnings: Pre-commit hook passing
- [ ] Dependencies locked: `package-lock.json`, `composer.lock`
- [ ] Environment variables configured for target environment
- [ ] Database migrations tested on staging
- [ ] Frontend production build successful
- [ ] Backend services responding correctly
- [ ] Git status clean: No uncommitted changes

### Deployment
- [ ] Build Docker images from Dockerfile.prod
- [ ] Push to container registry (if using)
- [ ] Deploy docker-compose.prod.yml to server
- [ ] Run migrate service: `php artisan migrate --force`
- [ ] Verify API health: Check `/api/health` endpoint
- [ ] Test frontend routes: Load application in browser
- [ ] Check database connectivity: Query sample data
- [ ] Monitor logs: `docker logs [container-name]`
- [ ] Verify SSL certificate: HTTPS working

### Post-Deployment
- [ ] API responding to requests: Test endpoints
- [ ] Frontend loads without errors: Check browser console
- [ ] Database queries working: Test data retrieval
- [ ] Authentication functional: Test login flow
- [ ] Queue workers running: If job queue needed
- [ ] Logs monitored for errors: Check storage/logs/
- [ ] Backups scheduled: Database backups configured
- [ ] Monitoring/alerts enabled: Error tracking setup
- [ ] Documentation updated: Deployment notes

---

## 13. QUICK REFERENCE TABLE

| Aspect | Details |
|--------|---------|
| **Architecture** | Monorepo: Angular 21 + Laravel 12 |
| **Frontend Port** | 4200 (dev), 80 (prod) |
| **Backend Port** | 8000 (dev), 9000 (prod) |
| **Database Port** | 3306 (internal only in prod) |
| **PHP Version** | 8.2+ required |
| **Node.js** | 22.x required |
| **npm** | 11.6.3 locked |
| **TypeScript** | 5.9.2 |
| **Total Migrations** | 38 database files |
| **Frontend Size** | 2.6 MB compiled |
| **Backend Storage** | 3.5 MB (logs/cache) |
| **Testing Framework** | Vitest (frontend), Pest (backend) |
| **Coverage Requirement** | 80% (backend) |
| **CI/CD Platform** | GitHub Actions |
| **Secret Scanning** | Gitleaks |
| **Code Formatting** | ESLint, Laravel Pint, Prettier |
| **Git Hooks** | Husky pre-commit |
| **Container Runtime** | Docker Compose |
| **Database** | MySQL 8.0 |
| **Auth** | Sanctum + Facebook OAuth |
| **Auditing** | Soft deletes, change logs |
| **Production** | Multi-stage Docker builds |
| **Deployment Cost** | $15-20/month (2GB VPS) |
| **VCS** | GitHub (PUPT Quantum Leap) |

---

## SUMMARY

ServeTrack is a **modern, well-architected volunteer management system** with:

✅ **Frontend:** Angular 21 with Vitest testing, TailwindCSS styling
✅ **Backend:** Laravel 12 with Pest testing, Sanctum authentication
✅ **Database:** 38 migrations covering volunteers, events, RSVPs, audit trails
✅ **DevOps:** Docker Compose development and production configurations
✅ **CI/CD:** Automated GitHub Actions testing with change detection
✅ **Security:** Gitleaks scanning, role-based access, OAuth support
✅ **Quality:** >80% test coverage, automated code formatting, linting
✅ **Deployment:** Production-ready with multi-stage Docker builds
✅ **Documentation:** Comprehensive guides for setup and deployment

**Next Steps for Deployment:**
1. Configure `.env` with database credentials and API keys
2. Run `docker-compose -f docker-compose.prod.yml up`
3. Migrations run automatically via migrate service
4. Access at http://your-domain
5. Monitor logs and ensure all services healthy
