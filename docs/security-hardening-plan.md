# Security Hardening Plan: Signup and Login Forms

## Laravel 12 Backend + Angular 21 Frontend

---

## Executive Summary

This document outlines a comprehensive, phased security hardening plan for the authentication forms (signup and login) in the ServeTrack volunteer management system. The plan addresses both the Laravel 12 backend and Angular 21 frontend, with particular emphasis on authentication middleware improvements.

**Current Security Posture Assessment:**

- Backend has foundational security: rate limiting (5 attempts/minute), Laravel Password defaults, email validation, session regeneration, Sanctum tokens, basic security headers, and audit logging
- Frontend has basic form validation with password strength requirements
- Critical gaps exist in several areas requiring immediate attention

**Key Gaps Identified:**

| Area | Gap Severity | Priority |
|------|--------------|----------|
| Token Storage | SessionStorage exposes tokens to XSS | Critical |
| Rate Limiting | Single-factor only; no exponential backoff | High |
| Password Policy | Minimum 8 chars insufficient for 2026 standards | High |
| Account Lockout | No lockout after repeated failures | High |
| Session Configuration | HttpOnly/Secure cookies not enforced | High |
| Security Headers | Missing CSP, HSTS | Medium |
| MFA/2FA | Not implemented | Medium |
| Compromised Passwords | No breach checking | Medium |

**Recommended Timeline:**

- Phase 1 (Immediate - 2 weeks): Critical vulnerabilities
- Phase 2 (1-2 months): High-impact hardening
- Phase 3 (2-3 months): Advanced security features

---

## Priority Matrix

### High Priority (Implement in Phase 1)

| Improvement | Impact | Effort | Files Affected |
|-------------|--------|--------|----------------|
| Switch to HttpOnly cookies for token storage | Critical | Medium | auth.service.ts, LoginController.php, api.php |
| Enforce secure session cookies | Critical | Low | session.php, bootstrap/app.php |
| Implement exponential backoff rate limiting | High | Medium | LoginRequest.php, RateLimitMiddleware.php |
| Strengthen password policy to 12+ chars | High | Low | RegisterRequest.php, password.validator.ts |
| Add account lockout mechanism | High | Medium | User model, LoginRequest.php |
| Add CSRF protection for API | High | Low | api.php, auth.service.ts |

### Medium Priority (Implement in Phase 2)

| Improvement | Impact | Effort | Files Affected |
|-------------|--------|--------|----------------|
| Add Content Security Policy (CSP) header | Medium | Medium | SecurityHeaders.php |
| Implement HSTS header | Medium | Low | SecurityHeaders.php |
| Add compromised password checking | Medium | Medium | RegisterRequest.php, password.validator.ts |
| Enhance audit logging with more context | Medium | Low | SecurityAudit.php |
| Add request input sanitization | Medium | Low | LoginRequest.php, RegisterRequest.php |
| Add email enumeration prevention | Medium | Low | LoginController.php, RegisterController.php |

### Lower Priority (Implement in Phase 3)

| Improvement | Impact | Effort | Files Affected |
|-------------|--------|--------|----------------|
| Implement 2FA/MFA | Medium | High | New controllers, User model, frontend forms |
| Add biometric authentication support | Low | High | Frontend services, backend |
| Implement login history/activity tracking | Low | Medium | User model, SecurityAudit.php |
| Add suspicious activity detection | Medium | High | New middleware, ML models |

---

## Phase 1: Critical Security Improvements (Weeks 1-2)

### 1.1 Switch to HttpOnly Secure Cookies for Token Storage

**Rationale:** SessionStorage is accessible via JavaScript, making tokens vulnerable to XSS attacks. HttpOnly cookies cannot be accessed by client-side scripts.

**Backend Changes:**

**File:** `servetrack-backend/config/sanctum.php`

```php
<?php

return [
    'stateful' => explode(',', env('SANCTUM_STATEFUL_DOMAINS', sprintf(
        '%s%s',
        'localhost:5173,localhost:4200,127.0.0.1:5173,127.0.0.1:4200',
        env('SANCTUM_STATEFUL_DOMAINS') ? ',' . env('SANCTUM_STATEFUL_DOMAINS') : ''
    ))),

    'guard' => ['web'],

    'expiration' => env('SANCTUM_EXPIRATION', 60),

    'token_prefix' => env('SANCTUM_TOKEN_PREFIX', ''),

    'middleware' => [
        'authenticate_session' => Laravel\Sanctum\Http\Middleware\AuthenticateSession::class,
        'encrypt_cookies' => Illuminate\Cookie\Middleware\EncryptCookies::class,
        'validate_csrf_token' => Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class,
    ],
];
```

**File:** `servetrack-backend/config/session.php` (Update existing config)

```php
// Change these settings:
'secure' => env('SESSION_SECURE_COOKIE', true),  // Changed from null to true

'http_only' => env('SESSION_HTTP_ONLY', true),  // Already true, verify

'same_site' => env('SESSION_SAME_SITE', 'strict'),  // Changed from 'lax' to 'strict'
```

**File:** `servetrack-backend/app/Http/Controllers/Auth/LoginController.php`

```php
<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Cookie;

class LoginController extends Controller
{
    /**
     * Handle an incoming authentication request.
     */
    public function store(LoginRequest $request): JsonResponse
    {
        $request->authenticate();

        if ($request->hasSession()) {
            $request->session()->regenerate();
        }

        $user = $request->user();
        $token = $user->createToken('auth-token', ['*'], now()->addMinutes(60))->plainTextToken;

        $cookie = cookie(
            'auth_token',
            $token,
            config('sanctum.expiration', 60),
            '/',
            null,
            true,  // secure
            true,  // httpOnly
            false,
            'strict'
        );

        return response()->json([
            'user' => $user,
        ])->withCookie($cookie);
    }

    /**
     * Destroy an authenticated session.
     */
    public function destroy(Request $request): Response
    {
        // Delete all tokens for this user (or specific token)
        $request->user()->tokens()->delete();

        Auth::guard('web')->logout();

        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        $cookie = cookie('auth_token', '', -1);

        return response()->noContent()->withCookie($cookie);
    }
}
```

