<?php

use App\Models\Rsvp;
use App\Models\RsvpResponse;
use App\Models\TimeSlot;
use App\Models\User;
use App\Models\Volunteer;

function createRsvpWithShifts(array $rsvpAttributes = []): array
{
    $rsvp = Rsvp::factory()->create($rsvpAttributes);

    $shifts = [];
    foreach (['4:30am - 2:00pm', '1:00pm - 7:00pm'] as $slot) {
        $timeSlot = TimeSlot::factory()->create(['text' => $slot]);
        $rsvp->shifts()->attach($timeSlot->time_slot_id, [
            'time_slot' => $slot,
            'capacity' => 10,
        ]);
        $shifts[] = $timeSlot;
    }

    return ['rsvp' => $rsvp->load('shifts'), 'shifts' => $shifts];
}

describe('GET /api/rsvp', function (): void {
    it('returns all rsvps for admins regardless of status', function (): void {
        $admin = User::factory()->admin()->create();
        Rsvp::factory()->active()->create(['title' => 'Active RSVP']);
        Rsvp::factory()->create(['title' => 'Draft RSVP', 'status' => 'draft']);
        Rsvp::factory()->closed()->create(['title' => 'Closed RSVP']);

        $this->actingAs($admin)
            ->getJson('/api/rsvp')
            ->assertSuccessful()
            ->assertJsonCount(3, 'data');
    });

    it('returns only active rsvps for volunteers', function (): void {
        $volunteer = User::factory()->volunteer()->create();
        Rsvp::factory()->active()->create();
        Rsvp::factory()->create(['status' => 'draft']);
        Rsvp::factory()->closed()->create();

        $this->actingAs($volunteer)
            ->getJson('/api/rsvp')
            ->assertSuccessful()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.status', 'active');
    });

    it('requires authentication', function (): void {
        $this->getJson('/api/rsvp')->assertUnauthorized();
    });

    it('returns expected rsvp shape', function (): void {
        $admin = User::factory()->admin()->create();
        createRsvpWithShifts(['status' => 'active']);

        $this->actingAs($admin)
            ->getJson('/api/rsvp')
            ->assertSuccessful()
            ->assertJsonStructure([
                'data' => [
                    '*' => [
                        'id', 'title', 'description', 'date', 'eventLocation',
                        'cutOffDay', 'cutOffTime', 'status',
                        'totalResponses', 'createdAt',
                        'shifts' => [
                            '*' => ['id', 'text', 'timeSlot', 'capacity', 'responses'],
                        ],
                    ],
                ],
            ]);
    });
});

describe('GET /api/rsvp/{id}', function (): void {
    it('returns a single rsvp with shifts', function (): void {
        $admin = User::factory()->admin()->create();
        ['rsvp' => $rsvp] = createRsvpWithShifts(['status' => 'active']);

        $this->actingAs($admin)
            ->getJson("/api/rsvp/{$rsvp->rsvp_id}")
            ->assertSuccessful()
            ->assertJsonPath('data.id', $rsvp->rsvp_id)
            ->assertJsonStructure(['data' => ['id', 'shifts']]);
    });

    it('returns 404 for a missing rsvp', function (): void {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)
            ->getJson('/api/rsvp/99999')
            ->assertNotFound();
    });
});

