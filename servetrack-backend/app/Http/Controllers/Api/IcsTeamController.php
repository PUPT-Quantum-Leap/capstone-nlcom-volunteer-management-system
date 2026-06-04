<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreIcsTeamRequest;
use App\Http\Requests\UpdateIcsTeamRequest;
use App\Models\Ics;
use App\Models\IcsTeam;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class IcsTeamController extends Controller
{
    /**
     * Display distribution teams (Alpha→Foxtrot) for the specified ICS,
     * grouped by parent team with auto-filled location, time, pax, and assigned volunteers.
     */
    public function index(Request $request): JsonResponse
    {
        $rsvpId = $request->query('rsvp_id');

        if ($rsvpId) {
            $ics = Ics::query()->with('rsvp')->where('rsvp_id', $rsvpId)->first();
        } else {
            $ics = Ics::query()->with('rsvp')->latest()->first();
        }

        if (! $ics) {
            return response()->json([]);
        }

        $teams = IcsTeam::with('ics.rsvp')
            ->where('ics_id', $ics->id)
            ->whereIn('branch_key', ['am_distribution', 'pm_distribution'])
            ->orderByRaw("FIELD(team_key, 'alpha', 'bravo', 'charlie_1', 'charlie_2', 'delta_1', 'delta_2', 'echo', 'foxtrot')")
            ->get();

        if ($teams->isEmpty()) {
            return response()->json([]);
        }

        $rsvp = $ics->rsvp;
        $shifts = $rsvp ? $rsvp->shifts()->orderBy('time_slot.time_slot_id', 'asc')->get() : collect();
        $totalRows = $teams->count();

        $teams->each(function ($icsTeam) use ($ics, $rsvp, $shifts, $totalRows) {
            if ($icsTeam->team_id && $icsTeam->ics_id) {
                $volunteers = $icsTeam->volunteers()->get();

                $icsTeam->setAttribute('assigned_volunteers', $volunteers->map(fn ($v) => [
                    'id' => $v->volunteer_id,
                    'name' => trim($v->first_name.' '.$v->last_name),
                    'role' => $v->pivot->role,
                    'is_driver' => (bool) $v->pivot->is_driver,
                    'is_leader' => (bool) $v->pivot->is_leader,
                ])->values());
            } else {
                $icsTeam->setAttribute('assigned_volunteers', []);
            }

            if ($icsTeam->location === null && $rsvp) {
                $icsTeam->setAttribute('location', $rsvp->event_location ?? '');
            }

            if ($icsTeam->time === null && $shifts->isNotEmpty()) {
                $isAm = $icsTeam->branch_key === 'am_distribution';
                $shift = $isAm ? $shifts->first() : $shifts->last();
                $icsTeam->setAttribute('time', $shift->text ?? '');
            }

            if (($icsTeam->no_of_pax === 0 || $icsTeam->no_of_pax === null) && $ics->objective && $totalRows > 0) {
                $icsTeam->setAttribute('no_of_pax', (int) round($ics->objective / $totalRows));
            }

            $teamName = $icsTeam->team ?? '';
            $parentTeam = trim(preg_replace('/\s*\d+$/', '', $teamName));
            $icsTeam->setAttribute('parent_team', 'Team '.$parentTeam);
        });

        return response()->json($teams);
    }

    /**
     * Return a distinct list of all team names across all ICS records.
     */
    public function getTeams(): JsonResponse
    {
        return response()->json(IcsTeam::distinct()->pluck('team'));
    }

    /**
     * Store a newly created ICS team.
     */
    public function store(StoreIcsTeamRequest $request): JsonResponse
    {
        $validated = $request->validated();

        if (! isset($validated['ics_id'])) {
            $validated['ics_id'] = IcsTeam::query()
                ->whereNotNull('ics_id')
                ->value('ics_id');
        }

        $icsTeam = IcsTeam::create($validated);

        return response()->json($icsTeam, 201);
    }

    /**
     * Display the specified ICS team.
     */
    public function show(string $id): JsonResponse
    {
        $icsTeam = IcsTeam::findOrFail($id);

        return response()->json($icsTeam);
    }

    /**
     * Update the specified ICS team.
     */
    public function update(UpdateIcsTeamRequest $request, string $id): JsonResponse
    {
        $icsTeam = IcsTeam::findOrFail($id);

        $validated = $request->validated();

        $icsTeam->update($validated);

        return response()->json($icsTeam);
    }
}
