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
     * Returns distribution teams (Alpha→Foxtrot) from the latest ICS,
     * grouped by parent team (Charlie 1+2 → Team Charlie, Delta 1+2 → Team Delta).
     */
    public function index(): JsonResponse
    {
        // Get the latest ICS record
        $latestIcs = Ics::query()->with('rsvp')->latest()->first();

        if (! $latestIcs) {
            return response()->json([]);
        }

        // Get distribution teams (AM + PM) from the latest ICS, ordered logically
        $teams = IcsTeam::with('ics.rsvp')
            ->where('ics_id', $latestIcs->id)
            ->whereIn('branch_key', ['am_distribution', 'pm_distribution'])
            ->orderByRaw("FIELD(team_key, 'alpha', 'bravo', 'charlie_1', 'charlie_2', 'delta_1', 'delta_2', 'echo', 'foxtrot')")
            ->get();

        if ($teams->isEmpty()) {
            return response()->json([]);
        }

        // Get RSVP shifts for time auto-fill
        $rsvp = $latestIcs->rsvp;
        $shifts = $rsvp ? $rsvp->shifts()->orderBy('time_slot.time_slot_id', 'asc')->get() : collect();
        $totalRows = $teams->count();

        // Load volunteers + auto-fill for each team row
        $teams->each(function ($icsTeam) use ($latestIcs, $rsvp, $shifts, $totalRows) {
            // --- Volunteers ---
            if ($icsTeam->team_id && $icsTeam->ics_id) {
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
                ])->values());
            } else {
                $icsTeam->setAttribute('assigned_volunteers', []);
            }

            // --- Auto-fill Location (from RSVP, if empty) ---
            if (empty($icsTeam->location) && $rsvp) {
                $icsTeam->setAttribute('location', $rsvp->event_location ?? '');
            }

            // --- Auto-fill Time (AM or PM shift from RSVP, if empty) ---
            if (empty($icsTeam->time) && $shifts->isNotEmpty()) {
                $isAm = $icsTeam->branch_key === 'am_distribution';
                $shift = $isAm ? $shifts->first() : $shifts->last();
                $icsTeam->setAttribute('time', $shift->text ?? '');
            }

            // --- Auto-fill Pax (ICS objective ÷ total rows, if 0/null) ---
            if (($icsTeam->no_of_pax === 0 || $icsTeam->no_of_pax === null) && $latestIcs->objective && $totalRows > 0) {
                $icsTeam->setAttribute('no_of_pax', (int) round($latestIcs->objective / $totalRows));
            }

            // --- Parent team grouping (for frontend rowspan) ---
            // "Charlie 1" → "Team Charlie", "Delta 2" → "Team Delta", "Alpha" → "Team Alpha"
            $teamName = $icsTeam->team ?? '';
            $parentTeam = trim(preg_replace('/\s*\d+$/', '', $teamName));
            $icsTeam->setAttribute('parent_team', 'Team '.$parentTeam);
        });

        return response()->json($teams);
    }

    public function getTeams(): JsonResponse
    {
        return response()->json(IcsTeam::distinct()->pluck('team'));
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request): JsonResponse
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
    public function show(string $id): JsonResponse
    {
        $icsTeam = IcsTeam::findOrFail($id);

        return response()->json($icsTeam);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id): JsonResponse
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
