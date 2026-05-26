<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Reject input that contains telltale XSS / script-injection markers.
 *
 * This is a defence-in-depth check on top of HTML escaping at render time;
 * it lets us refuse, log, and audit obvious injection attempts before the
 * payload is forwarded to downstream services (e.g. n8n, the LLM).
 */
class NoMaliciousContent implements ValidationRule
{
    /**
     * Patterns commonly seen in script-injection payloads. Matched
     * case-insensitively against the entire attribute value.
     *
     * @var array<int, string>
     */
    private const DANGEROUS_PATTERNS = [
        '/<\s*script\b/i',
        '/<\s*\/\s*script\s*>/i',
        '/<\s*iframe\b/i',
        '/<\s*object\b/i',
        '/<\s*embed\b/i',
        '/<\s*link\b/i',
        '/<\s*meta\b/i',
        '/javascript\s*:/i',
        '/vbscript\s*:/i',
        '/data\s*:\s*text\/html/i',
        '/\bon[a-z]+\s*=/i', // onerror=, onclick=, onload=, etc.
    ];

    /**
     * Run the validation rule.
     *
     * @param  Closure(string, ?string=): \Illuminate\Translation\PotentiallyTranslatedString  $fail
     */
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value)) {
            return;
        }

        foreach (self::DANGEROUS_PATTERNS as $pattern) {
            if (preg_match($pattern, $value) === 1) {
                $fail('The :attribute contains content that is not allowed.');

                return;
            }
        }
    }

    /**
     * Convenience helper used by controllers/middleware that want to
     * detect (but not necessarily reject) suspicious payloads.
     */
    public static function matches(string $value): bool
    {
        foreach (self::DANGEROUS_PATTERNS as $pattern) {
            if (preg_match($pattern, $value) === 1) {
                return true;
            }
        }

        return false;
    }
}
