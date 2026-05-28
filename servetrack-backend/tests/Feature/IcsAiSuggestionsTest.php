<?php

use App\Models\Ics;
use App\Models\IcsTeam;
use App\Models\Rsvp;
use App\Models\RsvpResponse;
use App\Models\Skill;
use App\Models\Team;
use App\Models\User;
use App\Models\Volunteer;
use Illuminate\Support\Facades\Http;

beforeEach(function (): void {
    $this->admin = User::factory()->admin()->create();
});

function createIcsWithTeamsAndVolunteers(): array
{
    $rsvp = Rsvp::factory()->active()->create();

    $team1 = Team::create(['name' => 'Medical Team']);
    $team2 = Team::create(['name' => 'Logistics Team']);

    $ics = Ics::create([
        'rsvp_id' => $rsvp->rsvp_id,
        'name' => 'Test ICS',
        'description' => 'Test description',
        'date' => $rsvp->date,
        'location' => 'Test Location',
        'status' => 'active',
    ]);

    IcsTeam::create(['ics_id' => $ics->id, 'team_id' => $team1->id, 'team' => $team1->name]);
    IcsTeam::create(['ics_id' => $ics->id, 'team_id' => $team2->id, 'team' => $team2->name]);

    $volunteer1 = Volunteer::factory()->create(['first_name' => 'John', 'last_name' => 'Doe']);
    $volunteer2 = Volunteer::factory()->create(['first_name' => 'Jane', 'last_name' => 'Smith']);

    $skill1 = Skill::factory()->create(['name' => 'First Aid']);
    $skill2 = Skill::factory()->create(['name' => 'Logistics']);

    $volunteer1->skills()->attach($skill1);
    $volunteer2->skills()->attach($skill2);

    RsvpResponse::factory()->create([
        'volunteer_id' => $volunteer1->volunteer_id,
        'rsvp_id' => $rsvp->rsvp_id,
        'attendance_status' => 'registered',
    ]);

    RsvpResponse::factory()->create([
        'volunteer_id' => $volunteer2->volunteer_id,
        'rsvp_id' => $rsvp->rsvp_id,
        'attendance_status' => 'registered',
    ]);

    return [
        'ics' => $ics,
        'teams' => collect([$team1, $team2]),
        'volunteers' => collect([$volunteer1, $volunteer2]),
        'rsvp' => $rsvp,
    ];
}

