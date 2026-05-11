<?php

namespace App\Jobs;

use App\Mail\RsvpCutoffReminderMail;
use App\Models\Rsvp;
use App\Models\Volunteer;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SendCutoffReminderJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of times the job may be attempted.
     */
    public int $tries = 3;

    /**
     * The number of seconds to wait before retrying the job.
     */
    public int $retryAfter = 60;

    /**
     * The maximum number of unhandled exceptions to allow before failing.
     */
    public int $maxExceptions = 3;

    /**
     * Indicate if the job should be marked as failed on timeout.
     */
    public bool $failOnTimeout = true;

    /**
     * The number of seconds the job can run before timing out.
     */
    public int $timeout = 120;

    /**
     * Create a new job instance.
     */
    public function __construct(
        public Rsvp $rsvp,
        public Volunteer $volunteer,
        public string $timeRemaining
    ) {
        // Set queue name for email jobs
        $this->onQueue('emails');
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        try {
            // Validate volunteer has email
            if (empty($this->volunteer->email)) {
                Log::warning(
                    'Volunteer has no email address, skipping reminder',
                    [
                        'volunteer_id' => $this->volunteer->volunteer_id,
                        'rsvp_id' => $this->rsvp->rsvp_id,
                    ]);

                return;
            }

            // Send the email
            Mail::to($this->volunteer->email)->queue(
                new RsvpCutoffReminderMail($this->rsvp, $this->volunteer, $this->timeRemaining)
            );

            Log::info(
                'RSVP cutoff reminder email sent successfully',
                [
                    'volunteer_id' => $this->volunteer->volunteer_id,
                    'volunteer_email' => $this->volunteer->email,
                    'rsvp_id' => $this->rsvp->rsvp_id,
                    'rsvp_title' => $this->rsvp->title,
                    'time_remaining' => $this->timeRemaining,
                ]);

        } catch (\Throwable $e) {
            Log::error(
                'Failed to send RSVP cutoff reminder email',
                [
                    'volunteer_id' => $this->volunteer->volunteer_id,
                    'volunteer_email' => $this->volunteer->email,
                    'rsvp_id' => $this->rsvp->rsvp_id,
                    'rsvp_title' => $this->rsvp->title,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);

            // Re-throw the exception to trigger job retry mechanism
            throw $e;
        }
    }

    /**
     * Handle a job failure.
     */
    public function failed(\Throwable $exception): void
    {
        Log::error(
            'RSVP cutoff reminder job failed permanently',
            [
                'volunteer_id' => $this->volunteer->volunteer_id,
                'volunteer_email' => $this->volunteer->email,
                'rsvp_id' => $this->rsvp->rsvp_id,
                'rsvp_title' => $this->rsvp->title,
                'error' => $exception->getMessage(),
                'attempts' => $this->attempts(),
            ]);
    }

    /**
     * Get the tags that should be assigned to the job.
     */
    public function tags(): array
    {
        return [
            'rsvp-reminder',
            'rsvp:'.$this->rsvp->rsvp_id,
            'volunteer:'.$this->volunteer->volunteer_id,
        ];
    }

    /**
     * Determine the time at which the job should timeout.
     */
    public function retryUntil(): \DateTime
    {
        return now()->addMinutes(30);
    }
}
