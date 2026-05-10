<?php

namespace Database\Factories;

use App\Models\Rsvp;
use Illuminate\Database\Eloquent\Factories\Factory;

class RsvpFactory extends Factory
{
    public function definition(): array
    {
        $title = fake()->sentence(3);
        $date = now()->addMonth();

        return [
            'title' => $title,
            'description' => fake()->paragraph(),
            'date' => $date->format('Y-m-d'),
            'event_location' => fake()->address(),
            'cutoff_day' => $date->copy()->subDay()->format('Y-m-d'),
            'cutoff_time' => '23:59:00',
            'status' => 'draft',
            'share_url' => null,
            'slug' => fn (array $attributes) => Rsvp::generateUniqueSlug($attributes['title']),
        ];
    }

    public function active(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'active',
            'cutoff_day' => now()->addMonth()->toDateString(),
            'date' => now()->addMonth()->addDay()->toDateString(),
        ]);
    }

    public function closed(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'closed',
        ]);
    }
}
