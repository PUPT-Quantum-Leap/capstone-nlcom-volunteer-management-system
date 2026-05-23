<?php

namespace App\Services;

use App\Jobs\SendCutoffReminderJob;
use App\Models\Rsvp;
use App\Models\RsvpNotification;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

class RsvpCutoffReminderService
{
    /**
     * Find RSVPs that need cutoff reminders and queue emails.
     */
    public function sendCutoffReminders(): array
    {
        $rsvpsNeedingReminders = $this->getRsvpsNeedingReminders();

        $results = [
            'rsvps_processed' => 0,
            'volunteers_notified' => 0,
            'jobs_queued' => 0,
            'errors' => [],
        ];

        foreach ($rsvpsNeedingReminders as $rsvp) {
            try {
                $volunteersToRemind = $this->getVolunteersToRemind($rsvp);

                if ($volunteersToRemind->isEmpty()) {
                    continue;
                }

                foreach ($volunteersToRemind as $volunteerResponse) {
                    $timeRemaining = $this->calculateTimeRemaining($rsvp);

                    // Queue the email job
                    SendCutoffReminderJob::dispatch(
                        $rsvp,
                        $volunteerResponse->volunteer,
                        $timeRemaining
                    );

                    // Mark reminder as sent in database
                    $volunteerResponse->update([
                        'cutoff_reminder_sent_at' => now(),
                    ]);

                    // Create notification record
                    RsvpNotification::create([
                        'volunteer_id' => $volunteerResponse->volunteer_id,
                        'rsvp_id' => $rsvp->rsvp_id,
                        'type' => 'reminder',
                        'message' => "RSVP cutoff reminder sent for event '{$rsvp->title}'. ".
                           "Cutoff: {$rsvp->cutoff_day->format('M j, Y')} ".
                           "at {$rsvp->cutoff_time}",
                    ]);

                    $results['volunteers_notified']++;
                    $results['jobs_queued']++;
                }

                $results['rsvps_processed']++;

                Log::info('RSVP cutoff reminders processed', [
                    'rsvp_id' => $rsvp->rsvp_id,
                    'title' => $rsvp->title,
                    'volunteers_notified' => $volunteersToRemind->count(),
                ]);

            } catch (\Throwable $e) {
                $results['errors'][] = [
                    'rsvp_id' => $rsvp->rsvp_id,
                    'title' => $rsvp->title,
                    'error' => $e->getMessage(),
                ];

                Log::error('Failed to process RSVP cutoff reminders', [
                    'rsvp_id' => $rsvp->rsvp_id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        Log::info('RSVP cutoff reminder batch completed', [
            'rsvps_processed' => $results['rsvps_processed'],
            'volunteers_notified' => $results['volunteers_notified'],
            'jobs_queued' => $results['jobs_queued'],
            'error_count' => count($results['errors']),
        ]);

        return $results;
    }

    /**
     * Get RSVPs that need cutoff reminders (within 24 hours of cutoff).
     */
    public function getRsvpsNeedingReminders(): Collection
    {
        $now = Carbon::now();
        $twentyFourHoursFromNow = $now->copy()->addHours(24);

        return Rsvp::query()
            ->where('status', 'active')
            ->whereNotNull('cutoff_day')
            ->whereNotNull('cutoff_time')
            ->where(function ($query) use ($now, $twentyFourHoursFromNow) {
                $query->where(function ($q) use ($now, $twentyFourHoursFromNow) {
                    // Cutoff is in the next 24 hours
                    $q->whereDate('cutoff_day', '>', $now->format('Y-m-d'))
                        ->whereDate('cutoff_day', '<=', $twentyFourHoursFromNow->format('Y-m-d'));
                })->orWhere(function ($q) use ($now) {
                    // Cutoff is today and still in the future — automatically within 24 hours
                    $q->whereDate('cutoff_day', '=', $now->format('Y-m-d'))
                        ->whereTime('cutoff_time', '>', $now->format('H:i:s'));
                });
            })
            ->whereHas('responses', function ($query) {
                // Only RSVPs that have volunteer responses
                $query->whereNull('cutoff_reminder_sent_at');
            })
            ->with(['responses.volunteer', 'location'])
            ->get();
    }

    /**
     * Get volunteers who need reminders for a specific RSVP.
     */
    protected function getVolunteersToRemind(Rsvp $rsvp): Collection
    {
        return $rsvp->responses()
            ->whereNull('cutoff_reminder_sent_at')
            ->with('volunteer')
            ->get();
    }

    /**
     * Calculate human-readable time remaining until cutoff.
     */
    protected function calculateTimeRemaining(Rsvp $rsvp): string
    {
        $cutoffDateTime = Carbon::parse(
            $rsvp->cutoff_day->format('Y-m-d').' '.$rsvp->cutoff_time
        );
        $now = Carbon::now();

        $diff = $now->diff($cutoffDateTime);

        if ($diff->days > 0) {
            $hours = $diff->h;

            return "{$diff->days} day".($diff->days > 1 ? 's' : '').
                   ($hours > 0 ? " and {$hours} hour".
                   ($hours > 1 ? 's' : '') : '');
        } elseif ($diff->h > 0) {
            $minutes = $diff->i;

            return "{$diff->h} hour".($diff->h > 1 ? 's' : '').
                   ($minutes > 0 ? " and {$minutes} minute".
                   ($minutes > 1 ? 's' : '') : '');
        } else {
            return "{$diff->i} minute".($diff->i > 1 ? 's' : '');
        }
    }

    /**
     * Check if a specific RSVP needs reminders (for testing).
     */
    public function needsReminder(Rsvp $rsvp): bool
    {
        $now = Carbon::now();
        $twentyFourHoursFromNow = $now->copy()->addHours(24);

        if ($rsvp->status !== 'active' || ! $rsvp->cutoff_day || ! $rsvp->cutoff_time) {
            return false;
        }

        $cutoffDateTime = Carbon::parse($rsvp->cutoff_day->format('Y-m-d').' '.$rsvp->cutoff_time);

        // Check if cutoff is within 24 hours
        if ($cutoffDateTime->lte($now) || $cutoffDateTime->gt($twentyFourHoursFromNow)) {
            return false;
        }

        // Check if there are volunteers who haven't been reminded
        return $rsvp->responses()
            ->whereNull('cutoff_reminder_sent_at')
            ->exists();
    }
}
