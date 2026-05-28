<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\IcsTeam;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class IcsTeamController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        // Return distribution teams: new ICS structure (branch_key) + legacy feeding ops (departure_note)
        $teams = IcsTeam::with('ics.rsvp')
            ->where(function ($query) {
                $query->whereIn('branch_key', ['am_distribution', 'pm_distribution'])
                    ->orWhere(function ($q) {
                        $q->whereNull('branch_key')
                            ->whereNotNull('departure_note');
                    });
            })
            ->get();

        // Load volunteers assigned to each team via the ics_volunteer pivot
        $teams->each(function ($icsTeam) {
            if ($icsTeam->ics_id && $icsTeam->team_id) {
                $volunteers = DB::table('ics_volunteer')
                    ->join('volunteer', 'volunteer.volunteer_id', '=', 'ics_volunteer.volunteer_id')
                    ->where('ics_volunteer.ics_id', $icsTeam->ics_id)
                    ->where('ics_volunteer.team_id', $icsTeam->team_id)
                    ->select('volunteer.volunteer_id', 'volunteer.first_name', 'volunteer.last_name', 'ics_volunteer.role', 'ics_volunteer.is_driver', 'ics_volunteer.is_leader')
                    ->get();

                $icsTeam->setAttribute('assigned_volunteers', $volunteers->map(fn ($v) => [
                    'id' => $v->volunteer_id,
                    'name' => trim($v->first_name.' '.$v->last_name),
                    'role' => $v->role,
                    'is_driver' => (bool) $v->is_driver,
                    'is_leader' => (bool) $v->is_leader,
                ]));
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
