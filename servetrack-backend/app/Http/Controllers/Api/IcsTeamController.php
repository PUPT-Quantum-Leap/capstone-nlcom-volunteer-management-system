<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\IcsTeam;
use Illuminate\Http\Request;

class IcsTeamController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        // Only return distribution teams (AM + PM) — exclude Mobile Kitchen teams
        return response()->json(
            IcsTeam::with('ics.rsvp')
                ->whereIn('branch_key', ['am_distribution', 'pm_distribution'])
                ->get()
        );
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
