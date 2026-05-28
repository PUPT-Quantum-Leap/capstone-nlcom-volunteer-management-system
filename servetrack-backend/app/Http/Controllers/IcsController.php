<?php

namespace App\Http\Controllers;

use App\Http\Requests\ApplyAiSuggestionsRequest;
use App\Http\Requests\AssignVolunteerRequest;
use App\Http\Requests\RemoveVolunteerRequest;
use App\Http\Requests\StoreIcsRequest;
use App\Http\Requests\UpdateIcsCommandRoleRequest;
use App\Http\Requests\UpdateIcsRequest;
use App\Http\Resources\IcsDashboardResource;
use App\Http\Resources\IcsResource;
use App\Http\Resources\VolunteerResource;
use App\Models\Ics;
use App\Models\IcsCommandRole;
use App\Models\IcsTeam;
use App\Models\Rsvp;
use App\Models\Team;
use App\Models\Volunteer;
use App\Services\IcsService;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class IcsController extends Controller
{
    use AuthorizesRequests;

    public function __construct(
        private IcsService $icsService
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Ics::query()
            ->with(['rsvp', 'teams', 'volunteers' => function ($query) {
                $query->with('skills');
            }]);

        if ($request->user()?->role !== 'admin') {
            $query->where('status', 'active');
        }

        $ics = $query->latest()->paginate(15);

        return IcsResource::collection($ics);
    }

    public function show(int $id): IcsResource|JsonResponse
    {
        $ics = Ics::query()
            ->with(['rsvp', 'teams', 'volunteers' => function ($query) {
                $query->with('skills');
            }])
            ->find($id);

        if (! $ics) {
            return response()->json(['message' => 'ICS not found.'], 404);
        }

        return new IcsResource($ics);
    }

    public function dashboard(Request $request): IcsDashboardResource|JsonResponse
    {
        $validated = $request->validate([
            'rsvp_id' => ['required', 'integer', 'exists:rsvp,rsvp_id'],
        ]);

        $rsvp = Rsvp::query()->find((int) $validated['rsvp_id']);

        if (! $rsvp) {
            return response()->json(['message' => 'RSVP not found.'], 404);
        }

        $ics = DB::transaction(function () use ($rsvp): Ics {
            $ics = Ics::query()->firstOrCreate(
                ['rsvp_id' => $rsvp->rsvp_id],
                [
                    'name' => $rsvp->title,
                    'description' => $rsvp->description,
                    'date' => $rsvp->date,
                    'location' => $rsvp->event_location,
                    'status' => 'draft',
                ]
            );

            // Only seed the full set of default teams on first creation.
            // For existing ICS records we only ensure command roles exist — never
            // re-insert IcsTeam rows, which would create phantom ghost entries
            // alongside any real custom team data already in the table.
            if ($ics->wasRecentlyCreated) {
                $this->ensureDashboardDefaults($ics);
            } else {
                $this->ensureCommandRoleDefaults($ics);
            }

            return $ics;
        });

        return new IcsDashboardResource($this->loadDashboard($ics->id));
    }

    public function updateCommandRole(UpdateIcsCommandRoleRequest $request, int $icsId, string $roleKey): IcsDashboardResource|JsonResponse
    {
        $ics = Ics::query()->find($icsId);

        if (! $ics) {
            return response()->json(['message' => 'ICS not found.'], 404);
        }

        // Only seed command roles here — never re-seed IcsTeam rows on a role update.
        $this->ensureCommandRoleDefaults($ics);

        $defaults = collect(IcsDashboardResource::COMMAND_ROLES)->keyBy('key');
        $defaultRole = $defaults->get($roleKey);

        if (! $defaultRole) {
            return response()->json(['message' => 'Command role not found.'], 404);
        }

        $assignedName = $request->input('assigned_name');
        $volunteerId = $request->input('volunteer_id');

        if ($volunteerId) {
            $volunteer = Volunteer::query()->find($volunteerId);
            $assignedName = trim($volunteer->first_name.' '.$volunteer->last_name);
        }

        IcsCommandRole::query()->updateOrCreate(
            ['ics_id' => $ics->id, 'role_key' => $roleKey],
            [
                'role_title' => $defaultRole['title'],
                'volunteer_id' => $volunteerId,
                'assigned_name' => $assignedName,
            ]
        );

        return new IcsDashboardResource($this->loadDashboard($ics->id));
    }

    public function store(StoreIcsRequest $request): JsonResponse
    {
        $rsvp = Rsvp::query()->find($request->input('rsvp_id'));

        if (! $rsvp) {
            return response()->json(['message' => 'RSVP not found.'], 404);
        }

        $existingIcs = Ics::query()->where('rsvp_id', $rsvp->rsvp_id)->first();

        if ($existingIcs) {
            $existingIcs->load(['rsvp', 'teams', 'volunteers' => fn ($query) => $query->with('skills')]);

            return (new IcsResource($existingIcs))
                ->response()
                ->setStatusCode(200);
        }

        $ics = DB::transaction(function () use ($request, $rsvp): Ics {
            $location = $request->input('location');
            if (! $location) {
                $rsvp->load('location');
                if ($rsvp->location) {
                    $location = $rsvp->location->full_address;
                } else {
                    $location = $rsvp->event_location;
                }
            }

            $ics = Ics::query()->create([
                'rsvp_id' => $rsvp->rsvp_id,
                'name' => $request->input('name'),
                'description' => $request->input('description'),
                'date' => $rsvp->date,
                'location' => $location,
                'status' => $request->input('status', 'draft'),
            ]);

            $teamIds = $request->input('team_ids');
            if (empty($teamIds)) {
                $teamIds = Team::query()->pluck('id')->all();
            }

            if (! empty($teamIds)) {
                $teams = Team::query()->whereIn('id', $teamIds)->get();
                foreach ($teams as $team) {
                    IcsTeam::query()->create([
                        'ics_id' => $ics->id,
                        'team_id' => $team->id,
                        'team' => $team->name,
                    ]);
                }
            }

            return $ics->load(['rsvp', 'teams']);
        });

        return (new IcsResource($ics))
            ->response()
            ->setStatusCode(201);
    }

    public function update(UpdateIcsRequest $request, int $id): IcsResource|JsonResponse
    {
        $ics = Ics::query()->find($id);

        if (! $ics) {
            return response()->json(['message' => 'ICS not found.'], 404);
        }

        DB::transaction(function () use ($request, $ics): void {
            $ics->update(array_filter([
                'name' => $request->input('name'),
                'description' => $request->input('description'),
                'location' => $request->input('location'),
                'status' => $request->input('status'),
                'ai_suggestions' => $request->input('ai_suggestions'),
                'objective' => $request->input('objective'),
                'menu' => $request->input('menu'),
                'meal_breakfast' => $request->input('meal_breakfast'),
                'meal_lunch' => $request->input('meal_lunch'),
                'meal_snacks' => $request->input('meal_snacks'),
            ], fn ($value) => $value !== null));

            if ($request->has('team_ids')) {
                $teamIds = $request->input('team_ids');
                IcsTeam::query()->where('ics_id', $ics->id)->delete();

                if (! empty($teamIds)) {
                    $teams = Team::query()->whereIn('id', $teamIds)->get();
                    foreach ($teams as $team) {
                        IcsTeam::query()->create([
                            'ics_id' => $ics->id,
                            'team_id' => $team->id,
                            'team' => $team->name,
                        ]);
                    }
                }
            }
        });

        return new IcsResource($ics->fresh('teams'));
    }

    public function destroy(int $id): JsonResponse
    {
        $ics = Ics::query()->find($id);

        if (! $ics) {
            return response()->json(['message' => 'ICS not found.'], 404);
        }

        $ics->delete();

        return response()->json(['message' => 'ICS deleted successfully.']);
    }

    /**
     * Get volunteers who RSVP'd for a specific event.
     */
    public function getRsvpVolunteers(int $rsvpId, Request $request): AnonymousResourceCollection|JsonResponse
    {
        $rsvp = Rsvp::query()->find($rsvpId);

        if (! $rsvp) {
            return response()->json(['message' => 'RSVP not found.'], 404);
        }

        $query = Volunteer::query()
            ->whereHas('rsvpResponses', function ($query) use ($rsvpId) {
                $query->where('rsvp_id', $rsvpId);
            })
            ->with(['skills', 'positions', 'experiences']);

        // Filter by shift if requested (am/pm)
        $shift = $request->query('shift');
        $shift = is_string($shift) ? strtolower(trim($shift)) : null;
        if ($shift && in_array($shift, ['am', 'pm'], true)) {
            // Get the RSVP's shift time_slot_ids via Eloquent relationship, ordered ascending
            $slotIds = $rsvp->shifts()
                ->orderBy('time_slot_id', 'asc')
                ->get()
                ->pluck('time_slot_id');

            $targetSlotId = match ($shift) {
                'am' => $slotIds->first(),
                'pm' => $slotIds->last(),
                default => null,
            };

            if ($targetSlotId) {
                $query->whereHas('rsvpResponses', function ($q) use ($rsvpId, $targetSlotId) {
                    $q->where('rsvp_id', $rsvpId)->where('time_slot_id', $targetSlotId);
                });
            }
        }

        $volunteers = $query->get();

        return VolunteerResource::collection($volunteers);
    }

    /**
     * Get AI suggestions for team assignments based on volunteer skills.
     */
    public function getAiSuggestions(int $icsId): JsonResponse
    {
        $ics = Ics::query()->with(['rsvp', 'teams'])->find($icsId);

        if (! $ics) {
            return response()->json(['message' => 'ICS not found.'], 404);
        }

        $this->authorize('getAiSuggestions', $ics);

        $result = $this->icsService->generateTeamAssignments($ics);

        return response()->json([
            'data' => $result['assignments'] ?? [],
            'meta' => [
                'message' => $result['message'] ?? null,
                'total_volunteers' => $result['total_volunteers'] ?? 0,
            ],
        ]);
    }

    /**
     * Apply AI suggestions to assign volunteers to teams.
     */
    public function applyAiSuggestions(ApplyAiSuggestionsRequest $request, int $icsId): IcsResource|JsonResponse
    {
        $ics = Ics::query()->find($icsId);

        if (! $ics) {
            return response()->json(['message' => 'ICS not found.'], 404);
        }

        // Pre-load all volunteers and teams to avoid N+1 queries
        /** @var array<int, array{volunteer_id: int, team_id: int, role?: string}> $suggestions */
        $suggestions = $request->input('suggestions', []) ?: [];

        $volunteerIds = collect($suggestions)->pluck('volunteer_id')->unique();
        $teamIds = collect($suggestions)->pluck('team_id')->unique();

        $volunteers = Volunteer::query()->whereIn('volunteer_id', $volunteerIds)->get()->keyBy('volunteer_id');
        $teams = Team::query()->whereIn('id', $teamIds)->get()->keyBy('id');
        $icsTeamIds = $ics->teams()->pluck('teams.id')->flip();

        DB::transaction(function () use ($suggestions, $ics, $volunteers, $teams, $icsTeamIds): void {
            foreach ($suggestions as $suggestion) {
                $volunteer = $volunteers->get((int) ($suggestion['volunteer_id'] ?? 0));
                $team = $teams->get((int) ($suggestion['team_id'] ?? 0));

                $isTeamInIcs = $team && $icsTeamIds->has($team->id);

                if ($volunteer && $isTeamInIcs) {
                    $ics->volunteers()->syncWithoutDetaching([
                        $volunteer->volunteer_id => [
                            'team_id' => $team->id,
                            'role' => $suggestion['role'] ?? null,
                            'is_driver' => false,
                            'is_leader' => str_contains(strtolower($suggestion['role'] ?? ''), 'lead'),
                            'assigned_at' => now(),
                        ],
                    ]);
                }
            }

            $ics->update(['ai_suggestions' => $suggestions]);
        });

        return new IcsResource($ics->fresh(['rsvp', 'teams', 'volunteers' => fn ($query) => $query->with('skills')]));
    }

    /**
     * Manually assign a volunteer to a team in an ICS.
     */
    public function assignVolunteer(AssignVolunteerRequest $request, int $icsId): JsonResponse
    {
        $ics = Ics::query()->find($icsId);

        if (! $ics) {
            return response()->json(['message' => 'ICS not found.'], 404);
        }

        $volunteer = Volunteer::query()->find($request->input('volunteer_id'));

        if (! $volunteer) {
            return response()->json(['message' => 'Volunteer not found.'], 404);
        }

        $isTeamInIcs = $ics->teams()->whereKey($request->input('team_id'))->exists();

        if (! $isTeamInIcs) {
            return response()->json(['message' => 'Team does not belong to this ICS.'], 422);
        }

        DB::transaction(function () use ($request, $ics, $volunteer): void {
            $ics->volunteers()->syncWithoutDetaching([
                $volunteer->volunteer_id => [
                    'team_id' => $request->input('team_id'),
                    'role' => $request->input('role'),
                    'is_driver' => $request->boolean('is_driver'),
                    'is_leader' => $request->boolean('is_leader'),
                    'assigned_at' => now(),
                ],
            ]);
        });

        return response()->json(['message' => 'Volunteer assigned successfully.']);
    }

    /**
     * Remove a volunteer from an ICS.
     */
    public function removeVolunteer(RemoveVolunteerRequest $request, int $icsId): JsonResponse
    {
        $ics = Ics::query()->find($icsId);

        if (! $ics) {
            return response()->json(['message' => 'ICS not found.'], 404);
        }

        $ics->volunteers()->detach($request->input('volunteer_id'));

        return response()->json(['message' => 'Volunteer removed successfully.']);
    }

    /**
     * Move a volunteer from one team to another within the same ICS.
     */
    public function moveVolunteer(Request $request, int $icsId): JsonResponse
    {
        $request->validate([
            'volunteer_id' => ['required', 'integer'],
            'from_team_id' => ['required', 'integer'],
            'to_team_id' => ['required', 'integer'],
            'role' => ['nullable', 'string', 'max:255'],
        ]);

        $ics = Ics::query()->find($icsId);

        if (! $ics) {
            return response()->json(['message' => 'ICS not found.'], 404);
        }

        $volunteerId = $request->input('volunteer_id');
        $toTeamId = $request->input('to_team_id');

        // Verify the target team belongs to this ICS
        $isTeamInIcs = $ics->icsTeams()->where('team_id', $toTeamId)->exists();

        if (! $isTeamInIcs) {
            return response()->json(['message' => 'Target team does not belong to this ICS.'], 422);
        }

        DB::transaction(function () use ($ics, $volunteerId, $toTeamId, $request): void {
            $ics->volunteers()->updateExistingPivot($volunteerId, [
                'team_id' => $toTeamId,
                'role' => $request->input('role', 'Team Member'),
            ]);
        });

        return response()->json(['message' => 'Volunteer moved successfully.']);
    }

    /**
     * Seed only the 9 fixed command roles for a given ICS.
     * Safe to call at any time — uses firstOrCreate so it never overwrites
     * existing assignments and never touches the ics_team table.
     */
    private function ensureCommandRoleDefaults(Ics $ics): void
    {
        foreach (IcsDashboardResource::COMMAND_ROLES as $role) {
            IcsCommandRole::query()->firstOrCreate(
                ['ics_id' => $ics->id, 'role_key' => $role['key']],
                [
                    'role_title' => $role['title'],
                    'assigned_name' => $role['assigned_name'],
                ]
            );
        }
    }

    /**
     * Seed both command roles and all 13 default operational teams.
     * Should only be called when the ICS record is first created
     * (wasRecentlyCreated === true) to avoid duplicating IcsTeam rows
     * for ICS records that already have real custom team data.
     */
    private function ensureDashboardDefaults(Ics $ics): void
    {
        $this->ensureCommandRoleDefaults($ics);

        foreach (IcsDashboardResource::OPERATIONAL_BRANCHES as $branch) {
            foreach ($branch['teams'] as $teamDefinition) {
                $team = Team::query()->firstOrCreate(['name' => $teamDefinition['name']]);

                IcsTeam::query()->updateOrCreate(
                    ['ics_id' => $ics->id, 'team_key' => $teamDefinition['key']],
                    [
                        'team_id' => $team->id,
                        'team' => $team->name,
                        'branch_key' => $branch['key'],
                        'branch_title' => $branch['title'],
                        'vehicle' => $teamDefinition['vehicle'],
                    ]
                );
            }
        }
    }

    private function loadDashboard(int $icsId): Ics
    {
        return Ics::query()
            ->with([
                'rsvp',
                'commandRoles',
                'icsTeams' => fn ($query) => $query->orderBy('id'),
                'volunteers' => fn ($query) => $query->with('skills'),
            ])
            ->findOrFail($icsId);
    }
}
