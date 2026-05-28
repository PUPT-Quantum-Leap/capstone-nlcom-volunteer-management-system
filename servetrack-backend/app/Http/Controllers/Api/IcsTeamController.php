<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\IcsTeam;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class IcsTeamController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(): JsonResponse
    {
        // Return distribution teams with volunteers eager-loaded
        $teams = IcsTeam::with(['ics.rsvp', 'ics.volunteers'])
            ->where(function ($query) {
                $query->whereIn('branch_key', ['am_distribution', 'pm_distribution'])
                    ->orWhere(function ($q) {
                        $q->whereNull('branch_key')
                            ->whereNotNull('departure_note');
                    });
            })
            ->get();

        // Filter volunteers per team from eager-loaded relationship (no N+1)
        $teams->each(function ($icsTeam) {
            if ($icsTeam->ics && $icsTeam->team_id) {
                $teamVolunteers = $icsTeam->ics->volunteers
                    ->filter(fn ($v) => (int) $v->pivot->team_id === (int) $icsTeam->team_id)
                    ->map(fn ($v) => [
                        'id' => $v->volunteer_id,
                        'name' => trim($v->first_name.' '.$v->last_name),
                        'role' => $v->pivot->role,
                        'is_driver' => (bool) $v->pivot->is_driver,
                        'is_leader' => (bool) $v->pivot->is_leader,
                    ])
                    ->values();

                $icsTeam->setAttribute('assigned_volunteers', $teamVolunteers);
            } else {
                $icsTeam->setAttribute('assigned_volunteers', []);
            }
        });

        return response()->json($teams);
    }

    public function getTeams()
    {
        return response()->json(IcsTeam::distinct()->pluck('team'));
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'team' => 'required|string',
            'departure_note' => 'nullable|string',
            'location' => 'nullable|string',
            'time' => 'nullable|string',
            'no_of_pax' => 'nullable|integer',
            'details' => 'nullable|string',
            'ics_id' => 'sometimes|integer|exists:ics,id',
        ]);

        if (! isset($validated['ics_id'])) {
            $validated['ics_id'] = IcsTeam::query()
                ->whereNotNull('ics_id')
                ->value('ics_id');
        }

        $icsTeam = IcsTeam::create($validated);

        return response()->json($icsTeam, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        $icsTeam = IcsTeam::findOrFail($id);

        return response()->json($icsTeam);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        $icsTeam = IcsTeam::findOrFail($id);

        $validated = $request->validate([
            'team' => 'sometimes|required|string',
            'departure_note' => 'nullable|string',
            'location' => 'nullable|string',
            'time' => 'nullable|string',
            'no_of_pax' => 'nullable|integer',
            'details' => 'nullable|string',
        ]);

        $icsTeam->update($validated);

        return response()->json($icsTeam);
    }
}
