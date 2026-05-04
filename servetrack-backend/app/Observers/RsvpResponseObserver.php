<?php

namespace App\Observers;

use App\Models\Ics;
use App\Models\RsvpResponse;

class RsvpResponseObserver
{
    /**
     * Handle the RsvpResponse "created" event.
     * Automatically make volunteer available for ICS when they RSVP.
     */
    public function created(RsvpResponse $rsvpResponse): void
    {
        // Check if an ICS exists for this RSVP
        $ics = Ics::query()
            ->where('rsvp_id', $rsvpResponse->rsvp_id)
            ->first();

        // If ICS exists, add volunteer to it (without team assignment initially)
        if ($ics) {
            $ics->volunteers()->syncWithoutDetaching([
                $rsvpResponse->volunteer_id => [
                    'team_id' => null,
                    'role' => null,
                    'assigned_at' => null,
                ],
            ]);
        }
    }
}
