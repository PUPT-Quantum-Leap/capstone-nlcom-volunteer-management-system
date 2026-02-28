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

<<<<<<< HEAD
=======
        // Basic security headers
>>>>>>> origin/main
        $response->headers->set('X-Frame-Options', 'SAMEORIGIN');
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-XSS-Protection', '1; mode=block');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');

<<<<<<< HEAD
        return $response;
    }
=======
        // Content Security Policy
        $response->headers->set('Content-Security-Policy', $this->buildCSP($request));

        // HSTS — only send over HTTPS to avoid breaking local HTTP dev
        if ($request->isSecure()) {
            $response->headers->set(
                'Strict-Transport-Security',
                'max-age=31536000; includeSubDomains; preload'
            );
        }

        // Permissions Policy — restrict powerful browser features
        $response->headers->set(
            'Permissions-Policy',
            'geolocation=(), microphone=(), camera=(), payment=()'
        );

        return $response;
    }

    /**
     * Build the Content-Security-Policy directive string.
     * Loosens script/style restrictions on localhost to allow Angular's dev tooling.
     */
    protected function buildCSP(Request $request): string
    {
        $isLocal = in_array($request->getHost(), ['localhost', '127.0.0.1']);

        $directives = [
            'default-src' => "'self'",
            'script-src' => $isLocal ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self'",
            'style-src' => "'self' 'unsafe-inline'", // Required for Tailwind inline styles
            'img-src' => "'self' data: https:",
            'font-src' => "'self' data:",
            'connect-src' => "'self'",
            'frame-ancestors' => "'none'",
            'form-action' => "'self'",
            'base-uri' => "'self'",
            'upgrade-insecure-requests' => '',
        ];

        $parts = [];

        foreach ($directives as $directive => $value) {
            $parts[] = empty($value) ? $directive : "{$directive} {$value}";
        }

        return implode('; ', $parts);
    }
>>>>>>> origin/main
}