describe('POST /api/rsvp', function (): void {
    it('allows admins to create an rsvp', function (): void {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)
            ->postJson('/api/rsvp', [
                'title' => 'Mobile Kitchen Operations',
                'description' => 'Pick your preferred shift.',
                'date' => '2026-09-27',
                'event_location' => 'Barangay Hall',
                'cutoff_day' => '2026-09-26',
                'cutoff_time' => '12:00',
                'shifts' => [
                    ['text' => '4:30am - 2:00pm', 'time_slot' => '4:30am - 2:00pm', 'capacity' => 15],
                    ['text' => '1:00pm - 7:00pm', 'time_slot' => '1:00pm - 7:00pm', 'capacity' => 10],
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('data.title', 'Mobile Kitchen Operations')
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonCount(2, 'data.shifts');
    });

    it('forbids volunteers from creating rsvps', function (): void {
        $volunteer = User::factory()->volunteer()->create();

        $this->actingAs($volunteer)
            ->postJson('/api/rsvp', [
                'title' => 'Rogue RSVP',
                'date' => '2026-09-27',
                'cutoff_day' => '2026-09-26',
                'cutoff_time' => '12:00',
                'shifts' => [
                    ['text' => 'Morning', 'time_slot' => '8am - 12pm', 'capacity' => 5],
                ],
            ])
            ->assertForbidden();
    });

    it('validates required fields', function (): void {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)
            ->postJson('/api/rsvp', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['title', 'date', 'cutoff_day', 'cutoff_time', 'shifts']);
    });

    it('requires at least one shift', function (): void {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)
            ->postJson('/api/rsvp', [
                'title' => 'No Shifts RSVP',
                'date' => '2026-09-27',
                'cutoff_day' => '2026-09-26',
                'cutoff_time' => '12:00',
                'shifts' => [],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['shifts']);
    });

    it('validates each shift has text, time_slot, and capacity', function (): void {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)
            ->postJson('/api/rsvp', [
                'title' => 'Bad Shifts RSVP',
                'date' => '2026-09-27',
                'cutoff_day' => '2026-09-26',
                'cutoff_time' => '12:00',
                'shifts' => [['capacity' => 0]],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['shifts.0.text', 'shifts.0.time_slot', 'shifts.0.capacity']);
    });
});

describe('PUT /api/rsvp/{id}', function (): void {
    it('allows admins to update an rsvp', function (): void {
        $admin = User::factory()->admin()->create();
        ['rsvp' => $rsvp] = createRsvpWithShifts();

        $this->actingAs($admin)
            ->putJson("/api/rsvp/{$rsvp->rsvp_id}", [
                'title' => 'Updated Title',
                'date' => '2026-10-01',
                'cutoff_day' => '2026-09-30',
                'cutoff_time' => '17:00',
                'shifts' => [
                    ['text' => 'Morning shift', 'time_slot' => '7am - 1pm', 'capacity' => 20],
                ],
            ])
            ->assertSuccessful()
            ->assertJsonPath('data.title', 'Updated Title');
    });

    it('returns 404 when updating a missing rsvp', function (): void {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)
            ->putJson('/api/rsvp/99999', ['title' => 'Ghost'])
            ->assertNotFound();
    });

    it('forbids volunteers from updating rsvps', function (): void {
        $volunteer = User::factory()->volunteer()->create();
        ['rsvp' => $rsvp] = createRsvpWithShifts();

        $this->actingAs($volunteer)
            ->putJson("/api/rsvp/{$rsvp->rsvp_id}", ['title' => 'Hacked'])
            ->assertForbidden();
    });
});

describe('DELETE /api/rsvp/{id}', function (): void {
    it('allows admins to delete an rsvp', function (): void {
        $admin = User::factory()->admin()->create();
        $rsvp = Rsvp::factory()->create();

        $this->actingAs($admin)
            ->deleteJson("/api/rsvp/{$rsvp->rsvp_id}")
            ->assertSuccessful()
            ->assertJsonPath('message', 'RSVP deleted successfully.');

        $this->assertDatabaseMissing('rsvp', ['rsvp_id' => $rsvp->rsvp_id]);
    });

    it('returns 404 when deleting a missing rsvp', function (): void {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)
            ->deleteJson('/api/rsvp/99999')
            ->assertNotFound();
    });

    it('forbids volunteers from deleting rsvps', function (): void {
        $volunteer = User::factory()->volunteer()->create();
        $rsvp = Rsvp::factory()->create();

        $this->actingAs($volunteer)
            ->deleteJson("/api/rsvp/{$rsvp->rsvp_id}")
            ->assertForbidden();
    });
});

describe('PATCH /api/rsvp/{id}/status', function (): void {
    it('allows admins to change rsvp status', function (): void {
        $admin = User::factory()->admin()->create();
        $rsvp = Rsvp::factory()->create(['status' => 'draft']);

        $this->actingAs($admin)
            ->patchJson("/api/rsvp/{$rsvp->rsvp_id}/status", ['status' => 'active'])
            ->assertSuccessful()
            ->assertJsonPath('status', 'active');

        $this->assertDatabaseHas('rsvp', ['rsvp_id' => $rsvp->rsvp_id, 'status' => 'active']);
    });

    it('rejects invalid status values', function (): void {
        $admin = User::factory()->admin()->create();
        $rsvp = Rsvp::factory()->create();

        $this->actingAs($admin)
            ->patchJson("/api/rsvp/{$rsvp->rsvp_id}/status", ['status' => 'published'])
            ->assertUnprocessable();
    });

    it('forbids volunteers from changing rsvp status', function (): void {
        $volunteer = User::factory()->volunteer()->create();
        $rsvp = Rsvp::factory()->active()->create();

        $this->actingAs($volunteer)
            ->patchJson("/api/rsvp/{$rsvp->rsvp_id}/status", ['status' => 'closed'])
            ->assertForbidden();
    });
});

