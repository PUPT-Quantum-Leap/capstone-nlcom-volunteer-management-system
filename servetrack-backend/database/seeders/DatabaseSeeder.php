<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // User::factory(10)->create();

        User::factory()->create([
            'name' => 'Test User',
            'email' => 'test@example.com',
        ]);

        $this->call([
            PositionSeeder::class,
            TeamSeeder::class,
            IcsSeeder::class,
            AttendanceSeeder::class,
        ]);

        if (env('DEMO_SEED', false)) {
            $this->call(DemoVolunteerSeeder::class);
        } else {
            $this->call(VolunteerSeeder::class);
        }
    }
}
