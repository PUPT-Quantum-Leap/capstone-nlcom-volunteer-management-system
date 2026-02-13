# ServeTrack CI/CD Workflow

## Overview

This GitHub Actions workflow automatically tests both the Angular frontend and Laravel backend of the ServeTrack application whenever code is pushed or a pull request is created.

## Workflow Structure

The CI pipeline consists of 5 main jobs:

### 1. **check-changes**
Detects which parts of the codebase have changed to optimize testing:
- Monitors `servetrack-frontend/**` for Angular changes
- Monitors `servetrack-backend/**` for Laravel changes
- Only runs relevant tests based on changes

### 2. **dependency-review** (PR only)
Scans for vulnerable dependencies in pull requests using GitHub's dependency review action.

### 3. **frontend-check** (Angular 21 + Vitest)
Runs when frontend code changes:
- **Environment**: Ubuntu with Node.js 22 and pnpm 9
- **Browser**: Chromium (headless mode in CI)
- **Steps**:
  1. Install pnpm package manager
  2. Cache dependencies using `pnpm-lock.yaml`
  3. Install dependencies with `pnpm install --frozen-lockfile`
  4. Build the Angular application
  5. Run Vitest tests with coverage
  6. Upload test artifacts (coverage reports)

### 4. **backend-check** (Laravel 12 + Pest)
Runs when backend code changes:
- **Environment**: Ubuntu with PHP 8.2 and MySQL 8.0
- **Database**: MySQL service container for testing
- **Steps**:
  1. Setup PHP 8.2 with required extensions
  2. Cache Composer dependencies
  3. Install PHP dependencies
  4. Install Node/pnpm for frontend assets (Vite/Tailwind)
  5. Prepare Laravel environment (`.env`, app key, config cache)
  6. Run database migrations against test database
  7. Run Laravel Pint (code style checker)
  8. Run Pest tests with coverage (minimum 80% required)
  9. Upload test artifacts (coverage reports)

### 5. **ci-success**
Summary job that ensures all checks pass before merging.

## Configuration Requirements

### Environment Variables
No secrets are required for testing. The workflow runs with default configurations.

### Database Configuration
The backend tests use a MySQL service container with:
- Database: `servetrack_test`
- Username: `root`
- Password: `root`
- Port: `3306`

### Test Configuration

#### Frontend (Vitest)
Tests run with:
```bash
pnpm run test -- --run --coverage
```
- `--run`: Single run mode (no watch)
- `--coverage`: Generate coverage reports
- `CI=true`: Automatically enables headless mode

#### Backend (Pest)
Tests run with:
```bash
php artisan test --coverage --min=80
```
- `--coverage`: Generate coverage reports
- `--min=80`: Require minimum 80% code coverage

## Triggers

The workflow runs on:
- **Push** to `main` branch
- **Pull requests** targeting `main` branch
- **Manual trigger** via `workflow_dispatch`

## Coverage Reports

Test coverage artifacts are uploaded to:
- **Frontend**: `servetrack-frontend/coverage/lcov.info`
- **Backend**: `servetrack-backend/coverage/clover.xml`

Coverage files are retained for 7 days and can be viewed in the Actions tab.

## Performance Optimizations

1. **Path Filtering**: Only runs affected tests based on changed files
2. **Dependency Caching**: 
   - Frontend: pnpm store cached via `setup-node`
   - Backend: Composer cache stored between runs
3. **Parallel Execution**: Frontend and backend tests run simultaneously
4. **Frozen Lockfiles**: `pnpm install --frozen-lockfile` prevents unexpected updates

## Local Testing

To replicate CI behavior locally:

### Frontend
```bash
cd servetrack-frontend
pnpm install
pnpm run build
CI=true pnpm run test -- --run --coverage
```

### Backend
```bash
cd servetrack-backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
vendor/bin/pint --test
php artisan test --coverage
```

## Troubleshooting

### Frontend Tests Fail
- Ensure Vitest is configured in `angular.json`
- Check that `CI` environment variable enables headless mode
- Verify `pnpm-lock.yaml` is committed

### Backend Tests Fail
- Verify `.env.example` has correct test database settings
- Check that all migrations are up to date
- Ensure Pest is properly configured in `phpunit.xml`

## Next Steps

1. **Add Status Badges** to README:
   ```markdown
   ![CI](https://github.com/YOUR_USERNAME/REPO_NAME/workflows/ServeTrack%20CI%20Testing%20Workflow/badge.svg)
   ```

2. **Configure Branch Protection**:
   - Require CI to pass before merging
   - Enforce code review requirements
   - Require status checks to pass

## Documentation References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [pnpm CI Setup](https://pnpm.io/continuous-integration)
- [Laravel Testing Guide](https://laravel.com/docs/12.x/testing)
- [Angular Testing with Vitest](https://angular.dev/guide/testing)
- [Pest PHP Documentation](https://pestphp.com/docs)
