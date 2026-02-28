<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class SecurityAudit
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $status = $response->getStatusCode();
        $context = [
            'route' => $request->path(),
            'ip' => $request->ip(),
            'status' => $status,
        ];

        if ($status >= 200 && $status < 300) {
            $context['email'] = $request->input('email');
        }

        Log::channel('single')->info('Auth attempt', $context);

        return $response;
    }
}
