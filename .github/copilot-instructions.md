# Copilot instructions for ServeTrack repository

Purpose: quick reference for automated agents (Copilot/AI) to run builds, tests, linting, and follow repository-specific conventions.

1) Build, test, and lint commands

- Root
  - npm install
  - npm run lint:backend    # runs Laravel Pint formatter in servetrack-backend
  - npm run test-hook       # run husky pre-commit hook locally

- Frontend (servetrack-frontend/)
  - Install: cd servetrack-frontend && npm install
  - Dev server: npm start  # http://localhost:4200
  - Build: npm run build
  - Tests (all): npm test
  - Single test file: npm test -- path/to/file.spec.ts
  - Run specific tests by name: npm test -- -t "test name"

- Backend (servetrack-backend/)
  - Install PHP deps: cd servetrack-backend && composer install
  - Dev (concurrent): composer run dev
  - Serve: php artisan serve  # http://localhost:8000
  - Migrations: php artisan migrate | php artisan migrate:fresh --seed
  - Format: ./vendor/bin/pint  or ./vendor/bin/pint --dirty
  - Tests (Pest): php artisan test --compact
  - Single test file: php artisan test --compact tests/Feature/ExampleTest.php
  - Single test by name: php artisan test --compact --filter=testName
  - Coverage: php artisan test --coverage

Note: confirm package availability (composer.json / package.json) before running.

2) High-level architecture

- Monorepo containing two primary apps:
  - servetrack-backend/: Laravel 12 API (PHP 8.2+, MySQL 8+). Auth via Laravel Sanctum. Tests use Pest. Uses Vite for assets and Tailwind for styling.
  - servetrack-frontend/: Angular 21 SPA (TypeScript 5.9+). Uses Angular CLI, Vitest for unit tests, and Angular Signals for local state.
- Typical local workflow runs backend and frontend concurrently (backend: :8000, frontend: :4200). CI runs frontend tests, backend tests, formatting, vulnerability scanning, and secret scanning.

3) Key repository-specific conventions (non-obvious)

- Frontend conventions (see CLAUDE.md / AGENTS.md):
  - Prefer Signals for state (signal(), computed()).
  - Use input() / output() functions (not decorators) for component inputs/outputs.
  - Use native control flow constructs (@if, @for, @switch) instead of structural directives.
  - Set changeDetection: ChangeDetectionStrategy.OnPush for components.
  - Use inject() for services instead of constructor injection.
  - Prefer standalone components and inline templates for small components.
  - Use Vitest flags shown above to run single tests or match by name.

- Backend conventions (see AGENTS.md):
  - Use PHP 8.2 constructor property promotion and explicit return types.
  - Prefer Eloquent Model::query() over DB:: raw queries; eager-load relations to avoid N+1 queries.
  - Use Form Request classes for validation and named routes via route().
  - Use ./vendor/bin/pint for formatting before commits.
  - Tests: use factories, Pest conventions (assertForbidden, datasets, mocks), and reproduce bugs with tests before fixing.

- Workspace-level notes:
  - npm is the supported package manager across the monorepo (do not use pnpm).
  - Lockfiles (package-lock.json, composer.lock) are committed for reproducible builds.
  - CI pipelines are defined in .github/workflows and run tests + style checks + secret scanning.

4) AI-agent guidance to follow (from project docs)

- Check these files first for agent-specific rules: AGENTS.md, CLAUDE.md, GEMINI.md, and subproject .gemini files (servetrack-backend/GEMINI.md, servetrack-frontend/.gemini).
- Verify dependency availability in composer.json/package.json before attempting installs or runs.
- For bug fixes, produce a failing test that reproduces the issue before changing code; run relevant tests after changes.
- Use ./vendor/bin/pint --dirty and npm test to validate formatting and tests before committing.

5) Where to look next (quick pointers)

- Docs: docs/ (CI_README.md, LARAVEL_XAMPP_SETUP.md, TEST_CASES.md, etc.)
- CI workflows: .github/workflows/
- Backend entrypoints: servetrack-backend/artisan, routes/, app/
- Frontend entrypoints: servetrack-frontend/angular.json, src/app/

MCP servers: Would you like configuration suggestions for MCP servers (example: Playwright or a browser-based test runner for the frontend)?

Summary: created .github/copilot-instructions.md containing concise commands, architecture summary, and conventions pulled from README.md, CLAUDE.md, and AGENTS.md. Reply if adjustments or additional coverage (e.g., CI details, specific test examples) are needed.
