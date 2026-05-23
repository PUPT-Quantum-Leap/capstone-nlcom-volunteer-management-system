<?php

use App\Jobs\SendCutoffReminderJob;
use App\Mail\RsvpCutoffReminderMail;
use App\Models\Rsvp;
use App\Models\RsvpResponse;
use App\Models\Volunteer;
use App\Services\RsvpCutoffReminderService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Mail;

use function Pest\Laravel\assertDatabaseHas;

uses(RefreshDatabase::class);

test(
    'reminder service finds rsvps needing reminders within 24 hours',
    function () {
        // Create RSVP with cutoff in 12 hours
        $rsvpNeedingReminder = Rsvp::factory()->create([
            'status' => 'active',
            'cutoff_day' => Carbon::now()->addHours(12)->format('Y-m-d'),
            'cutoff_time' => Carbon::now()->addHours(12)->format('H:i:s'),
        ]);

        // Create RSVP with cutoff in 48 hours (should not be included)
        $rsvpNotNeedingReminder = Rsvp::factory()->create([
            'status' => 'active',
            'cutoff_day' => Carbon::now()->addHours(48)->format('Y-m-d'),
            'cutoff_time' => Carbon::now()->addHours(48)->format('H:i:s'),
        ]);

        // Create volunteer responses
        $volunteer = Volunteer::factory()->create();
        RsvpResponse::factory()->create([
            'rsvp_id' => $rsvpNeedingReminder->rsvp_id,
            'volunteer_id' => $volunteer->volunteer_id,
        ]);

        $service = new RsvpCutoffReminderService;
        $rsvpsNeedingReminders = $service->getRsvpsNeedingReminders();

        expect($rsvpsNeedingReminders)->toHaveCount(1);
        expect($rsvpsNeedingReminders->first()->rsvp_id)->toBe($rsvpNeedingReminder->rsvp_id);
    });

test('reminder service only includes rsvps with volunteer responses', function () {
    // Create RSVP with cutoff in 12 hours but no responses
    $rsvpNoResponses = Rsvp::factory()->create([
        'status' => 'active',
        'cutoff_day' => Carbon::now()->addHours(12)->format('Y-m-d'),
        'cutoff_time' => Carbon::now()->addHours(12)->format('H:i:s'),
    ]);

    $service = new RsvpCutoffReminderService;
    $rsvpsNeedingReminders = $service->getRsvpsNeedingReminders();

    expect($rsvpsNeedingReminders)->toHaveCount(0);
});

test('reminder service excludes volunteers who already received reminders', function () {
    $rsvp = Rsvp::factory()->create([
        'status' => 'active',
        'cutoff_day' => Carbon::now()->addHours(12)->format('Y-m-d'),
        'cutoff_time' => Carbon::now()->addHours(12)->format('H:i:s'),
    ]);

    $volunteer1 = Volunteer::factory()->create();
    $volunteer2 = Volunteer::factory()->create();

    // Create responses - one already reminded, one not
    RsvpResponse::factory()->create([
        'rsvp_id' => $rsvp->rsvp_id,
        'volunteer_id' => $volunteer1->volunteer_id,
        'cutoff_reminder_sent_at' => Carbon::now()->subHour(), // Already reminded
    ]);

    RsvpResponse::factory()->create([
        'rsvp_id' => $rsvp->rsvp_id,
        'volunteer_id' => $volunteer2->volunteer_id,
        'cutoff_reminder_sent_at' => null, // Not reminded yet
    ]);

    $service = new RsvpCutoffReminderService;

    // Use reflection to test protected method
    $reflection = new ReflectionClass($service);
    $method = $reflection->getMethod('getVolunteersToRemind');
    $method->setAccessible(true);

    $volunteersToRemind = $method->invoke($service, $rsvp);

    expect($volunteersToRemind)->toHaveCount(1);
    expect($volunteersToRemind->first()->volunteer_id)->toBe($volunteer2->volunteer_id);
});

test('send cutoff reminders processes correctly', function () {
    Bus::fake();

    $rsvp = Rsvp::factory()->create([
        'status' => 'active',
        'cutoff_day' => Carbon::now()->addHours(12)->format('Y-m-d'),
        'cutoff_time' => Carbon::now()->addHours(12)->format('H:i:s'),
    ]);

    $volunteer = Volunteer::factory()->create();
    $response = RsvpResponse::factory()->create([
        'rsvp_id' => $rsvp->rsvp_id,
        'volunteer_id' => $volunteer->volunteer_id,
    ]);

    $service = new RsvpCutoffReminderService;
    $results = $service->sendCutoffReminders();

    expect($results['rsvps_processed'])->toBe(1);
    expect($results['volunteers_notified'])->toBe(1);
    expect($results['jobs_queued'])->toBe(1);

    Bus::assertDispatched(SendCutoffReminderJob::class, function ($job) use ($rsvp, $volunteer) {
        return $job->rsvp->rsvp_id === $rsvp->rsvp_id &&
               $job->volunteer->volunteer_id === $volunteer->volunteer_id;
    });

    // Check that reminder was marked as sent
    $response->refresh();
    expect($response->cutoff_reminder_sent_at)->not->toBeNull();

    // Check notification record was created
    assertDatabaseHas('rsvp_notification', [
        'volunteer_id' => $volunteer->volunteer_id,
        'rsvp_id' => $rsvp->rsvp_id,
        'type' => 'reminder',
    ]);
});

