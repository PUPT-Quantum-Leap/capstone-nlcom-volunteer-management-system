<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class IcsResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'rsvp_id' => $this->rsvp_id,
            'rsvp' => $this->whenLoaded('rsvp', fn () => [
                'id' => $this->rsvp->rsvp_id,
                'title' => $this->rsvp->title,
                'date' => $this->rsvp->date,
            ]),
            'name' => $this->name,
            'description' => $this->description,
            'date' => $this->date,
            'location' => $this->location,
            'status' => $this->status,
            'ai_suggestions' => $this->ai_suggestions,
            'teams' => $this->whenLoaded('teams', fn () => $this->teams->map(fn ($team) => [
                'id' => $team->id,
                'name' => $team->name,
            ])),
            'volunteers' => $this->whenLoaded('volunteers', fn () => $this->volunteers->map(fn ($volunteer) => [
                'id' => $volunteer->volunteer_id,
                'name' => $volunteer->first_name.' '.$volunteer->last_name,
                'team_id' => $volunteer->pivot->team_id,
                'role' => $volunteer->pivot->role,
                'assigned_at' => $volunteer->pivot->assigned_at,
                'skills' => $volunteer->skills->pluck('name'),
            ])),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
