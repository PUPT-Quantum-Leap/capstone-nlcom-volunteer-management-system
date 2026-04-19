<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreRsvpRequest;
use App\Http\Requests\UpdateRsvpRequest;
use App\Http\Resources\RsvpResource;
use App\Models\Rsvp;
use App\Models\RsvpResponse;
use App\Models\TimeSlot;
use App\Services\FacebookService;
use App\Services\SmsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class RsvpController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Rsvp::query()
            ->with(['shifts', 'responses'])
            ->withCount('responses');

        if ($request->user()->role !== 'admin') {
            $query->where('status', 'active');
        }

        $rsvps = $query->latest()->paginate(15);

        return RsvpResource::collection($rsvps);
    }

    public function show(int $id): RsvpResource|JsonResponse
    {
        $rsvp = Rsvp::query()
            ->with(['shifts', 'responses'])
            ->withCount('responses')
            ->find($id);

        if (! $rsvp) {
            return response()->json(['message' => 'RSVP not found.'], 404);
        }

        return new RsvpResource($rsvp);
    }

    public function store(StoreRsvpRequest $request): JsonResponse
    {
        $rsvp = DB::transaction(function () use ($request): Rsvp {
            $rsvp = Rsvp::query()->create([
                'title' => $request->input('title'),
                'description' => $request->input('description'),
                'date' => $request->input('date'),
                'event_location' => $request->input('event_location'),
                'cutoff_day' => $request->input('cutoff_day'),
                'cutoff_time' => $request->input('cutoff_time'),
                'status' => $request->input('status', 'draft'),
                'share_url' => $request->input('share_url'),
            ]);

            foreach ($request->input('shifts') as $shiftData) {
                $timeSlot = TimeSlot::query()->firstOrCreate(['text' => $shiftData['text']]);

                $rsvp->shifts()->attach($timeSlot->time_slot_id, [
                    'time_slot' => $shiftData['time_slot'],
                    'capacity' => $shiftData['capacity'],
                ]);
            }

            return $rsvp->load('shifts');
        });

        return (new RsvpResource($rsvp))
            ->response()
            ->setStatusCode(201);
    }

    public function update(UpdateRsvpRequest $request, int $id): RsvpResource|JsonResponse
    {
        $rsvp = Rsvp::query()->with('shifts')->find($id);

        if (! $rsvp) {
            return response()->json(['message' => 'RSVP not found.'], 404);
        }

        DB::transaction(function () use ($request, $rsvp): void {
            $rsvp->update(array_filter([
                'title' => $request->input('title'),
                'description' => $request->input('description'),
                'date' => $request->input('date'),
                'event_location' => $request->input('event_location'),
                'cutoff_day' => $request->input('cutoff_day'),
                'cutoff_time' => $request->input('cutoff_time'),
                'status' => $request->input('status'),
                'share_url' => $request->input('share_url'),
            ], fn ($value) => $value !== null));

            if ($request->has('shifts')) {
                $syncPayload = [];

                foreach ($request->input('shifts') as $shiftData) {
                    $shiftText = Arr::get($shiftData, 'text') ?? Arr::get($shiftData, 'time_slot');
                    $timeSlot = TimeSlot::query()->firstOrCreate(['text' => $shiftText]);
                    $syncPayload[$timeSlot->time_slot_id] = [
                        'time_slot' => $shiftData['time_slot'],
                        'capacity' => $shiftData['capacity'],
                    ];
                }

                foreach ($rsvp->shifts as $shift) {
                    $hasResponses = RsvpResponse::query()
                        ->where('rsvp_id', $rsvp->rsvp_id)
                        ->where('time_slot_id', $shift->time_slot_id)
                        ->exists();

                    if ($hasResponses && ! array_key_exists($shift->time_slot_id, $syncPayload)) {
                        $syncPayload[$shift->time_slot_id] = [
                            'time_slot' => $shift->pivot->time_slot,
                            'capacity' => $shift->pivot->capacity,
                        ];
                    }
                }

                $rsvp->shifts()->sync($syncPayload);
            }
        });

        return new RsvpResource($rsvp->fresh('shifts'));
    }

    public function destroy(int $id): JsonResponse
    {
        $rsvp = Rsvp::query()->find($id);

        if (! $rsvp) {
            return response()->json(['message' => 'RSVP not found.'], 404);
        }

        $rsvp->delete();

        return response()->json(['message' => 'RSVP deleted successfully.']);
    }

    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'status' => ['required', 'in:draft,active,closed'],
        ]);

        $rsvp = Rsvp::query()->find($id);
        if (! $rsvp) {
            return response()->json(['message' => 'RSVP not found.'], 404);
        }

        $newStatus = $request->input('status');

        // Check if transition is valid
        if (! $rsvp->canTransitionTo($newStatus)) {
            $message = match ($rsvp->status) {
                'closed' => 'Cannot transition from closed status.',
                'active' => $newStatus === 'draft' ? 'Cannot transition from active back to draft.' : 'Cannot close an active RSVP with responses.',
                default => "Invalid status transition from {$rsvp->status} to {$newStatus}."
            };

            return response()->json(['message' => $message], 422);
        }

        $rsvp->update(['status' => $newStatus]);
        $rsvp->refresh();

        return response()->json(['message' => 'RSVP status updated.', 'status' => $rsvp->status]);
    }

    public function vote(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'time_slot_id' => ['required', 'integer'],
        ]);

        $rsvp = Rsvp::query()->with('shifts')->find($id);

        if (! $rsvp) {
            return response()->json(['message' => 'RSVP not found.'], 404);
        }

        if ($rsvp->status !== 'active') {
            return response()->json(['message' => 'This RSVP is not accepting responses.'], 422);
        }

        if ($rsvp->isCutoffPassed()) {
            return response()->json(['message' => 'This RSVP has closed and is no longer accepting responses.'], 422);
        }

        $volunteer = $request->user()->volunteer;

        if (! $volunteer) {
            return response()->json(['message' => 'Volunteer profile not found.'], 403);
        }

        $capacityReached = false;
        $invalidShift = false;
        $alreadyResponded = false;

        DB::transaction(function () use ($id, $request, $volunteer, &$capacityReached, &$invalidShift, &$alreadyResponded): void {
            $lockedRsvp = Rsvp::query()->find($id);

            if (! $lockedRsvp) {
                $invalidShift = true;

                return;
            }

            $existingResponse = RsvpResponse::query()
                ->where('volunteer_id', $volunteer->volunteer_id)
                ->where('rsvp_id', $lockedRsvp->rsvp_id)
                ->lockForUpdate()
                ->first();

            if ($existingResponse) {
                $alreadyResponded = true;

                return;
            }

            $shift = $lockedRsvp->shifts()
                ->where('time_slot.time_slot_id', $request->integer('time_slot_id'))
                ->lockForUpdate()
                ->first();

            if (! $shift) {
                $invalidShift = true;

                return;
            }

            $currentResponses = RsvpResponse::query()
                ->where('rsvp_id', $lockedRsvp->rsvp_id)
                ->where('time_slot_id', $shift->time_slot_id)
                ->lockForUpdate()
                ->count();

            if ($currentResponses >= $shift->pivot->capacity) {
                $capacityReached = true;

                return;
            }

            RsvpResponse::query()->create([
                'volunteer_id' => $volunteer->volunteer_id,
                'rsvp_id' => $lockedRsvp->rsvp_id,
                'time_slot_id' => $shift->time_slot_id,
                'voted_at' => now(),
                'sms_sent' => false,
                'attendance_status' => 'registered',
            ]);
        });

        if ($alreadyResponded) {
            return response()->json(['message' => 'You have already responded to this RSVP.'], 422);
        }

        if ($invalidShift) {
            return response()->json(['message' => 'Invalid shift for this RSVP.'], 422);
        }

        if ($capacityReached) {
            return response()->json(['message' => 'This time slot is already at full capacity.'], 422);
        }

        return response()->json(['message' => 'RSVP recorded successfully.']);
    }

    public function checkIn(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'volunteer_id' => ['required', 'exists:volunteer,volunteer_id'],
        ]);

        // Authorization: ensure user can only check in themselves
        $volunteer = $request->user()->volunteer;
        if (! $volunteer || $volunteer->volunteer_id != $request->volunteer_id) {
            return response()->json(['message' => 'Unauthorized: You can only check in yourself.'], 403);
        }

        $response = RsvpResponse::where('rsvp_id', $id)
            ->where('volunteer_id', $request->volunteer_id)
            ->first();

        if (! $response) {
            return response()->json(['message' => 'RSVP response not found.'], 404);
        }

        $response->checkIn();

        return response()->json(['success' => true, 'response' => $response]);
    }

    public function checkOut(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'volunteer_id' => ['required', 'exists:volunteer,volunteer_id'],
        ]);

        // Authorization: ensure user can only check out themselves
        $volunteer = $request->user()->volunteer;
        if (! $volunteer || $volunteer->volunteer_id != $request->volunteer_id) {
            return response()->json(['message' => 'Unauthorized: You can only check out yourself.'], 403);
        }

        $response = RsvpResponse::where('rsvp_id', $id)
            ->where('volunteer_id', $request->volunteer_id)
            ->first();

        if (! $response) {
            return response()->json(['message' => 'RSVP response not found.'], 404);
        }

        $response->checkOut();

        return response()->json(['success' => true, 'response' => $response]);
    }

    public function attendance(int $id): JsonResponse
    {
        Rsvp::query()->findOrFail($id);

        $responses = RsvpResponse::where('rsvp_id', $id)->paginate(50);

        return response()->json([
            'total' => $responses->total(),
            'checked_in' => $responses->where('attendance_status', 'checked_in')->count(),
            'checked_out' => $responses->where('attendance_status', 'checked_out')->count(),
            'no_show' => $responses->where('attendance_status', 'no_show')->count(),
            'registered' => $responses->where('attendance_status', 'registered')->count(),
            'data' => $responses->items(),
            'pagination' => [
                'current_page' => $responses->currentPage(),
                'last_page' => $responses->lastPage(),
                'per_page' => $responses->perPage(),
                'total' => $responses->total(),
            ],
        ]);
    }

    public function notifyFacebook(int $id): JsonResponse
    {
        $rsvp = Rsvp::query()->find($id);

        if (! $rsvp) {
            return response()->json(['message' => 'RSVP not found.'], 404);
        }

        $facebook = app(FacebookService::class);
        $result = $facebook->broadcastRsvpNotification($rsvp);

        return response()->json([
            'success' => true,
            'message' => "Facebook notifications sent: {$result['sent']}/{$result['total']}",
            'total' => $result['total'],
            'sent' => $result['sent'],
            'failed' => $result['failed'],
        ]);
    }

    public function notifySms(int $id): JsonResponse
    {
        $rsvp = Rsvp::query()->find($id);

        if (! $rsvp) {
            return response()->json(['message' => 'RSVP not found.'], 404);
        }

        $smsService = app(SmsService::class);

        if (! $smsService->isConfigured()) {
            return response()->json(['message' => 'SMS service is not configured.'], 500);
        }

        $result = $smsService->broadcastRsvpNotification($rsvp);

        return response()->json([
            'success' => true,
            'message' => "SMS notifications sent: {$result['sent']}/{$result['total']}",
            'total' => $result['total'],
            'sent' => $result['sent'],
            'failed' => $result['failed'],
        ]);
    }
}
