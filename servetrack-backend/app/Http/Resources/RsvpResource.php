<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RsvpResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->rsvp_id,
            'title' => $this->title,
            'description' => $this->description,
            'date' => $this->date?->format('M d'),
            'eventLocation' => $this->event_location,
            'cutOffDay' => $this->cutoff_day?->format('M d, Y'),
            'cutOffTime' => $this->cutoff_time ? date('g:i A', strtotime($this->cutoff_time)) : null,
            'status' => $this->status,
            'shareUrl' => $this->share_url,
            'totalResponses' => $this->responses_count ?? 0,
            'createdAt' => $this->created_at?->toDateString(),
            'shifts' => $this->whenLoaded('shifts', function () {
                return $this->shifts->map(function ($shift) {
                    // Count responses for this shift from the loaded responses relationship
                    $responseCount = 0;
                    if ($this->relationLoaded('responses')) {
                        $responseCount = $this->responses
                            ->where('time_slot_id', $shift->time_slot_id)
                            ->count();
                    }

                    return [
                        'id' => $shift->time_slot_id,
                        'text' => $shift->text,
                        'timeSlot' => $shift->pivot->time_slot,
                        'capacity' => $shift->pivot->capacity,
                        'responses' => $responseCount,
                    ];
                });
            }),
        ];
    }
}
