<?php

namespace App\Jobs;

use App\Models\Rsvp;
use App\Models\Volunteer;
use App\Services\SmsService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class SendRsvpSms implements ShouldQueue
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
    public function handle(SmsService $smsService): void
    {
        $smsService->sendRsvpNotification($this->volunteer, $this->rsvp);
    }
}
