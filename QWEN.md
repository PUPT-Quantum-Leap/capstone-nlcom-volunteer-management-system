# ServeTrack - Volunteer Management System

## Project Overview

ServeTrack is a comprehensive **full-stack volunteer management system** designed for NLCOM (National League of Cities Operations & Management) to streamline volunteer coordination, event management, and activity tracking.

### Architecture

This is a **monorepo** containing two applications:

| Application | Location | Technology | Port |
|-------------|----------|------------|------|
| **Backend API** | `servetrack-backend/` | Laravel 12 (PHP 8.2+) | 8000 |
| **Frontend SPA** | `servetrack-frontend/` | Angular 21 (TypeScript 5.9+) | 4200 |

### Tech Stack

**Backend:**
- Laravel 12 with PHP 8.2+
- Laravel Sanctum v4 (API authentication)
- MySQL 8.0+ (production) / SQLite (testing)
- Pest v3 (testing framework)
- Laravel Pint (code formatter)
- Tailwind CSS v4 (styling)

**Frontend:**
- Angular 21 with TypeScript 5.9+
- Vitest v4 (testing)
- Angular CLI (build tool)
- ESLint + Prettier (linting/formatting)

**DevOps:**
- GitHub Actions (CI/CD)
- Gitleaks (secret scanning)
- Husky (git hooks)

---

## Quick Start

### Prerequisites

- **PHP** 8.2 or higher
- **Composer** 2.x
- **Node.js** 22.x
- **npm** 11.x
- **MySQL** 8.0 or higher (or SQLite for testing)

### Installation

```bash
# Clone repository
git clone https://github.com/PUPT-Quantum-Leap/capstone-nlcom-volunteer-management-system.git
cd capstone-nlcom-volunteer-management-system

# Install root dependencies
npm install

# Setup Backend
cd servetrack-backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
npm install

# Setup Frontend
cd ../servetrack-frontend
npm install
```

### Running the Application

**Terminal 1 - Backend:**
```bash
cd servetrack-backend
composer run dev
# Starts: Laravel server (http://localhost:8000), queue worker, and Vite
```

**Terminal 2 - Frontend:**
```bash
cd servetrack-frontend
npm start
# Starts Angular dev server at http://localhost:4200
```

---

## Development Commands

### Root Level

```bash
npm install                          # Install Node dependencies
npm run lint:backend                 # Run Laravel Pint formatter
npm run test-hook                    # Test Husky pre-commit hooks
```

### Backend (servetrack-backend/)

```bash
# Development
composer run dev                     # Start server, queue, and Vite
php artisan serve                    # Start Laravel server only

# Code Formatting
./vendor/bin/pint                    # Format all PHP files
./vendor/bin/pint --dirty            # Format modified files only
./vendor/bin/pint path/to/file.php   # Format specific file

# Testing
composer test                        # Run all Pest tests
php artisan test --compact           # Run tests with compact output
php artisan test --compact tests/Feature/ExampleTest.php  # Single file
php artisan test --filter=testName   # Run single test by name
php artisan test --coverage          # Generate coverage report (min 80%)

# Database
php artisan migrate                  # Run migrations
php artisan migrate:fresh --seed     # Fresh database with seeders
php artisan db:seed                  # Run seeders only

# Artisan Commands
php artisan make:controller          # Create controller
php artisan make:model               # Create model
php artisan make:request             # Create Form Request
php artisan make:factory             # Create factory
php artisan make:observer            # Create observer
php artisan make:resource            # Create API resource
php artisan make:migration           # Create migration
php artisan make:seeder              # Create seeder
```

### Frontend (servetrack-frontend/)

```bash
# Development
npm start                            # Start dev server (http://localhost:4200)
npm run watch                        # Build with watch mode

# Production Build
npm run build                        # Build for production

# Testing
npm test                             # Run all Vitest tests
npm test -- --reporter=verbose       # Run tests with detailed output
npm test -- path/to/test.spec.ts     # Run single test file
npm test -- -t "test name"           # Run tests matching pattern

# Linting
npm run lint                         # Run ESLint
```

