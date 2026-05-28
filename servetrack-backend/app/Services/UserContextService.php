<?php

namespace App\Services;

use App\Models\Rsvp;
use App\Models\User;
use App\Models\Volunteer;
use Illuminate\Support\Carbon;

class UserContextService
{
    /**
     * Build a context payload for the given authenticated user,
     * adapted to their role (admin or volunteer).
     *
     * @return array<string, mixed>
     */
    public function buildContext(User $user): array
    {
        $role = $user->role ?? 'volunteer';

        return match ($role) {
            'admin', 'coordinator' => $this->buildAdminContext($user),
            default                => $this->buildVolunteerContext($user),
        };
    }

    /**
     * Build context for an admin/coordinator user.
     *
     * @return array<string, mixed>
     */
    private function buildAdminContext(User $user): array
    {
        $totalVolunteers = Volunteer::query()->count();

        $activeRsvps = Rsvp::query()
            ->where('status', 'active')
            ->count();

        $upcomingEvents = Rsvp::query()
            ->where('status', 'active')
            ->where('date', '>=', now()->toDateString())
            ->orderBy('date')
            ->limit(5)
            ->get(['title', 'date', 'event_location'])
            ->map(fn($rsvp) => [
                'title'    => $rsvp->title,
                'date'     => $rsvp->date->format('Y-m-d'),
                'location' => $rsvp->event_location,
            ])
            ->toArray();

        return [
            'role'            => $user->role,
            'name'            => $user->name,
            'email'           => $user->email,
            'totalVolunteers' => $totalVolunteers,
            'activeRsvps'     => $activeRsvps,
            'upcomingEvents'  => $upcomingEvents,
            'currentDate'     => now()->setTimezone('Asia/Manila')->toDateString(),
            'currentTime'     => now()->setTimezone('Asia/Manila')->format('H:i'),
        ];
    }

    /**
     * Build context for a volunteer user.
     *
     * @return array<string, mixed>
     */
    private function buildVolunteerContext(User $user): array
    {
        $volunteer = Volunteer::query()
            ->with(['skills', 'attendances', 'rsvpResponses.rsvp'])
            ->where('user_id', $user->id)
            ->first();

        if (! $volunteer) {
            return [
                'role'        => 'volunteer',
                'name'        => $user->name,
                'email'       => $user->email,
                'currentDate' => now()->setTimezone('Asia/Manila')->toDateString(),
                'currentTime' => now()->setTimezone('Asia/Manila')->format('H:i'),
            ];
        }

        // Total hours logged
        $totalHours = $volunteer->attendances
            ->sum(fn($a) => (float) $a->hours);

        // Hours logged this month
        $hoursThisMonth = $volunteer->attendances
            ->filter(fn($a) => $a->date instanceof Carbon
                && $a->date->isCurrentMonth())
            ->sum(fn($a) => (float) $a->hours);

        // Last attendance record
        $lastAttendance = $volunteer->attendances
            ->sortByDesc('date')
            ->first();

        // Upcoming RSVPs the volunteer has responded yes to
        $upcomingRsvps = $volunteer->rsvpResponses
            ->filter(fn($r) => $r->rsvp
                && $r->rsvp->date >= now()->toDateString()
                && $r->rsvp->status === 'active')
            ->take(3)
            ->map(fn($r) => [
                'title' => $r->rsvp->title,
                'date'  => $r->rsvp->date,
            ])
            ->values()
            ->toArray();

        // Skills list
        $skills = $volunteer->skills->pluck('name')->toArray();

        return [
            'role'             => 'volunteer',
            'name'             => trim("{$volunteer->first_name} {$volunteer->last_name}"),
            'email'            => $volunteer->email,
            'skills'           => $skills,
            'totalHoursLogged' => round($totalHours, 2),
            'hoursThisMonth'   => round($hoursThisMonth, 2),
            'lastAttendance'   => $lastAttendance?->date?->format('Y-m-d'),
            'upcomingRsvps'    => $upcomingRsvps,
            'currentDate'      => now()->setTimezone('Asia/Manila')->toDateString(),
            'currentTime'      => now()->setTimezone('Asia/Manila')->format('H:i'),
        ];
    }
}
