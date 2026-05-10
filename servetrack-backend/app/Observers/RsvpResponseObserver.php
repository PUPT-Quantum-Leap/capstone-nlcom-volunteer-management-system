<?php

namespace App\Observers;

use App\Models\Attendance;
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

    /**
     * Handle the RsvpResponse "updated" event.
     * Create attendance record when volunteer checks out.
     */
    public function updated(RsvpResponse $rsvpResponse): void
    {
        // Check if checked_out_at was just set (volunteer checked out)
        if ($rsvpResponse->wasChanged('checked_out_at') && $rsvpResponse->checked_out_at !== null) {
            $this->createAttendanceRecord($rsvpResponse);
        }
    }

    /**
     * Create an attendance record for the RSVP response.
     */
    private function createAttendanceRecord(RsvpResponse $rsvpResponse): void
    {
        // Load RSVP with location relationship
        $rsvp = $rsvpResponse->rsvp()->with('location')->first();

        if (! $rsvp) {
            return;
        }

        // Calculate hours worked
        $hours = 0;
        if ($rsvpResponse->checked_in_at && $rsvpResponse->checked_out_at) {
            $hours = round($rsvpResponse->checked_in_at->diffInMinutes($rsvpResponse->checked_out_at) / 60, 2);
        }

        // Determine location name
        $locationName = null;
        if ($rsvp->location) {
            $locationName = $rsvp->location->full_address;
        } elseif ($rsvp->event_location) {
            $locationName = $rsvp->event_location;
        }

        // Check if attendance record already exists for this RSVP response
        $existingAttendance = Attendance::query()
            ->where('volunteer_id', $rsvpResponse->volunteer_id)
            ->where('rsvp_id', $rsvp->rsvp_id)
            ->whereDate('date', $rsvp->date)
            ->first();

        if ($existingAttendance) {
            // Update existing record
            $existingAttendance->update([
                'hours' => $hours,
                'location' => $locationName,
                'location_id' => $rsvp->location_id,
                'description' => $rsvp->title,
                'rsvp_response_id' => $rsvpResponse->rsvp_response_id,
            ]);
        } else {
            // Create new attendance record
            Attendance::query()->create([
                'volunteer_id' => $rsvpResponse->volunteer_id,
                'date' => $rsvp->date,
                'hours' => $hours,
                'description' => $rsvp->title,
                'location' => $locationName,
                'location_id' => $rsvp->location_id,
                'rsvp_id' => $rsvp->rsvp_id,
                'status' => 'pending',
                'created_by' => null,
                'rsvp_response_id' => $rsvpResponse->rsvp_response_id,
            ]);
        }
    }
}
