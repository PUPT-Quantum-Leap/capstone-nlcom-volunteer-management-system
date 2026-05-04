<?php

namespace App\Policies;

use App\Models\Ics;
use App\Models\User;

class IcsPolicy
{
    /**
     * Determine if the user can view any ICS records.
     */
    public function viewAny(User $user): bool
    {
        return true;
    }

    /**
     * Determine if the user can view the ICS.
     */
    public function view(User $user, Ics $ics): bool
    {
        // All authenticated users can view active ICS
        if ($ics->status === 'active') {
            return true;
        }

        // Only admins can view draft/completed ICS
        return $user->role === 'admin';
    }

    /**
     * Determine if the user can create ICS.
     */
    public function create(User $user): bool
    {
        return $user->role === 'admin';
    }

    /**
     * Determine if the user can update the ICS.
     */
    public function update(User $user, Ics $ics): bool
    {
        return $user->role === 'admin';
    }

    /**
     * Determine if the user can delete the ICS.
     */
    public function delete(User $user, Ics $ics): bool
    {
        return $user->role === 'admin';
    }

    /**
     * Determine if the user can apply AI suggestions.
     */
    public function applySuggestions(User $user, Ics $ics): bool
    {
        return $user->role === 'admin';
    }

    /**
     * Determine if the user can assign volunteers to ICS.
     */
    public function assignVolunteer(User $user, Ics $ics): bool
    {
        return $user->role === 'admin';
    }

    /**
     * Determine if the user can remove volunteers from ICS.
     */
    public function removeVolunteer(User $user, Ics $ics): bool
    {
        return $user->role === 'admin';
    }

    /**
     * Determine if the user can get AI suggestions.
     */
    public function getAiSuggestions(User $user, Ics $ics): bool
    {
        return $user->role === 'admin';
    }
}
