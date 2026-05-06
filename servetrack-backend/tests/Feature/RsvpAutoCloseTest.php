<?php

use App\Mail\RsvpAutoClosedAdminMail;
use App\Mail\RsvpAutoClosedVolunteerMail;
use App\Models\Admin;
use App\Models\Rsvp;
use App\Models\RsvpAuditTrail;
use App\Models\RsvpNotification;
use App\Models\TimeSlot;
use App\Models\User;
use App\Models\Volunteer;
use Carbon\Carbon;
use Illuminate\Support\Facades\Mail;

use function Pest\Laravel\artisan;

function createExpiredRsvp(array $attributes = []): Rsvp
{
    return Rsvp::factory()->create(array_merge([
        'status' => 'active',
        'cutoff_day' => Carbon::yesterday()->toDateString(),
        'cutoff_time' => '00:00:00',
    ], $attributes));
}

function createActiveRsvpWithFutureCutoff(array $attributes = []): Rsvp
{
    return Rsvp::factory()->create(array_merge([
        'status' => 'active',
        'cutoff_day' => Carbon::now()->addDays(7)->toDateString(),
        'cutoff_time' => '23:59:59',
    ], $attributes));
}

function getTestAdmin(): Admin
{
    $user = User::factory()->create([
        'email' => 'test-admin@test.com',
        'role' => 'admin',
    ]);

    return Admin::create([
        'user_id' => $user->id,
        'email' => 'test-admin@test.com',
        'first_name' => 'Test',
        'last_name' => 'Admin',
    ]);
}

function getTestVolunteer(): Volunteer
{
    $uniqueEmail = 'test-volunteer-'.uniqid().'@test.com';
    $user = User::factory()->create(['email' => $uniqueEmail]);

    return Volunteer::factory()->create([
        'email' => $uniqueEmail,
        'first_name' => 'Test',
        'last_name' => 'Volunteer',
        'user_id' => $user->id,
    ]);
}

function getTestTimeSlot(): TimeSlot
{
    return TimeSlot::factory()->create();
}

function assertAdminNotificationExists(Rsvp $rsvp, Admin $admin): void
{
    expect(
        RsvpNotification::where('rsvp_id', $rsvp->rsvp_id)
            ->where('type', 'event_auto_closed')
            ->where('admin_id', $admin->admin_id)
            ->whereNull('volunteer_id')
            ->exists()
    )->toBeTrue("Admin notification for RSVP {$rsvp->rsvp_id} not found");
}

function assertVolunteerNotificationExists(Rsvp $rsvp, Volunteer $volunteer): void
{
    expect(
        RsvpNotification::where('rsvp_id', $rsvp->rsvp_id)
            ->where('type', 'event_auto_closed')
            ->where('volunteer_id', $volunteer->volunteer_id)
            ->whereNull('admin_id')
            ->exists()
    )->toBeTrue("Volunteer notification for RSVP {$rsvp->rsvp_id} not found");
}

function assertAdminMailQueued(Admin $admin): void
{
    Mail::assertQueued(RsvpAutoClosedAdminMail::class, function ($mail) use ($admin) {
        return $mail->hasTo($admin->email);
    });
}

function assertVolunteerMailQueued(Volunteer $volunteer): void
{
    Mail::assertQueued(RsvpAutoClosedVolunteerMail::class, function ($mail) use ($volunteer) {
        return $mail->hasTo($volunteer->email);
    });
}

