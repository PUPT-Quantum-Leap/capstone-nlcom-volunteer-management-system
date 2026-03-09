<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PollResource extends JsonResource
{
    /**
     * Transform the resource into an array matching the frontend Poll interface.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->poll_id,
            'title' => $this->title,
            'description' => $this->description,
            'date' => $this->date?->format('M d'),
            'cutOffDay' => $this->cutoff_day,
            'cutOffTime' => $this->cutoff_time,
            'status' => $this->status,
            'shareUrl' => $this->share_url,
            'totalVotes' => $this->votes()->count(),
            'createdAt' => $this->created_at?->toDateString(),
            'options' => $this->whenLoaded('options', function () {
                return $this->options->map(function ($option) {
                    $voteCount = $this->votes()
                        ->where('option_id', $option->option_id)
                        ->count();

                    return [
                        'id' => $option->option_id,
                        'timeSlot' => $option->pivot->time_slot,
                        'capacity' => $option->pivot->capacity,
                        'votes' => $voteCount,
                    ];
                });
            }),
        ];
    }
}
