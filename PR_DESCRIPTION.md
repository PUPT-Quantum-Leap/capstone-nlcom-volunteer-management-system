# Pull Request: Poll Management System Improvements & Authentication Fixes

## Overview
This PR includes significant improvements to the poll management system, including enhanced validation, proper authentication handling, database schema corrections, and frontend form improvements.

---

## Changes Summary

### Backend Changes (Laravel)

#### 1. Poll Refresh After Update (`PollController.php`)
- Added `$poll->refresh()` after updating poll status to ensure fresh data is returned
- This ensures the response contains up-to-date poll information

#### 2. Enhanced Poll Validation (`StorePollRequest.php`)
Strengthened validation rules:
- **Title**: Added `min:3` constraint
- **Description**: Changed from nullable to required with `min:10`
- **Date**: Added `after_or_equal:today` to prevent past dates
- **Cutoff Day**: Changed from string to `date` type with `after_or_equal:today`
- **Cutoff Time**: Added regex validation for 24-hour format (`HH:00`)
- **Capacity**: Added `max:2147483647` to prevent integer overflow

#### 3. Database Schema Correction (Migration `2026_02_28_143509_create_poll_table.php`)
Fixed incorrect column types:
- `cutoff_day`: `string` → `date`
- `cutoff_time`: `string` → `time`

#### 4. VolunteerObserver Authentication Fix (`VolunteerObserver.php`)
Fixed authentication fallback in model observer:
- When `Auth::id()` returns null (e.g., during seeders or CLI commands), it now falls back to `$volunteer->user_id`
- Prevents audit logging failures in non-HTTP contexts

---

### Frontend Changes (Angular)

#### 1. Poll Service Authentication (`poll.service.ts`)
- Integrated `AuthService` for CSRF token management
- Added `ensureCsrf()` method for POST/PUT/VOTE requests
- Enabled `withCredentials: true` on all HTTP requests
- Updated API URL to use `environment.apiUrl` for proper configuration

#### 2. Admin Dashboard Form Improvements
**HTML Template (`admin-dashboard.html`):**
- Changed event date input from `type="text"` to `type="date"`
- Changed cutoff day to `type="date"` with updated label "Cut-off Date"
- Improved select dropdown for options with time slots
- Enhanced layout and accessibility

**Component (`admin-dashboard.ts`):**
- Refactored options management to use `PatchableSignal`
- Improved reactive form handling for dynamic option addition/removal
- Better form control management

#### 3. Test File Cleanup
Removed duplicate/unnecessary test setup code from:
- `voting-poll.spec.ts`
- `admin-signup.spec.ts`
- `login.spec.ts`
- `signup-form.spec.ts`

**Centralized test setup** in `test-setup.ts`:
- Simplified to only import `@analogjs/vitest-angular/setup-testbed`
- Removed duplicate `TestBed.initTestEnvironment` calls

---

## Testing Recommendations

### Backend
```bash
php artisan test
# or
php artisan test --filter=Poll
php artisan test --filter=VolunteerObserver
```

### Frontend
```bash
npm test
# or run specific tests
npm test -- src/app/services/poll.service.spec.ts
```

---

## Migration Notes

⚠️ **IMPORTANT**: The database migration changes column types from `string` to `date` and `time`. This is a breaking schema change that requires:

1. **If the application is in development:**
   ```bash
   php artisan migrate:fresh --seed
   ```

2. **If the application has production data:**
   - Create a new migration to alter existing columns
   - Ensure data conversion from string formats to proper date/time formats
   - Example: `YYYY-MM-DD` strings will convert correctly to `date` type
   - Example: `HH:MM` strings (e.g., "14:00") will convert correctly to `time` type

---

## Security Improvements

1. **CSRF Protection**: Poll service now ensures CSRF tokens are sent with state-changing requests
2. **Credentials**: All API requests now send credentials (cookies) for proper session-based authentication
3. **Input Validation**: Stricter validation prevents malformed data entry

---

## Breaking Changes

- **Database**: Column type changes for `cutoff_day` and `cutoff_time`
- **API Auth**: All frontend HTTP requests now require proper session/cookie authentication
- **Form Validation**: Stricter rules may cause previously valid data to be rejected

---

## Checklist

- [x] Code follows project conventions
- [x] Backend validation enhanced
- [x] Database schema corrected
- [x] Authentication fixed for CSRF
- [x] Frontend forms improved with proper input types
- [x] Test files cleaned up and centralized
- [x] No hardcoded secrets added
- [x] All new code is tested

---

## Related Issues

(Add issue numbers if applicable)

---

## Screenshots / Demo

(Optional - add screenshots if UI changes are significant)

---

## Additional Notes

- The Poll controller refresh ensures consistent data after status updates
- The VolunteerObserver fix resolves issues when running seeders or artisan commands that interact with volunteers
- The test setup consolidation follows Angular/Vitest best practices
