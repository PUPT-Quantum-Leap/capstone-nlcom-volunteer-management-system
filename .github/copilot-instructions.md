# Copilot Instructions for ServeTrack Repository

Purpose: quick reference for automated agents to run builds, tests, linting, and follow repository-specific conventions.

## 1) Build, Test, and Lint Commands

### Root Level
```bash
npm install                       # Install all dependencies
npm run lint:backend              # Run Laravel Pint formatter in servetrack-backend
npm run test-hook                 # Test Husky pre-commit hooks locally
```

### Frontend (`servetrack-frontend/`)
```bash
npm start                         # Start dev server (http://localhost:4200)
npm run watch                     # Build with watch mode
npm run build                     # Production build

npm test                          # Run all Vitest tests
npm test -- path/to/test.spec.ts  # Run single test file
npm test -- -t "pattern"          # Run tests matching pattern
npm test -- --run                 # Run tests once (no watch mode)
npm test -- --reporter=verbose    # Run with detailed output
```

### Backend (`servetrack-backend/`)
```bash
composer install                  # Install PHP dependencies
composer run dev                  # Start server, queue, Vite concurrently

php artisan serve                 # Start Laravel server (http://localhost:8000)

./vendor/bin/pint                 # Format all PHP files
./vendor/bin/pint --dirty         # Format only modified files
./vendor/bin/pint path/to/file.php # Format specific file

php artisan test --compact        # Run all Pest tests
php artisan test --compact tests/Feature/ExampleTest.php  # Run single test file
php artisan test --compact --filter=testName              # Run single test by name
php artisan test --coverage       # Generate coverage report

php artisan migrate               # Run migrations
php artisan migrate:fresh --seed  # Fresh database with seeders
php artisan db:seed               # Run seeders only
```

**Note:** Always verify package availability in `composer.json` or `package.json` before running commands.

## 2) High-level Architecture

### Monorepo Structure
- **`servetrack-backend/`**: Laravel 12 API (PHP 8.2+, MySQL 8+)
  - Authentication via Laravel Sanctum v4
  - Testing with Pest v3
  - Built with Vite and Tailwind CSS v4
  - Middleware configured in `bootstrap/app.php` (not `app/Http/Kernel.php`)
  
- **`servetrack-frontend/`**: Angular 21 SPA (TypeScript 5.9+)
  - State management via Angular Signals
  - Testing with Vitest v4
  - Built with Angular CLI and Tailwind CSS

### Development Workflow
- Typical local development runs backend and frontend concurrently: backend on `:8000`, frontend on `:4200`
- CI automatically runs frontend tests, backend tests, formatting checks, and security scans
- Deployments to production trigger automatically when CI passes on the `main` branch

## 3) Key Repository-specific Conventions

### Frontend (Angular/TypeScript)
- Use **Signals** for state: `signal()`, `computed()` for derived state
- Use `input()` and `output()` functions (NOT `@Input`/`@Output` decorators)
- Use native control flow: `@if`, `@for`, `@switch` (NOT `*ngIf`, `*ngFor`, `*ngSwitch`)
- Set `changeDetection: ChangeDetectionStrategy.OnPush` in component decorator
- Use `inject()` function for services (NOT constructor injection)
- Use `host` object for bindings (NOT `@HostBinding`/`@HostListener` decorators)
- Use `class` bindings instead of `ngClass`, `style` bindings instead of `ngStyle`
- Prefer standalone components and inline templates for small components
- Use `NgOptimizedImage` for static images
- Never use `mutate` on signals; use `set()` or `update()` instead

### Backend (Laravel/PHP)
- Use PHP 8.2 constructor property promotion: `public function __construct(public Model $model) {}`
- Always use explicit return type declarations for methods
- Use `Model::query()` over `DB::` raw queries; eager-load relations to avoid N+1 queries
- Use Form Request classes for validation (not inline validation)
- Use named routes with `route()` function
- Use `config('app.name')` NOT `env('APP_NAME')` outside config files
- Use `php artisan make:*` commands to create files (models, migrations, controllers, etc.)
- Prefer PHPDoc blocks over inline comments
- Use Pest testing conventions: specific assertions (`assertForbidden()` NOT `assertStatus(403)`), factories, datasets, mocks
- Always run `./vendor/bin/pint --dirty` before committing

### Workspace-level
- Package manager: Use **npm** (NOT pnpm) across the monorepo
- Lock files (`package-lock.json`, `composer.lock`) are committed for reproducible builds
- CI pipelines in `.github/workflows/` run tests, formatting checks, vulnerability scans, and secret detection

## 4) Critical Guidelines for AI Agents

- **Read first**: Always check AGENTS.md, CLAUDE.md, GEMINI.md, and subproject .gemini files before starting work
- **Reproduce bugs**: For bug fixes, write a failing test first to reproduce the issue, then fix it
- **Verify before running**: Check `composer.json` or `package.json` for dependency availability
- **Validate changes**: After changes, run `./vendor/bin/pint --dirty` (backend) and `npm test` (frontend)
- **Test selectively**: Run only tests related to your changes first; run full suite before finalizing
- **Common errors**:
  - Vite manifest error → Run `composer run dev` or `npm run build`
  - Frontend changes not visible → Run `npm run build` or `npm run dev`
  - Need to check available commands → Use `php artisan` to list Artisan commands

## 5) Quick Reference: Where to Look

| Component | Files to Check |
|-----------|-----------------|
| Architecture | README.md, PRD.md |
| Frontend conventions | CLAUDE.md, AGENTS.md, servetrack-frontend/.github/copilot-instructions.md |
| Backend conventions | AGENTS.md, servetrack-backend/.github/copilot-instructions.md |
| CI/CD workflows | .github/workflows/, docs/CI_README.md |
| Backend setup | docs/LARAVEL_XAMPP_SETUP.md |
| Database | servetrack-backend/database/, docs/TEST_CASES.md |
| API routes | servetrack-backend/routes/ |
| App code | servetrack-backend/app/, servetrack-frontend/src/app/ |