---

## Project Structure

```
capstone-nlcom-volunteer-management-system/
├── servetrack-frontend/             # Angular 21 SPA
│   ├── src/
│   │   ├── app/                     # Application components, services, models
│   │   ├── assets/                  # Static assets
│   │   ├── environments/            # Environment configurations
│   │   └── index.html               # Main HTML file
│   ├── angular.json                 # Angular CLI configuration
│   ├── package.json                 # Frontend dependencies
│   ├── tsconfig.json                # TypeScript configuration
│   └── eslint.config.js             # ESLint configuration
│
├── servetrack-backend/              # Laravel 12 API
│   ├── app/
│   │   ├── Http/
│   │   │   ├── Controllers/         # API controllers
│   │   │   ├── Requests/            # Form Request validation
│   │   │   └── Resources/           # API Resources (response transformation)
│   │   ├── Models/                  # Eloquent models
│   │   ├── Observers/               # Eloquent observers
│   │   └── Providers/               # Service providers
│   ├── database/
│   │   ├── factories/               # Model factories for testing
│   │   ├── migrations/              # Database migrations
│   │   └── seeders/                 # Database seeders
│   ├── routes/
│   │   └── api.php                  # API route definitions
│   ├── tests/
│   │   └── Feature/                 # Feature tests (Pest)
│   ├── composer.json                # PHP dependencies
│   ├── package.json                 # Node dependencies (Vite, Tailwind)
│   └── .env.example                 # Environment template
│
├── .github/workflows/               # CI/CD pipelines
│   ├── ci.yml                       # Main CI workflow
│   └── gitleaks.yml                 # Secret scanning
│
├── docs/                            # Documentation
│   ├── CI_README.md                 # CI/CD documentation
│   ├── LARAVEL_XAMPP_SETUP.md       # Database setup guide
│   ├── update-profile-enhancement-plan.md  # Enhancement plans
│   └── ...
│
├── AGENTS.md                        # Development guidelines
├── PRD.md                           # Product Requirements Document
├── README.md                        # Project overview
└── start-fullstack-dev.ps1          # PowerShell startup script
```

---

## Key Features

### Backend API

**Authentication & Authorization:**
- Laravel Sanctum token-based authentication
- Role-based access control (Admin, Coordinator, Volunteer)
- Form Request validation with conditional rules
- Rate limiting via `RateLimiter::for()`

**Core Endpoints:**
```
POST   /api/volunteer/register       - Register new volunteer
GET    /api/volunteer/profile        - Get volunteer profile
PUT    /api/volunteer/profile        - Update volunteer profile
POST   /api/volunteer/profile/photo  - Upload profile photo
POST   /api/volunteer/change-password - Change password
GET    /api/volunteer/attendance     - List attendance records
GET    /api/volunteer/attendance/stats - Get attendance statistics
GET    /api/volunteers               - List all volunteers (admin)
GET    /api/volunteers/{id}          - Get volunteer details (admin)
GET    /api/admin/volunteers/{id}/change-history - Audit log (admin)
```

**Audit Logging:**
- Eloquent Observer pattern tracks all profile changes
- Stores: field name, old value, new value, user, IP address
- Accessible via admin endpoint

### Frontend Application

**Key Modules:**
- Authentication (login, register, password reset)
- Volunteer dashboard
- Admin dashboard
- Event management
- Attendance tracking
- Reporting

---

## Testing Practices

### Backend (Pest v3)

**Test Structure:**
```php
<?php

use App\Models\User;
use App\Models\Volunteer;

describe('Profile Authorization', function (): void {
    it('denies unauthenticated access to profile', function (): void {
        $this->getJson('/api/volunteer/profile')
            ->assertUnauthorized();
    });

    it('allows profile update for authenticated volunteer', function (): void {
        $user = User::factory()->create();
        $volunteer = Volunteer::factory()->create(['user_id' => $user->id]);

        $this->actingAs($user)
            ->putJson('/api/volunteer/profile', [...])
            ->assertSuccessful();
    });
});
```

