<?php

namespace App\Services;

use App\Models\User;

class OAuthService
{
    /**
     * Find or create a User from an OAuth provider.
     *
     * Returns [User $user, bool $needsProfileCompletion].
     *
     * @return array{0: User, 1: bool}
     */
    public function findOrCreateFromProvider(
        string $provider,
        string $providerId,
        string $email,
        string $name,
    ): array {
        // 1. Look up by provider + provider_id
        $user = User::where('provider', $provider)
            ->where('provider_id', $providerId)
            ->first();

        if ($user) {
            return [$user, $user->volunteer === null];
        }

        // 2. Look up by email (existing volunteer account) — attach provider
        $user = User::where('email', $email)->where('role', 'volunteer')->first();

        if ($user) {
            $user->update(['provider' => $provider, 'provider_id' => $providerId]);

            return [$user, $user->volunteer === null];
        }

        // 3. Create new user — no password, no Volunteer profile yet
        $user = User::create([
            'name' => $name,
            'email' => $email,
            'password' => null,
            'role' => 'volunteer',
            'provider' => $provider,
            'provider_id' => $providerId,
        ]);

        return [$user, true];
    }
}
