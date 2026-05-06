<?php

use App\Models\Admin;
use App\Models\Rsvp;
use App\Models\RsvpAuditTrail;
use App\Models\RsvpResponse;
use App\Models\TimeSlot;
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

        it('does not close an RSVP when cutoff is in the future', function (): void {
            $rsvp = createActiveRsvpWithFutureCutoff();

            $service = app(App\Services\RsvpAutoCloseService::class);
            $shouldClose = $service->shouldAutoClose($rsvp);

            expect($shouldClose)->toBeFalse();
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

        it('does not re-close an already closed RSVP', function (): void {
            $rsvp = createExpiredRsvp(['status' => 'closed', 'auto_closed_at' => now()]);

            $service = app(App\Services\RsvpAutoCloseService::class);
            $shouldClose = $service->shouldAutoClose($rsvp);

            expect($shouldClose)->toBeFalse();
        });

        it('does not close a draft RSVP even if cutoff passed', function (): void {
            $rsvp = createExpiredRsvp(['status' => 'draft']);

            $service = app(App\Services\RsvpAutoCloseService::class);
            $result = $service->closeSingleRsvp($rsvp);

            expect($result['success'])->toBeFalse();
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

    describe('notifications', function (): void {
        it('sends notification to volunteers who RSVPd', function (): void {
            $rsvp = createExpiredRsvp();
            $volunteer = Volunteer::factory()->create();
            $timeSlot = TimeSlot::factory()->create();

            $rsvp->shifts()->attach($timeSlot->time_slot_id, [
                'time_slot' => '9:00 AM - 1:00 PM',
                'capacity' => 10,
            ]);

            RsvpResponse::factory()->create([
                'volunteer_id' => $volunteer->volunteer_id,
                'rsvp_id' => $rsvp->rsvp_id,
                'time_slot_id' => $timeSlot->time_slot_id,
            ]);

            $service = app(App\Services\RsvpAutoCloseService::class);
            $service->closeSingleRsvp($rsvp);

            Mail::assertQueued(App\Mail\RsvpAutoClosedVolunteerMail::class, function ($mail) use ($volunteer): bool {
                return $mail->volunteer->volunteer_id === $volunteer->volunteer_id;
            });
        });

        it('sends notification to all admins', function (): void {
            $rsvp = createExpiredRsvp();
            $admin = Admin::factory()->create();

            $service = app(App\Services\RsvpAutoCloseService::class);
            $service->closeSingleRsvp($rsvp);

            Mail::assertQueued(App\Mail\RsvpAutoClosedAdminMail::class, function ($mail) use ($admin): bool {
                return $mail->admin->admin_id === $admin->admin_id;
            });
        });
    });
});
