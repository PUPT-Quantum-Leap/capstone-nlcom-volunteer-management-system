<?php

namespace Database\Factories;

use App\Models\Position;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Position>
 */
class PositionFactory extends Factory
{
    protected $model = Position::class;

    public function definition(): array
    {
        return [
            'name' => fake()->unique()->randomElement([
                'Medical', 'Rescue', 'Logistics', 'Communications', 'Admin',
            ]),
        ];
    }
}
