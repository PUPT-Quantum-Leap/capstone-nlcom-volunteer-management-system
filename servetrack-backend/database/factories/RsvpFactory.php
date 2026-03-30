<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

class RsvpFactory extends Factory
{
    public function definition(): array
    {
        return [
            'title' => fake()->sentence(4),
            'description' => fake()->paragraph(),
            'date' => fake()->dateTimeBetween('now', '+3 months')->format('Y-m-d'),
            'event_location' => fake()->address(),
            'cutoff_day' => fake()->randomElement(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']),
            'cutoff_time' => fake()->randomElement(['8AM', '10AM', '12NN', '3PM', '5PM']),
            'status' => 'draft',
            'share_url' => null,
        ];
    }

    public function active(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'active',
        ]);
    }

    public function closed(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'closed',
        ]);
    }
}