test('send cutoff reminder job sends email correctly', function () {
    Mail::fake();

    $rsvp = Rsvp::factory()->create();
    $volunteer = Volunteer::factory()->create(['email' => 'test@example.com']);

    $job = new SendCutoffReminderJob($rsvp, $volunteer, '12 hours');
    $job->handle();

    Mail::assertQueued(RsvpCutoffReminderMail::class, function ($mail) use ($rsvp, $volunteer) {
        return $mail->hasTo('test@example.com') &&
               $mail->rsvp->rsvp_id === $rsvp->rsvp_id &&
               $mail->volunteer->volunteer_id === $volunteer->volunteer_id;
    });
});

test('send cutoff reminder job skips volunteers without email', function () {
    Mail::fake();

    $rsvp = Rsvp::factory()->create();
    $volunteer = Volunteer::factory()->create(['email' => null]);

    $job = new SendCutoffReminderJob($rsvp, $volunteer, '12 hours');
    $job->handle();

    Mail::assertNotSent(RsvpCutoffReminderMail::class);
});

test('console command runs successfully', function () {
    $this->artisan('rsvp:send-cutoff-reminders')
        ->assertExitCode(0);
});

test('console command dry run shows what would be sent', function () {
    $rsvp = Rsvp::factory()->create([
        'status' => 'active',
        'cutoff_day' => Carbon::now()->addHours(12)->format('Y-m-d'),
        'cutoff_time' => Carbon::now()->addHours(12)->format('H:i:s'),
    ]);

    $volunteer = Volunteer::factory()->create();
    RsvpResponse::factory()->create([
        'rsvp_id' => $rsvp->rsvp_id,
        'volunteer_id' => $volunteer->volunteer_id,
    ]);

    $this->artisan('rsvp:send-cutoff-reminders', ['--dry-run' => true])
        ->assertExitCode(0)
        ->expectsOutput('🔍 DRY RUN MODE - No emails will be sent')
        ->expectsOutput('📋 Found 1 RSVP event(s) that need reminders:');
});

test('time remaining calculation works correctly', function () {
    $service = new RsvpCutoffReminderService;

    // Test various time differences
    $cases = [
        ['hours' => 23, 'expected' => ['23 hour', '22 hour']], // Allow 22-23 hours due to execution time
        ['hours' => 1, 'expected' => ['1 hour', '59 minute']], // Allow 1 hour or 59 minutes
        ['hours' => 0, 'minutes' => 30, 'expected' => ['30 minute', '29 minute']], // Allow 29-30 minutes
        ['days' => 1, 'hours' => 5, 'expected' => ['1 day', '23 hour']], // Allow 1 day or 23 hours
        ['days' => 2, 'expected' => ['2 day', '1 day']], // Allow 2 days or 1 day
    ];

    foreach ($cases as $case) {
        $rsvp = Rsvp::factory()->create([
            'cutoff_day' => Carbon::now()
                ->addDays($case['days'] ?? 0)
                ->addHours($case['hours'] ?? 0)
                ->addMinutes($case['minutes'] ?? 0)
                ->format('Y-m-d'),
            'cutoff_time' => Carbon::now()
                ->addDays($case['days'] ?? 0)
                ->addHours($case['hours'] ?? 0)
                ->addMinutes($case['minutes'] ?? 0)
                ->format('H:i:s'),
        ]);

        // Use reflection to test protected method
        $reflection = new ReflectionClass($service);
        $method = $reflection->getMethod('calculateTimeRemaining');
        $method->setAccessible(true);

        $result = $method->invoke($service, $rsvp);

        // Check if result contains any of the expected values
        $found = false;
        foreach ($case['expected'] as $expected) {
            if (str_contains($result, $expected)) {
                $found = true;
                break;
            }
        }

        expect($found)->toBeTrue('Time calculation failed. Expected one of: '.implode(', ', $case['expected']).". Got: $result");
    }
});

test('needs reminder check works correctly', function () {
    $service = new RsvpCutoffReminderService;

    // RSVP that needs reminder
    $rsvpNeedingReminder = Rsvp::factory()->create([
        'status' => 'active',
        'cutoff_day' => Carbon::now()->addHours(12)->format('Y-m-d'),
        'cutoff_time' => Carbon::now()->addHours(12)->format('H:i:s'),
    ]);

    $volunteer = Volunteer::factory()->create();
    RsvpResponse::factory()->create([
        'rsvp_id' => $rsvpNeedingReminder->rsvp_id,
        'volunteer_id' => $volunteer->volunteer_id,
    ]);

    expect($service->needsReminder($rsvpNeedingReminder))->toBeTrue();

    // RSVP that doesn't need reminder (cutoff passed)
    $rsvpPassed = Rsvp::factory()->create([
        'status' => 'active',
        'cutoff_day' => Carbon::now()->subHour()->format('Y-m-d'),
        'cutoff_time' => Carbon::now()->subHour()->format('H:i:s'),
    ]);

    expect($service->needsReminder($rsvpPassed))->toBeFalse();

    // RSVP that doesn't need reminder (no responses)
    $rsvpNoResponses = Rsvp::factory()->create([
        'status' => 'active',
        'cutoff_day' => Carbon::now()->addHours(12)->format('Y-m-d'),
        'cutoff_time' => Carbon::now()->addHours(12)->format('H:i:s'),
    ]);

    expect($service->needsReminder($rsvpNoResponses))->toBeFalse();
});
