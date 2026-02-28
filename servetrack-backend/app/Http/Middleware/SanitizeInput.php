<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SanitizeInput
{
    /**
     * SQL injection and script-injection patterns to detect.
     *
     * @var list<string>
     */
    private const SUSPICIOUS_PATTERNS = [
        '/(\bOR\b|\bAND\b)\s+[\w\'"]+\s*=\s*[\w\'"]+/i', // OR 1=1 / AND x=x
        '/--/',                                              // SQL comment
        '/;/',                                               // statement terminator
        '/\/\*.*?\*\//s',                                    // block comments
        '/\bUNION\b/i',                                      // UNION injection
        '/\bDROP\b/i',                                       // DROP statement
        '/\bEXEC\b|\bEXECUTE\b/i',                          // EXEC statement
        '/\bINSERT\b|\bDELETE\b|\bUPDATE\b/i',              // DML injection
        '/<\/?script\b[^>]*>/i',                               // XSS script tags (open & close)
    ];

    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $input = $request->all();
        $this->sanitize($input);
        $request->replace($input);

        return $next($request);
    }

    /**
     * Recursively trim and flag suspicious input.
     *
     * @param  array<string, mixed>  $input
     */
    private function sanitize(array &$input): void
    {
        foreach ($input as $key => &$value) {
            if (is_array($value)) {
                $this->sanitize($value);
            } elseif (is_string($value)) {
                $value = trim($value);
                $value = $this->stripSuspiciousPatterns($value);
            }
        }
    }

    /**
     * Strip known SQL/script injection patterns from a value.
     */
    private function stripSuspiciousPatterns(string $value): string
    {
        foreach (self::SUSPICIOUS_PATTERNS as $pattern) {
            $value = (string) preg_replace($pattern, '', $value);
        }

        return $value;
    }
}