describe('POST /api/rsvp/{id}/vote', function (): void {
    it('allows a volunteer to respond to an active rsvp', function (): void {
        $user = User::factory()->volunteer()->create();
        $volunteer = Volunteer::factory()->create(['user_id' => $user->id]);
        ['rsvp' => $rsvp, 'shifts' => $shifts] = createRsvpWithShifts(['status' => 'active']);

        $this->actingAs($user)
            ->postJson("/api/rsvp/{$rsvp->rsvp_id}/vote", ['time_slot_id' => $shifts[0]->time_slot_id])
            ->assertSuccessful()
            ->assertJsonPath('message', 'RSVP recorded successfully.');

        $this->assertDatabaseHas('rsvp_response', [
            'volunteer_id' => $volunteer->volunteer_id,
            'rsvp_id' => $rsvp->rsvp_id,
            'time_slot_id' => $shifts[0]->time_slot_id,
        ]);
    });

    it('rejects a second response from the same volunteer on the same rsvp', function (): void {
        $user = User::factory()->volunteer()->create();
        $volunteer = Volunteer::factory()->create(['user_id' => $user->id]);
        ['rsvp' => $rsvp, 'shifts' => $shifts] = createRsvpWithShifts(['status' => 'active']);

        $this->actingAs($user)
            ->postJson("/api/rsvp/{$rsvp->rsvp_id}/vote", ['time_slot_id' => $shifts[0]->time_slot_id]);

        $this->actingAs($user)
            ->postJson("/api/rsvp/{$rsvp->rsvp_id}/vote", ['time_slot_id' => $shifts[1]->time_slot_id])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'You have already responded to this RSVP.');
    });

    it('rejects responses on a closed rsvp', function (): void {
        $user = User::factory()->volunteer()->create();
        Volunteer::factory()->create(['user_id' => $user->id]);
        ['rsvp' => $rsvp, 'shifts' => $shifts] = createRsvpWithShifts(['status' => 'closed']);

        $this->actingAs($user)
            ->postJson("/api/rsvp/{$rsvp->rsvp_id}/vote", ['time_slot_id' => $shifts[0]->time_slot_id])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'This RSVP is not accepting responses.');
    });

    it('rejects responses on a draft rsvp', function (): void {
        $user = User::factory()->volunteer()->create();
        Volunteer::factory()->create(['user_id' => $user->id]);
        ['rsvp' => $rsvp, 'shifts' => $shifts] = createRsvpWithShifts(['status' => 'draft']);

        $this->actingAs($user)
            ->postJson("/api/rsvp/{$rsvp->rsvp_id}/vote", ['time_slot_id' => $shifts[0]->time_slot_id])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'This RSVP is not accepting responses.');
    });

    it('rejects a response for a shift not belonging to the rsvp', function (): void {
        $user = User::factory()->volunteer()->create();
        Volunteer::factory()->create(['user_id' => $user->id]);
        ['rsvp' => $rsvp] = createRsvpWithShifts(['status' => 'active']);

        $strangerShift = TimeSlot::factory()->create();

        $this->actingAs($user)
            ->postJson("/api/rsvp/{$rsvp->rsvp_id}/vote", ['time_slot_id' => $strangerShift->time_slot_id])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Invalid shift for this RSVP.');
    });

    it('rejects a response when the shift is at full capacity', function (): void {
        $user = User::factory()->volunteer()->create();
        Volunteer::factory()->create(['user_id' => $user->id]);

        $rsvp = Rsvp::factory()->active()->create();
        $timeSlot = TimeSlot::factory()->create(['text' => '4:30am - 2:00pm']);
        $rsvp->shifts()->attach($timeSlot->time_slot_id, [
            'time_slot' => '4:30am - 2:00pm',
            'capacity' => 1,
        ]);

        $otherUser = User::factory()->volunteer()->create();
        $otherVolunteer = Volunteer::factory()->create(['user_id' => $otherUser->id]);
        RsvpResponse::query()->create([
            'volunteer_id' => $otherVolunteer->volunteer_id,
            'rsvp_id' => $rsvp->rsvp_id,
            'time_slot_id' => $timeSlot->time_slot_id,
            'voted_at' => now(),
            'sms_sent' => false,
            'attendance_status' => 'registered',
        ]);

        $this->actingAs($user)
            ->postJson("/api/rsvp/{$rsvp->rsvp_id}/vote", ['time_slot_id' => $timeSlot->time_slot_id])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'This time slot is already at full capacity.');
    });

    it('requires time_slot_id in the request body', function (): void {
        $user = User::factory()->volunteer()->create();
        Volunteer::factory()->create(['user_id' => $user->id]);
        ['rsvp' => $rsvp] = createRsvpWithShifts(['status' => 'active']);

        $this->actingAs($user)
            ->postJson("/api/rsvp/{$rsvp->rsvp_id}/vote", [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['time_slot_id']);
    });

    it('returns 404 when responding to a missing rsvp', function (): void {
        $user = User::factory()->volunteer()->create();
        Volunteer::factory()->create(['user_id' => $user->id]);

        $this->actingAs($user)
            ->postJson('/api/rsvp/99999/vote', ['time_slot_id' => 1])
            ->assertNotFound();
    });

    it('requires authentication to respond', function (): void {
        ['rsvp' => $rsvp, 'shifts' => $shifts] = createRsvpWithShifts(['status' => 'active']);

        $this->postJson("/api/rsvp/{$rsvp->rsvp_id}/vote", ['time_slot_id' => $shifts[0]->time_slot_id])
            ->assertUnauthorized();
    });

    it('returns 403 when a user without a volunteer profile tries to respond', function (): void {
        $user = User::factory()->volunteer()->create();
        ['rsvp' => $rsvp, 'shifts' => $shifts] = createRsvpWithShifts(['status' => 'active']);

        $this->actingAs($user)
            ->postJson("/api/rsvp/{$rsvp->rsvp_id}/vote", ['time_slot_id' => $shifts[0]->time_slot_id])
            ->assertForbidden();
    });

    it('rejects a response when the cutoff date has passed', function (): void {
        $user = User::factory()->volunteer()->create();
        Volunteer::factory()->create(['user_id' => $user->id]);
        ['rsvp' => $rsvp, 'shifts' => $shifts] = createRsvpWithShifts([
            'status' => 'active',
            'cutoff_day' => now()->subDay()->toDateString(),
            'cutoff_time' => '23:59',
        ]);

        $this->actingAs($user)
            ->postJson("/api/rsvp/{$rsvp->rsvp_id}/vote", ['time_slot_id' => $shifts[0]->time_slot_id])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'This RSVP has closed and is no longer accepting responses.');
    });

    it('rejects a response when the cutoff time has passed on the same day', function (): void {
        $fixedNow = now()->startOfDay()->addHours(12);
        $this->travelTo($fixedNow);

        $user = User::factory()->volunteer()->create();
        Volunteer::factory()->create(['user_id' => $user->id]);
        ['rsvp' => $rsvp, 'shifts' => $shifts] = createRsvpWithShifts([
            'status' => 'active',
            'cutoff_day' => $fixedNow->toDateString(),
            'cutoff_time' => $fixedNow->copy()->subHour()->format('H:i'),
        ]);

        $this->actingAs($user)
            ->postJson("/api/rsvp/{$rsvp->rsvp_id}/vote", ['time_slot_id' => $shifts[0]->time_slot_id])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'This RSVP has closed and is no longer accepting responses.');

        $this->travelBack();
    });

    it('allows a response when the cutoff is in the future', function (): void {
        $user = User::factory()->volunteer()->create();
        $volunteer = Volunteer::factory()->create(['user_id' => $user->id]);
        ['rsvp' => $rsvp, 'shifts' => $shifts] = createRsvpWithShifts([
            'status' => 'active',
            'cutoff_day' => now()->addDay()->toDateString(),
            'cutoff_time' => '23:59',
        ]);

        $this->actingAs($user)
            ->postJson("/api/rsvp/{$rsvp->rsvp_id}/vote", ['time_slot_id' => $shifts[0]->time_slot_id])
            ->assertSuccessful()
            ->assertJsonPath('message', 'RSVP recorded successfully.');

        $this->assertDatabaseHas('rsvp_response', [
            'volunteer_id' => $volunteer->volunteer_id,
            'rsvp_id' => $rsvp->rsvp_id,
            'time_slot_id' => $shifts[0]->time_slot_id,
        ]);
    });

    it('allows a response when cutoff is far in the future', function (): void {
        $user = User::factory()->volunteer()->create();
        $volunteer = Volunteer::factory()->create(['user_id' => $user->id]);
        ['rsvp' => $rsvp, 'shifts' => $shifts] = createRsvpWithShifts([
            'status' => 'active',
            'cutoff_day' => now()->addYear()->toDateString(),
            'cutoff_time' => '23:59',
        ]);

        $this->actingAs($user)
            ->postJson("/api/rsvp/{$rsvp->rsvp_id}/vote", ['time_slot_id' => $shifts[0]->time_slot_id])
            ->assertSuccessful()
            ->assertJsonPath('message', 'RSVP recorded successfully.');

        $this->assertDatabaseHas('rsvp_response', [
            'volunteer_id' => $volunteer->volunteer_id,
            'rsvp_id' => $rsvp->rsvp_id,
            'time_slot_id' => $shifts[0]->time_slot_id,
        ]);
    });
});