**Best Practices:**
- Use factories for model creation: `Volunteer::factory()->create()`
- Use specific assertions: `assertForbidden()` not `assertStatus(403)`
- Test happy paths, failure paths, and edge cases
- Use `RefreshDatabase` trait for database isolation
- Target 80%+ code coverage

### Frontend (Vitest v4)

**Test Structure:**
```typescript
import { describe, it, expect } from 'vitest';

describe('AuthService', () => {
  it('should authenticate user with valid credentials', () => {
    // Test implementation
  });
});
```

**Best Practices:**
- Use TestBed for component testing
- Mock HTTP requests with HttpTestingController
- Test component interactions and user flows
- Use signals for reactive state management

---

## Code Style Guidelines

### TypeScript/Angular (Frontend)

**Components:**
```typescript
// ✅ Good: Standalone component with signals
@Component({
  selector: 'app-user-profile',
  template: `
    @if (user(); as user) {
      <h2>{{ user.name }}</h2>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserProfileComponent {
  user = signal<User | null>(null);
  doubleCount = computed(() => this.count() * 2);
  
  private readonly userService = inject(UserService);
}
```

**Services:**
```typescript
// ✅ Good: Provided in root, using inject()
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  
  login(credentials: LoginCredentials): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/login', credentials);
  }
}
```

### PHP/Laravel (Backend)

**Controllers:**
```php
// ✅ Good: Type declarations, Form Request validation
public function updateProfile(UpdateVolunteerProfileRequest $request): JsonResponse
{
    $volunteer = $request->user()->volunteer;
    
    $volunteer->update($request->validated());
    
    return response()->json([
        'success' => true,
        'data' => new VolunteerProfileResource($volunteer),
    ]);
}
```

**Observers:**
```php
// ✅ Good: Audit logging with dirty checking
public function updating(Volunteer $volunteer): void
{
    $dirty = $volunteer->getDirty();
    $original = $volunteer->getOriginal();
    
    foreach ($dirty as $field => $newValue) {
        ProfileChangeLog::create([
            'volunteer_id' => $volunteer->volunteer_id,
            'field_name' => $field,
            'old_value' => $original[$field] ?? null,
            'new_value' => $newValue,
        ]);
    }
}
```

**Form Requests:**
```php
// ✅ Good: Conditional validation with Rule::in()
public function rules(): array
{
    return [
        'volunteerPreference' => [
            'required',
            'string',
            Rule::in(['medical-operations', 'relief-operations', 'other']),
        ],
        'otherPreference' => [
            'nullable',
            'string',
            'max:255',
            'required_if:volunteerPreference,other',
            'prohibited_unless:volunteerPreference,other',
        ],
    ];
}
```

---

## CI/CD Pipeline

### GitHub Actions Workflow

**Triggers:**
- Pull requests to `main`
- Pushes to `main` branch
- Manual dispatch

**Jobs:**
1. **check-changes**: Detects modified folders (frontend/backend)
2. **frontend-check**: Angular build + Vitest tests (if frontend changed)
3. **backend-check**: PHP tests + Laravel Pint (if backend changed)
4. **ci-success**: Aggregates all job results

**Environment:**
- PHP 8.2 with SQLite (in-memory) for testing
- Node.js 22 for frontend builds
- Cached dependencies for faster builds

---

## Security

### Implemented Measures

- **Gitleaks**: Automatic secret scanning on every push
- **Laravel Sanctum**: Token-based API authentication with expiration
- **Rate Limiting**: Per-endpoint rate limiters (profile-update: 10/min, password-change: 5/min)
- **SQL Injection Protection**: Allowlist-based sorting, parameterized queries
- **XSS Protection**: Laravel's built-in CSRF protection, Angular's sanitization
- **Dependency Review**: Automated vulnerability scanning in PRs

### Environment Variables

Sensitive configuration in `.env` (never committed):
```env
APP_KEY=              # Laravel encryption key
DB_PASSWORD=          # Database password
SANCTUM_STATEFUL_DOMAINS=localhost
SESSION_DRIVER=file
```

---

## Database Schema

### Core Tables

**users:**
- id, name, email, password, role (admin/coordinator/volunteer), status

**volunteer:**
- volunteer_id (PK), user_id (FK), first_name, last_name, facebook_name, email, mobile_number, birthdate, address, educational_attainment, last_medical_examination, profile_photo, emergency_contact_id

**profile_change_logs:**
- id, volunteer_id (FK), changed_by_user_id (FK), field_name, old_value, new_value, ip_address, timestamps

**events, registrations, checkins, volunteer_hours:**
- Event management and attendance tracking

---

## Common Tasks

### Adding a New API Endpoint

1. **Create Controller Method:**
   ```bash
   php artisan make:controller ApiController --existing
   ```

2. **Create Form Request (if needed):**
   ```bash
   php artisan make:request NewRequestName
   ```

3. **Add Route:**
   ```php
   // routes/api.php
   Route::post('/new-endpoint', [ApiController::class, 'newMethod'])
       ->middleware(['auth:sanctum']);
   ```

4. **Write Tests:**
   ```bash
   # Add to tests/Feature/ApiControllerTest.php
   it('handles new endpoint', function () {
       // Test implementation
   });
   ```

### Adding a New Frontend Component

1. **Generate Component:**
   ```bash
   cd servetrack-frontend
   ng generate component components/new-component
   ```

2. **Create Service (if needed):**
   ```bash
   ng generate service services/new-service
   ```

3. **Write Tests:**
   ```bash
   # Add to src/app/components/new-component/new-component.spec.ts
   ```

### Running Database Migrations

```bash
# Create new migration
php artisan make:migration add_column_to_table --table=table_name

