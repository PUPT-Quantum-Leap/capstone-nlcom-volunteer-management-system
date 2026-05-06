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

        $notifications = [];
        $now = now();
        $message = "{$this->rsvp->title} - {$this->rsvp->date->format('M d, Y')}";

        foreach ($volunteers as $volunteer) {
            $emailSent = (bool) $volunteer->notify_rsvp_on_email;

            $notifications[] = [
                'volunteer_id' => $volunteer->volunteer_id,
                'rsvp_id' => $this->rsvp->rsvp_id,
                'type' => 'event_created',
                'message' => $message,
                'email_sent' => $emailSent,
                'created_at' => $now,
                'updated_at' => $now,
            ];

            // Queue email if volunteer has notification preferences enabled
            if ($emailSent) {
                Mail::queue(new RsvpEventCreatedMail($this->rsvp, $volunteer));
            }
        }

        // Bulk insert notifications in chunks to avoid parameter limits
        foreach (array_chunk($notifications, 500) as $chunk) {
            RsvpNotification::insert($chunk);
        }
    }
}
