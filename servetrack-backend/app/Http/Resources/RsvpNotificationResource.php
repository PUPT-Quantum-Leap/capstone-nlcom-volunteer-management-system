<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RsvpNotificationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->notification_id,
            'type' => $this->type,
            'message' => $this->message,
            'rsvpId' => $this->rsvp_id,
            'rsvpTitle' => $this->whenLoaded('rsvp', fn () => $this->rsvp->title),
            'rsvpDate' => $this->whenLoaded('rsvp', fn () => $this->rsvp->date?->format('M d, Y')),
            'rsvpSlug' => $this->whenLoaded('rsvp', fn () => $this->rsvp->slug),
            'readAt' => $this->read_at?->toIso8601String(),
            'isRead' => $this->read_at !== null,
            'emailSent' => $this->email_sent,
            'createdAt' => $this->created_at?->toIso8601String(),
        ];
    }
}
