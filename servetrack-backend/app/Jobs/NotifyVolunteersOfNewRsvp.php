<?php

namespace App\Jobs;

use App\Mail\RsvpEventCreatedMail;
use App\Models\Rsvp;
use App\Models\RsvpNotification;
use App\Models\Volunteer;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Mail;

class NotifyVolunteersOfNewRsvp implements ShouldQueue
{
    use Queueable;

    public function __construct(public Rsvp $rsvp) {}

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        // Get all active volunteers
        $volunteers = Volunteer::query()
            ->whereHas('user', fn ($q) => $q->where('deleted_at', null))
            ->where('deleted_at', null)
            ->get();

        foreach ($volunteers as $volunteer) {
            // Create dashboard notification
            $notification = RsvpNotification::query()->create([
                'volunteer_id' => $volunteer->volunteer_id,
                'rsvp_id' => $this->rsvp->rsvp_id,
                'type' => 'event_created',
                'message' => "{$this->rsvp->title} - {$this->rsvp->date->format('M d, Y')}",
                'email_sent' => false,
            ]);

            // Queue email if volunteer has notification preferences enabled
            if ($volunteer->notify_rsvp_on_email) {
                Mail::queue(new RsvpEventCreatedMail($this->rsvp, $volunteer));
                $notification->update(['email_sent' => true]);
            }
        }
    }
}
