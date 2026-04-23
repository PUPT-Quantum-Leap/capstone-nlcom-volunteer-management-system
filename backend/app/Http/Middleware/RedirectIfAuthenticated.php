<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class RedirectIfAuthenticated
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next, string ...$guards): Response
    {
        $guards = empty($guards) ? [null] : $guards;

        foreach ($guards as $guard) {
            $guardInstance = Auth::guard($guard);

            if ($guardInstance->check()) {
                // If the user record exists, redirect as usual
                if ($request->expectsJson()) {
                    return response()->json([
                        'message' => 'Already authenticated.',
                        'redirect' => '/',
                    ], 200);
                }

                return redirect('/');
            } else {
                // If there's an active session but no user record (stale session),
                // clear it to allow guest access
                if ($guard === null || $guard === 'web') {
                    Auth::logout();
                    if ($request->hasSession()) {
                        $request->session()->invalidate();
                        $request->session()->regenerateToken();
                    }
                }
            }
        }

        return $next($request);
    }
}