# Run migrations
php artisan migrate

# Rollback last batch
php artisan migrate:rollback

# Fresh database (WARNING: deletes all data)
php artisan migrate:fresh --seed
```

---

## Troubleshooting

### Backend Issues

**"Class not found" errors:**
```bash
composer dump-autoload
```

**Database connection errors:**
```bash
# Check .env configuration
php artisan config:clear
php artisan config:cache
```

**Test failures with cached config:**
```bash
php artisan config:clear
php artisan cache:clear
```

### Frontend Issues

**Build errors:**
```bash
rm -rf .angular/cache
npm install
```

**Test failures:**
```bash
npm test -- --run
```

---

## Documentation Links

- [Product Requirements (PRD.md)](./PRD.md)
- [Development Guidelines (AGENTS.md)](./AGENTS.md)
- [CI/CD Documentation](./docs/CI_README.md)
- [Laravel + XAMPP Setup](./docs/LARAVEL_XAMPP_SETUP.md)
- [Update Profile Enhancement Plan](./docs/update-profile-enhancement-plan.md)

---

## Support

For issues, questions, or contributions:
- **Issues**: [GitHub Issues](https://github.com/PUPT-Quantum-Leap/capstone-nlcom-volunteer-management-system/issues)
- **Documentation**: See `PRD.md` and `AGENTS.md`

---

**Built with ❤️ by the PUPT Quantum Leap Team**

---

# Codebase Analysis Report

*Generated: March 17, 2026*

## Executive Summary

| Attribute | Details |
|-----------|---------|
| **Name** | ServeTrack - Volunteer Management System |
| **Type** | Full-stack web application (Monorepo) |
| **Purpose** | Volunteer coordination, event management, activity tracking for NLCOM |
| **Architecture** | Separated Frontend/Backend API |
| **Maturity** | MVP Phase 1 - Core features implemented |
| **Overall Assessment** | **Production-Ready with Security Hardening Needed** |

---

## 1. Directory Structure & Entry Points

```
capstone-nlcom-volunteer-management-system/
├── servetrack-backend/              # Laravel 12 API (Port 8000)
│   ├── app/
│   │   ├── Http/
│   │   │   ├── Controllers/         # 7 controllers
│   │   │   ├── Middleware/          # 6 middleware
│   │   │   ├── Requests/            # Form Request validation
│   │   │   └── Resources/           # API response transformation
│   │   ├── Models/                  # 17 Eloquent models
│   │   ├── Observers/               # Audit logging observers
│   │   ├── Services/                # Business logic layer
│   │   └── Constants/               # Token abilities, constants
│   ├── database/
│   │   ├── migrations/              # 37 migrations
│   │   ├── factories/               # Test data factories
│   │   └── seeders/                 # Database seeders
│   ├── routes/
│   │   └── api.php                  # API route definitions
│   ├── tests/
│   │   └── Feature/                 # 12 Pest test files
│   ├── bootstrap/app.php            # Laravel bootstrap
│   └── config/                      # App configuration
│
├── servetrack-frontend/             # Angular 21 SPA (Port 4200)
│   ├── src/app/
│   │   ├── admin-dashboard/         # Admin dashboard component
│   │   ├── volunteer-dashboard/     # Volunteer dashboard component
│   │   ├── auth/                    # Login, signup, admin auth
│   │   ├── services/                # 7 Angular services
│   │   ├── models/                  # 7 TypeScript interfaces
│   │   ├── guards/                  # Route guards
│   │   ├── interceptors/            # HTTP interceptors
│   │   └── validators/              # Custom form validators
│   ├── environments/                # Environment configs
│   ├── angular.json                 # Angular CLI config
│   └── vitest.config.ts             # Vitest testing config
│
├── .github/workflows/               # CI/CD pipelines
└── docs/                            # 26 documentation files
```

### Entry Points

| Application | Entry File | Port | Command |
|-------------|------------|------|---------|
| **Backend API** | `servetrack-backend/public/index.php` | 8000 | `composer run dev` |
| **Frontend SPA** | `servetrack-frontend/src/main.ts` | 4200 | `npm start` |
| **API Routes** | `servetrack-backend/routes/api.php` | - | - |
| **App Routes** | `servetrack-frontend/src/app/app.routes.ts` | - | - |

---

## 2. Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Angular 21 Frontend                    │
│                    (Port 4200)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │   Admin     │  │  Volunteer  │  │   Auth          │ │
│  │  Dashboard  │  │  Dashboard  │  │   Components    │ │
│  └─────────────┘  └─────────────┘  └─────────────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │  Services   │  │   Guards    │  │  Interceptors   │ │
│  └─────────────┘  └─────────────┘  └─────────────────┘ │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTP/HTTPS (withCredentials)
                      │ REST API + Sanctum Cookies
┌─────────────────────▼───────────────────────────────────┐
│                  Laravel 12 Backend                     │
│                    (Port 8000)                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │  API Routes (api.php)                           │   │
│  │  - Guest routes (login, register)               │   │
│  │  - Auth routes (profile, attendance, polls)     │   │
│  │  - Admin routes (dashboard, volunteers, users)  │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │ Controllers │  │ Middleware  │  │   Form Requests │ │
│  │  (7 total)  │  │  (6 total)  │  │  (Validation)   │ │
│  └─────────────┘  └─────────────┘  └─────────────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │   Models    │  │ Observers   │  │   Resources     │ │
│  │ (17 total)  │  │ (Audit log) │  │ (JSON transform)│ │
│  └─────────────┘  └─────────────┘  └─────────────────┘ │
└─────────────────────┬───────────────────────────────────┘
                      │ Eloquent ORM
┌─────────────────────▼───────────────────────────────────┐
│                  MySQL 8.0 Database                     │
│  - 37 migrations                                        │
│  - Core tables: users, volunteer, admin, coordinator    │
│  - Related: attendances, polls, skills, trainings       │
│  - Audit: profile_change_logs                           │
└─────────────────────────────────────────────────────────┘
```

