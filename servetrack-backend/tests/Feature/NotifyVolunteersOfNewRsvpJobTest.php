<?php

use App\Jobs\NotifyVolunteersOfNewRsvp;
use App\Mail\RsvpEventCreatedMail;
use App\Models\Rsvp;
use App\Models\User;
use App\Models\Volunteer;
use Illuminate\Support\Facades\Mail;

it('creates notifications for all active volunteers and sends emails if preferred', function () {
    Mail::fake();

    $rsvp = Rsvp::factory()->create([
        'title' => 'Test RSVP',
        'date' => now()->addDays(5),
    ]);

    // Active volunteer, wants email
    $user1 = User::factory()->volunteer()->create();
    $vol1 = Volunteer::factory()->create(['user_id' => $user1->id, 'notify_rsvp_on_email' => true]);

    // Active volunteer, no email
    $user2 = User::factory()->volunteer()->create();
    $vol2 = Volunteer::factory()->create(['user_id' => $user2->id, 'notify_rsvp_on_email' => false]);

    // Inactive volunteer (deleted user)
    $user3 = User::factory()->volunteer()->create(['deleted_at' => now()]);
    $vol3 = Volunteer::factory()->create(['user_id' => $user3->id]);

    // Inactive volunteer (deleted volunteer)
    $user4 = User::factory()->volunteer()->create();
    $vol4 = Volunteer::factory()->create(['user_id' => $user4->id, 'deleted_at' => now()]);

    $job = new NotifyVolunteersOfNewRsvp($rsvp);
    $job->handle();

    // Check notifications
    $this->assertDatabaseHas('rsvp_notification', [
        'volunteer_id' => $vol1->volunteer_id,
        'rsvp_id' => $rsvp->rsvp_id,
        'email_sent' => 1,
    ]);

    $this->assertDatabaseHas('rsvp_notification', [
        'volunteer_id' => $vol2->volunteer_id,
        'rsvp_id' => $rsvp->rsvp_id,
        'email_sent' => 0,
    ]);

    $this->assertDatabaseMissing('rsvp_notification', [
        'volunteer_id' => $vol3->volunteer_id,
        'rsvp_id' => $rsvp->rsvp_id,
    ]);

    $this->assertDatabaseMissing('rsvp_notification', [
        'volunteer_id' => $vol4->volunteer_id,
        'rsvp_id' => $rsvp->rsvp_id,
    ]);

    Mail::assertQueued(RsvpEventCreatedMail::class, 1);
});