**File:** `servetrack-backend/app/Http/Controllers/Auth/RegisterController.php`

```php
<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\RegisterRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Cookie;

class RegisterController extends Controller
{
    /**
     * Handle an incoming registration request.
     */
    public function store(RegisterRequest $request): JsonResponse
    {
        $user = User::create($request->validated());

        $token = $user->createToken('auth-token', ['*'], now()->addMinutes(60))->plainTextToken;

        Log::channel('security')->info('New user registration', [
            'user_id' => $user->id,
            'email' => $user->email,
            'ip' => $request->ip(),
        ]);

        $cookie = cookie(
            'auth_token',
            $token,
            config('sanctum.expiration', 60),
            '/',
            null,
            true,
            true,
            false,
            'strict'
        );

        return response()->json([
            'user' => $user,
        ], 201)->withCookie($cookie);
    }
}
```

**Frontend Changes:**

**File:** `servetrack-frontend/src/app/services/auth.service.ts`

```typescript
import { Injectable, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, tap, of } from 'rxjs';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  email: string;
  password: string;
  confirmPassword: string;
  name?: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  user?: {
    id: string;
    email: string;
    name?: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private router = inject(Router);
  private http = inject(HttpClient);
  private apiUrl = '/api';

  // State signals
  isAuthenticated = signal(false);
  currentUser = signal<AuthResponse['user'] | null>(null);
  isLoading = signal(false);
  error = signal<string | null>(null);

  /**
   * Login user with credentials
   */
  login(credentials: LoginCredentials): Observable<AuthResponse> {
    this.isLoading.set(true);
    this.error.set(null);

    return this.http.post<any>(`${this.apiUrl}/login`, credentials, {
      withCredentials: true,  // Important: enables cookie transmission
    }).pipe(
      tap((response) => {
        if (response.user) {
          this.isAuthenticated.set(true);
          this.currentUser.set(response.user);
          
          console.log('Login successful', {
            email: credentials.email,
          });
        }
      }),
      catchError((error: HttpErrorResponse) => {
        const errorMessage = error.error?.message || 'Login failed';
        this.error.set(errorMessage);
        
        return of({
          success: false,
          message: errorMessage,
        });
      }),
      tap(() => {
        this.isLoading.set(false);
      })
    );
  }

  /**
   * Register new user
   */
  signup(data: SignupData): Observable<AuthResponse> {
    this.isLoading.set(true);
    this.error.set(null);

    return this.http.post<any>(`${this.apiUrl}/register`, {
      name: data.name || data.email.split('@')[0],
      email: data.email,
      password: data.password,
      password_confirmation: data.confirmPassword,
    }, {
      withCredentials: true,
    }).pipe(
      tap((response) => {
        if (response.user) {
          this.isAuthenticated.set(true);
          this.currentUser.set(response.user);
          
          console.log('Signup successful', {
            email: data.email,
          });
        }
      }),
      catchError((error: HttpErrorResponse) => {
        const errorMessage = error.error?.message || 'Signup failed';
        this.error.set(errorMessage);
        
        return of({
          success: false,
          message: errorMessage,
        });
      }),
      tap(() => {
        this.isLoading.set(false);
      })
    );
  }

  /**
   * Logout current user
   */
  logout(): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/logout`, {}, {
      withCredentials: true,
    }).pipe(
      tap(() => {
        this.isAuthenticated.set(false);
        this.currentUser.set(null);
        this.router.navigate(['/login']);
      }),
      catchError(() => {
        // Clear local state even if API call fails
        this.isAuthenticated.set(false);
        this.currentUser.set(null);
        this.router.navigate(['/login']);
        return of(undefined);
      })
    );
  }

  /**
   * Check if user is authenticated
   */
  checkAuthStatus(): Observable<AuthResponse> {
    return this.http.get<any>(`${this.apiUrl}/user`, {
      withCredentials: true,
    }).pipe(
      tap((response) => {
        this.isAuthenticated.set(true);
        this.currentUser.set(response);
      }),
      catchError(() => {
        this.isAuthenticated.set(false);
        this.currentUser.set(null);
        return of({ success: false });
      })
    );
  }
}
```

**Testing Recommendations:**

1. Verify cookie is set with HttpOnly and Secure flags using browser DevTools
2. Confirm JavaScript cannot access the auth_token cookie
3. Test logout properly clears the cookie
4. Verify withCredentials works across requests
5. Test authentication persists after browser restart (cookie-based)

---

### 1.2 Implement Exponential Backoff Rate Limiting

**Rationale:** The current 5 attempts/minute can be bypassed by distributed attacks. Exponential backoff increases delays progressively.

**File:** `servetrack-backend/app/Http/Middleware/AdvancedRateLimit.php` (New file)

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class AdvancedRateLimit
{
    private const MAX_ATTEMPTS = 5;
    private const LOCKOUT_DURATION = 900; // 15 minutes
    private const BACKOFF_BASE = 2; // Exponential base

    /**
     * Handle an incoming request with exponential backoff rate limiting.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $key = $this->resolveRequestSignature($request);
        
        $attempts = Cache::get($key, ['count' => 0, 'first_attempt' => time()]);
        
        if ($this->isLockedOut($attempts)) {
            $lockoutTime = $this->getLockoutTime($attempts);
            
            Log::channel('security')->warning('Account locked out due to multiple failed attempts', [
                'key' => $key,
                'attempts' => $attempts['count'],
                'lockout_seconds_remaining' => $lockoutTime,
            ]);

            return response()->json([
                'message' => 'Too many login attempts. Please try again later.',
                'locked' => true,
                'retry_after' => $lockoutTime,
            ], 429)->header('Retry-After', $lockoutTime);
        }

        $response = $next($request);

        // Check if authentication failed (401 or 422 with auth failure message)
        if ($response->getStatusCode() === 401 || 
            ($response->getStatusCode() === 422 && str_contains($response->getContent(), 'auth.failed'))) {
            
            $attempts['count'] = ($attempts['count'] ?? 0) + 1;
            
            if ($attempts['count'] >= self::MAX_ATTEMPTS) {
                $attempts['locked_at'] = time();
                $lockoutDuration = $this->calculateLockoutDuration($attempts['count']);
                $attempts['lockout_duration'] = $lockoutDuration;
            }
            
            Cache::put($key, $attempts, now()->addHours(1));
            
            // Calculate backoff delay for response header
            $delay = $this->calculateBackoffDelay($attempts['count']);
            
            Log::channel('security')->warning('Failed login attempt', [
                'key' => $key,
                'attempt_number' => $attempts['count'],
                'delay_seconds' => $delay,
            ]);

            return response()->json([
                'message' => 'Invalid credentials',
                'attempts_remaining' => max(0, self::MAX_ATTEMPTS - $attempts['count']),
                'retry_after' => $delay,
            ], 429)->header('Retry-After', $delay);
        }

        // Clear rate limit on successful authentication
        if ($response->getStatusCode() === 200) {
            Cache::forget($key);
        }

        return $response;
    }

    /**
     * Resolve the request signature for rate limiting.
     */
    protected function resolveRequestSignature(Request $request): string
    {
        $email = $request->input('email', '');
        $ip = $request->ip();
        
        return 'rate_limit:' . ($email ? md5(strtolower($email)) . ':' : '') . $ip;
    }

    /**
     * Calculate the lockout duration based on attempt count.
     */
    protected function calculateLockoutDuration(int $attempts): int
    {
        // Exponential backoff: 1 minute for 5 attempts, 5 minutes for 6, 15 minutes for 7+
        if ($attempts <= 5) {
            return 60;
        } elseif ($attempts <= 6) {
            return 300;
        }
        
        return self::LOCKOUT_DURATION;
    }

    /**
     * Calculate backoff delay in seconds.
     */
    protected function calculateBackoffDelay(int $attempts): int
    {
        $baseDelay = 30; // Start with 30 second delay
        $delay = $baseDelay * pow(self::BACKOFF_BASE, min($attempts - self::MAX_ATTEMPTS, 3));
        
        return min($delay, 300); // Cap at 5 minutes
    }

    /**
     * Check if the user is currently locked out.
     */
    protected function isLockedOut(array $attempts): bool
    {
        if (!isset($attempts['locked_at'])) {
            return false;
        }

        $lockoutDuration = $attempts['lockout_duration'] ?? self::LOCKOUT_DURATION;
        $lockedAt = $attempts['locked_at'];
        
        return (time() - $lockedAt) < $lockoutDuration;
    }

    /**
     * Get remaining lockout time in seconds.
     */
    protected function getLockoutTime(array $attempts): int
    {
        if (!isset($attempts['locked_at'])) {
            return 0;
        }

        $lockoutDuration = $attempts['lockout_duration'] ?? self::LOCKOUT_DURATION;
        $lockedAt = $attempts['locked_at'];
        
        return max(0, $lockoutDuration - (time() - $lockedAt));
    }
}
```

