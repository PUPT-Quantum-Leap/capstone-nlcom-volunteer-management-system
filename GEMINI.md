# ServeTrack - Volunteer Management System

**Project Type:** Full-Stack Web Application (Laravel + Angular)
**Organization:** NLCOM (National League of Cities Operations & Management)
**Documentation:** See `PRD.md` for detailed requirements and architecture.

## Project Overview

ServeTrack is a volunteer management system designed to streamline volunteer coordination, event management, and activity tracking. It consists of a secure RESTful API backend and a responsive Single-Page Application (SPA) frontend.

## Project Status

**Current Phase:** Phase 1 - MVP (In Development)
- **Completed:** Phase 0 (Setup & Architecture)
- **Active:** Sprint 1 (Authentication & User Management)
- **Upcoming:** Volunteer & Event Management

## Architecture

The project is divided into two main directories:

*   **`servetrack-backend/`**: Laravel 12 API.
    *   **Language:** PHP 8.2+
    *   **Framework:** Laravel 12
    *   **Authentication:** Laravel Sanctum v4
    *   **Database:** MySQL
    *   **Testing:** Pest v3
    *   **Styling (Views/Emails):** Tailwind CSS v4
*   **`servetrack-frontend/`**: Angular 21 SPA.
    *   **Language:** TypeScript 5.9+
    *   **Framework:** Angular 21
    *   **Build Tool:** Angular CLI
    *   **Testing:** Vitest v4 (via `ng test`)

## AI Interaction Guidelines

As an AI agent working on this codebase, you must:
1.  **Contextual Precedence:** Follow instructions in this file and sub-`GEMINI.md` files (found in `servetrack-backend/GEMINI.md` and `servetrack-frontend/.gemini/GEMINI.md`).
2.  **Verify Usage:** Never assume a library is available. Check `composer.json` or `package.json` first.
3.  **Reproduction:** For bug fixes, always reproduce the issue with a test case first.
4.  **Validation:** Run relevant tests after every change. Use `./vendor/bin/pint --dirty` for PHP and `npm test` for Angular.
5.  **Sub-Agents:** Use the `codebase_investigator` for complex architectural analysis.

## Common Commands

### Root Level
```bash
npm install                       # Install root and subproject dependencies
npm run lint:backend              # Format PHP code with Laravel Pint
npm run test-hook                # Test Husky pre-commit hooks
```

### Backend (`servetrack-backend/`)
```bash
composer run dev                  # Start Laravel server, queue, and Vite concurrently
php artisan serve                # Start Laravel server (http://localhost:8000)
./vendor/bin/pint --dirty         # Format only modified PHP files
php artisan test --compact        # Run Pest tests with compact output
php artisan test --filter=testName # Run a specific test
php artisan migrate:fresh --seed  # Reset database and seed
```

### Frontend (`servetrack-frontend/`)
```bash
npm run start                     # Start Angular dev server (http://localhost:4200)
npm run build                     # Production build
npm test                         # Run all Vitest tests
npm test -- path/to/file.spec.ts  # Run single test file
npm test -- -t "pattern"          # Run tests matching pattern
```

## Development Conventions

*   **Code Style:**
    *   **PHP:** PSR-12 via Laravel Pint. Use constructor property promotion and explicit return types.
    *   **TypeScript:** Angular Style Guide. Use Signals, Standalone Components, and `inject()`.
*   **Architecture:**
    *   **Backend:** Use Form Requests for validation, Eloquent Resources for API responses, and Policies for authorization.
    *   **Frontend:** Use `OnPush` change detection, native control flow (`@if`, `@for`), and avoid decorators for inputs/outputs.
*   **CSS:** Utility-first with Tailwind CSS v4.
*   **Testing:** Pest (Backend) and Vitest (Frontend). Aim for >80% coverage.
