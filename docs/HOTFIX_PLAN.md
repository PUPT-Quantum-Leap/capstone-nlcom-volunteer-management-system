# ServeTrack Hotfix Plan

**Document Version:** 1.0  
**Created:** March 7, 2026  
**Priority:** Critical  
**Estimated Effort:** 8-12 hours  

---

## Executive Summary

This hotfix plan addresses **22 identified bugs** in the ServeTrack volunteer management system, prioritized by severity and impact. The focus is on resolving critical memory leaks, security inconsistencies, and data integrity issues that could affect production stability.

---

## Hotfix Phases

### Phase 1: Critical Issues (Immediate - 2-3 hours)

These issues cause memory leaks and security vulnerabilities that must be fixed immediately.

#### 1.1 Memory Leak: Missing Subscription Cleanup

**Affected Files:**
- `servetrack-frontend/src/app/app.ts`
- `servetrack-frontend/src/app/auth/login/login.ts`
- `servetrack-frontend/src/app/volunteer-dashboard/volunteer-dashboard.ts`
- `servetrack-frontend/src/app/admin-dashboard/admin-dashboard.ts`

**Issue:** Components subscribe to Observables without cleanup, causing memory leaks over time.

**Fix:**

```typescript
// Import at the top
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

// In ngOnInit or constructor
this.authService.checkAuthStatus$()
  .pipe(takeUntilDestroyed())
  .subscribe();
```

**Files to Modify:**
| File | Lines | Change |
|------|-------|--------|
| `app.ts` | 16 | Add `takeUntilDestroyed()` to subscription |
| `login.ts` | 72 | Add `takeUntilDestroyed()` to subscription |
| `volunteer-dashboard.ts` | 224, 315, 328, 607 | Add `takeUntilDestroyed()` to all subscriptions |
| `admin-dashboard.ts` | 139 | Add `takeUntilDestroyed()` to subscription |

**Testing:**
- [ ] Verify no memory leaks in Chrome DevTools Memory tab after 5 minutes
- [ ] Confirm authentication flow still works correctly
- [ ] Run existing unit tests: `npm test -- src/app/app.spec.ts`

---

#### 1.2 Race Condition: Interval Timer Not Cleaned Up

**Affected File:**
- `servetrack-frontend/src/app/auth/admin-signup/admin-signup.ts` (Lines 210-220)

**Issue:** Countdown interval persists after component destruction.

**Fix:**

```typescript
export class AdminSignupComponent implements OnInit, OnDestroy {
  private countdownInterval?: ReturnType<typeof setInterval>;
  
  startCountdown(): void {
    this.countdownInterval = setInterval(() => {
      // ... existing logic
    }, 1000);
  }
  
  ngOnDestroy(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }
}
```

**Testing:**
- [ ] Navigate away during countdown - verify no console errors
- [ ] Verify countdown completes successfully when staying on page
- [ ] Run unit tests: `npm test -- src/app/auth/admin-signup/admin-signup.spec.ts`

---

#### 1.3 Security: Password Validation Mismatch

**Affected Files:**
- `servetrack-frontend/src/app/validators/password.validator.ts` (Line 24)
- `servetrack-backend/app/Http/Requests/Auth/RegisterRequest.php` (Lines 45-52)
- `servetrack-backend/app/Http/Requests/Auth/VolunteerSignupRequest.php`

**Issue:** Inconsistent password requirements (12 chars vs 8 chars).

**Fix:**

**Backend - VolunteerSignupRequest.php:**
```php
// Change from min:8 to min:12 for consistency
'password' => ['required', 'confirmed', 'min:12', 'max:255'],
```

**Frontend - password.validator.ts:**
```typescript
// Ensure consistency with backend
const MIN_LENGTH = 12; // Already correct, verify it's enforced
```

**Testing:**
- [ ] Attempt registration with 8-character password - should fail
- [ ] Attempt registration with 12-character password - should succeed
- [ ] Verify error messages are clear