**File:** `servetrack-backend/app/Http/Requests/Auth/LoginRequest.php` (Update existing)

```php
<?php

namespace App\Http\Requests\Auth;

use Illuminate\Auth\Events\Lockout;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LoginRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'lowercase', 'email:rfc,dns'],
            'password' => ['required', 'string'],
        ];
    }

    /**
     * Configure the validator instance.
     */
    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            if ($validator->errors()->any()) {
                return;
            }

            // Additional sanitization
            $email = filter_var($this->input('email'), FILTER_SANITIZE_EMAIL);
            $this->merge(['email' => $email]);
        });
    }

    /**
     * Attempt to authenticate the request's credentials.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function authenticate(): void
    {
        $this->ensureIsNotRateLimited();

        $credentials = $this->only('email', 'password');
        
        if (! Auth::attempt($credentials, $this->boolean('remember'))) {
            RateLimiter::hit($this->throttleKey(), 60); // 1 minute decay

            throw ValidationException::withMessages([
                'email' => __('auth.failed'),
            ]);
        }

        RateLimiter::clear($this->throttleKey());
    }

    /**
     * Ensure the login request is not rate limited.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function ensureIsNotRateLimited(): void
    {
        $maxAttempts = 5;
        
        if (! RateLimiter::tooManyAttempts($this->throttleKey(), $maxAttempts)) {
            return;
        }

        event(new Lockout($this));

        $seconds = RateLimiter::availableIn($this->throttleKey());
        $retryAfter = max($seconds, 60); // Minimum 60 second wait

        $headers = [
            'Retry-After' => $retryAfter,
            'X-RateLimit-Limit' => $maxAttempts,
            'X-RateLimit-Remaining' => 0,
            'X-RateLimit-Reset' => time() + $seconds,
        ];

        throw ValidationException::withMessages([
            'email' => __('auth.throttle', [
                'seconds' => $seconds,
                'minutes' => ceil($seconds / 60),
            ]),
        ])->withHeaders($headers);
    }

    /**
     * Get the rate limiting throttle key for the request.
     */
    public function throttleKey(): string
    {
        // Combine email and IP for more accurate limiting
        $email = Str::lower(Str::transliterate($this->string('email')));
        return 'login:' . $email . '|' . $this->ip();
    }
}
```

