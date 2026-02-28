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
     *
     * @var list<string>
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

        if (! $isAuthRoute && $response->getStatusCode() < 400) {
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
     * Determine the log level based on response status code.
     */
    protected function determineLogLevel(Response $response): string
    {
        return match (true) {
            $response->getStatusCode() === 429 => 'warning',
            $response->getStatusCode() === 401 => 'warning',
            $response->getStatusCode() === 419 => 'warning',
            $response->getStatusCode() >= 500 => 'error',
            default => 'info',
        };
    }

    /**
     * Build the context array for logging.
     *
     * @return array<string, mixed>
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

        if ($user = $request->user()) {
            $context['user_id'] = $user->id;
        }

        if ($this->isAuthRoute($request)) {
            $context['has_email'] = ! empty($request->input('email'));

            if ($response->getStatusCode() >= 200 && $response->getStatusCode() < 300) {
                $context['email'] = self::maskEmail($request->input('email'));
            }
        }

        if ($response->getStatusCode() === 429) {
            $context['rate_limited'] = true;
            $context['retry_after'] = $response->headers->get('Retry-After');

            $body = json_decode($response->getContent(), true);

            if (isset($body['attempts_remaining'])) {
                $context['attempts_remaining'] = $body['attempts_remaining'];
            }
        }

        return $context;
    }

    /**
     * Mask an email address for privacy-safe logging (e.g. u***r@example.com).
     */
    private static function maskEmail(?string $email): string
    {
        if (empty($email) || ! str_contains($email, '@')) {
            return '';
        }

        [$local, $domain] = explode('@', $email, 2);

        $maskedLocal = strlen($local) > 2
            ? $local[0].str_repeat('*', strlen($local) - 2).$local[-1]
            : $local;

        return $maskedLocal.'@'.$domain;
    }
}
