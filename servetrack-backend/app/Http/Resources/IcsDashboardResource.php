<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Collection;

class IcsDashboardResource extends JsonResource
{
    public const COMMAND_ROLES = [
        ['key' => 'responsible_official', 'title' => 'Responsible Official', 'assigned_name' => 'Paul Giague'],
        ['key' => 'incident_commander', 'title' => 'Incident Commander', 'assigned_name' => 'Catherine Tolentino'],
        ['key' => 'planning', 'title' => 'Planning', 'assigned_name' => 'Heidi Giague'],
        ['key' => 'purchasing', 'title' => 'Purchasing', 'assigned_name' => 'Stephanie Tan'],
        ['key' => 'mwc_coordinator', 'title' => 'MWC Coordinator', 'assigned_name' => 'Kevin Tabares'],
        ['key' => 'safety_emergency', 'title' => 'Safety & Emergency', 'assigned_name' => 'Sam Obmerga'],
        ['key' => 'mobile_kitchen_director', 'title' => 'Mobile Kitchen', 'assigned_name' => 'Elisa Aguipo'],
        ['key' => 'am_distribution_director', 'title' => 'AM Distribution', 'assigned_name' => 'Steph Tan'],
        ['key' => 'pm_distribution_director', 'title' => 'PM Distribution', 'assigned_name' => 'Steph Tan'],
    ];

    public const OPERATIONAL_BRANCHES = [
        [
            'key' => 'mobile_kitchen',
            'title' => 'Mobile Kitchen',
            'teams' => [
                ['key' => 'kitchen_truck', 'name' => 'Kitchen Truck', 'vehicle' => null],
                ['key' => 'food_prep', 'name' => 'Food Prep', 'vehicle' => null],
                ['key' => 'volunteer_care', 'name' => 'Volunteer Care', 'vehicle' => null],
                ['key' => 'wash_clean_up', 'name' => 'Wash / Clean Up', 'vehicle' => null],
                ['key' => 'inventory', 'name' => 'Inventory', 'vehicle' => null],
            ],
        ],
        [
            'key' => 'am_distribution',
            'title' => 'AM Distribution',
            'teams' => [
                ['key' => 'alpha', 'name' => 'Alpha', 'vehicle' => 'Flexi'],
                ['key' => 'bravo', 'name' => 'Bravo', 'vehicle' => 'Hilux'],
                ['key' => 'charlie_1', 'name' => 'Charlie 1', 'vehicle' => 'Clipper'],
                ['key' => 'charlie_2', 'name' => 'Charlie 2', 'vehicle' => 'Chevy'],
            ],
        ],
        [
            'key' => 'pm_distribution',
            'title' => 'PM Distribution',
            'teams' => [
                ['key' => 'delta_1', 'name' => 'Delta 1', 'vehicle' => 'Hilux'],
                ['key' => 'delta_2', 'name' => 'Delta 2', 'vehicle' => 'Black'],
                ['key' => 'echo', 'name' => 'Echo', 'vehicle' => 'Chevy'],
                ['key' => 'foxtrot', 'name' => 'Foxtrot', 'vehicle' => 'Flexi/Clipper'],
            ],
        ],
    ];

    public function toArray(Request $request): array
    {
        $roles = $this->commandRoles->keyBy('role_key');
        $teams = $this->icsTeams->keyBy('team_key');
        $volunteersByTeam = $this->volunteers->groupBy(fn ($volunteer) => (int) $volunteer->pivot->team_id);
        $suggestionsByTeam = collect($this->ai_suggestions ?: [])->groupBy(fn (array $suggestion) => (int) ($suggestion['team_id'] ?? 0));

        return [
            'ics_id' => $this->id,
            'rsvp' => [
                'id' => $this->rsvp?->rsvp_id,
                'title' => $this->rsvp?->title,
                'date' => $this->rsvp?->date,
                'location' => $this->location,
            ],
            'command_roles' => collect(self::COMMAND_ROLES)->map(function (array $default) use ($roles): array {
                $role = $roles->get($default['key']);

                return [
                    'key' => $default['key'],
                    'title' => $default['title'],
                    'assigned_name' => $role?->assigned_name ?? $default['assigned_name'],
                    'volunteer_id' => $role?->volunteer_id,
                ];
            })->values(),
            'branches' => collect(self::OPERATIONAL_BRANCHES)->map(function (array $branch) use ($teams, $volunteersByTeam, $suggestionsByTeam): array {
                return [
                    'key' => $branch['key'],
                    'title' => $branch['title'],
                    'teams' => collect($branch['teams'])->map(function (array $defaultTeam) use ($branch, $teams, $volunteersByTeam, $suggestionsByTeam): array {
                        $team = $teams->get($defaultTeam['key']);
                        $teamId = (int) ($team?->team_id ?? 0);
                        $suggestions = $suggestionsByTeam->get($teamId, collect());

                        return [
                            'id' => $teamId,
                            'key' => $defaultTeam['key'],
                            'name' => $team?->team ?? $defaultTeam['name'],
                            'branch_key' => $branch['key'],
                            'vehicle' => $team?->vehicle ?? $defaultTeam['vehicle'],
                            'assigned_volunteers' => $this->assignedVolunteers($volunteersByTeam->get($teamId, collect())),
                            'ai_suggestion' => $this->aiSuggestion($suggestions),
                        ];
                    })->values(),
                ];
            })->values(),
            'vehicles' => $this->vehicles($teams),
        ];
    }

    private function assignedVolunteers(Collection $volunteers): array
    {
        return $volunteers->map(fn ($volunteer): array => [
            'id' => $volunteer->volunteer_id,
            'name' => trim($volunteer->first_name.' '.$volunteer->last_name),
            'role' => $volunteer->pivot->role,
            'is_driver' => (bool) $volunteer->pivot->is_driver,
            'is_leader' => (bool) $volunteer->pivot->is_leader,
            'skills' => $volunteer->relationLoaded('skills') ? $volunteer->skills->pluck('name')->values() : [],
        ])->values()->all();
    }

    private function aiSuggestion(Collection $suggestions): array
    {
        $candidates = $suggestions->map(fn (array $suggestion): array => [
            'volunteer_id' => (int) ($suggestion['volunteer_id'] ?? 0),
            'name' => $suggestion['volunteer_name'] ?? 'Unknown volunteer',
            'role' => $suggestion['role'] ?? 'Team Member',
            'confidence' => (float) ($suggestion['confidence'] ?? 0),
            'skills' => $suggestion['skills'] ?? [],
            'reasoning' => $suggestion['reasoning'] ?? null,
        ])->filter(fn (array $candidate): bool => $candidate['volunteer_id'] > 0)->values();

        $first = $candidates->first();

        return [
            'rationale' => $first ? $this->rationale($first) : ['No AI suggestions available', 'Manual assignment recommended'],
            'candidates' => $candidates,
        ];
    }

    private function rationale(array $candidate): array
    {
        if (! empty($candidate['reasoning'])) {
            return [$candidate['reasoning']];
        }

        return [
            round($candidate['confidence'] * 100).'% confidence match',
            'Expert in '.(empty($candidate['skills']) ? 'general operations' : implode(', ', $candidate['skills'])),
            'Recommended role: '.$candidate['role'],
        ];
    }

    private function vehicles(Collection $teams): array
    {
        return $teams
            ->filter(fn ($team): bool => filled($team->vehicle))
            ->map(fn ($team): array => [
                'team_key' => $team->team_key,
                'team_name' => $team->team,
                'vehicle' => $team->vehicle,
            ])
            ->values()
            ->all();
    }
}
