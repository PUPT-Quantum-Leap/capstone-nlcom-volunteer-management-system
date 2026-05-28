<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ics;
use App\Models\IcsTeam;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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

        // Cross-reference volunteers from ICS-assigned teams by matching team name.
        // TEAM CHARLIE → matches ICS "Charlie 1" + "Charlie 2" → combines volunteers.
        $teams->each(function ($icsTeam) {
            // Strip "Team " prefix: "Team Alpha" → "Alpha", "Team Charlie" → "Charlie"
            $teamName = preg_replace('/^team\s+/i', '', $icsTeam->team ?? '');
            $teamName = trim($teamName);

            if (! $teamName || ! $icsTeam->ics_id) {
                $icsTeam->setAttribute('assigned_volunteers', []);

                return;
            }

            // Find ALL matching ICS structure teams (e.g., "Charlie" matches "Charlie 1" + "Charlie 2")
            $matchingTeamIds = IcsTeam::query()
                ->whereNotNull('branch_key')
                ->where('team', 'LIKE', '%'.$teamName.'%')
                ->where('ics_id', $icsTeam->ics_id)
                ->whereNotNull('team_id')
                ->pluck('team_id');

            if ($matchingTeamIds->isNotEmpty()) {
                $volunteers = DB::table('ics_volunteer')
                    ->join('volunteer', 'volunteer.volunteer_id', '=', 'ics_volunteer.volunteer_id')
                    ->where('ics_volunteer.ics_id', $icsTeam->ics_id)
                    ->whereIn('ics_volunteer.team_id', $matchingTeamIds)
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

        // Auto-fill empty Location/Time/Pax from ICS + RSVP data (admin can still override via edit)
        $teams->each(function ($icsTeam) {
            $ics = $icsTeam->ics;
            if (! $ics) {
                return;
            }

            $rsvp = $ics->rsvp;

            // Auto-fill Location: use RSVP event_location if team row has no location
            if (empty($icsTeam->location) && $rsvp) {
                $icsTeam->setAttribute('location', $rsvp->event_location ?? '');
            }

            // Auto-fill Time: determine from team name (AM or PM shift from RSVP time slots)
            if (empty($icsTeam->time) && $rsvp) {
                $teamName = strtolower($icsTeam->team ?? '');
                $shifts = $rsvp->shifts()->orderBy('time_slot.time_slot_id', 'asc')->get();

                if ($shifts->isNotEmpty()) {
                    // Alpha/Bravo/Charlie = AM (first shift), Delta/Echo/Foxtrot = PM (last shift)
                    $isAm = str_contains($teamName, 'alpha') || str_contains($teamName, 'bravo') || str_contains($teamName, 'charlie');
                    $shift = $isAm ? $shifts->first() : $shifts->last();
                    $icsTeam->setAttribute('time', $shift->text ?? '');
                }
            }

            // Auto-fill Pax: ICS objective equally divided among all teams
            if (($icsTeam->no_of_pax === 0 || $icsTeam->no_of_pax === null) && $ics->objective) {
                $totalTeams = IcsTeam::where('ics_id', $ics->id)
                    ->whereNotNull('departure_note')
                    ->count();

                if ($totalTeams > 0) {
                    $icsTeam->setAttribute('no_of_pax', (int) round($ics->objective / $totalTeams));
                }
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