describe('PUT /api/rsvp/{rsvpId}/response - Update RSVP Response', function (): void {
    it('allows volunteer to edit their response', function (): void {
        $user = User::factory()->volunteer()->create();
        $volunteer = Volunteer::factory()->create(['user_id' => $user->id]);
        ['rsvp' => $rsvp, 'shifts' => $shifts] = createRsvpWithShifts([
            'status' => 'active',
            'cutoff_day' => now()->addDay()->toDateString(),
            'cutoff_time' => '23:59',
        ]);

        // Initial response
        $this->actingAs($user)
            ->postJson("/api/rsvp/{$rsvp->rsvp_id}/vote", ['time_slot_id' => $shifts[0]->time_slot_id])
            ->assertSuccessful();

        // Update response
        $this->actingAs($user)
            ->putJson("/api/rsvp/{$rsvp->rsvp_id}/response", ['time_slot_id' => $shifts[1]->time_slot_id])
            ->assertSuccessful()
            ->assertJsonPath('message', 'Response updated successfully.')
            ->assertJsonPath('remaining_edits', 2);

        // Verify database
        $this->assertDatabaseHas('rsvp_response', [
            'volunteer_id' => $volunteer->volunteer_id,
            'rsvp_id' => $rsvp->rsvp_id,
            'time_slot_id' => $shifts[1]->time_slot_id,
            'edit_count' => 1,
        ]);
    });

    it('rejects edit if event is not active', function (): void {
        $user = User::factory()->volunteer()->create();
        $volunteer = Volunteer::factory()->create(['user_id' => $user->id]);
        ['rsvp' => $rsvp, 'shifts' => $shifts] = createRsvpWithShifts(['status' => 'active']);

        // Initial response
        $this->actingAs($user)
            ->postJson("/api/rsvp/{$rsvp->rsvp_id}/vote", ['time_slot_id' => $shifts[0]->time_slot_id])
            ->assertSuccessful();

        // Close RSVP
        $rsvp->update(['status' => 'closed']);

        // Attempt edit
        $this->actingAs($user)
            ->putJson("/api/rsvp/{$rsvp->rsvp_id}/response", ['time_slot_id' => $shifts[1]->time_slot_id])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'This RSVP is no longer accepting responses.');
    });

    it('rejects edit if cutoff has passed', function (): void {
        $user = User::factory()->volunteer()->create();
        $volunteer = Volunteer::factory()->create(['user_id' => $user->id]);
        ['rsvp' => $rsvp, 'shifts' => $shifts] = createRsvpWithShifts([
            'status' => 'active',
            'cutoff_day' => now()->addDay()->toDateString(),
            'cutoff_time' => '23:59',
        ]);

        // Initial response
        $this->actingAs($user)
            ->postJson("/api/rsvp/{$rsvp->rsvp_id}/vote", ['time_slot_id' => $shifts[0]->time_slot_id])
            ->assertSuccessful();

        // Update cutoff to past
        $rsvp->update([
            'cutoff_day' => now()->subDay()->toDateString(),
            'cutoff_time' => '23:59',
        ]);

        // Attempt edit
        $this->actingAs($user)
            ->putJson("/api/rsvp/{$rsvp->rsvp_id}/response", ['time_slot_id' => $shifts[1]->time_slot_id])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'The cutoff time for this RSVP has passed.');
    });

    it('enforces 3-edit limit', function (): void {
        $user = User::factory()->volunteer()->create();
        $volunteer = Volunteer::factory()->create(['user_id' => $user->id]);
        ['rsvp' => $rsvp, 'shifts' => $shifts] = createRsvpWithShifts([
            'status' => 'active',
            'cutoff_day' => now()->addDay()->toDateString(),
            'cutoff_time' => '23:59',
        ]);

        // Add extra shifts for testing
        foreach (['6:00am - 3:00pm', '2:00pm - 10:00pm', '12:00am - 8:00am'] as $slot) {
            $timeSlot = TimeSlot::factory()->create(['text' => $slot]);
            $rsvp->shifts()->attach($timeSlot->time_slot_id, [
                'time_slot' => $slot,
                'capacity' => 10,
            ]);
            $shifts[] = $timeSlot;
        }
        $rsvp->refresh()->load('shifts');

        // Initial response
        $this->actingAs($user)
            ->postJson("/api/rsvp/{$rsvp->rsvp_id}/vote", ['time_slot_id' => $shifts[0]->time_slot_id])
            ->assertSuccessful();

        // Make 3 edits
        for ($i = 0; $i < 3; $i++) {
            $response = $this->actingAs($user)
                ->putJson("/api/rsvp/{$rsvp->rsvp_id}/response", ['time_slot_id' => $shifts[$i + 1]->time_slot_id])
                ->assertSuccessful();
        }

        // 4th edit should fail
        $this->actingAs($user)
            ->putJson("/api/rsvp/{$rsvp->rsvp_id}/response", ['time_slot_id' => $shifts[0]->time_slot_id])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'You have used all 3 available edits for this RSVP.');
    });

    it('rejects edit to same time slot', function (): void {
        $user = User::factory()->volunteer()->create();
        $volunteer = Volunteer::factory()->create(['user_id' => $user->id]);
        ['rsvp' => $rsvp, 'shifts' => $shifts] = createRsvpWithShifts([
            'status' => 'active',
            'cutoff_day' => now()->addDay()->toDateString(),
            'cutoff_time' => '23:59',
        ]);

        // Initial response
        $this->actingAs($user)
            ->postJson("/api/rsvp/{$rsvp->rsvp_id}/vote", ['time_slot_id' => $shifts[0]->time_slot_id])
            ->assertSuccessful();

        // Try to edit to same slot
        $this->actingAs($user)
            ->putJson("/api/rsvp/{$rsvp->rsvp_id}/response", ['time_slot_id' => $shifts[0]->time_slot_id])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Please select a different time slot.');
    });

    it('respects capacity on new slot', function (): void {
        $user = User::factory()->volunteer()->create();
        $volunteer = Volunteer::factory()->create(['user_id' => $user->id]);
        $rsvpData = createRsvpWithShifts([
            'status' => 'active',
            'cutoff_day' => now()->addDay()->toDateString(),
            'cutoff_time' => '23:59',
        ]);
        $rsvp = $rsvpData['rsvp'];
        $shifts = $rsvpData['shifts'];

        // Create a limited capacity shift
        $limitedShift = TimeSlot::factory()->create(['text' => 'Limited Shift']);
        $rsvp->shifts()->attach($limitedShift->time_slot_id, [
            'time_slot' => 'Limited Shift',
            'capacity' => 1,
        ]);

        // Fill the limited shift
        $user2 = User::factory()->volunteer()->create();
        $volunteer2 = Volunteer::factory()->create(['user_id' => $user2->id]);
        $this->actingAs($user2)
            ->postJson("/api/rsvp/{$rsvp->rsvp_id}/vote", ['time_slot_id' => $limitedShift->time_slot_id])
            ->assertSuccessful();

        // First user gets on shift[0]
        $this->actingAs($user)
            ->postJson("/api/rsvp/{$rsvp->rsvp_id}/vote", ['time_slot_id' => $shifts[0]->time_slot_id])
            ->assertSuccessful();

        // First user tries to move to limited shift (should fail)
        $this->actingAs($user)
            ->putJson("/api/rsvp/{$rsvp->rsvp_id}/response", ['time_slot_id' => $limitedShift->time_slot_id])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'This time slot is already at full capacity.');
    });

    it('requires authentication', function (): void {
        ['rsvp' => $rsvp, 'shifts' => $shifts] = createRsvpWithShifts(['status' => 'active']);

        $this->putJson("/api/rsvp/{$rsvp->rsvp_id}/response", ['time_slot_id' => $shifts[0]->time_slot_id])
            ->assertUnauthorized();
    });

    it('tracks edit history', function (): void {
        $user = User::factory()->volunteer()->create();
        $volunteer = Volunteer::factory()->create(['user_id' => $user->id]);
        ['rsvp' => $rsvp, 'shifts' => $shifts] = createRsvpWithShifts([
            'status' => 'active',
            'cutoff_day' => now()->addDay()->toDateString(),
            'cutoff_time' => '23:59',
        ]);

        // Initial response
        $this->actingAs($user)
            ->postJson("/api/rsvp/{$rsvp->rsvp_id}/vote", ['time_slot_id' => $shifts[0]->time_slot_id])
            ->assertSuccessful();

        // Edit response
        $this->actingAs($user)
            ->putJson("/api/rsvp/{$rsvp->rsvp_id}/response", ['time_slot_id' => $shifts[1]->time_slot_id])
            ->assertSuccessful();

        // Verify edit history
        $response = \App\Models\RsvpResponse::query()
            ->where('volunteer_id', $volunteer->volunteer_id)
            ->where('rsvp_id', $rsvp->rsvp_id)
            ->first();

        expect($response->edit_history)->toBeArray();
        expect($response->edit_history)->toHaveCount(1);
        expect($response->edit_history[0]['old_time_slot_id'])->toBe($shifts[0]->time_slot_id);
        expect($response->edit_history[0]['new_time_slot_id'])->toBe($shifts[1]->time_slot_id);
    });
});

