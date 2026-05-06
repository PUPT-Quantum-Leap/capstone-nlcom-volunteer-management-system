<?php

namespace App\Services;

use App\Mail\RsvpAutoClosedAdminMail;
use App\Mail\RsvpAutoClosedVolunteerMail;
use App\Models\Admin;
use App\Models\Rsvp;
use App\Models\RsvpAuditTrail;
use App\Models\RsvpNotification;
use App\Models\Volunteer;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class RsvpAutoCloseService
{
    /**
     * Close all RSVPs that have passed their cutoff deadline.
     */
    public function closeExpiredRsvps(): array
    {
        $expiredRsvps = $this->getExpiredRsvps();

        $results = [
            'closed_count' => 0,
            'rsvps' => [],
            'errors' => [],
        ];

        foreach ($expiredRsvps as $rsvp) {
            try {
                $result = $this->closeSingleRsvp($rsvp);

                if ($result['success']) {
                    $results['closed_count']++;
                    $results['rsvps'][] = $result;
                }
            } catch (\Throwable $e) {
                $results['errors'][] = [
                    'rsvp_id' => $rsvp->rsvp_id,
                    'title' => $rsvp->title,
                    'error' => $e->getMessage(),
                ];

                Log::error('Failed to auto-close RSVP', [
                    'rsvp_id' => $rsvp->rsvp_id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        Log::info('RSVP auto-close batch completed', [
            'closed_count' => $results['closed_count'],
            'error_count' => count($results['errors']),
        ]);

        return $results;
    }

    /**
     * Get all RSVPs that should be auto-closed.
     */
    public function getExpiredRsvps(): \Illuminate\Database\Eloquent\Collection
    {
        return Rsvp::query()
            ->activeAndNotAutoClosed()
            ->where(function ($query) {
                $query->where(function ($q) {
                    $q->whereNotNull('cutoff_day')
                        ->whereNotNull('cutoff_time')
                        ->where(function ($q2) {
                            $q2->where(function ($q3) {
                                $cutoffDate = Carbon::today()->format('Y-m-d');
                                $cutoffTime = Carbon::now()->format('H:i:s');

                                $q3->where('cutoff_day', '<', $cutoffDate)
                                    ->orWhere(function ($q4) use ($cutoffDate, $cutoffTime) {
                                        $q4->where('cutoff_day', $cutoffDate)
                                            ->where('cutoff_time', '<=', $cutoffTime);
                                    });
                            });
                        });
                });
            })
            ->with('responses.volunteer')
            ->get();
    }

    /**
     * Close a single RSVP event.
     */
    public function closeSingleRsvp(Rsvp $rsvp): array
    {
        $volunteersAtClose = $rsvp->responses->pluck('volunteer')->flatten()->unique('volunteer_id')->values();

        $wasAutoClosed = $rsvp->update([
            'status' => 'closed',
            'auto_closed_at' => now(),
            'auto_closed_reason' => 'cutoff_passed',
            'closed_by' => 'system',
        ]);

        if (! $wasAutoClosed) {
            return [
                'success' => false,
                'rsvp_id' => $rsvp->rsvp_id,
                'title' => $rsvp->title,
                'error' => 'Failed to update status',
            ];
        }

        $this->createAuditTrail($rsvp, $volunteersAtClose->count());
        $this->sendNotifications($rsvp, $volunteersAtClose);

        Log::info('RSVP auto-closed', [
            'rsvp_id' => $rsvp->rsvp_id,
            'title' => $rsvp->title,
            'volunteer_count' => $volunteersAtClose->count(),
        ]);

        return [
            'success' => true,
            'rsvp_id' => $rsvp->rsvp_id,
            'title' => $rsvp->title,
            'volunteer_count' => $volunteersAtClose->count(),
        ];
    }

    /**
     * Create audit trail entry.
     */
    protected function createAuditTrail(Rsvp $rsvp, int $volunteerCount): void
    {
        RsvpAuditTrail::create([
            'rsvp_id' => $rsvp->rsvp_id,
            'action' => 'auto_closed',
            'triggered_by' => 'system',
            'reason' => 'Cutoff deadline passed',
            'metadata' => [
                'cutoff_day' => $rsvp->cutoff_day,
                'cutoff_time' => $rsvp->cutoff_time,
                'volunteer_count_at_close' => $volunteerCount,
                'closed_at' => now()->toIso8601String(),
            ],
        ]);
    }

    /**
     * Send notifications to admins and volunteers.
     *
     * @param  Collection<int, Volunteer>  $volunteers
     */
    protected function sendNotifications(Rsvp $rsvp, Collection $volunteers): void
    {
        $this->notifyAdmins($rsvp);
        $this->notifyVolunteers($rsvp, $volunteers);
    }

    /**
     * Notify all admins about the auto-closed RSVP.
     */
    protected function notifyAdmins(Rsvp $rsvp): void
    {
        $admins = Admin::all();

        foreach ($admins as $admin) {
            try {
                Mail::to($admin->email)->queue(new RsvpAutoClosedAdminMail($rsvp, $admin));

                RsvpNotification::create([
                    'volunteer_id' => 0,
                    'rsvp_id' => $rsvp->rsvp_id,
                    'type' => 'event_auto_closed',
                    'message' => "Event '{$rsvp->title}' has been automatically closed because the cutoff deadline has passed.",
                ]);
            } catch (\Throwable $e) {
                Log::error('Failed to notify admin', [
                    'admin_id' => $admin->admin_id,
                    'rsvp_id' => $rsvp->rsvp_id,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    /**
     * Notify volunteers who RSVP'd to the event.
     */
    protected function notifyVolunteers(Rsvp $rsvp, $volunteers): void
    {
        foreach ($volunteers as $volunteer) {
            try {
                Mail::to($volunteer->email)->queue(new RsvpAutoClosedVolunteerMail($rsvp, $volunteer));

                RsvpNotification::create([
                    'volunteer_id' => $volunteer->volunteer_id,
                    'rsvp_id' => $rsvp->rsvp_id,
                    'type' => 'event_auto_closed',
                    'message' => "Event '{$rsvp->title}' has been automatically closed. Your RSVP registration is confirmed.",
                ]);
            } catch (\Throwable $e) {
                Log::error('Failed to notify volunteer', [
                    'volunteer_id' => $volunteer->volunteer_id,
                    'rsvp_id' => $rsvp->rsvp_id,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    /**
     * Check if an RSVP should be auto-closed (for testing).
     */
    public function shouldAutoClose(Rsvp $rsvp): bool
    {
        return $rsvp->shouldAutoClose();
    }
}
