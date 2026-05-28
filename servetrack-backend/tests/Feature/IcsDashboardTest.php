<?php

use App\Models\Ics;
use App\Models\IcsTeam;
use App\Models\Rsvp;
use App\Models\User;

beforeEach(function (): void {
    $this->admin = User::factory()->admin()->create();
});

describe('GET /api/ics/dashboard', function (): void {
    it('initializes and returns the frontend dashboard payload for an RSVP', function (): void {
        $rsvp = Rsvp::factory()->active()->create([
            'title' => 'Feeding Operation',
            'event_location' => 'NLCOM Center',
        ]);

        $this->actingAs($this->admin)
            ->getJson("/api/ics/dashboard?rsvp_id={$rsvp->rsvp_id}")
            ->assertOk()
            ->assertJsonPath('data.rsvp.id', $rsvp->rsvp_id)
            ->assertJsonPath('data.command_roles.0.key', 'responsible_official')
            ->assertJsonPath('data.command_roles.0.assigned_name', 'Paul Giague')
            ->assertJsonPath('data.branches.0.key', 'mobile_kitchen')
            ->assertJsonPath('data.branches.0.teams.0.name', 'Kitchen Truck')
            ->assertJsonPath('data.branches.1.teams.0.vehicle', 'Flexi');

        expect(Ics::query()->where('rsvp_id', $rsvp->rsvp_id)->exists())->toBeTrue();
    });
});

describe('PATCH /api/ics/{ics}/command-roles/{roleKey}', function (): void {
    it('updates a fixed command role assignment', function (): void {
        $rsvp = Rsvp::factory()->active()->create();

        $dashboard = $this->actingAs($this->admin)
            ->getJson("/api/ics/dashboard?rsvp_id={$rsvp->rsvp_id}")
            ->json('data');

        $this->actingAs($this->admin)
            ->patchJson("/api/ics/{$dashboard['ics_id']}/command-roles/incident_commander", [
                'assigned_name' => 'Updated Commander',
            ])
            ->assertOk()
            ->assertJsonPath('data.command_roles.1.assigned_name', 'Updated Commander');
    });
});

describe('GET /api/ics/dashboard — regression: no ghost IcsTeam rows on repeat loads', function (): void {
    it('does not insert new ics_team rows when the dashboard is loaded on an already-existing ics', function (): void {
        $rsvp = Rsvp::factory()->active()->create();

        // First load — creates the ICS and seeds default teams + command roles.
        $this->actingAs($this->admin)
            ->getJson("/api/ics/dashboard?rsvp_id={$rsvp->rsvp_id}")
            ->assertOk();

        $ics = Ics::query()->where('rsvp_id', $rsvp->rsvp_id)->firstOrFail();
        $countAfterFirstLoad = IcsTeam::query()->where('ics_id', $ics->id)->count();

        // Second load — must not insert any additional rows.
        $this->actingAs($this->admin)
            ->getJson("/api/ics/dashboard?rsvp_id={$rsvp->rsvp_id}")
            ->assertOk();

        $countAfterSecondLoad = IcsTeam::query()->where('ics_id', $ics->id)->count();

        expect($countAfterSecondLoad)->toBe($countAfterFirstLoad);
    });

    it('does not insert new ics_team rows when a command role is updated', function (): void {
        $rsvp = Rsvp::factory()->active()->create();

        // Bootstrap the ICS.
        $dashboard = $this->actingAs($this->admin)
            ->getJson("/api/ics/dashboard?rsvp_id={$rsvp->rsvp_id}")
            ->json('data');

        $ics = Ics::query()->find($dashboard['ics_id']);
        $countBeforeRoleUpdate = IcsTeam::query()->where('ics_id', $ics->id)->count();

        // Updating a command role must not grow the ics_team table.
        $this->actingAs($this->admin)
            ->patchJson("/api/ics/{$ics->id}/command-roles/incident_commander", [
                'assigned_name' => 'New Commander',
            ])
            ->assertOk();

        $countAfterRoleUpdate = IcsTeam::query()->where('ics_id', $ics->id)->count();

        expect($countAfterRoleUpdate)->toBe($countBeforeRoleUpdate);
    });
});
