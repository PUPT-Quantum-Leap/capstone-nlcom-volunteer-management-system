<?php

namespace App\Observers;

use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class UserObserver
{
    /**
     * Handle the User "updating" event.
     * Audit role and password changes for security compliance.
     */
    public function updating(User $user): void
    {
        $dirty = $user->getDirty();
        $original = $user->getOriginal();
        $actorId = Auth::id();
        $ip = request()->ip();

        if (array_key_exists('role', $dirty)) {
            Log::channel('stack')->info('User role changed', [
                'user_id' => $user->id,
                'changed_by' => $actorId,
                'old_role' => $original['role'] ?? null,
                'new_role' => $dirty['role'],
                'ip_address' => $ip,
            ]);
        }

        if (array_key_exists('password', $dirty)) {
            Log::channel('stack')->info('User password changed', [
                'user_id' => $user->id,
                'changed_by' => $actorId,
                'ip_address' => $ip,
            ]);
        }
    }
}
