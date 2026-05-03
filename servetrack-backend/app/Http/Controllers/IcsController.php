<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreIcsRequest;
use App\Http\Requests\UpdateIcsRequest;
use App\Http\Resources\IcsResource;
use App\Http\Resources\VolunteerResource;
use App\Models\Ics;
use App\Models\Rsvp;
use App\Models\Team;
use App\Models\Volunteer;
use App\Services\IcsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class IcsController extends Controller
{
    public function __construct(
        private IcsService $icsService
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Ics::query()
            ->with(['rsvp', 'teams', 'volunteers' => function ($query) {
                $query->with('skills');
            }]);

        if ($request->user()->role !== 'admin') {
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

    public function store(StoreIcsRequest $request): JsonResponse
    {
        $rsvp = Rsvp::query()->find($request->input('rsvp_id'));

        if (! $rsvp) {
            return response()->json(['message' => 'RSVP not found.'], 404);
        }

        $ics = DB::transaction(function () use ($request, $rsvp): Ics {
            $ics = Ics::query()->create([
                'rsvp_id' => $rsvp->rsvp_id,
                'name' => $request->input('name'),
                'description' => $request->input('description'),
                'date' => $rsvp->date,
                'location' => $request->input('location') ?? $rsvp->event_location,
                'status' => $request->input('status', 'draft'),
            ]);

            if ($request->has('team_ids')) {
                foreach ($request->input('team_ids') as $teamId) {
                    $team = Team::query()->find($teamId);
                    if ($team) {
                        $ics->teams()->attach($teamId);
                    }
                }
            }

            return $ics->load('teams');
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
            ], fn ($value) => $value !== null));

            if ($request->has('team_ids')) {
                $ics->teams()->sync($request->input('team_ids'));
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
    public function getRsvpVolunteers(int $rsvpId): AnonymousResourceCollection
    {
        $rsvp = Rsvp::query()->find($rsvpId);

        if (! $rsvp) {
            abort(404, 'RSVP not found.');
        }

        $volunteers = Volunteer::query()
            ->whereHas('rsvpResponses', function ($query) use ($rsvpId) {
                $query->where('rsvp_id', $rsvpId);
            })
            ->with(['skills', 'positions', 'experiences'])
            ->get();

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

        $suggestions = $this->icsService->generateTeamAssignments($ics);

        return response()->json([
            'data' => $suggestions,
        ]);
    }

    /**
     * Apply AI suggestions to assign volunteers to teams.
     */
    public function applyAiSuggestions(Request $request, int $icsId): JsonResponse
    {
        $request->validate([
            'suggestions' => ['required', 'array'],
        ]);

        $ics = Ics::query()->find($icsId);

        if (! $ics) {
            return response()->json(['message' => 'ICS not found.'], 404);
        }

        DB::transaction(function () use ($request, $ics): void {
            foreach ($request->input('suggestions') as $suggestion) {
                $volunteer = Volunteer::query()->find($suggestion['volunteer_id']);
                $team = Team::query()->find($suggestion['team_id']);

                if ($volunteer && $team) {
                    $ics->volunteers()->syncWithoutDetaching([
                        $volunteer->volunteer_id => [
                            'team_id' => $team->id,
                            'role' => $suggestion['role'] ?? null,
                            'assigned_at' => now(),
                        ],
                    ]);
                }
            }

            $ics->update(['ai_suggestions' => $request->input('suggestions')]);
        });

        return response()->json(['message' => 'AI suggestions applied successfully.']);
    }

    /**
     * Manually assign a volunteer to a team in an ICS.
     */
    public function assignVolunteer(Request $request, int $icsId): JsonResponse
    {
        $request->validate([
            'volunteer_id' => ['required', 'exists:volunteer,volunteer_id'],
            'team_id' => ['nullable', 'exists:teams,id'],
            'role' => ['nullable', 'string'],
        ]);

        $ics = Ics::query()->find($icsId);

        if (! $ics) {
            return response()->json(['message' => 'ICS not found.'], 404);
        }

        $volunteer = Volunteer::query()->find($request->input('volunteer_id'));

        if (! $volunteer) {
            return response()->json(['message' => 'Volunteer not found.'], 404);
        }

        DB::transaction(function () use ($request, $ics, $volunteer): void {
            $ics->volunteers()->syncWithoutDetaching([
                $volunteer->volunteer_id => [
                    'team_id' => $request->input('team_id'),
                    'role' => $request->input('role'),
                    'assigned_at' => now(),
                ],
            ]);
        });

        return response()->json(['message' => 'Volunteer assigned successfully.']);
    }

    /**
     * Remove a volunteer from an ICS.
     */
    public function removeVolunteer(Request $request, int $icsId): JsonResponse
    {
        $request->validate([
            'volunteer_id' => ['required', 'exists:volunteer,volunteer_id'],
        ]);

        $ics = Ics::query()->find($icsId);

        if (! $ics) {
            return response()->json(['message' => 'ICS not found.'], 404);
        }

        $ics->volunteers()->detach($request->input('volunteer_id'));

        return response()->json(['message' => 'Volunteer removed successfully.']);
    }
}
