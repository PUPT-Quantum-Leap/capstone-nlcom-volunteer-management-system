<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class DynamicSessionDomain
{
    /**
     * Origin pattern matching Vercel preview deployments.
     *
     * Matches any HTTPS origin on a vercel.app subdomain, e.g.
     * "https://servetrack-git-feat-abc123.vercel.app".
     */
    private const VERCEL_ORIGIN_REGEX = '#^https://[a-z0-9-]+\.vercel\.app$#i';

    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $origin = $request->headers->get('Origin');

        if (is_string($origin) && preg_match(self::VERCEL_ORIGIN_REGEX, $origin) === 1) {
            config(['session.domain' => null]);
        }

        return $next($request);
    }
}