describe('GET /api/ics/{ics}/ai-suggestions', function (): void {

    it('requires authentication', function (): void {
        $data = createIcsWithTeamsAndVolunteers();

        $this->getJson("/api/ics/{$data['ics']->id}/ai-suggestions")
            ->assertUnauthorized();
    });

    it('returns 403 for non-admin users', function (): void {
        $data = createIcsWithTeamsAndVolunteers();
        $volunteerUser = User::factory()->volunteer()->create();

        $this->actingAs($volunteerUser)
            ->getJson("/api/ics/{$data['ics']->id}/ai-suggestions")
            ->assertForbidden();
    });

    it('returns 404 for non-existent ICS', function (): void {
        $this->actingAs($this->admin)
            ->getJson('/api/ics/99999/ai-suggestions')
            ->assertNotFound();
    });

    it('uses groq ai suggestions when groq is configured', function (): void {
        config([
            'services.groq.api_key' => 'test-key',
            'services.groq.model' => 'llama-3.3-70b-versatile',
        ]);

        $data = createIcsWithTeamsAndVolunteers();
        $volunteer1 = $data['volunteers'][0];
        $volunteer2 = $data['volunteers'][1];
        $medicalTeam = $data['teams'][0];
        $logisticsTeam = $data['teams'][1];

        Http::fake([
            'api.groq.com/*' => Http::response([
                'choices' => [
                    [
                        'message' => [
                            'role' => 'assistant',
                            'content' => json_encode([
                                'assignments' => [
                                    [
                                        'volunteer_id' => $volunteer1->volunteer_id,
                                        'team_id' => $medicalTeam->id,
                                        'role' => 'Medical Officer',
                                        'confidence' => 0.92,
                                        'reasoning' => 'Has First Aid skill',
                                    ],
                                    [
                                        'volunteer_id' => $volunteer2->volunteer_id,
                                        'team_id' => $logisticsTeam->id,
                                        'role' => 'Logistics Officer',
                                        'confidence' => 0.88,
                                        'reasoning' => 'Has Logistics skill',
                                    ],
                                ],
                                'unassigned' => [],
                            ]),
                        ],
                    ],
                ],
            ]),
        ]);

        $this->actingAs($this->admin)
            ->getJson("/api/ics/{$data['ics']->id}/ai-suggestions")
            ->assertSuccessful()
            ->assertJsonStructure([
                'data' => [
                    '*' => [
                        'volunteer_id',
                        'volunteer_name',
                        'team_id',
                        'team_name',
                        'role',
                        'skills',
                        'confidence',
                    ],
                ],
                'meta' => [
                    'message',
                    'total_volunteers',
                ],
            ])
            ->assertJsonPath('meta.total_volunteers', 2)
            ->assertJsonPath('data.0.volunteer_name', 'John Doe')
            ->assertJsonPath('data.0.role', 'Medical Officer')
            ->assertJsonPath('data.1.volunteer_name', 'Jane Smith')
            ->assertJsonPath('data.1.role', 'Logistics Officer');
    });

    it('falls back to hardcoded mapping when groq api is not configured', function (): void {
        config(['services.groq.api_key' => '']);

        $data = createIcsWithTeamsAndVolunteers();

        $this->actingAs($this->admin)
            ->getJson("/api/ics/{$data['ics']->id}/ai-suggestions")
            ->assertSuccessful()
            ->assertJsonStructure([
                'data' => [
                    '*' => [
                        'volunteer_id',
                        'volunteer_name',
                        'team_id',
                        'team_name',
                        'role',
                        'skills',
                        'confidence',
                    ],
                ],
                'meta' => [
                    'message',
                    'total_volunteers',
                ],
            ])
            ->assertJsonPath('meta.message', 'AI-generated team assignments based on volunteer skills (fallback).');
    });

    it('falls back to hardcoded mapping when groq api fails', function (): void {
        config([
            'services.groq.api_key' => 'test-key',
            'services.groq.model' => 'llama-3.3-70b-versatile',
        ]);

        $data = createIcsWithTeamsAndVolunteers();

        Http::fake([
            'api.groq.com/*' => Http::response(null, 500),
        ]);

        $this->actingAs($this->admin)
            ->getJson("/api/ics/{$data['ics']->id}/ai-suggestions")
            ->assertSuccessful()
            ->assertJsonPath('meta.message', 'AI-generated team assignments based on volunteer skills (fallback).');
    });

    it('returns message when no teams assigned to ics', function (): void {
        config(['services.groq.api_key' => '']);
        $rsvp = Rsvp::factory()->active()->create();

        $ics = Ics::create([
            'rsvp_id' => $rsvp->rsvp_id,
            'name' => 'Empty ICS',
            'description' => null,
            'date' => $rsvp->date,
            'location' => 'Somewhere',
            'status' => 'draft',
        ]);

        $this->actingAs($this->admin)
            ->getJson("/api/ics/{$ics->id}/ai-suggestions")
            ->assertSuccessful()
            ->assertJsonPath('meta.message', 'No teams assigned to this ICS.')
            ->assertJsonPath('meta.total_volunteers', 0);
    });

    it('returns message when no volunteers rsvpd', function (): void {
        config(['services.groq.api_key' => '']);
        $rsvp = Rsvp::factory()->active()->create();

        $ics = Ics::create([
            'rsvp_id' => $rsvp->rsvp_id,
            'name' => 'Empty ICS',
            'description' => null,
            'date' => $rsvp->date,
            'location' => 'Somewhere',
            'status' => 'draft',
        ]);

        $team = Team::create(['name' => 'Medical Team']);
        IcsTeam::create(['ics_id' => $ics->id, 'team_id' => $team->id, 'team' => $team->name]);

        $this->actingAs($this->admin)
            ->getJson("/api/ics/{$ics->id}/ai-suggestions")
            ->assertSuccessful()
            ->assertJsonPath('meta.message', "No volunteers have RSVP'd for this event.")
            ->assertJsonPath('meta.total_volunteers', 0);
    });
});
