<?php

namespace App\Jobs;

use App\Models\Rsvp;
use App\Models\Volunteer;
use App\Services\FacebookService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;

class SendRsvpFacebookNotificationJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    protected ?string $batchId;

    public function __construct(
        public int $volunteerId,
        public int $rsvpId,
        ?string $batchId = null
    ) {
        $this->batchId = $batchId;
    }

    public function handle(FacebookService $facebookService): void
    {
        $volunteer = Volunteer::query()->find($this->volunteerId);
        $rsvp = Rsvp::query()->find($this->rsvpId);

        if (! $volunteer || ! $rsvp) {
            if ($this->batchId) {
                Cache::increment("{$this->batchId}_failed");
            }

            return;
        }

        if ($facebookService->sendRsvpNotification($volunteer, $rsvp)) {
            if ($this->batchId) {
                Cache::increment("{$this->batchId}_sent");
            }
        } else {
            if ($this->batchId) {
                Cache::increment("{$this->batchId}_failed");
            }
        }
    }
}
