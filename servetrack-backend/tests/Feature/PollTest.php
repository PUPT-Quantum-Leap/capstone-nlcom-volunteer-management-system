<?php

use App\Models\Option;
use App\Models\Poll;
use App\Models\User;
use App\Models\Volunteer;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Create a poll with two attached options (via the poll_option junction table).
 *
 * @return array{poll: Poll, options: array<int, Option>}
 */
function createPollWithOptions(array $pollAttributes = []): array
{
    $poll = Poll::factory()->create($pollAttributes);

    $options = [];
    foreach (['4:30am - 2:00pm', '1:00pm - 7:00pm'] as $slot) {
        $option = Option::factory()->create(['text' => $slot]);
        $poll->options()->attach($option->option_id, [
            'time_slot' => $slot,
            'capacity' => 10,
        ]);
        $options[] = $option;
    }

    return ['poll' => $poll->load('options'), 'options' => $options];
}

// ── Index (GET /api/polls) ────────────────────────────────────────────────────

describe('GET /api/polls', function (): void {
    it('returns all polls for admins regardless of status', function (): void {
        $admin = User::factory()->admin()->create();
        Poll::factory()->active()->create(['title' => 'Active Poll']);
        Poll::factory()->create(['title' => 'Draft Poll', 'status' => 'draft']);
        Poll::factory()->closed()->create(['title' => 'Closed Poll']);

        $this->actingAs($admin)
            ->getJson('/api/polls')
            ->assertSuccessful()
            ->assertJsonCount(3, 'data');
    });

    it('returns only active polls for volunteers', function (): void {
        $volunteer = User::factory()->volunteer()->create();
        Poll::factory()->active()->create();
        Poll::factory()->create(['status' => 'draft']);
        Poll::factory()->closed()->create();

        $this->actingAs($volunteer)
            ->getJson('/api/polls')
            ->assertSuccessful()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.status', 'active');
    });

    it('requires authentication', function (): void {
        $this->getJson('/api/polls')->assertUnauthorized();
    });

    it('returns expected poll shape', function (): void {
        $admin = User::factory()->admin()->create();
        createPollWithOptions(['status' => 'active']);

        $this->actingAs($admin)
            ->getJson('/api/polls')
            ->assertSuccessful()
            ->assertJsonStructure([
                'data' => [
                    '*' => [
                        'id', 'title', 'description', 'date',
                        'cutOffDay', 'cutOffTime', 'status',
                        'totalVotes', 'createdAt',
                        'options' => [
                            '*' => ['id', 'timeSlot', 'capacity', 'votes'],
                        ],
                    ],
                ],
            ]);
    });
});

// ── Show (GET /api/polls/{id}) ─────────────────────────────────────────────────

describe('GET /api/polls/{id}', function (): void {
    it('returns a single poll with options', function (): void {
        $admin = User::factory()->admin()->create();
        ['poll' => $poll] = createPollWithOptions(['status' => 'active']);

        $this->actingAs($admin)
            ->getJson("/api/polls/{$poll->poll_id}")
            ->assertSuccessful()
            ->assertJsonPath('data.id', $poll->poll_id)
            ->assertJsonStructure(['data' => ['id', 'options']]);
    });

    it('returns 404 for a missing poll', function (): void {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)
            ->getJson('/api/polls/99999')
            ->assertNotFound();
    });
});

// ── Store (POST /api/polls) ────────────────────────────────────────────────────

