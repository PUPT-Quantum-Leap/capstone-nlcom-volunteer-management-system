<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GroqService
{
    private const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

    public function __construct(
        private string $apiKey = '',
        private string $model = '',
        private int $maxTokens = 0,
        private float $temperature = 0.0,
    ) {
        $this->apiKey = (string) config('services.groq.api_key', '');
        $this->model = (string) config('services.groq.model', 'llama-3.3-70b-versatile');
        $this->maxTokens = (int) config('services.groq.max_tokens', 4096);
        $this->temperature = (float) config('services.groq.temperature', 0.1);
    }

    public function isConfigured(): bool
    {
        return ! empty($this->apiKey);
    }

    public function suggestAssignments(
        Collection $volunteers,
        Collection $teams,
        string $eventName,
        ?string $eventDescription,
    ): array {
        if (! $this->isConfigured()) {
            Log::warning('GroqService: API key not configured, returning empty suggestions');

            return [
                'assignments' => [],
                'unassigned' => [],
            ];
        }

        Log::info('GroqService: Starting suggestion generation', [
            'volunteer_count' => $volunteers->count(),
            'team_count' => $teams->count(),
            'event_name' => $eventName,
        ]);

        $systemPrompt = $this->buildSystemPrompt();
        $userPrompt = $this->buildUserPrompt($volunteers, $teams, $eventName, $eventDescription);

        Log::debug('GroqService: Prompts built', [
            'system_prompt_length' => strlen($systemPrompt),
            'user_prompt_length' => strlen($userPrompt),
        ]);

        try {
            Log::info('GroqService: Making API request to Groq', [
                'url' => self::GROQ_API_URL,
                'model' => $this->model,
            ]);

            $response = Http::withToken($this->apiKey)
                ->timeout(60)
                ->post(self::GROQ_API_URL, [
                    'model' => $this->model,
                    'messages' => [
                        ['role' => 'system', 'content' => $systemPrompt],
                        ['role' => 'user', 'content' => $userPrompt],
                    ],
                    'temperature' => $this->temperature,
                    'max_tokens' => $this->maxTokens,
                    'response_format' => ['type' => 'json_object'],
                ]);

            Log::info('GroqService: API response received', [
                'status' => $response->status(),
                'successful' => $response->successful(),
            ]);

            if (! $response->successful()) {
                Log::error('GroqService: API request failed', [
                    'status' => $response->status(),
                    'body_snippet' => substr($response->body(), 0, 200),
                ]);

                return [
                    'assignments' => [],
                    'unassigned' => [],
                ];
            }

            $data = $response->json();
            $content = $data['choices'][0]['message']['content'] ?? null;

            if (! $content) {
                Log::warning('GroqService: Empty response content');

                return [
                    'assignments' => [],
                    'unassigned' => [],
                ];
            }

            $parsed = json_decode($content, true);

            if (json_last_error() !== JSON_ERROR_NONE || ! is_array($parsed)) {
                Log::error('GroqService: Failed to parse JSON response', [
                    'error' => json_last_error_msg(),
                ]);

                return [
                    'assignments' => [],
                    'unassigned' => [],
                ];
            }

            Log::info('GroqService: Successfully generated suggestions', [
                'assignments_count' => count($parsed['assignments'] ?? []),
                'unassigned_count' => count($parsed['unassigned'] ?? []),
            ]);

            $assignments = isset($parsed['assignments']) && is_array($parsed['assignments'])
                ? $parsed['assignments']
                : [];
            $unassigned = isset($parsed['unassigned']) && is_array($parsed['unassigned'])
                ? $parsed['unassigned']
                : [];

            if ($assignments === [] && $unassigned === [] && ! empty($parsed)) {
                Log::warning('GroqService: Unexpected response shape', ['keys' => array_keys($parsed)]);
            }

            return [
                'assignments' => $assignments,
                'unassigned' => $unassigned,
            ];

        } catch (ConnectionException $e) {
            Log::error('GroqService: Connection timeout', [
                'error' => $e->getMessage(),
            ]);

            return [
                'assignments' => [],
                'unassigned' => [],
            ];
        } catch (\Throwable $e) {
            Log::error('GroqService: Unexpected error', [
                'error' => $e->getMessage(),
            ]);

            return [
                'assignments' => [],
                'unassigned' => [],
            ];
        }
    }

    private function buildSystemPrompt(): string
    {
        return <<<'PROMPT'
You are an ICS (Incident Command System) team assignment specialist for a church volunteer organization called NLCOM.
Your task is to assign volunteers to the most suitable ICS teams based on their skills, training, experience, and positions.

Analyze each volunteer's profile and determine the best team fit. Consider:
1. Skills matching - match volunteer skills to team requirements
2. Training relevance - relevant training increases suitability
3. Leadership positions - volunteers with leader positions should lead teams
4. Prior experience - relevant experience is a strong indicator
5. Lifegroup membership - can be useful for team cohesion
6. Time preference - CRITICAL: volunteers who chose AM shift MUST only be assigned to AM Distribution teams or Mobile Kitchen teams. Volunteers who chose PM shift MUST only be assigned to PM Distribution teams or Mobile Kitchen teams. Mobile Kitchen teams accept all shifts.
7. Maximum capacity - each team should have a MAXIMUM of 3-5 volunteers assigned. Distribute evenly.
8. Profession - consider the volunteer's profession/occupation when available for better matching

Return ONLY a JSON object with exactly this structure - no markdown, no code fences:
{
  "assignments": [
    {
      "volunteer_id": integer,
      "team_id": integer,
      "role": "string (specific role like 'Team Lead', 'Medical Officer', etc.)",
      "confidence": float between 0 and 1,
      "reasoning": "brief explanation of why this volunteer fits this team"
    }
  ],
  "unassigned": [
    {
      "volunteer_id": integer,
      "reason": "why this volunteer could not be assigned"
    }
  ]
}
PROMPT;
    }

    private function buildUserPrompt(
        Collection $volunteers,
        Collection $teams,
        string $eventName,
        ?string $eventDescription,
    ): string {
        $parts = [];

        $parts[] = "Event: $eventName";
        if ($eventDescription) {
            $parts[] = "Description: $eventDescription";
        }

        $parts[] = '';
        $parts[] = 'Available Teams:';
        $parts[] = 'Branch: Mobile Kitchen (teams for ALL shifts):';
        $parts[] = '  Kitchen Truck, Food Prep, Volunteer Care, Wash / Clean Up, Inventory';
        $parts[] = 'Branch: AM Distribution (teams for AM-shift volunteers ONLY):';
        $parts[] = '  Alpha, Bravo, Charlie 1, Charlie 2';
        $parts[] = 'Branch: PM Distribution (teams for PM-shift volunteers ONLY):';
        $parts[] = '  Delta 1, Delta 2, Echo, Foxtrot';
        $parts[] = '';
        foreach ($teams as $team) {
            $parts[] = "- Team ID {$team->id}: {$team->name}";
        }

        $parts[] = '';
        $parts[] = 'Volunteers to Assign:';
        foreach ($volunteers as $volunteer) {
            $name = $volunteer->first_name.' '.$volunteer->last_name;
            $skills = $volunteer->relationLoaded('skills')
                ? $volunteer->skills->pluck('name')->implode(', ')
                : 'N/A';
            $training = $volunteer->relationLoaded('trainings')
                ? $volunteer->trainings->pluck('name')->implode(', ')
                : 'N/A';
            $positions = $volunteer->relationLoaded('positions')
                ? $volunteer->positions->pluck('name')->implode(', ')
                : 'N/A';
            $experiences = $volunteer->relationLoaded('experiences')
                ? $volunteer->experiences->pluck('name')->implode(', ')
                : 'N/A';
            $shiftPreference = 'Unknown';
            if ($volunteer->relationLoaded('rsvpResponses') && $volunteer->rsvpResponses->isNotEmpty()) {
                $response = $volunteer->rsvpResponses->first();
                $shiftPreference = $response->timeSlot?->text ?? 'Unknown';
            }

            $parts[] = "- Volunteer ID {$volunteer->volunteer_id}: $name";
            $parts[] = "  Time Preference: $shiftPreference";
            $parts[] = "  Skills: $skills";
            $parts[] = "  Training: $training";
            $parts[] = "  Positions: $positions";
            $parts[] = "  Experience: $experiences";
            $parts[] = "  Education/Profession: ".($volunteer->educational_attainment ?? 'N/A');
        }

        return implode("\n", $parts);
    }
}
