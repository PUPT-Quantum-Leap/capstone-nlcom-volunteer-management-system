<?php

namespace Database\Factories;

use App\Models\Rsvp;
use App\Models\RsvpNotification;
use App\Models\Volunteer;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RsvpNotification>
 */
class RsvpNotificationFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'volunteer_id' => Volunteer::factory(),
            'rsvp_id' => Rsvp::factory(),
            'type' => 'event_created',
            'message' => $this->faker->sentence(),
            'read_at' => null,
            'email_sent' => false,
        ];
    }

    /**
     * Indicate that the notification has been read.
     */
    public function read(): static
    {
        return $this->state(function (array $attributes) {
            return [
                'read_at' => now(),
            ];
        });
    }

    /**
     * Indicate that the email has been sent.
     */
    public function emailSent(): static
    {
        return $this->state(function (array $attributes) {
            return [
                'email_sent' => true,
            ];
        });
    }
}