**File:** `servetrack-backend/bootstrap/app.php` (Update middleware registration)

```php
<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'guest' => \App\Http\Middleware\RedirectIfAuthenticated::class,
            'security.audit' => \App\Http\Middleware\SecurityAudit::class,
            'rate.limit' => \App\Http\Middleware\AdvancedRateLimit::class,
        ]);

        $middleware->api(prepend: [
            \Illuminate\Http\Middleware\HandleCors::class,
        ]);
        $middleware->web(append: [
            \App\Http\Middleware\SecurityHeaders::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
```

**File:** `servetrack-backend/routes/api.php` (Update routes)

```php
<?php

use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\RegisterController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Guest-only routes - use custom rate limiter
Route::middleware(['guest', 'security.audit', 'rate.limit'])->group(function (): void {
    Route::post('/login', [LoginController::class, 'store']);
    Route::post('/register', [RegisterController::class, 'store']);
});

// Auth-required routes
Route::middleware('auth:sanctum')->group(function (): void {
    Route::post('/logout', [LoginController::class, 'destroy']);
    Route::get('/user', fn (Request $request) => $request->user());
});
```

**Testing Recommendations:**

1. Test 5 failed attempts triggers lockout
2. Verify exponential backoff delay increases with subsequent failures
3. Confirm successful login clears rate limit
4. Test with different IPs to ensure IP-based limiting works
5. Verify Retry-After headers are present in 429 responses

---

### 1.3 Strengthen Password Policy

**Rationale:** 8-character passwords are insufficient for 2026 security standards. NIST recommends 12+ characters with optional complexity.

**File:** `servetrack-backend/app/Http/Requests/Auth/RegisterRequest.php`

```php
<?php

namespace App\Http\Requests\Auth;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class RegisterRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'required', 
                'string', 
                'lowercase', 
                'email:rfc,dns', 
                'max:255', 
                'unique:'.User::class
            ],
            'password' => [
                'required', 
                'confirmed', 
                Password::min(12)
                    ->mixedCase()
                    ->numbers()
                    ->symbols()
                    ->uncompromised(3), // Check against 3+ breaches
            ],
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'password.uncompromised' => 'This password has been found in a data breach. Please choose a different, more secure password.',
            'password.min' => 'Password must be at least 12 characters long.',
            'password.mixedCase' => 'Password must contain both uppercase and lowercase letters.',
            'password.numbers' => 'Password must contain at least one number.',
            'password.symbols' => 'Password must contain at least one special character.',
        ];
    }
}
```

**File:** `servetrack-frontend/src/app/validators/password.validator.ts`

```typescript
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Custom validator for password strength
 * Requires:
 * - Minimum 12 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 * - Not a compromised password (checked on backend)
 */
export function passwordStrengthValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;

    if (!value) {
      return null; // Let 'required' validator handle empty values
    }

    const errors: ValidationErrors = {};

    if (value.length < 12) {
      errors['minLength'] = { requiredLength: 12, actualLength: value.length };
    }

    if (value.length > 128) {
      errors['maxLength'] = { maxLength: 128, actualLength: value.length };
    }

    if (!/[A-Z]/.test(value)) {
      errors['requiresUppercase'] = true;
    }

    if (!/[a-z]/.test(value)) {
      errors['requiresLowercase'] = true;
    }

    if (!/[0-9]/.test(value)) {
      errors['requiresNumber'] = true;
    }

    if (!/[^A-Za-z0-9]/.test(value)) {
      errors['requiresSpecialChar'] = true;
    }

    // Check for common patterns
    if (/^(password|123456|qwerty|admin)/i.test(value)) {
      errors['commonPattern'] = true;
    }

    // Check for sequential characters
    if (/(.)\1{2,}/.test(value)) {
      errors['repeatedChars'] = true;
    }

    return Object.keys(errors).length > 0 ? errors : null;
  };
}

/**
 * Custom validator to check if password and confirm password match
 */
export function passwordMatchValidator(
  passwordField: string = 'password',
  confirmPasswordField: string = 'confirmPassword'
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const password = control.get(passwordField);
    const confirmPassword = control.get(confirmPasswordField);

    if (!password || !confirmPassword) {
      return null;
    }

    if (password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ ...confirmPassword.errors, passwordMismatch: true });
      return { passwordMismatch: true };
    } else {
      // Remove passwordMismatch error if passwords now match
      if (confirmPassword.hasError('passwordMismatch')) {
        const errors = { ...confirmPassword.errors };
        delete errors['passwordMismatch'];
        confirmPassword.setErrors(Object.keys(errors).length > 0 ? errors : null);
      }
    }

    return null;
  };
}
```

**File:** `servetrack-frontend/src/app/auth/signup/signup.ts` (Update password requirements display)

```typescript
/**
 * Get password strength requirements status
 */
getPasswordRequirements(): {
  label: string;
  met: boolean;
}[] {
  const password = this.passwordControl?.value || '';
  
  return [
    { label: 'At least 12 characters', met: password.length >= 12 },
    { label: 'One uppercase letter (A-Z)', met: /[A-Z]/.test(password) },
    { label: 'One lowercase letter (a-z)', met: /[a-z]/.test(password) },
    { label: 'One number (0-9)', met: /[0-9]/.test(password) },
    { label: 'One special character (!@#$%^&*)', met: /[^A-Za-z0-9]/.test(password) },
    { label: 'No repeated characters (aaa)', met: !/(.)\1{2,}/.test(password) },
  ];
}
```

