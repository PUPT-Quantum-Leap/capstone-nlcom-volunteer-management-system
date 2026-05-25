<?php

namespace Database\Factories;

use App\Models\Skill;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Skill>
 */
class SkillFactory extends Factory
{
    protected $model = Skill::class;

    public function definition(): array
    {
        return [
            'name' => fake()->unique()->randomElement([
                'First Aid', 'CPR', 'Driving', 'Communication', 'Logistics',
            ]),
        ];
    }
}