### Authentication Flow

1. **Frontend**: Angular service calls `/sanctum/csrf-cookie` for CSRF token
2. **Login**: POST `/login` or `/admin/login` with credentials
3. **Token**: Sanctum creates token with role-specific abilities
4. **Storage**: Token stored in browser with `withCredentials: true`
5. **Requests**: All API calls include credentials cookie
6. **Middleware**: `auth:sanctum` + `role:*` validates access
7. **Logout**: POST `/logout` invalidates token

---

## 3. Components & Responsibilities

### Backend Controllers (7 total)

| Controller | Responsibilities | Key Methods |
|------------|------------------|-------------|
| **Auth/LoginController** | User authentication | `store()`, `adminStore()`, `destroy()` |
| **Auth/RegisterController** | User registration | `store()` |
| **VolunteerController** | Volunteer profile mgmt | `register()`, `profile()`, `updateProfile()`, `listAttendance()` |
| **AdminController** | Admin dashboard, volunteer mgmt | `dashboard()`, `register()`, `softDelete()` |
| **CoordinatorController** | Coordinator registration | `register()` |
| **UserController** | User CRUD (admin only) | `index()`, `store()`, `update()`, `resetPassword()` |
| **PollController** | Poll creation & voting | `index()`, `store()`, `vote()`, `updateStatus()` |

