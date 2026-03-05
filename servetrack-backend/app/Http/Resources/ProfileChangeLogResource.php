<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProfileChangeLogResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'volunteer_id' => $this->volunteer_id,
            'field_name' => $this->field_name,
            'old_value' => $this->old_value,
            'new_value' => $this->new_value,
            'ip_address' => $this->ip_address,
            'changed_by' => $this->whenLoaded('changedByUser', fn () => [
                'id' => $this->changedByUser->id,
                'name' => $this->changedByUser->name,
                'email' => $this->changedByUser->email,
            ]),
            'created_at' => $this->created_at?->format('Y-m-d H:i:s'),
            'updated_at' => $this->updated_at?->format('Y-m-d H:i:s'),
        ];
    }
}
