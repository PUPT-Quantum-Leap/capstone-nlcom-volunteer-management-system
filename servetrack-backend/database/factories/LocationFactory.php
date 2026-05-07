<?php

namespace Database\Factories;

use App\Models\Location;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Location>
 */
class LocationFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->company().' Center',
            'address' => fake()->streetAddress(),
            'city' => fake()->city(),
            'state' => fake()->state(),
            'zip_code' => fake()->postcode(),
            'country' => 'USA',
            'latitude' => fake()->latitude(),
            'longitude' => fake()->longitude(),
            'description' => fake()->sentence(),
            'contact_person' => fake()->name(),
            'contact_phone' => fake()->phoneNumber(),
            'is_active' => true,
        ];
    }
}
