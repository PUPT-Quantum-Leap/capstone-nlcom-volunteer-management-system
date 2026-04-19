<?php

namespace Database\Factories;

use App\Models\User;
use App\Models\Volunteer;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Volunteer> */
class VolunteerFactory extends Factory
{
    protected $model = Volunteer::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'first_name' => fake()->firstName(),
            'last_name' => fake()->lastName(),
            'facebook_name' => fake()->userName(),
            'email' => fake()->unique()->safeEmail(),
            'mobile_number' => fake()->numerify('09#########'),
            'birthdate' => fake()->dateTimeBetween('-50 years', '-18 years'),
            'address' => fake()->address(),
            'educational_attainment' => fake()->randomElement([
                'High School', 'College', 'Vocational', "Master's Degree",
            ]),
            'last_medical_examination' => fake()->dateTimeBetween('-1 year', 'today'),
            'user_id' => User::factory(),
        ];
    }
}
