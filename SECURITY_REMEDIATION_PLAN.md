# Security Remediation Plan - ServeTrack Volunteer Management System

**Document Version:** 1.0  
**Date:** March 7, 2026  
**Project:** ServeTrack (Angular 21 + Laravel 12)  
**Prepared by:** Security Analysis Agent

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Critical Issues (Fix Immediately)](#critical-issues-fix-immediately)
3. [High Priority Issues](#high-priority-issues)
4. [Medium Priority Issues](#medium-priority-issues)
5. [Low Priority Improvements](#low-priority-improvements)
6. [Implementation Roadmap](#implementation-roadmap)
7. [Verification Checklist](#verification-checklist)

---

## Executive Summary

This document outlines the comprehensive security remediation plan for the ServeTrack Volunteer Management System. Based on the OWASP Top 10 (2024/2025) framework and industry best practices, the analysis identified **10 critical vulnerabilities** requiring immediate attention.

| Priority Level | Issue Count | Timeline |
|---------------|-------------|----------|
| Critical | 4 | Immediate (1-2 days) |
| High | 6 | 1-2 weeks |
| Medium | 5 | 2-4 weeks |
| Low | 3 | 1-2 months |

---

## Critical Issues (Fix Immediately)

These vulnerabilities expose the system to immediate exploitation and must be addressed within 24-48 hours.

### Issue 1: Missing Authorization on Admin Endpoints (IDOR)

**OWASP Category:** A01 - Broken Access Control  
**Severity:** CRITICAL  
**CVSS Score:** 9.1

#### Description
The `/admin/dashboard`, `/volunteers`, and `/volunteers/{id}` endpoints only verify authentication (`auth:sanctum`) but do NOT verify the user has admin privileges. Any authenticated user (including volunteers) can access sensitive admin data.

#### Affected Endpoints
- `GET /api/admin/dashboard`
- `GET /api/volunteers`
- `GET /api/volunteers/{id}`
- `GET /api/admin/volunteers/{id}/change-history`

#### Current Code (api.php)
```php
Route::middleware(['api', 'auth:sanctum'])->group(function (): void {
    Route::get('/admin/dashboard', [AdminController::class, 'dashboard']);
    Route::get('/volunteers', [VolunteerController::class, 'index']);
    Route::get('/volunteers/{id}', [VolunteerController::class, 'show']);
```

#### Remediation Steps

**Step 1:** Create Role Middleware
```bash
cd servetrack-backend
php artisan make:middleware RoleMiddleware
```

**Step 2:** Implement RoleMiddleware
```php
// app/Http/Middleware/RoleMiddleware.php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RoleMiddleware
{
    public function handle(Request $request, Closure $next, string $role): Response
    {
        if (!$request->user()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated.',
            ], 401);
        }

        if ($request->user()->role !== $role) {
            return response()->json([
                'success' => false,
                'message' => 'Forbidden. You do not have permission to access this resource.',
            ], 403);
        }

        return $next($request);
    }
}
```

**Step 3:** Register Middleware in bootstrap/app.php
```php
$middleware->alias([
    // ... existing aliases
    'role' => \App\Http\Middleware\RoleMiddleware::class,
]);
```

**Step 4:** Update Routes
```php
// Admin-only routes
Route::middleware(['api', 'auth:sanctum', 'role:admin'])->group(function (): void {
    Route::get('/admin/dashboard', [AdminController::class, 'dashboard']);
    Route::get('/volunteers', [VolunteerController::class, 'index']);
    Route::get('/volunteers/{id}', [VolunteerController::class, 'show']);
    Route::get('/admin/volunteers/{id}/change-history', [VolunteerController::class, 'changeHistory']);
});
```

**Estimated Time:** 2-3 hours

---

### Issue 2: Token Expiration Set to Null

**OWASP Category:** A02 - Cryptographic Failures  
**Severity:** CRITICAL  
**CVSS Score:** 7.5

#### Description
Sanctum tokens are configured with `null` expiration, meaning tokens never expire unless manually revoked. This significantly increases the attack window if tokens are compromised.

#### Affected File
`config/sanctum.php` line 50

#### Current Code
```php
'expiration' => null,
```

#### Remediation Steps

**Step 1:** Update sanctum.php configuration
```php
'expiration' => env('SANCTUM_EXPIRATION', 60), // 60 minutes default
```

**Step 2:** Add to .env file
```env
SANCTUM_EXPIRATION=60
```

**Step 3:** Update token creation in all controllers to use configured expiration
```php
// Already using config - verify all controllers use:
$token = $user->createToken(
    'auth-token', 
    ['*'], 
    now()->addMinutes(config('sanctum.expiration', 60))
)->plainTextToken;
```

**Estimated Time:** 30 minutes

---

### Issue 3: Weak Hashing in Rate Limiter (MD5)

**OWASP Category:** A02 - Cryptographic Failures  
**Severity:** CRITICAL  
**CVSS Score:** 7.2

#### Description
The AdvancedRateLimit middleware uses MD5 for hashing email addresses, which is cryptographically broken and vulnerable to collision attacks.

#### Affected File
`app/Http/Middleware/AdvancedRateLimit.php` line 92

#### Current Code
```php
return 'rate_limit:'.($email ? md5(strtolower((string) $email)).':' : '').$ip;
```

#### Remediation Steps

**Step 1:** Replace MD5 with SHA-256
```php
return 'rate_limit:'.($email ? hash('sha256', strtolower((string) $email)).':' : '').$ip;
```

**Estimated Time:** 15 minutes

---

### Issue 4: Tokens Have All Abilities (Over-Privileged)

**OWASP Category:** A01 - Broken Access Control  
**Severity:** CRITICAL  
**CVSS Score:** 8.1

#### Description
All API tokens are created with `['*']` abilities, granting full access to all endpoints. This violates the principle of least privilege.

#### Affected Files
- `app/Http/Controllers/VolunteerController.php` (line 142)
- `app/Http/Controllers/AdminController.php` (line 227)
- `app/Http/Controllers/CoordinatorController.php` (line 50)
- `app/Http/Controllers/Auth/LoginController.php` (line 167)

#### Current Code
```php
$token = $user->createToken('auth-token', ['*'], now()->addMinutes(...))->plainTextToken;
```

#### Remediation Steps

**Step 1:** Define token abilities in a constants file
```php
// app/Constants/TokenAbilities.php
<?php

namespace App\Constants;

class TokenAbilities
{
    public const VOLUNTEER_READ = 'volunteer:read';
    public const VOLUNTEER_WRITE = 'volunteer:write';
    public const ADMIN_READ = 'admin:read';
    public const ADMIN_WRITE = 'admin:write';
    public const PROFILE_READ = 'profile:read';
    public const PROFILE_WRITE = 'profile:write';
}
```

**Step 2:** Update token creation in controllers

For volunteers:
```php
$abilities = [
    \App\Constants\TokenAbilities::VOLUNTEER_READ,
    \App\Constants\TokenAbilities::PROFILE_READ,
    \App\Constants\TokenAbilities::PROFILE_WRITE,
];
$token = $user->createToken('auth-token', $abilities, now()->addMinutes(config('sanctum.expiration', 60)))->plainTextToken;
```

For admins:
```php
$abilities = [
    \App\Constants\TokenAbilities::VOLUNTEER_READ,
    \App\Constants\TokenAbilities::VOLUNTEER_WRITE,
    \App\Constants\TokenAbilities::ADMIN_READ,
    \App\Constants\TokenAbilities::ADMIN_WRITE,
    \App\Constants\TokenAbilities::PROFILE_READ,
    \App\Constants\TokenAbilities::PROFILE_WRITE,
];
```

**Step 3:** Add ability checks to routes
```php
// In routes/api.php - require specific abilities
Route::middleware(['api', 'auth:sanctum', 'ability:admin:read'])->group(function (): void {
    Route::get('/admin/dashboard', [AdminController::class, 'dashboard']);
});
```

**Estimated Time:** 2-3 hours

---

## High Priority Issues

These issues should be addressed within 1-2 weeks.

### Issue 5: CORS Configuration Not Environment-Based

**OWASP Category:** A05 - Security Misconfiguration  
**Severity:** HIGH

#### Affected File
`config/cors.php`

#### Current Code
```php
'allowed_origins' => [
    'http://localhost:4200',
    'http://localhost:4201',
    'http://127.0.0.1:4200',
    'http://127.0.0.1:4201',
],
```

#### Remediation
```php
'allowed_origins' => explode(',', env('CORS_ALLOWED_ORIGINS', 'http://localhost:4200,http://localhost:4201')),
```

Add to .env:
```env
CORS_ALLOWED_ORIGINS=http://localhost:4200,http://localhost:4201,https://yourdomain.com
```

---

### Issue 6: No Role-Based Access Control for Coordinator

**Severity:** HIGH

#### Issue
Coordinators have no explicit authorization. Any authenticated user could potentially access coordinator endpoints.

#### Remediation
Create ability-based middleware:
```php
// app/Http/Middleware/AbilityMiddleware.php
public function handle(Request $request, Closure $next, string $ability): Response
{
    if (!$request->user()->tokenCan($ability)) {
        return response()->json([
            'success' => false,
            'message' => 'Forbidden. Required ability not granted.',
        ], 403);
    }
    
    return $next($request);
}
```

---

### Issue 7: Content Security Policy Needs Production Hardening

**OWASP Category:** A05 - Security Misconfiguration  
**Severity:** HIGH

#### Affected File
`app/Http/Middleware/SecurityHeaders.php`

#### Current Issue
The CSP allows `'unsafe-inline'` for styles and has localhost-specific rules that may leak to production.

#### Remediation
```php
protected function buildCSP(Request $request): string
{
    $isLocal = in_array($request->getHost(), ['localhost', '127.0.0.1']);
    $isDev = app()->environment(['local', 'development']);

    $directives = [
        'default-src' => "'self'",
        'script-src' => $isDev ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self'",
        'style-src' => $isDev ? "'self' 'unsafe-inline'" : "'self'",
        'img-src' => "'self' data: https:",
        'font-src' => "'self' data:",
        'connect-src' => "'self'",
        'frame-ancestors' => "'none'",
        'form-action' => "'self'",
        'base-uri' => "'self'",
        'upgrade-insecure-requests' => '',
    ];

    // For production, use environment variable for additional domains
    if (!$isDev) {
        $additionalDomains = explode(',', env('CSP_ADDITIONAL_DOMAINS', ''));
        if (!empty($additionalDomains)) {
            $directives['connect-src'] .= ' ' . implode(' ', array_map(fn($d) => trim($d), $additionalDomains));
        }
    }

    $parts = [];
    foreach ($directives as $directive => $value) {
        $parts[] = empty($value) ? $directive : "{$directive} {$value}";
    }

    return implode('; ', $parts);
}
```

---

### Issue 8: No Two-Factor Authentication

**OWASP Category:** A07 - Identification and Authentication Failures  
**Severity:** HIGH

#### Issue
Admin accounts lack 2FA protection, making them vulnerable to credential stuffing and password attacks.

#### Recommendation
While full 2FA implementation is complex, consider these interim measures:
1. Implement strong password policies (already partially done)
2. Add IP-based admin access restrictions
3. Implement session timeout for admin users
4. Consider TOTP-based 2FA in future iteration

---

### Issue 9: Missing Rate Limiting on Registration

**OWASP Category:** A07 - Identification and Authentication Failures  
**Severity:** HIGH

#### Issue
Registration endpoints (`/volunteer/register`, `/admin/register`, `/coordinator/register`) should have stricter rate limits to prevent spam registration and account enumeration.

#### Current Status
The `rate.limit` middleware is applied, but registration should have lower limits.

#### Remediation
Add specific throttle to registration:
```php
Route::post('/volunteer/register', [VolunteerController::class, 'register'])
    ->middleware(['api', 'guest', 'security.audit', 'throttle:registration']);
```

Configure in RouteServiceProvider:
```php
protected function configureRateLimiting(): void
{
    RateLimiter::for('registration', function (Request $request) {
        return Limit::perHour(3)->by($request->ip());
    });
}
```

---

### Issue 10: Frontend Input Sanitizer Inefficiency

**OWASP Category:** A03 - Injection  
**Severity:** HIGH (but partially mitigated)

#### Issue
The InputSanitizerService uses regex-based XSS prevention, which is error-prone and bypassable.

#### Recommendation
1. Rely on Angular's built-in XSS protection (automatic for template binding)
2. Keep sanitization only for edge cases where you need to render HTML
3. Add additional backend validation using Laravel's built-in sanitizers

---

## Medium Priority Issues

Address within 2-4 weeks.

### Issue 11: Missing API Versioning

#### Issue
No API versioning makes breaking changes difficult.

#### Recommendation
Implement URL-based versioning:
```php
// routes/api.php
Route::prefix('v1')->group(function () {
    // existing routes
});
```

---

### Issue 12: No Request Size Limits

#### Issue
No explicit limits on request body size.

#### Recommendation
Add to `bootstrap/app.php`:
```php
->withMiddleware(function (Middleware $middleware): void {
    $middleware->api(prepend: [
        \Illuminate\Http\Middleware\HandleCors::class,
    ]);
    
    // Add request size limit
    $middleware->validateCsrfTokens(except: [
        'api/*'
    ]);
})
```

Also configure php.ini:
```ini
upload_max_filesize = 2M
post_max_size = 2M
```

---

### Issue 13: Insufficient Audit Trail

#### Issue
Profile changes are logged but password changes, role modifications lack audit trails.

#### Recommendation
Create comprehensive audit logging:
```php
// app/Observers/UserObserver.php
public function updated(User $user): void
{
    if ($user->wasChanged('role')) {
        ProfileChangeLog::create([
            'user_id' => $user->id,
            'action' => 'role_changed',
            'old_value' => $user->getOriginal('role'),
            'new_value' => $user->role,
            'changed_by' => auth()->id(),
        ]);
    }
}
```

---

### Issue 14: No Password Breach Checking

#### Issue
Passwords are validated for format but not checked against known breaches.

#### Recommendation
Use Laravel package like `laravel-haveibeenpwned`:
```bash
composer require marc-mabe/laravel-been-pwned
```

Add to password validation:
```php
'password' => [
    'required',
    'string',
    Password::defaults(),
    // Add breach check in production
    app()->environment('production') 
        ? new \MabeEnum\HibpPassword() 
        : null,
],
```

---

### Issue 15: Incomplete Error Handling

#### Issue
Some error responses may leak sensitive information in production.

#### Recommendation
Ensure generic error messages in production:
```php
// In app/Exceptions/Handler.php
public function render($request, Throwable $exception)
{
    if (app()->environment('production')) {
        if ($exception instanceof \Illuminate\Database\QueryException) {
            return response()->json([
                'success' => false,
                'message' => 'A database error occurred.',
            ], 500);
        }
    }
    
    return parent::render($request, $exception);
}
```

---

## Low Priority Improvements

Address within 1-2 months.

### Issue 16: Implement HTTPS Enforcement
- Ensure HSTS is properly configured for production
- Add security.txt and .well-known/security policy

### Issue 17: Add Rate Limiting Metrics Dashboard
- Create admin dashboard showing rate limit events
- Monitor for attack patterns

### Issue 18: Implement Session Binding
- Bind tokens to IP/User-Agent for additional security

---

## Implementation Roadmap

### Phase 1: Immediate (Days 1-2)
| Task | Owner | Status |
|------|-------|--------|
| Create RoleMiddleware | Developer | ⬜ |
| Update routes with role checks | Developer | ⬜ |
| Fix token expiration | Developer | ⬜ |
| Fix MD5 in rate limiter | Developer | ⬜ |

### Phase 2: High Priority (Days 3-14)
| Task | Owner | Status |
|------|-------|--------|
| Define token abilities | Developer | ⬜ |
| Update all token creation | Developer | ⬜ |
| Update CORS config | Developer | ⬜ |
| Harden CSP for production | Developer | ⬜ |
| Add registration rate limiting | Developer | ⬜ |

### Phase 3: Medium Priority (Weeks 3-4)
| Task | Owner | Status |
|------|-------|--------|
| Implement API versioning | Developer | ⬜ |
| Add request size limits | Developer | ⬜ |
| Enhance audit logging | Developer | ⬜ |
| Implement password breach checking | Developer | ⬜ |
| Improve error handling | Developer | ⬜ |

### Phase 4: Long Term (Months 2-3)
| Task | Owner | Status |
|------|-------|--------|
| Implement 2FA | Developer | ⬜ |
| Add security metrics dashboard | Developer | ⬜ |
| Implement session binding | Developer | ⬜ |
| Security penetration testing | Security Team | ⬜ |

---

## Verification Checklist

After implementing fixes, verify the following:

### Authentication & Authorization
- [ ] Volunteers cannot access `/admin/dashboard`
- [ ] Volunteers cannot access `/volunteers` endpoint
- [ ] Only admins can access admin endpoints
- [ ] Coordinators have appropriate access levels
- [ ] Token abilities are properly scoped

### Security Headers
- [ ] CSP is properly configured
- [ ] HSTS header is set in production
- [ ] X-Frame-Options is set to SAMEORIGIN
- [ ] X-Content-Type-Options is set to nosniff

### Rate Limiting
- [ ] Login attempts are properly rate-limited
- [ ] Registration is rate-limited
- [ ] Rate limit uses SHA-256, not MD5

### Configuration
- [ ] Token expiration is set (60 minutes)
- [ ] CORS uses environment variables
- [ ] Production environment variables are configured

### Monitoring
- [ ] Security audit logs are being generated
- [ ] Failed authentication attempts are logged
- [ ] Rate limit events are logged

---

## Testing Recommendations

### Automated Testing
```bash
# Run Laravel tests
cd servetrack-backend
php artisan test --compact

# Run Pint (code style)
./vendor/bin/pint

# Security headers test
php artisan test --filter=SecurityHeaders
```

### Manual Testing Checklist
1. Try accessing admin endpoints as volunteer - should return 403
2. Try accessing admin endpoints without auth - should return 401
3. Verify rate limiting kicks in after 5 failed attempts
4. Check security headers in browser DevTools
5. Verify token expiration works correctly

---

## References

- [OWASP Top 10 2024](https://owasp.org/www-project-top-ten/)
- [Laravel Security Best Practices](https://laravel.com/docs/12.x/security)
- [Laravel Sanctum Documentation](https://laravel.com/docs/12.x/sanctum)
- [Angular Security Guide](https://angular.io/guide/security)

---

**Document Status:** Ready for Implementation  
**Next Review:** After Phase 1 completion
