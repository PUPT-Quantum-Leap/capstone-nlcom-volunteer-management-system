<?php

namespace Database\Factories;

use App\Models\BackupScheduleSetting;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<BackupScheduleSetting>
 */
class BackupScheduleSettingFactory extends Factory
{
    protected $model = BackupScheduleSetting::class;

    public function definition(): array
    {
        return [
            'enabled' => true,
            'frequency' => 'daily',
        ];
    }

    public function disabled(): static
    {
        return $this->state(fn (array $attributes) => [
            'enabled' => false,
        ]);
    }

    public function weekly(): static
    {
        return $this->state(fn (array $attributes) => [
            'frequency' => 'weekly',
        ]);
    }

    public function monthly(): static
    {
        return $this->state(fn (array $attributes) => [
            'frequency' => 'monthly',
        ]);
    }
}