**File:** `servetrack-frontend/src/app/auth/signup/signup.ts` (Update error messages)

```typescript
/**
 * Get error message for a specific form control
 */
getErrorMessage(controlName: string): string {
  const control = this.signupForm.get(controlName);
  if (!control || !control.errors || !control.touched) {
    return '';
  }

  const errors = control.errors;
  
  // Email errors
  if (controlName === 'email') {
    if (errors['required']) return 'Email is required';
    if (errors['email']) return 'Please enter a valid email address';
  }

  // Password errors
  if (controlName === 'password') {
    if (errors['required']) return 'Password is required';
    if (errors['minLength']) return 'Password must be at least 12 characters';
    if (errors['maxLength']) return 'Password is too long (max 128 characters)';
    if (errors['requiresUppercase']) return 'Password must contain an uppercase letter';
    if (errors['requiresLowercase']) return 'Password must contain a lowercase letter';
    if (errors['requiresNumber']) return 'Password must contain a number';
    if (errors['requiresSpecialChar']) return 'Password must contain a special character';
    if (errors['commonPattern']) return 'Password cannot start with common words like "password"';
    if (errors['repeatedChars']) return 'Password cannot have 3 or more repeated characters';
  }

  // Confirm password errors
  if (controlName === 'confirmPassword') {
    if (errors['required']) return 'Please confirm your password';
    if (errors['passwordMismatch']) return 'Passwords do not match';
  }

  // Terms errors
  if (controlName === 'agreeToTerms') {
    if (errors['required']) return 'You must agree to the terms';
  }

  return '';
}
```

**Testing Recommendations:**

1. Test passwords with exactly 12 characters pass
2. Verify passwords with 11 characters fail
3. Test all complexity requirements independently
4. Verify compromised password detection works
5. Test frontend displays correct error messages

---

### 1.4 Add Account Lockout Mechanism

**File:** `servetrack-backend/database/migrations/2026_02_28_000001_add_lockout_fields_to_users_table.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('locked_until')->nullable()->after('password');
            $table->unsignedInteger('failed_attempts')->default(0)->after('locked_until');
            $table->timestamp('last_failed_at')->nullable()->after('failed_attempts');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['locked_until', 'failed_attempts', 'last_failed_at']);
        });
    }
};
```

**File:** `servetrack-backend/app/Models/User.php` (Add lockout methods)

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'locked_until' => 'datetime',
        ];
    }

    /**
     * Check if the user account is locked.
     */
    public function isLockedOut(): bool
    {
        return $this->locked_until !== null && 
               $this->locked_until->isFuture();
    }

    /**
     * Lock the user account for a specified duration.
     */
    public function lockOut(int $minutes = 15): void
    {
        $this->update([
            'locked_until' => now()->addMinutes($minutes),
        ]);
    }

    /**
     * Unlock the user account.
     */
    public function unlock(): void
    {
        $this->update([
            'locked_until' => null,
            'failed_attempts' => 0,
            'last_failed_at' => null,
        ]);
    }

    /**
     * Record a failed login attempt.
     */
    public function recordFailedAttempt(): void
    {
        $attempts = $this->failed_attempts + 1;
        
        // Lock after 5 failed attempts
        $lockoutMinutes = match(true) {
            $attempts >= 10 => 60,
            $attempts >= 7 => 30,
            $attempts >= 5 => 15,
            default => 0,
        };

        $this->update([
            'failed_attempts' => $attempts,
            'last_failed_at' => now(),
            'locked_until' => $lockoutMinutes > 0 ? now()->addMinutes($lockoutMinutes) : null,
        ]);
    }

    /**
     * Reset failed login attempts on successful login.
     */
    public function resetFailedAttempts(): void
    {
        $this->update([
            'failed_attempts' => 0,
            'last_failed_at' => null,
        ]);
    }
}
```

**File:** `servetrack-backend/app/Http/Requests/Auth/LoginRequest.php` (Update to check lockout)

```php
// Add to the authenticate() method, after rate limiting check:

public function authenticate(): void
{
    $this->ensureIsNotRateLimited();

    // Check if account is locked
    $user = $this->getUserForAuthentication();
    
    if ($user && $user->isLockedOut()) {
        $seconds = now()->diffInSeconds($user->locked_until);
        
        throw ValidationException::withMessages([
            'email' => __('auth.locked', [
                'minutes' => ceil($seconds / 60),
            ]),
        ])->withHeaders(['Retry-After' => $seconds]);
    }

    if (! Auth::attempt($this->only('email', 'password'), $this->boolean('remember'))) {
        // Record failed attempt
        if ($user) {
            $user->recordFailedAttempt();
        }
        
        RateLimiter::hit($this->throttleKey());

        throw ValidationException::withMessages([
            'email' => __('auth.failed'),
        ]);
    }

    // Reset failed attempts on success
    $user?->resetFailedAttempts();
    
    RateLimiter::clear($this->throttleKey());
}

/**
 * Get user model for authentication checks.
 */
protected function getUserForAuthentication(): ?User
{
    return User::where('email', Str::lower($this->string('email')))->first();
}
```

**Testing Recommendations:**

1. Test account locks after 5 failed attempts
2. Verify lockout duration increases with repeated failures
3. Test successful login unlocks account
4. Verify locked accounts cannot authenticate
5. Test lockout expiry works correctly

---

### 1.5 Add CSRF Protection for API

**File:** `servetrack-backend/routes/api.php`

```php
<?php

use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\RegisterController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Generate CSRF cookie for SPA
Route::get('/csrf-cookie', function () {
    return response()->json(['message' => 'CSRF cookie set']);
})->middleware('web');