describe('GET /api/notifications/rsvp - Get RSVP Notifications', function (): void {
    it('returns notifications for authenticated volunteer', function (): void {
        $user = User::factory()->volunteer()->create();
        $volunteer = Volunteer::factory()->create(['user_id' => $user->id]);

        // Create notifications
        $rsvp1 = Rsvp::factory()->active()->create();
        $rsvp2 = Rsvp::factory()->active()->create();

        \App\Models\RsvpNotification::factory()->create([
            'volunteer_id' => $volunteer->volunteer_id,
            'rsvp_id' => $rsvp1->rsvp_id,
        ]);

        \App\Models\RsvpNotification::factory()->create([
            'volunteer_id' => $volunteer->volunteer_id,
            'rsvp_id' => $rsvp2->rsvp_id,
        ]);

        $this->actingAs($user)
            ->getJson('/api/notifications/rsvp')
            ->assertSuccessful()
            ->assertJsonCount(2, 'data');
    });

    it('only returns notifications for own volunteer', function (): void {
        $user1 = User::factory()->volunteer()->create();
        $volunteer1 = Volunteer::factory()->create(['user_id' => $user1->id]);

        $user2 = User::factory()->volunteer()->create();
        $volunteer2 = Volunteer::factory()->create(['user_id' => $user2->id]);

        $rsvp = Rsvp::factory()->active()->create();

        \App\Models\RsvpNotification::factory()->create([
            'volunteer_id' => $volunteer1->volunteer_id,
            'rsvp_id' => $rsvp->rsvp_id,
        ]);

        \App\Models\RsvpNotification::factory()->create([
            'volunteer_id' => $volunteer2->volunteer_id,
            'rsvp_id' => $rsvp->rsvp_id,
        ]);

        $response = $this->actingAs($user1)
            ->getJson('/api/notifications/rsvp')
            ->assertSuccessful()
            ->assertJsonCount(1, 'data');
    });

    it('requires authentication', function (): void {
        $this->getJson('/api/notifications/rsvp')->assertUnauthorized();
    });
});

