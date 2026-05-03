<?php

use App\Http\Middleware\AdvancedRateLimit;
use App\Http\Middleware\Authenticate;
use App\Http\Middleware\NormalizeEmail;
use App\Http\Middleware\RedirectIfAuthenticated;
use App\Http\Middleware\RoleMiddleware;
use App\Http\Middleware\SecurityAudit;
use App\Http\Middleware\SecurityHeaders;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\HandleCors;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'auth' => Authenticate::class,
            'guest' => RedirectIfAuthenticated::class,
            'security.audit' => SecurityAudit::class,
            'rate.limit' => AdvancedRateLimit::class,
            'normalize.email' => NormalizeEmail::class,
            'role' => RoleMiddleware::class,
        ]);

        $middleware->api(prepend: [
            EnsureFrontendRequestsAreStateful::class,
            HandleCors::class,
            SecurityHeaders::class,
        ]);
        $middleware->web(append: [
            SecurityHeaders::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->renderable(function (Illuminate\Auth\AuthenticationException $e) {
            if (request()->expectsJson()) {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            }
        });

        $exceptions->renderable(function (QueryException $e) {
            if (! app()->environment('local', 'testing')) {
                return response()->json(['message' => 'A server error occurred.'], 500);
            }
        });
    })->create();
