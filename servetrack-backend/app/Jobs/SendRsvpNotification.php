<?php

namespace App\Jobs;

use App\Models\Rsvp;
use App\Models\Volunteer;
use App\Services\FacebookService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class SendRsvpNotification implements ShouldQueue
{
    use Queueable;

    /**
     * Create a new job instance.
     */
    public function __construct(
        protected Volunteer $volunteer,
        protected Rsvp $rsvp,
    ) {}

    /**
     * Execute the job.
     */
    public function handle(FacebookService $facebookService): void
    {
        $facebookService->sendRsvpNotification($this->volunteer, $this->rsvp);
    }
}
