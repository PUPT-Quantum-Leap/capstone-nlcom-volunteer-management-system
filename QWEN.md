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
└── fullstack.ps1         # PowerShell startup script
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
