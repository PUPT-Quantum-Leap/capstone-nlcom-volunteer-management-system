<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RsvpResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $volunteerId = $request->user()?->volunteer?->volunteer_id;

        return [
            'id' => $this->rsvp_id,
            'slug' => $this->slug,
            'title' => $this->title,
            'description' => $this->description,
            'date' => $this->date?->format('M d'),
            'eventLocation' => $this->event_location,
            'cutOffDay' => $this->cutoff_day?->format('M d, Y'),
            'cutOffTime' => $this->cutoff_time ? date('g:i A', strtotime($this->cutoff_time)) : null,
            'status' => $this->status,
            'shareUrl' => route('rsvp.show', ['identifier' => $this->slug]),
            'totalResponses' => $this->responses_count ?? 0,
            'createdAt' => $this->created_at?->toDateString(),
            'shifts' => $this->whenLoaded('shifts', function () {
                return $this->shifts->map(function ($shift) {
                    $responseCount = 0;
                    if ($this->relationLoaded('responses')) {
                        $responseCount = $this->responses
                            ->where('time_slot_id', $shift->time_slot_id)
                            ->count();
                    }

                    return [
                        'id' => $shift->time_slot_id,
                        'text' => $shift->text ?? 'Unknown Time Slot',
                        'timeSlot' => $shift->pivot?->time_slot ?? 'Unknown Time Slot',
                        'capacity' => $shift->pivot?->capacity ?? 0,
                        'responses' => $responseCount,
                    ];
                });
            }),
            'userVote' => $volunteerId ? $this->getUserVote($volunteerId) : null,
            'canEditVote' => $volunteerId ? $this->canUserEditVote($volunteerId) : false,
            'remainingEdits' => $volunteerId ? $this->getRemainingEdits($volunteerId) : 0,
        ];
    }

    private function getUserVote(int $volunteerId): ?array
    {
        $response = $this->responses()
            ->where('volunteer_id', $volunteerId)
            ->first();

        if (! $response) {
            return null;
        }

        return [
            'timeSlotId' => $response->time_slot_id,
            'votedAt' => $response->voted_at?->toIso8601String(),
            'editCount' => $response->edit_count,
            'remainingEdits' => 3 - $response->edit_count,
        ];
    }

    private function canUserEditVote(int $volunteerId): bool
    {
        $response = $this->responses()
            ->where('volunteer_id', $volunteerId)
            ->first();

        if (! $response) {
            return false;
        }

        if ($this->status !== 'active') {
            return false;
        }

        if ($this->isCutoffPassed()) {
            return false;
        }

        return $response->edit_count < 3;
    }

    private function getRemainingEdits(int $volunteerId): int
    {
        $response = $this->responses()
            ->where('volunteer_id', $volunteerId)
            ->first();

        return $response ? (3 - $response->edit_count) : 0;
    }
}
