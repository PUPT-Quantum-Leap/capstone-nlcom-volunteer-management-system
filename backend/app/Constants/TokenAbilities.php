<?php

namespace App\Constants;

/**
 * Sanctum token ability constants scoped by user role.
 * Tokens issued to each role only carry the abilities that role requires,
 * following the principle of least privilege.
 */
class TokenAbilities
{
    /** Abilities granted to admin tokens. */
    public const ADMIN = [
        'admin:dashboard',
        'admin:volunteers:read',
        'admin:volunteers:write',
        'admin:volunteers:delete',
        'admin:change-history:read',
    ];

    /** Abilities granted to coordinator tokens. */
    public const COORDINATOR = [
        'coordinator:volunteers:read',
        'coordinator:volunteers:write',
        'coordinator:attendance:write',
    ];

    /** Abilities granted to volunteer tokens. */
    public const VOLUNTEER = [
        'volunteer:profile:read',
        'volunteer:profile:write',
        'volunteer:attendance:read',
    ];
}
