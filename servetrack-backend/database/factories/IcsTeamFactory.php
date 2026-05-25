<?php

namespace Database\Factories;

use App\Models\IcsTeam;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<IcsTeam>
 */
class IcsTeamFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'team' => fake()->randomElement(
                ['Team Alpha', 'Team Bravo', 'Team Charlie'],
            ),
            'departure_note' => fake()->sentence(),
            'location' => fake()->city(),
            'time' => fake()->randomElement(
                ['8:00am - 9:30am', '9:00am - 12:00nn', '2:00pm - 4:00pm'],
            ),
            'no_of_pax' => fake()->numberBetween(50, 350),
            'details' => fake()->sentence(),
        ];
    }
}
