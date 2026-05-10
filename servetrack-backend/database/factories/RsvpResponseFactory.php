<?php

namespace Database\Factories;

use App\Models\Rsvp;
use App\Models\RsvpResponse;
use App\Models\TimeSlot;
use App\Models\Volunteer;
use Illuminate\Database\Eloquent\Factories\Factory;

class RsvpResponseFactory extends Factory
{
    protected $model = RsvpResponse::class;

    public function definition(): array
    {
        return [
            'volunteer_id' => Volunteer::factory(),
            'rsvp_id' => Rsvp::factory(),
            'time_slot_id' => TimeSlot::factory(),
            'voted_at' => now(),
            'attendance_status' => 'registered',
            'edit_count' => 0,
        ];
    }
}
