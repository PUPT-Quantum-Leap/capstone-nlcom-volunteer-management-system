<?php

namespace App\Jobs;

use App\Mail\BroadcastMail;
use App\Models\Rsvp;
use App\Models\Volunteer;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SendEmailBroadcastJob implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public string $audience,
        public string $messageBody,
        public ?int $rsvpId = null
    ) {
        $this->onQueue('emails');
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $rsvp = null;
        if ($this->rsvpId) {
            $rsvp = Rsvp::query()->find($this->rsvpId);
        }

        $query = Volunteer::query()
            ->whereHas('user', fn ($q) => $q->whereNull('deleted_at'))
            ->whereNull('deleted_at');

        if ($this->audience === 'voted') {
            if (! $this->rsvpId) {
                Log::error('SendEmailBroadcastJob: Audience is voted but no RSVP ID is provided.');

                return;
            }
            $query->whereHas('rsvpResponses', fn ($q) => $q->where('rsvp_id', $this->rsvpId));
        } elseif ($this->audience === 'not_voted') {
            if (! $this->rsvpId) {
                Log::error('SendEmailBroadcastJob: Audience is not_voted but no RSVP ID is provided.');

                return;
            }
            $query->whereDoesntHave('rsvpResponses', fn ($q) => $q->where('rsvp_id', $this->rsvpId));
        }

        $volunteers = $query->get();

        Log::info("SendEmailBroadcastJob: Starting broadcast to {$volunteers->count()} volunteers for audience: {$this->audience}, RSVP: ".($this->rsvpId ?? 'None'));

        foreach ($volunteers as $volunteer) {
            if (empty($volunteer->email)) {
                Log::warning("SendEmailBroadcastJob: Volunteer {$volunteer->volunteer_id} has no email address, skipping.");

                continue;
            }

            Mail::to($volunteer->email)->queue(new BroadcastMail($volunteer, $this->messageBody, $rsvp));
        }
    }
}