describe('PATCH /api/notifications/{notificationId}/read - Mark Notification as Read', function (): void {
    it('marks notification as read for volunteer', function (): void {
        $user = User::factory()->volunteer()->create();
        $volunteer = Volunteer::factory()->create(['user_id' => $user->id]);
        $rsvp = Rsvp::factory()->active()->create();

        $notification = \App\Models\RsvpNotification::factory()->create([
            'volunteer_id' => $volunteer->volunteer_id,
            'rsvp_id' => $rsvp->rsvp_id,
            'read_at' => null,
        ]);

        $this->actingAs($user)
            ->patchJson("/api/notifications/{$notification->notification_id}/read")
            ->assertSuccessful()
            ->assertJsonPath('message', 'Notification marked as read.');

        $this->assertDatabaseHas('rsvp_notification', [
            'notification_id' => $notification->notification_id,
        ]);

        // Verify read_at is set
        $updated = \App\Models\RsvpNotification::find($notification->notification_id);
        expect($updated->read_at)->not->toBeNull();
    });

    it('prevents marking another volunteer\'s notification as read', function (): void {
        $user1 = User::factory()->volunteer()->create();
        $volunteer1 = Volunteer::factory()->create(['user_id' => $user1->id]);

        $user2 = User::factory()->volunteer()->create();
        $volunteer2 = Volunteer::factory()->create(['user_id' => $user2->id]);

        $rsvp = Rsvp::factory()->active()->create();

        $notification = \App\Models\RsvpNotification::factory()->create([
            'volunteer_id' => $volunteer1->volunteer_id,
            'rsvp_id' => $rsvp->rsvp_id,
        ]);

        $this->actingAs($user2)
            ->patchJson("/api/notifications/{$notification->notification_id}/read")
            ->assertForbidden();
    });

    it('requires authentication', function (): void {
        $this->patchJson('/api/notifications/1/read')->assertUnauthorized();
    });
});

