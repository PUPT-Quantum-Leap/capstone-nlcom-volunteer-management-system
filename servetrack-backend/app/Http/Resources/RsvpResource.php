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
                $responseCounts = [];

                if ($this->relationLoaded('responses')) {
                    $grouped = $this->responses->groupBy('time_slot_id');
                    foreach ($grouped as $timeSlotId => $responses) {
                        $responseCounts[$timeSlotId] = $responses->count();
                    }
                }

                return $this->shifts->map(function ($shift) use ($responseCounts) {
                    return [
                        'id' => $shift->time_slot_id,
                        'text' => $shift->text,
                        'timeSlot' => $shift->pivot->time_slot,
                        'capacity' => $shift->pivot->capacity,
                        'responses' => $responseCounts[$shift->time_slot_id] ?? 0,
                    ];
                });
            }),
        ];
    }
}
