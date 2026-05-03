<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class NormalizeEmail
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Normalize email to lowercase if present in request
        if ($request->has('email')) {
            $request->merge(['email' => strtolower(trim((string) $request->email))]);
        }

        return $next($request);
    }
}