describe('PATCH /api/notifications/rsvp/read-all - Mark All Notifications as Read', function (): void {
    it('marks all notifications as read for volunteer', function (): void {
        $user = User::factory()->volunteer()->create();
        $volunteer = Volunteer::factory()->create(['user_id' => $user->id]);

        $rsvp1 = Rsvp::factory()->active()->create();
        $rsvp2 = Rsvp::factory()->active()->create();

        \App\Models\RsvpNotification::factory()->create([
            'volunteer_id' => $volunteer->volunteer_id,
            'rsvp_id' => $rsvp1->rsvp_id,
            'read_at' => null,
        ]);

        \App\Models\RsvpNotification::factory()->create([
            'volunteer_id' => $volunteer->volunteer_id,
            'rsvp_id' => $rsvp2->rsvp_id,
            'read_at' => null,
        ]);

        $this->actingAs($user)
            ->patchJson('/api/notifications/rsvp/read-all')
            ->assertSuccessful();

        // Verify all are marked as read
        $unreadCount = \App\Models\RsvpNotification::query()
            ->where('volunteer_id', $volunteer->volunteer_id)
            ->whereNull('read_at')
            ->count();

        expect($unreadCount)->toBe(0);
    });

    it('only marks own notifications', function (): void {
        $user1 = User::factory()->volunteer()->create();
        $volunteer1 = Volunteer::factory()->create(['user_id' => $user1->id]);

        $user2 = User::factory()->volunteer()->create();
        $volunteer2 = Volunteer::factory()->create(['user_id' => $user2->id]);

        $rsvp = Rsvp::factory()->active()->create();

        \App\Models\RsvpNotification::factory()->create([
            'volunteer_id' => $volunteer1->volunteer_id,
            'rsvp_id' => $rsvp->rsvp_id,
            'read_at' => null,
        ]);

        \App\Models\RsvpNotification::factory()->create([
            'volunteer_id' => $volunteer2->volunteer_id,
            'rsvp_id' => $rsvp->rsvp_id,
            'read_at' => null,
        ]);

        $this->actingAs($user1)
            ->patchJson('/api/notifications/rsvp/read-all')
            ->assertSuccessful();

        // Verify only user1's are marked as read
        $user1Unread = \App\Models\RsvpNotification::query()
            ->where('volunteer_id', $volunteer1->volunteer_id)
            ->whereNull('read_at')
            ->count();

        $user2Unread = \App\Models\RsvpNotification::query()
            ->where('volunteer_id', $volunteer2->volunteer_id)
            ->whereNull('read_at')
            ->count();

        expect($user1Unread)->toBe(0);
        expect($user2Unread)->toBe(1);
    });

    it('requires authentication', function (): void {
        $this->patchJson('/api/notifications/rsvp/read-all')->assertUnauthorized();
    });
});