describe('RSVP Auto-Close', function (): void {
    beforeEach(function (): void {
        Mail::fake();
    });

    describe('RsvpAutoCloseService', function (): void {
        it('closes an RSVP when cutoff has passed', function (): void {
            $rsvp = createExpiredRsvp();

            $service = app(App\Services\RsvpAutoCloseService::class);
            $result = $service->closeSingleRsvp($rsvp);

            expect($result['success'])->toBeTrue();
            expect($result['rsvp_id'])->toBe($rsvp->rsvp_id);

            $rsvp->refresh();
            expect($rsvp->status)->toBe('closed');
            expect($rsvp->auto_closed_at)->not->toBeNull();
            expect($rsvp->auto_closed_reason)->toBe('cutoff_passed');
            expect($rsvp->closed_by)->toBe('system');
        });

        it('does not close an RSVP when cutoff is in the future (shouldAutoClose)', function (): void {
            $rsvp = createActiveRsvpWithFutureCutoff();

            $service = app(App\Services\RsvpAutoCloseService::class);
            $shouldClose = $service->shouldAutoClose($rsvp);

            expect($shouldClose)->toBeFalse();
        });

        it('does not close RSVP when cutoff is in the future (closeSingleRsvp)', function (): void {
            $rsvp = createActiveRsvpWithFutureCutoff();

            $service = app(App\Services\RsvpAutoCloseService::class);
            $result = $service->closeSingleRsvp($rsvp);

            expect($result['success'])->toBeFalse();
            expect($result['error'])->toContain('not eligible');

            $rsvp->refresh();
            expect($rsvp->status)->toBe('active');
            expect($rsvp->auto_closed_at)->toBeNull();
        });

        it('creates audit trail when closing', function (): void {
            $rsvp = createExpiredRsvp();

            $service = app(App\Services\RsvpAutoCloseService::class);
            $service->closeSingleRsvp($rsvp);

            $auditTrail = RsvpAuditTrail::where('rsvp_id', $rsvp->rsvp_id)->first();

            expect($auditTrail)->not->toBeNull();
            expect($auditTrail->action)->toBe('auto_closed');
            expect($auditTrail->triggered_by)->toBe('system');
            expect($auditTrail->reason)->toBe('Cutoff deadline passed');
            expect($auditTrail->metadata)->not->toBeNull();
        });

        it('does not re-close an already closed RSVP (shouldAutoClose)', function (): void {
            $rsvp = createExpiredRsvp(['status' => 'closed', 'auto_closed_at' => now()]);

            $service = app(App\Services\RsvpAutoCloseService::class);
            $shouldClose = $service->shouldAutoClose($rsvp);

            expect($shouldClose)->toBeFalse();
        });

        it('does not re-close already closed RSVP (closeSingleRsvp)', function (): void {
            $rsvp = createExpiredRsvp(['status' => 'closed', 'auto_closed_at' => now()]);

            $service = app(App\Services\RsvpAutoCloseService::class);
            $result = $service->closeSingleRsvp($rsvp);

            expect($result['success'])->toBeFalse();
            expect($result['error'])->toContain('already closed');
        });

        it('queues admin auto-close emails', function (): void {
            $admin = getTestAdmin();
            $rsvp = createExpiredRsvp();

            $service = app(App\Services\RsvpAutoCloseService::class);
            $result = $service->closeSingleRsvp($rsvp);

            expect($result['success'])->toBeTrue();

            assertAdminMailQueued($admin);
        });

        it('queues volunteer auto-close emails', function (): void {
            $volunteer = getTestVolunteer();
            $timeSlot = getTestTimeSlot();
            $rsvp = createExpiredRsvp();
            $rsvp->responses()->create([
                'volunteer_id' => $volunteer->volunteer_id,
                'time_slot_id' => $timeSlot->time_slot_id,
            ]);

            $service = app(App\Services\RsvpAutoCloseService::class);
            $result = $service->closeSingleRsvp($rsvp);

            expect($result['success'])->toBeTrue();

            assertVolunteerMailQueued($volunteer);
        });

        it('creates admin notifications when closing', function (): void {
            $admin = getTestAdmin();
            $rsvp = createExpiredRsvp();

            $service = app(App\Services\RsvpAutoCloseService::class);
            $service->closeSingleRsvp($rsvp);

            assertAdminNotificationExists($rsvp, $admin);
        });

        it('creates volunteer notifications when closing', function (): void {
            $volunteer = getTestVolunteer();
            $timeSlot = getTestTimeSlot();
            $rsvp = createExpiredRsvp();
            $rsvp->responses()->create([
                'volunteer_id' => $volunteer->volunteer_id,
                'time_slot_id' => $timeSlot->time_slot_id,
            ]);

            $service = app(App\Services\RsvpAutoCloseService::class);
            $service->closeSingleRsvp($rsvp);

            assertVolunteerNotificationExists($rsvp, $volunteer);
        });

        it('has correct notification counts after batch close', function (): void {
            $admin = getTestAdmin();
            $volunteer1 = getTestVolunteer();
            $volunteer2 = getTestVolunteer();
            $timeSlot = getTestTimeSlot();

            $rsvp1 = createExpiredRsvp(['title' => 'Event 1']);
            $rsvp1->responses()->create([
                'volunteer_id' => $volunteer1->volunteer_id,
                'time_slot_id' => $timeSlot->time_slot_id,
            ]);
            $rsvp1->responses()->create([
                'volunteer_id' => $volunteer2->volunteer_id,
                'time_slot_id' => $timeSlot->time_slot_id,
            ]);

            $service = app(App\Services\RsvpAutoCloseService::class);
            $results = $service->closeExpiredRsvps();

            expect($results['closed_count'])->toBe(1);

            expect(
                RsvpNotification::where('rsvp_id', $rsvp1->rsvp_id)
                    ->where('type', 'event_auto_closed')
                    ->count()
            )->toBe(3);
        });
    });

    describe('closeExpiredRsvp command', function (): void {
        it('closes expired RSVPs and reports results', function (): void {
            $rsvp1 = createExpiredRsvp(['title' => 'Event 1']);
            $rsvp2 = createExpiredRsvp(['title' => 'Event 2']);

            artisan('rsvp:close-expired')
                ->assertExitCode(0)
                ->expectsOutput('Auto-closed 2 RSVP event(s).');
        });

        it('reports when no RSVPs need closing', function (): void {
            createActiveRsvpWithFutureCutoff();

            artisan('rsvp:close-expired')
                ->assertExitCode(0)
                ->expectsOutput('No RSVP events needed to be auto-closed.');
        });
    });

    describe('getExpiredRsvps query', function (): void {
        it('finds RSVPs with past cutoff', function (): void {
            $expiredRsvp = createExpiredRsvp();
            $activeRsvp = createActiveRsvpWithFutureCutoff();

            $service = app(App\Services\RsvpAutoCloseService::class);
            $expiredRsvps = $service->getExpiredRsvps();

            expect($expiredRsvps->pluck('rsvp_id'))->toContain($expiredRsvp->rsvp_id);
            expect($expiredRsvps->pluck('rsvp_id'))->not->toContain($activeRsvp->rsvp_id);
        });
    });
});
