# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ServeTrack is a volunteer management system for NLCOM (National League of Cities Operations & Management). It's a monorepo containing:
- **Backend**: Laravel 12 API (`servetrack-backend/`)
- **Frontend**: Angular 21 SPA (`servetrack-frontend/`)

## Common Commands

### Root Level
```bash
npm install                       # Install root and all subproject dependencies
npm run lint:backend              # Format PHP code with Laravel Pint
npm run test-hook                # Test Husky pre-commit hooks
```

### Frontend (servetrack-frontend/)
```bash
npm start                        # Start Angular dev server (http://localhost:4200)
npm run watch                    # Build with watch mode
npm run build                    # Production build
npm test                         # Run all Vitest tests
npm test -- path/to/test.spec.ts # Run single test file
npm test -- -t "test name"       # Run tests matching pattern
```

### Backend (servetrack-backend/)
```bash
composer run dev                 # Start Laravel server, queue worker, and Vite concurrently
php artisan serve               # Start Laravel server (http://localhost:8000)
./vendor/bin/pint                # Format PHP code
php artisan test                 # Run Pest tests
php artisan test --compact       # Run tests with compact output
php artisan test --filter=testName # Run single test
php artisan migrate              # Run database migrations
php artisan migrate:fresh --seed # Fresh database with seeders
```

## Architecture

### Backend Structure
- Laravel 12 with PHP 8.2+
- Authentication via Laravel Sanctum v4
- Database: MySQL
- Testing: Pest v3
- Middleware configured in `bootstrap/app.php` (not `app/Http/Kernel.php`)

### Frontend Structure
- Angular 21 with TypeScript 5.9+
- Standalone components (default in Angular 21)
- State management: Angular Signals
- Testing: Vitest v4

## Key Conventions

### Angular/TypeScript
- Use signals: `count = signal(0)`, computed: `double = computed(() => this.count() * 2)`
- Use `input()` and `output()` functions instead of decorators
- Use native control flow: `@if`, `@for`, `@switch` (NOT `*ngIf`, `*ngFor`)
- Use `class` bindings instead of `ngClass`, `style` bindings instead of `ngStyle`
- Use `inject()` function instead of constructor injection
- Set `changeDetection: ChangeDetectionStrategy.OnPush`
- Use `host` object for bindings, NOT `@HostBinding`/`@HostListener` decorators

### Laravel/PHP
- Use PHP 8.2 constructor property promotion
- Always use explicit return type declarations
- Use `Model::query()` over `DB::` raw queries
- Prevent N+1 queries with eager loading
- Use Form Request classes for validation
- Run `./vendor/bin/pint` before committing

## Testing Philosophy
- Write tests for all new features and bug fixes
- Frontend: Vitest with headless Chromium
- Backend: Pest with MySQL 8.0 service container
- Run relevant tests after changes, full suite before PR

## Important Notes
- **Package Manager**: Use `npm` (not pnpm) for frontend per angular.json config
- **Vite Error**: If you see manifest errors, run `composer run dev` or `npm run dev`
- **Lock Files**: Both `package-lock.json` and `composer.lock` are committed for reproducible builds

## Additional Guidelines
- Follow existing code conventions in sibling files when creating new code
- Use `php artisan make:*` commands to create Laravel files
- Get approval before adding/changing dependencies
- Get approval before creating new base folders
- Only create documentation files when explicitly requested
