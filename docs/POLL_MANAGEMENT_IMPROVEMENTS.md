# Poll Management System Improvements

## Overview

This document describes the improvements made to the poll management system, including enhanced validation, proper authentication handling, database schema corrections, and frontend form improvements.

---

## Changes Summary

### Backend Changes (Laravel)

#### 1. Poll Refresh After Update

**File:** `servetrack-backend/app/Http/Controllers/PollController.php`

Added `$poll->refresh()` after updating poll status to ensure fresh data is returned in the API response.

```php
$poll->update(['status' => $request->input('status')]);
$poll->refresh();
```

#### 2. Enhanced Poll Validation

**File:** `servetrack-backend/app/Http/Requests/StorePollRequest.php`

Strengthened validation rules for poll creation and updates:

| Field | Previous Rules | New Rules |
|-------|---------------|-----------|
| title | required, string, max:100 | required, string, max:100, min:3 |
| description | nullable, string | required, string, min:10 |
| date | required, date | required, date, after_or_equal:today |
| cutoff_day | required, string, max:20 | required, date, after_or_equal:today |
| cutoff_time | required, string, max:20 | required, regex (HH:00 format) |
| capacity | required, integer, min:1 | required, integer, min:1, max:2147483647 |

#### 3. Database Schema Correction

**File:** `servetrack-backend/database/migrations/2026_02_28_143509_create_poll_table.php`

Fixed incorrect column types:

| Column | Previous Type | New Type |
|--------|--------------|----------|
| cutoff_day | string(20) | date |
| cutoff_time | string(20) | time |

#### 4. VolunteerObserver Authentication Fix

**File:** `servetrack-backend/app/Observers/VolunteerObserver.php`

Fixed authentication fallback in model observer to handle non-HTTP contexts (e.g., seeders, artisan commands):

```php
$userId = Auth::id() ?? $volunteer->user_id;
```

---

### Frontend Changes (Angular)

#### 1. Poll Service Authentication

**File:** `servetrack-frontend/src/app/services/poll.service.ts`

- Integrated `AuthService` for CSRF token management
- Added `ensureCsrf()` method for POST/PUT/VOTE requests
- Enabled `withCredentials: true` on all HTTP requests
- Updated API URL to use `environment.apiUrl` for proper configuration

#### 2. Admin Dashboard Form Improvements

**HTML Template:** `servetrack-frontend/src/app/admin-dashboard/admin-dashboard.html`

| Field | Previous | Updated |
|-------|----------|---------|
| Event Date | type="text" | type="date" |
| Cut-off Day | type="text" | type="date" (label: "Cut-off Date") |
| Cut-off Time | type="text" type="time" |

**Component:** `servetrack-frontend/src/app/admin-dashboard/admin-dashboard.ts`

- Added date/time parsing functions for backend data conversion
- Added date/time formatting functions for API payload
- Refactored options management with better form handling

#### 3. Test File Cleanup

Removed duplicate test setup code from:
- `servetrack-frontend/src/app/voting-poll/voting-poll.spec.ts`
- `servetrack-frontend/src/app/auth/admin-signup/admin-signup.spec.ts`
- `servetrack-frontend/src/app/auth/login/login.spec.ts`
- `servetrack-frontend/src/app/auth/signup-form/signup-form.spec.ts`

Centralized test setup in `servetrack-frontend/src/test-setup.ts`:
- Simplified to only import `@analogjs/vitest-angular/setup-testbed`
- Removed duplicate `TestBed.initTestEnvironment` calls

---

## Testing

### Backend Tests

```bash
cd servetrack-backend
php artisan test
php artisan test --filter=Poll
php artisan test --filter=VolunteerObserver
```

### Frontend Tests

```bash
cd servetrack-frontend
npm test
npm test -- src/app/services/poll.service.spec.ts
```

---

## Migration Instructions

### For Development

```bash
php artisan migrate:fresh --seed
```

### For Production

⚠️ **Important:** The migration changes column types from string to date/time. This is a breaking schema change.

1. Create a new migration to alter existing columns
2. Ensure data conversion from string formats to proper date/time formats
3. Example conversions:
   - `YYYY-MM-DD` strings convert correctly to `date` type
   - `HH:MM` strings (e.g., "14:00") convert correctly to `time` type

---

## Security Improvements

1. **CSRF Protection**: Poll service now ensures CSRF tokens are sent with state-changing requests
2. **Credentials**: All API requests now send credentials (cookies) for proper session-based authentication
3. **Input Validation**: Stricter validation prevents malformed data entry

---

## Breaking Changes

| Category | Change |
|----------|--------|
| Database | Column type changes for `cutoff_day` and `cutoff_time` |
| API Auth | All frontend HTTP requests require proper session/cookie authentication |
| Form Validation | Stricter rules may cause previously valid data to be rejected |

---

## Related Files

### Modified Files

**Backend:**
- `app/Http/Controllers/PollController.php`
- `app/Http/Requests/StorePollRequest.php`
- `app/Observers/VolunteerObserver.php`
- `database/migrations/2026_02_28_143509_create_poll_table.php`

**Frontend:**
- `src/app/admin-dashboard/admin-dashboard.html`
- `src/app/admin-dashboard/admin-dashboard.ts`
- `src/app/services/poll.service.ts`
- `src/test-setup.ts`
- `src/app/auth/admin-signup/admin-signup.spec.ts`
- `src/app/auth/login/login.spec.ts`
- `src/app/auth/signup-form/signup-form.spec.ts`
- `src/app/voting-poll/voting-poll.spec.ts`

---

## Date

March 2026