---

### Phase 2: High Severity Issues (3-4 hours)

These issues affect data integrity, error handling, and security.

#### 2.1 Missing Error Handling: Silent Failures

**Affected File:**
- `servetrack-frontend/src/app/services/volunteer.service.ts` (Lines 31-35, 52-56, 69-71)

**Issue:** Errors are caught and suppressed, hiding failures from the application.

**Fix:**

```typescript
// Replace this pattern:
catchError(() => of({ success: false, data: null as unknown as VolunteerProfileResponse }))

// With this:
catchError((error) => {
  console.error('[VolunteerService] getProfile failed:', error);
  throw error; // Propagate to caller
})
```

**Files to Modify:**
| Method | Lines | Change |
|--------|-------|--------|
| `getProfile()` | 31-35 | Re-throw errors |
| `updateProfile()` | 52-56 | Re-throw errors |
| `getAttendance()` | 69-71 | Re-throw errors |
| `getAttendanceStats()` | 85-87 | Re-throw errors |
| `getVolunteers()` | 103-105 | Re-throw errors |

**Testing:**
- [ ] Verify errors are logged to console
- [ ] Verify error UI displays correctly in components
- [ ] Run service tests: `npm test -- src/app/services/volunteer.service.spec.ts`

---

#### 2.2 Data Integrity: Transaction Rollback Issues

**Affected File:**
- `servetrack-backend/app/Http/Controllers/VolunteerController.php` (Lines 104-157)

**Issue:** Auth operations outside transaction scope.

**Fix:**

```php
public function register(RegisterRequest $request): JsonResponse
{
    try {
        DB::beginTransaction();
        
        // ... existing volunteer creation ...
        
        // Move Auth::login() inside transaction
        Auth::login($user);
        
        DB::commit();
        
        return response()->json([...]);
    } catch (\Exception $e) {
        DB::rollBack();
        // ... error handling ...
    }
}
```

**Testing:**
- [ ] Test registration flow end-to-end
- [ ] Verify database state on auth failure
- [ ] Run feature tests: `composer test -- tests/Feature/VolunteerControllerTest.php`

---

#### 2.3 Inconsistent Email Normalization

**Affected Files:**
- `servetrack-backend/app/Http/Controllers/VolunteerController.php` (Lines 39-47)
- `servetrack-backend/app/Http/Controllers/AdminController.php` (Lines 135-139)
- `servetrack-backend/app/Http/Requests/Auth/LoginRequest.php` (Lines 44-49)

**Issue:** Email normalization not applied consistently.

**Fix:**

**Create a new middleware:**
```php
// app/Http/Middleware/NormalizeEmail.php
public function handle(Request $request, Closure $next): Response
{
    if ($request->has('email')) {
        $request->merge(['email' => strtolower(trim($request->email))]);
    }
    return $next($request);
}
```

**Apply to routes:**
```php
// routes/api.php
Route::middleware(['auth:sanctum', 'normalize.email'])
     ->group(function () {
         // ... routes
     });
```

**Testing:**
- [ ] Register with uppercase email - verify lowercase stored
- [ ] Login with mixed case email - verify authentication works

---

#### 2.4 SQL Injection Risk Mitigation

**Affected File:**
- `servetrack-backend/app/Http/Controllers/VolunteerController.php` (Lines 583-590)

**Issue:** Dynamic sorting with user input (currently safe via allowlist, but needs hardening).

**Fix:**

```php
$allowedSorts = ['first_name', 'last_name', 'created_at', 'updated_at'];
$sortDirection = in_array($request->query('direction'), ['asc', 'desc'])
    ? $request->query('direction')
    : 'desc';

$sortBy = in_array($request->query('sort'), $allowedSorts)
    ? $request->query('sort')
    : 'created_at';

// Add logging for debugging
\Log::debug('Sorting volunteers', ['sortBy' => $sortBy, 'direction' => $sortDirection]);
```

