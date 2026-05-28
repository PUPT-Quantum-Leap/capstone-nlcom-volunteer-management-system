<?php

use App\Jobs\SendEmailBroadcastJob;
use App\Mail\BroadcastMail;
use App\Models\Rsvp;
use App\Models\RsvpResponse;
use App\Models\User;
use App\Models\Volunteer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->admin = User::factory()->admin()->create();
    $this->actingAs($this->admin);
});

test('admin can dispatch broadcast to all active volunteers', function (): void {
    Queue::fake();

    $volunteer1 = Volunteer::factory()->create(['email' => 'v1@example.com']);
    $volunteer2 = Volunteer::factory()->create(['email' => 'v2@example.com']);

    $response = $this->postJson('/api/email/broadcast', [
        'audience' => 'all',
        'message' => 'Hello volunteers, this is a test broadcast.',
    ]);

    $response->assertSuccessful()
        ->assertJson([
            'success' => true,
            'message' => 'Email broadcast has been queued successfully.',
        ]);

    Queue::assertPushed(SendEmailBroadcastJob::class, function ($job) {
        return $job->audience === 'all' && $job->messageBody === 'Hello volunteers, this is a test broadcast.';
    });
});

test('job queues BroadcastMail to target audience: all', function (): void {
    Mail::fake();

    $volunteer1 = Volunteer::factory()->create(['email' => 'v1@example.com']);
    $volunteer2 = Volunteer::factory()->create(['email' => 'v2@example.com']);

    // Call job directly
    $job = new SendEmailBroadcastJob('all', 'Broadcast content');
    $job->handle();

    Mail::assertQueued(BroadcastMail::class, 2);
    Mail::assertQueued(BroadcastMail::class, fn ($mail) => $mail->hasTo('v1@example.com'));
    Mail::assertQueued(BroadcastMail::class, fn ($mail) => $mail->hasTo('v2@example.com'));
});

test('job queues BroadcastMail to target audience: voted', function (): void {
    Mail::fake();

    $rsvp = Rsvp::factory()->active()->create();
    $volunteerVoted = Volunteer::factory()->create(['email' => 'voted@example.com']);
    $volunteerNotVoted = Volunteer::factory()->create(['email' => 'notvoted@example.com']);

    RsvpResponse::factory()->create([
        'rsvp_id' => $rsvp->rsvp_id,
        'volunteer_id' => $volunteerVoted->volunteer_id,
    ]);

    $job = new SendEmailBroadcastJob('voted', 'Voted only message', $rsvp->rsvp_id);
    $job->handle();

    Mail::assertQueued(BroadcastMail::class, 1);
    Mail::assertQueued(BroadcastMail::class, fn ($mail) => $mail->hasTo('voted@example.com'));
    Mail::assertNotQueued(BroadcastMail::class, fn ($mail) => $mail->hasTo('notvoted@example.com'));
});

test('job queues BroadcastMail to target audience: not_voted', function (): void {
    Mail::fake();

    $rsvp = Rsvp::factory()->active()->create();
    $volunteerVoted = Volunteer::factory()->create(['email' => 'voted@example.com']);
    $volunteerNotVoted = Volunteer::factory()->create(['email' => 'notvoted@example.com']);

    RsvpResponse::factory()->create([
        'rsvp_id' => $rsvp->rsvp_id,
        'volunteer_id' => $volunteerVoted->volunteer_id,
    ]);

    $job = new SendEmailBroadcastJob('not_voted', 'Not voted message', $rsvp->rsvp_id);
    $job->handle();

    Mail::assertQueued(BroadcastMail::class, 1);
    Mail::assertQueued(BroadcastMail::class, fn ($mail) => $mail->hasTo('notvoted@example.com'));
    Mail::assertNotQueued(BroadcastMail::class, fn ($mail) => $mail->hasTo('voted@example.com'));
});

test('validation fails when audience is voted or not_voted but rsvp_id is missing', function (): void {
    $response = $this->postJson('/api/email/broadcast', [
        'audience' => 'voted',
        'message' => 'Test message',
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['rsvp_id']);
});

test('non-admin is forbidden from broadcasting', function (): void {
    $volunteer = User::factory()->volunteer()->create();

    $this->actingAs($volunteer)
        ->postJson('/api/email/broadcast', [
            'audience' => 'all',
            'message' => 'Hello volunteers',
        ])
        ->assertForbidden();
});
