<?php

use App\Models\Attendance;
use App\Models\Location;
use App\Models\Rsvp;
use App\Models\RsvpResponse;
use App\Models\TimeSlot;
use App\Models\User;
use App\Models\Volunteer;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

describe('Admin Attendance Management', function (): void {
    beforeEach(function (): void {
        $this->admin = User::factory()->admin()->create();
        $this->actingAs($this->admin);

        $this->volunteer = Volunteer::factory()->create();
        $this->location = Location::factory()->create();
        $this->rsvp = Rsvp::factory()->create([
            'status' => 'active',
            'date' => now()->toDateString(),
            'location_id' => $this->location->location_id,
            'event_location' => $this->location->full_address,
        ]);
        $this->shift = TimeSlot::factory()->create([
            'text' => '08:00 AM - 12:00 PM',
        ]);
        // Attach shift to RSVP
        $this->rsvp->shifts()->attach($this->shift->time_slot_id, [
            'time_slot' => $this->shift->text,
            'capacity' => 10,
        ]);

        $this->rsvpResponse = RsvpResponse::factory()->create([
            'rsvp_id' => $this->rsvp->rsvp_id,
            'volunteer_id' => $this->volunteer->volunteer_id,
            'time_slot_id' => $this->shift->time_slot_id,
        ]);
    });

    it('returns attendance list for RSVP', function (): void {
        $this->getJson("/api/admin/attendance-from-rsvp?rsvp_id={$this->rsvp->rsvp_id}")
            ->assertSuccessful()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.rsvp_title', $this->rsvp->title);
    });

    it('handles missing volunteer in attendance list', function (): void {
        // Soft delete the volunteer record to simulate a missing relation
        $this->volunteer->delete();

        $this->getJson("/api/admin/attendance-from-rsvp?rsvp_id={$this->rsvp->rsvp_id}")
            ->assertSuccessful()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.volunteer_name', '')
            ->assertJsonPath('data.0.volunteer_email', '')
            ->assertJsonPath('data.0.volunteer_department', 'Unassigned');
    });

    it('updates attendance status to present', function (): void {
        $this->postJson('/api/admin/attendance-status', [
            'rsvp_response_id' => $this->rsvpResponse->rsvp_response_id,
            'status' => 'present',
        ])
            ->assertSuccessful()
            ->assertJsonPath('data.status', 'present')
            ->assertJsonPath('data.hours', 4);

        $this->rsvpResponse->refresh();
        expect($this->rsvpResponse->attendance_status)->toBe('checked_in');

        $attendance = Attendance::where('rsvp_response_id', $this->rsvpResponse->rsvp_response_id)->first();
        expect($attendance)->not->toBeNull();
        expect($attendance->status)->toBe('approved');
        expect((float) $attendance->hours)->toBe(4.0);
    });

    it('updates attendance status to absent', function (): void {
        $this->postJson('/api/admin/attendance-status', [
            'rsvp_response_id' => $this->rsvpResponse->rsvp_response_id,
            'status' => 'absent',
        ])
            ->assertSuccessful()
            ->assertJsonPath('data.status', 'absent')
            ->assertJsonPath('data.hours', 4);

        $this->rsvpResponse->refresh();
        expect($this->rsvpResponse->attendance_status)->toBe('no_show');

        $attendance = Attendance::where('rsvp_response_id', $this->rsvpResponse->rsvp_response_id)->first();
        expect($attendance)->not->toBeNull();
        expect($attendance->status)->toBe('rejected');
    });
});

describe('RSVP Non-Responders', function (): void {
    beforeEach(function (): void {
        $this->admin = User::factory()->admin()->create();
        $this->actingAs($this->admin);

        $this->location = Location::factory()->create();
        $this->rsvp = Rsvp::factory()->create([
            'status' => 'active',
            'location_id' => $this->location->location_id,
        ]);

        // 3 volunteers; only 1 responds
        $this->responder = Volunteer::factory()->create(['first_name' => 'Alice', 'last_name' => 'Smith']);
        $this->nonResponder1 = Volunteer::factory()->create(['first_name' => 'Bob',   'last_name' => 'Jones']);
        $this->nonResponder2 = Volunteer::factory()->create(['first_name' => 'Carol', 'last_name' => 'White']);

        $shift = TimeSlot::factory()->create();
        RsvpResponse::factory()->create([
            'rsvp_id' => $this->rsvp->rsvp_id,
            'volunteer_id' => $this->responder->volunteer_id,
            'time_slot_id' => $shift->time_slot_id,
        ]);
    });

    it('returns volunteers who have not responded', function (): void {
        $this->getJson("/api/admin/rsvp-non-responders?rsvp_id={$this->rsvp->rsvp_id}")
            ->assertSuccessful()
            ->assertJsonPath('meta.total', 2)
            ->assertJsonMissing(['volunteer_name' => 'Alice Smith']);
    });

    it('filters non-responders by search', function (): void {
        $this->getJson("/api/admin/rsvp-non-responders?rsvp_id={$this->rsvp->rsvp_id}&search=Bob")
            ->assertSuccessful()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.volunteer_name', 'Bob Jones');
    });

    it('paginates non-responders', function (): void {
        $this->getJson("/api/admin/rsvp-non-responders?rsvp_id={$this->rsvp->rsvp_id}&per_page=1&page=1")
            ->assertSuccessful()
            ->assertJsonPath('meta.last_page', 2)
            ->assertJsonCount(1, 'data');
    });

    it('returns 403 for non-admin', function (): void {
        $volunteer = Volunteer::factory()->create();
        $user = User::factory()->create(['role' => 'volunteer']);
        $this->actingAs($user);

        $this->getJson("/api/admin/rsvp-non-responders?rsvp_id={$this->rsvp->rsvp_id}")
            ->assertForbidden();
    });

    it('returns 422 for missing rsvp_id', function (): void {
        $this->getJson('/api/admin/rsvp-non-responders')
            ->assertUnprocessable();
    });
});