### Backend Middleware (6 total)

| Middleware | Purpose | Key Features |
|------------|---------|--------------|
| **RoleMiddleware** | Role-based authorization | Checks `user.role === required role` |
| **SecurityAudit** | Audit logging | Logs all authenticated requests |
| **AdvancedRateLimit** | Exponential backoff rate limiting | SHA-256 hashing, lockout after 5 attempts |
| **SecurityHeaders** | HTTP security headers | CSP, HSTS, X-Frame-Options, etc. |
| **NormalizeEmail** | Email normalization | Lowercase, trim whitespace |
| **RedirectIfAuthenticated** | Guest middleware | Redirects logged-in users |

### Backend Models (17 total)

**Core Models:**
- `User` - Authentication & authorization (soft deletes, lockout tracking)
- `Volunteer` - Volunteer profile (17 fields, many-to-many relationships)
- `Admin` - Admin profile
- `Coordinator` - Coordinator profile

**Related Entities:**
- `Attendance` - Event attendance tracking
- `Poll`, `PollOption`, `PollVote` - Voting system
- `EmergencyContact` - Emergency contact info
- `Skill`, `Training`, `Experience`, `Position`, `Lifegroup` - Volunteer attributes

**Audit & System:**
- `ProfileChangeLog` - Audit trail for profile changes
- `SmsNotification` - SMS notification queue
- `Availability` - Volunteer availability

### Frontend Components

| Component | Type | Purpose | Key Features |
|-----------|------|---------|--------------|
| **VolunteerDashboard** | Dashboard | Volunteer home | Profile mgmt, attendance view, polls |
| **AdminDashboard** | Dashboard | Admin home | Volunteer mgmt, analytics, polls, users |
| **Login** | Auth | User login | Email/password, error handling |
| **Signup** | Auth | Volunteer registration | Multi-step form, validation |
| **AdminAuthPage** | Auth | Admin/coordinator auth | Tabbed login/signup |
| **VotingPoll** | Feature | Poll voting interface | Real-time vote counts |
| **IncidentCommandSystem** | Feature | ICS management | Complex form handling |

### Frontend Services (7 total)

| Service | Purpose | Key Methods |
|---------|---------|-------------|
| **AuthService** | Authentication | `login()`, `logout()`, `volunteerSignup()`, `adminRegister()` |
| **VolunteerService** | Volunteer API | `getProfile()`, `updateProfile()`, `getAttendance()` |
| **AdminDashboardService** | Admin data | `getDashboardData()`, `getVolunteers()` |
| **PollService** | Poll operations | `getPolls()`, `vote()`, `createPoll()` |
| **UserService** | User management | `getUsers()`, `createUser()`, `resetPassword()` |
| **InputSanitizerService** | XSS prevention | `sanitizeInput()` |