// Guest-only routes
Route::middleware(['web', 'guest', 'security.audit', 'rate.limit'])->group(function (): void {
    Route::post('/login', [LoginController::class, 'store']);
    Route::post('/register', [RegisterController::class, 'store']);
});

// Auth-required routes
Route::middleware(['web', 'auth:sanctum'])->group(function (): void {
    Route::post('/logout', [LoginController::class, 'destroy']);
    Route::get('/user', fn (Request $request) => $request->user());
});
```

**File:** `servetrack-frontend/src/app/app.config.ts`

```typescript
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideClientHydration } from '@angular/platform-browser';

import { routes } from './app.routes';
import { csrfInterceptor } from './interceptors/csrf.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([csrfInterceptor])),
    provideClientHydration(),
  ]
};
```

**File:** `servetrack-frontend/src/app/interceptors/csrf.interceptor.ts` (New file)

```typescript
import { HttpInterceptorFn } from '@angular/common/http';

export const csrfInterceptor: HttpInterceptorFn = (req, next) => {
  // Only add CSRF token to stateful (non-GET) requests
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const csrfToken = getCsrfToken();
    
    if (csrfToken) {
      req = req.clone({
        setHeaders: {
          'X-XSRF-TOKEN': csrfToken,
        },
      });
    }
  }
  
  return next(req);
};

function getCsrfToken(): string | null {
  // Laravel stores CSRF token in 'XSRF-TOKEN' cookie
  const name = 'XSRF-TOKEN';
  const cookies = document.cookie.split(';');
  
  for (let cookie of cookies) {
    cookie = cookie.trim();
    if (cookie.startsWith(name + '=')) {
      return decodeURIComponent(cookie.substring(name.length + 1));
    }
  }
  
  return null;
}
```

**Testing Recommendations:**

1. Verify XSRF-TOKEN cookie is set after initial load
2. Test POST requests include X-XSRF-TOKEN header
3. Verify requests without CSRF token are rejected
4. Test CSRF token rotation works

---

## Phase 2: High-Impact Hardening (Months 1-2)

### 2.1 Add Content Security Policy (CSP) Header

**File:** `servetrack-backend/app/Http/Middleware/SecurityHeaders.php`

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SecurityHeaders
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        // Basic security headers
        $response->headers->set('X-Frame-Options', 'SAMEORIGIN');
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-XSS-Protection', '1; mode=block');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');

        // Content Security Policy
        $csp = $this->buildCSP($request);
        $response->headers->set('Content-Security-Policy', $csp);

        // HSTS (only on HTTPS)
        if ($request->isSecure()) {
            $response->headers->set(
                'Strict-Transport-Security',
                'max-age=31536000; includeSubDomains; preload'
            );
        }

        // Permissions Policy
        $response->headers->set(
            'Permissions-Policy',
            'geolocation=(), microphone=(), camera=(), payment=()'
        );

        return $response;
    }

    /**
     * Build Content Security Policy based on environment.
     */
    protected function buildCSP(Request $request): string
    {
        $isLocal = in_array($request->getHost(), ['localhost', '127.0.0.1']);
        
        $directives = [
            "default-src" => "'self'",
            "script-src" => $isLocal 
                ? "'self' 'unsafe-inline' 'unsafe-eval'"
                : "'self'",
            "style-src" => $isLocal
                ? "'self' 'unsafe-inline'"
                : "'self' 'unsafe-inline'", // Required for Tailwind
            "img-src" => "'self' data: https:",
            "font-src" => "'self' data:",
            "connect-src" => "'self'",
            "frame-ancestors" => "'none'",
            "form-action" => "'self'",
            "base-uri" => "'self'",
            "upgrade-insecure-requests" => "",
        ];

        $csp = [];
        
        foreach ($directives as $directive => $value) {
            if (empty($value)) {
                $csp[] = $directive;
            } else {
                $csp[] = "{$directive} {$value}";
            }
        }

        return implode('; ', $csp);
    }
}
```

**Testing Recommendations:**

1. Verify CSP header is present in all responses
2. Test inline scripts are blocked in production
3. Verify external resource loading is restricted
4. Test HSTS header on HTTPS requests

---

### 2.2 Add Compromised Password Checking

**File:** `servetrack-backend/app/Providers/AppServiceProvider.php`

```php
<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Customize default password rules
        Password::defaults(function () {
            return Password::min(12)
                ->mixedCase()
                ->numbers()
                ->symbols()
                ->uncompromised(3);
        });
    }
}
```

**Note:** The `uncompromised()` rule uses the HaveIBeenPwned API via Laravel's built-in integration.

**Testing Recommendations:**

1. Test common compromised passwords are rejected
2. Verify API integration works correctly
3. Test performance impact is acceptable

---

### 2.3 Enhance Audit Logging

