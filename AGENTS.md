# ServeTrack Agent Guidelines

This is a **monorepo** containing an Angular 21 frontend and Laravel 12 backend. Follow these guidelines for consistent, high-quality code across both applications.

## Project Structure

```
capstone-nlcom-volunteer-management-system/
├── servetrack-frontend/     # Angular 21 SPA (TypeScript 5.9+, Vitest v4)
├── servetrack-backend/      # Laravel 12 API (PHP 8.2+, Pest v3)
├── .github/workflows/       # CI/CD workflows
└── docs/                    # Project documentation
```

## Build, Lint & Test Commands

### Root Level
```bash
# Install dependencies
npm install                       # Frontend & backend Node deps
cd servetrack-backend && composer install  # Backend PHP deps

# Run linters
npm run lint:backend              # Laravel Pint code formatter

# Pre-commit hook test
npm run test-hook                 # Test Husky hooks manually
```

### Frontend (servetrack-frontend/)
```bash
# Development
npm start                         # Start dev server (http://localhost:4200)
npm run watch                     # Build with watch mode

# Production build
npm run build                     # Build for production

# Testing
npm test                          # Run all Vitest tests
npm test -- --reporter=verbose    # Run tests with detailed output
npm test -- path/to/test.spec.ts  # Run a single test file
npm test -- -t "test name"        # Run tests matching pattern
```

### Backend (servetrack-backend/)
```bash
# Development
composer run dev                  # Start server, queue, and Vite concurrently
php artisan serve                 # Start Laravel server (http://localhost:8000)

# Code formatting
./vendor/bin/pint                 # Format all PHP files
./vendor/bin/pint --dirty         # Format only modified files
./vendor/bin/pint path/to/file.php # Format specific file

# Testing
composer test                     # Run all Pest tests
php artisan test --compact        # Run all tests (compact output)
php artisan test --compact tests/Feature/ExampleTest.php  # Run single file
php artisan test --compact --filter=testName              # Run single test
php artisan test --coverage       # Generate coverage report (min 80%)

# Database
php artisan migrate               # Run migrations
php artisan migrate:fresh --seed  # Fresh database with seeders
php artisan db:seed               # Run seeders only
```

## Code Style Guidelines

### TypeScript/Angular (Frontend)

**Types & Imports**
- Use strict type checking; avoid `any`, prefer `unknown` for uncertain types
- Import Angular APIs: `import { Component, signal, computed } from '@angular/core'`
- Use relative imports for local files: `import { AuthService } from './auth.service'`

**Components**
- Always use standalone components (default in Angular 21, don't set `standalone: true`)
- Use signals: `count = signal(0)`, computed values: `double = computed(() => this.count() * 2)`
- Use `input()` and `output()` functions instead of decorators
- Set `changeDetection: ChangeDetectionStrategy.OnPush` in `@Component` decorator
- Use `host` object for bindings, NOT `@HostBinding` or `@HostListener` decorators
- Prefer inline templates for small components

**Templates**
- Use native control flow: `@if`, `@for`, `@switch` (NOT `*ngIf`, `*ngFor`, `*ngSwitch`)
- Use `class` bindings instead of `ngClass`, `style` bindings instead of `ngStyle`
- Use async pipe for observables: `{{ user$ | async }}`

**Services**
- Use `providedIn: 'root'` for singleton services
- Use `inject()` function instead of constructor injection
- Design around single responsibility

**Forms**
- Prefer Reactive forms over Template-driven forms

**Error Handling**
- Use RxJS `catchError` operator for observables
- Provide user-friendly error messages
- Log errors to console in development

### PHP/Laravel (Backend)

**Types & Imports**
- Always use explicit return type declarations for methods
- Use PHP 8.2+ constructor property promotion: `public function __construct(public GitHub $github) {}`
- Use appropriate PHP type hints for all parameters

**Naming Conventions**
- Use descriptive names: `isRegisteredForDiscounts()` NOT `discount()`
- Controllers: `UserController`, Models: `User`, Services: `NotificationService`
- Enum keys: TitleCase (`FavoritePerson`, `Monthly`)

**Code Structure**
- Always use curly braces for control structures (even single line)
- Prefer PHPDoc blocks over inline comments
- Use Eloquent relationships with return type hints
- Avoid `DB::`, prefer `Model::query()`
- Prevent N+1 queries with eager loading

**Laravel Conventions**
- Use `php artisan make:*` commands to create files
- Use Form Request classes for validation (not inline)
- Use named routes with `route()` function
- Use `config('app.name')` NOT `env('APP_NAME')` outside config files
- Use middleware registered in `bootstrap/app.php`
- Use queued jobs with `ShouldQueue` for time-consuming operations
- Use Laravel Sanctum for API authentication

**Testing with Pest**
- Use factories for test models
- Use specific assertions: `assertForbidden()` NOT `assertStatus(403)`
- Test happy paths, failure paths, and edge cases
- Use datasets for repetitive test data
- Import mocks: `use function Pest\Laravel\mock;`

**Error Handling**
- Use Laravel's built-in exception handling
- Return appropriate HTTP status codes
- Provide clear error messages in JSON responses

## Formatting Standards

**Frontend**
- Prettier config: 100 char width, single quotes, Angular parser for HTML
- Use semicolons, trailing commas in multiline

**Backend**
- Laravel Pint handles all formatting (PSR-12 style)
- Run `./vendor/bin/pint` before committing

## Testing Philosophy

- Write tests for all new features and bug fixes
- Frontend: Vitest with headless Chromium
- Backend: Pest with MySQL 8.0 service container
- Maintain minimum 80% code coverage for backend
- Run relevant tests after changes, full suite before PR

## Additional Notes

- **Package Manager**: Use `npm` (not pnpm) for frontend per angular.json config
- **Architecture**: Follow existing directory structure, get approval for new base folders
- **Documentation**: Only create docs when explicitly requested
- **Dependencies**: Get approval before adding/changing dependencies
- **Vite Error**: If you see Vite manifest errors, run `composer run dev`
- **CI/CD**: GitHub Actions runs tests on PR, requires all checks to pass

## Reference Files

- Frontend guidelines: `servetrack-frontend/AGENTS.md`
- Backend guidelines: `servetrack-backend/AGENTS.md`
- Cursor rules: `.cursor/rules/*.mdc` in each subdirectory
- Copilot instructions: `.github/copilot-instructions.md` in each subdirectory
- Product requirements: `PRD.md`
- Project overview: `GEMINI.md`
