<?php

use App\Models\Skill;
use App\Models\Training;
use App\Models\Volunteer;
use App\Services\GroqService;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;

beforeEach(function (): void {
    Config::set('services.groq.api_key', 'test-groq-key');
    Config::set('services.groq.model', 'llama-3.3-70b-versatile');
});

it('returns empty suggestions when api key is not configured', function (): void {
    Config::set('services.groq.api_key', '');

    $service = new GroqService;
    $result = $service->suggestAssignments(
        collect(),
        collect(),
        'Test Event',
        'A test event',
    );

    expect($result)->toBe([
        'assignments' => [],
        'unassigned' => [],
    ]);
});

it('sends correct request to groq api and parses response', function (): void {
    Http::fake([
        'api.groq.com/*' => Http::response([
            'choices' => [
                [
                    'message' => [
                        'role' => 'assistant',
                        'content' => json_encode([
                            'assignments' => [
                                [
                                    'volunteer_id' => 1,
                                    'team_id' => 2,
                                    'role' => 'Medical Officer',
                                    'confidence' => 0.92,
                                    'reasoning' => 'Has nursing training and first aid skills',
                                ],
                            ],
                            'unassigned' => [],
                        ]),
                    ],
                ],
            ],
            'usage' => [
                'prompt_tokens' => 150,
                'completion_tokens' => 80,
                'total_tokens' => 230,
            ],
        ]),
    ]);

    $volunteer = Volunteer::factory()->create([
        'first_name' => 'John',
        'last_name' => 'Doe',
    ]);
    $skill = Skill::factory()->create(['name' => 'First Aid']);
    $volunteer->skills()->attach($skill);

    $volunteers = collect([$volunteer->load('skills', 'trainings', 'positions', 'experiences')]);

    $team = (object) ['id' => 2, 'name' => 'Medical Team'];
    $teams = collect([$team]);

    $service = new GroqService;
    $result = $service->suggestAssignments(
        $volunteers,
        $teams,
        'Sunday Service',
        'Weekly church service',
    );

    expect($result)->toHaveKey('assignments');
    expect($result['assignments'])->toHaveCount(1);
    expect($result['assignments'][0]['volunteer_id'])->toBe(1);
    expect($result['assignments'][0]['team_id'])->toBe(2);
    expect($result['assignments'][0]['role'])->toBe('Medical Officer');

    Http::assertSent(function (Illuminate\Http\Client\Request $request): bool {
        $body = $request->data();

        return $body['model'] === 'llama-3.3-70b-versatile'
            && $body['response_format']['type'] === 'json_object'
            && str_contains($body['messages'][0]['content'], 'ICS (Incident Command System)')
            && str_contains($body['messages'][1]['content'], 'Sunday Service');
    });
});

it('returns empty suggestions on api failure', function (): void {
    Http::fake([
        'api.groq.com/*' => Http::response(null, 500),
    ]);

    $service = new GroqService;
    $result = $service->suggestAssignments(
        collect(),
        collect(),
        'Test',
        null,
    );

    expect($result)->toBe([
        'assignments' => [],
        'unassigned' => [],
    ]);
});

it('returns empty suggestions on connection timeout', function (): void {
    Http::fake([
        'api.groq.com/*' => function (): never {
            throw new Illuminate\Http\Client\ConnectionException('Connection timed out');
        },
    ]);

    $service = new GroqService;
    $result = $service->suggestAssignments(
        collect(),
        collect(),
        'Test',
        null,
    );

    expect($result)->toBe([
        'assignments' => [],
        'unassigned' => [],
    ]);
});

it('returns empty suggestions on invalid json response', function (): void {
    Http::fake([
        'api.groq.com/*' => Http::response([
            'choices' => [
                [
                    'message' => [
                        'role' => 'assistant',
                        'content' => 'this is not valid json',
                    ],
                ],
            ],
        ]),
    ]);

    $service = new GroqService;
    $result = $service->suggestAssignments(
        collect(),
        collect(),
        'Test',
        null,
    );

    expect($result)->toBe([
        'assignments' => [],
        'unassigned' => [],
    ]);
});

it('builds prompt with volunteer profile data', function (): void {
    Http::fake([
        'api.groq.com/*' => Http::response([
            'choices' => [
                [
                    'message' => [
                        'role' => 'assistant',
                        'content' => json_encode([
                            'assignments' => [],
                            'unassigned' => [],
                        ]),
                    ],
                ],
            ],
        ]),
    ]);

    $volunteer = Volunteer::factory()->create([
        'first_name' => 'Jane',
        'last_name' => 'Smith',
    ]);
    $skill = Skill::factory()->create(['name' => 'Leadership']);
    $training = Training::factory()->create(['name' => 'Emergency Response']);
    $volunteer->skills()->attach($skill);
    $volunteer->trainings()->attach($training);

    $volunteers = collect([$volunteer->load('skills', 'trainings', 'positions', 'experiences')]);
    $teams = collect([(object) ['id' => 1, 'name' => 'Command Team']]);

    $service = new GroqService;
    $service->suggestAssignments(
        $volunteers,
        $teams,
        'Test Event',
        null,
    );

    Http::assertSent(function (Illuminate\Http\Client\Request $request): bool {
        $userMessage = $request->data()['messages'][1]['content'];

        return str_contains($userMessage, 'Jane Smith')
            && str_contains($userMessage, 'Leadership')
            && str_contains($userMessage, 'Emergency Response');
    });
});