**Testing:**
- [ ] Test sorting with valid fields
- [ ] Test sorting with invalid fields - verify fallback to default
- [ ] Check logs for sorting activity

---

### Phase 3: Medium Severity Issues (2-3 hours)

#### 3.1 Type Safety: Fix `any` Type Usage

**Affected File:**
- `servetrack-frontend/src/app/services/auth.service.ts` (Line 110)

**Fix:**
```typescript
public ensureCsrf$(): Observable<void> {
  return this.http.get('/sanctum/csrf-cookie', { withCredentials: true });
}
```

---

#### 3.2 Null/Undefined Handling: Safe Property Access

**Affected File:**
- `servetrack-frontend/src/app/volunteer-dashboard/volunteer-dashboard.ts` (Lines 254-257)

**Fix:**
```typescript
const position = data.positions?.[0];
const positionName = position?.name ?? '';

const availability = data.availabilities?.[0];
const availabilityName = availability?.name ?? '';
const otherAvailability = availability?.pivot?.custom_description ?? '';
```

---

#### 3.3 Add Database Indexes

**Affected File:**
- `servetrack-backend/database/migrations/2026_03_01_143533_create_attendances_table.php`

**Fix - Create new migration:**
```bash
php artisan make:migration add_indexes_to_attendances_table --table=attendances
```

```php
public function up(): void
{
    Schema::table('attendances', function (Blueprint $table) {
        $table->index('volunteer_id');
        $table->index(['volunteer_id', 'status']);
        $table->index('date');
        $table->index('status');
    });
}
```

**Testing:**
- [ ] Run migration: `php artisan migrate`
- [ ] Verify query performance with `EXPLAIN`
- [ ] Run existing tests to ensure no regressions

---

#### 3.4 CSRF Token Handling

**Affected File:**
- `servetrack-frontend/src/app/interceptors/csrf.interceptor.ts`

**Fix:**
```typescript
intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
  const csrfToken = this.cookieService.get('XSRF-TOKEN');
  
  if (!csrfToken && this.isStateChangingRequest(req)) {
    // Fetch CSRF token first
    return this.authService.ensureCsrf$().pipe(
      switchMap(() => {
        const newCsrfToken = this.cookieService.get('XSRF-TOKEN');
        return this.applyCsrfToken(req, next, newCsrfToken);
      })
    );
  }
  
  return this.applyCsrfToken(req, next, csrfToken);
}

private isStateChangingRequest(req: HttpRequest<any>): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
}
```

---

### Phase 4: Low Severity Issues (1-2 hours)

#### 4.1 Remove Dead Code

**Affected File:**
- `servetrack-frontend/src/app/volunteer-dashboard/volunteer-dashboard.ts` (Lines 653-663)

**Fix:** Delete the `deleteProfile()` method entirely.

---

#### 4.2 Add Documentation

**Affected File:**
- `servetrack-backend/app/Http/Controllers/VolunteerController.php`

**Fix:** Add PHPDoc to private methods:
```php
/**
 * Process volunteer preference and related fields.
 * Updates volunteer_preference, other_preference, and related pivot tables.
 *
 * @param Volunteer $volunteer The volunteer model to update
 * @param array $validatedData The validated request data
 * @return void
 */
private function processVolunteerPreference(
    Volunteer $volunteer,
    array $validatedData
): void { ... }
```

---

#### 4.3 Fix Error Message Exposure

**Affected File:**
- `servetrack-backend/app/Http/Controllers/VolunteerController.php` (Line 166)

**Fix:**
```php
// Before:
'message' => 'Registration failed: ' . $e->getMessage(),

// After:
'message' => 'Registration failed. Please try again or contact support.',
// Log detailed error internally
\Log::error('Volunteer registration failed', [
    'error' => $e->getMessage(),
    'trace' => $e->getTraceAsString(),
]);
```

---

