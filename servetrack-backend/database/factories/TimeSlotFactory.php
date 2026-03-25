<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

class TimeSlotFactory extends Factory
{
    public function definition(): array
    {
        return [
            'text' => fake()->randomElement([
                '4:30am - 2:00pm',
                '4:30am - 7:00pm',
                '1:00pm - 7:00pm',
                '8:00am - 12:00pm',
                '1:00pm - 5:00pm',
            ]),
        ];
    }
}
