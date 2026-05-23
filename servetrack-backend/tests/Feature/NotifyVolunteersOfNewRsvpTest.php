<?php

use App\Jobs\NotifyVolunteersOfNewRsvp;
use App\Mail\RsvpEventCreatedMail;
use App\Models\Rsvp;
use App\Models\RsvpNotification;
use App\Models\User;
use App\Models\Volunteer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;

uses(RefreshDatabase::class);

test('sends notification and email to all active volunteers', function () {
    Mail::fake();

    $rsvp = Rsvp::factory()->active()->create();
    $volunteer1 = Volunteer::factory()->create(['notify_rsvp_on_email' => true]);
    $volunteer2 = Volunteer::factory()->create(['notify_rsvp_on_email' => true]);

    $job = new NotifyVolunteersOfNewRsvp($rsvp);
    $job->handle();

    expect(RsvpNotification::query()->count())->toBe(2);

    foreach ([$volunteer1, $volunteer2] as $volunteer) {
        $notification = RsvpNotification::query()
            ->where('volunteer_id', $volunteer->volunteer_id)
            ->where('rsvp_id', $rsvp->rsvp_id)
            ->first();

        expect($notification)->not->toBeNull();
        expect($notification->type)->toBe('event_created');
        expect($notification->email_sent)->toBeTrue();
    }

    Mail::assertQueued(RsvpEventCreatedMail::class, 2);
});

test('does not send email to volunteers who opted out of email notifications', function () {
    Mail::fake();

    $rsvp = Rsvp::factory()->active()->create();
    Volunteer::factory()->create(['notify_rsvp_on_email' => false]);

    $job = new NotifyVolunteersOfNewRsvp($rsvp);
    $job->handle();

    $notification = RsvpNotification::query()->first();
    expect($notification)->not->toBeNull();
    expect($notification->email_sent)->toBeFalse();

    Mail::assertNotQueued(RsvpEventCreatedMail::class);
});

test('skips soft-deleted volunteers', function () {
    Mail::fake();

    $rsvp = Rsvp::factory()->active()->create();
    $volunteer = Volunteer::factory()->create(['notify_rsvp_on_email' => true]);
    $volunteer->delete();

    $job = new NotifyVolunteersOfNewRsvp($rsvp);
    $job->handle();

    expect(RsvpNotification::query()->count())->toBe(0);
    Mail::assertNotQueued(RsvpEventCreatedMail::class);
});

test('skips volunteers whose user is soft-deleted', function () {
    Mail::fake();

    $rsvp = Rsvp::factory()->active()->create();
    $user = User::factory()->volunteer()->create();
    $volunteer = Volunteer::factory()->create([
        'user_id' => $user->id,
        'notify_rsvp_on_email' => true,
    ]);
    $user->delete();

    $job = new NotifyVolunteersOfNewRsvp($rsvp);
    $job->handle();

    expect(RsvpNotification::query()->count())->toBe(0);
    Mail::assertNotQueued(RsvpEventCreatedMail::class);
});

test('does not send email to volunteers without an email address', function () {
    Mail::fake();

    $rsvp = Rsvp::factory()->active()->create();
    Volunteer::factory()->create([
        'email' => null,
        'notify_rsvp_on_email' => true,
    ]);

    $job = new NotifyVolunteersOfNewRsvp($rsvp);
    $job->handle();

    $notification = RsvpNotification::query()->first();
    expect($notification)->not->toBeNull();
    expect($notification->email_sent)->toBeFalse();

    Mail::assertNotQueued(RsvpEventCreatedMail::class);
});