---

## 4. Security Assessment

### ✅ Implemented Security Measures

| Security Feature | Status | Implementation |
|-----------------|--------|----------------|
| **Authentication** | ✅ | Laravel Sanctum with token expiration (60 min) |
| **Authorization** | ✅ | RoleMiddleware + ability-based access |
| **Rate Limiting** | ✅ | AdvancedRateLimit with exponential backoff |
| **Brute Force Protection** | ✅ | Account lockout (15 min after 5 failed attempts) |
| **CSP Headers** | ✅ | Content-Security-Policy with environment-based rules |
| **HSTS** | ✅ | Strict-Transport-Security for HTTPS |
| **XSS Protection** | ✅ | X-XSS-Protection, Angular sanitization |
| **CSRF Protection** | ✅ | Sanctum CSRF cookies |
| **Input Validation** | ✅ | Form Requests + frontend validators |
| **Audit Logging** | ✅ | ProfileChangeLog observer pattern |
| **Secret Scanning** | ✅ | Gitleaks in CI/CD |
| **SQL Injection** | ✅ | Eloquent ORM, parameterized queries |
| **Password Hashing** | ✅ | bcrypt via Laravel Hash facade |
| **Email Normalization** | ✅ | Lowercase, trim before storage |

### ⚠️ Security Concerns & Gaps

| Issue | Severity | Status | Notes |
|-------|----------|--------|-------|
| **Token Expiration** | ⚠️ Resolved | Fixed | Now set to 60 minutes via env |
| **MD5 in Rate Limiter** | ⚠️ Resolved | Fixed | Now uses SHA-256 |
| **Missing Role Checks** | ⚠️ Resolved | Fixed | RoleMiddleware implemented |
| **Over-Privileged Tokens** | ⚡ Partial | In Progress | TokenAbilities defined but not fully enforced |
| **No 2FA** | 🔴 Open | Not Started | Admin accounts lack 2FA |
| **CSP 'unsafe-inline'** | 🟡 Open | Partial | Required for Tailwind, but risky |
| **No Password Breach Check** | 🟡 Open | Not Started | No HIBP integration |
| **Frontend Regex XSS** | 🟡 Open | Partial | InputSanitizerService uses regex |
| **No Session Binding** | 🟡 Open | Not Started | Tokens not bound to IP/User-Agent |

### Technical Debt

| Area | Debt | Impact | Effort |
|------|------|--------|--------|
| **API Versioning** | No versioning (v1, v2) | Breaking changes difficult | Medium |
| **Test Coverage** | Frontend tests minimal | Regression risk | High |
| **Documentation** | Scattered (26 docs in /docs) | Onboarding friction | Low |
| **Error Handling** | Generic 500 messages | Debugging difficulty | Low |
| **Code Duplication** | Similar validation in controllers | Maintenance burden | Medium |
| **N+1 Queries** | Potential in dashboard | Performance risk | Medium |
| **Hardcoded Values** | Some magic numbers/strings | Config management | Low |

---

## 5. Testing Assessment

### Backend Testing (Pest v3)

**Test Files (12 total):**
- `AdminRegistrationTest.php`
- `AdminVolunteerTest.php`
- `AuthMiddlewareTest.php`
- `ChangePasswordTest.php`
- `PollTest.php`
- `ProfileAuditLogTest.php`
- `ProfilePhotoTest.php`
- `SecurityHeadersTest.php`
- `UserControllerTest.php`
- `VolunteerProfileTest.php`
- `Middleware/` (middleware tests)

**Coverage:** Good coverage for critical paths (auth, profile, admin operations)

### Frontend Testing (Vitest v4)

**Test Files:**
- `app.spec.ts`
- `admin-dashboard.spec.ts`
- `auth.service.spec.ts`

**Coverage:** Minimal - mostly component skeleton tests

---

## 6. Actionable Recommendations