**File:** `servetrack-backend/app/Http/Middleware/SecurityAudit.php`

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class SecurityAudit
{
    /**
     * Sensitive fields to never log.
     */
    private const SENSITIVE_FIELDS = [
        'password',
        'password_confirmation',
        'token',
        'secret',
        'api_key',
        'credit_card',
    ];

    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $this->logSecurityEvent($request, $response);

        return $response;
    }

    /**
     * Log security-relevant events.
     */
    protected function logSecurityEvent(Request $request, Response $response): void
    {
        $isAuthRoute = $this->isAuthRoute($request);
        
        if (!$isAuthRoute && $response->getStatusCode() < 400) {
            return;
        }

        $context = $this->buildContext($request, $response);

        $logChannel = ($response->getStatusCode() >= 400 || $this->isFailedAuth($response))
            ? 'security'
            : 'single';

        $level = $this->determineLogLevel($response);

        Log::channel($logChannel)->{$level}('Security audit event', $context);
    }

    /**
     * Check if this is an authentication route.
     */
    protected function isAuthRoute(Request $request): bool
    {
        $path = $request->path();
        return in_array($path, ['api/login', 'api/register', 'login', 'register']);
    }

    /**
     * Check if this is a failed authentication attempt.
     */
    protected function isFailedAuth(Response $response): bool
    {
        return in_array($response->getStatusCode(), [401, 422, 429]);
    }

    /**
     * Determine the log level based on response.
     */
    protected function determineLogLevel(Response $response): string
    {
        return match (true) {
            $response->getStatusCode() === 429 => 'warning',
            $response->getStatusCode() === 401 => 'warning',
            $response->getStatusCode() === 419 => 'warning', // CSRF
            $response->getStatusCode() >= 500 => 'error',
            default => 'info',
        };
    }

    /**
     * Build the context array for logging.
     */
    protected function buildContext(Request $request, Response $response): array
    {
        $context = [
            'route' => $request->path(),
            'method' => $request->method(),
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'status' => $response->getStatusCode(),
            'timestamp' => now()->toIso8601String(),
        ];

        // Add user context if authenticated
        if ($user = $request->user()) {
            $context['user_id'] = $user->id;
            $context['user_email'] = $user->email;
        }

        // Add safe request parameters
        if ($this->isAuthRoute($request)) {
            $context['has_email'] = !empty($request->input('email'));
            
            // Don't log actual email for privacy - just indicate presence
            if ($response->getStatusCode() >= 200 && $response->getStatusCode() < 300) {
                $context['email'] = maskEmail($request->input('email'));
            }
        }

        // Add rate limit info if present
        if ($response->getStatusCode() === 429) {
            $context['rate_limited'] = true;
            $context['retry_after'] = $response->headers->get('Retry-After');
        }

        return $context;
    }
}

/**
 * Mask email for privacy-safe logging.
 */
function maskEmail(?string $email): string
{
    if (empty($email)) {
        return '';
    }

    [$local, $domain] = explode('@', $email);
    
    $maskedLocal = strlen($local) > 2
        ? $local[0] . str_repeat('*', strlen($local) - 2) . $local[-1]
        : $local;

    return $maskedLocal . '@' . $domain;
}
```

**Testing Recommendations:**

1. Verify sensitive fields are never logged
2. Test email masking works correctly
3. Check logs contain appropriate context
4. Verify log rotation is configured

---

### 2.4 Add Email Enumeration Prevention

**File:** `servetrack-backend/app/Http/Controllers/Auth/LoginController.php` (Add generic error messages)

```php
// Update the store method to use generic error messages
public function store(LoginRequest $request): JsonResponse
{
    try {
        $request->authenticate();
    } catch (ValidationException $e) {
        // Return generic message to prevent email enumeration
        return response()->json([
            'message' => 'Invalid credentials',
        ], 422)->withHeaders([
            'Cache-Control' => 'no-store, no-cache, must-revalidate',
            'Pragma' => 'no-cache',
        ]);
    }

    // ... rest of method
}
```

**File:** `servetrack-backend/app/Http/Controllers/Auth/RegisterController.php` (Add rate limiting to registration)

```php
public function store(RegisterRequest $request): JsonResponse
{
    // Check if email already exists but don't reveal this
    if (User::where('email', $request->input('email'))->exists()) {
        // Return success to prevent enumeration, but don't actually create
        // Or return a generic message
        return response()->json([
            'message' => 'Registration successful',
        ], 201);
    }

    // ... rest of method
}
```

**Testing Recommendations:**

1. Verify same error message for wrong email vs wrong password
2. Test timing attacks are mitigated
3. Verify registration doesn't reveal existing emails

---

## Phase 3: Advanced Security Features (Months 2-3) - NOT PLANNED

> **Note:** MFA/2FA implementation is not included in the current project scope. This phase can be revisited in the future when organizational requirements change.

### 3.1 Implement Two-Factor Authentication (SKIPPED)

~~**Database Changes:**~~

~~```php
php artisan make:migration add_2fa_fields_to_users_table
```~~

~~**Implementation:**~~

~~Use Laravel Fortify for 2FA implementation:~~

~~```bash
composer require laravel/fortify
php artisan vendor:publish --provider="Laravel\Fortify\FortifyServiceProvider"
```~~

Configure Fortify in `app/Providers/FortifyServiceProvider.php`:

```php
<?php

namespace App\Providers;

use App\Actions\Fortify\CreateNewUser;
use App\Actions\Fortify\ResetUserPassword;
use App\Actions\Fortify\UpdateUserPassword;
use App\Actions\Fortify\UpdateUserProfileInformation;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Laravel\Fortify\Fortify;

class FortifyServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        Fortify::createUsersUsing(CreateNewUser::class);
        Fortify::updateUserProfileInformationUsing(UpdateUserProfileInformation::class);
        Fortify::updateUserPasswordsUsing(UpdateUserPassword::class);
        Fortify::resetUserPasswordsUsing(ResetUserPassword::class);

        RateLimiter::for('login', function (Request $request) {
            $email = (string) $request->email;
            return Limit::perMinute(5)->by($email . $request->ip());
        });

        RateLimiter::for('two-factor', function (Request $request) {
            return Limit::perMinute(5)->by($request->session()->get('login.id'));
        });
    }
}
```

**Frontend 2FA Component:**

```typescript
// Two-factor verification component
@Component({
  selector: 'app-two-factor-verification',
  template: `
    <div class="two-factor-verification">
      <h2>Two-Factor Authentication</h2>
      <p>Enter the 6-digit code from your authenticator app</p>
      
      <form [formGroup]="verifyForm" (ngSubmit)="onVerify()">
        <input 
          type="text" 
          formControlName="code" 
          maxlength="6"
          placeholder="000000"
          class="code-input"
        />
        
        @if (verifyForm.get('code')?.hasError('required') && verifyForm.get('code')?.touched) {
          <p class="error">Code is required</p>
        }
        
        @if (verifyForm.get('code')?.hasError('pattern') && verifyForm.get('code')?.touched) {
          <p class="error">Code must be 6 digits</p>
        }
        
        <button type="submit" [disabled]="verifyForm.invalid || isLoading()">
          Verify
        </button>
      </form>
      
      <button (click)="useRecoveryCode()">Use recovery code</button>
    </div>
  `
})
export class TwoFactorVerification {
  verifyForm = new FormGroup({
    code: new FormControl('', [Validators.required, Validators.pattern(/^\d{6}$/)]),
  });
  
