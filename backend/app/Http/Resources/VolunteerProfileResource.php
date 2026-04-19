<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

class VolunteerProfileResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'volunteer_id' => $this->volunteer_id,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'full_name' => $this->first_name.' '.$this->last_name,
            'facebook_name' => $this->facebook_name,
            'email' => $this->email,
            'mobile_number' => $this->mobile_number,
            'birthdate' => $this->birthdate?->format('Y-m-d'),
            'address' => $this->address,
            'educational_attainment' => $this->educational_attainment,
            'last_medical_examination' => $this->last_medical_examination?->format('Y-m-d'),
            'profile_photo_url' => $this->profile_photo
                ? Storage::disk('public')->url($this->profile_photo)
                : null,
            'skills' => $this->whenLoaded('skills', fn () => $this->skills->pluck('name')),
            'trainings' => $this->whenLoaded('trainings', fn () => $this->trainings->pluck('name')),
            'positions' => $this->whenLoaded('positions', fn () => $this->positions->pluck('name')),
            'experiences' => $this->whenLoaded('experiences', fn () => $this->experiences->pluck('name')),
            'availabilities' => $this->whenLoaded('availabilities', function () {
                return $this->availabilities->map(function ($availability) {
                    return [
                        'name' => $availability->name,
                        'custom_description' => $availability->pivot->custom_description,
                    ];
                });
            }),
            'lifegroups' => $this->whenLoaded('lifegroups', function () {
                return $this->lifegroups->map(function ($lifegroup) {
                    return [
                        'name' => $lifegroup->name,
                        'is_leader' => (bool) $lifegroup->pivot->is_leader,
                    ];
                });
            }),
            'emergency_contact' => $this->whenLoaded('emergencyContact', fn () => [
                'name' => $this->emergencyContact->name,
                'phone_number' => $this->emergencyContact->phone_number,
                'relationship' => $this->emergencyContact->relationship,
            ]),
            'created_at' => $this->created_at?->format('Y-m-d H:i:s'),
            'updated_at' => $this->updated_at?->format('Y-m-d H:i:s'),
        ];
    }
}