### Priority 1: Critical (Fix within 1 week)

| # | Recommendation | Impact | Effort | Status |
|---|----------------|--------|--------|--------|
| **1.1** | **Enforce Token Abilities** - Use `TokenAbilities` constants instead of `['*']` | 🔴 High | Medium | ⚠️ Partial |
| **1.2** | **Add Ability Middleware** - Check `tokenCan()` on sensitive endpoints | 🔴 High | Medium | 🔴 Not Started |
| **1.3** | **Implement 2FA for Admins** - Add TOTP-based 2FA using `pragmarx/google2fa-laravel` | 🔴 High | High | 🔴 Not Started |
| **1.4** | **Expand Frontend Tests** - Add comprehensive unit tests for services and components | 🟡 Medium | High | 🔴 Not Started |

### Priority 2: High (Fix within 1 month)

| # | Recommendation | Impact | Effort | Status |
|---|----------------|--------|--------|--------|
| **2.1** | **API Versioning** - Add `/api/v1/` prefix to all routes | 🟡 Medium | Low | 🔴 Not Started |
| **2.2** | **Password Breach Checking** - Integrate HIBP API for password validation | 🟡 Medium | Low | 🔴 Not Started |
| **2.3** | **Session Binding** - Bind tokens to IP + User-Agent | 🟡 Medium | Medium | 🔴 Not Started |
| **2.4** | **E2E Testing** - Add Playwright/Cypress e2e tests for critical user flows | 🟡 Medium | High | 🔴 Not Started |
| **2.5** | **Consolidate Documentation** - Merge scattered docs into single source of truth | 🟢 Low | Medium | 🔴 Not Started |

### Priority 3: Medium (Fix within 3 months)

| # | Recommendation | Impact | Effort | Status |
|---|----------------|--------|--------|--------|
| **3.1** | **CSP Hardening** - Remove `'unsafe-inline'` by extracting inline styles | 🟢 Low | Medium | 🔴 Not Started |
| **3.2** | **Request Size Limits** - Add middleware to limit request body size | 🟢 Low | Low | 🔴 Not Started |
| **3.3** | **Audit Trail Expansion** - Log password changes, role modifications | 🟢 Low | Low | 🔴 Not Started |
| **3.4** | **Performance Optimization** - Add eager loading to prevent N+1 queries | 🟢 Low | Medium | 🔴 Not Started |
| **3.5** | **Error Message Standardization** - Create consistent error response format | 🟢 Low | Low | 🔴 Not Started |

---

## 7. Strengths

1. **Strong Security Foundation** - Comprehensive middleware, rate limiting, audit logging
2. **Modern Stack** - Latest Angular + Laravel with best practices
3. **Role-Based Access** - Well-implemented role middleware
4. **Comprehensive Schema** - 37 migrations covering all business entities
5. **CI/CD Automation** - GitHub Actions with automated testing
6. **Code Quality Tools** - Laravel Pint, ESLint, Prettier configured
7. **Audit Trail** - Profile change logging via observers
8. **Exponential Backoff** - Advanced rate limiting with lockout

---

## 8. Summary

ServeTrack is a **well-architected volunteer management system** with a solid foundation. The codebase demonstrates:

- ✅ **Good separation of concerns** between frontend and backend
- ✅ **Modern development practices** (signals, standalone components, form requests)
- ✅ **Security-first mindset** (rate limiting, CSP, audit logging)
- ✅ **Comprehensive data model** covering volunteer management needs

**Key Areas for Improvement:**
1. 🔴 **Token ability enforcement** - Currently tokens have `['*']` abilities
2. 🔴 **2FA for admin accounts** - Critical for privileged users
3. 🟡 **Test coverage** - Especially frontend integration/e2e tests
4. 🟡 **API versioning** - Prepare for future breaking changes

**Overall Assessment:** **Production-Ready with Security Hardening Needed**

The application is functional and follows good practices, but should address the Priority 1 security recommendations before production deployment.
