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

        /** @var array{count: int, first_attempt: int, locked_at?: int, lockout_duration?: int} $attempts */
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

        // Treat 401 and auth-failure 422s as failed attempts
        $isFailed = $response->getStatusCode() === 401
            || ($response->getStatusCode() === 422 && str_contains((string) $response->getContent(), 'auth.failed'));

        if ($isFailed) {
            $attempts['count'] = ($attempts['count'] ?? 0) + 1;

            if ($attempts['count'] >= self::MAX_ATTEMPTS) {
                $attempts['locked_at'] = time();
                $attempts['lockout_duration'] = $this->calculateLockoutDuration($attempts['count']);
            }

            Cache::put($key, $attempts, now()->addHours(1));

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
        if ($response->getStatusCode() === 200 || $response->getStatusCode() === 201) {
            Cache::forget($key);
        }

        return $response;
    }

    /**
     * Resolve the request signature for rate limiting (hashed email + IP).
     */
    protected function resolveRequestSignature(Request $request): string
    {
        $email = $request->input('email', '');
        $code = $request->input('code', '');
        $ip = $request->ip();

        $identifier = $email ?: $code;

        return 'rate_limit:'.($identifier ? hash('sha256', strtolower((string) $identifier)).':' : '').$ip;
    }

    /**
     * Calculate the lockout duration based on attempt count.
     */
    protected function calculateLockoutDuration(int $attempts): int
    {
        if ($attempts <= 5) {
            return 60;
        } elseif ($attempts <= 6) {
            return 300;
        }

        return self::LOCKOUT_DURATION;
    }

    /**
     * Calculate exponential backoff delay in seconds, capped at 5 minutes.
     */
    protected function calculateBackoffDelay(int $attempts): int
    {
        $baseDelay = 30;
        $delay = (int) ($baseDelay * pow(self::BACKOFF_BASE, min($attempts - self::MAX_ATTEMPTS, 3)));

        return min($delay, 300);
    }

    /**
     * Check if the request signature is currently locked out.
     *
     * @param  array{count: int, first_attempt: int, locked_at?: int, lockout_duration?: int}  $attempts
     */
    protected function isLockedOut(array $attempts): bool
    {
        if (! isset($attempts['locked_at'])) {
            return false;
        }

        $lockoutDuration = $attempts['lockout_duration'] ?? self::LOCKOUT_DURATION;

        return (time() - $attempts['locked_at']) < $lockoutDuration;
    }

    /**
     * Get remaining lockout time in seconds.
     *
     * @param  array{count: int, first_attempt: int, locked_at?: int, lockout_duration?: int}  $attempts
     */
    protected function getLockoutTime(array $attempts): int
    {
        if (! isset($attempts['locked_at'])) {
            return 0;
        }

        $lockoutDuration = $attempts['lockout_duration'] ?? self::LOCKOUT_DURATION;

        return max(0, $lockoutDuration - (time() - $attempts['locked_at']));
    }
}