describe('Slug URL Support', function (): void {
    it('allows fetching RSVP by slug', function (): void {
        $admin = User::factory()->admin()->create();
        ['rsvp' => $rsvp] = createRsvpWithShifts(['status' => 'active']);

        $this->actingAs($admin)
            ->getJson("/api/rsvp/{$rsvp->slug}")
            ->assertSuccessful()
            ->assertJsonPath('data.id', $rsvp->rsvp_id)
            ->assertJsonPath('data.slug', $rsvp->slug);
    });

    it('allows fetching RSVP by numeric ID', function (): void {
        $admin = User::factory()->admin()->create();
        ['rsvp' => $rsvp] = createRsvpWithShifts(['status' => 'active']);

        $this->actingAs($admin)
            ->getJson("/api/rsvp/{$rsvp->rsvp_id}")
            ->assertSuccessful()
            ->assertJsonPath('data.id', $rsvp->rsvp_id);
    });

    it('allows fetching RSVP by query parameter', function (): void {
        $admin = User::factory()->admin()->create();
        ['rsvp' => $rsvp] = createRsvpWithShifts(['status' => 'active']);

        $this->actingAs($admin)
            ->getJson("/api/rsvp?id={$rsvp->rsvp_id}")
            ->assertSuccessful()
            ->assertJsonPath('data.id', $rsvp->rsvp_id);
    });

    it('generates unique slugs for duplicate titles', function (): void {
        $rsvp1 = Rsvp::factory()->create(['title' => 'Community Service']);
        $rsvp2 = Rsvp::factory()->create(['title' => 'Community Service']);

        expect($rsvp1->slug)->not->toBe($rsvp2->slug);
        expect($rsvp2->slug)->toContain('community-service');
    });

    it('includes slug in shareUrl', function (): void {
        $admin = User::factory()->admin()->create();
        ['rsvp' => $rsvp] = createRsvpWithShifts(['status' => 'active']);

        $response = $this->actingAs($admin)
            ->getJson("/api/rsvp/{$rsvp->rsvp_id}")
            ->assertSuccessful()
            ->json('data.shareUrl');

        expect($response)->toContain($rsvp->slug);
    });
});
