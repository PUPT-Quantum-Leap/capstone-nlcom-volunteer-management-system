<?php

namespace Database\Factories;

use App\Models\Backup;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Backup>
 */
class BackupFactory extends Factory
{
    protected $model = Backup::class;

    public function definition(): array
    {
        $ts = now()->format('Y-m-d_His');
        $name = $ts.'_manual_'.Str::random(4);

        return [
            'name' => $name,
            'file_path' => 'backups/'.$name.'.sql',
            'size_bytes' => fake()->numberBetween(1024, 10 * 1024 * 1024),
            'type' => 'manual',
            'status' => 'completed',
            'completed_at' => now(),
        ];
    }

    public function failed(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'failed',
            'error_message' => fake()->sentence(),
            'completed_at' => null,
        ]);
    }

    public function automatic(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => 'automatic',
        ]);
    }

    public function pending(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'pending',
            'completed_at' => null,
        ]);
    }
}
