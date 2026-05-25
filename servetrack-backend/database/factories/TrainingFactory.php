<?php

namespace Database\Factories;

use App\Models\Training;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Training>
 */
class TrainingFactory extends Factory
{
    protected $model = Training::class;

    public function definition(): array
    {
        return [
            'name' => fake()->unique()->randomElement([
                'Orientation', 'Safety Protocols',
                'Emergency Response', 'Leadership',
            ]),
        ];
    }
}
