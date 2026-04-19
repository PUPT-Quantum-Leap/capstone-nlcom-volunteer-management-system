<?php

namespace App\Policies;

use App\Models\Poll;
use App\Models\User;

class PollPolicy
{
    /**
     * Determine if the user can create polls.
     */
    public function create(User $user): bool
    {
        return $user->role === 'admin';
    }

    /**
     * Determine if the user can update the poll.
     */
    public function update(User $user, Poll $poll): bool
    {
        return $user->role === 'admin';
    }

    /**
     * Determine if the user can delete the poll.
     */
    public function delete(User $user, Poll $poll): bool
    {
        return $user->role === 'admin';
    }

    /**
     * Determine if the user can update the poll status.
     */
    public function updateStatus(User $user, Poll $poll): bool
    {
        return $user->role === 'admin';
    }

    /**
     * Determine if the user can view the poll.
     */
    public function view(User $user, Poll $poll): bool
    {
        // All authenticated users can view polls
        return true;
    }
}
