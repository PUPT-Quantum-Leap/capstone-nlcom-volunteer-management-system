<?php

namespace App\Jobs;

use App\Models\Rsvp;
use App\Models\Volunteer;
use App\Services\SmsService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendRsvpSmsJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public function __construct(
        public int $volunteerId,
        public int $rsvpId
    ) {}

    public function handle(SmsService $smsService): void
    {
        $volunteer = Volunteer::query()->find($this->volunteerId);
        $rsvp = Rsvp::query()->find($this->rsvpId);

        if (! $volunteer || ! $rsvp) {
            return;
        }

        $smsService->sendRsvpNotification($volunteer, $rsvp);
    }
}
