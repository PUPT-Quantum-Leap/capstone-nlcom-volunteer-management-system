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
        // Return legacy operational teams (those with deployment data)
        // These are the "TEAM ALPHA", "TEAM BRAVO", etc. rows with locations/times/pax
        $teams = IcsTeam::with('ics.rsvp')
            ->whereNotNull('departure_note')
            ->get();

        // Cross-reference volunteers from ICS-assigned teams by matching team name
        // ICS teams (Alpha, Bravo, etc.) have volunteer assignments via ics_volunteer pivot
        $teams->each(function ($icsTeam) {
            // Match legacy team name (e.g. "Team Alpha") to ICS team name (e.g. "Alpha")
            $teamName = preg_replace('/^team\s+/i', '', $icsTeam->team ?? '');

            // Find the corresponding ICS-generated team row that has branch_key + team_id
            $icsStructureTeam = IcsTeam::query()
                ->whereNotNull('branch_key')
                ->where('team', 'LIKE', '%'.$teamName.'%')
                ->where('ics_id', $icsTeam->ics_id)
                ->first();

            if ($icsStructureTeam && $icsStructureTeam->ics_id && $icsStructureTeam->team_id) {
                $volunteers = \Illuminate\Support\Facades\DB::table('ics_volunteer')
                    ->join('volunteer', 'volunteer.volunteer_id', '=', 'ics_volunteer.volunteer_id')
                    ->where('ics_volunteer.ics_id', $icsStructureTeam->ics_id)
                    ->where('ics_volunteer.team_id', $icsStructureTeam->team_id)
                    ->select('volunteer.volunteer_id', 'volunteer.first_name', 'volunteer.last_name', 'ics_volunteer.role', 'ics_volunteer.is_driver', 'ics_volunteer.is_leader')
                    ->get();

                $icsTeam->setAttribute('assigned_volunteers', $volunteers->map(fn ($v) => [
                    'id' => $v->volunteer_id,
                    'name' => trim($v->first_name.' '.$v->last_name),
                    'role' => $v->role,
                    'is_driver' => (bool) $v->is_driver,
                    'is_leader' => (bool) $v->is_leader,
                ])->values());
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