  useRecoveryCode(): void {
    // Show recovery code input
  }
}
```

**Testing Recommendations:**

1. Test 2FA setup flow end-to-end
2. Verify recovery codes work
3. Test 2FA is required after enabling
4. Verify rate limiting on 2FA verification

---

### 3.2 Implement Login Activity Tracking

**File:** `servetrack-backend/database/migrations/2026_02_28_000002_create_login_activities_table.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('login_activities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('ip_address', 45);
            $table->string('user_agent');
            $table->string('device_type')->nullable();
            $table->string('browser')->nullable();
            $table->string('platform')->nullable();
            $table->string('location')->nullable();
            $table->timestamp('login_at');
            $table->timestamp('logout_at')->nullable();
            $table->boolean('is_current')->default(false);
            
            $table->index(['user_id', 'login_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('login_activities');
    }
};
```

**Implementation:**

Add to `LoginController`:

```php
use App\Models\LoginActivity;

public function store(LoginRequest $request): JsonResponse
{
    $request->authenticate();
    
    // ... existing code ...

    // Log login activity
    LoginActivity::create([
        'user_id' => $user->id,
        'ip_address' => $request->ip(),
        'user_agent' => $request->userAgent(),
        'login_at' => now(),
        'is_current' => true,
    ]);

    // Mark previous activities as not current
    LoginActivity::where('user_id', $user->id)
        ->where('is_current', true)
        ->where('id', '!=', $activity->id)
        ->update(['is_current' => false]);

    // ... rest of method
}
```

---

## Security Checklist

### Pre-Implementation Verification

- [ ] Review current authentication flow
- [ ] Document all authentication endpoints
- [ ] Identify sensitive data handling
- [ ] Check current session configuration

### Phase 1 Verification

- [ ] Verify HttpOnly cookies work
- [ ] Confirm rate limiting blocks brute force
- [ ] Test password requirements enforced
- [ ] Verify account lockout works

### Phase 2 Verification

- [ ] Verify CSP doesn't break functionality
- [ ] Confirm HSTS is enabled
- [ ] Test compromised password detection
- [ ] Verify audit logs capture events

### Phase 3 Verification

- [ ] Test 2FA end-to-end
- [ ] Verify login history is recorded
- [ ] Test suspicious activity detection

---

## File Summary

### Files to Create

| File | Purpose |
|------|---------|
| `app/Http/Middleware/AdvancedRateLimit.php` | Exponential backoff rate limiting |
| `app/Http/Middleware/SecurityHeaders.php` (update) | CSP and HSTS headers |
| `app/Interceptors/csrf.interceptor.ts` | CSRF token handling |
| `app/Http/Middleware/SecurityAudit.php` (update) | Enhanced audit logging |

### Files to Modify

| File | Changes |
|------|---------|
| `config/sanctum.php` | Configure cookie-based auth |
| `config/session.php` | Secure cookie settings |
| `app/Http/Controllers/Auth/LoginController.php` | Cookie-based tokens, generic errors |
| `app/Http/Controllers/Auth/RegisterController.php` | Cookie-based tokens |
| `app/Http/Requests/Auth/LoginRequest.php` | Enhanced rate limiting, lockout check |
| `app/Http/Requests/Auth/RegisterRequest.php` | Stronger password policy |
| `app/Models/User.php` | Lockout methods |
| `routes/api.php` | CSRF middleware, rate limiter |
| `bootstrap/app.php` | Register new middleware |
| `app/services/auth.service.ts` | Cookie-based authentication |
| `app/validators/password.validator.ts` | 12-char minimum |
| `app/auth/signup/signup.ts` | Updated requirements display |
| `app/auth/login/login.ts` | Generic error messages |

### Database Migrations

| Migration | Purpose |
|-----------|---------|
| `add_lockout_fields_to_users_table.php` | Account lockout tracking |
| `add_2fa_fields_to_users_table.php` | 2FA support |
| `create_login_activities_table.php` | Login history |

---

## Testing Strategy

### Unit Tests

- Password validator tests
- Rate limiting logic tests
- Lockout calculation tests

### Feature Tests

- Login with valid/invalid credentials
- Rate limiting behavior
- Account lockout flow
- Password strength enforcement

### Integration Tests

- Full authentication flow
- Cookie-based session handling
- CSRF protection

### Security Tests

- Brute force protection verification
- XSS vulnerability scanning
- CSRF token validation
- CSP effectiveness testing

---

## Rollout Recommendations

1. **Staged Rollout:** Implement Phase 1 in staging first
2. **Feature Flags:** Use config flags to toggle new security features
3. **Monitoring:** Set up alerts for failed login spikes
4. **User Communication:** Notify users of password policy changes
5. **Rollback Plan:** Have quick rollback procedure for each change

---

*Document Version: 1.0*  
*Last Updated: February 28, 2026*  
*Next Review: Quarterly or after significant changes*