## Testing Strategy

### Unit Tests

**Frontend:**
```bash
cd servetrack-frontend
npm test -- --run
```

**Backend:**
```bash
cd servetrack-backend
composer test
```

### Integration Tests

1. **Authentication Flow:**
   - [ ] Register new volunteer
   - [ ] Login with credentials
   - [ ] Access protected endpoints
   - [ ] Logout

2. **Profile Management:**
   - [ ] Update profile information
   - [ ] Upload profile photo
   - [ ] Change password

3. **Admin Functions:**
   - [ ] View all volunteers
   - [ ] View volunteer details
   - [ ] View change history

### Performance Tests

1. **Memory Leak Verification:**
   - Open Chrome DevTools → Memory tab
   - Take heap snapshot
   - Navigate through app for 5 minutes
   - Take another snapshot
   - Compare - should not show growing detached DOM nodes

2. **Database Query Performance:**
   ```sql
   EXPLAIN SELECT * FROM attendances WHERE volunteer_id = 1 AND status = 'present';
   -- Should use index after migration
   ```

---

## Rollback Plan

If issues are discovered after deployment:

### Frontend Rollback
```bash
cd servetrack-frontend
git revert HEAD~<number-of-commits>
npm run build
npm run start
```

### Backend Rollback
```bash
cd servetrack-backend
git revert HEAD~<number-of-commits>
php artisan migrate:rollback --step=<number-of-migrations>
composer install
php artisan config:clear
php artisan cache:clear
```

### Database Rollback
```bash
php artisan migrate:rollback --step=1  # Rollback index migration
```

---

## Deployment Checklist

### Pre-Deployment
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Code review completed
- [ ] Performance tests completed
- [ ] Security scan completed (Gitleaks)

### Deployment
- [ ] Backup database
- [ ] Deploy backend changes
- [ ] Run migrations: `php artisan migrate`
- [ ] Deploy frontend changes
- [ ] Clear caches: `php artisan config:clear && php artisan cache:clear`
- [ ] Verify health endpoints

### Post-Deployment
- [ ] Smoke test critical flows
- [ ] Monitor error logs for 1 hour
- [ ] Check memory usage trends
- [ ] Verify database query performance
- [ ] Confirm CSRF protection working

---

## Success Metrics

| Metric | Before | Target | Measurement |
|--------|--------|--------|-------------|
| Memory leak (5 min) | Growing | <50MB increase | Chrome DevTools |
| Password validation consistency | 2 standards | 1 standard | Manual testing |
| Error visibility | Hidden | Logged + displayed | Console + UI |
| Query performance (attendances) | No index | <10ms | EXPLAIN analysis |
| Subscription cleanup | Manual | Automatic | Code review |

---

## Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1 (Critical) | 2-3 hours | None |
| Phase 2 (High) | 3-4 hours | Phase 1 complete |
| Phase 3 (Medium) | 2-3 hours | Phase 2 complete |
| Phase 4 (Low) | 1-2 hours | Phase 3 complete |
| Testing & QA | 2-3 hours | All phases complete |
| **Total** | **10-15 hours** | |

---

## Responsible Team Members

| Role | Responsibility | Assignee |
|------|---------------|----------|
| Frontend Developer | Phase 1, Phase 3.1-3.2, Phase 4.1 | _TBD_ |
| Backend Developer | Phase 2, Phase 3.3-3.4, Phase 4.2-4.3 | _TBD_ |
| QA Engineer | Testing strategy execution | _TBD_ |
| DevOps | Deployment & rollback | _TBD_ |

---

## Appendix: Related Documentation

- [Product Requirements](../PRD.md)
- [Development Guidelines](../AGENTS.md)
- [CI/CD Documentation](./CI_README.md)
- [Database Schema](./DATABASE_SCHEMA.md)

---

**Approval Required:** This hotfix plan requires approval from the project lead before implementation.

**Last Updated:** March 7, 2026
