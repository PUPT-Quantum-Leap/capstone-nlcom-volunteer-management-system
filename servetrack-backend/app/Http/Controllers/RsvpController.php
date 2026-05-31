<?php

namespace App\Http\Controllers;

use App\Enums\AuditAction;
use App\Http\Requests\StoreRsvpRequest;
use App\Http\Requests\UpdateRsvpRequest;
use App\Http\Requests\UpdateRsvpResponseRequest;
use App\Http\Resources\RsvpResource;
use App\Jobs\NotifyVolunteersOfNewRsvp;
use App\Models\Rsvp;
use App\Models\RsvpResponse;
use App\Models\TimeSlot;
use App\Services\AuditLogger;
use App\Services\SmsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class RsvpController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection|RsvpResource|JsonResponse
    {
        // If 'id' query parameter is provided, fetch a single RSVP
        $id = $request->query('id');
        if ($id) {
            $rsvp = Rsvp::query()
                ->with(['shifts', 'responses', 'location'])
                ->withCount('responses')
                ->where(fn ($query) => is_numeric($id) ? $query->where('rsvp_id', $id) : $query->where('slug', $id))
                ->first();

            if (! $rsvp) {
                return response()->json(['message' => 'RSVP not found.'], 404);
            }

            return new RsvpResource($rsvp);
        }

        $query = Rsvp::query()
            ->with(['shifts', 'responses', 'location'])
            ->withCount('responses');

        if ($request->user()->role !== 'admin') {
            // Volunteers see: all active RSVPs + all closed RSVPs
            $query->whereIn('status', ['active', 'closed']);
        }

        $perPage = $request->integer('per_page', 15);
        $rsvps = $query->latest()->paginate($perPage);

        return RsvpResource::collection($rsvps);
    }

    public function show(Request $request, ?string $identifier = null): RsvpResource|JsonResponse
    {
        // Support: GET /api/rsvp/{slug}, GET /api/rsvp/{id}, GET /api/rsvp?id=123
        $id = $identifier ?? $request->query('id');

        if (! $id) {
            return response()->json(['message' => 'RSVP not found.'], 404);
        }

        $rsvp = Rsvp::query()
            ->with(['shifts', 'responses', 'location'])
            ->withCount('responses')
            ->where(fn ($query) => is_numeric($id) ? $query->where('rsvp_id', $id) : $query->where('slug', $id))
            ->first();

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
                'slug' => Rsvp::generateUniqueSlug($request->input('title')),
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

        // Dispatch notifications if RSVP is created as active
        if ($rsvp->status === 'active') {
            NotifyVolunteersOfNewRsvp::dispatch($rsvp);
        }

        AuditLogger::success(AuditAction::RSVP_CREATED, [
            'resource_type' => 'rsvp',
            'resource_id' => $rsvp->rsvp_id,
            'resource_label' => $rsvp->title,
        ]);

        return (new RsvpResource($rsvp))
            ->response()
            ->setStatusCode(201);
    }

    public function update(UpdateRsvpRequest $request, int $id): RsvpResource|JsonResponse
    {
        $rsvp = Rsvp::query()->withTrashed()->with('shifts')->find($id);

        if (! $rsvp) {
            return response()->json(['message' => 'RSVP not found.'], 404);
        }

        if ($rsvp->trashed()) {
            return response()->json(['message' => 'RSVP is in trash.'], 409);
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

        AuditLogger::success(AuditAction::RSVP_UPDATED, [
            'resource_type' => 'rsvp',
            'resource_id' => $rsvp->rsvp_id,
            'resource_label' => $rsvp->title,
        ]);

        return new RsvpResource($rsvp->fresh('shifts'));
    }

    public function destroy(int $id): JsonResponse
    {
        $rsvp = Rsvp::query()->withTrashed()->find($id);

        if (! $rsvp) {
            return response()->json(['message' => 'RSVP not found.'], 404);
        }

        if ($rsvp->trashed()) {
            return response()->json(['message' => 'RSVP is already in trash.'], 409);
        }

        $rsvp->delete();

        AuditLogger::success(AuditAction::RSVP_DELETED, [
            'resource_type' => 'rsvp',
            'resource_id' => $id,
            'resource_label' => $rsvp->title,
        ]);

        return response()->json(['message' => 'RSVP deleted successfully.']);
    }

    /**
     * Get trashed (soft-deleted) RSVPs for admin audit.
     */
    public function trashed(Request $request): AnonymousResourceCollection|JsonResponse
    {
        $rsvps = Rsvp::query()
            ->onlyTrashed()
            ->with(['shifts', 'responses'])
            ->withCount('responses')
            ->latest('deleted_at')
            ->paginate(15);

        return RsvpResource::collection($rsvps);
    }

    /**
     * Restore a soft-deleted RSVP.
     */
    public function restore(int $id): JsonResponse
    {
        $rsvp = Rsvp::withTrashed()->find($id);

        if (! $rsvp) {
            return response()->json(['message' => 'RSVP not found.'], 404);
        }

        if (! $rsvp->trashed()) {
            return response()->json(['message' => 'RSVP is not in trash.'], 409);
        }

        $rsvp->restore();

        return response()->json(['message' => 'RSVP restored successfully.']);
    }

    /**
     * Permanently delete a soft-deleted RSVP.
     */
    public function forceDelete(int $id): JsonResponse
    {
        $rsvp = Rsvp::withTrashed()->find($id);

        if (! $rsvp) {
            return response()->json(['message' => 'RSVP not found.'], 404);
        }

        if (! $rsvp->trashed()) {
            return response()->json(['message' => 'RSVP is not in trash.'], 409);
        }

        $rsvp->forceDelete();

        return response()->json(['message' => 'RSVP permanently deleted.']);
    }

    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'status' => ['required', 'in:draft,active,closed'],
        ]);

        $rsvp = Rsvp::query()->withTrashed()->find($id);
        if (! $rsvp) {
            return response()->json(['message' => 'RSVP not found.'], 404);
        }

        if ($rsvp->trashed()) {
            return response()->json(['message' => 'RSVP is in trash.'], 409);
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

        $previousStatus = $rsvp->status;
        $rsvp->update(['status' => $newStatus]);
        $rsvp->refresh();

        // Dispatch notifications if transitioning to active for the first time
        if ($newStatus === 'active' && $previousStatus !== 'active') {
            NotifyVolunteersOfNewRsvp::dispatch($rsvp);
        }

        if ($newStatus === 'closed') {
            AuditLogger::success(AuditAction::RSVP_CLOSED, [
                'resource_type' => 'rsvp',
                'resource_id' => $rsvp->rsvp_id,
                'resource_label' => $rsvp->title,
                'description' => "RSVP closed: {$rsvp->title}",
            ]);
        }

        return response()->json(['message' => 'RSVP status updated.', 'status' => $rsvp->status]);
    }

    public function vote(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'time_slot_id' => ['required', 'integer'],
        ]);

        $rsvp = Rsvp::query()->withTrashed()->with('shifts')->find($id);

        if (! $rsvp) {
            return response()->json(['message' => 'RSVP not found.'], 404);
        }

        if ($rsvp->trashed()) {
            return response()->json(['message' => 'This RSVP is no longer available.'], 409);
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
            $lockedRsvp = Rsvp::query()->withTrashed()->find($id);

            if (! $lockedRsvp) {
                $invalidShift = true;

                return;
            }

            if ($lockedRsvp->trashed()) {
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
                'edit_count' => 0,
                'initial_time_slot_id' => $shift->time_slot_id,
                'edit_history' => [],
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

        AuditLogger::success(AuditAction::ATTENDANCE_CHECKED_IN, [
            'resource_type' => 'rsvp_response',
            'resource_id' => $response->rsvp_response_id,
            'resource_label' => 'RSVP #'.$id,
            'description' => 'Volunteer #'.$request->volunteer_id.' checked in to RSVP #'.$id,
        ]);

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

        AuditLogger::success(AuditAction::ATTENDANCE_CHECKED_OUT, [
            'resource_type' => 'rsvp_response',
            'resource_id' => $response->rsvp_response_id,
            'resource_label' => 'RSVP #'.$id,
            'description' => 'Volunteer #'.$request->volunteer_id.' checked out of RSVP #'.$id,
        ]);

        return response()->json(['success' => true, 'response' => $response]);
    }

    public function attendance(int $id): JsonResponse
    {
        $rsvp = Rsvp::query()->withTrashed()->find($id);

        if (! $rsvp) {
            return response()->json(['message' => 'RSVP not found.'], 404);
        }

        if ($rsvp->trashed()) {
            return response()->json(['message' => 'RSVP is in trash.'], 409);
        }

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

    /**
     * Get current volunteer's response for a specific RSVP.
     */
    public function getMyResponse(Request $request, int $rsvpId): JsonResponse
    {
        $rsvp = Rsvp::query()->withTrashed()->find($rsvpId);

        if (! $rsvp) {
            return response()->json(['message' => 'RSVP not found.'], 404);
        }

        if ($rsvp->trashed()) {
            return response()->json(['message' => 'RSVP is in trash.'], 409);
        }

        $volunteer = $request->user()->volunteer;

        if (! $volunteer) {
            return response()->json(['message' => 'Volunteer profile not found.'], 403);
        }

        $response = RsvpResponse::query()
            ->where('volunteer_id', $volunteer->volunteer_id)
            ->where('rsvp_id', $rsvpId)
            ->first();

        if (! $response) {
            return response()->json(['message' => 'You have not responded to this RSVP.'], 404);
        }

        return response()->json([
            'data' => [
                'id' => $response->response_id,
                'volunteerId' => $response->volunteer_id,
                'rsvpId' => $response->rsvp_id,
                'timeSlotId' => $response->time_slot_id,
                'votedAt' => $response->voted_at,
                'createdAt' => $response->created_at,
                'editCount' => $response->edit_count,
                'remainingEdits' => $response->getRemainingEdits(),
                'lastEditedAt' => $response->last_edited_at,
                'editHistory' => $response->edit_history ?? [],
            ],
        ]);
    }

    /**
     * Update an existing RSVP response (volunteer edits their response).
     */
    public function updateResponse(UpdateRsvpResponseRequest $request, int $rsvpId): JsonResponse
    {
        $rsvp = Rsvp::query()->withTrashed()->find($rsvpId);

        if (! $rsvp) {
            return response()->json(['message' => 'RSVP not found.'], 404);
        }

        if ($rsvp->trashed()) {
            return response()->json(['message' => 'RSVP is in trash.'], 409);
        }

        $volunteer = $request->user()->volunteer;

        if (! $volunteer) {
            return response()->json(['message' => 'Volunteer profile not found.'], 403);
        }

        $response = RsvpResponse::query()
            ->where('volunteer_id', $volunteer->volunteer_id)
            ->where('rsvp_id', $rsvpId)
            ->first();

        if (! $response) {
            return response()->json(['message' => 'You have not responded to this RSVP.'], 404);
        }

        // Check if editing is allowed
        if (! $response->canEdit()) {
            if ($rsvp->status !== 'active') {
                return response()->json(['message' => 'This RSVP is no longer accepting responses.'], 422);
            }

            if ($rsvp->isCutoffPassed()) {
                return response()->json(['message' => 'The cutoff time for this RSVP has passed.'], 422);
            }
        }

        $newTimeSlotId = $request->integer('time_slot_id');
        $oldTimeSlotId = $response->time_slot_id;

        // Cannot edit to the same slot
        if ($newTimeSlotId === $oldTimeSlotId) {
            return response()->json(['message' => 'Please select a different time slot.'], 422);
        }

        // Verify new slot exists in this RSVP
        $newSlot = $rsvp->shifts()
            ->where('time_slot.time_slot_id', $newTimeSlotId)
            ->first();

        if (! $newSlot) {
            return response()->json(['message' => 'Invalid time slot for this RSVP.'], 422);
        }

        // Check capacity on new slot
        $capacityUsed = RsvpResponse::query()
            ->where('rsvp_id', $rsvpId)
            ->where('time_slot_id', $newTimeSlotId)
            ->count();

        if ($capacityUsed >= $newSlot->pivot->capacity) {
            return response()->json(['message' => 'This time slot is already at full capacity.'], 422);
        }

        // Update in transaction
        DB::transaction(function () use ($response, $newTimeSlotId, $oldTimeSlotId) {
            $response->recordEdit($oldTimeSlotId, $newTimeSlotId);
            $response->time_slot_id = $newTimeSlotId;
            $response->save();
        });

        return response()->json([
            'message' => 'Response updated successfully.',
            'remaining_edits' => $response->getRemainingEdits(),
        ]);
    }

    /**
     * Get RSVP notifications for authenticated volunteer.
     */
    public function getNotifications(Request $request): AnonymousResourceCollection
    {
        $volunteer = $request->user()->volunteer;

        if (! $volunteer) {
            abort(403, 'Volunteer profile not found.');
        }

        $notifications = \App\Models\RsvpNotification::query()
            ->where('volunteer_id', $volunteer->volunteer_id)
            ->latest('created_at')
            ->paginate(20);

        return \App\Http\Resources\RsvpNotificationResource::collection($notifications);
    }

    /**
     * Mark a notification as read.
     */
    public function markNotificationAsRead(Request $request, int $notificationId): JsonResponse
    {
        $volunteer = $request->user()->volunteer;

        if (! $volunteer) {
            return response()->json(['message' => 'Volunteer profile not found.'], 403);
        }

        $notification = \App\Models\RsvpNotification::query()->find($notificationId);

        if (! $notification) {
            return response()->json(['message' => 'Notification not found.'], 404);
        }

        if ($notification->volunteer_id !== $volunteer->volunteer_id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $notification->markAsRead();

        return response()->json(['message' => 'Notification marked as read.']);
    }

    /**
     * Mark all RSVP notifications as read for authenticated volunteer.
     */
    public function markAllNotificationsAsRead(Request $request): JsonResponse
    {
        $volunteer = $request->user()->volunteer;

        if (! $volunteer) {
            return response()->json(['message' => 'Volunteer profile not found.'], 403);
        }

        \App\Models\RsvpNotification::query()
            ->where('volunteer_id', $volunteer->volunteer_id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json(['message' => 'All notifications marked as read.']);
    }
}