describe('POST /api/polls', function (): void {
    it('allows admins to create a poll', function (): void {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)
            ->postJson('/api/polls', [
                'title' => 'Mobile Kitchen Operations',
                'description' => 'Pick your preferred shift.',
                'date' => '2026-09-27',
                'cutoff_day' => '2026-09-26',
                'cutoff_time' => '12:00',
                'options' => [
                    ['text' => '4:30am - 2:00pm', 'time_slot' => '4:30am - 2:00pm', 'capacity' => 15],
                    ['text' => '1:00pm - 7:00pm', 'time_slot' => '1:00pm - 7:00pm', 'capacity' => 10],
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('data.title', 'Mobile Kitchen Operations')
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonCount(2, 'data.options');
    });

    it('forbids volunteers from creating polls', function (): void {
        $volunteer = User::factory()->volunteer()->create();

        $this->actingAs($volunteer)
            ->postJson('/api/polls', [
                'title' => 'Rogue Poll',
                'date' => '2026-09-27',
                'cutoff_day' => 'Thursday',
                'cutoff_time' => '12NN',
                'options' => [
                    ['text' => 'Morning', 'time_slot' => '8am - 12pm', 'capacity' => 5],
                ],
            ])
            ->assertForbidden();
    });

    it('validates required fields', function (): void {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)
            ->postJson('/api/polls', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['title', 'date', 'cutoff_day', 'cutoff_time', 'options']);
    });

    it('requires at least one option', function (): void {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)
            ->postJson('/api/polls', [
                'title' => 'No Options Poll',
                'date' => '2026-09-27',
                'cutoff_day' => 'Thursday',
                'cutoff_time' => '12NN',
                'options' => [],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['options']);
    });

    it('validates each option has text, time_slot, and capacity', function (): void {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)
            ->postJson('/api/polls', [
                'title' => 'Bad Options Poll',
                'date' => '2026-09-27',
                'cutoff_day' => 'Thursday',
                'cutoff_time' => '12NN',
                'options' => [['capacity' => 0]],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['options.0.text', 'options.0.time_slot', 'options.0.capacity']);
    });
});

// ── Update (PUT /api/polls/{id}) ───────────────────────────────────────────────

describe('PUT /api/polls/{id}', function (): void {
    it('allows admins to update a poll', function (): void {
        $admin = User::factory()->admin()->create();
        ['poll' => $poll] = createPollWithOptions();

        $this->actingAs($admin)
            ->putJson("/api/polls/{$poll->poll_id}", [
                'title' => 'Updated Title',
                'date' => '2026-10-01',
                'cutoff_day' => 'Wednesday',
                'cutoff_time' => '5PM',
                'options' => [
                    ['text' => 'Morning shift', 'time_slot' => '7am - 1pm', 'capacity' => 20],
                ],
            ])
            ->assertSuccessful()
            ->assertJsonPath('data.title', 'Updated Title');
    });

    it('returns 404 when updating a missing poll', function (): void {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)
            ->putJson('/api/polls/99999', ['title' => 'Ghost'])
            ->assertNotFound();
    });

    it('forbids volunteers from updating polls', function (): void {
        $volunteer = User::factory()->volunteer()->create();
        ['poll' => $poll] = createPollWithOptions();

        $this->actingAs($volunteer)
            ->putJson("/api/polls/{$poll->poll_id}", ['title' => 'Hacked'])
            ->assertForbidden();
    });
});

// ── Destroy (DELETE /api/polls/{id}) ──────────────────────────────────────────

describe('DELETE /api/polls/{id}', function (): void {
    it('allows admins to delete a poll', function (): void {
        $admin = User::factory()->admin()->create();
        $poll = Poll::factory()->create();

        $this->actingAs($admin)
            ->deleteJson("/api/polls/{$poll->poll_id}")
            ->assertSuccessful()
            ->assertJsonPath('message', 'Poll deleted successfully.');

        $this->assertDatabaseMissing('poll', ['poll_id' => $poll->poll_id]);
    });

    it('returns 404 when deleting a missing poll', function (): void {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)
            ->deleteJson('/api/polls/99999')
            ->assertNotFound();
    });

    it('forbids volunteers from deleting polls', function (): void {
        $volunteer = User::factory()->volunteer()->create();
        $poll = Poll::factory()->create();

        $this->actingAs($volunteer)
            ->deleteJson("/api/polls/{$poll->poll_id}")
            ->assertForbidden();
    });
});

// ── Update Status (PATCH /api/polls/{id}/status) ──────────────────────────────

describe('PATCH /api/polls/{id}/status', function (): void {
    it('allows admins to change poll status', function (): void {
        $admin = User::factory()->admin()->create();
        $poll = Poll::factory()->create(['status' => 'draft']);

        $this->actingAs($admin)
            ->patchJson("/api/polls/{$poll->poll_id}/status", ['status' => 'active'])
            ->assertSuccessful()
            ->assertJsonPath('status', 'active');

        $this->assertDatabaseHas('poll', ['poll_id' => $poll->poll_id, 'status' => 'active']);
    });

    it('rejects invalid status values', function (): void {
        $admin = User::factory()->admin()->create();
        $poll = Poll::factory()->create();

        $this->actingAs($admin)
            ->patchJson("/api/polls/{$poll->poll_id}/status", ['status' => 'published'])
            ->assertUnprocessable();
    });

    it('forbids volunteers from changing poll status', function (): void {
        $volunteer = User::factory()->volunteer()->create();
        $poll = Poll::factory()->active()->create();

        $this->actingAs($volunteer)
            ->patchJson("/api/polls/{$poll->poll_id}/status", ['status' => 'closed'])
            ->assertForbidden();
    });
});

// ── Vote (POST /api/polls/{id}/vote) ──────────────────────────────────────────

