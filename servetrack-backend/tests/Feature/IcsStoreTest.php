<?php

use App\Models\Ics;
use App\Models\IcsTeam;
use App\Models\Rsvp;
use App\Models\Team;
use App\Models\User;

beforeEach(function (): void {
    $this->admin = User::factory()->admin()->create();
});

describe('POST /api/ics', function (): void {

    it('creates ICS record without team rows (teams are seeded on dashboard access)', function (): void {
        $rsvp = Rsvp::factory()->active()->create();

        Team::create(['name' => 'Medical Team']);
        Team::create(['name' => 'Logistics Team']);
        Team::create(['name' => 'Support Team']);

        $response = $this->actingAs($this->admin)
            ->postJson('/api/ics', [
                'rsvp_id' => $rsvp->rsvp_id,
                'name' => $rsvp->title,
            ])
            ->assertCreated()
            ->assertJsonPath('data.rsvp_id', $rsvp->rsvp_id);

        $ics = Ics::query()->where('rsvp_id', $rsvp->rsvp_id)->firstOrFail();
        // Teams are NOT created at store time — they are seeded by ensureDashboardDefaults()
        // when the admin first accesses the ICS dashboard for this event.
        expect($ics->name)->toBe($rsvp->title);
        expect($ics->status)->toBe('draft');
    });

    it('returns the existing ICS instead of creating a duplicate when one already exists for the RSVP', function (): void {
        $rsvp = Rsvp::factory()->active()->create();
        $team = Team::create(['name' => 'Medical Team']);

        $existingIcs = Ics::create([
            'rsvp_id' => $rsvp->rsvp_id,
            'name' => 'Original ICS',
            'date' => $rsvp->date,
            'location' => 'Original Location',
            'status' => 'draft',
        ]);
        IcsTeam::create(['ics_id' => $existingIcs->id, 'team_id' => $team->id, 'team' => $team->name]);

        $response = $this->actingAs($this->admin)
            ->postJson('/api/ics', [
                'rsvp_id' => $rsvp->rsvp_id,
                'name' => 'Different Name',
            ])
            ->assertOk()
            ->assertJsonPath('data.id', $existingIcs->id)
            ->assertJsonPath('data.name', 'Original ICS');

        expect(Ics::query()->where('rsvp_id', $rsvp->rsvp_id)->count())->toBe(1);
    });

    it('creates ICS even when team_ids provided (teams are managed by dashboard seeder)', function (): void {
        $rsvp = Rsvp::factory()->active()->create();

        $team1 = Team::create(['name' => 'Medical Team']);
        $team2 = Team::create(['name' => 'Logistics Team']);
        Team::create(['name' => 'Support Team']);

        $this->actingAs($this->admin)
            ->postJson('/api/ics', [
                'rsvp_id' => $rsvp->rsvp_id,
                'name' => $rsvp->title,
                'team_ids' => [$team1->id, $team2->id],
            ])
            ->assertCreated();

        $ics = Ics::query()->where('rsvp_id', $rsvp->rsvp_id)->firstOrFail();
        // team_ids param is accepted but teams are seeded on dashboard access, not here
        expect($ics)->not->toBeNull();
        expect($ics->rsvp_id)->toBe($rsvp->rsvp_id);
    });

    it('rejects unauthenticated requests', function (): void {
        $rsvp = Rsvp::factory()->active()->create();

        $this->postJson('/api/ics', [
            'rsvp_id' => $rsvp->rsvp_id,
            'name' => $rsvp->title,
        ])
            ->assertUnauthorized();
    });

    it('rejects non-admin users', function (): void {
        $rsvp = Rsvp::factory()->active()->create();
        $volunteerUser = User::factory()->volunteer()->create();

        $this->actingAs($volunteerUser)
            ->postJson('/api/ics', [
                'rsvp_id' => $rsvp->rsvp_id,
                'name' => $rsvp->title,
            ])
            ->assertForbidden();
    });
});