describe('POST /api/polls/{id}/vote', function (): void {
    it('allows a volunteer to vote on an active poll', function (): void {
        $user = User::factory()->volunteer()->create();
        $volunteer = Volunteer::factory()->create(['user_id' => $user->id]);
        ['poll' => $poll, 'options' => $options] = createPollWithOptions(['status' => 'active']);

        $this->actingAs($user)
            ->postJson("/api/polls/{$poll->poll_id}/vote", ['option_id' => $options[0]->option_id])
            ->assertSuccessful()
            ->assertJsonPath('message', 'Vote recorded successfully.');

        $this->assertDatabaseHas('poll_vote', [
            'volunteer_id' => $volunteer->volunteer_id,
            'poll_id' => $poll->poll_id,
            'option_id' => $options[0]->option_id,
        ]);
    });

    it('rejects a second vote from the same volunteer on the same poll', function (): void {
        $user = User::factory()->volunteer()->create();
        $volunteer = Volunteer::factory()->create(['user_id' => $user->id]);
        ['poll' => $poll, 'options' => $options] = createPollWithOptions(['status' => 'active']);

        $this->actingAs($user)
            ->postJson("/api/polls/{$poll->poll_id}/vote", ['option_id' => $options[0]->option_id]);

        $this->actingAs($user)
            ->postJson("/api/polls/{$poll->poll_id}/vote", ['option_id' => $options[1]->option_id])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'You have already voted on this poll.');
    });

    it('rejects votes on a closed poll', function (): void {
        $user = User::factory()->volunteer()->create();
        Volunteer::factory()->create(['user_id' => $user->id]);
        ['poll' => $poll, 'options' => $options] = createPollWithOptions(['status' => 'closed']);

        $this->actingAs($user)
            ->postJson("/api/polls/{$poll->poll_id}/vote", ['option_id' => $options[0]->option_id])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'This poll is not accepting votes.');
    });

    it('rejects votes on a draft poll', function (): void {
        $user = User::factory()->volunteer()->create();
        Volunteer::factory()->create(['user_id' => $user->id]);
        ['poll' => $poll, 'options' => $options] = createPollWithOptions(['status' => 'draft']);

        $this->actingAs($user)
            ->postJson("/api/polls/{$poll->poll_id}/vote", ['option_id' => $options[0]->option_id])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'This poll is not accepting votes.');
    });

    it('rejects a vote for an option not belonging to the poll', function (): void {
        $user = User::factory()->volunteer()->create();
        Volunteer::factory()->create(['user_id' => $user->id]);
        ['poll' => $poll] = createPollWithOptions(['status' => 'active']);

        $strangerOption = Option::factory()->create();

        $this->actingAs($user)
            ->postJson("/api/polls/{$poll->poll_id}/vote", ['option_id' => $strangerOption->option_id])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Invalid option for this poll.');
    });

    it('rejects a vote when the option is at full capacity', function (): void {
        $user = User::factory()->volunteer()->create();
        Volunteer::factory()->create(['user_id' => $user->id]);

        $poll = Poll::factory()->active()->create();
        $option = Option::factory()->create(['text' => '4:30am - 2:00pm']);
        $poll->options()->attach($option->option_id, [
            'time_slot' => '4:30am - 2:00pm',
            'capacity' => 1,
        ]);

        // Fill the slot with another voter
        $otherUser = User::factory()->volunteer()->create();
        $otherVolunteer = Volunteer::factory()->create(['user_id' => $otherUser->id]);
        \App\Models\PollVote::query()->create([
            'volunteer_id' => $otherVolunteer->volunteer_id,
            'poll_id' => $poll->poll_id,
            'option_id' => $option->option_id,
            'voted_at' => now(),
            'sms_sent' => false,
        ]);

        $this->actingAs($user)
            ->postJson("/api/polls/{$poll->poll_id}/vote", ['option_id' => $option->option_id])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'This time slot is already at full capacity.');
    });

    it('requires option_id in the request body', function (): void {
        $user = User::factory()->volunteer()->create();
        Volunteer::factory()->create(['user_id' => $user->id]);
        ['poll' => $poll] = createPollWithOptions(['status' => 'active']);

        $this->actingAs($user)
            ->postJson("/api/polls/{$poll->poll_id}/vote", [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['option_id']);
    });

    it('returns 404 when voting on a missing poll', function (): void {
        $user = User::factory()->volunteer()->create();
        Volunteer::factory()->create(['user_id' => $user->id]);

        $this->actingAs($user)
            ->postJson('/api/polls/99999/vote', ['option_id' => 1])
            ->assertNotFound();
    });

    it('requires authentication to vote', function (): void {
        ['poll' => $poll, 'options' => $options] = createPollWithOptions(['status' => 'active']);

        $this->postJson("/api/polls/{$poll->poll_id}/vote", ['option_id' => $options[0]->option_id])
            ->assertUnauthorized();
    });

    it('returns 403 when a user without a volunteer profile tries to vote', function (): void {
        // A user with no linked Volunteer record
        $user = User::factory()->volunteer()->create();
        ['poll' => $poll, 'options' => $options] = createPollWithOptions(['status' => 'active']);

        $this->actingAs($user)
            ->postJson("/api/polls/{$poll->poll_id}/vote", ['option_id' => $options[0]->option_id])
            ->assertForbidden();
    });
});
